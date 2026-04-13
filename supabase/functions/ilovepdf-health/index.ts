const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ILOVEPDF_API = "https://api.ilovepdf.com/v1";

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
    const publicKey = (Deno.env.get("ILOVEPDF_PUBLIC_KEY") ?? "").trim().replace(/^['\"]+|['\"]+$/g, "");

    if (!publicKey) {
      return json({ healthy: false, reason: "Chave iLovePDF não configurada" });
    }

    const res = await fetch(`${ILOVEPDF_API}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: publicKey }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.token) {
        return json({ healthy: true });
      }
    }

    const text = await res.text().catch(() => "");
    console.error("iLovePDF health check failed:", res.status, text.slice(0, 200));

    return json({
      healthy: false,
      reason: res.status >= 500
        ? "Serviço iLovePDF temporariamente indisponível"
        : "Falha na autenticação — verifique a chave pública",
    });
  } catch (err) {
    console.error("iLovePDF health error:", err);
    return json({ healthy: false, reason: "Não foi possível conectar ao iLovePDF" });
  }
});