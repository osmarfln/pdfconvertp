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
import { Activity, Wifi, Gauge, Users, TrendingUp, Signal, Bell, BellOff, Settings2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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

  // ===== Alertas configuráveis de latência =====
  const [alertsEnabled, setAlertsEnabled] = useState<boolean>(() => {
    return localStorage.getItem("lat_alerts_enabled") !== "0";
  });
  const [browserNotif, setBrowserNotif] = useState<boolean>(() => {
    return localStorage.getItem("lat_alerts_browser") === "1";
  });
  const [thresholdBackend, setThresholdBackend] = useState<number>(() => {
    return Number(localStorage.getItem("lat_threshold_backend")) || 500;
  });
  const [thresholdInternet, setThresholdInternet] = useState<number>(() => {
    return Number(localStorage.getItem("lat_threshold_internet")) || 800;
  });
  const [alertHistory, setAlertHistory] = useState<
    { time: string; type: "Backend" | "Internet"; value: number; threshold: number }[]
  >([]);
  const lastAlertRef = useState<{ sb: number; net: number }>({ sb: 0, net: 0 })[0];

  useEffect(() => {
    localStorage.setItem("lat_alerts_enabled", alertsEnabled ? "1" : "0");
  }, [alertsEnabled]);
  useEffect(() => {
    localStorage.setItem("lat_alerts_browser", browserNotif ? "1" : "0");
    if (browserNotif && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [browserNotif]);
  useEffect(() => {
    localStorage.setItem("lat_threshold_backend", String(thresholdBackend));
  }, [thresholdBackend]);
  useEffect(() => {
    localStorage.setItem("lat_threshold_internet", String(thresholdInternet));
  }, [thresholdInternet]);

  const fireAlert = (type: "Backend" | "Internet", value: number, threshold: number) => {
    const now = Date.now();
    const key = type === "Backend" ? "sb" : "net";
    // Deduplica: 1 alerta por tipo a cada 30s
    if (now - (lastAlertRef as any)[key] < 30000) return;
    (lastAlertRef as any)[key] = now;

    toast.warning(`Latência alta — ${type}`, {
      description: `${value}ms (limite ${threshold}ms). Conexão pode estar degradada.`,
      icon: <AlertTriangle className="w-4 h-4" />,
    });

    setAlertHistory((prev) =>
      [
        {
          time: new Date().toLocaleTimeString("pt-BR"),
          type,
          value,
          threshold,
        },
        ...prev,
      ].slice(0, 8)
    );

    if (browserNotif && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(`Latência alta — ${type}`, {
          body: `${value}ms acima do limite (${threshold}ms)`,
          icon: "/favicon.ico",
        });
      } catch {
        /* ignore */
      }
    }
  };

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

      if (alertsEnabled) {
        if (sb > 0 && sb > thresholdBackend) fireAlert("Backend", sb, thresholdBackend);
        if (net > 0 && net > thresholdInternet) fireAlert("Internet", net, thresholdInternet);
        if (sb < 0) fireAlert("Backend", 0, thresholdBackend);
        if (net < 0) fireAlert("Internet", 0, thresholdInternet);
      }
    };
    measure();
    const id = setInterval(measure, 4000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [alertsEnabled, thresholdBackend, thresholdInternet, browserNotif]);

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

      {/* Configuração de alertas de latência */}
      <div className="glass rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Settings2 className="w-4 h-4 text-primary" />
          <h3 className="font-display font-semibold text-foreground text-sm">
            Alertas de latência
          </h3>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {alertsEnabled ? (
                <Bell className="w-3.5 h-3.5 text-success" />
              ) : (
                <BellOff className="w-3.5 h-3.5 text-muted-foreground" />
              )}
              <Label htmlFor="alerts-on" className="text-xs cursor-pointer">
                Ativar alertas
              </Label>
              <Switch
                id="alerts-on"
                checked={alertsEnabled}
                onCheckedChange={setAlertsEnabled}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="alerts-browser" className="text-xs cursor-pointer">
                Notificações do navegador
              </Label>
              <Switch
                id="alerts-browser"
                checked={browserNotif}
                onCheckedChange={setBrowserNotif}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Limite Backend (ms) — atual: <span className="text-foreground font-semibold">{currentSupabase < 0 ? "—" : `${currentSupabase}ms`}</span>
            </Label>
            <Input
              type="number"
              min={50}
              max={10000}
              value={thresholdBackend}
              onChange={(e) => setThresholdBackend(Math.max(50, Number(e.target.value) || 0))}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Limite Internet (ms) — atual: <span className="text-foreground font-semibold">{currentInternet < 0 ? "—" : `${currentInternet}ms`}</span>
            </Label>
            <Input
              type="number"
              min={50}
              max={10000}
              value={thresholdInternet}
              onChange={(e) => setThresholdInternet(Math.max(50, Number(e.target.value) || 0))}
              className="h-8 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              setThresholdBackend(500);
              setThresholdInternet(800);
              toast.success("Limites restaurados ao padrão");
            }}
          >
            Restaurar padrão
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => {
              fireAlert("Backend", currentSupabase, thresholdBackend);
            }}
          >
            Testar alerta
          </Button>
          {alertHistory.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs ml-auto"
              onClick={() => setAlertHistory([])}
            >
              Limpar histórico
            </Button>
          )}
        </div>

        {alertHistory.length > 0 && (
          <div className="rounded-lg border border-border bg-secondary/20 p-2 max-h-40 overflow-auto">
            <div className="text-[10px] text-muted-foreground mb-1 px-1">
              Últimos alertas disparados
            </div>
            <ul className="space-y-1">
              {alertHistory.map((a, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-destructive/5"
                >
                  <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                  <span className="text-muted-foreground">{a.time}</span>
                  <span className="font-medium text-foreground">{a.type}</span>
                  <span className="ml-auto text-destructive font-semibold">
                    {a.value}ms
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    (limite {a.threshold}ms)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
