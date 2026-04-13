import { motion } from "framer-motion";
import { FileText, Image, FileSpreadsheet, MoreVertical, Clock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

type FileStatus = "completed" | "processing" | "error" | "queued";

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  status: FileStatus;
  date: string;
}

const files: FileItem[] = [
  { id: "1", name: "Relatório Anual 2024.pdf", type: "pdf", size: "4.2 MB", status: "completed", date: "Há 2 horas" },
  { id: "2", name: "Contrato Empresa X.docx", type: "docx", size: "1.8 MB", status: "processing", date: "Há 15 min" },
  { id: "3", name: "Planilha Vendas.xlsx", type: "xlsx", size: "2.1 MB", status: "completed", date: "Há 1 dia" },
  { id: "4", name: "Documento Escaneado.jpg", type: "jpg", size: "5.6 MB", status: "queued", date: "Há 5 min" },
  { id: "5", name: "Apresentação Q4.pptx", type: "pptx", size: "12.3 MB", status: "error", date: "Há 3 horas" },
];

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  jpg: Image,
  pptx: FileText,
};

const statusConfig: Record<FileStatus, { icon: typeof CheckCircle2; label: string; className: string }> = {
  completed: { icon: CheckCircle2, label: "Concluído", className: "text-success" },
  processing: { icon: Loader2, label: "Processando", className: "text-primary animate-spin" },
  error: { icon: AlertCircle, label: "Erro", className: "text-destructive" },
  queued: { icon: Clock, label: "Na fila", className: "text-muted-foreground" },
};

export function FileList() {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-foreground">Arquivos Recentes</h3>
        <span className="text-xs text-muted-foreground">{files.length} arquivos</span>
      </div>
      <div className="divide-y divide-border">
        {files.map((file, i) => {
          const Icon = typeIcons[file.type] || FileText;
          const status = statusConfig[file.status];
          const StatusIcon = status.icon;
          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/50 transition-colors cursor-pointer"
            >
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{file.size} · {file.date}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <StatusIcon className={`w-4 h-4 ${status.className}`} />
                  <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
                </div>
                <button className="p-1 rounded hover:bg-secondary transition-colors">
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
