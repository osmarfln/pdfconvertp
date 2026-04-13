import { useState } from "react";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { FileList } from "@/components/dashboard/FileList";
import { UploadZone } from "@/components/dashboard/UploadZone";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { AIChatWidget } from "@/components/chat/AIChatWidget";
import { TextComparison } from "@/components/comparison/TextComparison";
import { AdminPanel } from "@/components/admin/AdminPanel";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

export default function Index() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <AppHeader />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === "dashboard" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground">
                  {getGreeting()}, Usuário 👋
                </h2>
                <p className="text-muted-foreground mt-1">
                  Gerencie seus documentos e use o poder da IA para otimizar seus textos.
                </p>
              </div>

              <StatsCards />
              <QuickActions />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <FileList />
                </div>
                <div>
                  <div className="glass rounded-xl p-5">
                    <h3 className="font-display font-semibold text-foreground mb-4">
                      Upload Rápido
                    </h3>
                    <UploadZone />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "upload" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6 max-w-3xl mx-auto"
            >
              <div>
                <h2 className="text-2xl font-display font-bold text-foreground">
                  Upload de Arquivos
                </h2>
                <p className="text-muted-foreground mt-1">
                  Envie seus documentos para processamento inteligente.
                </p>
              </div>
              <UploadZone />
            </motion.div>
          )}

          {activeTab !== "dashboard" && activeTab !== "upload" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                <span className="text-3xl">🚧</span>
              </div>
              <h3 className="font-display font-semibold text-foreground text-lg">
                Em Desenvolvimento
              </h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Esta funcionalidade estará disponível em breve. Volte ao Dashboard para explorar os recursos disponíveis.
              </p>
            </motion.div>
          )}
        </main>
      </div>

      <AIChatWidget />
    </div>
  );
}
