import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, CheckCircle2, Zap, TrendingUp } from "lucide-react";

export function StatsCards() {
  const stats = [
    {
      label: "Total de Arquivos",
      value: "0",
      change: "Faça upload para começar",
      icon: FileText,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Processados",
      value: "0",
      change: "Nenhum processado",
      icon: CheckCircle2,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Correções IA",
      value: "0",
      change: "Envie textos para corrigir",
      icon: Zap,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Melhoria",
      value: "0%",
      change: "vs. originais",
      icon: TrendingUp,
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className="glass rounded-xl p-5 card-hover"
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`${stat.bg} ${stat.color} p-2.5 rounded-lg`}>
              <stat.icon className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
          <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{stat.change}</p>
        </motion.div>
      ))}
    </div>
  );
}
