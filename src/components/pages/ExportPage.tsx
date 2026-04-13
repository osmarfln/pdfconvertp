import { useState } from "react";
import { motion } from "framer-motion";
import { Download, FileText, FileOutput, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ExportPage() {
  const [format, setFormat] = useState("pdf");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Exportar</h2>
        <p className="text-muted-foreground mt-1">
          Exporte seus documentos processados nos formatos desejados.
        </p>
      </div>

      <div className="glass rounded-xl p-6 space-y-4">
        <h3 className="font-display font-semibold text-foreground">Formato de Exportação</h3>
        <div className="flex items-center gap-3">
          <Select value={format} onValueChange={setFormat}>
            <SelectTrigger className="w-48 bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="docx">DOCX</SelectItem>
              <SelectItem value="txt">TXT</SelectItem>
              <SelectItem value="jpg">JPG</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="glow" disabled>
            <Download className="w-4 h-4 mr-1.5" />
            Exportar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Selecione um arquivo processado para exportar.</p>
      </div>

      <div className="glass rounded-xl p-6 flex flex-col items-center justify-center py-12 gap-3">
        <FileOutput className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">Nenhum arquivo para exportar</p>
        <p className="text-xs text-muted-foreground/60">Processe documentos primeiro para exportar.</p>
      </div>
    </div>
  );
}
