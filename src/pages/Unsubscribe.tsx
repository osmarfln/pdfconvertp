import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2, MailX, CheckCircle2, AlertCircle } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<
    "loading" | "valid" | "already" | "invalid" | "submitting" | "done" | "error"
  >("loading");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_KEY } },
        );
        const data = await res.json();
        if (data.valid === true) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    if (!token) return;
    setState("submitting");
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({ token }),
        },
      );
      const data = await res.json();
      if (data.success) setState("done");
      else if (data.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-2xl text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          {state === "done" || state === "already" ? (
            <CheckCircle2 className="w-8 h-8 text-primary" />
          ) : state === "invalid" || state === "error" ? (
            <AlertCircle className="w-8 h-8 text-destructive" />
          ) : (
            <MailX className="w-8 h-8 text-primary" />
          )}
        </div>

        {state === "loading" && (
          <>
            <h1 className="text-xl font-bold mb-2">Verificando…</h1>
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
          </>
        )}

        {state === "valid" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Cancelar inscrição</h1>
            <p className="text-muted-foreground mb-6">
              Confirme para parar de receber emails do PDF Convert Pro.
            </p>
            <Button onClick={confirm} className="w-full" size="lg">
              Confirmar cancelamento
            </Button>
          </>
        )}

        {state === "submitting" && (
          <>
            <h1 className="text-xl font-bold mb-2">Processando…</h1>
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
          </>
        )}

        {state === "done" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Inscrição cancelada</h1>
            <p className="text-muted-foreground">
              Você não receberá mais emails. Sentiremos sua falta!
            </p>
          </>
        )}

        {state === "already" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Já cancelado</h1>
            <p className="text-muted-foreground">
              Este email já foi removido da nossa lista.
            </p>
          </>
        )}

        {state === "invalid" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Link inválido</h1>
            <p className="text-muted-foreground">
              O link de cancelamento expirou ou é inválido.
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="text-2xl font-bold mb-2">Erro</h1>
            <p className="text-muted-foreground">
              Não foi possível processar agora. Tente novamente em instantes.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
