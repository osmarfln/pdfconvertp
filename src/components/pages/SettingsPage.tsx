import { motion } from "framer-motion";
import { Settings, Bell, Shield, Palette, Globe } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Configurações</h2>
        <p className="text-muted-foreground mt-1">Personalize sua experiência na plataforma.</p>
      </div>

      {[
        {
          title: "Notificações",
          icon: Bell,
          items: [
            { label: "Notificar quando processamento concluir", key: "notify-done" },
            { label: "Notificar quando houver erro", key: "notify-error" },
            { label: "Resumo semanal por e-mail", key: "notify-weekly" },
          ],
        },
        {
          title: "Privacidade & Segurança",
          icon: Shield,
          items: [
            { label: "Excluir arquivos automaticamente após 24h", key: "auto-delete" },
            { label: "Autenticação em dois fatores", key: "2fa" },
          ],
        },
        {
          title: "Aparência",
          icon: Palette,
          items: [
            { label: "Modo escuro", key: "dark-mode" },
            { label: "Animações reduzidas", key: "reduce-motion" },
          ],
        },
        {
          title: "Idioma e Região",
          icon: Globe,
          items: [
            { label: "Português (Brasil)", key: "lang-pt" },
          ],
        },
      ].map((section, si) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: si * 0.1 }}
          className="glass rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <section.icon className="w-5 h-5 text-primary" />
            <h3 className="font-display font-semibold text-foreground">{section.title}</h3>
          </div>
          <div className="space-y-3">
            {section.items.map((item) => (
              <div key={item.key} className="flex items-center justify-between">
                <Label className="text-sm text-foreground/80 cursor-pointer">{item.label}</Label>
                <Switch />
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
