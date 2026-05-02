import { motion } from "framer-motion";
import { Zap, Sparkles, ShieldCheck, Gauge, Brain } from "lucide-react";
import { polishText } from "@/lib/textPolish";

const benefits = [
  {
    icon: Zap,
    title: "Rapidez incomparável",
    desc: "Conversões e otimizações em segundos, sem travamentos ou esperas.",
  },
  {
    icon: Sparkles,
    title: "Qualidade profissional",
    desc: "Mantém formatação, fontes e imagens originais com fidelidade total.",
  },
  {
    icon: Brain,
    title: "Correção com IA",
    desc: "Ortografia, gramática e pontuação ajustadas automaticamente nos seus PDFs.",
  },
  {
    icon: Gauge,
    title: "Otimização inteligente",
    desc: "Reduz o tamanho do arquivo preservando a qualidade visual do documento.",
  },
  {
    icon: ShieldCheck,
    title: "Seguro e privado",
    desc: "Seus arquivos são processados com criptografia e nunca compartilhados.",
  },
];

export function BenefitsSection() {
  return (
    <section aria-labelledby="benefits-title" className="space-y-4">
      <div>
        <h3
          id="benefits-title"
          className="text-base sm:text-lg md:text-xl font-display font-bold text-foreground"
        >
          {polishText("Por que escolher o CONVERT PDF PRO?")}
        </h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {polishText(
            "Vantagens exclusivas para gerenciar , otimizar e transformar seus PDFs - tudo em um só lugar."
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {benefits.map((b, i) => {
          const Icon = b.icon;
          return (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.06 }}
              className="group relative rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm p-4 md:p-5 hover:border-primary/50 hover:bg-card/80 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm md:text-base font-semibold text-foreground">
                    {polishText(b.title)}
                  </h4>
                  <p className="mt-1 text-xs md:text-sm text-muted-foreground leading-relaxed">
                    {polishText(b.desc)}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
