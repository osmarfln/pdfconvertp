import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, CheckCircle2, FileText, RotateCcw, Image, Loader2, History, Trash2, Clock, Filter, Search, ChevronLeft, ChevronRight, PartyPopper, GraduationCap, AlertTriangle, Save } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ExamGrader } from "@/components/exam/ExamGrader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { saveCorrectedTextAsBackup } from "@/lib/textToPdf";

interface DetectedError {
  snippet: string;
  type: string;
  suggestion: string;
}

interface CorrectionRecord {
  id: string;
  original_text: string;
  corrected_text: string;
  tone: string;
  source_type: string;
  file_format: string | null;
  created_at: string;
}

export function AIPage() {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [text, setText] = useState("");
  const [corrected, setCorrected] = useState("");
  const [tone, setTone] = useState("profissional");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressComplete, setProgressComplete] = useState(false);

  // History state
  const [history, setHistory] = useState<CorrectionRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState("all");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Error detection state
  const [detectedErrors, setDetectedErrors] = useState<DetectedError[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [savingBackup, setSavingBackup] = useState(false);
  const detectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runDetection = async (raw: string) => {
    if (!raw || raw.trim().length < 20) {
      setDetectedErrors([]);
      return;
    }
    setIsDetecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { action: "detect", text: raw },
      });
      if (error) throw error;
      if (data?.success) {
        setDetectedErrors(data.errors || []);
      }
    } catch (err) {
      console.error("Detect error:", err);
    } finally {
      setIsDetecting(false);
    }
  };

  // Debounced auto-detection when text changes
  useEffect(() => {
    if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    if (!text.trim()) {
      setDetectedErrors([]);
      return;
    }
    detectTimerRef.current = setTimeout(() => {
      runDetection(text);
    }, 1200);
    return () => {
      if (detectTimerRef.current) clearTimeout(detectTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const fetchHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("correction_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setHistory((data as CorrectionRecord[]) || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user]);

  // Check for pending extraction jobs on mount
  useEffect(() => {
    if (!user) return;
    const checkPendingJobs = async () => {
      const { data } = await supabase
        .from("extraction_jobs")
        .select("*")
        .eq("user_id", user.id)
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        const job = data[0] as any;
        setActiveJobId(job.id);
        setIsOcrProcessing(true);
        setOcrProgress(`Retomando extração de ${job.file_name || "arquivo"}...`);
        startPolling(job.id);
      }
    };
    checkPendingJobs();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [user]);

  const startPolling = (jobId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("extraction_jobs")
        .select("*")
        .eq("id", jobId)
        .single();
      if (!data) return;
      const job = data as any;

      if (job.status === "completed") {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        setText(job.extracted_text || "");
        setIsOcrProcessing(false);
        setActiveJobId(null);
        setOcrProgress("");
        finishProgress();
        addNotification({ title: "Extração concluída", message: `Texto extraído de ${job.file_name || "arquivo"}`, type: "extraction" });
        toast.success("Texto extraído com sucesso!");
      } else if (job.status === "failed") {
        clearInterval(pollIntervalRef.current!);
        pollIntervalRef.current = null;
        setIsOcrProcessing(false);
        setActiveJobId(null);
        setOcrProgress("");
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        setProgressPercent(0);
        toast.error(job.error_message || "Erro ao extrair texto");
      } else {
        setOcrProgress(`Extraindo texto de ${job.file_name || "arquivo"}...`);
      }
    }, 2000);
  };

  const saveToHistory = async (original: string, correctedText: string, sourceType: string, fileFormat?: string) => {
    if (!user) return;
    try {
      await supabase.from("correction_history").insert({
        user_id: user.id,
        original_text: original,
        corrected_text: correctedText,
        tone,
        source_type: sourceType,
        file_format: fileFormat || null,
      });
      fetchHistory();
    } catch (err) {
      console.error("Error saving history:", err);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      const { error } = await supabase.from("correction_history").delete().eq("id", id);
      if (error) throw error;
      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success("Registro excluído!");
    } catch (err) {
      console.error("Error deleting:", err);
      toast.error("Erro ao excluir registro");
    }
  };

  const loadFromHistory = (record: CorrectionRecord) => {
    setText(record.original_text);
    setCorrected(record.corrected_text);
    setTone(record.tone);
    setShowHistory(false);
    toast.success("Correção carregada do histórico!");
  };

  const startProgressSimulation = (maxPercent = 90) => {
    setProgressPercent(0);
    setProgressComplete(false);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    let current = 0;
    progressIntervalRef.current = setInterval(() => {
      current += Math.random() * 8 + 2;
      if (current >= maxPercent) {
        current = maxPercent;
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }
      setProgressPercent(Math.round(current));
    }, 300);
  };

  const finishProgress = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgressPercent(100);
    setProgressComplete(true);
    setTimeout(() => {
      setProgressPercent(0);
      setProgressComplete(false);
    }, 3000);
  };

  const handleCorrect = async () => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setCorrected("");
    startProgressSimulation(90);

    try {
      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { action: "correct", text, tone },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro na correção");

      setCorrected(data.correctedText);
      setDetectedErrors([]);
      await saveToHistory(text, data.correctedText, "typed");
      addNotification({ title: "Correção concluída", message: "Texto corrigido com IA", type: "correction" });
      finishProgress();
      toast.success("Texto corrigido com sucesso!");
    } catch (err: any) {
      console.error("Correction error:", err);
      toast.error(err.message || "Erro ao corrigir texto");
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgressPercent(0);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOCR = async (file: File) => {
    if (!user) return;
    setIsOcrProcessing(true);
    setOcrProgress(`Preparando extração de ${file.name}...`);
    startProgressSimulation(85);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Create job in database
      const { data: jobData, error: jobError } = await supabase
        .from("extraction_jobs")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_type: file.type,
          status: "pending",
        })
        .select()
        .single();

      if (jobError) throw jobError;
      const jobId = (jobData as any).id;
      setActiveJobId(jobId);

      // Invoke background processing
      const { error } = await supabase.functions.invoke("ai-correct", {
        body: { action: "ocr-background", imageBase64: base64, mimeType: file.type, jobId },
      });

      if (error) throw error;

      setOcrProgress(`Extraindo texto de ${file.name}...`);
      toast.info("Extração iniciada em segundo plano. Você pode navegar para outras páginas.");
      startPolling(jobId);
    } catch (err: any) {
      console.error("OCR error:", err);
      toast.error(err.message || "Erro ao extrair texto");
      setIsOcrProcessing(false);
      setActiveJobId(null);
      setOcrProgress("");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
    if (!validTypes.includes(file.type)) {
      toast.error("Formato não suportado.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }
    handleOCR(file);
    e.target.value = "";
  };

  const handleClear = () => { setText(""); setCorrected(""); setDetectedErrors([]); };

  const handleSaveBackup = async () => {
    if (!user || !corrected.trim()) return;
    setSavingBackup(true);
    try {
      const title = `Texto corrigido — ${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
      const id = await saveCorrectedTextAsBackup({ userId: user.id, title, text: corrected });
      if (id) {
        toast.success("Salvo em Meus Arquivos → Backup como PDF!");
        addNotification({ title: "Backup criado", message: "Texto corrigido salvo como PDF em Meus Arquivos", type: "correction" });
      } else {
        toast.error("Não foi possível salvar o backup.");
      }
    } catch (err: any) {
      console.error("Save backup error:", err);
      toast.error(err.message || "Erro ao salvar backup");
    } finally {
      setSavingBackup(false);
    }
  };

  const handleCopy = () => {
    if (corrected) {
      navigator.clipboard.writeText(corrected);
      toast.success("Texto copiado!");
    }
  };

  const filteredHistory = history
    .filter((h) => {
      if (historyFilter === "typed") return h.source_type === "typed";
      if (historyFilter === "ocr") return h.source_type === "ocr";
      if (historyFilter === "doc") return h.file_format && ["doc", "docx"].includes(h.file_format);
      if (historyFilter === "pdf") return h.file_format === "pdf";
      if (historyFilter === "excel") return h.file_format && ["xls", "xlsx"].includes(h.file_format);
      return historyFilter === "all";
    })
    .filter((h) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return h.original_text.toLowerCase().includes(q) || h.corrected_text.toLowerCase().includes(q);
    });

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const paginatedHistory = filteredHistory.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [historyFilter, searchQuery]);

  const toneLabels: Record<string, string> = {
    profissional: "Profissional",
    academico: "Acadêmico",
    juridico: "Jurídico",
    simples: "Simples",
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-foreground">IA & Correção</h2>
          <p className="text-muted-foreground mt-1">
            Cole seu texto ou use OCR para extrair de imagens, e deixe a IA corrigir e melhorar.
          </p>
        </div>
        <Button variant={showHistory ? "glow" : "glass"} onClick={() => setShowHistory(!showHistory)}>
          <History className="w-4 h-4 mr-1.5" />
          Histórico ({history.length})
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {showHistory ? (
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {/* Filter bar */}
            <div className="flex items-center gap-3 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Filtrar:</span>
              {[
                { value: "all", label: "Todos" },
                { value: "typed", label: "Digitado" },
                { value: "ocr", label: "OCR" },
                { value: "pdf", label: "PDF" },
                { value: "doc", label: "DOC/DOCX" },
                { value: "excel", label: "XLS/XLSX" },
              ].map((f) => (
                <Button
                  key={f.value}
                  variant={historyFilter === f.value ? "glow" : "glass"}
                  size="sm"
                  onClick={() => setHistoryFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no histórico..."
                className="pl-9 bg-secondary border-border"
              />
            </div>

            {loadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Nenhuma correção encontrada.</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {paginatedHistory.map((record) => (
                    <motion.div
                      key={record.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="glass rounded-xl p-4 space-y-2 cursor-pointer hover:bg-card/80 transition-colors group"
                      onClick={() => loadFromHistory(record)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{formatDate(record.created_at)}</span>
                          <Badge variant="secondary" className="text-xs">{toneLabels[record.tone] || record.tone}</Badge>
                          <Badge variant="outline" className="text-xs">{record.source_type === "ocr" ? "OCR" : "Digitado"}</Badge>
                          {record.file_format && (
                            <Badge variant="outline" className="text-xs uppercase">{record.file_format}</Badge>
                          )}
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border" onClick={(e) => e.stopPropagation()}>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir correção?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteHistoryItem(record.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                      <p className="text-sm text-foreground/70 line-clamp-2">{record.original_text}</p>
                      <p className="text-sm text-success/80 line-clamp-2">→ {record.corrected_text}</p>
                    </motion.div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-muted-foreground">
                      {filteredHistory.length} resultado{filteredHistory.length !== 1 ? "s" : ""} • Página {currentPage} de {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="glass" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <Button variant="glass" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="editor" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <Tabs defaultValue="text" className="w-full">
              <TabsList className="bg-secondary border border-border">
                <TabsTrigger value="text" className="gap-1.5">
                  <Wand2 className="w-4 h-4" /> Correção de Texto
                </TabsTrigger>
                <TabsTrigger value="exam" className="gap-1.5">
                  <GraduationCap className="w-4 h-4" /> Correção de Prova
                </TabsTrigger>
              </TabsList>

              <TabsContent value="exam" className="mt-5">
                <ExamGrader />
              </TabsContent>

              <TabsContent value="text" className="mt-5 space-y-6">
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
                {isOcrProcessing ? "Extraindo..." : "OCR (Imagem/PDF/DOC)"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={handleFileSelect}
                className="hidden"
              />

              <Button variant="glass" onClick={handleClear}>
                <RotateCcw className="w-4 h-4 mr-1.5" />
                Limpar
              </Button>
            </div>

            {/* Progress Bar */}
            {(progressPercent > 0 || progressComplete) && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-4 space-y-3 border border-primary/20"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {progressComplete ? "Concluído com sucesso!" : "Processando..."}
                  </span>
                  <span className={`text-sm font-bold ${progressComplete ? "text-success" : "text-primary"}`}>
                    {progressPercent}%
                  </span>
                </div>
                <Progress value={progressPercent} className="h-3" />
                {progressComplete && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-success"
                  >
                    <PartyPopper className="w-4 h-4" />
                    <span className="text-sm font-medium">Concluído com sucesso!</span>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* OCR Background Progress Banner */}
            {isOcrProcessing && ocrProgress && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 flex items-center gap-3 border border-primary/20">
                <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{ocrProgress}</p>
                  <p className="text-xs text-muted-foreground">Você pode navegar para outras páginas. O processo continuará em segundo plano.</p>
                </div>
              </motion.div>
            )}
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
              </TabsContent>
            </Tabs>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
