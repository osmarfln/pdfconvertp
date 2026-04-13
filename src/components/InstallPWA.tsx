import { useState, useEffect, useCallback } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  return { isInstallable, isInstalled, install };
}

export function InstallPWAButton({ collapsed }: { collapsed: boolean }) {
  const { isInstallable, isInstalled, install } = useInstallPWA();

  if (isInstalled || !isInstallable) return null;

  return (
    <div className="px-3 pb-4">
      <Button
        onClick={install}
        variant="outline"
        className="w-full flex items-center gap-2 border-primary/30 text-primary hover:bg-primary/10 transition-all"
        size={collapsed ? "icon" : "default"}
      >
        <Download className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="text-sm font-medium">Instalar App</span>}
      </Button>
    </div>
  );
}
