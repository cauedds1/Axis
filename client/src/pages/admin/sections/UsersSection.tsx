import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Search, Edit, Trash2, KeyRound, UserX, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  SectionTitle, TableWrapper, Th, Td, EmptyRow, Pagination, SortIcon,
} from "../AdminComponents";
import { fmtDate, fmtDateTime, fmtCurrency, userName, adminFetch, PLAN_OPTIONS, formatPlan, formatAccountType } from "../admin-utils";

type SortDir = "asc" | "desc";

export function UsersSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [plan, setPlan] = useState("all");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editUser, setEditUser] = useState<Record<string, unknown> | null>(null);
  const [newPlan, setNewPlan] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Record<string, unknown> | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<Record<string, unknown> | null>(null);
  const [confirmResetPw, setConfirmResetPw] = useState<Record<string, unknown> | null>(null);
  const [viewUser, setViewUser] = useState<Record<string, unknown> | null>(null);

  const params = new URLSearchParams({ page: String(page), limit: "20", sortBy, sortDir });
  if (search) params.set("search", search);
  if (plan !== "all") params.set("plan", plan);

  interface UserDetail {
    user: { email?: string; plan?: string; account_type?: string; accountType?: string; deactivated_at?: string; deactivatedAt?: string; created_at?: string; createdAt?: string; stripeSubscriptionId?: string };
    stats: { transactions?: number; habits?: number; tasks?: number };
    profile: { disciplineScore?: number; discipline_score?: number };
    recentTransactions: { id: string; description?: string; amount?: number; type?: string }[];
  }

  const { data: userDetail, isLoading: userDetailLoading } = useQuery<UserDetail>({
    queryKey: ["/api/admin/users", viewUser?.id],
    queryFn: () => adminFetch(`/api/admin/users/${viewUser!.id}`),
    enabled: !!viewUser,
  });

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const { data, isLoading } = useQuery<{ users: Record<string, unknown>[]; total: number }>({
    queryKey: ["/api/admin/users", page, search, plan, sortBy, sortDir],
    queryFn: () => adminFetch(`/api/admin/users?${params.toString()}`),
  });

  const rows = data?.users ?? [];
  const total = data?.total ?? 0;

  const updatePlan = useMutation({
    mutationFn: ({ id, plan: p }: { id: string; plan: string }) =>
      apiRequest("PATCH", `/api/admin/users/${id}/plan`, { plan: p }),
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
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  const resetPassword = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/admin/users/${id}/reset-password`),
    onSuccess: () => {
      toast({ title: t("users.passwordReset") });
      setConfirmResetPw(null);
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  return (
    <div className="space-y-4">
      <SectionTitle>{t("users.title")}</SectionTitle>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-user-search" className="pl-9" placeholder={t("users.search")}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={plan} onValueChange={v => { setPlan(v); setPage(1); }}>
          <SelectTrigger data-testid="select-plan-filter" className="w-40">
            <SelectValue placeholder={t("users.allPlans")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("users.allPlans")}</SelectItem>
            {PLAN_OPTIONS.map(p => <SelectItem key={p} value={p}>{formatPlan(p, t)}</SelectItem>)}
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
                <Th>{" "}</Th>
                <Th onClick={() => toggleSort("first_name")}>{t("users.name")}<SortIcon field="first_name" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("email")}>{t("users.email")}<SortIcon field="email" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("plan")}>{t("users.plan")}<SortIcon field="plan" sort={sortBy} dir={sortDir} /></Th>
                <Th>{t("users.type")}</Th>
                <Th>{t("users.status")}</Th>
                <Th onClick={() => toggleSort("transaction_count")}>{t("users.transactions")}<SortIcon field="transaction_count" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("discipline_score")}>{t("users.disciplineScore")}<SortIcon field="discipline_score" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("lastActivity")}>{t("users.lastActivity")}<SortIcon field="lastActivity" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("created_at")}>{t("users.createdAt")}<SortIcon field="created_at" sort={sortBy} dir={sortDir} /></Th>
                <Th>{t("users.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={11} label={t("common.noData")} />
              ) : rows.map((u) => {
                const isDeactivated = !!(u.deactivated_at ?? u.deactivatedAt);
                const initials = ((u.first_name as string)?.[0] ?? (u.email as string)?.[0] ?? "?").toUpperCase();
                const disciplineScore = (u.discipline_score ?? u.disciplineScore) as number | null;
                return (
                  <tr key={u.id as string} className={`hover:bg-accent/30 transition-colors cursor-pointer ${isDeactivated ? "opacity-60" : ""}`}
                    data-testid={`row-user-${u.id}`} onClick={() => setViewUser(u)}>
                    <Td>
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0"
                        data-testid={`avatar-${u.id}`}>{initials}</div>
                    </Td>
                    <Td><span className="font-medium text-foreground">{userName(u as Parameters<typeof userName>[0])}</span></Td>
                    <Td className="text-muted-foreground text-xs">{u.email as string}</Td>
                    <Td><Badge variant="outline" className="text-xs">{formatPlan((u.plan as string) ?? "starter", t)}</Badge></Td>
                    <Td className="text-muted-foreground text-xs">{formatAccountType((u.account_type ?? u.accountType) as string, t)}</Td>
                    <Td>
                      {isDeactivated
                        ? <Badge variant="destructive" className="text-xs">{t("users.statusDeactivated")}</Badge>
                        : <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-400/40">{t("users.statusActive")}</Badge>}
                    </Td>
                    <Td className="text-muted-foreground text-xs tabular-nums">{(u.transaction_count ?? u.transactionCount ?? 0) as number}</Td>
                    <Td>
                      {disciplineScore !== null
                        ? <span className={`text-xs font-semibold tabular-nums ${disciplineScore >= 7 ? "text-emerald-400" : disciplineScore >= 4 ? "text-yellow-400" : "text-red-400"}`}>{disciplineScore}/10</span>
                        : <span className="text-muted-foreground/40">—</span>}
                    </Td>
                    <Td className="text-muted-foreground text-xs">{u.last_activity ? fmtDateTime(u.last_activity as string) : <span className="text-muted-foreground/40">—</span>}</Td>
                    <Td className="text-muted-foreground">{fmtDate((u.created_at ?? u.createdAt) as string)}</Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button data-testid={`button-edit-plan-${u.id}`} variant="ghost" size="sm" title={t("users.editPlan")}
                          onClick={e => { e.stopPropagation(); setEditUser(u); setNewPlan((u.plan as string) ?? "starter"); }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button data-testid={`button-reset-pw-${u.id}`} variant="ghost" size="sm" title={t("users.resetPassword")}
                          onClick={e => { e.stopPropagation(); setConfirmResetPw(u); }}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        <Button data-testid={`button-deactivate-${u.id}`} variant="ghost" size="sm"
                          title={isDeactivated ? t("users.reactivate") : t("users.deactivate")}
                          onClick={e => { e.stopPropagation(); setConfirmDeactivate(u); }}
                          className={isDeactivated ? "text-emerald-400 hover:text-emerald-400" : "text-amber-400 hover:text-amber-400"}>
                          {isDeactivated ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                        </Button>
                        <Button data-testid={`button-delete-user-${u.id}`} variant="ghost" size="sm" title={t("common.delete")}
                          onClick={e => { e.stopPropagation(); setConfirmDelete(u); }}
                          className="text-destructive hover:text-destructive">
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
            <div className="text-sm text-muted-foreground">{editUser?.email as string}</div>
            <Label>{t("users.plan")}</Label>
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger data-testid="select-new-plan"><SelectValue /></SelectTrigger>
              <SelectContent>{PLAN_OPTIONS.map(p => <SelectItem key={p} value={p}>{formatPlan(p, t)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditUser(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-save-plan" onClick={() => updatePlan.mutate({ id: editUser!.id as string, plan: newPlan })} disabled={updatePlan.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("users.deleteUser")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("users.confirmDelete")}</div>
          <div className="font-medium text-foreground">{confirmDelete?.email as string}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-delete" variant="destructive" onClick={() => deleteUser.mutate(confirmDelete!.id as string)} disabled={deleteUser.isPending}>{t("common.delete")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDeactivate} onOpenChange={() => setConfirmDeactivate(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {confirmDeactivate && !!(confirmDeactivate.deactivated_at ?? confirmDeactivate.deactivatedAt) ? t("users.reactivate") : t("users.deactivate")}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            {confirmDeactivate && !!(confirmDeactivate.deactivated_at ?? confirmDeactivate.deactivatedAt)
              ? t("users.reactivateHint") : t("users.deactivateHint")}
          </div>
          <div className="font-medium text-foreground">{confirmDeactivate?.email as string}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeactivate(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-deactivate"
              variant={confirmDeactivate && !!(confirmDeactivate.deactivated_at ?? confirmDeactivate.deactivatedAt) ? "default" : "destructive"}
              onClick={() => confirmDeactivate && deactivateUser.mutate({ id: confirmDeactivate.id as string, deactivated: !!(confirmDeactivate.deactivated_at ?? confirmDeactivate.deactivatedAt) })}
              disabled={deactivateUser.isPending}>
              {confirmDeactivate && !!(confirmDeactivate.deactivated_at ?? confirmDeactivate.deactivatedAt) ? t("users.reactivate") : t("users.deactivate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmResetPw} onOpenChange={() => setConfirmResetPw(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("users.resetPassword")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("users.resetPasswordHint")}</div>
          <div className="font-medium text-foreground">{confirmResetPw?.email as string}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmResetPw(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-reset-pw" onClick={() => confirmResetPw && resetPassword.mutate(confirmResetPw.id as string)} disabled={resetPassword.isPending}>{t("users.resetPassword")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewUser} onOpenChange={() => setViewUser(null)}>
        <DialogContent className="bg-card border-border max-w-2xl">
          <DialogHeader><DialogTitle>{userName(viewUser as Parameters<typeof userName>[0])} — {t("users.title")}</DialogTitle></DialogHeader>
          {userDetailLoading ? (
            <div className="text-muted-foreground py-4">{t("common.loading")}</div>
          ) : userDetail ? (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-3">
                {([
                  [t("users.email"), userDetail.user?.email],
                  [t("users.plan"), formatPlan(userDetail.user?.plan, t)],
                  [t("users.accountType"), formatAccountType(userDetail.user?.account_type ?? userDetail.user?.accountType, t)],
                  [t("users.status"), (userDetail.user?.deactivated_at ?? userDetail.user?.deactivatedAt) ? t("users.statusDeactivated") : t("users.statusActive")],
                  [t("users.transactions"), userDetail.stats?.transactions ?? 0],
                  [t("users.habits"), userDetail.stats?.habits ?? 0],
                  [t("users.tasks"), userDetail.stats?.tasks ?? 0],
                  [t("users.disciplineScore"), `${userDetail.profile?.disciplineScore ?? userDetail.profile?.discipline_score ?? "—"}/10`],
                ] as [string, string | number | undefined][]).map(([label, val]) => (
                  <div key={label} className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="font-medium text-sm capitalize">{String(val ?? "—")}</div>
                  </div>
                ))}
              </div>
              {userDetail.user?.stripeSubscriptionId && (
                <div className="bg-background/50 border border-border rounded-lg p-3 space-y-1">
                  <div className="text-xs text-muted-foreground">{t("users.stripeSubscription")}</div>
                  <a href={`https://dashboard.stripe.com/subscriptions/${userDetail.user.stripeSubscriptionId}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">{userDetail.user.stripeSubscriptionId}</a>
                </div>
              )}
              {userDetail.recentTransactions?.length > 0 && (
                <div>
                  <div className="text-sm font-semibold text-foreground mb-2">{t("users.recentTransactions")}</div>
                  <div className="space-y-1">
                    {userDetail.recentTransactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex justify-between text-xs text-muted-foreground bg-background/30 rounded px-3 py-2">
                        <span>{tx.description ?? "—"}</span>
                        <span className={tx.type === "expense" ? "text-red-400" : "text-emerald-400"}>{fmtCurrency(tx.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">{t("users.joined")}: {fmtDate(userDetail.user?.created_at ?? userDetail.user?.createdAt)}</div>
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
