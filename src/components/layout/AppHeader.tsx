import { useState, useEffect } from "react";
import { Bell, Search, User, Clock, LogOut, Sun, Moon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

export function AppHeader() {
  const [now, setNow] = useState(new Date());
  const { signOut, user } = useAuth();
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();
  const [isDark, setIsDark] = useState(() => !document.documentElement.classList.contains("light"));

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
    }
    try {
      const saved = localStorage.getItem("pdfconvert-settings");
      const settings = saved ? JSON.parse(saved) : {};
      settings["dark-mode"] = newDark;
      localStorage.setItem("pdfconvert-settings", JSON.stringify(settings));
    } catch {}
  };

  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

  const formatTime = (d: Date) => {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    return `${Math.floor(diff / 3600)}h`;
  };

  return (
    <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-30">
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar arquivos..."
            className="w-full h-9 pl-9 pr-4 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-mono text-foreground font-medium">{timeStr}</span>
          <span className="text-muted-foreground text-xs hidden md:inline">· {dateStr}</span>
        </div>

        <Button variant="ghost" size="icon" onClick={toggleTheme} title={isDark ? "Modo claro" : "Modo escuro"}>
          {isDark ? <Sun className="w-4.5 h-4.5 text-muted-foreground" /> : <Moon className="w-4.5 h-4.5 text-muted-foreground" />}
        </Button>

        {/* Notification Bell */}
        <DropdownMenu onOpenChange={(open) => { if (open) markAllRead(); }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="w-4.5 h-4.5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-destructive-foreground">{unreadCount > 9 ? "9+" : unreadCount}</span>
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-card border-border max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-sm font-semibold text-foreground">Notificações</span>
              {notifications.length > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground" onClick={clearAll}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  Limpar
                </Button>
              )}
            </div>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-1 py-3 cursor-default">
                  <div className="flex items-center gap-2 w-full">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />}
                    <span className="text-sm font-medium text-foreground flex-1">{n.title}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-success/20 text-success">
                      Pronto
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{n.message}</span>
                  <span className="text-[10px] text-muted-foreground/60">{formatTime(n.createdAt)}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-card border-border">
            {user && (
              <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                {user.email}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={signOut} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
