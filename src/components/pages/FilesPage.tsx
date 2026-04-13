import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Image, FileSpreadsheet, Search, Download, Trash2, MoreVertical, ArrowRightLeft, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const conversionTargets: Record<string, string[]> = {
  pdf: ["docx", "xlsx", "jpg"],
  docx: ["pdf"],
  xlsx: ["pdf"],
  pptx: ["pdf"],
  jpg: ["pdf"],
  jpeg: ["pdf"],
  png: ["pdf"],
};

export function FilesPage() {
  const { conversions, loading, downloadFile, deleteConversion, convertFile } = useFileConversions();
  const [search, setSearch] = useState("");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});

  const filtered = conversions.filter((f) =>
    f.original_name.toLowerCase().includes(search.toLowerCase())
  );

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleConvert = async (id: string, filePath: string, targetFormat: string) => {
    setConvertingId(id);
    await convertFile(id, filePath, targetFormat);
    setConvertingId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Meus Arquivos</h2>
        <p className="text-muted-foreground mt-1">Todos os seus documentos. Converta para outros formatos.</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar arquivos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-border"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <FileText className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">Nenhum arquivo encontrado</p>
          <p className="text-xs text-muted-foreground/60">Faça upload de documentos para visualizá-los aqui.</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden divide-y divide-border">
          {filtered.map((file, i) => {
            const Icon = typeIcons[file.original_format] || FileText;
            const targets = conversionTargets[file.original_format] || [];
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.original_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(file.file_size)} · {file.original_format.toUpperCase()}
                    {file.status === "completed" && file.converted_path && (
                      <span className="text-success ml-2">→ {file.target_format.toUpperCase()}</span>
                    )}
                  </p>
                </div>
                {targets.length > 0 && file.original_path && (
                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedTargets[file.id] || ""}
                      onValueChange={(v) => setSelectedTargets((prev) => ({ ...prev, [file.id]: v }))}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs bg-secondary border-border">
                        <SelectValue placeholder="Formato" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        {targets.map((t) => (
                          <SelectItem key={t} value={t}>{t.toUpperCase()}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="glass"
                      size="sm"
                      disabled={!selectedTargets[file.id] || convertingId === file.id}
                      onClick={() => handleConvert(file.id, file.original_path!, selectedTargets[file.id])}
                    >
                      {convertingId === file.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowRightLeft className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    {file.original_path && (
                      <DropdownMenuItem onClick={() => downloadFile(file.original_path!, file.original_name)}>
                        <Download className="w-4 h-4 mr-2" /> Download Original
                      </DropdownMenuItem>
                    )}
                    {file.converted_path && (
                      <DropdownMenuItem onClick={() => downloadFile(file.converted_path!, `${file.original_name.replace(/\.[^.]+$/, "")}.${file.target_format}`)}>
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
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
