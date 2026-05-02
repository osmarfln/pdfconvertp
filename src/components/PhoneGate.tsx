import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Phone, PartyPopper, Loader2 } from "lucide-react";
import { toast } from "sonner";

function fireConfetti() {
  const duration = 2500;
  const end = Date.now() + duration;
  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();

  // Fireworks-style bursts
  for (let i = 0; i < 3; i++) {
    setTimeout(() => {
      confetti({
        particleCount: 120,
        spread: 100,
        startVelocity: 45,
        origin: { x: Math.random(), y: Math.random() * 0.4 + 0.1 },
        colors,
      });
    }, i * 500);
  }
}

function formatPhone(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function PhoneGate() {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading || !user) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const p = (data?.phone || "").replace(/\D/g, "");
      if (p.length < 10) setOpen(true);
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  const digits = phone.replace(/\D/g, "");
  const isValid = digits.length === 10 || digits.length === 11;

  const handleSave = async () => {
    if (!isValid || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: digits })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar telefone. Tente novamente.");
      return;
    }
    setSuccess(true);
    fireConfetti();
    setTimeout(() => {
      setOpen(false);
      setSuccess(false);
    }, 3500);
  };

  if (checking || !user) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {!success ? (
          <>
            <DialogHeader>
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Phone className="w-7 h-7 text-primary" />
              </div>
              <DialogTitle className="text-center text-xl">Confirme seu telefone</DialogTitle>
              <DialogDescription className="text-center">
                Para liberar seu acesso à plataforma, informe um telefone válido com DDD.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (DDD + número)</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="(11) 91234-5678"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  className="text-lg text-center tracking-wide"
                  autoFocus
                />
                {phone && !isValid && (
                  <p className="text-xs text-destructive">
                    Digite um telefone válido com DDD (10 ou 11 dígitos).
                  </p>
                )}
              </div>

              <Button
                onClick={handleSave}
                disabled={!isValid || saving}
                className="w-full"
                size="lg"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="py-6 text-center space-y-3 animate-fade-in">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <PartyPopper className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">🎉 Tá liberado! 🎉</h2>
            <p className="text-muted-foreground">
              Você está liberado para usar nossa plataforma. <strong>Aproveite!</strong>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
