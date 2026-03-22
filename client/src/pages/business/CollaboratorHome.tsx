import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ReceiptText, Clock, CheckCircle2, Wallet, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBusinessTheme, getBusinessPrimaryHex } from "@/components/theme-provider";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  if (status === "approved") return <Badge className="text-[10px] font-semibold" style={{ background: "#10B98115", color: "#10B981", border: "1px solid #10B98130" }}>{t("axisBiz.expenses.statusApproved")}</Badge>;
  if (status === "rejected") return <Badge className="text-[10px] font-semibold" style={{ background: "#EF444415", color: "#EF4444", border: "1px solid #EF444430" }}>{t("axisBiz.expenses.statusRejected")}</Badge>;
  if (status === "paid") return <Badge className="text-[10px] font-semibold" style={{ background: "#6366F115", color: "#818CF8", border: "1px solid #6366F130" }}>{t("axisBiz.expenses.statusPaid")}</Badge>;
  return <Badge className="text-[10px] font-semibold" style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30" }}>{t("axisBiz.expenses.statusPending")}</Badge>;
}

export default function CollaboratorHome() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);

  const { data: orgs, isLoading: orgsLoading } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const activeOrg = orgs?.[0];

  const { data: allExpenses, isLoading: expLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "expenses", user?.id],
    queryFn: async () => {
      if (!activeOrg?.id || !user?.id) return [];
      const res = await fetch(`/api/business/organizations/${activeOrg.id}/expenses?userId=${user.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
    enabled: !!activeOrg?.id && !!user?.id,
  });

  const { data: members } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "members"],
    enabled: !!activeOrg?.id,
  });

  const myMember = useMemo(() => members?.find((m: any) => m.userId === user?.id), [members, user?.id]);

  const spendingLimits: Record<string, number> = useMemo(() => {
    try { return activeOrg?.spendingLimits ? JSON.parse(activeOrg.spendingLimits) : {}; }
    catch { return {}; }
  }, [activeOrg?.spendingLimits]);

  const myLimit = user?.id ? spendingLimits[user.id] : undefined;

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const stats = useMemo(() => {
    const expenses = allExpenses ?? [];
    const thisMonth = expenses.filter(e => {
      if (!e.date) return false;
      return isWithinInterval(new Date(e.date), { start: monthStart, end: monthEnd });
    });
    const totalMonth = thisMonth.filter(e => e.status !== "rejected").reduce((s, e) => s + e.amount, 0);
    const pending = expenses.filter(e => e.status === "pending_review").length;
    const approvedMonth = thisMonth.filter(e => e.status === "approved" || e.status === "paid").length;
    const aReceber = expenses.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0);
    return { totalMonth, pending, approvedMonth, aReceber };
  }, [allExpenses]);

  const recentExpenses = useMemo(() => (allExpenses ?? []).slice(0, 5), [allExpenses]);

  const topCategories = useMemo(() => {
    const expenses = (allExpenses ?? []).filter(e => {
      if (!e.date) return false;
      return isWithinInterval(new Date(e.date), { start: monthStart, end: monthEnd });
    });
    const byCategory: Record<string, number> = {};
    for (const e of expenses) {
      if (e.categoryName) byCategory[e.categoryName] = (byCategory[e.categoryName] ?? 0) + e.amount;
    }
    return Object.entries(byCategory).sort(([, a], [, b]) => b - a).slice(0, 5);
  }, [allExpenses]);

  const maxCategory = topCategories[0]?.[1] ?? 1;

  const isLoading = orgsLoading || expLoading;

  if (isLoading) return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );

  const greeting = () => {
    const h = now.getHours();
    if (h < 12) return t("axisBiz.collabHome.greeting.morning");
    if (h < 18) return t("axisBiz.collabHome.greeting.afternoon");
    return t("axisBiz.collabHome.greeting.evening");
  };

  const statCards = [
    { label: t("axisBiz.collabHome.statMonthTotal"), value: formatBRL(stats.totalMonth), icon: ReceiptText, color: primaryHex },
    { label: t("axisBiz.collabHome.statPendingApproval"), value: stats.pending.toString(), icon: Clock, color: "#F59E0B" },
    { label: t("axisBiz.collabHome.statApprovedMonth"), value: stats.approvedMonth.toString(), icon: CheckCircle2, color: "#10B981" },
    { label: t("axisBiz.collabHome.statToReceive"), value: formatBRL(stats.aReceber), icon: Wallet, color: "#818CF8" },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">
            {greeting()}, {user?.firstName || t("axisBiz.collabHome.defaultName")} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {myMember?.jobTitle && <span>{myMember.jobTitle} · </span>}
            {activeOrg?.tradeName || activeOrg?.name}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
              className="rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
              data-testid={`stat-card-${i}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${card.color}18` }}>
                  <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                </div>
              </div>
              <p className="text-lg font-bold text-foreground leading-tight" data-testid={`stat-value-${i}`}>{card.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{card.label}</p>
            </motion.div>
          ))}
        </div>

        {myLimit !== undefined && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.28 }}
            className="rounded-2xl p-5 mb-6"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">{t("axisBiz.collabHome.spendingLimit")}</p>
              <span className="text-xs text-muted-foreground">
                {formatBRL(stats.totalMonth)} / {formatBRL(myLimit)}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min((stats.totalMonth / myLimit) * 100, 100)}%`,
                  background: stats.totalMonth > myLimit ? "#EF4444" : primaryHex,
                }}
              />
            </div>
            {stats.totalMonth > myLimit && (
              <div className="flex items-center gap-1.5 mt-2">
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                <p className="text-xs text-red-400">{t("axisBiz.collabHome.limitExceeded", { amount: formatBRL(stats.totalMonth - myLimit) })}</p>
              </div>
            )}
          </motion.div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {topCategories.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.32 }}
              className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t("axisBiz.collabHome.byCategory")}</p>
              {topCategories.map(([cat, total]) => (
                <div key={cat} className="mb-3" data-testid={`collab-cat-${cat}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-foreground truncate">{cat}</span>
                    <span className="text-xs font-semibold text-foreground ml-2">{formatBRL(total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(total / maxCategory) * 100}%`, background: primaryHex }}
                    />
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.38 }}
            className="rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">{t("axisBiz.collabHome.recentExpenses")}</p>
            {recentExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2">
                <ReceiptText className="w-8 h-8 text-muted-foreground opacity-30" />
                <p className="text-xs text-muted-foreground">{t("axisBiz.collabHome.noExpenses")}</p>
              </div>
            ) : recentExpenses.map((expense: any) => (
              <div key={expense.id} className="mb-3 last:mb-0" data-testid={`recent-expense-${expense.id}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-xs font-medium text-foreground truncate">
                      {expense.establishment || expense.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {expense.date ? format(new Date(expense.date), "dd MMM", { locale: ptBR }) : "—"}
                      {expense.categoryName && ` · ${expense.categoryName}`}
                    </p>
                    {expense.status === "rejected" && expense.rejectionComment && (
                      <div className="flex items-start gap-1 mt-1 p-1.5 rounded-lg" style={{ background: "#EF444408", border: "1px solid #EF444425" }}>
                        <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                        <p className="text-[10px] text-red-400 leading-snug">{expense.rejectionComment}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <p className="text-xs font-bold text-foreground">{formatBRL(expense.amount)}</p>
                    <StatusBadge status={expense.status} t={t} />
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
