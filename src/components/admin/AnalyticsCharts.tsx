import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { Activity, Wifi, Gauge, Users, TrendingUp, Signal } from "lucide-react";

interface UserSlim {
  is_blocked: boolean;
  conversions_used: number;
  display_name: string | null;
  email: string | null;
  role?: string;
  created_at: string;
}

interface Props {
  users: UserSlim[];
}

interface LatencyPoint {
  time: string;
  supabase: number;
  internet: number;
}

const COLORS = {
  primary: "hsl(217 91% 60%)",
  success: "hsl(142 71% 45%)",
  warning: "hsl(38 92% 50%)",
  destructive: "hsl(0 84% 60%)",
  muted: "hsl(215 16% 47%)",
  accent: "hsl(280 80% 65%)",
};

const PIE_COLORS = [COLORS.success, COLORS.destructive, COLORS.warning, COLORS.primary];
const ROLE_COLORS = [COLORS.destructive, COLORS.warning, COLORS.primary];

async function pingSupabase(): Promise<number> {
  const start = performance.now();
  try {
    await fetch("https://cjgjugrqhnvcpgmddeio.supabase.co/auth/v1/health", {
      method: "GET",
      cache: "no-store",
    });
    return Math.round(performance.now() - start);
  } catch {
    return -1;
  }
}

async function pingInternet(): Promise<number> {
  const start = performance.now();
  try {
    await fetch("https://www.cloudflare.com/cdn-cgi/trace", {
      method: "GET",
      cache: "no-store",
    });
    return Math.round(performance.now() - start);
  } catch {
    return -1;
  }
}

export function AnalyticsCharts({ users }: Props) {
  const [latency, setLatency] = useState<LatencyPoint[]>([]);
  const [currentSupabase, setCurrentSupabase] = useState(0);
  const [currentInternet, setCurrentInternet] = useState(0);

  useEffect(() => {
    let mounted = true;
    const measure = async () => {
      const [sb, net] = await Promise.all([pingSupabase(), pingInternet()]);
      if (!mounted) return;
      const time = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setCurrentSupabase(sb);
      setCurrentInternet(net);
      setLatency((prev) => {
        const next = [...prev, { time, supabase: Math.max(sb, 0), internet: Math.max(net, 0) }];
        return next.slice(-20);
      });
    };
    measure();
    const id = setInterval(measure, 4000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const userStatusData = useMemo(() => {
    const active = users.filter((u) => !u.is_blocked).length;
    const blocked = users.filter((u) => u.is_blocked).length;
    return [
      { name: "Ativos", value: active },
      { name: "Bloqueados", value: blocked },
    ];
  }, [users]);

  const rolesData = useMemo(() => {
    const counts: Record<string, number> = {};
    users.forEach((u) => {
      const r = u.role || "user";
      counts[r] = (counts[r] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [users]);

  const topUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => b.conversions_used - a.conversions_used)
      .slice(0, 6)
      .map((u) => ({
        name: (u.display_name || u.email || "?").split(" ")[0].slice(0, 10),
        conversoes: u.conversions_used,
      }));
  }, [users]);

  const signupsByDay = useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach((u) => {
      const d = new Date(u.created_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      });
      map[d] = (map[d] || 0) + 1;
    });
    return Object.entries(map)
      .slice(-7)
      .map(([date, total]) => ({ date, total }));
  }, [users]);

  const latencyStatus = (ms: number) => {
    if (ms < 0) return { label: "Offline", color: COLORS.destructive };
    if (ms < 150) return { label: "Excelente", color: COLORS.success };
    if (ms < 400) return { label: "Boa", color: COLORS.warning };
    return { label: "Lenta", color: COLORS.destructive };
  };

  const sbStatus = latencyStatus(currentSupabase);
  const netStatus = latencyStatus(currentInternet);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    fontSize: "12px",
  };

  const radialData = [
    {
      name: "Backend",
      value: Math.min(100, Math.max(0, 100 - currentSupabase / 10)),
      fill: sbStatus.color,
    },
    {
      name: "Internet",
      value: Math.min(100, Math.max(0, 100 - currentInternet / 10)),
      fill: netStatus.color,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Indicadores em tempo real */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-1">
            <Wifi className="w-4 h-4" style={{ color: sbStatus.color }} />
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: `${sbStatus.color}20`, color: sbStatus.color }}
            >
              {sbStatus.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {currentSupabase < 0 ? "—" : `${currentSupabase}ms`}
          </div>
          <div className="text-xs text-muted-foreground">Latência Backend</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-1">
            <Signal className="w-4 h-4" style={{ color: netStatus.color }} />
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: `${netStatus.color}20`, color: netStatus.color }}
            >
              {netStatus.label}
            </span>
          </div>
          <div className="text-2xl font-bold text-foreground">
            {currentInternet < 0 ? "—" : `${currentInternet}ms`}
          </div>
          <div className="text-xs text-muted-foreground">Latência Internet</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-1">
            <Users className="w-4 h-4 text-primary" />
            <TrendingUp className="w-3 h-3 text-success" />
          </div>
          <div className="text-2xl font-bold text-foreground">{users.length}</div>
          <div className="text-xs text-muted-foreground">Total Usuários</div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4"
        >
          <div className="flex items-center justify-between mb-1">
            <Activity className="w-4 h-4 text-warning" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {users.reduce((s, u) => s + u.conversions_used, 0)}
          </div>
          <div className="text-xs text-muted-foreground">Conversões totais</div>
        </motion.div>
      </div>

      {/* Latência em tempo real */}
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground text-sm">
            Latência em tempo real (ms)
          </h3>
          <span className="text-[10px] text-muted-foreground ml-auto">
            atualiza a cada 4s
          </span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={latency}>
            <defs>
              <linearGradient id="sbGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.5} />
                <stop offset="100%" stopColor={COLORS.primary} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.5} />
                <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={10} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Area
              type="monotone"
              dataKey="supabase"
              name="Backend"
              stroke={COLORS.primary}
              fill="url(#sbGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="internet"
              name="Internet"
              stroke={COLORS.accent}
              fill="url(#netGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Saúde da conexão (radial) + Status usuários (pizza) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <h3 className="font-display font-semibold text-foreground text-sm mb-3">
            Saúde da Conexão
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="30%"
              outerRadius="100%"
              barSize={14}
              data={radialData}
            >
              <RadialBar background dataKey="value" cornerRadius={8} />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: "11px" }}
                verticalAlign="bottom"
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(0)}%`} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-4">
          <h3 className="font-display font-semibold text-foreground text-sm mb-3">
            Status dos Usuários
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={userStatusData}
                cx="50%"
                cy="50%"
                outerRadius={70}
                dataKey="value"
                label={(e: any) => `${e.name}: ${e.value}`}
                labelLine={false}
                fontSize={11}
              >
                {userStatusData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Papéis (pizza) + Top usuários (barras) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <h3 className="font-display font-semibold text-foreground text-sm mb-3">
            Distribuição por Papel
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={rolesData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={75}
                dataKey="value"
                label={(e: any) => `${e.name}: ${e.value}`}
                labelLine={false}
                fontSize={11}
              >
                {rolesData.map((_, i) => (
                  <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="glass rounded-xl p-4">
          <h3 className="font-display font-semibold text-foreground text-sm mb-3">
            Top usuários (conversões)
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={topUsers}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
              <Bar dataKey="conversoes" fill={COLORS.primary} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cadastros recentes */}
      <div className="glass rounded-xl p-4">
        <h3 className="font-display font-semibold text-foreground text-sm mb-3">
          Cadastros recentes
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={signupsByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line
              type="monotone"
              dataKey="total"
              stroke={COLORS.success}
              strokeWidth={2}
              dot={{ r: 4, fill: COLORS.success }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
