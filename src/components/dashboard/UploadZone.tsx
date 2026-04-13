import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileUp, X, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileConversions } from "@/hooks/useFileConversions";

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState<{ name: string; size: string }[]>([]);
  const { uploadFile } = useFileConversions();

  const processFiles = useCallback(async (files: File[]) => {
    for (const file of files) {
      setUploading((prev) => [...prev, file.name]);
      try {
        const result = await uploadFile(file);
        setUploading((prev) => prev.filter((n) => n !== file.name));
        if (result) {
          setUploaded((prev) => [...prev, { name: file.name, size: `${(file.size / 1024 / 1024).toFixed(1)} MB` }]);
        }
      } catch (err) {
        console.error("Upload failed for", file.name, err);
        setUploading((prev) => prev.filter((n) => n !== file.name));
      }
    }
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(Array.from(e.dataTransfer.files));
  }, [processFiles]);

  const handleFileSelect = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png";
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      processFiles(files);
    };
    input.click();
  }, [processFiles]);

  return (
    <div className="space-y-4">
      <motion.div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleFileSelect}
        className={`relative rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragging
            ? "border-primary bg-primary/5 glow"
            : "border-border hover:border-primary/50 hover:bg-secondary/30"
        }`}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.995 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
            isDragging ? "bg-primary/20" : "bg-secondary"
          }`}>
            <FileUp className={`w-7 h-7 transition-colors ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isDragging ? "Solte os arquivos aqui" : "Arraste e solte seus arquivos"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOCX, XLSX, PPT, JPG, PNG · Máx 50MB
            </p>
          </div>
          <Button variant="glass" size="sm" className="mt-2">
            <Upload className="w-4 h-4 mr-1.5" />
            Selecionar Arquivos
          </Button>
        </div>
      </motion.div>

      <AnimatePresence>
        {uploading.map((name) => (
          <motion.div
            key={`uploading-${name}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/50 border border-border"
          >
            <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            <p className="text-sm font-medium text-foreground truncate flex-1">{name}</p>
            <span className="text-xs text-muted-foreground">Enviando...</span>
          </motion.div>
        ))}
        {uploaded.map((file, index) => (
          <motion.div
            key={`done-${file.name}-${index}`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-secondary/50 border border-border"
          >
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{file.size}</p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUploaded((prev) => prev.filter((_, i) => i !== index));
              }}
              className="p-1 rounded hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
