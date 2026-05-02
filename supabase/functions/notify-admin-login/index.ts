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

    // Always record the raw login event (drives realtime counter in admin panel)
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

    if (insertErr) console.error("[notify-admin-login] insert login error", insertErr);

    // ---- DEDUPLICATION (cooldown) ----
    // Notify the admin on each real login, while still blocking rapid duplicate
    // calls caused by React StrictMode, page reloads, or OAuth redirects.
    const COOLDOWN_MS = 30 * 1000; // 30 seconds
    const { data: existingNotif } = await admin
      .from("admin_login_notifications")
      .select("id, email_sent, attempts, notified_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingNotif?.email_sent && existingNotif.notified_at) {
      const lastMs = new Date(existingNotif.notified_at).getTime();
      if (!Number.isNaN(lastMs) && Date.now() - lastMs < COOLDOWN_MS) {
        console.log(
          `[notify-admin-login] SKIP (cooldown) user=${user.id} email=${user.email}`,
        );
        return new Response(
          JSON.stringify({
            ok: true,
            deduplicated: true,
            reason: "admin already notified within cooldown window",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Reserve the slot via UPSERT before sending — atomic guard against
    // two simultaneous logins racing to send the email.
    const { error: upsertErr } = await admin
      .from("admin_login_notifications")
      .upsert(
        {
          user_id: user.id,
          user_email: user.email,
          display_name: displayName,
          provider,
          email_sent: false,
          attempts: (existingNotif?.attempts || 0) + 1,
        },
        { onConflict: "user_id" },
      );

    if (upsertErr) {
      console.error("[notify-admin-login] upsert dedup row failed", upsertErr);
    }

    // Send notification email to admin via the app email system.
    // Use the verified user's JWT at the gateway; the target function performs
    // its internal writes with its own service credentials.
    let emailSent = false;
    let lastError: string | null = null;
    try {
      const idempotencyKey = `admin-login-${loginRow?.id || `${user.id}-${Date.now()}`}`;

      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
          apikey: anonKey,
        },
        body: JSON.stringify({
          templateName: "admin-login-notification",
          recipientEmail: ADMIN_EMAIL,
          idempotencyKey,
          templateData: {
            userName: displayName,
            userEmail: user.email,
            provider,
            loginAt: new Date().toLocaleString("pt-BR", {
              timeZone: "America/Sao_Paulo",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }) + " (Brasília)",
          },
        }),
      });

      const responseText = await emailResponse.text();
      let invokeData: any = null;
      try {
        invokeData = responseText ? JSON.parse(responseText) : null;
      } catch {
        invokeData = responseText;
      }

      if (!emailResponse.ok) {
        lastError = `HTTP ${emailResponse.status}: ${responseText || emailResponse.statusText}`;
        console.warn("[notify-admin-login] invoke error:", lastError, invokeData);
      } else if (invokeData?.success === false) {
        lastError = invokeData.reason || "email not sent";
        console.warn("[notify-admin-login] email skipped:", lastError, invokeData);
      } else {
        emailSent = true;
        console.log(
          `[notify-admin-login] SENT user=${user.id} email=${user.email} provider=${provider}`,
        );
      }
    } catch (e: any) {
      lastError = e?.message || String(e);
      console.warn("[notify-admin-login] transactional email failed", e);
    }

    // Persist the final state (email_sent + last_error) so we know if we can retry later
    await admin
      .from("admin_login_notifications")
      .update({
        email_sent: emailSent,
        last_error: lastError,
        notified_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({ ok: true, emailSent, deduplicated: false, loginId: loginRow?.id }),
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
