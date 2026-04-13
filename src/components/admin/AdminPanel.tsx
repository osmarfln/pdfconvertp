import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Shield,
  Ban,
  Search,
  MoreVertical,
  Crown,
  CheckCircle2,
  XCircle,
  Settings,
  BarChart3,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Mock data
const mockUsers = [
  {
    id: "1",
    name: "Osmar",
    email: "osmarfln@gmail.com",
    role: "admin",
    plan: "business",
    status: "active",
    conversions: 142,
    lastLogin: "2026-04-13",
    createdAt: "2026-01-15",
  },
  {
    id: "2",
    name: "João Silva",
    email: "joao@email.com",
    role: "user",
    plan: "pro",
    status: "active",
    conversions: 87,
    lastLogin: "2026-04-12",
    createdAt: "2026-02-20",
  },
  {
    id: "3",
    name: "Maria Santos",
    email: "maria@email.com",
    role: "user",
    plan: "free",
    status: "active",
    conversions: 4,
    lastLogin: "2026-04-10",
    createdAt: "2026-03-01",
  },
  {
    id: "4",
    name: "Carlos Pereira",
    email: "carlos@email.com",
    role: "user",
    plan: "free",
    status: "blocked",
    conversions: 0,
    lastLogin: "2026-03-15",
    createdAt: "2026-03-10",
  },
  {
    id: "5",
    name: "Ana Costa",
    email: "ana@email.com",
    role: "moderator",
    plan: "pro",
    status: "active",
    conversions: 56,
    lastLogin: "2026-04-11",
    createdAt: "2026-02-05",
  },
];

const systemStats = [
  { label: "Total de Usuários", value: "1.247", icon: Users, color: "text-primary" },
  { label: "Usuários Ativos", value: "892", icon: Activity, color: "text-success" },
  { label: "Conversões Hoje", value: "342", icon: BarChart3, color: "text-warning" },
  { label: "Bloqueados", value: "12", icon: Ban, color: "text-destructive" },
];

const planColors: Record<string, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-primary/20 text-primary",
  business: "bg-warning/20 text-warning",
};

const roleColors: Record<string, string> = {
  admin: "bg-destructive/20 text-destructive",
  moderator: "bg-warning/20 text-warning",
  user: "bg-muted text-muted-foreground",
};

export function AdminPanel() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState(mockUsers);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const toggleBlock = (id: string) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? { ...u, status: u.status === "blocked" ? "active" : "blocked" }
          : u
      )
    );
  };

  const changeRole = (id: string, role: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
  };

  const changePlan = (id: string, plan: string) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, plan } : u)));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">
          Painel Administrativo
        </h2>
        <p className="text-muted-foreground mt-1">
          Gerencie usuários, permissões e configurações da plataforma.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {systemStats.map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="w-4 h-4 mr-1.5" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="permissions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Shield className="w-4 h-4 mr-1.5" />
            Permissões
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Settings className="w-4 h-4 mr-1.5" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-secondary border-border"
              />
            </div>
          </div>

          <div className="glass rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Conversões</TableHead>
                  <TableHead>Último Login</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          {user.role === "admin" ? (
                            <Crown className="w-4 h-4 text-warning" />
                          ) : (
                            <span className="text-xs font-medium text-foreground">
                              {user.name[0]}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-foreground text-sm">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={roleColors[user.role]}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={planColors[user.plan]}>
                        {user.plan}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {user.status === "active" ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                        <span className={`text-xs ${user.status === "active" ? "text-success" : "text-destructive"}`}>
                          {user.status === "active" ? "Ativo" : "Bloqueado"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.conversions}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.lastLogin}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border-border">
                          <DropdownMenuItem onClick={() => changeRole(user.id, "admin")}>
                            <Shield className="w-4 h-4 mr-2" /> Tornar Admin
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changeRole(user.id, "moderator")}>
                            <Shield className="w-4 h-4 mr-2" /> Tornar Moderador
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changeRole(user.id, "user")}>
                            <Users className="w-4 h-4 mr-2" /> Tornar Usuário
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => changePlan(user.id, "free")}>
                            Plano Free
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changePlan(user.id, "pro")}>
                            Plano Pro
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changePlan(user.id, "business")}>
                            Plano Business
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => toggleBlock(user.id)}
                            className={user.status === "blocked" ? "text-success" : "text-destructive"}
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            {user.status === "blocked" ? "Desbloquear" : "Bloquear"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                role: "Admin",
                color: "text-destructive",
                permissions: [
                  "Gerenciar todos os usuários",
                  "Alterar planos e permissões",
                  "Bloquear/desbloquear contas",
                  "Visualizar relatórios do sistema",
                  "Configurar integrações",
                  "Acesso total à plataforma",
                ],
              },
              {
                role: "Moderador",
                color: "text-warning",
                permissions: [
                  "Visualizar todos os usuários",
                  "Revisar documentos reportados",
                  "Bloquear contas com abuso",
                  "Acessar logs de processamento",
                ],
              },
              {
                role: "Usuário",
                color: "text-muted-foreground",
                permissions: [
                  "Upload de arquivos (conforme plano)",
                  "Conversão de documentos",
                  "Correção com IA",
                  "Download de arquivos",
                ],
              },
            ].map((item) => (
              <motion.div
                key={item.role}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-5"
              >
                <h3 className={`font-display font-semibold text-lg mb-3 ${item.color}`}>
                  {item.role}
                </h3>
                <ul className="space-y-2">
                  {item.permissions.map((perm) => (
                    <li key={perm} className="flex items-start gap-2 text-sm text-foreground/80">
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${item.color}`} />
                      {perm}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                title: "Limites por Plano",
                items: [
                  { label: "Free: conversões/mês", value: "5" },
                  { label: "Pro: conversões/mês", value: "100" },
                  { label: "Business: conversões/mês", value: "Ilimitado" },
                ],
              },
              {
                title: "Segurança",
                items: [
                  { label: "Exclusão automática de arquivos", value: "24h" },
                  { label: "Tamanho máximo de upload", value: "50MB" },
                  { label: "Tentativas de login", value: "5" },
                ],
              },
              {
                title: "Processamento",
                items: [
                  { label: "Workers ativos", value: "4" },
                  { label: "Fila de processamento", value: "Redis" },
                  { label: "Timeout", value: "120s" },
                ],
              },
              {
                title: "Integrações",
                items: [
                  { label: "iLovePDF API", value: "Ativo ✅" },
                  { label: "Modelo de IA", value: "GPT-4o" },
                  { label: "OCR Engine", value: "Tesseract" },
                ],
              },
            ].map((section) => (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-xl p-5"
              >
                <h3 className="font-display font-semibold text-foreground mb-3">
                  {section.title}
                </h3>
                <div className="space-y-3">
                  {section.items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <span className="text-sm font-medium text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
