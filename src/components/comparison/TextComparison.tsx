import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeftRight, Copy, Download, CheckCircle2, XCircle, RotateCcw, Wand2, Loader2, FileText, Sparkles } from "lucide-react";
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
import jsPDF from "jspdf";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user } = useAuth();
  const [originalText, setOriginalText] = useState("");
  const [correctedText, setCorrectedText] = useState("");
  const [diffs, setDiffs] = useState<DiffSegment[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof computeStats> | null>(null);
  const [showInline, setShowInline] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [tone, setTone] = useState("profissional");
  const [comparisonName, setComparisonName] = useState("");

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

  // Apply AI suggestions: promote corrected -> original, re-run AI to verify no remaining issues
  const handleApplyAI = async () => {
    if (!correctedText.trim()) return;
    setIsApplying(true);
    try {
      const newOriginal = correctedText;
      setOriginalText(newOriginal);

      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { action: "correct", text: newOriginal, tone },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao aplicar correções");

      const corrected = data.correctedText || newOriginal;
      setCorrectedText(corrected);
      const diffResult = computeDiff(newOriginal, corrected);
      setDiffs(diffResult);
      const newStats = computeStats(diffResult);
      setStats(newStats);

      if (newStats.totalErrors === 0) {
        toast.success("✓ Correções aplicadas! Nenhum erro restante.");
      } else {
        toast.success(`Correções aplicadas. Ainda restam ${newStats.totalErrors} ajuste(s) sugerido(s).`);
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao aplicar correções");
    } finally {
      setIsApplying(false);
    }
  };

  const handleExportPDF = async () => {
    if (!correctedText) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 40;
    let y = margin;

    const ensure = (h: number) => {
      if (y + h > ph - margin) { doc.addPage(); y = margin; }
    };

    // Header
    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pw, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("COMPARAÇÃO DE TEXTOS", margin, 28);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Tom: ${tone} • ${new Date().toLocaleDateString("pt-BR")}`, margin, 46);
    y = 80;

    // Stats
    if (stats) {
      doc.setTextColor(20, 20, 20);
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(
        `Erros: ${stats.totalErrors}  •  Ortografia: ${stats.spelling}  •  Gramática: ${stats.grammar}  •  Score: ${stats.score}%`,
        margin,
        y,
      );
      y += 20;
    }

    const drawSection = (title: string, body: string, color: [number, number, number]) => {
      ensure(30);
      doc.setFillColor(...color);
      doc.rect(margin, y - 12, pw - margin * 2, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, margin + 6, y);
      y += 16;

      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(body || "—", pw - margin * 2);
      for (const line of lines) {
        ensure(14);
        doc.text(line, margin, y);
        y += 13;
      }
      y += 10;
    };

    drawSection("TEXTO ORIGINAL", originalText, [200, 60, 60]);
    drawSection("TEXTO CORRIGIDO", correctedText, [34, 150, 90]);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Página ${i}/${pageCount} • PDF Convert Pro`, pw - margin, ph - 16, { align: "right" });
    }

    // Local download
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const baseName = (comparisonName?.trim() || "comparacao")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.-]/g, "_").replace(/_+/g, "_");
    const fileName = `${baseName}_${dateStr}.pdf`;
    doc.save(fileName);
    toast.success("PDF baixado!");

    // Save backup to "Meus Arquivos"
    if (user?.id) {
      try {
        const blob = doc.output("blob");
        const filePath = `${user.id}/backups/${Date.now()}_${fileName}`;
        const { error: upErr } = await supabase.storage
          .from("documents")
          .upload(filePath, blob, { contentType: "application/pdf" });
        if (upErr) throw upErr;

        const { error: insErr } = await supabase.from("file_conversions").insert({
          user_id: user.id,
          original_name: fileName,
          original_format: "pdf",
          target_format: "pdf",
          status: "completed",
          original_path: filePath,
          converted_path: filePath,
          file_size: blob.size,
          is_backup: true,
        });
        if (insErr) throw insErr;
        toast.success("Backup salvo em Meus Arquivos");
      } catch (err: any) {
        console.error("Backup error:", err);
        toast.error("PDF baixado, mas falhou ao salvar backup");
      }
    }
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
              Copiar texto corrigido
            </Button>
            <Button variant="glow" size="sm" onClick={handleExportPDF}>
              <Download className="w-4 h-4 mr-1" />
              Baixar PDF
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
