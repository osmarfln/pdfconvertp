import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Upload,
  FileText,
  Wand2,
  GitCompare,
  BarChart3,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Crown,
  ShieldCheck,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Upload, label: "Upload", id: "upload" },
  { icon: FileText, label: "Meus Arquivos", id: "files" },
  { icon: Wand2, label: "IA & Correção", id: "ai" },
  { icon: GitCompare, label: "Comparação", id: "compare" },
  { icon: BarChart3, label: "Relatórios", id: "reports" },
  { icon: Download, label: "Exportar", id: "export" },
  { icon: ShieldCheck, label: "Admin", id: "admin" },
  { icon: Settings, label: "Configurações", id: "settings" },
];

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-out relative",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="font-display font-bold text-foreground text-lg leading-tight">
              PDF Convert
            </h1>
            <span className="text-xs text-muted-foreground">Pro</span>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", isActive && "text-primary")} />
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Plan badge */}
      {!collapsed && (
        <div className="mx-3 mb-4 p-3 rounded-lg bg-secondary border border-border">
          <div className="flex items-center gap-2 mb-1">
            <Crown className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-foreground">Plano Free</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">3 de 5 conversões usadas</p>
          <div className="w-full h-1.5 rounded-full bg-muted">
            <div className="h-full w-3/5 rounded-full bg-primary" />
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-accent transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>
    </aside>
  );
}
