import { useState } from "react";
import { motion } from "framer-motion";
import { Wand2, CheckCircle2, FileText, Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AIPage() {
  const [text, setText] = useState("");
  const [corrected, setCorrected] = useState("");
  const [tone, setTone] = useState("profissional");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCorrect = () => {
    if (!text.trim()) return;
    setIsProcessing(true);
    // Simula processamento local - sem dados fake
    setTimeout(() => {
      setCorrected(text); // placeholder — será substituído pela IA real
      setIsProcessing(false);
    }, 1500);
  };

  const handleClear = () => {
    setText("");
    setCorrected("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">IA & Correção</h2>
        <p className="text-muted-foreground mt-1">
          Cole seu texto e deixe a IA corrigir, melhorar e reescrever.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Select value={tone} onValueChange={setTone}>
          <SelectTrigger className="w-48 bg-secondary border-border">
            <SelectValue placeholder="Tom do texto" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="profissional">Profissional</SelectItem>
            <SelectItem value="academico">Acadêmico</SelectItem>
            <SelectItem value="juridico">Jurídico</SelectItem>
            <SelectItem value="simples">Simples</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="glow" onClick={handleCorrect} disabled={!text.trim() || isProcessing}>
          <Wand2 className="w-4 h-4 mr-1.5" />
          {isProcessing ? "Processando..." : "Corrigir com IA"}
        </Button>
        <Button variant="glass" onClick={handleClear}>
          <RotateCcw className="w-4 h-4 mr-1.5" />
          Limpar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Texto Original</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cole ou digite seu texto aqui..."
            className="min-h-[300px] bg-secondary border-border resize-none"
          />
          <p className="text-xs text-muted-foreground">{text.length} caracteres</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" />
            <span className="text-sm font-medium text-foreground">Texto Corrigido</span>
          </div>
          <div className="min-h-[300px] bg-secondary border border-border rounded-md p-3 text-sm text-foreground/80">
            {corrected ? (
              <p className="whitespace-pre-wrap">{corrected}</p>
            ) : (
              <p className="text-muted-foreground/50 italic">O resultado da correção aparecerá aqui...</p>
            )}
          </div>
          {corrected && <p className="text-xs text-muted-foreground">{corrected.length} caracteres</p>}
        </motion.div>
      </div>
    </div>
  );
}
