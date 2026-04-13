import { useState } from "react";
import { Download, X } from "lucide-react";
import { useInstallPWA } from "@/components/InstallPWA";
import { motion, AnimatePresence } from "framer-motion";

export function InstallPWAFloating() {
  const { isInstallable, isInstalled, install } = useInstallPWA();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || !isInstallable || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 80, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 80, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="fixed bottom-6 right-6 z-50 max-w-xs"
      >
        <div className="relative glass rounded-2xl p-5 shadow-2xl border border-primary/30 backdrop-blur-xl">
          <button
            onClick={() => setDismissed(true)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-display font-bold text-foreground text-sm leading-tight">
                Instale nosso aplicativo
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Conversão PDF rápida direto no seu celular ou desktop!
              </p>
            </div>
          </div>

          <button
            onClick={install}
            className="mt-4 w-full h-10 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]"
          >
            <Download className="w-4 h-4" />
            Instalar App
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
