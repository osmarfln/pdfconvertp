import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, Shield, AlertTriangle, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import logoBg from "@/assets/logo-bg.png";

interface PhoneGateProps {
  userId: string;
  onComplete: () => void;
}

export function PhoneGate({ userId, onComplete }: PhoneGateProps) {
  const [ddd, setDdd] = useState("");
  const [number, setNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isValidDdd = /^\d{2}$/.test(ddd);
  const isValidNumber = /^\d{8,9}$/.test(number);
  const isValid = isValidDdd && isValidNumber;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const formatDisplay = () => {
    if (!ddd && !number) return "";
    return `(${ddd}) ${number.length === 9 ? number.replace(/(\d{5})(\d{4})/, "$1-$2") : number.replace(/(\d{4})(\d{4})/, "$1-$2")}`;
  };

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    const fullPhone = `+55${ddd}${number}`;

    // Get user email to ensure we can create the profile if it doesn't exist
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email ?? null;

    // Try update first
    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ phone: fullPhone } as any)
      .eq("user_id", userId)
      .select("user_id");

    if (updateError) {
      console.error("[PhoneGate] update error:", updateError);
      toast({ title: "Erro ao salvar", description: updateError.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // If no row was updated, the profile doesn't exist yet — create it
    if (!updated || updated.length === 0) {
      const { error: insertError } = await supabase
        .from("profiles")
        .insert({ user_id: userId, email, phone: fullPhone } as any);

      if (insertError) {
        console.error("[PhoneGate] insert error:", insertError);
        toast({ title: "Erro ao salvar", description: insertError.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "Telefone salvo!", description: "Bem-vindo à plataforma." });
    setSaving(false);
    onComplete();
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{ backgroundImage: `url(${logoBg})` }}
      />
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={logoBg} alt="PDF Convert Pro" className="w-14 h-14 rounded-xl object-cover" />
          <h1 className="font-display font-bold text-xl text-foreground">PDF Convert Pro</h1>
        </div>

        <div className="glass rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
              <Phone className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-display font-bold text-foreground">
              Informe seu telefone
            </h2>
            <p className="text-sm text-muted-foreground">
              Para sua segurança e para receber atualizações importantes da plataforma.
            </p>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">
              <strong>Atenção:</strong> Sem um número válido você não receberá as atualizações da plataforma.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-24 space-y-2">
                <Label htmlFor="ddd" className="text-sm text-foreground">DDD</Label>
                <Input
                  id="ddd"
                  value={ddd}
                  onChange={(e) => setDdd(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="11"
                  className={`bg-secondary border-border text-center text-lg font-mono ${isValidDdd ? "border-primary ring-1 ring-primary/30" : ""}`}
                  maxLength={2}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="phone" className="text-sm text-foreground">Número</Label>
                <Input
                  id="phone"
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
                  placeholder="999999999"
                  className={`bg-secondary border-border text-lg font-mono ${isValidNumber ? "border-primary ring-1 ring-primary/30" : ""}`}
                  maxLength={9}
                />
              </div>
            </div>

            {(ddd || number) && (
              <p className="text-center text-sm text-muted-foreground font-mono">
                {formatDisplay()}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-4 h-4 text-primary" />
              <span>Seus dados estão protegidos e não serão compartilhados.</span>
            </div>
          </div>

          <Button
            variant="glow"
            className="w-full h-12 text-base"
            disabled={!isValid || saving}
            onClick={handleSave}
          >
            {saving ? "Salvando..." : "Salvar e acessar a plataforma"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Entrar com outro e-mail
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
