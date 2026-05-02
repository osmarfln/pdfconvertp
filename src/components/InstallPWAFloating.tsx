import { useState, useEffect } from "react";
import { Download, X, Share, Plus, MoreVertical, Chrome, Smartphone } from "lucide-react";
import { useInstallPWA } from "@/components/InstallPWA";
import { motion, AnimatePresence } from "framer-motion";

type Platform = "ios" | "android" | "desktop" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Win|Mac|Linux/i.test(ua)) return "desktop";
  return "other";
}

export function InstallPWAFloating() {
  const { isInstallable, isInstalled, install } = useInstallPWA();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [platform, setPlatform] = useState<Platform>("other");

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari standalone
      (window.navigator as any).standalone === true);

  useEffect(() => {
    setPlatform(detectPlatform());
    // Persisted dismissal
    try {
      if (sessionStorage.getItem("pwa-banner-dismissed") === "true") {
        setDismissed(true);
        return;
      }
    } catch {}
    // Slight delay so the page renders first
    const t = setTimeout(() => setShow(true), 600);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShowInstructions(false);
    try {
      sessionStorage.setItem("pwa-banner-dismissed", "true");
    } catch {}
  };

  const handleInstall = async () => {
    // If browser supports the native install prompt, use it
    if (isInstallable) {
      try {
        await install();
      } catch (e) {
        console.error("[PWA] install error:", e);
        setShowInstructions(true);
      }
      return;
    }
    // Otherwise show platform-specific manual instructions
    setShowInstructions(true);
  };

  if (isStandalone || isInstalled || dismissed || !show) return null;

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

          {!showInstructions ? (
            // ============== Initial banner ==============
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center animate-pulse">
                <Download className="w-7 h-7 text-primary" />
              </div>
              <h4 className="font-display font-bold text-foreground text-base">📲 Instale o nosso app</h4>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">PDF Convert Pro</span> direto na sua tela inicial.
              </p>

              <button
                onClick={handleInstall}
                className="mt-2 w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.5)]"
              >
                <Download className="w-4 h-4" />
                {isInstallable ? "Instalar agora" : "Ver como instalar"}
              </button>

              <button
                onClick={handleDismiss}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Agora não
              </button>
            </div>
          ) : (
            // ============== Instructions ==============
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-foreground text-base">Como instalar</h4>
                  <p className="text-xs text-muted-foreground">
                    {platform === "ios" && "iPhone / iPad (Safari)"}
                    {platform === "android" && "Android (Chrome)"}
                    {platform === "desktop" && "Computador (Chrome / Edge)"}
                    {platform === "other" && "Seu navegador"}
                  </p>
                </div>
              </div>

              {platform === "ios" && (
                <ol className="space-y-3 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="flex-1">
                      Toque no botão <Share className="inline w-4 h-4 mx-0.5 text-primary" /> <strong>Compartilhar</strong> na barra do Safari (parte inferior).
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="flex-1">
                      Role para baixo e toque em <Plus className="inline w-4 h-4 mx-0.5 text-primary" />{" "}
                      <strong>Adicionar à Tela de Início</strong>.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="flex-1">
                      Toque em <strong>Adicionar</strong> no canto superior direito. Pronto! 🎉
                    </span>
                  </li>
                </ol>
              )}

              {platform === "android" && (
                <ol className="space-y-3 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="flex-1">
                      Toque no menu <MoreVertical className="inline w-4 h-4 mx-0.5 text-primary" /> (três pontos no canto superior direito do Chrome).
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="flex-1">
                      Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="flex-1">
                      Confirme tocando em <strong>Instalar</strong>. O ícone aparecerá na sua tela. 🎉
                    </span>
                  </li>
                </ol>
              )}

              {(platform === "desktop" || platform === "other") && (
                <ol className="space-y-3 text-sm text-foreground">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <span className="flex-1">
                      Procure o ícone <Download className="inline w-4 h-4 mx-0.5 text-primary" /> <strong>Instalar</strong> no canto direito da barra de endereço.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      2
                    </span>
                    <span className="flex-1">
                      Ou abra o menu <MoreVertical className="inline w-4 h-4 mx-0.5 text-primary" /> e escolha{" "}
                      <strong>Instalar PDF Convert Pro…</strong>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                      3
                    </span>
                    <span className="flex-1">
                      Clique em <strong>Instalar</strong> na janela que aparecer. 🎉
                    </span>
                  </li>
                </ol>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setShowInstructions(false)}
                  className="flex-1 h-10 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleDismiss}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
                >
                  Entendi
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
