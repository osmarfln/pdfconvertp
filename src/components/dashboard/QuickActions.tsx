import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { FileOutput, FileText, ScanText, Wand2, Merge, Split, ImageDown, Image as ImageIcon, Minimize2, Loader2, AlertTriangle, Pencil } from "lucide-react";
import { useFileConversions } from "@/hooks/useFileConversions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useILovePDFHealth } from "@/hooks/useILovePDFHealth";
import { ConversionProgressDialog, ConversionProgressState, initialProgressState, ConversionStage } from "@/components/ConversionProgressDialog";
import { detectPageCount } from "@/lib/pdfUtils";
import { JpgToPdfDialog } from "@/components/dashboard/JpgToPdfDialog";

interface QuickActionsProps {
  onNavigate?: (tab: string) => void;
}

export function QuickActions({ onNavigate }: QuickActionsProps) {
  const { conversions, convertFile, compressFile, uploadFile } = useFileConversions();
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const { healthy, reason, checking, recheck } = useILovePDFHealth();
  const [progress, setProgress] = useState<ConversionProgressState>(initialProgressState);
  const progressTimer = useRef<number | null>(null);

  // JPG → PDF dialog
  const [jpgDialogOpen, setJpgDialogOpen] = useState(false);
  const [jpgFile, setJpgFile] = useState<File | null>(null);
  const jpgInputRef = useRef<HTMLInputElement>(null);

  // Edit PDF (open in editor)
  const editPdfInputRef = useRef<HTMLInputElement>(null);

  // Generic file picker for direct conversion actions
  const pickerInputRef = useRef<HTMLInputElement>(null);
  const pickerConfigRef = useRef<{
    accept: string;
    label: string;
    title: string;
    target: string;
    validExts: string[];
  } | null>(null);

  const openFilePicker = (config: {
    accept: string;
    label: string;
    title: string;
    target: string;
    validExts: string[];
  }) => {
    pickerConfigRef.current = config;
    if (pickerInputRef.current) {
      pickerInputRef.current.accept = config.accept;
      pickerInputRef.current.click();
    }
  };

  const stopProgressTimer = () => {
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  const stageStartRef = useRef<number>(0);
  const stageDurationsRef = useRef<Partial<Record<ConversionStage, number>>>({});

  const enterStage = (stage: ConversionStage, message: string, jumpTo?: number) => {
    const now = Date.now();
    setProgress((p) => {
      // Record duration of the previous stage if it had a startedAt
      const prevStage = p.stage;
      if (p.stageStartedAt && prevStage && prevStage !== "idle" && prevStage !== "completed" && prevStage !== "error") {
        stageDurationsRef.current[prevStage] = now - p.stageStartedAt;
      }
      stageStartRef.current = now;
      return {
        ...p,
        stage,
        message,
        progress: jumpTo !== undefined ? jumpTo : p.progress,
        stageStartedAt: now,
        stageDurations: { ...stageDurationsRef.current },
      };
    });
  };

  const startSimulatedProgress = (from: number, to: number, durationMs: number) => {
    stopProgressTimer();
    const steps = 30;
    const stepMs = durationMs / steps;
    const stepInc = (to - from) / steps;
    let current = from;
    setProgress((p) => ({ ...p, progress: from }));
    progressTimer.current = window.setInterval(() => {
      current += stepInc;
      if (current >= to) {
        current = to;
        stopProgressTimer();
      }
      setProgress((p) => ({ ...p, progress: current }));
    }, stepMs);
  };

  const runConversionWithProgress = async (
    title: string,
    fileName: string,
    fn: () => Promise<void>,
    fileSize?: number | null,
    sourceFormat?: string | null,
    sourcePath?: string | null,
  ) => {
    const startedAt = Date.now();
    stageDurationsRef.current = {};

    // Initial state — we'll detect real page count in the preparing stage
    const fallbackPages = fileSize ? Math.max(1, Math.round(fileSize / (100 * 1024))) : undefined;
    setProgress({
      open: true,
      title,
      fileName,
      stage: "preparing",
      progress: 0,
      message: "Preparando arquivo (contando páginas)...",
      startedAt,
      stageStartedAt: startedAt,
      pages: fallbackPages,
      pagesSource: fallbackPages ? "estimated" : undefined,
      stageDurations: {},
    });
    stageStartRef.current = startedAt;

    // Real page detection (PDF only — non-blocking but awaited briefly)
    try {
      const realPages = await detectPageCount(sourceFormat, sourcePath, fileSize);
      if (realPages) {
        const isReal = sourceFormat === "pdf" && !!sourcePath;
        setProgress((p) => ({
          ...p,
          pages: realPages,
          pagesSource: isReal ? "real" : "estimated",
        }));
      }
    } catch {
      // ignore — keep fallback
    }

    enterStage("uploading", "Enviando para o servidor...", 15);
    startSimulatedProgress(15, 35, 1200);
    await new Promise((r) => setTimeout(r, 1200));

    enterStage("processing", "Convertendo documento...", 35);
    startSimulatedProgress(35, 85, 12000);

    try {
      await fn();
      stopProgressTimer();
      enterStage("downloading", "Finalizando e salvando...", 85);
      startSimulatedProgress(85, 100, 800);
      await new Promise((r) => setTimeout(r, 900));
      stopProgressTimer();
      // Record final stage duration
      const now = Date.now();
      stageDurationsRef.current.downloading = now - stageStartRef.current;
      setProgress((p) => ({
        ...p,
        stage: "completed",
        progress: 100,
        message: "Concluído!",
        stageDurations: { ...stageDurationsRef.current },
      }));
    } catch (err: any) {
      stopProgressTimer();
      setProgress((p) => ({ ...p, stage: "error", error: err?.message || "Erro desconhecido" }));
    }
  };

  const pdfFiles = conversions.filter((c) => c.original_format === "pdf" && c.original_path);
  const docFiles = conversions.filter((c) => ["docx", "xlsx", "pptx"].includes(c.original_format) && c.original_path);
  const imageFiles = conversions.filter((c) => ["jpg", "jpeg", "png"].includes(c.original_format) && c.original_path);

  const handleAction = async (label: string) => {
    if (label === "Corrigir com IA") {
      onNavigate?.("ai");
      return;
    }

    if (label === "OCR") {
      onNavigate?.("ai");
      toast.info("Use a função de extração OCR na página IA & Correção.");
      return;
    }

    if (label === "Editar PDF") {
      editPdfInputRef.current?.click();
      return;
    }

    if (label === "JPG → PDF") {
      jpgInputRef.current?.click();
      return;
    }

    if (label === "Mesclar PDF") {
      onNavigate?.("files");
      toast.info("Selecione os PDFs na página de arquivos para mesclar.");
      return;
    }

    // All other actions need iLovePDF
    if (healthy === false) {
      toast.error(reason || "Serviço de conversão indisponível no momento. Tente novamente mais tarde.");
      return;
    }

    if (label === "Word → PDF") {
      openFilePicker({
        accept: ".docx,.xlsx,.pptx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation",
        label,
        title: "Word → PDF",
        target: "pdf",
        validExts: ["docx", "xlsx", "pptx"],
      });
      return;
    }

    if (label === "PDF → Word") {
      openFilePicker({
        accept: "application/pdf,.pdf",
        label,
        title: "PDF → Word",
        target: "docx",
        validExts: ["pdf"],
      });
      return;
    }

    if (label === "PDF → JPG") {
      openFilePicker({
        accept: "application/pdf,.pdf",
        label,
        title: "PDF → JPG",
        target: "jpg",
        validExts: ["pdf"],
      });
      return;
    }

    if (label === "Comprimir") {
      openFilePicker({
        accept: "application/pdf,.pdf",
        label,
        title: "Comprimir PDF",
        target: "compress",
        validExts: ["pdf"],
      });
      return;
    }

    if (label === "Dividir PDF") {
      openFilePicker({
        accept: "application/pdf,.pdf",
        label,
        title: "Dividir PDF",
        target: "split",
        validExts: ["pdf"],
      });
      return;
    }
  };

  const handlePickedFile = async (file: File) => {
    const cfg = pickerConfigRef.current;
    if (!cfg) return;
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!cfg.validExts.includes(ext)) {
      toast.error(`Formato inválido. Selecione: ${cfg.validExts.join(", ").toUpperCase()}`);
      return;
    }

    setProcessingAction(cfg.label);
    try {
      // Upload first
      const conv = await uploadFile(file);
      if (!conv || !conv.original_path) {
        setProcessingAction(null);
        return;
      }

      if (cfg.target === "compress") {
        await runConversionWithProgress(cfg.title, file.name, async () => {
          await compressFile(conv.original_path!);
        }, file.size, ext, conv.original_path);
      } else if (cfg.target === "split") {
        await runConversionWithProgress(cfg.title, file.name, async () => {
          const { data, error } = await supabase.functions.invoke("convert-file", {
            body: { action: "split", filePath: conv.original_path },
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Split failed");
        }, file.size, ext, conv.original_path);
      } else {
        await runConversionWithProgress(cfg.title, file.name, async () => {
          await convertFile(conv.id, conv.original_path!, cfg.target);
        }, file.size, ext, conv.original_path);
      }
    } catch (err: any) {
      toast.error("Erro: " + (err?.message || "desconhecido"));
    } finally {
      setProcessingAction(null);
      pickerConfigRef.current = null;
    }
  };


  const actions = [
    { icon: FileOutput, label: "Word → PDF", desc: "Converter documentos", color: "bg-primary/10 text-primary" },
    { icon: FileText, label: "PDF → Word", desc: "PDF para DOCX", color: "bg-primary/10 text-primary" },
    { icon: Pencil, label: "Editar PDF", desc: "Abrir no editor", color: "bg-primary/10 text-primary" },
    { icon: ScanText, label: "OCR", desc: "Extrair texto", color: "bg-success/10 text-success" },
    { icon: Wand2, label: "Corrigir com IA", desc: "Ortografia e gramática", color: "bg-warning/10 text-warning" },
    { icon: Merge, label: "Mesclar PDF", desc: "Unir arquivos", color: "bg-primary/10 text-primary" },
    { icon: Split, label: "Dividir PDF", desc: "Separar páginas", color: "bg-destructive/10 text-destructive" },
    { icon: ImageDown, label: "PDF → JPG", desc: "Exportar imagens", color: "bg-success/10 text-success" },
    { icon: ImageIcon, label: "JPG → PDF", desc: "Imagem para PDF", color: "bg-primary/10 text-primary" },
    { icon: Minimize2, label: "Comprimir", desc: "Reduzir tamanho", color: "bg-warning/10 text-warning" },
  ];

  return (
    <div className="rounded-xl p-5 bg-transparent">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-semibold text-foreground">Ações Rápidas</h3>
        {healthy === false && (
          <button
            onClick={recheck}
            className="flex items-center gap-1.5 text-xs text-warning hover:text-warning/80 transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Serviço CloudConvert indisponível</span>
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {actions.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => handleAction(action.label)}
            disabled={processingAction === action.label}
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/40 backdrop-blur-md hover:bg-destructive/20 border border-border/40 hover:border-destructive/40 transition-[background-color,border-color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-[0_0_24px_-6px_hsl(var(--destructive)/0.35)] disabled:opacity-50"
          >
            <div className={`p-2.5 rounded-lg ${action.color}`}>
              {processingAction === action.label ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <action.icon className="w-5 h-5" />
              )}
            </div>
            <span className="text-sm font-medium text-foreground">{action.label}</span>
            <span className="text-xs text-muted-foreground">{action.desc}</span>
          </motion.button>
        ))}
      </div>
      <ConversionProgressDialog
        state={progress}
        onClose={() => setProgress(initialProgressState)}
      />

      {/* Hidden file inputs */}
      <input
        ref={pickerInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) handlePickedFile(f);
        }}
      />
      <input
        ref={jpgInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            setJpgFile(f);
            setJpgDialogOpen(true);
          }
          e.target.value = "";
        }}
      />
      <input
        ref={editPdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          if (!f.name.toLowerCase().endsWith(".pdf")) {
            toast.error("Selecione um arquivo PDF");
            return;
          }
          try {
            const bytes = await f.arrayBuffer();
            onNavigate?.("editor");
            // Defer event to next tick so the editor is mounted
            setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("open-pdf-editor", { detail: { bytes, name: f.name } }),
              );
            }, 60);
            toast.success("Abrindo no Editor de PDF...");
          } catch (err: any) {
            toast.error("Erro ao abrir PDF: " + (err?.message || "desconhecido"));
          }
        }}
      />

      <JpgToPdfDialog
        open={jpgDialogOpen}
        onOpenChange={(o) => {
          setJpgDialogOpen(o);
          if (!o) setJpgFile(null);
        }}
        file={jpgFile}
      />
    </div>
  );
}
