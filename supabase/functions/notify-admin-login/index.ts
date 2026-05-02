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
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser(
      token,
    );
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

    // Insert login record (drives realtime counter in admin panel)
    const { data: loginRow, error: insertErr } = await admin
      .from("user_logins")
      .insert({
        user_id: user.id,
        email: user.email,
        display_name: displayName,
        provider,
      })
      .select("id")
      .maybeSingle();

    if (insertErr) console.error("insert login error", insertErr);

    // Send notification email to admin via transactional email system
    let emailSent = false;
    try {
      const idempotencyKey = `admin-login-${loginRow?.id || crypto.randomUUID()}`;
      const { error: invokeErr } = await admin.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "admin-login-notification",
            recipientEmail: ADMIN_EMAIL,
            idempotencyKey,
            templateData: {
              userName: displayName,
              userEmail: user.email,
              provider,
              loginAt: new Date().toLocaleString("pt-BR"),
            },
          },
        },
      );
      if (!invokeErr) emailSent = true;
      else console.warn("send-transactional-email error:", invokeErr);
    } catch (e) {
      console.warn("transactional email failed", e);
    }

    return new Response(
      JSON.stringify({ ok: true, emailSent }),
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
