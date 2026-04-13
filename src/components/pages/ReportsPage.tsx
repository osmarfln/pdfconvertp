import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, PieChart, TrendingUp, FileText, Loader2, FileSpreadsheet, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ReportStats {
  totalProcessed: number;
  totalCorrections: number;
  byFormat: Record<string, number>;
  byStatus: Record<string, number>;
  recentActivity: { date: string; count: number }[];
}

export function ReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const { data: conversions, error } = await supabase
        .from("file_conversions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching stats:", error);
        setLoading(false);
        return;
      }

      const records = conversions || [];
      const byFormat: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const dateMap: Record<string, number> = {};

      for (const r of records) {
        byFormat[r.original_format] = (byFormat[r.original_format] || 0) + 1;
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        const day = new Date(r.created_at).toLocaleDateString("pt-BR");
        dateMap[day] = (dateMap[day] || 0) + 1;
      }

      const recentActivity = Object.entries(dateMap)
        .slice(0, 7)
        .map(([date, count]) => ({ date, count }));

      setStats({
        totalProcessed: records.length,
        totalCorrections: records.filter((r) => r.status === "completed").length,
        byFormat,
        byStatus,
        recentActivity,
      });
      setLoading(false);
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const s = stats || { totalProcessed: 0, totalCorrections: 0, byFormat: {}, byStatus: {}, recentActivity: [] };
  const errorCount = s.byStatus["error"] || 0;
  const pendingCount = s.byStatus["pending"] || 0 + (s.byStatus["processing"] || 0) + (s.byStatus["uploaded"] || 0);
  const successRate = s.totalProcessed > 0 ? Math.round((s.totalCorrections / s.totalProcessed) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Relatórios</h2>
        <p className="text-muted-foreground mt-1">
          Estatísticas reais dos seus documentos processados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: "Total Processados", icon: FileText, value: s.totalProcessed, desc: "Documentos enviados", color: "text-primary" },
          { title: "Conversões Concluídas", icon: TrendingUp, value: s.totalCorrections, desc: "Finalizadas com sucesso", color: "text-success" },
          { title: "Taxa de Sucesso", icon: BarChart3, value: `${successRate}%`, desc: "Conversões bem-sucedidas", color: "text-success" },
          { title: "Erros", icon: PieChart, value: errorCount, desc: "Conversões com falha", color: "text-destructive" },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
            <p className={`text-3xl font-display font-bold ${item.color}`}>{item.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Format distribution */}
      {Object.keys(s.byFormat).length > 0 && (
        <div className="glass rounded-xl p-6">
          <h3 className="font-display font-semibold text-foreground mb-4">Distribuição por Formato</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(s.byFormat).map(([fmt, count]) => {
              const Icon = ["jpg", "jpeg", "png"].includes(fmt) ? Image : ["xlsx"].includes(fmt) ? FileSpreadsheet : FileText;
              return (
                <div key={fmt} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{fmt.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">{count} arquivo{count !== 1 ? "s" : ""}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {s.recentActivity.length > 0 && (
        <div className="glass rounded-xl p-6">
          <h3 className="font-display font-semibold text-foreground mb-4">Atividade Recente</h3>
          <div className="space-y-2">
            {s.recentActivity.map((a) => (
              <div key={a.date} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-foreground">{a.date}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(20, a.count * 20)}px` }} />
                  <span className="text-sm font-medium text-foreground">{a.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status breakdown */}
      {Object.keys(s.byStatus).length > 0 && (
        <div className="glass rounded-xl p-6">
          <h3 className="font-display font-semibold text-foreground mb-4">Status dos Processamentos</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(s.byStatus).map(([status, count]) => {
              const statusMap: Record<string, { label: string; color: string }> = {
                completed: { label: "Concluído", color: "text-success" },
                error: { label: "Erro", color: "text-destructive" },
                processing: { label: "Processando", color: "text-warning" },
                uploaded: { label: "Enviado", color: "text-primary" },
                pending: { label: "Pendente", color: "text-muted-foreground" },
              };
              const info = statusMap[status] || { label: status, color: "text-muted-foreground" };
              return (
                <div key={status} className="text-center p-3 rounded-lg bg-secondary/50">
                  <p className={`text-2xl font-bold ${info.color}`}>{count}</p>
                  <p className="text-xs text-muted-foreground">{info.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {s.totalProcessed === 0 && (
        <div className="glass rounded-xl p-6 flex flex-col items-center justify-center py-12 gap-3">
          <BarChart3 className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-muted-foreground">Nenhum dado para exibir</p>
          <p className="text-xs text-muted-foreground/60">Processe documentos para gerar relatórios.</p>
        </div>
      )}
    </div>
  );
}
