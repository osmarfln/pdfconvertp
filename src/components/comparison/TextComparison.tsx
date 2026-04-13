import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Copy, Download, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiffSegment {
  type: "unchanged" | "added" | "removed" | "modified";
  original: string;
  corrected: string;
}

const sampleDiffs: DiffSegment[] = [
  { type: "unchanged", original: "A inteligência artificial tem ", corrected: "A inteligência artificial tem " },
  { type: "removed", original: "revolucionado", corrected: "" },
  { type: "added", original: "", corrected: "revolucionando" },
  { type: "unchanged", original: " o mercado de tecnologia. ", corrected: " o mercado de tecnologia. " },
  { type: "modified", original: "Muitas empresas ja", corrected: "Muitas empresas já" },
  { type: "unchanged", original: " estão adotando soluções baseadas em ", corrected: " estão adotando soluções baseadas em " },
  { type: "modified", original: "machine lerning", corrected: "machine learning" },
  { type: "unchanged", original: " para melhorar seus processos. ", corrected: " para melhorar seus processos. " },
  { type: "modified", original: "Os resultados tem", corrected: "Os resultados têm" },
  { type: "unchanged", original: " sido ", corrected: " sido " },
  { type: "removed", original: "muito bastante", corrected: "" },
  { type: "added", original: "", corrected: "bastante" },
  { type: "unchanged", original: " positivos, com aumento de produtividade ", corrected: " positivos, com aumento de produtividade " },
  { type: "modified", original: "e eficiencia", corrected: "e eficiência" },
  { type: "unchanged", original: " em diversos setores.", corrected: " em diversos setores." },
];

const stats = {
  totalErrors: 6,
  spelling: 3,
  grammar: 2,
  redundancy: 1,
  score: 92,
  improvement: 34,
};

export function TextComparison() {
  const [showInline, setShowInline] = useState(false);

  const renderOriginal = () =>
    sampleDiffs.map((seg, i) => {
      if (seg.type === "added") return null;
      const cls =
        seg.type === "removed"
          ? "bg-destructive/20 text-destructive line-through"
          : seg.type === "modified"
          ? "bg-warning/20 text-warning"
          : "";
      return (
        <span key={i} className={cls}>
          {seg.original}
        </span>
      );
    });

  const renderCorrected = () =>
    sampleDiffs.map((seg, i) => {
      if (seg.type === "removed") return null;
      const cls =
        seg.type === "added"
          ? "bg-success/20 text-success"
          : seg.type === "modified"
          ? "bg-success/20 text-success"
          : "";
      return (
        <span key={i} className={cls}>
          {seg.corrected || seg.original}
        </span>
      );
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">
            Comparação Visual
          </h2>
          <p className="text-muted-foreground mt-1">
            Compare o texto original com a versão corrigida pela IA.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setShowInline(!showInline)}
          >
            <ArrowLeftRight className="w-4 h-4 mr-1" />
            {showInline ? "Lado a lado" : "Inline"}
          </Button>
          <Button variant="glass" size="sm">
            <Copy className="w-4 h-4 mr-1" />
            Copiar
          </Button>
          <Button variant="glow" size="sm">
            <Download className="w-4 h-4 mr-1" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Erros Corrigidos", value: stats.totalErrors, icon: CheckCircle2, color: "text-success" },
          { label: "Ortografia", value: stats.spelling, icon: XCircle, color: "text-warning" },
          { label: "Gramática", value: stats.grammar, icon: XCircle, color: "text-warning" },
          { label: "Redundância", value: stats.redundancy, icon: RotateCcw, color: "text-muted-foreground" },
          { label: "Score", value: `${stats.score}%`, icon: CheckCircle2, color: "text-success" },
          { label: "Melhoria", value: `+${stats.improvement}%`, icon: CheckCircle2, color: "text-primary" },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-3 text-center"
          >
            <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
            <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Comparison panels */}
      {showInline ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass rounded-xl p-6"
        >
          <h3 className="font-display font-semibold text-foreground mb-3">
            Visualização Inline
          </h3>
          <div className="leading-relaxed text-sm">
            {sampleDiffs.map((seg, i) => {
              if (seg.type === "removed")
                return (
                  <span key={i} className="bg-destructive/20 text-destructive line-through mx-0.5">
                    {seg.original}
                  </span>
                );
              if (seg.type === "added")
                return (
                  <span key={i} className="bg-success/20 text-success mx-0.5">
                    {seg.corrected}
                  </span>
                );
              if (seg.type === "modified")
                return (
                  <span key={i}>
                    <span className="bg-destructive/20 text-destructive line-through mx-0.5">
                      {seg.original}
                    </span>
                    <span className="bg-success/20 text-success mx-0.5">
                      {seg.corrected}
                    </span>
                  </span>
                );
              return <span key={i}>{seg.original}</span>;
            })}
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <h3 className="font-display font-semibold text-foreground">Original</h3>
            </div>
            <div className="leading-relaxed text-sm text-foreground/80">
              {renderOriginal()}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass rounded-xl p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-success" />
              <h3 className="font-display font-semibold text-foreground">Corrigido</h3>
            </div>
            <div className="leading-relaxed text-sm text-foreground/80">
              {renderCorrected()}
            </div>
          </motion.div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-destructive/20 border border-destructive/30" />
          Removido
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-success/20 border border-success/30" />
          Adicionado
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-warning/20 border border-warning/30" />
          Modificado
        </div>
      </div>
    </div>
  );
}
