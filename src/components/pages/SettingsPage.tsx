import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, Shield, Palette, Globe, Save, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SettingsState {
  "notify-done": boolean;
  "notify-error": boolean;
  "notify-weekly": boolean;
  "auto-delete": boolean;
  "auto-cleanup-after-download": boolean;
  "2fa": boolean;
  "dark-mode": boolean;
  "reduce-motion": boolean;
  "lang-pt": boolean;
}

const STORAGE_KEY = "pdfconvert-settings";

const defaultSettings: SettingsState = {
  "notify-done": true,
  "notify-error": true,
  "notify-weekly": false,
  "auto-delete": false,
  "auto-cleanup-after-download": false,
  "2fa": false,
  "dark-mode": true,
  "reduce-motion": false,
  "lang-pt": true,
};

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (key: keyof SettingsState) => {
    setSettings((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      setHasChanges(true);
      return updated;
    });
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      // Apply dark/light mode
      if (settings["dark-mode"]) {
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.add("light");
      }

      setSaving(false);
      setHasChanges(false);
      toast.success("Configurações salvas com sucesso!");
    }, 500);
  };

  // Apply theme on mount
  useEffect(() => {
    if (!settings["dark-mode"]) {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, []);

  const sections = [
    {
      title: "Notificações",
      icon: Bell,
      items: [
        { label: "Notificar quando processamento concluir", key: "notify-done" as const },
        { label: "Notificar quando houver erro", key: "notify-error" as const },
        { label: "Resumo semanal por e-mail", key: "notify-weekly" as const },
      ],
    },
    {
      title: "Privacidade & Segurança",
      icon: Shield,
      items: [
        { label: "Excluir arquivos automaticamente após 24h", key: "auto-delete" as const },
        { label: "Autenticação em dois fatores", key: "2fa" as const },
      ],
    },
    {
      title: "Aparência",
      icon: Palette,
      items: [
        { label: "Modo escuro", key: "dark-mode" as const },
        { label: "Animações reduzidas", key: "reduce-motion" as const },
      ],
    },
    {
      title: "Idioma e Região",
      icon: Globe,
      items: [
        { label: "Português (Brasil)", key: "lang-pt" as const },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Configurações</h2>
          <p className="text-muted-foreground mt-1">Personalize sua experiência na plataforma.</p>
        </div>
        <Button
          variant="glow"
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {sections.map((section, si) => (
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
                <Switch
                  checked={settings[item.key]}
                  onCheckedChange={() => handleToggle(item.key)}
                />
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
