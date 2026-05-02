import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  FileText,
  Wand2,
  Pencil,
  GitCompare,
} from "lucide-react";

const allItems = [
  { icon: LayoutDashboard, label: "Início", id: "dashboard", adminOnly: false },
  { icon: FileText, label: "Arquivos", id: "files", adminOnly: false },
  { icon: Pencil, label: "Editor", id: "editor", adminOnly: false },
  { icon: Wand2, label: "IA", id: "ai", adminOnly: false },
  { icon: GitCompare, label: "Comparar", id: "compare", adminOnly: false },
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
      </div>
    </nav>
  );
}
