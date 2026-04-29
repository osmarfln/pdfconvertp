import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { FileOutput, FileText, ScanText, Wand2, Merge, Split, ImageDown, Minimize2, Loader2, AlertTriangle } from "lucide-react";
import { useFileConversions } from "@/hooks/useFileConversions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useILovePDFHealth } from "@/hooks/useILovePDFHealth";
import { ConversionProgressDialog, ConversionProgressState, initialProgressState, ConversionStage } from "@/components/ConversionProgressDialog";

interface QuickActionsProps {
  onNavigate?: (tab: string) => void;
}

export function QuickActions({ onNavigate }: QuickActionsProps) {
  const { conversions, convertFile, compressFile } = useFileConversions();
  const [processingAction, setProcessingAction] = useState<string | null>(null);
  const { healthy, reason, checking, recheck } = useILovePDFHealth();
  const [progress, setProgress] = useState<ConversionProgressState>(initialProgressState);
  const progressTimer = useRef<number | null>(null);

  const stopProgressTimer = () => {
    if (progressTimer.current) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  const setStage = (stage: ConversionStage, message?: string, jumpTo?: number) => {
    setProgress((p) => ({
      ...p,
      stage,
      message,
      progress: jumpTo !== undefined ? jumpTo : p.progress,
    }));
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
    fn: () => Promise<void>
  ) => {
    setProgress({ open: true, title, fileName, stage: "preparing", progress: 0, message: "Preparando arquivo..." });
    await new Promise((r) => setTimeout(r, 400));

    setStage("uploading", "Enviando para o servidor...", 15);
    startSimulatedProgress(15, 35, 1200);
    await new Promise((r) => setTimeout(r, 1200));

    setStage("processing", "Convertendo documento...", 35);
    startSimulatedProgress(35, 85, 12000);

    try {
      await fn();
      stopProgressTimer();
      setStage("downloading", "Finalizando e salvando...", 85);
      startSimulatedProgress(85, 100, 800);
      await new Promise((r) => setTimeout(r, 900));
      stopProgressTimer();
      setProgress((p) => ({ ...p, stage: "completed", progress: 100, message: "Concluído!" }));
    } catch (err: any) {
      stopProgressTimer();
      setProgress((p) => ({ ...p, stage: "error", error: err?.message || "Erro desconhecido" }));
    }
  };

  const pdfFiles = conversions.filter((c) => c.original_format === "pdf" && c.original_path);
  const docFiles = conversions.filter((c) => ["docx", "xlsx", "pptx"].includes(c.original_format) && c.original_path);

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

    // All other actions need iLovePDF
    if (healthy === false) {
      toast.error(reason || "Serviço de conversão indisponível no momento. Tente novamente mais tarde.");
      return;
    }

    if (label === "Word → PDF") {
      if (docFiles.length === 0) {
        toast.info("Envie um arquivo DOCX, XLSX ou PPTX primeiro.");
        return;
      }
      setProcessingAction(label);
      const file = docFiles[0];
      await runConversionWithProgress("Word → PDF", file.original_name, () =>
        convertFile(file.id, file.original_path!, "pdf")
      );
      setProcessingAction(null);
      return;
    }

    if (label === "PDF → Word") {
      if (pdfFiles.length === 0) {
        toast.info("Envie um PDF primeiro.");
        return;
      }
      setProcessingAction(label);
      const file = pdfFiles[0];
      await runConversionWithProgress("PDF → Word", file.original_name, () =>
        convertFile(file.id, file.original_path!, "docx")
      );
      setProcessingAction(null);
      return;
    }

    if (label === "PDF → JPG") {
      if (pdfFiles.length === 0) {
        toast.info("Envie um PDF primeiro.");
        return;
      }
      setProcessingAction(label);
      const file = pdfFiles[0];
      await convertFile(file.id, file.original_path!, "jpg");
      setProcessingAction(null);
      return;
    }

    if (label === "Comprimir") {
      if (pdfFiles.length === 0) {
        toast.info("Envie um PDF primeiro.");
        return;
      }
      setProcessingAction(label);
      await compressFile(pdfFiles[0].original_path!);
      setProcessingAction(null);
      return;
    }

    if (label === "Mesclar PDF") {
      onNavigate?.("files");
      toast.info("Selecione os PDFs na página de arquivos para mesclar.");
      return;
    }

    if (label === "Dividir PDF") {
      if (pdfFiles.length === 0) {
        toast.info("Envie um PDF primeiro.");
        return;
      }
      setProcessingAction(label);
      const file = pdfFiles[0];
      try {
        const { data, error } = await supabase.functions.invoke("convert-file", {
          body: { action: "split", filePath: file.original_path },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Split failed");
        toast.success("PDF dividido com sucesso!");
      } catch (err: any) {
        toast.error("Erro ao dividir: " + err.message);
      }
      setProcessingAction(null);
      return;
    }

  };

  const actions = [
    { icon: FileOutput, label: "Word → PDF", desc: "Converter documentos", color: "bg-primary/10 text-primary" },
    { icon: FileText, label: "PDF → Word", desc: "PDF para DOCX", color: "bg-primary/10 text-primary" },
    { icon: ScanText, label: "OCR", desc: "Extrair texto", color: "bg-success/10 text-success" },
    { icon: Wand2, label: "Corrigir com IA", desc: "Ortografia e gramática", color: "bg-warning/10 text-warning" },
    { icon: Merge, label: "Mesclar PDF", desc: "Unir arquivos", color: "bg-primary/10 text-primary" },
    { icon: Split, label: "Dividir PDF", desc: "Separar páginas", color: "bg-destructive/10 text-destructive" },
    { icon: ImageDown, label: "PDF → JPG", desc: "Exportar imagens", color: "bg-success/10 text-success" },
    { icon: Minimize2, label: "Comprimir", desc: "Reduzir tamanho", color: "bg-warning/10 text-warning" },
  ];

  return (
    <div className="glass rounded-xl p-5">
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
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-secondary/50 hover:bg-secondary border border-border/50 hover:border-border transition-all disabled:opacity-50"
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
    </div>
  );
}
