import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Building2, TrendingUp, CreditCard,
  MessageSquare, Mail, Brain, ClipboardList, Settings,
  ChevronLeft, ChevronRight, Search, Shield, Activity,
  Database, Zap, Check, X, Trash2, Edit, LogOut, BarChart2,
  Phone, Server, Lock, AlertTriangle,
  KeyRound, UserX, UserCheck, UserCog, ExternalLink
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

const PLAN_OPTIONS = ["starter", "personal_ai", "team"];
const PIE_COLORS = ["#7a9e8a", "#6b8fa0", "#a07a9e", "#9ea07a", "#7a8ea0", "#a09a7a"];

function StatCard({ label, value, sub, icon: Icon, color = "text-foreground" }: {
  label: string; value: string | number; sub?: string; icon?: any; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
        {Icon && <Icon className={`h-3.5 w-3.5 ${color}`} />}
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value ?? "—"}</div>
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

function SubTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{children}</div>;
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function Th({ children, className = "", onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <th
      className={`text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 border-b border-border ${onClick ? "cursor-pointer select-none hover:text-foreground transition-colors" : ""} ${className}`}
      onClick={onClick}
    >{children}</th>
  );
}

function Td({ children, className = "", colSpan, onClick }: { children: React.ReactNode; className?: string; colSpan?: number; onClick?: (e: React.MouseEvent) => void }) {
  return <td colSpan={colSpan} onClick={onClick} className={`px-4 py-3 border-b border-border/40 ${className}`}>{children}</td>;
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><Td colSpan={colSpan} className="text-center text-muted-foreground py-8">{label}</Td></tr>;
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; }
}

function fmtDateTime(s: string | null | undefined) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function userName(row: any) {
  const fn = row.first_name ?? row.firstName ?? "";
  const ln = row.last_name ?? row.lastName ?? "";
  return (fn + " " + ln).trim() || row.email?.split("@")[0] || "—";
}

function adminFetch(url: string) {
  return fetch(url, { credentials: "include" }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });
}

// ─── SECTIONS ────────────────────────────────────────────────────────────────

function DashboardSection() {
  const { t } = useTranslation("axisAdmin");
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/admin/stats"] });

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!data) return <div className="text-muted-foreground">{t("common.error")}</div>;

  return (
    <div className="space-y-6">
      <SectionTitle>{t("dashboard.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("dashboard.totalUsers")} value={data.users?.total ?? 0} icon={Users} />
        <StatCard label={t("dashboard.activeToday")} value={data.activeUsers?.last7d ?? 0} icon={Activity} color="text-green-400" sub="last 7d" />
        <StatCard label={t("dashboard.newUsersToday")} value={data.users?.newToday ?? 0} icon={Zap} color="text-blue-400" />
        <StatCard label="Organizations" value={data.organizations?.total ?? 0} icon={Building2} color="text-violet-400" />
        <StatCard label={t("dashboard.aiCalls")} value={data.aiCalls30d ?? 0} icon={Brain} color="text-violet-400" />
        <StatCard label={t("dashboard.whatsappMessages")} value={data.whatsappMessages30d ?? 0} icon={MessageSquare} color="text-green-400" />
        <StatCard label={t("dashboard.emailAlerts")} value={data.emailAlerts30d ?? 0} icon={Mail} color="text-yellow-400" />
        <StatCard label="Transactions" value={data.transactions?.total ?? 0} icon={TrendingUp} color="text-emerald-400" />
      </div>

      {(data.dailySignups ?? []).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <SubTitle>Daily Signups (30d)</SubTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.dailySignups}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={s => s?.slice(5) ?? s} />
              <YAxis tick={{ fontSize: 10, fill: "#888" }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }} />
              <Bar dataKey="count" fill="#7a9e8a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
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
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [editUser, setEditUser] = useState<any>(null);
  const [newPlan, setNewPlan] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<any>(null);
  const [confirmResetPw, setConfirmResetPw] = useState<any>(null);
  const [viewUser, setViewUser] = useState<any>(null);

  const params = new URLSearchParams({ page: String(page), limit: "20", sortBy, sortDir });
  if (search) params.set("search", search);
  if (plan !== "all") params.set("plan", plan);

  const { data: userDetail, isLoading: userDetailLoading } = useQuery<any>({
    queryKey: ["/api/admin/users", viewUser?.id],
    queryFn: () => viewUser ? adminFetch(`/api/admin/users/${viewUser.id}`) : null,
    enabled: !!viewUser,
  });

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/users", page, search, plan, sortBy, sortDir],
    queryFn: () => adminFetch(`/api/admin/users?${params.toString()}`),
  });

  const rows: any[] = data?.users ?? [];
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

  const deactivateUser = useMutation({
    mutationFn: ({ id, deactivated }: { id: string; deactivated: boolean }) =>
      apiRequest("POST", `/api/admin/users/${id}/${deactivated ? "reactivate" : "deactivate"}`),
    onSuccess: (_data, vars) => {
      toast({ title: vars.deactivated ? t("users.reactivated") : t("users.deactivated") });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setConfirmDeactivate(null);
    },
    onError: (err: any) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/users/${id}/reset-password`),
    onSuccess: () => {
      toast({ title: t("users.passwordReset") });
      setConfirmResetPw(null);
    },
    onError: (err: any) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
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
                <Th className="cursor-pointer hover:text-foreground" onClick={() => toggleSort("first_name")}>{t("users.name")} {sortBy === "first_name" ? (sortDir === "asc" ? "↑" : "↓") : ""}</Th>
                <Th className="cursor-pointer hover:text-foreground" onClick={() => toggleSort("email")}>{t("users.email")} {sortBy === "email" ? (sortDir === "asc" ? "↑" : "↓") : ""}</Th>
                <Th className="cursor-pointer hover:text-foreground" onClick={() => toggleSort("plan")}>{t("users.plan")} {sortBy === "plan" ? (sortDir === "asc" ? "↑" : "↓") : ""}</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th className="cursor-pointer hover:text-foreground" onClick={() => toggleSort("last_login_at")}>{t("users.lastLogin")} {sortBy === "last_login_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}</Th>
                <Th className="cursor-pointer hover:text-foreground" onClick={() => toggleSort("created_at")}>{t("users.createdAt")} {sortBy === "created_at" ? (sortDir === "asc" ? "↑" : "↓") : ""}</Th>
                <Th>{t("users.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={8} label={t("common.noData")} />
              ) : rows.map((u: any) => {
                const isDeactivated = !!(u.deactivated_at ?? u.deactivatedAt);
                return (
                <tr key={u.id} className={`hover:bg-accent/30 transition-colors cursor-pointer ${isDeactivated ? "opacity-60" : ""}`} data-testid={`row-user-${u.id}`} onClick={() => setViewUser(u)}>
                  <Td><span className="font-medium text-foreground">{userName(u)}</span></Td>
                  <Td className="text-muted-foreground text-xs">{u.email}</Td>
                  <Td><Badge variant="outline" className="text-xs capitalize">{u.plan ?? "free"}</Badge></Td>
                  <Td className="text-muted-foreground text-xs capitalize">{u.account_type ?? u.accountType ?? "—"}</Td>
                  <Td>
                    {isDeactivated
                      ? <Badge variant="destructive" className="text-xs">Deactivated</Badge>
                      : <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/40">Active</Badge>
                    }
                  </Td>
                  <Td className="text-muted-foreground text-xs">{u.last_login_at ? fmtDateTime(u.last_login_at) : t("users.never")}</Td>
                  <Td className="text-muted-foreground">{fmtDate(u.created_at ?? u.createdAt)}</Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button
                        data-testid={`button-edit-plan-${u.id}`}
                        variant="ghost" size="sm" title={t("users.editPlan")}
                        onClick={e => { e.stopPropagation(); setEditUser(u); setNewPlan(u.plan ?? "starter"); }}
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        data-testid={`button-reset-pw-${u.id}`}
                        variant="ghost" size="sm" title={t("users.resetPassword")}
                        onClick={e => { e.stopPropagation(); setConfirmResetPw(u); }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        data-testid={`button-deactivate-${u.id}`}
                        variant="ghost" size="sm"
                        title={isDeactivated ? t("users.reactivate") : t("users.deactivate")}
                        onClick={e => { e.stopPropagation(); setConfirmDeactivate(u); }}
                        className={isDeactivated ? "text-emerald-400 hover:text-emerald-400" : "text-amber-400 hover:text-amber-400"}
                      >
                        {isDeactivated ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        data-testid={`button-delete-user-${u.id}`}
                        variant="ghost" size="sm" title={t("common.delete")}
                        onClick={e => { e.stopPropagation(); setConfirmDelete(u); }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Td>
                </tr>
                );
              })}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={total} limit={20} onPage={setPage} />
        </>
      )}

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("users.editPlan")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">{editUser?.email}</div>
            <Label>{t("users.plan")}</Label>
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger data-testid="select-new-plan"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-save-plan" onClick={() => updatePlan.mutate({ id: editUser.id, plan: newPlan })} disabled={updatePlan.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("users.deleteUser")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("users.confirmDelete")}</div>
          <div className="font-medium text-foreground">{confirmDelete?.email}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-delete" variant="destructive" onClick={() => deleteUser.mutate(confirmDelete.id)} disabled={deleteUser.isPending}>{t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDeactivate} onOpenChange={() => setConfirmDeactivate(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {confirmDeactivate && !!(confirmDeactivate.deactivated_at ?? confirmDeactivate.deactivatedAt)
                ? t("users.reactivate") : t("users.deactivate")}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {confirmDeactivate && !!(confirmDeactivate.deactivated_at ?? confirmDeactivate.deactivatedAt)
              ? "This will restore the user's access to AXIS."
              : "This will block the user from logging in."}
          </div>
          <div className="font-medium text-foreground">{confirmDeactivate?.email}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeactivate(null)}>{t("common.cancel")}</Button>
            <Button
              data-testid="button-confirm-deactivate"
              variant={confirmDeactivate && !!(confirmDeactivate.deactivated_at ?? confirmDeactivate.deactivatedAt) ? "default" : "destructive"}
              onClick={() => confirmDeactivate && deactivateUser.mutate({ id: confirmDeactivate.id, deactivated: !!(confirmDeactivate.deactivated_at ?? confirmDeactivate.deactivatedAt) })}
              disabled={deactivateUser.isPending}
            >
              {confirmDeactivate && !!(confirmDeactivate.deactivated_at ?? confirmDeactivate.deactivatedAt) ? t("users.reactivate") : t("users.deactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmResetPw} onOpenChange={() => setConfirmResetPw(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("users.resetPassword")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">A temporary password will be generated and emailed to the user.</div>
          <div className="font-medium text-foreground">{confirmResetPw?.email}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmResetPw(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-reset-pw" onClick={() => confirmResetPw && resetPassword.mutate(confirmResetPw.id)} disabled={resetPassword.isPending}>{t("users.resetPassword")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── User Details Drawer ─────────────────────────────────────────── */}
      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>{userName(viewUser)} — {t("users.title")}</DialogTitle>
          </DialogHeader>
          {userDetailLoading ? (
            <div className="text-muted-foreground py-4">{t("common.loading")}</div>
          ) : userDetail ? (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Email</div>
                  <div className="font-medium text-sm">{userDetail.user?.email}</div>
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Plan</div>
                  <div className="font-medium text-sm capitalize">{userDetail.user?.plan ?? "—"}</div>
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Account Type</div>
                  <div className="font-medium text-sm capitalize">{userDetail.user?.account_type ?? userDetail.user?.accountType ?? "—"}</div>
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="font-medium text-sm">{userDetail.user?.deactivated_at ?? userDetail.user?.deactivatedAt ? "Deactivated" : "Active"}</div>
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Transactions</div>
                  <div className="font-medium text-sm">{userDetail.stats?.transactions ?? 0}</div>
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Habits</div>
                  <div className="font-medium text-sm">{userDetail.stats?.habits ?? 0}</div>
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Tasks</div>
                  <div className="font-medium text-sm">{userDetail.stats?.tasks ?? 0}</div>
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Discipline Score</div>
                  <div className="font-medium text-sm">{userDetail.profile?.disciplineScore ?? userDetail.profile?.discipline_score ?? "—"}/10</div>
                </div>
              </div>
              {userDetail.user?.stripeSubscriptionId && (
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Stripe Subscription</div>
                  <a href={`https://dashboard.stripe.com/subscriptions/${userDetail.user.stripeSubscriptionId}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">{userDetail.user.stripeSubscriptionId}</a>
                </div>
              )}
              {userDetail.recentTransactions?.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">Recent Transactions</div>
                  <div className="space-y-1">
                    {userDetail.recentTransactions.slice(0, 5).map((tx: any) => (
                      <div key={tx.id} className="flex justify-between text-xs text-muted-foreground bg-background/30 rounded px-3 py-2">
                        <span>{tx.description ?? "—"}</span>
                        <span className={tx.type === "expense" ? "text-red-400" : "text-emerald-400"}>{fmtCurrency(tx.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">Joined: {fmtDate(userDetail.user?.created_at ?? userDetail.user?.createdAt)}</div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewUser(null)}>{t("common.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OrgsSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [confirmImpersonate, setConfirmImpersonate] = useState<any>(null);
  const [viewOrg, setViewOrg] = useState<any>(null);
  const navigate = useLocation()[1];

  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) params.set("search", search);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/organizations", page, search],
    queryFn: () => adminFetch(`/api/admin/organizations?${params.toString()}`),
  });

  const { data: orgDetail, isLoading: orgDetailLoading } = useQuery<any>({
    queryKey: ["/api/admin/organizations", viewOrg?.id],
    queryFn: () => viewOrg ? adminFetch(`/api/admin/organizations/${viewOrg.id}`) : null,
    enabled: !!viewOrg,
  });

  const orgs: any[] = data?.organizations ?? [];
  const total = data?.total ?? 0;

  const impersonate = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/organizations/${id}/impersonate`);
      return res.json() as Promise<{ orgName?: string; message?: string }>;
    },
    onSuccess: (data) => {
      toast({ title: `Now viewing ${data?.orgName ?? "org"} in read-only mode.` });
      setConfirmImpersonate(null);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  return (
    <div className="space-y-4">
      <SectionTitle>{t("orgs.title")}</SectionTitle>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-orgs-search"
          className="pl-9"
          placeholder={t("common.search")}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>
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
                <Th>Total Expenses</Th>
                <Th>{t("orgs.createdAt")}</Th>
                <Th>{t("users.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {orgs.length === 0 ? (
                <EmptyRow colSpan={6} label={t("common.noData")} />
              ) : orgs.map((o: any) => (
                <tr key={o.id} className="hover:bg-accent/30 transition-colors cursor-pointer" data-testid={`row-org-${o.id}`}
                  onClick={() => setViewOrg(o)}>
                  <Td><span className="font-medium text-foreground">{o.name}</span></Td>
                  <Td className="text-muted-foreground text-xs">{o.owner_email ?? o.ownerEmail ?? "—"}</Td>
                  <Td>{o.member_count ?? o.memberCount ?? 0}</Td>
                  <Td className="text-emerald-400">{fmtCurrency(o.total_expenses ?? o.totalExpenses)}</Td>
                  <Td className="text-muted-foreground">{fmtDate(o.created_at ?? o.createdAt)}</Td>
                  <Td onClick={e => e.stopPropagation()}>
                    <Button
                      data-testid={`button-impersonate-${o.id}`}
                      variant="ghost" size="sm" title="View org as owner (read-only)"
                      onClick={e => { e.stopPropagation(); setConfirmImpersonate(o); }}
                    >
                      <UserCog className="h-3.5 w-3.5" />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={total} limit={20} onPage={setPage} />
        </>
      )}

      {/* ─── Confirm Impersonate ───────────────────────────────────────────── */}
      <Dialog open={!!confirmImpersonate} onOpenChange={() => setConfirmImpersonate(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("orgs.viewAs")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("orgs.impersonateNote")}</div>
          <div className="font-medium text-foreground">{confirmImpersonate?.name} ({confirmImpersonate?.owner_email ?? confirmImpersonate?.ownerEmail ?? "no owner"})</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmImpersonate(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-impersonate" onClick={() => confirmImpersonate && impersonate.mutate(confirmImpersonate.id)} disabled={impersonate.isPending}>
              {t("orgs.impersonate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Org Details Drawer ────────────────────────────────────────────── */}
      <Dialog open={!!viewOrg} onOpenChange={() => setViewOrg(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewOrg?.name} — {t("orgs.title")}</DialogTitle>
          </DialogHeader>
          {orgDetailLoading ? (
            <div className="text-muted-foreground py-4">{t("common.loading")}</div>
          ) : orgDetail ? (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Owner</div>
                  <div className="font-medium text-sm">{viewOrg?.owner_email ?? viewOrg?.ownerEmail ?? "—"}</div>
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Members</div>
                  <div className="font-medium text-sm">{orgDetail.members?.length ?? 0}</div>
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Pending Approvals</div>
                  <div className="font-medium text-sm">{orgDetail.pendingApprovals ?? 0}</div>
                </div>
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="font-medium text-sm">{fmtDate(viewOrg?.created_at ?? viewOrg?.createdAt)}</div>
                </div>
              </div>

              {orgDetail.members?.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">Members</div>
                  <div className="space-y-1">
                    {orgDetail.members.map((m: any) => (
                      <div key={m.user_id ?? m.userId} className="flex justify-between text-xs bg-background/30 rounded px-3 py-2">
                        <span className="text-foreground">{m.first_name ?? ""} {m.last_name ?? ""} <span className="text-muted-foreground">{m.email}</span></span>
                        <Badge variant="outline" className="text-xs capitalize">{m.role}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {orgDetail.categoryBreakdown?.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">Top Expense Categories</div>
                  <div className="space-y-1">
                    {orgDetail.categoryBreakdown.map((c: any) => (
                      <div key={c.category_name} className="flex justify-between text-xs bg-background/30 rounded px-3 py-2">
                        <span className="text-foreground capitalize">{c.category_name ?? "Uncategorized"}</span>
                        <span className="text-emerald-400">{fmtCurrency(c.total)} ({c.count} txns)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setViewOrg(null)}>{t("common.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CHART_PERIODS = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "All", months: 999 },
];

function FinanceSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const [chartPeriod, setChartPeriod] = useState(12);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data: overview } = useQuery<any>({ queryKey: ["/api/admin/finance/overview"] });

  const txParams = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) txParams.set("search", search);
  if (typeFilter !== "all") txParams.set("type", typeFilter);

  const { data: txData, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/finance/transactions", page, search, typeFilter],
    queryFn: () => adminFetch(`/api/admin/finance/transactions?${txParams.toString()}`),
  });

  // Backend returns monthlyVolume array with {month, total_volume, count}
  const allChartData = (overview?.monthlyVolume ?? []).map((m: any) => ({
    month: m.month,
    Volume: m.total_volume ?? 0,
  }));
  const chartData = chartPeriod >= 999 ? allChartData : allChartData.slice(-chartPeriod);

  return (
    <div className="space-y-6">
      <SectionTitle>{t("finance.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Current Month Volume" value={fmtCurrency(overview?.currentMonthVolume)} icon={TrendingUp} color="text-emerald-400" />
        <StatCard label="Prev Month Volume" value={fmtCurrency(overview?.prevMonthVolume)} icon={BarChart2} color="text-blue-400" />
        <StatCard label="Avg Spend / User" value={fmtCurrency(overview?.avgSpendPerUser)} icon={CreditCard} />
      </div>

      {allChartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SubTitle>{t("finance.revenueByMonth")}</SubTitle>
            <div className="flex gap-1">
              {CHART_PERIODS.map(p => (
                <button
                  key={p.label}
                  data-testid={`button-chart-period-${p.label}`}
                  onClick={() => setChartPeriod(p.months)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${chartPeriod === p.months ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
                >{p.label}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }} />
              <Bar dataKey="Volume" fill="#7a9e8a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {(overview?.topCategories ?? []).length > 0 && (
        <div>
          <SubTitle>Top Expense Categories</SubTitle>
          <TableWrapper>
            <thead><tr><Th>Category</Th><Th>Total</Th><Th>Count</Th></tr></thead>
            <tbody>
              {overview.topCategories.map((c: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30">
                  <Td className="capitalize">{c.category_name}</Td>
                  <Td className="text-red-400">{fmtCurrency(c.total)}</Td>
                  <Td>{c.count}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </div>
      )}

      <div>
        <SubTitle>{t("finance.recentTransactions")}</SubTitle>
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-finance-search"
              className="pl-9"
              placeholder={t("common.search")}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger data-testid="select-finance-type" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("users.allPlans").replace("Plans", "Types")}</SelectItem>
              <SelectItem value="income">{t("finance.type")} — Income</SelectItem>
              <SelectItem value="expense">{t("finance.type")} — Expense</SelectItem>
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
                  <Th>{t("finance.user")}</Th>
                  <Th>{t("finance.description")}</Th>
                  <Th>{t("finance.amount")}</Th>
                  <Th>{t("finance.type")}</Th>
                  <Th>{t("finance.date")}</Th>
                </tr>
              </thead>
              <tbody>
                {(txData?.transactions ?? []).length === 0 ? (
                  <EmptyRow colSpan={5} label={t("common.noData")} />
                ) : (txData?.transactions ?? []).map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-accent/30" data-testid={`row-tx-${tx.id}`}>
                    <Td className="text-muted-foreground text-xs">{tx.user_email ?? tx.userEmail ?? "—"}</Td>
                    <Td className="font-medium max-w-xs truncate">{tx.description}</Td>
                    <Td className={tx.type === "income" ? "text-emerald-400" : "text-red-400"}>{fmtCurrency(tx.amount)}</Td>
                    <Td><Badge variant="outline" className="text-xs capitalize">{tx.type}</Badge></Td>
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
  const [search, setSearch] = useState("");

  const { data: overview } = useQuery<any>({ queryKey: ["/api/admin/billing/overview"] });

  const billingParams = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) billingParams.set("search", search);

  const { data: subData, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/billing/subscriptions", page, search],
    queryFn: () => adminFetch(`/api/admin/billing/subscriptions?${billingParams.toString()}`),
  });

  // Backend: {planCounts, mrr, payingUsers, personalAICount, teamCount, starterCount, trialUsers}
  const ov = overview ?? {};

  return (
    <div className="space-y-6">
      <SectionTitle>{t("billing.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Paying Users" value={ov.payingUsers ?? 0} icon={CreditCard} color="text-green-400" />
        <StatCard label="Personal AI" value={ov.personalAICount ?? 0} icon={Brain} color="text-violet-400" />
        <StatCard label="Team Plan" value={ov.teamCount ?? 0} icon={Users} color="text-blue-400" />
        <StatCard label={t("billing.mrrStripe")} value={fmtCurrency(ov.mrr)} icon={TrendingUp} color="text-emerald-400" />
        <StatCard label="Starter (Free)" value={ov.starterCount ?? 0} icon={Users} />
        <StatCard label="Trial Users" value={ov.trialUsers ?? 0} icon={AlertTriangle} color="text-yellow-400" />
        <StatCard label="New This Month" value={ov.newSubscribersThisMonth ?? 0} icon={Zap} color="text-blue-400" />
        <StatCard label="Prev Month" value={ov.newSubscribersPrevMonth ?? 0} icon={BarChart2} />
      </div>

      <SubTitle>Subscribed Users</SubTitle>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          data-testid="input-billing-search"
          className="pl-9"
          placeholder={t("common.search")}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>
      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>{t("billing.plan")}</Th>
                <Th>Stripe Sub ID</Th>
                <Th>Trial Ends</Th>
                <Th>{t("billing.currentPeriodEnd")}</Th>
                <Th>Stripe</Th>
              </tr>
            </thead>
            <tbody>
              {(subData?.subscriptions ?? []).length === 0 ? (
                <EmptyRow colSpan={6} label={t("common.noData")} />
              ) : (subData?.subscriptions ?? []).map((s: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-sub-${i}`}>
                  <Td className="text-muted-foreground text-xs">{s.email}</Td>
                  <Td><Badge variant="outline" className="text-xs capitalize">{s.plan}</Badge></Td>
                  <Td className="font-mono text-xs max-w-xs truncate">
                    {s.stripe_subscription_id
                      ? <a href={`https://dashboard.stripe.com/subscriptions/${s.stripe_subscription_id}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline" title="Open in Stripe">{s.stripe_subscription_id}</a>
                      : <span className="text-muted-foreground">—</span>}
                  </Td>
                  <Td className="text-muted-foreground">{fmtDate(s.trial_ends_at)}</Td>
                  <Td className="text-muted-foreground">{fmtDate(s.created_at)}</Td>
                  <Td>
                    {s.stripe_customer_id ? (
                      <a href={`https://dashboard.stripe.com/customers/${s.stripe_customer_id}`} target="_blank" rel="noreferrer" data-testid={`link-stripe-customer-${i}`}>
                        <Button variant="ghost" size="sm" title="View customer in Stripe"><ExternalLink className="h-3.5 w-3.5 text-blue-400" /></Button>
                      </a>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </Td>
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
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [qrPolling, setQrPolling] = useState(false);

  // Use the same existing WhatsApp status endpoint the main app uses (admin gets QR code)
  const { data: statusData, isLoading: statusLoading } = useQuery<any>({
    queryKey: ["/api/whatsapp/status"],
    queryFn: () => adminFetch("/api/whatsapp/status"),
    refetchInterval: qrPolling ? 3000 : false,
  });

  const { data: logsData, isLoading: logsLoading } = useQuery<any>({
    queryKey: ["/api/admin/whatsapp/logs", page],
    queryFn: () => adminFetch(`/api/admin/whatsapp/logs?page=${page}&limit=20`),
  });

  const status = statusData?.status ?? "disconnected";
  const isConnected = status === "connected";
  const hasQr = !!statusData?.qrCode;

  const connect = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/connect");
      return res.json() as Promise<{ status?: string; qrCode?: string }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      if (data?.qrCode || data?.status === "connecting") {
        setQrPolling(true);
        toast({ title: t("whatsapp.connecting") });
      } else if (data?.status === "connected") {
        setQrPolling(false);
        toast({ title: t("whatsapp.connected") });
      }
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  const disconnect = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/disconnect"),
    onSuccess: () => {
      setQrPolling(false);
      setConfirmDisconnect(false);
      toast({ title: t("whatsapp.disconnected") });
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  const reset = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/reset"),
    onSuccess: () => {
      setQrPolling(false);
      setConfirmReset(false);
      toast({ title: t("whatsapp.disconnected") });
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
    },
    onError: (err: any) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  // Stop polling once connected
  if (isConnected && qrPolling) setQrPolling(false);

  return (
    <div className="space-y-6">
      <SectionTitle>{t("whatsapp.title")}</SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ─── Status card ─── */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SubTitle>{t("whatsapp.connection")}</SubTitle>
          {statusLoading ? (
            <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : status === "connecting" ? "bg-yellow-400 animate-pulse" : "bg-red-400"}`} />
                <span className={`font-medium ${isConnected ? "text-green-400" : status === "connecting" ? "text-yellow-400" : "text-red-400"}`}>
                  {isConnected ? t("whatsapp.connected") : status === "connecting" ? t("whatsapp.connecting") : t("whatsapp.disconnected")}
                </span>
              </div>
              {statusData?.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {statusData.phone}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {!isConnected && (
                  <Button
                    data-testid="button-whatsapp-connect"
                    size="sm" onClick={() => connect.mutate()} disabled={connect.isPending || status === "connecting"}
                  >
                    {connect.isPending ? t("common.loading") : t("whatsapp.connect")}
                  </Button>
                )}
                {isConnected && (
                  <Button
                    data-testid="button-whatsapp-disconnect"
                    size="sm" variant="outline"
                    className="text-amber-400 border-amber-400/40"
                    onClick={() => setConfirmDisconnect(true)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> {t("whatsapp.disconnect")}
                  </Button>
                )}
                <Button
                  data-testid="button-whatsapp-reset"
                  size="sm" variant="outline"
                  className="text-destructive border-destructive/40"
                  onClick={() => setConfirmReset(true)}
                >
                  {t("whatsapp.resetConfig")}
                </Button>
              </div>
            </>
          )}
        </div>

        {/* ─── QR Code card ─── */}
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SubTitle>QR Code</SubTitle>
          {hasQr ? (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">{t("whatsapp.scanQr")}</div>
              <img
                src={statusData.qrCode}
                alt="WhatsApp QR Code"
                className="rounded-lg border border-border w-48 h-48 object-contain bg-white"
                data-testid="img-whatsapp-qr"
              />
              <div className="text-xs text-yellow-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {t("whatsapp.qrExpires")}
              </div>
            </div>
          ) : isConnected ? (
            <div className="text-emerald-400 text-sm flex items-center gap-2">
              <Check className="h-4 w-4" /> {t("whatsapp.connected")}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">{t("whatsapp.connectFirst")}</div>
          )}
        </div>
      </div>

      {/* ─── Disconnect dialog ─── */}
      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("whatsapp.disconnect")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("whatsapp.disconnectNote")}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-disconnect-whatsapp" variant="destructive" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              {t("whatsapp.disconnect")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Reset dialog ─── */}
      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("whatsapp.resetConfig")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("whatsapp.resetNote")}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-reset-whatsapp" variant="destructive" onClick={() => reset.mutate()} disabled={reset.isPending}>
              {t("whatsapp.resetConfig")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubTitle>{t("whatsapp.logs")}</SubTitle>
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
                <EmptyRow colSpan={4} label={t("common.noData")} />
              ) : (logsData?.logs ?? []).map((l: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-wlog-${i}`}>
                  <Td className="font-mono text-xs">{l.senderPhone ?? l.sender_phone ?? "—"}</Td>
                  <Td><Badge variant="outline" className="text-xs">{l.messageType ?? l.message_type}</Badge></Td>
                  <Td className="text-sm max-w-xs truncate">{l.result ?? "—"}</Td>
                  <Td className="text-muted-foreground">{fmtDateTime(l.createdAt ?? l.created_at)}</Td>
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

const ALERT_TYPES = ["bill_due_soon", "overdue_tasks", "goal_deadline", "low_discipline", "weekly_summary", "offline_reminder"];

function EmailLogsSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [alertType, setAlertType] = useState("all");

  const emailParams = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) emailParams.set("search", search);
  if (alertType !== "all") emailParams.set("alertType", alertType);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/email-logs", page, search, alertType],
    queryFn: () => adminFetch(`/api/admin/email-logs?${emailParams.toString()}`),
  });

  const logs: any[] = data?.logs ?? [];

  return (
    <div className="space-y-4">
      <SectionTitle>{t("email.title")}</SectionTitle>
      {(data?.typeCounts ?? []).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
          <StatCard label="This Month" value={data.currentMonth ?? 0} icon={Mail} color="text-yellow-400" />
          <StatCard label="Prev Month" value={data.prevMonth ?? 0} icon={Mail} />
          {data.typeCounts.slice(0, 2).map((tc: any, i: number) => (
            <StatCard key={i} label={tc.alert_type} value={tc.count} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-email-search"
            className="pl-9"
            placeholder={t("email.to")}
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={alertType} onValueChange={v => { setAlertType(v); setPage(1); }}>
          <SelectTrigger data-testid="select-alert-type" className="w-48">
            <SelectValue placeholder={t("email.alertType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("users.allPlans").replace("Plans", "Types")}</SelectItem>
            {ALERT_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
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
                <Th>{t("email.to")}</Th>
                <Th>{t("email.alertType")}</Th>
                <Th>{t("email.status")}</Th>
                <Th>{t("email.sentAt")}</Th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <EmptyRow colSpan={4} label={t("common.noData")} />
              ) : logs.map((l: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-email-${i}`}>
                  <Td className="text-muted-foreground text-xs">{l.recipient ?? l.user_email ?? l.userId ?? "—"}</Td>
                  <Td><Badge variant="outline" className="text-xs">{l.alert_type ?? l.alertType}</Badge></Td>
                  <Td>
                    <Badge variant="outline" className={`text-xs ${(l.status ?? "sent") === "failed" ? "border-red-500 text-red-400" : "border-green-500 text-green-400"}`}>
                      {(l.status ?? "sent") === "failed" ? t("email.failed") : t("email.sent")}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">{fmtDateTime(l.sent_at ?? l.sentAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={data?.total ?? 0} limit={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}

const AI_CALL_TYPES = ["chat", "onboarding_diagnosis", "pdf_extract", "transaction_categorize", "habit_suggestion", "voice_transcription"];

function AISection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [callTypeFilter, setCallTypeFilter] = useState("all");

  // Backend: {today, yesterday, thisMonth, prevMonth, breakdown: [{call_type, count, total_tokens}]}
  const { data: overview } = useQuery<any>({ queryKey: ["/api/admin/ai/overview"] });
  // Backend: {set, valid}
  const { data: status } = useQuery<any>({ queryKey: ["/api/admin/ai/status"] });

  const aiLogsParams = new URLSearchParams({ page: String(page), limit: "20" });
  if (search) aiLogsParams.set("search", search);
  if (callTypeFilter !== "all") aiLogsParams.set("callType", callTypeFilter);

  const { data: logsData, isLoading: logsLoading } = useQuery<any>({
    queryKey: ["/api/admin/ai/logs", page, search, callTypeFilter],
    queryFn: () => adminFetch(`/api/admin/ai/logs?${aiLogsParams.toString()}`),
  });

  const breakdown: any[] = overview?.breakdown ?? [];

  const pieData = breakdown.map((b: any) => ({
    callType: b.call_type ?? b.callType,
    count: b.count,
    totalTokens: b.total_tokens ?? b.totalTokens,
  }));

  return (
    <div className="space-y-6">
      <SectionTitle>{t("ai.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today" value={overview?.today ?? 0} icon={Brain} color="text-violet-400" />
        <StatCard label="Yesterday" value={overview?.yesterday ?? 0} icon={Brain} />
        <StatCard label="This Month" value={overview?.thisMonth ?? 0} icon={Activity} color="text-blue-400" />
        <StatCard label={t("ai.status")} value={status?.valid ? "✓ OK" : status?.set ? "⚠ Key set, invalid" : "✗ Not set"} icon={Zap} color={status?.valid ? "text-green-400" : "text-red-400"} />
      </div>

      {pieData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-4">
            <SubTitle>{t("ai.byType")}</SubTitle>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="count" nameKey="callType" cx="50%" cy="50%" outerRadius={70}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }}
                  formatter={(val: any, name: any, props: any) => [val, props.payload?.callType]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <SubTitle>{t("ai.byType")} — Table</SubTitle>
            <TableWrapper>
              <thead><tr><Th>{t("ai.callType")}</Th><Th>{t("ai.count")}</Th><Th>{t("ai.tokens")}</Th></tr></thead>
              <tbody>
                {pieData.map((b: any, i: number) => (
                  <tr key={i} className="hover:bg-accent/30">
                    <Td><Badge variant="outline" className="text-xs">{b.callType}</Badge></Td>
                    <Td className="font-mono">{b.count}</Td>
                    <Td className="font-mono text-xs">{b.totalTokens ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          </div>
        </div>
      )}

      <div>
        <SubTitle>AI Call Logs</SubTitle>
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-ai-search"
              className="pl-9"
              placeholder={t("common.search")}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select value={callTypeFilter} onValueChange={v => { setCallTypeFilter(v); setPage(1); }}>
            <SelectTrigger data-testid="select-ai-calltype" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {AI_CALL_TYPES.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {logsLoading ? (
          <div className="text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <>
            <TableWrapper>
              <thead><tr><Th>User</Th><Th>Type</Th><Th>Tokens</Th><Th>Time</Th></tr></thead>
              <tbody>
                {(logsData?.logs ?? []).length === 0 ? (
                  <EmptyRow colSpan={4} label={t("common.noData")} />
                ) : (logsData?.logs ?? []).map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-accent/30" data-testid={`row-ai-${i}`}>
                    <Td className="text-muted-foreground text-xs">{c.user_email ?? "anon"}</Td>
                    <Td><Badge variant="outline" className="text-xs">{c.call_type}</Badge></Td>
                    <Td className="font-mono text-xs">{c.tokens_used ?? "—"}</Td>
                    <Td className="text-muted-foreground">{fmtDateTime(c.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
            <Pagination page={page} total={logsData?.total ?? 0} limit={20} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

function AuditSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const [actor, setActor] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const auditParams = new URLSearchParams({ page: String(page), limit: "20" });
  if (actor) auditParams.set("actor", actor);
  if (actionFilter) auditParams.set("action", actionFilter);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/audit-logs", page, actor, actionFilter],
    queryFn: () => adminFetch(`/api/admin/audit-logs?${auditParams.toString()}`),
  });

  const logs: any[] = data?.logs ?? [];

  const ACTION_TYPES = ["impersonate", "impersonate_stop", "delete_user", "deactivate_user", "reactivate_user", "reset_password", "update_plan", "maintenance_on", "maintenance_off", "seed_demo", "reset_demo"];

  return (
    <div className="space-y-4">
      <SectionTitle>{t("audit.title")}</SectionTitle>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="input-audit-actor"
            className="pl-9"
            placeholder={t("audit.actor")}
            value={actor}
            onChange={e => { setActor(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={actionFilter || "all"} onValueChange={v => { setActionFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger data-testid="select-audit-action" className="w-48">
            <SelectValue placeholder={t("audit.action")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("users.allPlans").replace("Plans", "Actions")}</SelectItem>
            {ACTION_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
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
                <Th>{t("audit.actor")}</Th>
                <Th>{t("audit.action")}</Th>
                <Th>{t("audit.target")}</Th>
                <Th>{t("audit.targetId")}</Th>
                <Th>{t("audit.timestamp")}</Th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <EmptyRow colSpan={5} label={t("common.noData")} />
              ) : logs.map((l: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-audit-${i}`}>
                  <Td className="text-muted-foreground text-xs">{l.actor_email ?? l.actorEmail ?? l.actor_id ?? "—"}</Td>
                  <Td><Badge variant="outline" className="text-xs">{l.action}</Badge></Td>
                  <Td className="text-xs">{l.target_type ?? l.targetType ?? "—"}</Td>
                  <Td className="font-mono text-xs text-muted-foreground max-w-xs truncate">{l.target_id ?? l.targetId ?? "—"}</Td>
                  <Td className="text-muted-foreground">{fmtDateTime(l.created_at ?? l.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={data?.total ?? 0} limit={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}

function SystemSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const qc = useQueryClient();

  // Backend: {dbConnected, uptime, nodeVersion, memory: {rss, heapUsed, heapTotal}}
  const { data: healthData } = useQuery<any>({ queryKey: ["/api/admin/system/health"] });
  // Backend: {envVars: [{key, set, value?}], configs: [...], maintenanceMode: bool}
  const { data: configData, isLoading: configLoading } = useQuery<any>({ queryKey: ["/api/admin/system/config"] });
  // Backend: {global, auth, whatsapp, ai} — flat object
  const { data: rateLimitData } = useQuery<any>({ queryKey: ["/api/admin/rate-limits/status"] });

  const [editConfig, setEditConfig] = useState<any>(null);
  const [editValue, setEditValue] = useState("");

  const health = healthData ?? {};
  const envVars: any[] = configData?.envVars ?? [];
  const configs: any[] = configData?.configs ?? [];
  const maintenanceMode: boolean = configData?.maintenanceMode ?? false;
  const rateLimits: any = rateLimitData ?? {};

  const maintenance = useMutation({
    mutationFn: (enabled: boolean) => apiRequest("POST", "/api/admin/system/maintenance", { enabled }),
    onSuccess: (_data, enabled) => {
      toast({ title: enabled ? t("system.maintenanceEnabled") : t("system.maintenanceDisabled") });
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
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/demo/seed", {});
      return res.json() as Promise<{ credentials?: { email: string; password: string } }>;
    },
    onSuccess: (data) => toast({ title: data?.credentials ? `Seeded: ${data.credentials.email} / ${data.credentials.password}` : t("system.seeded") }),
  });

  const resetDemo = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/demo/reset", {}),
    onSuccess: () => toast({ title: t("system.reset") }),
  });

  const formatUptime = (s: number) => {
    if (!s) return "—";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      <SectionTitle>{t("system.title")}</SectionTitle>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("system.uptime")} value={formatUptime(health.uptime)} icon={Activity} color="text-green-400" />
        <StatCard label="Memory (heap used)" value={health.memory?.heapUsed != null ? `${health.memory.heapUsed} MB` : "—"} icon={Database} />
        <StatCard label={t("system.nodeVersion")} value={health.nodeVersion ?? "—"} icon={Server} />
        <StatCard label={t("system.dbConnected")} value={health.dbConnected ? "✓ Yes" : "✗ No"} icon={Database} color={health.dbConnected ? "text-green-400" : "text-red-400"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SubTitle>{t("system.maintenance")}</SubTitle>
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${maintenanceMode ? "bg-yellow-400" : "bg-green-400"}`} />
            <span className="text-sm font-medium">{maintenanceMode ? "ENABLED" : "DISABLED"}</span>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-enable-maintenance" size="sm" variant="outline"
              onClick={() => maintenance.mutate(true)} disabled={maintenanceMode || maintenance.isPending}>
              {t("system.enable")}
            </Button>
            <Button data-testid="button-disable-maintenance" size="sm" variant="outline"
              onClick={() => maintenance.mutate(false)} disabled={!maintenanceMode || maintenance.isPending}>
              {t("system.disable")}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SubTitle>{t("system.demo")}</SubTitle>
          <div className="flex gap-2">
            <Button data-testid="button-seed-demo" size="sm" variant="outline" onClick={() => seedDemo.mutate()} disabled={seedDemo.isPending}>
              <Database className="h-3.5 w-3.5 mr-1" />{t("system.seedDemo")}
            </Button>
            <Button data-testid="button-reset-demo" size="sm" variant="outline" onClick={() => resetDemo.mutate()} disabled={resetDemo.isPending}
              className="text-destructive border-destructive/30 hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5 mr-1" />{t("system.resetDemo")}
            </Button>
          </div>
        </div>
      </div>

      {envVars.length > 0 && (
        <div>
          <SubTitle>Environment Variables</SubTitle>
          <TableWrapper>
            <thead><tr><Th>Key</Th><Th>Set</Th><Th>Value</Th></tr></thead>
            <tbody>
              {envVars.map((ev: any, i: number) => (
                <tr key={i} className="hover:bg-accent/30">
                  <Td className="font-mono text-xs">{ev.key}</Td>
                  <Td>{ev.set ? <Check className="h-4 w-4 text-green-400" /> : <X className="h-4 w-4 text-red-400" />}</Td>
                  <Td className="font-mono text-xs text-muted-foreground">{ev.value ?? (ev.set ? "***" : "—")}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </div>
      )}

      {configs.length > 0 && (
        <div>
          <SubTitle>{t("system.config")}</SubTitle>
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
                {configs.map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-accent/30" data-testid={`row-config-${i}`}>
                    <Td className="font-mono text-xs">{c.key}</Td>
                    <Td className="font-mono text-xs max-w-xs truncate">{c.value ?? "—"}</Td>
                    <Td className="text-muted-foreground">{fmtDateTime(c.updatedAt ?? c.updated_at)}</Td>
                    <Td>
                      <Button data-testid={`button-edit-config-${i}`} variant="ghost" size="sm"
                        onClick={() => { setEditConfig(c); setEditValue(c.value ?? ""); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          )}
        </div>
      )}

      {Object.keys(rateLimits).length > 0 && (
        <div>
          <SubTitle>{t("system.rateLimits")}</SubTitle>
          <TableWrapper>
            <thead><tr><Th>Name</Th><Th>{t("system.window")}</Th><Th>{t("system.max")}</Th><Th>{t("system.description")}</Th></tr></thead>
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
          <DialogHeader><DialogTitle>{t("system.editConfig")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="font-mono text-xs">{editConfig?.key}</Label>
            <Textarea data-testid="textarea-config-value" value={editValue} onChange={e => setEditValue(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditConfig(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-save-config" onClick={() => updateConfig.mutate({ key: editConfig.key, value: editValue })} disabled={updateConfig.isPending}>{t("common.save")}</Button>
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

  const { data: accessCheck, isLoading: checkLoading, isError } = useQuery<any>({
    queryKey: ["/api/auth/is-admin"],
    retry: false,
  });

  const shouldRedirect = !checkLoading && (isError || !accessCheck?.isAdmin);

  useEffect(() => {
    if (shouldRedirect) setLocation("/");
  }, [shouldRedirect, setLocation]);

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

  if (shouldRedirect) {
    return null;
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
              <Button data-testid="button-toggle-lang" variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={toggleLang}>
                {i18n.language === "pt-BR" ? "🇧🇷 PT-BR" : "🇺🇸 EN"}
              </Button>
              <Button data-testid="button-go-app" variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground" onClick={() => setLocation("/")}>
                <LogOut className="h-3.5 w-3.5 mr-2" />
                Back to App
              </Button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-card/50 px-4 py-3 flex items-center gap-3 shrink-0">
          <Button data-testid="button-toggle-sidebar" variant="ghost" size="sm" onClick={() => setSidebarOpen(v => !v)}>
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
