import { useState, useEffect, useCallback } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallOutcome = "accepted" | "dismissed" | "unavailable";

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let installPromptReady = false;
let appInstalled = false;
let installPromptSetup = false;
const installSubscribers = new Set<() => void>();

const notifyInstallSubscribers = () => {
  installSubscribers.forEach((callback) => callback());
};

const isRunningStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true);

const setupInstallPromptListener = () => {
  if (installPromptSetup || typeof window === "undefined") return;
  installPromptSetup = true;
  appInstalled = isRunningStandalone();

  window.addEventListener("beforeinstallprompt", (event: Event) => {
    event.preventDefault();
    if (appInstalled) return;

    deferredInstallPrompt = event as BeforeInstallPromptEvent;
    installPromptReady = true;
    notifyInstallSubscribers();
  });

  window.addEventListener("appinstalled", () => {
    appInstalled = true;
    installPromptReady = false;
    deferredInstallPrompt = null;
    notifyInstallSubscribers();
  });
};

setupInstallPromptListener();

export function useInstallPWA() {
  const [installState, setInstallState] = useState(() => ({
    isInstallable: installPromptReady,
    isInstalled: appInstalled || isRunningStandalone(),
  }));

  useEffect(() => {
    setupInstallPromptListener();

    const updateInstallState = () => {
      setInstallState({
        isInstallable: installPromptReady,
        isInstalled: appInstalled || isRunningStandalone(),
      });
    };

    installSubscribers.add(updateInstallState);
    updateInstallState();

    return () => {
      installSubscribers.delete(updateInstallState);
    };
  }, []);

  const install = useCallback(async (): Promise<InstallOutcome> => {
    const promptEvent = deferredInstallPrompt;
    if (!promptEvent || appInstalled) return "unavailable";

    deferredInstallPrompt = null;
    installPromptReady = false;
    notifyInstallSubscribers();

    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      appInstalled = true;
    }
    notifyInstallSubscribers();
    return outcome;
  }, []);

  return { ...installState, install };
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
