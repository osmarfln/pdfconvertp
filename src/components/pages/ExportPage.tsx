import { useState } from "react";
import { Download, FileOutput, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFileConversions } from "@/hooks/useFileConversions";

export function ExportPage() {
  const { conversions, downloadFile } = useFileConversions();
  const [selectedFile, setSelectedFile] = useState("");

  const downloadableFiles = conversions.filter(
    (c) => c.converted_path || c.original_path
  );

  const handleExport = () => {
    const file = conversions.find((c) => c.id === selectedFile);
    if (!file) return;
    const path = file.converted_path || file.original_path;
    if (path) {
      const name = file.converted_path
        ? `${file.original_name.replace(/\.[^.]+$/, "")}.${file.target_format}`
        : file.original_name;
      downloadFile(path, name);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Exportar</h2>
        <p className="text-muted-foreground mt-1">
          Baixe seus documentos processados.
        </p>
      </div>

      <div className="glass rounded-xl p-6 space-y-4">
        <h3 className="font-display font-semibold text-foreground">Selecione o Arquivo</h3>
        <div className="flex items-center gap-3">
          <Select value={selectedFile} onValueChange={setSelectedFile}>
            <SelectTrigger className="w-72 bg-secondary border-border">
              <SelectValue placeholder="Escolha um arquivo" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {downloadableFiles.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.original_name} {f.converted_path ? `→ ${f.target_format.toUpperCase()}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="glow" disabled={!selectedFile} onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />
            Exportar
          </Button>
        </div>
      </div>

      {downloadableFiles.length === 0 && (
        <div className="glass rounded-xl p-6 flex flex-col items-center justify-center py-12 gap-3">
          <FileOutput className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">Nenhum arquivo para exportar</p>
          <p className="text-xs text-muted-foreground/60">Faça upload e processe documentos primeiro.</p>
        </div>
      )}
    </div>
  );
}
