import { motion } from "framer-motion";
import {
  FileText,
  Sparkles,
  Shield,
  Zap,
  Brain,
  GitCompare,
  FileEdit,
  Download,
  CheckCircle2,
  Users,
  Clock,
  Lock,
} from "lucide-react";

const features = [
  {
    icon: FileText,
    title: "Conversão Inteligente de PDF",
    desc: "Converta PDFs para Word, Excel, imagens e muito mais com qualidade profissional.",
  },
  {
    icon: Brain,
    title: "OCR com IA Avançada",
    desc: "Extraia texto de imagens e PDFs escaneados com precisão usando inteligência artificial.",
  },
  {
    icon: GitCompare,
    title: "Comparação de Documentos",
    desc: "Compare dois textos ou PDFs e veja exatamente o que foi adicionado, removido ou alterado.",
  },
  {
    icon: FileEdit,
    title: "Editor de PDF Completo",
    desc: "Edite, adicione anotações, mescle e divida arquivos PDF diretamente no navegador.",
  },
  {
    icon: Sparkles,
    title: "Correção com IA",
    desc: "Melhore a gramática, ortografia e clareza dos seus textos automaticamente.",
  },
  {
    icon: Download,
    title: "Exportação Flexível",
    desc: "Baixe seus arquivos em múltiplos formatos: PDF, DOCX, XLSX, TXT e mais.",
  },
];

const benefits = [
  { icon: Zap, label: "Processamento ultra-rápido" },
  { icon: Shield, label: "Seus arquivos 100% seguros" },
  { icon: Lock, label: "Criptografia ponta a ponta" },
  { icon: Clock, label: "Disponível 24/7" },
  { icon: Users, label: "Milhares de usuários ativos" },
  { icon: CheckCircle2, label: "Sem limite de uso" },
];

export function LandingHero() {
  return (
    <div className="space-y-8">
      {/* Headline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h1 className="font-display font-bold text-3xl md:text-5xl text-foreground leading-tight">
          Transforme seus{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            documentos PDF
          </span>{" "}
          com inteligência
        </h1>
        <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed">
          O <strong className="text-foreground">PDF Convert Pro</strong> é a sua
          plataforma tudo-em-um para converter, editar, comparar e otimizar
          documentos PDF usando o que há de mais moderno em Inteligência
          Artificial.
        </p>
      </motion.div>

      {/* Features grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3"
      >
        {features.map((f, i) => (
          <div
            key={i}
            className="glass rounded-xl p-4 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <f.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-sm text-foreground">
                  {f.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Benefits */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="glass rounded-xl p-5"
      >
        <h3 className="font-display font-semibold text-foreground mb-3 text-sm uppercase tracking-wider text-primary">
          Por que escolher a gente?
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {benefits.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <b.icon className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-foreground">{b.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* CTA hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.45 }}
        className="text-center sm:text-left"
      >
        <p className="text-sm text-muted-foreground">
          👉 Crie sua conta agora ao lado e comece a usar gratuitamente.
        </p>
      </motion.div>
    </div>
  );
}
