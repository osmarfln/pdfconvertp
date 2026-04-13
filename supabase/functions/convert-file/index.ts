import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ILOVEPDF_API = "https://api.ilovepdf.com/v1";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sanitizeSecret = (value: string | undefined | null) =>
  value?.trim().replace(/^['\"]+|['\"]+$/g, "") ?? "";

async function parseJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return { text: "", json: null as Record<string, any> | null };
  }

  try {
    return { text, json: JSON.parse(text) as Record<string, any> };
  } catch {
    return { text, json: null as Record<string, any> | null };
  }
}

async function authenticateWithILovePDF(publicKey: string) {
  try {
    console.log("Authenticating with iLovePDF...");

    const authRes = await fetch(`${ILOVEPDF_API}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: publicKey }),
    });

    const { text, json } = await parseJsonResponse(authRes);
    console.log("iLovePDF auth status:", authRes.status, text.slice(0, 200));

    if (authRes.ok && json?.token) {
      return { token: json.token as string, retryable: false, error: null };
    }

    const providerMessage =
      (json?.error && typeof json.error === "object" && "message" in json.error
        ? String(json.error.message)
        : null) ||
      text ||
      "Unknown authentication error";

    const retryable = authRes.status >= 500;
    const error = retryable
      ? "iLovePDF indisponível no momento ou chave pública inválida. Atualize a chave do projeto e tente novamente em alguns minutos."
      : `Falha ao autenticar com iLovePDF: ${providerMessage}`;

    return { token: null, retryable, error };
  } catch (error) {
    console.error("iLovePDF auth request failed:", error);
    return {
      token: null,
      retryable: true,
      error: "Não foi possível conectar ao iLovePDF no momento. Tente novamente em alguns minutos.",
    };
  }
}

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
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = user.id;

    const { action, conversionId, filePath, targetFormat, filePaths } = await req.json();

    const ILOVEPDF_KEY = sanitizeSecret(Deno.env.get("ILOVEPDF_PUBLIC_KEY"));
    if (!ILOVEPDF_KEY) {
      return jsonResponse({ error: "iLovePDF key not configured" }, 500);
    }

    const authResult = await authenticateWithILovePDF(ILOVEPDF_KEY);
    if (!authResult.token) {
      return jsonResponse({
        success: false,
        error: authResult.error,
        provider: "iLovePDF",
        retryable: authResult.retryable,
      });
    }
    const iToken = authResult.token;

    // Admin client for storage operations
    const adminSupabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "convert") {
      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      const toolKey = `${ext}-${targetFormat}`;
      const tool = TOOL_MAP[toolKey];
      console.log("Convert:", ext, "→", targetFormat, "tool:", tool, "filePath:", filePath);
      if (!tool) {
        return jsonResponse({ success: false, error: `Conversão ${ext} → ${targetFormat} não suportada` });
      }

      // Start task
      const startRes = await fetch(`${ILOVEPDF_API}/start/${tool}`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const startBody = await startRes.json();
      console.log("Start task:", startRes.status, JSON.stringify(startBody).slice(0, 200));
      const { server, task } = startBody;

      if (!server || !task) {
        return jsonResponse({ success: false, error: "iLovePDF start failed: " + JSON.stringify(startBody) });
      }

      // Get signed URL for the file
      const { data: signedData, error: signedError } = await adminSupabase.storage
        .from("documents")
        .createSignedUrl(filePath, 3600);

      console.log("Signed URL:", signedData?.signedUrl ? "OK" : "FAILED", signedError?.message);

      if (!signedData?.signedUrl) {
        return jsonResponse({ success: false, error: "Could not generate file URL: " + (signedError?.message || "unknown") });
      }

      // Upload to iLovePDF by URL
      console.log("Uploading to iLovePDF server:", server);
      const uploadRes = await fetch(`https://${server}/v1/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${iToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ task, cloud_file: signedData.signedUrl }),
      });
      const uploadBody = await uploadRes.json();
      console.log("Upload result:", uploadRes.status, JSON.stringify(uploadBody).slice(0, 200));
      const server_filename = uploadBody.server_filename;

      if (!server_filename) {
        return jsonResponse({ success: false, error: "iLovePDF upload failed: " + JSON.stringify(uploadBody) });
      }

      // Process
      const processBody: Record<string, unknown> = {
        task,
        tool,
        files: [{ server_filename, filename: filePath.split("/").pop() }],
      };
      if (tool === "pdfoffice") {
        processBody.output_format = targetFormat;
      }

      console.log("Processing...");
      const processRes = await fetch(`https://${server}/v1/process`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${iToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(processBody),
      });
      const processText = await processRes.text();
      console.log("Process result:", processRes.status, processText.slice(0, 200));

      if (!processRes.ok) {
        return jsonResponse({ success: false, error: "iLovePDF process failed: " + processText.slice(0, 300) });
      }

      // Download result
      console.log("Downloading result...");
      const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const resultBuffer = await downloadRes.arrayBuffer();
      console.log("Download:", downloadRes.status, "size:", resultBuffer.byteLength);

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

      return jsonResponse({ success: true, convertedPath });

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

      return jsonResponse({ success: true, convertedPath: mergedPath });

    } else if (action === "compress") {
      const startRes = await fetch(`${ILOVEPDF_API}/start/compress`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const { server, task } = await startRes.json();

      const { data: sd } = await adminSupabase.storage.from("documents").createSignedUrl(filePath, 3600);
      if (!sd?.signedUrl) {
        return jsonResponse({ error: "File URL error" }, 500);
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

      return jsonResponse({ success: true, convertedPath: compressedPath });

    } else if (action === "split") {
      const startRes = await fetch(`${ILOVEPDF_API}/start/split`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const { server, task } = await startRes.json();

      const { data: sd } = await adminSupabase.storage.from("documents").createSignedUrl(filePath, 3600);
      if (!sd?.signedUrl) {
        return jsonResponse({ error: "File URL error" }, 500);
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
        body: JSON.stringify({ task, tool: "split", files: [{ server_filename, filename: filePath.split("/").pop() }], split_mode: "fixed_range", fixed_range: 1 }),
      });

      const downloadRes = await fetch(`https://${server}/v1/download/${task}`, {
        headers: { Authorization: `Bearer ${iToken}` },
      });
      const resultBuffer = await downloadRes.arrayBuffer();
      const splitPath = `${userId}/converted/split_${Date.now()}.zip`;

      await adminSupabase.storage.from("documents").upload(splitPath, resultBuffer, {
        contentType: "application/zip",
      });

      return jsonResponse({ success: true, convertedPath: splitPath });
    }

    return jsonResponse({ error: "Invalid action" }, 400);

  } catch (err) {
    console.error("convert-file error:", err);
    return jsonResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
  }
});
