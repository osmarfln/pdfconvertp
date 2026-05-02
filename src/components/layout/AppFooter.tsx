import logoFooter from "@/assets/logo-footer.png";

export function AppFooter() {
  return (
    <footer className="w-full border-t border-border bg-secondary/30 px-6 py-5">
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <img
          src={logoFooter}
          alt="PDF Convert Pro"
          className="h-10 w-auto object-contain opacity-90"
          loading="lazy"
        />
        <p className="text-xs text-muted-foreground">
          © 2026 PDF Convert Pro - Copyright Todos os Direitos Reservados
        </p>
        <p className="text-xs text-muted-foreground">
          Desenvolvimento ®{" "}
          <span className="text-sm font-bold tracking-wide bg-gradient-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)] animate-pulse">
            OSMARJR SISTEMAS
          </span>
        </p>
      </div>
    </footer>
  );
}
