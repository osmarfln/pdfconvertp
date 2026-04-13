import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Image, FileSpreadsheet, Search, Download, Eye, Trash2, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserFile {
  id: string;
  name: string;
  type: string;
  size: string;
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

export function FilesPage() {
  const [files, setFiles] = useState<UserFile[]>([]);
  const [search, setSearch] = useState("");

  const filtered = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Meus Arquivos</h2>
        <p className="text-muted-foreground mt-1">Todos os seus documentos em um só lugar.</p>
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

      {filtered.length === 0 ? (
        <div className="glass rounded-xl flex flex-col items-center justify-center py-16 gap-3">
          <FileText className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">Nenhum arquivo encontrado</p>
          <p className="text-xs text-muted-foreground/60">Faça upload de documentos para visualizá-los aqui.</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden divide-y divide-border">
          {filtered.map((file, i) => {
            const Icon = typeIcons[file.type] || FileText;
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
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.size} · {file.date}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-card border-border">
                    <DropdownMenuItem><Eye className="w-4 h-4 mr-2" /> Visualizar</DropdownMenuItem>
                    <DropdownMenuItem><Download className="w-4 h-4 mr-2" /> Download</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => removeFile(file.id)} className="text-destructive">
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
