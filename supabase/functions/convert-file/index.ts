import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ILOVEPDF_API = "https://api.ilovepdf.com/v1";

const TOOL_MAP: Record<string, string> = {
  "docx-pdf": "officepdf",
  "xlsx-pdf": "officepdf",
  "pptx-pdf": "officepdf",
  "jpg-pdf": "imagepdf",
  "jpeg-pdf": "imagepdf",
  "png-pdf": "imagepdf",
  "pdf-jpg": "pdfjpg",
  "pdf-docx": "pdfoffice",
  "pdf-xlsx": "pdfoffice",
  "merge": "merge",
  "split": "split",
  "compress": "compress",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { action, conversionId, filePath, targetFormat, filePaths } = await req.json();

    const ILOVEPDF_KEY = Deno.env.get("ILOVEPDF_PUBLIC_KEY");
    if (!ILOVEPDF_KEY) {
      return new Response(JSON.stringify({ error: "iLovePDF key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate with iLovePDF
    const authRes = await fetch(`${ILOVEPDF_API}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: ILOVEPDF_KEY }),
    });
    const { token: iToken } = await authRes.json();
    if (!iToken) {
      return new Response(JSON.stringify({ error: "Failed to authenticate with iLovePDF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin client for storage operations
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "convert") {
      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      const toolKey = `${ext}-${targetFormat}`;
      const tool = TOOL_MAP[toolKey];
      if (!tool) {
        return new Response(JSON.stringify({ error: `Conversão ${ext} → ${targetFormat} não suportada` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Start task
      const startRes = await fetch(`${ILOVEPDF_API}/start/${tool}`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const { server, task } = await startRes.json();

      // Get signed URL for the file
      const { data: signedData } = await adminSupabase.storage
        .from("documents")
        .createSignedUrl(filePath, 3600);

      if (!signedData?.signedUrl) {
        return new Response(JSON.stringify({ error: "Could not generate file URL" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Upload to iLovePDF by URL
      const uploadRes = await fetch(`https://${server}/v1/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${iToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ task, cloud_file: signedData.signedUrl }),
      });
      const { server_filename } = await uploadRes.json();

      // Process
      const processBody: Record<string, unknown> = {
        task,
        tool,
        files: [{ server_filename, filename: filePath.split("/").pop() }],
      };
      if (tool === "pdfoffice") {
        processBody.output_format = targetFormat;
      }

      await fetch(`https://${server}/v1/process`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${iToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(processBody),
      });

      // Download result
      const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const resultBuffer = await downloadRes.arrayBuffer();

      const originalName = filePath.split("/").pop()?.replace(/\.[^.]+$/, "") || "converted";
      const convertedPath = `${userId}/converted/${originalName}.${targetFormat}`;

      await adminSupabase.storage.from("documents").upload(convertedPath, resultBuffer, {
        contentType: targetFormat === "pdf" ? "application/pdf" : `application/${targetFormat}`,
        upsert: true,
      });

      // Update conversion record
      if (conversionId) {
        await supabase
          .from("file_conversions")
          .update({ status: "completed", converted_path: convertedPath })
          .eq("id", conversionId);
      }

      return new Response(JSON.stringify({ success: true, convertedPath }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "merge") {
      const startRes = await fetch(`${ILOVEPDF_API}/start/merge`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const { server, task } = await startRes.json();

      const files = [];
      for (const fp of filePaths) {
        const { data: sd } = await adminSupabase.storage.from("documents").createSignedUrl(fp, 3600);
        if (!sd?.signedUrl) continue;
        const upRes = await fetch(`https://${server}/v1/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${iToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ task, cloud_file: sd.signedUrl }),
        });
        const { server_filename } = await upRes.json();
        files.push({ server_filename, filename: fp.split("/").pop() });
      }

      await fetch(`https://${server}/v1/process`, {
        method: "POST",
        headers: { Authorization: `Bearer ${iToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ task, tool: "merge", files }),
      });

      const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const resultBuffer = await downloadRes.arrayBuffer();
      const mergedPath = `${userId}/converted/merged_${Date.now()}.pdf`;

      await adminSupabase.storage.from("documents").upload(mergedPath, resultBuffer, {
        contentType: "application/pdf",
      });

      return new Response(JSON.stringify({ success: true, convertedPath: mergedPath }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "compress") {
      const startRes = await fetch(`${ILOVEPDF_API}/start/compress`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const { server, task } = await startRes.json();

      const { data: sd } = await adminSupabase.storage.from("documents").createSignedUrl(filePath, 3600);
      if (!sd?.signedUrl) {
        return new Response(JSON.stringify({ error: "File URL error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const upRes = await fetch(`https://${server}/v1/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${iToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ task, cloud_file: sd.signedUrl }),
      });
      const { server_filename } = await upRes.json();

      await fetch(`https://${server}/v1/process`, {
        method: "POST",
        headers: { Authorization: `Bearer ${iToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ task, tool: "compress", files: [{ server_filename, filename: filePath.split("/").pop() }] }),
      });

      const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const resultBuffer = await downloadRes.arrayBuffer();
      const compressedPath = `${userId}/converted/compressed_${Date.now()}.pdf`;

      await adminSupabase.storage.from("documents").upload(compressedPath, resultBuffer, {
        contentType: "application/pdf",
      });

      return new Response(JSON.stringify({ success: true, convertedPath: compressedPath }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("convert-file error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
