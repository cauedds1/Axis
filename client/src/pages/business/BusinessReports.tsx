import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, FileSpreadsheet, Download, CheckCircle2, Clock, XCircle, TrendingUp } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { useBusinessTheme, getBusinessPrimaryHex, getBusinessModulePalette } from "@/components/theme-provider";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  if (status === "approved") return <Badge className="text-[10px] font-semibold" style={{ background: "#10B98115", color: "#10B981", border: "1px solid #10B98130" }}>{t("axisBiz.expenses.statusApproved")}</Badge>;
  if (status === "rejected") return <Badge className="text-[10px] font-semibold" style={{ background: "#EF444415", color: "#EF4444", border: "1px solid #EF444430" }}>{t("axisBiz.expenses.statusRejected")}</Badge>;
  return <Badge className="text-[10px] font-semibold" style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30" }}>{t("axisBiz.expenses.statusPending")}</Badge>;
}

type Period = "this_month" | "last_month" | "last_3_months" | "this_year";

function getPeriodDates(period: Period) {
  const now = new Date();
  if (period === "this_month") return { startDate: startOfMonth(now), endDate: endOfMonth(now) };
  if (period === "last_month") { const lm = subMonths(now, 1); return { startDate: startOfMonth(lm), endDate: endOfMonth(lm) }; }
  if (period === "last_3_months") return { startDate: startOfMonth(subMonths(now, 2)), endDate: endOfMonth(now) };
  return { startDate: startOfYear(now), endDate: endOfMonth(now) };
}

function MemberAvatar({ name, email, hex }: { name?: string; email?: string; hex: string }) {
  const initials = name
    ? name.split(" ").filter(Boolean).map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : (email?.[0] ?? "?").toUpperCase();
  return (
    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0"
      style={{ background: `${hex}18`, border: `1px solid ${hex}25`, color: hex }}>
      {initials}
    </div>
  );
}

export default function BusinessReports() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);
  const palette = getBusinessModulePalette(businessTheme);

  const isCollaborator = user?.accountType === "collaborator";

  const [period, setPeriod] = useState<Period>("this_month");
  const [filterUser, setFilterUser] = useState(isCollaborator && user?.id ? user.id : "all");
  const [filterCategory, setFilterCategory] = useState("all");

  useEffect(() => {
    if (isCollaborator && user?.id) setFilterUser(user.id);
  }, [isCollaborator, user?.id]);

  const { data: orgs, isLoading: orgsLoading } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const activeOrg = orgs?.[0];

  const { data: members } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "members"],
    enabled: !!activeOrg?.id,
  });

  const { startDate, endDate } = getPeriodDates(period);
  const expenseParams = new URLSearchParams({
    startDate: startDate.toISOString().slice(0, 10),
    endDate: endDate.toISOString().slice(0, 10),
  });
  if (filterUser !== "all") expenseParams.set("userId", filterUser);

  const { data: rawExpenses, isLoading: expLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "expenses", period, filterUser],
    queryFn: async () => {
      if (!activeOrg?.id) return [];
      const res = await fetch(`/api/business/organizations/${activeOrg.id}/expenses?${expenseParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro");
      return res.json();
    },
    enabled: !!activeOrg?.id,
  });

  const expenses = useMemo(() => {
    if (!rawExpenses) return [];
    if (filterCategory === "all") return rawExpenses;
    return rawExpenses.filter(e => (e.categoryName || t("axisBiz.reports.noCategory")) === filterCategory);
  }, [rawExpenses, filterCategory, t]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    (rawExpenses ?? []).forEach(e => set.add(e.categoryName || t("axisBiz.reports.noCategory")));
    return Array.from(set).sort();
  }, [rawExpenses, t]);

  const metrics = useMemo(() => {
    const all = expenses ?? [];
    const approved = all.filter(e => e.status === "approved");
    const pending = all.filter(e => e.status === "pending_review");
    const rejected = all.filter(e => e.status === "rejected");
    return {
      total: all.reduce((s, e) => s + e.amount, 0),
      approvedTotal: approved.reduce((s, e) => s + e.amount, 0),
      pendingCount: pending.length,
      rejectedCount: rejected.length,
      pendingTotal: pending.reduce((s, e) => s + e.amount, 0),
    };
  }, [expenses]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    (expenses ?? []).filter(e => e.status !== "rejected").forEach(e => {
      const cat = e.categoryName || t("axisBiz.reports.noCategory");
      map[cat] = (map[cat] ?? 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const byCollaborator = useMemo(() => {
    const map: Record<string, { total: number; count: number; name: string; email: string }> = {};
    (expenses ?? []).filter(e => e.status !== "rejected").forEach(e => {
      if (!map[e.userId]) map[e.userId] = { total: 0, count: 0, name: e.userName || "", email: e.userEmail || "" };
      map[e.userId].total += e.amount;
      map[e.userId].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [expenses]);

  const maxCategory = byCategory[0]?.[1] ?? 1;
  const maxCollab = byCollaborator[0]?.[1].total ?? 1;

  const handleExportExcel = useCallback(async () => {
    if (!activeOrg?.id) return;
    const res = await fetch(`/api/business/organizations/${activeOrg.id}/expenses/export-excel?${expenseParams.toString()}`, { credentials: "include" });
    if (!res.ok) { toast({ title: t("axisBiz.reports.exportError"), variant: "destructive" }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `relatorio-${activeOrg.name}-${format(new Date(), "yyyy-MM")}.xlsx`;
    a.click(); URL.revokeObjectURL(url);
  }, [activeOrg, expenseParams, toast]);

  const handleExportCSV = useCallback(() => {
    if (!expenses || !activeOrg) return;
    const header = [
      t("axisBiz.expenses.date"),
      t("axisBiz.reports.collaborator"),
      t("axisBiz.expenses.category"),
      t("axisBiz.expenses.description"),
      t("axisBiz.expenses.amount"),
      t("axisBiz.reports.statusHeader"),
    ];
    const rows = expenses.map((e: any) => [
      e.date ? format(new Date(e.date), "dd/MM/yyyy") : "",
      e.userName || e.userEmail || "",
      e.categoryName || "",
      e.establishment || e.description || "",
      e.amount.toFixed(2).replace(".", ","),
      e.status === "approved" ? t("axisBiz.expenses.statusApproved") : e.status === "rejected" ? t("axisBiz.expenses.statusRejected") : t("axisBiz.expenses.statusPending"),
    ]);
    const csv = [header, ...rows].map(r => r.map((v: string) => `"${v}"`).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `relatorio-${activeOrg.name}-${format(new Date(), "yyyy-MM")}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [expenses, activeOrg]);

  if (orgsLoading) return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-4">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-12 w-full rounded-2xl" />
      {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
    </div>
  );

  if (!activeOrg) return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col items-center justify-center py-20 text-center gap-4">
      <BarChart3 className="w-12 h-12 text-muted-foreground opacity-40" />
      <p className="text-muted-foreground">{t("axisBiz.reports.noOrg")}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("axisBiz.reports.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("axisBiz.reports.analysisSubtitle")} · {activeOrg.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground transition-all" data-testid="button-export-csv">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={handleExportExcel} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl text-white transition-all" style={{ background: "#10B981" }} data-testid="button-export-excel">
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">{t("axisBiz.reports.period")}</label>
          <Select value={period} onValueChange={v => setPeriod(v as Period)}>
            <SelectTrigger className="h-9 text-xs" data-testid="select-period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this_month">{t("axisBiz.reports.thisMonth")}</SelectItem>
              <SelectItem value="last_month">{t("axisBiz.reports.lastMonth")}</SelectItem>
              <SelectItem value="last_3_months">{t("axisBiz.reports.last3Months")}</SelectItem>
              <SelectItem value="this_year">{t("axisBiz.reports.thisYear")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isCollaborator && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">{t("axisBiz.reports.collaborator")}</label>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="h-9 text-xs" data-testid="select-filter-user"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("axisBiz.reports.allCollaborators")}</SelectItem>
                {members?.map((m: any) => (
                  <SelectItem key={m.userId} value={m.userId}>{m.userName || m.userEmail}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">{t("axisBiz.reports.categoryFilter")}</label>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-9 text-xs" data-testid="select-filter-category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("axisBiz.reports.allCategories")}</SelectItem>
              {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: t("axisBiz.reports.periodTotal"), value: formatBRL(metrics.total), color: primaryHex, Icon: TrendingUp },
          { label: t("axisBiz.expenses.statusApproved"), value: formatBRL(metrics.approvedTotal), color: "#10B981", Icon: CheckCircle2 },
          { label: t("axisBiz.expenses.statusPending"), value: `${metrics.pendingCount} ${t("axisBiz.reports.expenseCount", { count: metrics.pendingCount })}`, color: "#F59E0B", Icon: Clock, sub: metrics.pendingCount > 0 ? formatBRL(metrics.pendingTotal) : undefined },
          { label: t("axisBiz.expenses.statusRejected"), value: `${metrics.rejectedCount} ${t("axisBiz.reports.expenseCount", { count: metrics.rejectedCount })}`, color: "#EF4444", Icon: XCircle },
        ].map((card, i) => (
          <div key={i} className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }} data-testid={`card-report-metric-${i}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <card.Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
            </div>
            <p className="text-lg font-bold" style={{ color: card.color }}>{card.value}</p>
            {card.sub && <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>}
          </div>
        ))}
      </div>

      {expLoading ? (
        <div className="flex flex-col gap-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : (
        <div className={`grid grid-cols-1 ${!isCollaborator ? "sm:grid-cols-2" : ""} gap-4 mb-6`}>
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t("axisBiz.reports.byCategory")}</p>
            {byCategory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("axisBiz.reports.noDataForPeriod")}</p>
            ) : byCategory.map(([cat, total]) => (
              <div key={cat} className="mb-3" data-testid={`row-category-${cat}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-foreground">{cat}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{metrics.total > 0 ? Math.round((total / metrics.total) * 100) : 0}%</span>
                    <span className="text-xs font-semibold text-foreground">{formatBRL(total)}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(total / maxCategory) * 100}%`, background: primaryHex }} />
                </div>
              </div>
            ))}
          </div>

          {!isCollaborator && (
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t("axisBiz.reports.byCollaborator")}</p>
              {byCollaborator.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("axisBiz.reports.noDataForPeriod")}</p>
              ) : byCollaborator.map(([userId, data]) => (
                <div key={userId} className="mb-3" data-testid={`row-collab-${userId}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <MemberAvatar name={data.name} email={data.email} hex={primaryHex} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-foreground truncate">{data.name || data.email}</span>
                        <span className="text-xs font-semibold text-foreground ml-2">{formatBRL(data.total)}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{data.count} {t("axisBiz.reports.expenseCount", { count: data.count })}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(data.total / maxCollab) * 100}%`, background: palette.colaboradores }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {expenses && expenses.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("axisBiz.reports.detailedExpenses")}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  {[
                    t("axisBiz.expenses.date"),
                    t("axisBiz.reports.collaborator"),
                    t("axisBiz.expenses.category"),
                    t("axisBiz.expenses.description"),
                    t("axisBiz.expenses.amount"),
                    t("axisBiz.reports.statusHeader"),
                  ].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-muted-foreground font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expenses.map((e: any) => (
                  <tr key={e.id} className="border-b hover:bg-white/[0.015] transition-colors" style={{ borderColor: "rgba(255,255,255,0.04)" }} data-testid={`row-report-expense-${e.id}`}>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{e.date ? format(new Date(e.date), "dd/MM/yy") : "—"}</td>
                    <td className="px-4 py-3 text-foreground">{e.userName || e.userEmail || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.categoryName || "—"}</td>
                    <td className="px-4 py-3 text-foreground max-w-[180px] truncate">{e.establishment || e.description || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{formatBRL(e.amount)}</td>
                    <td className="px-4 py-3"><StatusBadge status={e.status} t={t} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
