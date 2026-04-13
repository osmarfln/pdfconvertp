import { motion } from "framer-motion";
import { BarChart3, PieChart, TrendingUp, FileText } from "lucide-react";

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Relatórios</h2>
        <p className="text-muted-foreground mt-1">
          Visualize estatísticas e métricas dos seus documentos processados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { title: "Documentos Processados", icon: FileText, value: "0", desc: "Total de arquivos processados" },
          { title: "Correções Realizadas", icon: TrendingUp, value: "0", desc: "Correções feitas pela IA" },
          { title: "Taxa de Melhoria", icon: BarChart3, value: "0%", desc: "Média de melhoria dos textos" },
          { title: "Tipos de Erro", icon: PieChart, value: "—", desc: "Distribuição de categorias" },
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
                <item.icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
            <p className="text-3xl font-display font-bold text-foreground">{item.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="glass rounded-xl p-6 flex flex-col items-center justify-center py-12 gap-3">
        <BarChart3 className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">Nenhum dado para exibir</p>
        <p className="text-xs text-muted-foreground/60">Processe documentos para gerar relatórios.</p>
      </div>
    </div>
  );
}
