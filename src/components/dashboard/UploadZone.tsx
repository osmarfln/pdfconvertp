import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileUp, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; size: string }[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    const mapped = files.map((f) => ({
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
    }));
    setUploadedFiles((prev) => [...prev, ...mapped]);
  }, []);

  const handleFileSelect = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png";
    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      const mapped = files.map((f) => ({
        name: f.name,
        size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      }));
      setUploadedFiles((prev) => [...prev, ...mapped]);
    };
    input.click();
  }, []);

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

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
        {uploadedFiles.map((file, index) => (
          <motion.div
            key={`${file.name}-${index}`}
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
                removeFile(index);
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
