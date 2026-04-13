import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Wand2, CheckCircle2, FileText, RotateCcw, Upload, Image, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function AIPage() {
  const [text, setText] = useState("");
  const [corrected, setCorrected] = useState("");
  const [tone, setTone] = useState("profissional");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCorrect = async () => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setCorrected("");

    try {
      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { action: "correct", text, tone },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro na correção");

      setCorrected(data.correctedText);
      toast.success("Texto corrigido com sucesso!");
    } catch (err: any) {
      console.error("Correction error:", err);
      toast.error(err.message || "Erro ao corrigir texto");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOCR = async (file: File) => {
    setIsOcrProcessing(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { action: "ocr", imageBase64: base64, mimeType: file.type },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro no OCR");

      setText(data.extractedText);
      toast.success("Texto extraído com sucesso!");
    } catch (err: any) {
      console.error("OCR error:", err);
      toast.error(err.message || "Erro ao extrair texto");
    } finally {
      setIsOcrProcessing(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato não suportado. Use PNG, JPG, WebP, GIF ou PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    handleOCR(file);
    e.target.value = "";
  };

  const handleClear = () => {
    setText("");
    setCorrected("");
  };

  const handleCopy = () => {
    if (corrected) {
      navigator.clipboard.writeText(corrected);
      toast.success("Texto copiado!");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">IA & Correção</h2>
        <p className="text-muted-foreground mt-1">
          Cole seu texto ou use OCR para extrair de imagens, e deixe a IA corrigir e melhorar.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
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
          {isProcessing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
          {isProcessing ? "Corrigindo..." : "Corrigir com IA"}
        </Button>

        <Button variant="glass" onClick={() => fileInputRef.current?.click()} disabled={isOcrProcessing}>
          {isOcrProcessing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Image className="w-4 h-4 mr-1.5" />}
          {isOcrProcessing ? "Extraindo..." : "OCR (Imagem/PDF)"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />

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
            placeholder="Cole ou digite seu texto aqui, ou use o botão OCR para extrair de uma imagem..."
            className="min-h-[300px] bg-secondary border-border resize-none"
          />
          <p className="text-xs text-muted-foreground">{text.length} caracteres</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-foreground">Texto Corrigido</span>
            </div>
            {corrected && (
              <Button variant="ghost" size="sm" onClick={handleCopy} className="text-xs">
                Copiar
              </Button>
            )}
          </div>
          <div className="min-h-[300px] bg-secondary border border-border rounded-md p-3 text-sm text-foreground/80 overflow-y-auto">
            {isProcessing ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>A IA está corrigindo seu texto...</span>
              </div>
            ) : corrected ? (
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
