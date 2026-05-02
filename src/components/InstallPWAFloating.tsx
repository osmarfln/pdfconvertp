import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { useInstallPWA } from "@/components/InstallPWA";
import { motion, AnimatePresence } from "framer-motion";

export function InstallPWAFloating() {
  const { isInstallable, isInstalled, install } = useInstallPWA();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  const isStandalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    // Aparece imediatamente ao abrir a página
    setShow(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem("pwa-banner-dismissed", "true"); } catch {}
  };

  const handleInstall = () => {
    if (isInstallable) {
      install();
    } else {
      handleDismiss();
    }
  };

  if (isStandalone || isInstalled || dismissed || !show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      >
        <div className="relative glass rounded-2xl p-4 sm:p-6 shadow-2xl border border-primary/30 backdrop-blur-xl max-w-xs sm:max-w-sm w-full mx-4 pointer-events-auto">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center animate-pulse">
              <Download className="w-7 h-7 text-primary" />
            </div>
            <h4 className="font-display font-bold text-foreground text-base">
              📲 Instale o nosso app
            </h4>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Conversor PDF Universal</span> — clique aqui!
            </p>

            <button
              onClick={handleInstall}
              className="mt-2 w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]"
            >
              <Download className="w-4 h-4" />
              Clique aqui para instalar
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
