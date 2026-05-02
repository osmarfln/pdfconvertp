import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useFileConversions } from "@/hooks/useFileConversions";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  FileText,
  Wand2,
  Pencil,
  GitCompare,
  Zap,
  FileType2,
  Image as ImageIcon,
  ArrowRight,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Início", id: "dashboard" },
  { icon: FileText, label: "Arquivos", id: "files" },
  { icon: Pencil, label: "Editor", id: "editor" },
];

type QuickAction = {
  id: string;
  label: string;
  from: string;
  to: string;
  accept: string;
  fromExt: string[];
  targetFormat: string;
  iconFrom: typeof FileType2;
  iconTo: typeof FileType2;
  color: string;
};

const quickActions: QuickAction[] = [
  {
    id: "word-pdf",
    label: "Word → PDF",
    from: "DOCX",
    to: "PDF",
    accept: ".doc,.docx",
    fromExt: ["doc", "docx"],
    targetFormat: "pdf",
    iconFrom: FileType2,
    iconTo: FileType2,
    color: "text-blue-400",
  },
  {
    id: "pdf-word",
    label: "PDF → Word",
    from: "PDF",
    to: "DOCX",
    accept: ".pdf",
    fromExt: ["pdf"],
    targetFormat: "docx",
    iconFrom: FileType2,
    iconTo: FileType2,
    color: "text-red-400",
  },
  {
    id: "pdf-jpg",
    label: "PDF → JPG",
    from: "PDF",
    to: "JPG",
    accept: ".pdf",
    fromExt: ["pdf"],
    targetFormat: "jpg",
    iconFrom: FileType2,
    iconTo: ImageIcon,
    color: "text-orange-400",
  },
  {
    id: "jpg-pdf",
    label: "JPG → PDF",
    from: "JPG",
    to: "PDF",
    accept: ".jpg,.jpeg,.png",
    fromExt: ["jpg", "jpeg", "png"],
    targetFormat: "pdf",
    iconFrom: ImageIcon,
    iconTo: FileType2,
    color: "text-green-400",
  },
];

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const { isAdmin } = useAuth();
  const { uploadFile, convertFile } = useFileConversions();
  const [quickOpen, setQuickOpen] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingActionRef = useRef<QuickAction | null>(null);

  const items = useMemo(() => navItems, []);

  const triggerAction = (action: QuickAction) => {
    pendingActionRef.current = action;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.accept = action.accept;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const action = pendingActionRef.current;
    const file = e.target.files?.[0];
    if (!action || !file) return;

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!action.fromExt.includes(ext)) {
      toast.error(`Selecione um arquivo .${action.fromExt.join(", .")}`);
      return;
    }

    try {
      setRunning(action.id);
      toast.info(`Enviando ${file.name}...`);
      const conv = await uploadFile(file);
      if (!conv?.id || !conv.original_path) {
        setRunning(null);
        return;
      }
      toast.info(`Convertendo para ${action.to}...`);
      await convertFile(conv.id, conv.original_path, action.targetFormat);
      toast.success(`Conversão ${action.label} concluída! Veja em "Arquivos".`);
      setQuickOpen(false);
      onTabChange("files");
    } catch (err: any) {
      console.error("[QuickAction] Error", err);
      toast.error(err?.message || "Falha na conversão");
    } finally {
      setRunning(null);
      pendingActionRef.current = null;
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
      />

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur-md border-t border-sidebar-border pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegação rápida"
      >
        <div className="grid grid-flow-col auto-cols-fr items-stretch px-1 py-1">
          {items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 rounded-md transition-colors min-w-0",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground active:bg-sidebar-accent",
                )}
              >
                <item.icon
                  className={cn(
                    "w-[18px] h-[18px] shrink-0",
                    isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]",
                  )}
                />
                <span className="text-[9.5px] font-medium leading-none truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Botão de Conversões rápidas */}
          <button
            onClick={() => setQuickOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 rounded-md text-primary min-w-0 active:bg-sidebar-accent"
          >
            <Zap className="w-[18px] h-[18px] shrink-0 drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
            <span className="text-[9.5px] font-medium leading-none truncate max-w-full">
              Converter
            </span>
          </button>
        </div>
      </nav>

      <Sheet open={quickOpen} onOpenChange={setQuickOpen}>
        <SheetContent
          side="bottom"
          className="bg-sidebar border-t border-sidebar-border rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
        >
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <Zap className="w-5 h-5 text-primary" />
              Conversões rápidas
            </SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {quickActions.map((a) => {
              const isLoading = running === a.id;
              return (
                <button
                  key={a.id}
                  disabled={!!running}
                  onClick={() => triggerAction(a)}
                  className={cn(
                    "glass rounded-xl p-3 flex flex-col items-start gap-2 text-left transition-all",
                    "hover:border-primary/40 active:scale-[0.98]",
                    isLoading && "opacity-70",
                  )}
                >
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <a.iconFrom className={cn("w-4 h-4", a.color)} />
                    <span className="text-foreground">{a.from}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <a.iconTo className="w-4 h-4 text-primary" />
                    <span className="text-foreground">{a.to}</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {isLoading ? "Processando..." : "Toque para enviar arquivo"}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-muted-foreground text-center mt-4">
            O arquivo convertido fica em <strong>Meus Arquivos</strong>.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
