import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoSrc from "/logo-192.png";

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"glow" | "fadeout">("glow");

  useEffect(() => {
    const glowTimer = setTimeout(() => setPhase("fadeout"), 3600);
    const doneTimer = setTimeout(onComplete, 4200);
    return () => {
      clearTimeout(glowTimer);
      clearTimeout(doneTimer);
    };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "fadeout" ? null : null}
      <motion.div
        key="splash"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === "fadeout" ? 0 : 1 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden"
      >
        {/* Animated background particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/30"
              initial={{
                x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 800),
                y: Math.random() * (typeof window !== "undefined" ? window.innerHeight : 600),
                scale: 0,
              }}
              animate={{
                y: [null, Math.random() * -200],
                scale: [0, Math.random() * 2 + 0.5, 0],
                opacity: [0, 0.8, 0],
              }}
              transition={{
                duration: Math.random() * 3 + 2,
                repeat: Infinity,
                delay: Math.random() * 2,
                ease: "easeOut",
              }}
            />
          ))}
        </div>

        {/* Radial glow behind logo */}
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(217 91% 60% / 0.35) 0%, hsl(217 91% 60% / 0.08) 50%, transparent 70%)",
          }}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: [0.5, 1.3, 1, 1.2, 1],
            opacity: [0, 1, 0.7, 1, 0.8],
          }}
          transition={{ duration: 3, ease: "easeInOut" }}
        />

        {/* Pulsing ring */}
        <motion.div
          className="absolute w-32 h-32 rounded-full border-2 border-primary/40"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [0.8, 2.5, 3],
            opacity: [0, 0.5, 0],
          }}
          transition={{ duration: 2.5, delay: 0.5, ease: "easeOut" }}
        />
        <motion.div
          className="absolute w-32 h-32 rounded-full border border-primary/20"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [0.8, 3, 3.5],
            opacity: [0, 0.3, 0],
          }}
          transition={{ duration: 3, delay: 1, ease: "easeOut" }}
        />

        {/* Logo */}
        <motion.div
          className="relative z-10"
          initial={{ scale: 0.3, opacity: 0, rotateY: -90 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.img
            src={logoSrc}
            alt="PDF Convert Pro"
            width={120}
            height={120}
            className="drop-shadow-2xl"
            animate={{
              filter: [
                "drop-shadow(0 0 8px hsl(217 91% 60% / 0.3))",
                "drop-shadow(0 0 30px hsl(217 91% 60% / 0.8))",
                "drop-shadow(0 0 15px hsl(217 91% 60% / 0.5))",
                "drop-shadow(0 0 35px hsl(217 91% 60% / 0.9))",
                "drop-shadow(0 0 10px hsl(217 91% 60% / 0.4))",
              ],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>

        {/* App name */}
        <motion.h1
          className="relative z-10 mt-6 text-3xl font-display font-bold tracking-tight"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
        >
          <span className="text-gradient">PDF Convert</span>{" "}
          <span className="text-foreground">Pro</span>
        </motion.h1>

        {/* Welcome message */}
        <motion.p
          className="relative z-10 mt-3 text-muted-foreground text-base font-medium"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          Bem-vindo à plataforma inteligente de documentos ✨
        </motion.p>

        {/* Loading bar */}
        <motion.div
          className="relative z-10 mt-8 w-48 h-1 rounded-full bg-secondary overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--gradient-primary)" }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ delay: 1.5, duration: 2, ease: "easeInOut" }}
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
