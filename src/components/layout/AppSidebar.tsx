import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import logoBg from "@/assets/logo-bg.png";
import { InstallPWAButton } from "@/components/InstallPWA";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  FileText,
  Wand2,
  GitCompare,
  BarChart3,
  Download,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Menu,
  Pencil,
} from "lucide-react";

const allNavItems = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard", adminOnly: false },
  { icon: FileText, label: "Meus Arquivos", id: "files", adminOnly: false },
  { icon: Pencil, label: "Editor PDF", id: "editor", adminOnly: false },
  { icon: Wand2, label: "IA & Correção", id: "ai", adminOnly: false },
  { icon: GitCompare, label: "Comparação", id: "compare", adminOnly: false },
  { icon: BarChart3, label: "Relatórios", id: "reports", adminOnly: true },
  { icon: Download, label: "Exportar", id: "export", adminOnly: false },
  { icon: ShieldCheck, label: "Admin", id: "admin", adminOnly: true },
  { icon: Settings, label: "Configurações", id: "settings", adminOnly: true },
];

interface AppSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

function SidebarNav({ activeTab, onTabChange, collapsed, onItemClick }: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  collapsed: boolean;
  onItemClick?: () => void;
}) {
  const { isAdmin } = useAuth();
  const navItems = useMemo(
    () => allNavItems.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin],
  );
  return (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => { onTabChange(item.id); onItemClick?.(); }}
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
  );
}

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-sidebar-border">
      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0">
        <img src={logoBg} alt="PDF Convert Pro" className="w-full h-full object-cover" />
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
  );
}

export function MobileMenuTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="md:hidden w-9 h-9 rounded-lg bg-secondary border border-border flex items-center justify-center"
    >
      <Menu className="w-5 h-5 text-muted-foreground" />
    </button>
  );
}

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = () => setMobileOpen((v) => !v);
    window.addEventListener('toggle-mobile-sidebar', handler);
    return () => window.removeEventListener('toggle-mobile-sidebar', handler);
  }, []);

  if (isMobile) {
    return (
      <>
        {/* Mobile trigger in header handled separately */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-[260px] p-0 bg-sidebar border-sidebar-border">
            <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
            <SidebarLogo collapsed={false} />
            <SidebarNav
              activeTab={activeTab}
              onTabChange={onTabChange}
              collapsed={false}
              onItemClick={() => setMobileOpen(false)}
            />
            <InstallPWAButton collapsed={false} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside
      className={cn(
        "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-out relative hidden md:flex",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      <SidebarLogo collapsed={collapsed} />
      <SidebarNav activeTab={activeTab} onTabChange={onTabChange} collapsed={collapsed} />
      <InstallPWAButton collapsed={collapsed} />

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

export function useMobileSidebar() {
  const [open, setOpen] = useState(false);
  return { open, setOpen, toggle: () => setOpen((v) => !v) };
}
