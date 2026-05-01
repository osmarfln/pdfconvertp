import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Image, FileSpreadsheet, Search, Download, Trash2, MoreVertical, ArrowRightLeft, Loader2, Eye, X, Archive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
import { supabase } from "@/integrations/supabase/client";

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

const previewableFormats = ["pdf", "jpg", "jpeg", "png"];

export function FilesPage() {
  const { conversions, loading, downloadFile, deleteConversion, convertFile } = useFileConversions();
  const [search, setSearch] = useState("");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");
  const [previewFormat, setPreviewFormat] = useState("");

  const matchesSearch = (f: typeof conversions[number]) =>
    f.original_name.toLowerCase().includes(search.toLowerCase());

  const activeFiles = useMemo(
    () => conversions.filter((f) => !f.is_backup).filter(matchesSearch),
    [conversions, search],
  );
  const backupFiles = useMemo(
    () => conversions.filter((f) => f.is_backup).filter(matchesSearch),
    [conversions, search],
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

  const handlePreview = async (filePath: string, name: string, format: string) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(filePath, 3600);

    if (error || !data?.signedUrl) return;

    // Open PDFs in a new tab to avoid Chrome iframe blocking
    if (format === "pdf") {
      window.open(data.signedUrl, "_blank");
      return;
    }

    setPreviewUrl(data.signedUrl);
    setPreviewName(name);
    setPreviewFormat(format);
  };

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewName("");
    setPreviewFormat("");
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

      {/* Preview Modal */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
            onClick={closePreview}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-4xl h-[80vh] glass rounded-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/50">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{previewName}</span>
                </div>
                <button onClick={closePreview} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {previewFormat === "pdf" ? (
                  <iframe
                    src={`${previewUrl}#toolbar=1&navpanes=0`}
                    className="w-full h-full border-0"
                    title={previewName}
                  />
                ) : ["jpg", "jpeg", "png"].includes(previewFormat) ? (
                  <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                    <img
                      src={previewUrl}
                      alt={previewName}
                      className="max-w-full max-h-full object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-muted-foreground">Preview não disponível para este formato.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
            const isConverted = file.status === "completed" && !!file.converted_path;
            const displayFormat = isConverted ? file.target_format : file.original_format;
            const canPreview = previewableFormats.includes(displayFormat);
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
                    {formatSize(file.file_size)} · {isConverted ? (
                      <span className="text-success font-medium">{file.target_format.toUpperCase()} ✓</span>
                    ) : (
                      file.original_format.toUpperCase()
                    )}
                  </p>
                </div>

                {/* Preview button */}
                {canPreview && file.original_path && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      const path = isConverted ? file.converted_path! : file.original_path!;
                      handlePreview(path, file.original_name, displayFormat);
                    }}
                  >
                    <Eye className="w-4 h-4 text-primary" />
                  </Button>
                )}

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
