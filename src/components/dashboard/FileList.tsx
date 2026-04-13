import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Image, FileSpreadsheet, MoreVertical, Clock, CheckCircle2, Loader2, AlertCircle, Trash2, Download, Eye } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type FileStatus = "completed" | "processing" | "error" | "queued";

interface FileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  status: FileStatus;
  date: string;
}

const typeIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  docx: FileText,
  xlsx: FileSpreadsheet,
  jpg: Image,
  png: Image,
  pptx: FileText,
};

const statusConfig: Record<FileStatus, { icon: typeof CheckCircle2; label: string; className: string }> = {
  completed: { icon: CheckCircle2, label: "Concluído", className: "text-success" },
  processing: { icon: Loader2, label: "Processando", className: "text-primary animate-spin" },
  error: { icon: AlertCircle, label: "Erro", className: "text-destructive" },
  queued: { icon: Clock, label: "Na fila", className: "text-muted-foreground" },
};

export function FileList() {
  const [files, setFiles] = useState<FileItem[]>([]);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-display font-semibold text-foreground">Arquivos Recentes</h3>
        <span className="text-xs text-muted-foreground">{files.length} arquivos</span>
      </div>
      <div className="divide-y divide-border">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <FileText className="w-10 h-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum arquivo ainda</p>
            <p className="text-xs text-muted-foreground/60">Faça upload para começar</p>
          </div>
        ) : (
          files.map((file, i) => {
            const Icon = typeIcons[file.type] || FileText;
            const status = statusConfig[file.status];
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
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.size} · {file.date}</p>
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
                      <DropdownMenuItem>
                        <Eye className="w-4 h-4 mr-2" /> Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => removeFile(file.id)} className="text-destructive">
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
