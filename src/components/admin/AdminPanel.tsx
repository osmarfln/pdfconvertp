import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Activity,
  Trash2,
  Eye,
  X,
  BarChart3,
} from "lucide-react";
import { AnalyticsCharts } from "./AnalyticsCharts";
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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  is_blocked: boolean;
  conversions_used: number;
  created_at: string;
  updated_at: string;
  role?: string;
}

const roleColors: Record<string, string> = {
  admin: "bg-destructive/20 text-destructive",
  moderator: "bg-warning/20 text-warning",
  user: "bg-muted text-muted-foreground",
};

export function AdminPanel() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar usuários", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch roles for each user
    const { data: roles } = await supabase.from("user_roles").select("*");

    const usersWithRoles = (profiles || []).map((p) => {
      const userRole = roles?.find((r) => r.user_id === p.user_id);
      return { ...p, role: userRole?.role || "user" };
    });

    setUsers(usersWithRoles);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();

    // Realtime: refresh user list whenever a profile changes or a new login is recorded
    const channel = supabase
      .channel("admin-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => fetchUsers(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "user_logins" },
        () => fetchUsers(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = users.filter(
    (u) =>
      (u.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggleBlock = async (userId: string, currentlyBlocked: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_blocked: !currentlyBlocked })
      .eq("user_id", userId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.user_id === userId ? { ...u, is_blocked: !currentlyBlocked } : u
      )
    );
    toast({ title: currentlyBlocked ? "Usuário desbloqueado" : "Usuário bloqueado" });
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;
    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    setUsers((prev) => prev.filter((u) => u.user_id !== userId));
    toast({ title: "Usuário excluído" });
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => !u.is_blocked).length;
  const blockedUsers = users.filter((u) => u.is_blocked).length;
  const totalConversions = users.reduce((sum, u) => sum + u.conversions_used, 0);

  const systemStats = [
    { label: "Total de Usuários", value: String(totalUsers), icon: Users, color: "text-primary" },
    { label: "Usuários Ativos", value: String(activeUsers), icon: Activity, color: "text-success" },
    { label: "Conversões Total", value: String(totalConversions), icon: CheckCircle2, color: "text-warning" },
    { label: "Bloqueados", value: String(blockedUsers), icon: Ban, color: "text-destructive" },
  ];

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
          <TabsTrigger value="analytics" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <BarChart3 className="w-4 h-4 mr-1.5" />
            Analytics
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

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <AnalyticsCharts users={users} />
        </TabsContent>

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
            <Button variant="glass" size="sm" onClick={fetchUsers}>
              Atualizar
            </Button>
          </div>

          <div className="glass rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-muted-foreground">Carregando usuários...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Users className="w-10 h-10 text-muted-foreground/30" />
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead>Usuário</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Conversões</TableHead>
                    <TableHead>Cadastro</TableHead>
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
                                {(user.display_name || user.email || "U")[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-foreground text-sm">{user.display_name || "Sem nome"}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={roleColors[user.role || "user"]}>
                          {user.role || "user"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {!user.is_blocked ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-destructive" />
                          )}
                          <span className={`text-xs ${!user.is_blocked ? "text-success" : "text-destructive"}`}>
                            {!user.is_blocked ? "Ativo" : "Bloqueado"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {user.conversions_used}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card border-border">
                            <DropdownMenuItem onClick={() => setSelectedUser(user)}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => toggleBlock(user.user_id, user.is_blocked)}
                              className={user.is_blocked ? "text-success" : "text-destructive"}
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              {user.is_blocked ? "Desbloquear" : "Bloquear"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteUser(user.user_id)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
                  "Alterar permissões",
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
                  "Upload de arquivos",
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
                  { label: "OCR Engine", value: "Tesseract" },
                  { label: "Timeout", value: "120s" },
                  { label: "Formatos suportados", value: "PDF, DOCX, XLSX, JPG, PNG" },
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

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass rounded-2xl p-6 w-full max-w-md space-y-4 border border-border"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-foreground">Detalhes do Usuário</h3>
                <button onClick={() => setSelectedUser(null)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  {selectedUser.role === "admin" ? (
                    <Crown className="w-6 h-6 text-warning" />
                  ) : (
                    <span className="text-lg font-bold text-foreground">
                      {(selectedUser.display_name || selectedUser.email || "U")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedUser.display_name || "Sem nome"}</p>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    📱 {(selectedUser as any).phone || "Sem telefone"}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                {[
                  { label: "ID", value: selectedUser.user_id },
                  { label: "Telefone", value: (selectedUser as any).phone || "Não informado" },
                  { label: "Papel", value: selectedUser.role || "user" },
                  { label: "Status", value: selectedUser.is_blocked ? "Bloqueado" : "Ativo" },
                  { label: "Conversões", value: String(selectedUser.conversions_used) },
                  { label: "Cadastro", value: new Date(selectedUser.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                  { label: "Última atualização", value: new Date(selectedUser.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-foreground font-medium text-right max-w-[60%] truncate">{item.value}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="glass"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    toggleBlock(selectedUser.user_id, selectedUser.is_blocked);
                    setSelectedUser(null);
                  }}
                >
                  <Ban className="w-4 h-4 mr-1" />
                  {selectedUser.is_blocked ? "Desbloquear" : "Bloquear"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    deleteUser(selectedUser.user_id);
                    setSelectedUser(null);
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Excluir
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
