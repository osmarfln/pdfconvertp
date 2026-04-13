import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Copy, Download, CheckCircle2, XCircle, RotateCcw, Wand2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DiffSegment {
  type: "unchanged" | "added" | "removed" | "modified";
  original: string;
  corrected: string;
}

function computeDiff(original: string, corrected: string): DiffSegment[] {
  const origWords = original.split(/(\s+)/);
  const corrWords = corrected.split(/(\s+)/);
  const segments: DiffSegment[] = [];

  const maxLen = Math.max(origWords.length, corrWords.length);
  let i = 0, j = 0;

  while (i < origWords.length || j < corrWords.length) {
    const ow = i < origWords.length ? origWords[i] : "";
    const cw = j < corrWords.length ? corrWords[j] : "";

    if (ow === cw) {
      segments.push({ type: "unchanged", original: ow, corrected: cw });
      i++; j++;
    } else if (ow && cw) {
      // Check if original word exists ahead in corrected (was something added)
      const lookAheadCorr = corrWords.indexOf(ow, j);
      const lookAheadOrig = origWords.indexOf(cw, i);

      if (lookAheadCorr !== -1 && lookAheadCorr - j <= 3) {
        // Words were added in corrected
        while (j < lookAheadCorr) {
          segments.push({ type: "added", original: "", corrected: corrWords[j] });
          j++;
        }
      } else if (lookAheadOrig !== -1 && lookAheadOrig - i <= 3) {
        // Words were removed from original
        while (i < lookAheadOrig) {
          segments.push({ type: "removed", original: origWords[i], corrected: "" });
          i++;
        }
      } else {
        segments.push({ type: "modified", original: ow, corrected: cw });
        i++; j++;
      }
    } else if (!cw) {
      segments.push({ type: "removed", original: ow, corrected: "" });
      i++;
    } else {
      segments.push({ type: "added", original: "", corrected: cw });
      j++;
    }
  }

  return segments;
}

function computeStats(diffs: DiffSegment[]) {
  let spelling = 0, grammar = 0, removed = 0;
  for (const d of diffs) {
    if (d.type === "modified") {
      if (d.original.toLowerCase().replace(/[áàâãéêíóôõúç]/g, '') === d.corrected.toLowerCase().replace(/[áàâãéêíóôõúç]/g, '')) {
        grammar++;
      } else {
        spelling++;
      }
    } else if (d.type === "removed") {
      removed++;
    } else if (d.type === "added") {
      // additions don't count as errors
    }
  }
  const total = spelling + grammar + removed;
  const totalWords = diffs.filter(d => d.type !== "removed" || d.original.trim()).length;
  const errorRate = totalWords > 0 ? ((totalWords - total) / totalWords) * 100 : 100;
  return { totalErrors: total, spelling, grammar, redundancy: removed, score: Math.round(errorRate), improvement: total > 0 ? Math.round((total / Math.max(totalWords, 1)) * 100) : 0 };
}

export function TextComparison() {
  const [originalText, setOriginalText] = useState("");
  const [correctedText, setCorrectedText] = useState("");
  const [diffs, setDiffs] = useState<DiffSegment[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof computeStats> | null>(null);
  const [showInline, setShowInline] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tone, setTone] = useState("profissional");

  const handleCorrectAndCompare = async () => {
    if (!originalText.trim()) return;
    setIsProcessing(true);
    setCorrectedText("");
    setDiffs([]);
    setStats(null);

    try {
      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { action: "correct", text: originalText, tone },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro na correção");

      const corrected = data.correctedText;
      setCorrectedText(corrected);
      const diffResult = computeDiff(originalText, corrected);
      setDiffs(diffResult);
      setStats(computeStats(diffResult));
      toast.success("Comparação gerada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (correctedText) {
      navigator.clipboard.writeText(correctedText);
      toast.success("Texto corrigido copiado!");
    }
  };

  const handleExport = () => {
    if (!correctedText || !originalText) return;
    const content = `=== TEXTO ORIGINAL ===\n\n${originalText}\n\n=== TEXTO CORRIGIDO ===\n\n${correctedText}\n\n=== ESTATÍSTICAS ===\nErros corrigidos: ${stats?.totalErrors || 0}\nOrtografia: ${stats?.spelling || 0}\nGramática: ${stats?.grammar || 0}\nRedundância: ${stats?.redundancy || 0}\nScore: ${stats?.score || 0}%`;
    
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comparacao_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado!");
  };

  const renderOriginal = () =>
    diffs.map((seg, i) => {
      if (seg.type === "added") return null;
      const cls =
        seg.type === "removed"
          ? "bg-destructive/20 text-destructive line-through"
          : seg.type === "modified"
          ? "bg-warning/20 text-warning"
          : "";
      return <span key={i} className={cls}>{seg.original}</span>;
    });

  const renderCorrected = () =>
    diffs.map((seg, i) => {
      if (seg.type === "removed") return null;
      const cls =
        seg.type === "added"
          ? "bg-success/20 text-success"
          : seg.type === "modified"
          ? "bg-success/20 text-success"
          : "";
      return <span key={i} className={cls}>{seg.corrected || seg.original}</span>;
    });

  const hasDiffs = diffs.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">Comparação Visual</h2>
          <p className="text-muted-foreground mt-1">Cole seu texto, corrija com IA e veja as diferenças destacadas.</p>
        </div>
        {hasDiffs && (
          <div className="flex gap-2">
            <Button variant="glass" size="sm" onClick={() => setShowInline(!showInline)}>
              <ArrowLeftRight className="w-4 h-4 mr-1" />
              {showInline ? "Lado a lado" : "Inline"}
            </Button>
            <Button variant="glass" size="sm" onClick={handleCopy}>
              <Copy className="w-4 h-4 mr-1" />
              Copiar
            </Button>
            <Button variant="glow" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" />
              Exportar
            </Button>
          </div>
        )}
      </div>

      {/* Input area */}
      {!hasDiffs && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Texto para comparar</span>
            </div>
            <Textarea
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              placeholder="Cole ou digite o texto que deseja corrigir e comparar..."
              className="min-h-[200px] bg-secondary border-border resize-none"
            />
            <p className="text-xs text-muted-foreground">{originalText.length} caracteres</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="w-48 bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="profissional">Profissional</SelectItem>
                <SelectItem value="academico">Acadêmico</SelectItem>
                <SelectItem value="juridico">Jurídico</SelectItem>
                <SelectItem value="simples">Simples</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="glow" onClick={handleCorrectAndCompare} disabled={!originalText.trim() || isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
              {isProcessing ? "Processando..." : "Corrigir e Comparar"}
            </Button>
          </div>
        </div>
      )}

      {/* Stats bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Erros Corrigidos", value: stats.totalErrors, icon: CheckCircle2, color: "text-success" },
            { label: "Ortografia", value: stats.spelling, icon: XCircle, color: "text-warning" },
            { label: "Gramática", value: stats.grammar, icon: XCircle, color: "text-warning" },
            { label: "Redundância", value: stats.redundancy, icon: RotateCcw, color: "text-muted-foreground" },
            { label: "Score", value: `${stats.score}%`, icon: CheckCircle2, color: "text-success" },
          ].map((stat) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-3 text-center">
              <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
              <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Comparison panels */}
      {hasDiffs && (
        <>
          {showInline ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-6">
              <h3 className="font-display font-semibold text-foreground mb-3">Visualização Inline</h3>
              <div className="leading-relaxed text-sm">
                {diffs.map((seg, i) => {
                  if (seg.type === "removed") return <span key={i} className="bg-destructive/20 text-destructive line-through mx-0.5">{seg.original}</span>;
                  if (seg.type === "added") return <span key={i} className="bg-success/20 text-success mx-0.5">{seg.corrected}</span>;
                  if (seg.type === "modified") return (
                    <span key={i}>
                      <span className="bg-destructive/20 text-destructive line-through mx-0.5">{seg.original}</span>
                      <span className="bg-success/20 text-success mx-0.5">{seg.corrected}</span>
                    </span>
                  );
                  return <span key={i}>{seg.original}</span>;
                })}
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                  <h3 className="font-display font-semibold text-foreground">Original</h3>
                </div>
                <div className="leading-relaxed text-sm text-foreground/80">{renderOriginal()}</div>
              </motion.div>
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-success" />
                  <h3 className="font-display font-semibold text-foreground">Corrigido</h3>
                </div>
                <div className="leading-relaxed text-sm text-foreground/80">{renderCorrected()}</div>
              </motion.div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <Button variant="glass" onClick={() => { setDiffs([]); setStats(null); setCorrectedText(""); }}>
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Nova Comparação
            </Button>
          </div>

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
        </>
      )}
    </div>
  );
}
