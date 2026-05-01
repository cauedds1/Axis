import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Building2, TrendingUp, CreditCard,
  MessageSquare, Mail, Brain, ClipboardList, Settings,
  ChevronLeft, ChevronRight, Search, Shield, Activity,
  Database, Zap, AlertTriangle, Check, X, RefreshCw, Trash2,
  Edit, LogOut, BarChart2, Phone, Server, Lock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { useLocation } from "wouter";

const NAV_ITEMS = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "users", icon: Users },
  { key: "organizations", icon: Building2 },
  { key: "finance", icon: TrendingUp },
  { key: "billing", icon: CreditCard },
  { key: "whatsapp", icon: MessageSquare },
  { key: "email", icon: Mail },
  { key: "ai", icon: Brain },
  { key: "audit", icon: ClipboardList },
  { key: "system", icon: Settings },
] as const;

type Section = typeof NAV_ITEMS[number]["key"];

const PLAN_OPTIONS = ["free", "starter", "pro", "team", "business", "enterprise"];
const PIE_COLORS = ["#7a9e8a", "#6b8fa0", "#a07a9e", "#9ea07a", "#7a8ea0", "#a09a7a"];

function StatCard({ label, value, sub, icon: Icon, color = "text-primary" }: {
  label: string; value: string | number; sub?: string; icon?: any; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-muted-foreground text-xs">{sub}</div>}
    </div>
  );
}

function Pagination({ page, total, limit, onPage }: { page: number; total: number; limit: number; onPage: (p: number) => void }) {
  const { t } = useTranslation("axisAdmin");
  const pages = Math.ceil(total / limit) || 1;
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
      <Button variant="ghost" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span>{t("common.page")} {page} {t("common.of")} {pages}</span>
      <Button variant="ghost" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-foreground mb-4">{children}</h2>;
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 border-b border-border">{children}</th>;
}

function Td({ children, className = "", colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-4 py-3 border-b border-border/40 ${className}`}>{children}</td>;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

// ─── SECTIONS ────────────────────────────────────────────────────────────────

function DashboardSection() {
  const { t } = useTranslation("axisAdmin");
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/stats"] });

  const stats = data?.stats ?? {};
  const health = stats.systemHealth ?? "healthy";

  const healthColor = health === "healthy" ? "text-green-400" : health === "degraded" ? "text-yellow-400" : "text-red-400";
  const healthLabel = t(`dashboard.${health}` as any, health);

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      <SectionTitle>{t("dashboard.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label={t("dashboard.totalUsers")} value={stats.totalUsers ?? 0} icon={Users} />
        <StatCard label={t("dashboard.activeToday")} value={stats.activeToday ?? 0} icon={Activity} color="text-green-400" />
        <StatCard label={t("dashboard.newUsersToday")} value={stats.newUsersToday ?? 0} icon={Zap} color="text-blue-400" />
        <StatCard label={t("dashboard.totalRevenue")} value={fmtCurrency(stats.totalRevenue)} icon={TrendingUp} color="text-emerald-400" />
        <StatCard label={t("dashboard.aiCalls")} value={stats.aiCalls30d ?? 0} icon={Brain} color="text-violet-400" />
        <StatCard label={t("dashboard.whatsappMessages")} value={stats.whatsappMessages30d ?? 0} icon={MessageSquare} color="text-green-400" />
        <StatCard label={t("dashboard.emailAlerts")} value={stats.emailAlerts30d ?? 0} icon={Mail} color="text-yellow-400" />
        <StatCard label={t("dashboard.systemHealth")} value={healthLabel} icon={Server} color={healthColor} />
      </div>
    </div>
  );
}

function UsersSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [page, setPage] = useState(1);
  const [editUser, setEditUser] = useState<any>(null);
  const [newPlan, setNewPlan] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);
  if (plan !== "all") params.set("plan", plan);
  const usersUrl = `/api/admin/users?${params.toString()}`;

  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/users", page, search, plan], queryFn: () => fetch(usersUrl, { credentials: "include" }).then(r => r.json()) });
  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  const updatePlan = useMutation({
    mutationFn: ({ id, plan }: { id: string; plan: string }) =>
      apiRequest("PATCH", `/api/admin/users/${id}/plan`, { plan }),
    onSuccess: () => {
      toast({ title: t("users.planUpdated") });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditUser(null);
    },
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/users/${id}`),
    onSuccess: () => {
      toast({ title: t("users.userDeleted") });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setConfirmDelete(null);
    },
  });

  return (
    <div className="space-y-4">
      <SectionTitle>{t("users.title")}</SectionTitle>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-user-search"
            className="pl-9"
            placeholder={t("users.search")}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={plan} onValueChange={v => { setPlan(v); setPage(1); }}>
          <SelectTrigger data-testid="select-plan-filter" className="w-40">
            <SelectValue placeholder={t("users.allPlans")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("users.allPlans")}</SelectItem>
            {PLAN_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th>{t("users.name")}</Th>
                <Th>{t("users.email")}</Th>
                <Th>{t("users.plan")}</Th>
                <Th>{t("users.createdAt")}</Th>
                <Th>{t("users.lastLogin")}</Th>
                <Th>{t("users.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><Td colSpan={6} className="text-center text-muted-foreground py-8">{t("common.noData")}</Td></tr>
              ) : users.map((u: any) => (
                <tr key={u.id} className="hover:bg-accent/30 transition-colors" data-testid={`row-user-${u.id}`}>
                  <Td><span className="font-medium text-foreground">{u.name ?? u.email?.split("@")[0]}</span></Td>
                  <Td className="text-muted-foreground">{u.email}</Td>
                  <Td>
                    <Badge variant="outline" className="text-xs capitalize">{u.plan ?? "free"}</Badge>
                  </Td>
                  <Td className="text-muted-foreground">{fmtDate(u.createdAt)}</Td>
                  <Td className="text-muted-foreground">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : t("users.never")}</Td>
                  <Td>
                    <div className="flex gap-2">
                      <Button
                        data-testid={`button-edit-plan-${u.id}`}
                        variant="ghost" size="sm"
                        onClick={() => { setEditUser(u); setNewPlan(u.plan ?? "free"); }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        data-testid={`button-delete-user-${u.id}`}
                        variant="ghost" size="sm"
                        onClick={() => setConfirmDelete(u)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={total} limit={20} onPage={setPage} />
        </>
      )}

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t("users.editPlan")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{editUser?.email}</div>
            <Label>{t("users.plan")}</Label>
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger data-testid="select-new-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)}>{t("common.cancel")}</Button>
            <Button
              data-testid="button-save-plan"
              onClick={() => updatePlan.mutate({ id: editUser.id, plan: newPlan })}
              disabled={updatePlan.isPending}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t("users.deleteUser")}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">{t("users.confirmDelete")}</div>
          <div className="font-medium text-foreground">{confirmDelete?.email}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>{t("common.cancel")}</Button>
            <Button
              data-testid="button-confirm-delete"
              variant="destructive"
              onClick={() => deleteUser.mutate(confirmDelete.id)}
              disabled={deleteUser.isPending}
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrgsSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/organizations", page], queryFn: () => fetch(`/api/admin/organizations?page=${page}&limit=20`, { credentials: "include" }).then(r => r.json()) });
  const orgs = data?.organizations ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <SectionTitle>{t("orgs.title")}</SectionTitle>
      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th>{t("orgs.name")}</Th>
                <Th>{t("orgs.owner")}</Th>
                <Th>{t("orgs.members")}</Th>
                <Th>{t("orgs.plan")}</Th>
                <Th>{t("orgs.createdAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <tr><Td colSpan={5} className="text-center text-muted-foreground py-8">{t("common.noData")}</Td></tr>
              ) : orgs.map((o: any) => (
                <tr key={o.id} className="hover:bg-accent/30 transition-colors" data-testid={`row-org-${o.id}`}>
                  <Td><span className="font-medium text-foreground">{o.name}</span></Td>
                  <Td className="text-muted-foreground">{o.ownerEmail}</Td>
                  <Td>{o.memberCount ?? 0}</Td>
                  <Td><Badge variant="outline" className="text-xs capitalize">{o.plan ?? "—"}</Badge></Td>
                  <Td className="text-muted-foreground">{fmtDate(o.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={total} limit={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function FinanceSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const { data: overview } = useQuery<any>({ queryKey: ["/api/admin/finance/overview"] });
  const { data: txData, isLoading } = useQuery<any>({ queryKey: ["/api/admin/finance/transactions", page], queryFn: () => fetch(`/api/admin/finance/transactions?page=${page}&limit=20`, { credentials: "include" }).then(r => r.json()) });

  const ov = overview ?? {};
  const chartData = (ov.byMonth ?? []).map((m: any) => ({
    month: m.month,
    [t("finance.revenue")]: m.revenue ?? 0,
    [t("finance.expenses")]: m.expenses ?? 0,
  }));

  return (
    <div className="space-y-6">
      <SectionTitle>{t("finance.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("finance.mrr")} value={fmtCurrency(ov.mrr)} icon={TrendingUp} color="text-emerald-400" />
        <StatCard label={t("finance.arr")} value={fmtCurrency(ov.arr)} icon={TrendingUp} color="text-blue-400" />
        <StatCard label={t("finance.totalRevenue")} value={fmtCurrency(ov.totalRevenue)} icon={BarChart2} color="text-violet-400" />
        <StatCard label={t("finance.avgTicket")} value={fmtCurrency(ov.avgTicket)} icon={CreditCard} />
      </div>

      {chartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-sm font-medium text-muted-foreground mb-3">{t("finance.revenueByMonth")}</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }} />
              <Bar dataKey={t("finance.revenue")} fill="#7a9e8a" radius={[3, 3, 0, 0]} />
              <Bar dataKey={t("finance.expenses")} fill="#9e7a7a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <div className="text-sm font-medium text-muted-foreground mb-2">{t("finance.recentTransactions")}</div>
        {isLoading ? (
          <div className="text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <>
            <TableWrapper>
              <thead>
                <tr>
                  <Th>{t("finance.user")}</Th>
                  <Th>{t("finance.description")}</Th>
                  <Th>{t("finance.amount")}</Th>
                  <Th>{t("finance.type")}</Th>
                  <Th>{t("finance.date")}</Th>
                </tr>
              </thead>
              <tbody>
                {(txData?.transactions ?? []).length === 0 ? (
                  <tr><Td colSpan={5} className="text-center text-muted-foreground py-8">{t("common.noData")}</Td></tr>
                ) : (txData?.transactions ?? []).map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-accent/30" data-testid={`row-tx-${tx.id}`}>
                    <Td className="text-muted-foreground text-xs">{tx.userEmail ?? "—"}</Td>
                    <Td className="font-medium">{tx.description}</Td>
                    <Td className={tx.type === "income" ? "text-emerald-400" : "text-red-400"}>
                      {fmtCurrency(tx.amount)}
                    </Td>
                    <Td>
                      <Badge variant="outline" className="text-xs capitalize">{tx.type}</Badge>
                    </Td>
                    <Td className="text-muted-foreground">{fmtDate(tx.date)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
            <Pagination page={page} total={txData?.total ?? 0} limit={20} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

function BillingSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const { data: overview } = useQuery<any>({ queryKey: ["/api/admin/billing/overview"] });
  const { data: subData, isLoading } = useQuery<any>({ queryKey: ["/api/admin/billing/subscriptions", page], queryFn: () => fetch(`/api/admin/billing/subscriptions?page=${page}&limit=20`, { credentials: "include" }).then(r => r.json()) });

  const ov = overview ?? {};

  return (
    <div className="space-y-6">
      <SectionTitle>{t("billing.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("billing.totalSubscriptions")} value={ov.totalSubscriptions ?? 0} icon={CreditCard} />
        <StatCard label={t("billing.activeSubscriptions")} value={ov.activeSubscriptions ?? 0} icon={Check} color="text-green-400" />
        <StatCard label={t("billing.mrrStripe")} value={fmtCurrency(ov.mrr)} icon={TrendingUp} color="text-emerald-400" />
        <StatCard label={t("billing.canceled")} value={ov.canceledSubscriptions ?? 0} icon={X} color="text-red-400" />
      </div>
      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th>{t("billing.customer")}</Th>
                <Th>{t("billing.plan")}</Th>
                <Th>{t("billing.status")}</Th>
                <Th>{t("billing.currentPeriodEnd")}</Th>
                <Th>{t("billing.amount")}</Th>
              </tr>
            </thead>
            <tbody>
              {(subData?.subscriptions ?? []).length === 0 ? (
                <tr><Td colSpan={5} className="text-center text-muted-foreground py-8">{t("common.noData")}</Td></tr>
              ) : (subData?.subscriptions ?? []).map((s: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-sub-${i}`}>
                  <Td className="text-muted-foreground">{s.customerEmail ?? s.customerId}</Td>
                  <Td className="capitalize">{s.planName ?? "—"}</Td>
                  <Td>
                    <Badge variant="outline" className={`text-xs capitalize ${s.status === "active" ? "border-green-500/40 text-green-400" : ""}`}>
                      {s.status}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">{fmtDate(s.currentPeriodEnd)}</Td>
                  <Td>{s.amount != null ? fmtCurrency(s.amount / 100) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={subData?.total ?? 0} limit={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function WhatsAppSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  const { data: configData, isLoading: configLoading } = useQuery<any>({ queryKey: ["/api/admin/whatsapp/config"] });
  const { data: logsData, isLoading: logsLoading } = useQuery<any>({ queryKey: ["/api/admin/whatsapp/logs", page], queryFn: () => fetch(`/api/admin/whatsapp/logs?page=${page}&limit=20`, { credentials: "include" }).then(r => r.json()) });

  const [botNumber, setBotNumber] = useState("");
  const [displayName, setDisplayName] = useState("");

  const cfg = configData?.config ?? {};
  const status = configData?.status ?? {};

  const saveConfig = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/whatsapp/config", { botNumber, displayName }),
    onSuccess: () => {
      toast({ title: t("whatsapp.saved") });
      qc.invalidateQueries({ queryKey: ["/api/admin/whatsapp/config"] });
    },
  });

  const isConnected = status.isConnected;

  return (
    <div className="space-y-6">
      <SectionTitle>{t("whatsapp.title")}</SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("whatsapp.connection")}</div>
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            <span className={`font-medium ${isConnected ? "text-green-400" : "text-red-400"}`}>
              {isConnected ? t("whatsapp.connected") : t("whatsapp.disconnected")}
            </span>
          </div>
          {status.connectedPhone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              {status.connectedPhone}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("whatsapp.config")}</div>
          {configLoading ? (
            <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">{t("whatsapp.botNumber")}</Label>
                <Input
                  data-testid="input-bot-number"
                  defaultValue={cfg.botNumber ?? ""}
                  onChange={e => setBotNumber(e.target.value)}
                  placeholder="+5511999999999"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{t("whatsapp.displayName")}</Label>
                <Input
                  data-testid="input-display-name"
                  defaultValue={cfg.displayName ?? ""}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="AXIS Bot"
                />
              </div>
              <Button
                data-testid="button-save-whatsapp-config"
                size="sm"
                onClick={() => saveConfig.mutate()}
                disabled={saveConfig.isPending}
              >
                {t("whatsapp.save")}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">{t("whatsapp.logs")}</div>
      {logsLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th>{t("whatsapp.sender")}</Th>
                <Th>{t("whatsapp.messageType")}</Th>
                <Th>{t("whatsapp.result")}</Th>
                <Th>{t("whatsapp.receivedAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {(logsData?.logs ?? []).length === 0 ? (
                <tr><Td colSpan={4} className="text-center text-muted-foreground py-8">{t("common.noData")}</Td></tr>
              ) : (logsData?.logs ?? []).map((l: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-wlog-${i}`}>
                  <Td className="text-muted-foreground font-mono text-xs">{l.senderPhone ?? "—"}</Td>
                  <Td><Badge variant="outline" className="text-xs">{l.messageType}</Badge></Td>
                  <Td className="text-sm max-w-xs truncate">{l.result ?? "—"}</Td>
                  <Td className="text-muted-foreground">{fmtDateTime(l.receivedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={logsData?.total ?? 0} limit={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function EmailLogsSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/email-logs", page], queryFn: () => fetch(`/api/admin/email-logs?page=${page}&limit=20`, { credentials: "include" }).then(r => r.json()) });
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <SectionTitle>{t("email.title")}</SectionTitle>
      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th>{t("email.to")}</Th>
                <Th>{t("email.subject")}</Th>
                <Th>{t("email.alertType")}</Th>
                <Th>{t("email.status")}</Th>
                <Th>{t("email.sentAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><Td colSpan={5} className="text-center text-muted-foreground py-8">{t("common.noData")}</Td></tr>
              ) : logs.map((l: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-email-${i}`}>
                  <Td className="text-muted-foreground text-xs">{l.toEmail}</Td>
                  <Td className="max-w-xs truncate">{l.subject}</Td>
                  <Td><Badge variant="outline" className="text-xs">{l.alertType}</Badge></Td>
                  <Td>
                    <Badge variant="outline" className={`text-xs ${l.status === "sent" ? "border-green-500/40 text-green-400" : "border-red-500/40 text-red-400"}`}>
                      {l.status === "sent" ? t("email.sent") : t("email.failed")}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">{fmtDateTime(l.sentAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={total} limit={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function AISection() {
  const { t } = useTranslation("axisAdmin");
  const { data: overview } = useQuery<any>({ queryKey: ["/api/admin/ai/overview"] });
  const { data: status } = useQuery<any>({ queryKey: ["/api/admin/ai/status"] });

  const ov = overview ?? {};
  const byType: any[] = ov.byType ?? [];
  const topUsers: any[] = ov.topUsers ?? [];

  return (
    <div className="space-y-6">
      <SectionTitle>{t("ai.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label={t("ai.totalCalls")} value={ov.totalCalls ?? 0} icon={Brain} color="text-violet-400" />
        <StatCard label={t("ai.status")} value={status?.available ? t("ai.yes") : t("ai.no")} icon={Zap} color={status?.available ? "text-green-400" : "text-red-400"} sub={status?.latencyMs ? `${status.latencyMs}ms` : undefined} />
        <StatCard label={t("ai.modelAvailable")} value={status?.model ?? "gpt-4o"} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {byType.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-sm font-medium text-muted-foreground mb-3">{t("ai.byType")}</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byType} dataKey="count" nameKey="callType" cx="50%" cy="50%" outerRadius={70} label={(e) => e.callType}>
                  {byType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {topUsers.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-sm font-medium text-muted-foreground mb-3">{t("ai.topUsers")}</div>
            <TableWrapper>
              <thead>
                <tr>
                  <Th>{t("ai.user")}</Th>
                  <Th>{t("ai.calls")}</Th>
                  <Th>{t("ai.tokens")}</Th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u: any, i: number) => (
                  <tr key={i} className="hover:bg-accent/30">
                    <Td className="text-muted-foreground text-xs">{u.email ?? u.userId}</Td>
                    <Td className="font-mono">{u.callCount}</Td>
                    <Td className="font-mono text-xs">{u.totalTokens ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          </div>
        )}
      </div>

      {byType.length > 0 && (
        <TableWrapper>
          <thead>
            <tr>
              <Th>{t("ai.callType")}</Th>
              <Th>{t("ai.count")}</Th>
              <Th>{t("ai.tokens")}</Th>
            </tr>
          </thead>
          <tbody>
            {byType.map((b: any, i: number) => (
              <tr key={i} className="hover:bg-accent/30">
                <Td><Badge variant="outline" className="text-xs">{b.callType}</Badge></Td>
                <Td className="font-mono">{b.count}</Td>
                <Td className="font-mono text-xs">{b.totalTokens ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrapper>
      )}
    </div>
  );
}

function AuditSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/audit-logs", page], queryFn: () => fetch(`/api/admin/audit-logs?page=${page}&limit=20`, { credentials: "include" }).then(r => r.json()) });
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <SectionTitle>{t("audit.title")}</SectionTitle>
      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th>{t("audit.actor")}</Th>
                <Th>{t("audit.action")}</Th>
                <Th>{t("audit.target")}</Th>
                <Th>{t("audit.targetId")}</Th>
                <Th>{t("audit.timestamp")}</Th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><Td colSpan={5} className="text-center text-muted-foreground py-8">{t("common.noData")}</Td></tr>
              ) : logs.map((l: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-audit-${i}`}>
                  <Td className="text-muted-foreground text-xs">{l.actorEmail ?? l.actorId ?? "—"}</Td>
                  <Td><Badge variant="outline" className="text-xs">{l.action}</Badge></Td>
                  <Td className="text-xs">{l.targetType ?? "—"}</Td>
                  <Td className="font-mono text-xs text-muted-foreground">{l.targetId ?? "—"}</Td>
                  <Td className="text-muted-foreground">{fmtDateTime(l.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={total} limit={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function SystemSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: healthData } = useQuery<any>({ queryKey: ["/api/admin/system/health"] });
  const { data: configData, isLoading: configLoading } = useQuery<any>({ queryKey: ["/api/admin/system/config"] });
  const { data: rateLimitData } = useQuery<any>({ queryKey: ["/api/admin/rate-limits/status"] });

  const [editConfig, setEditConfig] = useState<any>(null);
  const [editValue, setEditValue] = useState("");

  const health = healthData?.health ?? {};
  const configs = configData?.configs ?? [];
  const rateLimits = rateLimitData?.rateLimits ?? {};

  const maintenance = useMutation({
    mutationFn: (enable: boolean) => apiRequest("POST", "/api/admin/system/maintenance", { enable }),
    onSuccess: (_, enable) => {
      toast({ title: enable ? t("system.maintenanceEnabled") : t("system.maintenanceDisabled") });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/config"] });
    },
  });

  const updateConfig = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiRequest("POST", "/api/admin/system/config", { key, value }),
    onSuccess: () => {
      toast({ title: t("common.save") + " ✓" });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/config"] });
      setEditConfig(null);
    },
  });

  const seedDemo = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/demo/seed", {}),
    onSuccess: () => toast({ title: t("system.seeded") }),
  });

  const resetDemo = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/demo/reset", {}),
    onSuccess: () => toast({ title: t("system.reset") }),
  });

  const maintenanceEnabled = configs.find((c: any) => c.key === "maintenance_mode")?.value === "true";

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      <SectionTitle>{t("system.title")}</SectionTitle>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("system.uptime")} value={health.uptime != null ? formatUptime(health.uptime) : "—"} icon={Activity} color="text-green-400" />
        <StatCard label={t("system.memoryUsed")} value={health.memoryUsedMB != null ? `${health.memoryUsedMB} MB` : "—"} icon={Database} />
        <StatCard label={t("system.nodeVersion")} value={health.nodeVersion ?? "—"} icon={Server} />
        <StatCard label={t("system.dbConnected")} value={health.dbConnected ? t("ai.yes") : t("ai.no")} icon={Database} color={health.dbConnected ? "text-green-400" : "text-red-400"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("system.maintenance")}</div>
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${maintenanceEnabled ? "bg-yellow-400" : "bg-green-400"}`} />
            <span className="text-sm">{maintenanceEnabled ? "ON" : "OFF"}</span>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid="button-enable-maintenance"
              size="sm" variant="outline"
              onClick={() => maintenance.mutate(true)}
              disabled={maintenanceEnabled || maintenance.isPending}
            >
              {t("system.enable")}
            </Button>
            <Button
              data-testid="button-disable-maintenance"
              size="sm" variant="outline"
              onClick={() => maintenance.mutate(false)}
              disabled={!maintenanceEnabled || maintenance.isPending}
            >
              {t("system.disable")}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{t("system.demo")}</div>
          <div className="flex gap-2">
            <Button
              data-testid="button-seed-demo"
              size="sm" variant="outline"
              onClick={() => seedDemo.mutate()}
              disabled={seedDemo.isPending}
            >
              <Database className="h-3.5 w-3.5 mr-1" />
              {t("system.seedDemo")}
            </Button>
            <Button
              data-testid="button-reset-demo"
              size="sm" variant="outline"
              onClick={() => resetDemo.mutate()}
              disabled={resetDemo.isPending}
              className="text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {t("system.resetDemo")}
            </Button>
          </div>
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("system.config")}</div>
        {configLoading ? (
          <div className="text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <TableWrapper>
            <thead>
              <tr>
                <Th>{t("system.key")}</Th>
                <Th>{t("system.value")}</Th>
                <Th>{t("system.updatedAt")}</Th>
                <Th>{t("users.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {configs.length === 0 ? (
                <tr><Td colSpan={4} className="text-center text-muted-foreground py-8">{t("common.noData")}</Td></tr>
              ) : configs.map((c: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-config-${i}`}>
                  <Td className="font-mono text-xs">{c.key}</Td>
                  <Td className="font-mono text-xs max-w-xs truncate">{c.value ?? "—"}</Td>
                  <Td className="text-muted-foreground">{fmtDateTime(c.updatedAt)}</Td>
                  <Td>
                    <Button
                      data-testid={`button-edit-config-${i}`}
                      variant="ghost" size="sm"
                      onClick={() => { setEditConfig(c); setEditValue(c.value ?? ""); }}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        )}
      </div>

      {Object.keys(rateLimits).length > 0 && (
        <div>
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t("system.rateLimits")}</div>
          <TableWrapper>
            <thead>
              <tr>
                <Th>{t("system.key")}</Th>
                <Th>{t("system.window")}</Th>
                <Th>{t("system.max")}</Th>
                <Th>{t("system.description")}</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(rateLimits).map(([key, val]: [string, any]) => (
                <tr key={key} className="hover:bg-accent/30">
                  <Td className="font-mono text-xs">{key}</Td>
                  <Td className="text-muted-foreground">{val.windowMs / 1000}s</Td>
                  <Td>{val.max}</Td>
                  <Td className="text-muted-foreground text-xs">{val.description}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </div>
      )}

      <Dialog open={!!editConfig} onOpenChange={() => setEditConfig(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>{t("system.editConfig")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="font-mono text-xs">{editConfig?.key}</Label>
            <Textarea
              data-testid="textarea-config-value"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditConfig(null)}>{t("common.cancel")}</Button>
            <Button
              data-testid="button-save-config"
              onClick={() => updateConfig.mutate({ key: editConfig.key, value: editValue })}
              disabled={updateConfig.isPending}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MAIN PANEL ──────────────────────────────────────────────────────────────

export default function AdminPanel() {
  const { t, i18n } = useTranslation("axisAdmin");
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: statsCheck, isLoading: checkLoading, isError } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    retry: false,
  });

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "pt-BR" ? "en" : "pt-BR");
  };

  if (checkLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 animate-pulse" />
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (isError || !statsCheck) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Lock className="h-10 w-10 text-destructive mx-auto" />
          <div className="text-foreground font-semibold">Access Denied</div>
          <div className="text-muted-foreground text-sm">Admin access required.</div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/")}>← Back</Button>
        </div>
      </div>
    );
  }

  const renderSection = () => {
    switch (section) {
      case "dashboard": return <DashboardSection />;
      case "users": return <UsersSection />;
      case "organizations": return <OrgsSection />;
      case "finance": return <FinanceSection />;
      case "billing": return <BillingSection />;
      case "whatsapp": return <WhatsAppSection />;
      case "email": return <EmailLogsSection />;
      case "ai": return <AISection />;
      case "audit": return <AuditSection />;
      case "system": return <SystemSection />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex" data-testid="admin-panel">
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 bg-card border-r border-border flex flex-col overflow-hidden"
          >
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-bold text-sm tracking-tight">{t("title")}</span>
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {NAV_ITEMS.map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  data-testid={`nav-${key}`}
                  onClick={() => setSection(key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left
                    ${section === key
                      ? "bg-accent text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(`nav.${key}` as any)}
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-border space-y-1">
              <Button
                data-testid="button-toggle-lang"
                variant="ghost" size="sm" className="w-full justify-start text-xs"
                onClick={toggleLang}
              >
                {i18n.language === "pt-BR" ? "🇧🇷 PT-BR" : "🇺🇸 EN"}
              </Button>
              <Button
                data-testid="button-go-app"
                variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground"
                onClick={() => setLocation("/")}
              >
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Back to App
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-card/50 px-4 py-3 flex items-center gap-3 shrink-0">
          <Button
            data-testid="button-toggle-sidebar"
            variant="ghost" size="sm"
            onClick={() => setSidebarOpen(v => !v)}
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span className="font-medium text-foreground">{t(`nav.${section}` as any)}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
