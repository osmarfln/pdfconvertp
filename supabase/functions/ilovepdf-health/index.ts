const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CLOUDCONVERT_API = "https://api.cloudconvert.com/v2";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const apiKey = (Deno.env.get("CLOUDCONVERT_API_KEY") ?? "").trim();

    if (!apiKey) {
      return json({ healthy: false, reason: "Chave CloudConvert não configurada" });
    }

    // Simple check: list user info to verify the key works
    const res = await fetch(`${CLOUDCONVERT_API}/users/me`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (res.ok) {
      return json({ healthy: true });
    }

    const text = await res.text().catch(() => "");
    console.error("CloudConvert health check failed:", res.status, text.slice(0, 200));

    return json({
      healthy: false,
      reason: res.status === 401 || res.status === 403
        ? "Chave CloudConvert inválida — verifique a API key"
        : "Serviço CloudConvert temporariamente indisponível",
    });
  } catch (err) {
    console.error("CloudConvert health error:", err);
    return json({ healthy: false, reason: "Não foi possível conectar ao CloudConvert" });
  }
});
