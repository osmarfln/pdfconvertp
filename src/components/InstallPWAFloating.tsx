import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { useInstallPWA } from "@/components/InstallPWA";
import { motion, AnimatePresence } from "framer-motion";

export function InstallPWAFloating() {
  const { isInstallable, isInstalled, install } = useInstallPWA();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);
  const [installing, setInstalling] = useState(false);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const outcome = await install();
      if (outcome === "accepted") {
        handleDismiss();
      }
    } catch (e) {
      console.error("[PWA] install error:", e);
    } finally {
      setInstalling(false);
    }
  };

  if (isStandalone || isInstalled || dismissed || !show || !isInstallable) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="pwa-banner"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4"
      >
        <div className="relative glass rounded-2xl p-5 sm:p-6 shadow-2xl border border-primary/30 backdrop-blur-xl max-w-md w-full pointer-events-auto bg-background/95">
          <button
            onClick={handleDismiss}
            aria-label="Fechar"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors z-10"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center animate-pulse">
              <Download className="w-7 h-7 text-primary" />
            </div>
            <h4 className="font-display font-bold text-foreground text-base">📲 Instale aqui nosso App</h4>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">PDF Convert Pro</span> — Multi conversor universal PDF.
            </p>

            <button
              onClick={handleInstall}
              disabled={installing}
              className="mt-2 w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)] disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {installing ? "Instalando..." : "Instalar Agora"}
            </button>

            <button
              onClick={handleDismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Agora não
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
