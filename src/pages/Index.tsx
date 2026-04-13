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
import { supabase } from "@/integrations/supabase/client";
import { PhoneGate } from "@/components/auth/PhoneGate";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Index() {
  const [activeTab, setActiveTab] = useState("dashboard");
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

  // Loading state
  if (needsPhone === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Phone gate
  if (needsPhone) {
    return <PhoneGate userId={userId} onComplete={() => setNeedsPhone(false)} />;
  }

  const displayName = userName || "Usuário";

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "dashboard" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground">
                  {getGreeting()}, {displayName} 👋
                </h2>
                <p className="text-muted-foreground mt-1">
                  Gerencie seus documentos e use o poder da IA para otimizar seus textos.
                </p>
              </div>
              <StatsCards />
              <QuickActions onNavigate={setActiveTab} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <FileList />
                </div>
                <div>
                  <div className="glass rounded-xl p-5">
                    <h3 className="font-display font-semibold text-foreground mb-4">Upload Rápido</h3>
                    <UploadZone />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "upload" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl mx-auto">
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground">Upload de Arquivos</h2>
                <p className="text-muted-foreground mt-1">Envie seus documentos para processamento inteligente.</p>
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

          {activeTab === "compare" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <TextComparison />
            </motion.div>
          )}

          {activeTab === "reports" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ReportsPage />
            </motion.div>
          )}

          {activeTab === "export" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ExportPage />
            </motion.div>
          )}

          {activeTab === "admin" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AdminPanel />
            </motion.div>
          )}

          {activeTab === "settings" && (
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
