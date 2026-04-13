import { useState } from "react";
import { motion } from "framer-motion";
import { FileOutput, ScanText, Wand2, Merge, Split, ImageDown, Minimize2, Loader2 } from "lucide-react";
import { useFileConversions } from "@/hooks/useFileConversions";
import { toast } from "sonner";

interface QuickActionsProps {
  onNavigate?: (tab: string) => void;
}

export function QuickActions({ onNavigate }: QuickActionsProps) {
  const { conversions, convertFile, compressFile } = useFileConversions();
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  const pdfFiles = conversions.filter((c) => c.original_format === "pdf" && c.original_path);
  const docFiles = conversions.filter((c) => ["docx", "xlsx", "pptx"].includes(c.original_format) && c.original_path);

  const handleAction = async (label: string) => {
    if (label === "Corrigir com IA") {
      onNavigate?.("ai");
      return;
    }

    if (label === "Word → PDF") {
      if (docFiles.length === 0) {
        toast.info("Envie um arquivo DOCX, XLSX ou PPTX primeiro.");
        return;
      }
      setProcessingAction(label);
      const file = docFiles[0];
      await convertFile(file.id, file.original_path!, "pdf");
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

    if (label === "Dividir PDF" || label === "OCR") {
      toast.info("Funcionalidade em breve!");
      return;
    }
  };

  const actions = [
    { icon: FileOutput, label: "Word → PDF", desc: "Converter documentos", color: "bg-primary/10 text-primary" },
    { icon: ScanText, label: "OCR", desc: "Extrair texto", color: "bg-success/10 text-success" },
    { icon: Wand2, label: "Corrigir com IA", desc: "Ortografia e gramática", color: "bg-warning/10 text-warning" },
    { icon: Merge, label: "Mesclar PDF", desc: "Unir arquivos", color: "bg-primary/10 text-primary" },
    { icon: Split, label: "Dividir PDF", desc: "Separar páginas", color: "bg-destructive/10 text-destructive" },
    { icon: ImageDown, label: "PDF → JPG", desc: "Exportar imagens", color: "bg-success/10 text-success" },
    { icon: Minimize2, label: "Comprimir", desc: "Reduzir tamanho", color: "bg-warning/10 text-warning" },
  ];

  return (
    <div className="glass rounded-xl p-5">
      <h3 className="font-display font-semibold text-foreground mb-4">Ações Rápidas</h3>
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
    </div>
  );
}
