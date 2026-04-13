export function AppFooter() {
  return (
    <footer className="w-full border-t border-border bg-secondary/30 px-6 py-4 text-center">
      <p className="text-xs text-muted-foreground">
        © 2026 PDF Convert Pro - Copyright Todos os Direitos Reservados
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        Desenvolvimento ®{" "}
        <span className="text-sm font-bold text-primary animate-pulse tracking-wide bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]">
          OSMARJR SISTEMAS
        </span>
      </p>
    </footer>
  );
}
