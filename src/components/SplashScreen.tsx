import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoSrc from "@/assets/logo.png";

type Phase = "spinning" | "welcome" | "fadeout";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>("spinning");

  useEffect(() => {
    // 1) Logo gira por 4 segundos
    const welcomeTimer = setTimeout(() => setPhase("welcome"), 4000);
    // 2) Mostra texto de boas-vindas por ~1.6s
    const fadeoutTimer = setTimeout(() => setPhase("fadeout"), 5600);
    // 3) Finaliza
    const doneTimer = setTimeout(onComplete, 6300);
    return () => {
      clearTimeout(welcomeTimer);
      clearTimeout(fadeoutTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === "fadeout" ? 0 : 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden"
      >
        {/* Radial glow */}
        <motion.div
          className="absolute w-[320px] h-[320px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(217 91% 60% / 0.35) 0%, hsl(217 91% 60% / 0.08) 50%, transparent 70%)",
          }}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: [0.6, 1.2, 1], opacity: [0, 1, 0.8] }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />

        <AnimatePresence mode="wait">
          {phase === "spinning" && (
            <motion.div
              key="logo-spinner"
              className="relative z-10 flex flex-col items-center"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <motion.img
                src={logoSrc}
                alt="PDF Convert Pro"
                width={140}
                height={140}
                className="drop-shadow-2xl"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1.6,
                  repeat: Infinity,
                  ease: "linear",
                }}
                style={{
                  filter: "drop-shadow(0 0 24px hsl(217 91% 60% / 0.7))",
                }}
              />
              <motion.div
                className="mt-8 w-48 h-1 rounded-full bg-secondary overflow-hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <motion.div
                  className="h-full rounded-full bg-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 4, ease: "easeInOut" }}
                />
              </motion.div>
            </motion.div>
          )}

          {phase === "welcome" && (
            <motion.div
              key="welcome"
              className="relative z-10 flex flex-col items-center"
              initial={{ scale: 0.8, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <motion.img
                src={logoSrc}
                alt="PDF Convert Pro"
                width={120}
                height={120}
                className="drop-shadow-2xl mb-6"
                initial={{ scale: 0.6, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
              <motion.h1
                className="text-3xl md:text-4xl font-display font-bold tracking-tight text-center"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
              >
                <span className="text-foreground">Seja Bem-vindos ao </span>
                <span className="text-gradient">Convert Pro</span>
              </motion.h1>
              <motion.span
                className="mt-3 text-sm text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                ✨ Pronto para começar
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
