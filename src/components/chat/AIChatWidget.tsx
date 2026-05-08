import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Sparkles, Paperclip, Wand2, Download, FileText, Loader2, Image as ImageIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useFileConversions } from "@/hooks/useFileConversions";
import { toast } from "sonner";
import { TextDiff } from "./TextDiff";
import { downloadFromStorage, triggerBlobDownload } from "@/lib/download";

type AttachmentMsg = {
  kind: "attachment";
  fileName: string;
  status: "uploading" | "uploaded" | "converting" | "done" | "error" | "ocr";
  progress?: number; // 0-100 individual progress
  targetFormat?: string;
  sourceFormat?: string;
  originalPath?: string;
  convertedPath?: string;
  downloadName?: string;
  originalDownloadName?: string;
  error?: string;
};
type CorrectionMsg = {
  kind: "correction";
  original: string;
  corrected?: string;
  status: "loading" | "done" | "error";
  error?: string;
};

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  rich?: AttachmentMsg | CorrectionMsg;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia! ☀️";
  if (hour >= 12 && hour < 18) return "Boa tarde! 🌤️";
  return "Boa noite! 🌙";
}

const suggestions = [
  "📷 Foto de texto/manuscrito para PDF",
  "📎 Anexe um ou mais PDFs/DOCX para converter",
  "✨ Cole um texto para correção ortográfica",
  "Como usar o OCR para extrair texto?",
  "O que o assistente pode fazer?",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

const isPdf = (name: string) => /\.pdf$/i.test(name);
const isDoc = (name: string) => /\.(docx|xlsx|pptx)$/i.test(name);
const isImage = (name: string) => /\.(jpg|jpeg|png|webp|gif)$/i.test(name);

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [correctMode, setCorrectMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFile, convertFile } = useFileConversions();

  const greeting = useMemo(() => getGreeting(), []);
  const welcomeMessage = useMemo(
    () => `${greeting} Sou o assistente do PDF Convert Pro! 🚀\n\n• 📷 Envie uma **foto de texto ou manuscrito** para converter em PDF\n• 📎 Anexe um arquivo para **converter PDF↔Word**\n• ✨ Use o botão **Corrigir** para revisar ortografia/gramática\n• Ou faça uma pergunta!`,
    [greeting]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const updateMsg = (id: string, patch: Partial<Message> | ((m: Message) => Partial<Message>)) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m))
    );
  };

  const streamChat = async (allMessages: Message[]) => {
    setIsTyping(true);
    let assistantContent = "";

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: allMessages
            .filter((m) => !m.rich)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok || !resp.body) throw new Error("Falha ao conectar com IA");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && !last.rich) {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
                }
                return [...prev, { id: Date.now().toString(), role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isTyping) return;
    const text = input.trim();
    setInput("");

    if (correctMode) {
      runCorrection(text);
      setCorrectMode(false);
      return;
    }

    const userMessage: Message = { id: Date.now().toString(), role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    streamChat(newMessages);
  };

  const handleSuggestion = (text: string) => {
    if (text.startsWith("📷")) {
      fileInputRef.current?.click();
      return;
    }
    if (text.startsWith("📎")) {
      fileInputRef.current?.click();
      return;
    }
    if (text.startsWith("✨")) {
      setCorrectMode(true);
      setTimeout(() => document.getElementById("chat-input")?.focus(), 50);
      return;
    }
    if (isTyping) return;
    const userMessage: Message = { id: Date.now().toString(), role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    streamChat(newMessages);
  };

  const runCorrection = async (text: string) => {
    const userMsgId = Date.now().toString();
    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: `✨ Corrigir texto:\n\n${text}` },
      {
        id: aiMsgId,
        role: "assistant",
        content: "",
        rich: { kind: "correction", original: text, status: "loading" },
      },
    ]);

    try {
      const { data, error } = await supabase.functions.invoke("ai-correct", {
        body: { action: "correct", text, tone: "profissional" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha na correção");
      updateMsg(aiMsgId, {
        rich: { kind: "correction", original: text, corrected: data.correctedText, status: "done" },
      });
    } catch (err: any) {
      updateMsg(aiMsgId, {
        rich: { kind: "correction", original: text, status: "error", error: err.message },
      });
    }
  };

  const handleFiles = async (files: File[]) => {
    const valid = files.filter((f) => isPdf(f.name) || isDoc(f.name) || isImage(f.name));
    const invalid = files.length - valid.length;
    if (invalid > 0) {
      toast.error(`${invalid} arquivo(s) ignorado(s). Envie PDF, DOCX, XLSX, PPTX ou Imagens.`);
    }
    if (!valid.length) return;

    // Create one message per file
    const queued = valid.map((file) => {
      const isImg = isImage(file.name);
      const target = isImg ? "pdf" : (isPdf(file.name) ? "docx" : "pdf");
      const source = file.name.split(".").pop()!.toLowerCase();
      const baseName = file.name.replace(/\.[^.]+$/, "");
      const downloadName = `${baseName}.${target}`;
      const originalDownloadName = file.name;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      return { id, file, target, source, downloadName, originalDownloadName, isImg };
    });

    setMessages((prev) => [
      ...prev,
      ...queued.map((q) => ({
        id: q.id,
        role: "user" as const,
        content: "",
        rich: {
          kind: "attachment" as const,
          fileName: q.file.name,
          status: "uploading" as const,
          progress: 0,
          targetFormat: q.target,
          sourceFormat: q.source,
          downloadName: q.downloadName,
          originalDownloadName: q.originalDownloadName,
        },
      })),
    ]);

    for (const q of queued) {
      try {
        updateMsg(q.id, (m) => ({
          rich: { ...(m.rich as AttachmentMsg), status: "uploading", progress: 10 },
        }));
        
        const conv = await uploadFile(q.file);
        if (!conv) throw new Error("Falha no upload");

        if (q.isImg) {
          updateMsg(q.id, (m) => ({
            rich: { ...(m.rich as AttachmentMsg), status: "ocr", progress: 30, originalPath: conv.original_path ?? undefined },
          }));
          
          // Use the ai-correct OCR capability for images
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve((reader.result as string).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(q.file);
          });

          updateMsg(q.id, (m) => ({ rich: { ...(m.rich as AttachmentMsg), progress: 50 } }));
          
          const { data, error } = await supabase.functions.invoke("ai-correct", {
            body: { action: "ocr", imageBase64: base64, mimeType: q.file.type },
          });

          if (error || !data?.success) throw new Error(data?.error || "OCR failed");
          
          const extractedText = data.text || "Sem texto detectado.";
          updateMsg(q.id, (m) => ({ rich: { ...(m.rich as AttachmentMsg), progress: 80 } }));

          // Convert the extracted text back to PDF
          const { saveCorrectedTextAsBackup } = await import("@/lib/textToPdf");
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const pdfPath = await saveCorrectedTextAsBackup({
              userId: session.user.id,
              title: q.originalDownloadName,
              text: extractedText
            });

            if (pdfPath) {
              updateMsg(q.id, (m) => ({
                rich: { ...(m.rich as AttachmentMsg), status: "done", progress: 100, convertedPath: pdfPath },
              }));
              // Auto download
              downloadFromStorage(pdfPath, q.downloadName);
              continue;
            }
          }
          throw new Error("Falha ao gerar PDF final");
        }

        updateMsg(q.id, (m) => ({
          rich: { ...(m.rich as AttachmentMsg), status: "converting", progress: 40, originalPath: conv.original_path ?? undefined },
        }));

        let cur = 40;
        const interval = window.setInterval(() => {
          cur = Math.min(cur + Math.random() * 6, 88);
          updateMsg(q.id, (m) => ({ rich: { ...(m.rich as AttachmentMsg), progress: cur } }));
        }, 600);

        const convertedPath = await convertFile(conv.id, conv.original_path!, q.target);
        window.clearInterval(interval);
        if (!convertedPath) throw new Error("Falha na conversão");

        updateMsg(q.id, (m) => ({
          rich: { ...(m.rich as AttachmentMsg), status: "done", progress: 100, convertedPath },
        }));
      } catch (err: any) {
        updateMsg(q.id, (m) => ({
          rich: { ...(m.rich as AttachmentMsg), status: "error", error: err.message },
        }));
      }
    }
  };

  const downloadConverted = async (path: string, name: string) => {
    const ok = await downloadFromStorage(path, name);
    if (ok) toast.success(`${name} baixado!`);
  };

  const renderRich = (msg: Message) => {
    if (!msg.rich) return null;

    if (msg.rich.kind === "attachment") {
      const a = msg.rich;
      const progress = Math.round(a.progress ?? 0);
      const inProgress = a.status === "uploading" || a.status === "converting";
      // When source is PDF -> converted is DOCX, original is PDF
      // When source is DOCX/etc -> converted is PDF, original is the source format
      const convertedExt = (a.targetFormat || "").toUpperCase();
      const originalExt = (a.sourceFormat || "").toUpperCase();
      return (
        <div className="rounded-xl bg-secondary border border-border p-3 max-w-[85%] space-y-2 w-full">
          <div className="flex items-center gap-2">
            {isImage(a.fileName) ? (
              <ImageIcon className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-primary shrink-0" />
            )}
            <span className="text-sm font-medium text-foreground truncate">{a.fileName}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {a.status === "uploading" && `📤 Enviando... ${progress}%`}
            {a.status === "ocr" && `🔍 Extraindo texto e gerando PDF... ${progress}%`}
            {a.status === "converting" && `🔄 Convertendo para ${convertedExt}... ${progress}%`}
            {a.status === "done" && `✅ Pronto — escolha o formato para baixar`}
            {a.status === "error" && `❌ ${a.error || "Erro"}`}
          </div>
          {(inProgress || a.status === "ocr") && (
            <div className="h-1.5 w-full rounded-full bg-background/60 overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.max(5, progress)}%` }}
              />
            </div>
          )}
          {a.status === "done" && a.convertedPath && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => downloadConverted(a.convertedPath!, a.downloadName!)}
                className="flex items-center gap-2 justify-center px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
              >
                <Download className="w-3.5 h-3.5" /> Baixar {convertedExt}
              </button>
              {a.originalPath && a.originalDownloadName && (
                <button
                  onClick={() => downloadConverted(a.originalPath!, a.originalDownloadName!)}
                  className="flex items-center gap-2 justify-center px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-xs font-medium hover:bg-muted"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar {originalExt}
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    if (msg.rich.kind === "correction") {
      const c = msg.rich;
      return (
        <div className="rounded-xl bg-secondary border border-border p-3 max-w-[90%] space-y-3 w-full">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Wand2 className="w-4 h-4 text-warning" />
            Correção ortográfica e gramatical
          </div>
          {c.status === "loading" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Analisando texto...
            </div>
          )}
          {c.status === "error" && <div className="text-xs text-destructive">{c.error}</div>}
          {c.status === "done" && c.corrected && (
            <>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">Comparação antes / depois:</div>
                <TextDiff original={c.original} corrected={c.corrected} />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-semibold text-muted-foreground">Texto corrigido:</div>
                <div className="rounded-lg bg-background/40 border border-border/60 p-3 text-sm whitespace-pre-wrap break-words">
                  {c.corrected}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(c.corrected!);
                    toast.success("Texto copiado!");
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  📋 Copiar texto corrigido
                </button>
              </div>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.xlsx,.pptx,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const list = e.target.files;
          if (list && list.length > 0) handleFiles(Array.from(list));
          e.target.value = "";
        }}
      />
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-4 sm:bottom-6 sm:right-6 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary flex items-center justify-center glow z-50 shadow-2xl"
          >
            <MessageCircle className="w-6 h-6 text-primary-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 bottom-0 mx-auto w-full h-full sm:bottom-6 sm:right-6 sm:left-auto sm:mx-0 sm:w-[420px] sm:h-[600px] sm:rounded-2xl glass border border-border shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Assistente IA</p>
                  <p className="text-xs text-success flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                    Online
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-secondary rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                      <div className="text-sm text-foreground prose prose-sm prose-invert max-w-none">
                        <ReactMarkdown>{welcomeMessage}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 pl-9">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSuggestion(s)}
                        className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-secondary/50 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" && !msg.rich ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  {msg.rich ? (
                    renderRich(msg)
                  ) : (
                    <div className={`rounded-xl px-3.5 py-2.5 max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-secondary text-foreground rounded-tl-sm"}`}>
                      {msg.role === "assistant" ? (
                        <div className="text-sm prose prose-sm prose-invert max-w-none [&_p]:mb-1 [&_ul]:mb-1 [&_ol]:mb-1 [&_li]:mb-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:bg-background/30 [&_code]:px-1 [&_code]:rounded">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-line">{msg.content}</p>
                      )}
                    </div>
                  )}
                  {msg.role === "user" && !msg.rich && (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="bg-secondary rounded-xl rounded-tl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-border space-y-2">
              {correctMode && (
                <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/30 text-xs">
                  <span className="text-warning flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5" /> Modo correção: cole o texto e envie
                  </span>
                  <button onClick={() => setCorrectMode(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Anexar PDF/DOCX (vários arquivos suportados)"
                  className="h-10 w-10 rounded-lg bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCorrectMode((v) => !v)}
                  title="Corrigir texto"
                  className={`h-10 w-10 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                    correctMode ? "bg-warning/20 border-warning text-warning" : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Wand2 className="w-4 h-4" />
                </button>
                <textarea
                  id="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={correctMode ? "Cole o texto a corrigir..." : "Digite sua mensagem..."}
                  disabled={isTyping}
                  rows={correctMode ? 3 : 1}
                  className="flex-1 px-3.5 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 resize-none min-h-[40px] max-h-32"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
