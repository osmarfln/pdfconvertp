import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "osmarfln@gmail.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    // Verify caller
    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(token);
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const provider =
      (user.app_metadata as any)?.provider ||
      user.identities?.[0]?.provider ||
      "email";

    const displayName =
      (user.user_metadata as any)?.full_name ||
      (user.user_metadata as any)?.name ||
      (user.email ? user.email.split("@")[0] : "Usuário");

    const admin = createClient(supabaseUrl, serviceKey);

    // Insert login record (drives realtime counter)
    const { error: insertErr } = await admin.from("user_logins").insert({
      user_id: user.id,
      email: user.email,
      display_name: displayName,
      provider,
    });
    if (insertErr) console.error("insert login error", insertErr);

    // Try to enqueue email to admin (only works if email infra is set up)
    let emailQueued = false;
    try {
      const { error: rpcErr } = await admin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        message: {
          to: ADMIN_EMAIL,
          subject: `🔔 Novo login na plataforma — ${displayName}`,
          html: `
            <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;color:#111318;">
              <h2 style="color:#3B82F6;margin:0 0 16px;">Novo login detectado</h2>
              <p style="font-size:15px;line-height:1.6;margin:0 0 12px;">
                O usuário <strong>${displayName}</strong> acabou de se conectar à plataforma.
              </p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f5f7fb;border-radius:8px;">
                <tr><td style="padding:10px 14px;color:#6b7280;">Nome</td><td style="padding:10px 14px;font-weight:600;">${displayName}</td></tr>
                <tr><td style="padding:10px 14px;color:#6b7280;">Email</td><td style="padding:10px 14px;">${user.email || "-"}</td></tr>
                <tr><td style="padding:10px 14px;color:#6b7280;">Provedor</td><td style="padding:10px 14px;">${provider}</td></tr>
                <tr><td style="padding:10px 14px;color:#6b7280;">Data</td><td style="padding:10px 14px;">${new Date().toLocaleString("pt-BR")}</td></tr>
              </table>
              <p style="font-size:13px;color:#6b7280;margin:16px 0 0;">
                Vamos dar as boas-vindas! 🎉
              </p>
            </div>
          `,
          purpose: "transactional",
        },
      });
      if (!rpcErr) emailQueued = true;
      else console.warn("enqueue_email not available:", rpcErr.message);
    } catch (e) {
      console.warn("email infra not configured", e);
    }

    return new Response(
      JSON.stringify({ ok: true, emailQueued }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: e?.message || "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
