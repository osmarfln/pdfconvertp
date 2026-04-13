import { Bell, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppHeader() {
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

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4.5 h-4.5 text-muted-foreground" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse-glow" />
        </Button>
        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <User className="w-4 h-4 text-primary" />
        </div>
      </div>
    </header>
  );
}
