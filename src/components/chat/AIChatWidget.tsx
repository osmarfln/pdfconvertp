import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User, Sparkles } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia! ☀️";
  if (hour >= 12 && hour < 18) return "Boa tarde! 🌤️";
  return "Boa noite! 🌙";
}

const suggestions = [
  "Como converter um PDF para Word?",
  "Quero corrigir a ortografia de um texto",
  "Como usar o OCR para extrair texto?",
  "Qual a diferença entre os planos?",
];

export function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const greeting = useMemo(() => getGreeting(), []);

  const welcomeMessage = useMemo(
    () => `${greeting} Sou o assistente do PDF Convert Pro! 🚀\n\nComo posso ajudar você hoje? Posso te guiar em conversões, correções com IA, OCR e muito mais.`,
    [greeting]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const simulateResponse = (userMsg: string) => {
    setIsTyping(true);
    setTimeout(() => {
      const responses: Record<string, string> = {
        converter: "Para converter um arquivo, basta fazer upload na área de Upload e selecionar o formato de destino. Suportamos Word → PDF, Excel → PDF, PDF → JPG e muito mais! 📄",
        corrigir: "Ótima escolha! Após fazer upload do seu documento, clique em 'Corrigir com IA'. Nossa IA analisa ortografia, gramática, pontuação e até sugere melhorias de clareza. ✨",
        ocr: "O OCR é ativado automaticamente quando detectamos um PDF escaneado ou imagem. Também pode ativá-lo manualmente na seção de processamento. 🔍",
        plano: "Temos 3 planos:\n• **Free**: 5 conversões/mês\n• **Pro**: 100 conversões + IA ilimitada\n• **Business**: Uso ilimitado + API + Suporte prioritário\n\nQual se encaixa melhor para você? 💡",
      };

      const key = Object.keys(responses).find((k) =>
        userMsg.toLowerCase().includes(k)
      );

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content:
            key
              ? responses[key]
              : "Entendi! Posso te ajudar com conversões de arquivos, correção de textos com IA, OCR e muito mais. Pode me dizer mais sobre o que precisa? 😊",
        },
      ]);
      setIsTyping(false);
    }, 1200);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    simulateResponse(input);
  };

  const handleSuggestion = (text: string) => {
    setInput(text);
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMessage]);
    simulateResponse(text);
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary flex items-center justify-center glow z-50 shadow-2xl"
          >
            <MessageCircle className="w-6 h-6 text-primary-foreground" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 w-[380px] h-[520px] rounded-2xl glass border border-border shadow-2xl flex flex-col z-50 overflow-hidden"
          >
            {/* Header */}
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
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Welcome */}
              {messages.length === 0 && (
                <div className="space-y-4">
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                    <div className="bg-secondary rounded-xl rounded-tl-sm px-3.5 py-2.5 max-w-[85%]">
                      <p className="text-sm text-foreground whitespace-pre-line">{welcomeMessage}</p>
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
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`rounded-xl px-3.5 py-2.5 max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-secondary text-foreground rounded-tl-sm"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-line">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {isTyping && (
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

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 h-10 px-3.5 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
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
