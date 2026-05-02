import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Wand2,
  Pencil,
  GitCompare,
  ShieldCheck,
} from "lucide-react";

const allItems = [
  { icon: LayoutDashboard, label: "Início", id: "dashboard", adminOnly: false },
  { icon: Upload, label: "Upload", id: "upload", adminOnly: false },
  { icon: FileText, label: "Arquivos", id: "files", adminOnly: false },
  { icon: Pencil, label: "Editor", id: "editor", adminOnly: false },
  { icon: Wand2, label: "IA", id: "ai", adminOnly: false },
  { icon: GitCompare, label: "Comparar", id: "compare", adminOnly: false },
  { icon: ShieldCheck, label: "Admin", id: "admin", adminOnly: true },
];

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileBottomNav({ activeTab, onTabChange }: MobileBottomNavProps) {
  const { isAdmin } = useAuth();
  const items = useMemo(
    () => allItems.filter((i) => !i.adminOnly || isAdmin),
    [isAdmin],
  );

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-sidebar/95 backdrop-blur-md border-t border-sidebar-border pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegação rápida"
    >
      <div className="flex items-stretch justify-around px-1 py-1.5 overflow-x-auto">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 min-w-[58px] rounded-lg transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "w-5 h-5 shrink-0",
                  isActive && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]",
                )}
              />
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
