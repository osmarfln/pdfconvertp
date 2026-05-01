import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppFooter } from "@/components/layout/AppFooter";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { FileList } from "@/components/dashboard/FileList";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { AIChatWidget } from "@/components/chat/AIChatWidget";
import { InstallPWAFloating } from "@/components/InstallPWAFloating";
import { TextComparison } from "@/components/comparison/TextComparison";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { FilesPage } from "@/components/pages/FilesPage";
import { AIPage } from "@/components/pages/AIPage";
import { ReportsPage } from "@/components/pages/ReportsPage";
import { ExportPage } from "@/components/pages/ExportPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { PDFEditor } from "@/components/pdf-editor/PDFEditor";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PhoneGate } from "@/components/auth/PhoneGate";
import dashboardBg from "@/assets/dashboard-bg.png";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Index() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const { isAdmin } = useAuth();

  // Redirect non-admins away from admin-only tabs
  useEffect(() => {
    const adminOnly = ["reports", "admin", "settings"];
    if (!isAdmin && adminOnly.includes(activeTab)) {
      setActiveTab("dashboard");
    }
  }, [isAdmin, activeTab]);
  const [userName, setUserName] = useState("");
  const [needsPhone, setNeedsPhone] = useState<boolean | null>(null);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name, phone")
          .eq("user_id", session.user.id)
          .single();

        if (profile?.display_name) {
          setUserName(profile.display_name.split(" ")[0]);
        } else {
          const email = session.user.email || "";
          setUserName(email.split("@")[0]);
        }

        setNeedsPhone(!(profile as any)?.phone);
      } else {
        setNeedsPhone(false);
      }
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserId(session.user.id);
        supabase
          .from("profiles")
          .select("display_name, phone")
          .eq("user_id", session.user.id)
          .single()
          .then(({ data }) => {
            if (data?.display_name) {
              setUserName(data.display_name.split(" ")[0]);
            }
            setNeedsPhone(!(data as any)?.phone);
          });
      } else {
        setUserName("");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (needsPhone === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (needsPhone) {
    return <PhoneGate userId={userId} onComplete={() => setNeedsPhone(false)} />;
  }

  const displayName = userName || "Usuário";

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AppHeader onMenuClick={() => {
          // Dispatch custom event to open mobile sidebar
          window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'));
        }} />

        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 space-y-4 md:space-y-6">
          {activeTab === "dashboard" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative space-y-4 md:space-y-6">
              {/* Plano de fundo do dashboard - 25% opacidade (75% transparente) */}
              <div
                aria-hidden
                className="pointer-events-none fixed inset-0 z-0 bg-center bg-no-repeat bg-contain opacity-25"
                style={{ backgroundImage: `url(${dashboardBg})` }}
              />
              <div className="relative z-10 space-y-4 md:space-y-6">
                <div>
                  <h2 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-foreground">
                    {getGreeting()}, {displayName} 👋
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Gerencie seus documentos, usa a ferramenta para otimizar seus textos PDF sua melhor amigo CONVERT PDF PRO
                  </p>
                </div>
                <StatsCards />
                <QuickActions onNavigate={setActiveTab} />
                <FileList />
              </div>
            </motion.div>
          )}

          {activeTab === "upload" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 md:space-y-6 max-w-3xl mx-auto">
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-foreground">Upload de Arquivos</h2>
                <p className="text-muted-foreground mt-1 text-sm">Envie seus documentos para processamento inteligente.</p>
              </div>
              <UploadZone />
            </motion.div>
          )}

          {activeTab === "files" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <FilesPage />
            </motion.div>
          )}

          {activeTab === "ai" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AIPage />
            </motion.div>
          )}

          {activeTab === "editor" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <PDFEditor />
            </motion.div>
          )}

          {activeTab === "compare" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <TextComparison />
            </motion.div>
          )}

          {activeTab === "reports" && isAdmin && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ReportsPage />
            </motion.div>
          )}

          {activeTab === "export" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ExportPage />
            </motion.div>
          )}

          {activeTab === "admin" && isAdmin && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AdminPanel />
            </motion.div>
          )}

          {activeTab === "settings" && isAdmin && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SettingsPage />
            </motion.div>
          )}
          <AppFooter />
        </main>
      </div>

      <AIChatWidget />
      <InstallPWAFloating />
    </div>
  );
}
