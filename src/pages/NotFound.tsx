import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AppFooter } from "@/components/layout/AppFooter";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-4xl font-bold text-foreground">404</h1>
          <p className="mb-4 text-xl text-muted-foreground">Oops! Página não encontrada</p>
          <a href="/" className="text-primary underline hover:text-primary/90">
            Voltar para o início
          </a>
        </div>
      </div>
      <AppFooter />
    </div>
  );
};

export default NotFound;
