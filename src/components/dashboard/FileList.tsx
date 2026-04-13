import { motion } from "framer-motion";
import { FileText, Image, FileSpreadsheet, MoreVertical, CheckCircle2, Loader2, AlertCircle, Upload as UploadIcon, Trash2, Download, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useFileConversions } from "@/hooks/useFileConversions";

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  jpg: Image,
  jpeg: Image,
  png: Image,
  pptx: FileText,
};

const statusConfig: Record<string, { icon: typeof CheckCircle2; label: string; className: string }> = {
  uploaded: { icon: UploadIcon, label: "Enviado", className: "text-primary" },
  completed: { icon: CheckCircle2, label: "Concluído", className: "text-success" },
  processing: { icon: Loader2, label: "Processando", className: "text-primary animate-spin" },
  error: { icon: AlertCircle, label: "Erro", className: "text-destructive" },
  pending: { icon: Loader2, label: "Na fila", className: "text-muted-foreground" },
};

export function FileList() {
  const { conversions, loading, downloadFile, deleteConversion } = useFileConversions();

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-foreground">Arquivos Recentes</h3>
        <span className="text-xs text-muted-foreground">{conversions.length} arquivos</span>
      </div>
      <div className="divide-y divide-border">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : conversions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <FileText className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum arquivo ainda</p>
            <p className="text-xs text-muted-foreground/60">Faça upload para começar</p>
          </div>
        ) : (
          conversions.slice(0, 10).map((file, i) => {
            const Icon = typeIcons[file.original_format] || FileText;
            const status = statusConfig[file.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.original_name}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(file.file_size)} · {formatDate(file.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <StatusIcon className={`w-4 h-4 ${status.className}`} />
                    <span className={`text-xs font-medium ${status.className}`}>{status.label}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-card border-border">
                      {file.original_path && (
                        <DropdownMenuItem onClick={() => downloadFile(file.original_path!, file.original_name)}>
                          <Download className="w-4 h-4 mr-2" /> Download Original
                        </DropdownMenuItem>
                      )}
                      {file.converted_path && (
                        <DropdownMenuItem onClick={() => downloadFile(file.converted_path!, `converted_${file.original_name}`)}>
                          <Download className="w-4 h-4 mr-2" /> Download Convertido
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => deleteConversion(file.id, file.original_path, file.converted_path)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
