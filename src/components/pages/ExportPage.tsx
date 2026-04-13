import { useState } from "react";
import { Download, FileOutput, Loader2, FileText, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFileConversions } from "@/hooks/useFileConversions";
import { toast } from "sonner";

export function ExportPage() {
  const { conversions, downloadFile } = useFileConversions();
  const [selectedFile, setSelectedFile] = useState("");
  const [exportFormat, setExportFormat] = useState("original");

  const downloadableFiles = conversions.filter(
    (c) => c.converted_path || c.original_path
  );

  const handleExport = () => {
    const file = conversions.find((c) => c.id === selectedFile);
    if (!file) return;

    if (exportFormat === "original") {
      const path = file.original_path;
      if (path) downloadFile(path, file.original_name);
    } else if (exportFormat === "converted") {
      const path = file.converted_path;
      if (path) {
        const name = `${file.original_name.replace(/\.[^.]+$/, "")}.${file.target_format}`;
        downloadFile(path, name);
      } else {
        toast.error("Arquivo convertido não disponível. Converta primeiro.");
      }
    } else if (exportFormat === "txt") {
      // Export info as TXT
      const content = `Arquivo: ${file.original_name}\nFormato: ${file.original_format.toUpperCase()}\nStatus: ${file.status}\nTamanho: ${file.file_size ? `${(file.file_size / 1024).toFixed(1)} KB` : 'N/A'}\nData: ${new Date(file.created_at).toLocaleString("pt-BR")}\n${file.converted_path ? `Convertido para: ${file.target_format.toUpperCase()}` : ""}`;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${file.original_name.replace(/\.[^.]+$/, "")}_info.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Relatório TXT exportado!");
    }
  };

  const handleExportAll = () => {
    if (downloadableFiles.length === 0) return;
    const lines = downloadableFiles.map((f) =>
      `${f.original_name} | ${f.original_format.toUpperCase()} → ${f.target_format.toUpperCase()} | ${f.status} | ${new Date(f.created_at).toLocaleString("pt-BR")}`
    );
    const content = `=== RELATÓRIO DE ARQUIVOS ===\nTotal: ${downloadableFiles.length}\n\n${lines.join("\n")}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_completo_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório completo exportado!");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Exportar</h2>
        <p className="text-muted-foreground mt-1">
          Baixe seus documentos processados ou gere relatórios.
        </p>
      </div>

      <div className="glass rounded-xl p-6 space-y-4">
        <h3 className="font-display font-semibold text-foreground">Exportar Arquivo Individual</h3>
        <div className="flex flex-wrap items-center gap-3">
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

          <Select value={exportFormat} onValueChange={setExportFormat}>
            <SelectTrigger className="w-40 bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="original">Original</SelectItem>
              <SelectItem value="converted">Convertido</SelectItem>
              <SelectItem value="txt">Relatório TXT</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="glow" disabled={!selectedFile} onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />
            Exportar
          </Button>
        </div>
      </div>

      {downloadableFiles.length > 0 && (
        <div className="glass rounded-xl p-6 space-y-4">
          <h3 className="font-display font-semibold text-foreground">Relatório Completo</h3>
          <p className="text-sm text-muted-foreground">
            Gere um relatório com todos os {downloadableFiles.length} arquivos processados.
          </p>
          <Button variant="glass" onClick={handleExportAll}>
            <FileText className="w-4 h-4 mr-1.5" />
            Exportar Relatório Completo
          </Button>
        </div>
      )}

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
