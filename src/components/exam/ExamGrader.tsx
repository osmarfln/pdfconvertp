import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader2, GraduationCap, Download, CheckCircle2, XCircle, AlertCircle, MinusCircle, FileText, X, Clock, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

type PageStatus = "pending" | "processing" | "done" | "error";
interface PageProgress {
  index: number;
  status: PageStatus;
  durationMs?: number;
  questionsFound?: number;
  error?: string;
}

interface QuestionResult {
  number: number;
  question_text: string;
  student_answer: string;
  correct_answer: string;
  is_correct: "correct" | "partial" | "incorrect" | "blank";
  points_earned: number;
  max_points: number;
  feedback: string;
}

interface GradingResult {
  exam_title?: string;
  subject: string;
  total_questions: number;
  questions: QuestionResult[];
  total_score: number;
  grade: number;
  correct_count: number;
  incorrect_count: number;
  partial_count: number;
  overall_feedback: string;
}

const SUBJECTS = [
  { value: "portugues", label: "Português" },
  { value: "matematica", label: "Matemática" },
  { value: "calculo", label: "Cálculo" },
  { value: "geral", label: "Geral / Outras" },
];

async function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function pdfToImages(file: File): Promise<{ base64: string; mime: string }[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const out: { base64: string; mime: string }[] = [];
  const maxPages = Math.min(pdf.numPages, 10);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85)!);
    const b64 = await fileToBase64(blob);
    out.push({ base64: b64, mime: "image/jpeg" });
  }
  return out;
}

function generateGradingPDF(g: GradingResult, studentName: string) {
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
  doc.rect(0, 0, pw, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("CORREÇÃO DE PROVA", margin, 32);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`${g.exam_title || "Prova"} • ${g.subject.toUpperCase()}`, margin, 52);
  y = 90;

  doc.setTextColor(20, 20, 20);
  if (studentName) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Aluno: ${studentName}`, margin, y);
    y += 20;
  }

  // Big grade box
  ensure(80);
  const boxX = margin;
  const boxW = pw - margin * 2;
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(2);
  doc.roundedRect(boxX, y, boxW, 70, 8, 8);
  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  const gradeColor: [number, number, number] = g.grade >= 7 ? [34, 197, 94] : g.grade >= 5 ? [234, 179, 8] : [239, 68, 68];
  doc.setTextColor(...gradeColor);
  doc.text(`${g.grade.toFixed(1)} / 10`, boxX + 20, y + 48);
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.setFont("helvetica", "normal");
  doc.text(`Pontuação: ${g.total_score.toFixed(0)}/100`, boxX + 200, y + 28);
  doc.text(`✓ Acertos: ${g.correct_count}`, boxX + 200, y + 44);
  doc.text(`~ Parciais: ${g.partial_count}`, boxX + 320, y + 44);
  doc.text(`✗ Erros: ${g.incorrect_count}`, boxX + 420, y + 44);
  y += 90;

  // Overall feedback
  if (g.overall_feedback) {
    ensure(40);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text("Comentário geral:", margin, y); y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(g.overall_feedback, pw - margin * 2);
    ensure(lines.length * 12 + 10);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 14;
  }

  // Questions
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  ensure(20);
  doc.text("Questões:", margin, y); y += 18;

  for (const q of g.questions) {
    ensure(80);
    const statusColor: [number, number, number] =
      q.is_correct === "correct" ? [34, 197, 94] :
      q.is_correct === "partial" ? [234, 179, 8] :
      q.is_correct === "blank" ? [120, 120, 120] : [239, 68, 68];
    const statusLabel =
      q.is_correct === "correct" ? "CERTO" :
      q.is_correct === "partial" ? "PARCIAL" :
      q.is_correct === "blank" ? "EM BRANCO" : "ERRADO";

    // Question header
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 12, pw - margin * 2, 18, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 20, 20);
    doc.text(`Questão ${q.number}`, margin + 6, y);
    doc.setTextColor(...statusColor);
    doc.text(statusLabel, margin + 90, y);
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.text(`${q.points_earned.toFixed(1)}/${q.max_points} pts`, pw - margin - 70, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    const block = (label: string, text: string) => {
      const lines = doc.splitTextToSize(`${label} ${text || "—"}`, pw - margin * 2 - 10);
      ensure(lines.length * 11 + 4);
      doc.text(lines, margin + 6, y);
      y += lines.length * 11 + 2;
    };
    block("Enunciado:", q.question_text);
    block("Resposta do aluno:", q.student_answer);
    block("Resposta correta:", q.correct_answer);
    if (q.feedback) block("Comentário:", q.feedback);
    y += 6;
  }

  // Footer page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i}/${pageCount} • PDF Convert Pro`, pw - margin, ph - 16, { align: "right" });
  }

  return doc;
}

export function ExamGrader() {
  const [subject, setSubject] = useState("portugues");
  const [studentName, setStudentName] = useState("");
  const [examTitle, setExamTitle] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<GradingResult | null>(null);
  // Per-page progress tracking
  const [pageProgress, setPageProgress] = useState<PageProgress[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, forceTick] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const tickRef = useRef<number | null>(null);

  const reset = () => {
    setFiles([]);
    setResult(null);
    setProgress(0);
    setStage("");
    setPageProgress([]);
    setStartedAt(null);
  };

  const onSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (!list.length) return;
    const valid = list.filter((f) => /\.(png|jpe?g|webp|pdf)$/i.test(f.name) && f.size < 15 * 1024 * 1024);
    if (valid.length !== list.length) toast.warning("Alguns arquivos foram ignorados (tipo ou >15MB).");
    setFiles(valid);
    setResult(null);
    e.target.value = "";
  };

  const startTicker = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => forceTick((t) => t + 1), 500);
  };
  const stopTicker = () => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const handleGrade = async () => {
    if (!files.length) return;
    setIsProcessing(true);
    setResult(null);
    setProgress(0);
    setPageProgress([]);
    setStage("Preparando páginas...");
    setStartedAt(Date.now());
    startTicker();

    try {
      // ===== Stage 1: Convert files to images (client-side) =====
      const pages: { base64: string; mime: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setStage(`Preparando ${f.name}...`);
        if (/\.pdf$/i.test(f.name)) {
          const imgs = await pdfToImages(f);
          pages.push(...imgs);
        } else {
          pages.push({ base64: await fileToBase64(f), mime: f.type || "image/png" });
        }
        setProgress(Math.round(((i + 1) / files.length) * 20));
      }

      if (pages.length > 12) {
        toast.error("Máximo 12 páginas. Reduza o número de arquivos.");
        setIsProcessing(false);
        setProgress(0);
        setStage("");
        stopTicker();
        return;
      }

      // Initialize per-page progress list
      setPageProgress(pages.map((_, i) => ({ index: i, status: "pending" })));
      setStage(`IA corrigindo ${pages.length} página(s)...`);
      setProgress(20);

      // ===== Stage 2: Stream per-page grading via SSE =====
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/grade-exam`;
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          stream: true,
          imagesBase64: pages.map((p) => p.base64),
          mimeTypes: pages.map((p) => p.mime),
          subject,
          studentName: studentName || undefined,
          examTitle: examTitle || undefined,
        }),
      });

      if (!resp.ok || !resp.body) {
        let msg = `Falha na correção (${resp.status})`;
        try { const j = await resp.json(); msg = j.error || msg; } catch {}
        throw new Error(msg);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalGrading: GradingResult | null = null;

      const handleEvent = (event: string, data: any) => {
        if (event === "start") {
          // total pages confirmed
        } else if (event === "page_start") {
          setPageProgress((prev) => prev.map((p) => (p.index === data.index ? { ...p, status: "processing" } : p)));
          setStage(`Corrigindo página ${data.index + 1} de ${data.total}...`);
        } else if (event === "page_done") {
          setPageProgress((prev) =>
            prev.map((p) =>
              p.index === data.index
                ? { ...p, status: "done", durationMs: data.durationMs, questionsFound: data.questionsFound }
                : p,
            ),
          );
          // Progress: 20% (prep) + up to 70% across pages + 10% aggregation
          const frac = (data.index + 1) / data.total;
          setProgress(20 + Math.round(frac * 70));
        } else if (event === "page_error") {
          setPageProgress((prev) =>
            prev.map((p) =>
              p.index === data.index
                ? { ...p, status: "error", durationMs: data.durationMs, error: data.error }
                : p,
            ),
          );
        } else if (event === "aggregating") {
          setStage("Consolidando resultado...");
          setProgress(92);
        } else if (event === "overall_feedback_start") {
          setStage("Gerando comentário geral...");
          setProgress(96);
        } else if (event === "done") {
          finalGrading = data.grading as GradingResult;
          setProgress(100);
          setStage("Correção concluída!");
        } else if (event === "error") {
          throw new Error(data.error || "Erro no streaming");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Parse SSE blocks separated by \n\n
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          let event = "message";
          let dataStr = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
          }
          if (!dataStr) continue;
          try {
            const data = JSON.parse(dataStr);
            handleEvent(event, data);
          } catch (e) {
            console.warn("SSE parse error", e, dataStr.slice(0, 120));
          }
        }
      }

      if (!finalGrading) throw new Error("A correção não foi finalizada");
      setResult(finalGrading);
      toast.success(`Nota: ${finalGrading.grade.toFixed(1)} / 10`);
    } catch (err: any) {
      console.error("Grade error:", err);
      toast.error(err.message || "Erro ao corrigir prova");
      setProgress(0);
      setStage("");
    } finally {
      stopTicker();
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    const pdf = generateGradingPDF(result, studentName);
    const filename = `correcao_${(studentName || "aluno").replace(/\s+/g, "_")}_${Date.now()}.pdf`;
    pdf.save(filename);
    toast.success("PDF da correção baixado!");
  };

  const statusIcon = (s: string) => {
    if (s === "correct") return <CheckCircle2 className="w-4 h-4 text-success" />;
    if (s === "partial") return <AlertCircle className="w-4 h-4 text-warning" />;
    if (s === "blank") return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
    return <XCircle className="w-4 h-4 text-destructive" />;
  };
  const statusLabel = (s: string) =>
    s === "correct" ? "Certo" : s === "partial" ? "Parcial" : s === "blank" ? "Em branco" : "Errado";

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
          <GraduationCap className="w-5 h-5 text-warning" />
        </div>
        <div>
          <h3 className="font-display font-semibold text-foreground">Correção de Provas</h3>
          <p className="text-sm text-muted-foreground">
            Envie a foto ou PDF da prova. A IA identifica as questões, corrige e calcula a nota final.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select value={subject} onValueChange={setSubject} disabled={isProcessing}>
          <SelectTrigger className="bg-secondary border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {SUBJECTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input
          placeholder="Nome do aluno (opcional)"
          value={studentName}
          onChange={(e) => setStudentName(e.target.value)}
          disabled={isProcessing}
          className="bg-secondary border-border"
        />
        <Input
          placeholder="Título da prova (opcional)"
          value={examTitle}
          onChange={(e) => setExamTitle(e.target.value)}
          disabled={isProcessing}
          className="bg-secondary border-border"
        />
      </div>

      <div
        onClick={() => !isProcessing && inputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-secondary/30 transition-colors"
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-foreground font-medium">Clique para enviar a prova</p>
        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP ou PDF (até 15MB cada • máx 12 páginas no total)</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={onSelect}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-foreground truncate flex-1">{f.name}</span>
              <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
              {!isProcessing && (
                <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="glow" onClick={handleGrade} disabled={!files.length || isProcessing}>
          {isProcessing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <GraduationCap className="w-4 h-4 mr-1.5" />}
          {isProcessing ? "Corrigindo..." : "Corrigir prova"}
        </Button>
        {(result || files.length > 0) && !isProcessing && (
          <Button variant="glass" onClick={reset}>Limpar</Button>
        )}
      </div>

      {(isProcessing || progress > 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{stage || "Processando..."}</span>
            <span className="text-primary font-medium">{progress}%</span>
          </div>
          <Progress value={progress} />
        </motion.div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="glass rounded-xl p-5 space-y-4 border border-primary/20">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Nota Final</p>
                <p className={`text-5xl font-display font-bold ${result.grade >= 7 ? "text-success" : result.grade >= 5 ? "text-warning" : "text-destructive"}`}>
                  {result.grade.toFixed(1)}<span className="text-2xl text-muted-foreground"> / 10</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">Pontuação: {result.total_score.toFixed(0)}/100</p>
              </div>
              <Button variant="glow" onClick={handleDownloadPDF}>
                <Download className="w-4 h-4 mr-1.5" />
                Baixar PDF da correção
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-success/10 border border-success/30 p-3 text-center">
                <p className="text-2xl font-bold text-success">{result.correct_count}</p>
                <p className="text-xs text-muted-foreground">Acertos</p>
              </div>
              <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 text-center">
                <p className="text-2xl font-bold text-warning">{result.partial_count}</p>
                <p className="text-xs text-muted-foreground">Parciais</p>
              </div>
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-center">
                <p className="text-2xl font-bold text-destructive">{result.incorrect_count}</p>
                <p className="text-xs text-muted-foreground">Erros</p>
              </div>
            </div>

            {result.overall_feedback && (
              <div className="rounded-lg bg-secondary/50 border border-border p-3">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Comentário geral</p>
                <p className="text-sm text-foreground">{result.overall_feedback}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="font-display font-semibold text-foreground">Detalhamento por questão</h4>
            {result.questions.map((q) => (
              <div key={q.number} className="glass rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {statusIcon(q.is_correct)}
                    <span className="font-semibold text-foreground">Questão {q.number}</span>
                    <Badge variant="outline" className="text-xs">{statusLabel(q.is_correct)}</Badge>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {q.points_earned.toFixed(1)} / {q.max_points} pts
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{q.question_text}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className={`rounded-lg p-2 border ${q.is_correct === "correct" ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                    <p className="text-xs text-muted-foreground">Resposta do aluno</p>
                    <p className="text-foreground">{q.student_answer || "—"}</p>
                  </div>
                  <div className="rounded-lg p-2 border border-success/30 bg-success/5">
                    <p className="text-xs text-muted-foreground">Resposta correta</p>
                    <p className="text-foreground">{q.correct_answer || "—"}</p>
                  </div>
                </div>
                {q.feedback && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-primary/40 pl-2">
                    💬 {q.feedback}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
