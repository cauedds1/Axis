import { useState } from "react";
import { formatTxDescription } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useTheme, getModulePalette } from "@/components/theme-provider";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  DollarSign, CheckSquare, Flame, Calendar, TrendingUp, TrendingDown,
  Target, Clock, Zap, AlertCircle, Star, BarChart2, ShoppingBag, Wallet,
  ArrowUpRight, ArrowDownRight, Receipt, CalendarDays, ChevronDown,
} from "lucide-react";

function getReportPalette(theme: string) {
  const P = getModulePalette(theme as any);
  return { ...P, schedule: P.agenda };
}

function getPieColors(theme: string): string[] {
  const P = getModulePalette(theme as any);
  if (theme.startsWith("high")) {
    return [P.primary, P.finance, P.agenda, P.tasks, P.habits, P.positive, P.negative, P.primary + "99"];
  }
  return [P.primary, P.finance, P.agenda, P.tasks, P.habits, P.primary + "CC", P.primary + "99", P.primary + "66"];
}

function CustomTooltip({ active, payload, label, fmtValue }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card shadow-xl p-3 text-xs min-w-[120px]">
      {label && <p className="font-semibold text-foreground mb-2">{label}</p>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3 mb-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color || p.fill }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-semibold text-foreground">{typeof p.value === "number" && fmtValue ? fmtValue(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color, trend }: { icon: any; label: string; value: string | number; sub?: string; color: string; trend?: { value: number; label: string } }) {
  return (
    <div
      className="rounded-2xl border bg-card p-4 flex items-start gap-3"
      style={{ borderColor: `${color}18` }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${color}15` }}>
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      {trend && (
        <div className={`absolute top-3 right-3 inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${trend.value >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-400/10 text-red-400"}`}>
          {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(trend.value)}%
        </div>
      )}
      <div>
        <p className="text-2xl font-bold text-foreground leading-none mb-1" data-testid={`metric-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5 opacity-70">{sub}</p>}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mt-6 mb-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</p>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <div className="py-12 flex flex-col items-center gap-3 text-center">
      <Icon className="h-10 w-10 opacity-10" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function PriorityBar({ label, total, completed, color }: { label: string; total: number; completed: number; color: string }) {
  const pct = total > 0 ? (completed / total) * 100 : 0;
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{completed}/{total}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ======================== FINANCE TAB ========================
function TrendBadge({ value, invertColor = false }: { value: number | null; invertColor?: boolean }) {
  if (value === null) return null;
  const isPositive = value >= 0;
  const isGood = invertColor ? !isPositive : isPositive;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-lg ${isGood ? "bg-green-500/10 text-green-500" : "bg-red-400/10 text-red-400"}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}%
    </span>
  );
}

type DateFilter = "current" | "last" | "last3" | "last6" | "custom";

function getFilterDates(filter: DateFilter, customStart: string, customEnd: string): { startDate: string; endDate: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (filter === "current") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: fmt(start), endDate: fmt(end) };
  }
  if (filter === "last") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { startDate: fmt(start), endDate: fmt(end) };
  }
  if (filter === "last3") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: fmt(start), endDate: fmt(end) };
  }
  if (filter === "last6") {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { startDate: fmt(start), endDate: fmt(end) };
  }
  return { startDate: customStart, endDate: customEnd };
}

function FinanceReport({ color, isHigh }: { color: string; isHigh: boolean }) {
  const { t, i18n } = useTranslation();
  const { fmtMoney, symbol } = useCurrency();
  const dateLocale = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
  const { theme } = useTheme();
  const RP = getReportPalette(theme);
  const [txFilter, setTxFilter] = useState<"all" | "expense" | "income">("all");
  const [filter, setFilter] = useState<DateFilter>("current");
  const [customStart, setCustomStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [customEnd, setCustomEnd] = useState(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
  });
  const [showCustom, setShowCustom] = useState(false);

  const { startDate, endDate } = getFilterDates(filter, customStart, customEnd);
  const queryUrl = `/api/reports/finance?startDate=${startDate}&endDate=${endDate}`;

  const { data, isLoading } = useQuery<any>({ queryKey: [queryUrl] });
  const pieColors = getPieColors(theme);

  const FILTER_OPTS: { id: DateFilter; label: string }[] = [
    { id: "current", label: t("axisReports.filterCurrent") },
    { id: "last", label: t("axisReports.filterLast") },
    { id: "last3", label: t("axisReports.filterLast3") },
    { id: "last6", label: t("axisReports.filterLast6") },
    { id: "custom", label: t("axisReports.filterCustom") },
  ];

  const pmColors: Record<string, string> = {
    debit: RP.tasks,
    credit: RP.negative,
    pix: RP.positive,
    cash: RP.schedule,
    other: RP.primary,
  };

  const { summary, currentMonth, monthly, byCategory, currentMonthByCategory, dailyThisMonth, groupByWeek, byPaymentMethod, byEstablishment, byHour, byTimePeriod, peakHour, recentTransactions, goals, periodStartIso, periodEndIso, isSingleMonth } = data || {};

  const filteredTx = recentTransactions?.filter((tx: any) => txFilter === "all" || tx.type === txFilter) || [];
  const hasMonthlyData = monthly?.some((m: any) => m.income > 0 || m.expenses > 0) ?? false;
  const hasDailyData = dailyThisMonth?.some((d: any) => d.expenses > 0) ?? false;

  const buildPeriodLabel = (): string => {
    if (!periodStartIso) return "";
    const start = new Date(periodStartIso + "T00:00:00");
    const end = new Date(periodEndIso + "T00:00:00");
    if (isSingleMonth) {
      return start.toLocaleDateString(dateLocale, { month: "long", year: "numeric" });
    }
    const fmtShort = (d: Date) => d.toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "2-digit" });
    return `${fmtShort(start)} – ${fmtShort(end)}`;
  };

  const periodLabel = buildPeriodLabel();
  const capitalizedMonth = periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1);

  const PM_LABEL_KEYS: Record<string, string> = {
    debit: "axisReports.pmDebit",
    credit: "axisReports.pmCredit",
    pix: "axisReports.pmPix",
    cash: "axisReports.pmCash",
    other: "axisReports.pmOther",
    unknown: "axisReports.pmUnknown",
  };

  const TIME_LABEL_KEYS: Record<string, string> = {
    dawn: "axisReports.timeDawn",
    morning: "axisReports.timeMorning",
    afternoon: "axisReports.timeAfternoon",
    evening: "axisReports.timeEvening",
  };

  const localizedMonthly = monthly?.map((m: any) => ({
    ...m,
    month: new Date(m.monthKey + "-01").toLocaleDateString(dateLocale, { month: "short", year: "2-digit" }),
  })) ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>

      {/* ══ FILTROS DE PERÍODO ══ */}
      <div className="mt-4 mb-2 flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTS.map(opt => {
            const isActive = filter === opt.id;
            return (
              <button
                key={opt.id}
                data-testid={`filter-${opt.id}`}
                onClick={() => {
                  setFilter(opt.id);
                  setShowCustom(opt.id === "custom");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200"
                style={isActive
                  ? { background: `${color}18`, color, borderColor: `${color}40` }
                  : { background: "transparent", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" }
                }
              >
                <CalendarDays className="h-3 w-3" />
                {opt.label}
              </button>
            );
          })}
        </div>
        {showCustom && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border bg-card">
            <span className="text-xs text-muted-foreground font-medium">{t("axisReports.filterFrom")}</span>
            <input
              type="date"
              data-testid="input-custom-start"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground font-medium">{t("axisReports.filterTo")}</span>
            <input
              type="date"
              data-testid="input-custom-end"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="space-y-4 mt-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}
        </div>
      )}
      {!isLoading && !data && <EmptyState icon={DollarSign} message={t("axisReports.noFinanceData")} />}
      {!isLoading && data && <>

      {/* ══ ROW 1: Hero mês + Categorias do mês ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mt-4">

        {/* Left: Hero card + daily chart */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          {/* Hero */}
          <div className="rounded-2xl border p-5 flex-1" style={{ borderColor: `${color}20`, background: `${color}06` }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">{t("axisReports.selectedPeriod")}</p>
                <h2 className="text-2xl font-bold">{capitalizedMonth}</h2>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                <Wallet className="h-5 w-5" style={{ color }} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-background/60 border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("axisReports.income")}</p>
                <p className="text-xl font-bold" style={{ color: RP.positive }} data-testid="metric-receitas-mes">
                  {fmtMoney(currentMonth.income)}
                </p>
                <TrendBadge value={currentMonth.incomeTrend} invertColor={false} />
              </div>
              <div className="rounded-xl bg-background/60 border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("axisReports.expenses")}</p>
                <p className="text-xl font-bold" style={{ color: RP.negative }} data-testid="metric-gastos-mes">
                  {fmtMoney(currentMonth.expenses)}
                </p>
                <TrendBadge value={currentMonth.expenseTrend} invertColor={true} />
              </div>
              <div className="rounded-xl bg-background/60 border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{t("axisReports.balance")}</p>
                <p className="text-xl font-bold" style={{ color: currentMonth.balance >= 0 ? (RP.positive) : (RP.negative) }} data-testid="metric-saldo-mes">
                  {fmtMoney(currentMonth.balance)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{currentMonth.savingsRate}% {t("axisReports.saved")}</p>
              </div>
            </div>

            {currentMonth.income > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{t("axisReports.expensesVsIncome")}</span>
                  <span>{Math.min(100, Math.round((currentMonth.expenses / currentMonth.income) * 100))}{t("axisReports.ofIncome")}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (currentMonth.expenses / currentMonth.income) * 100)}%`, background: currentMonth.expenses <= currentMonth.income ? (RP.positive) : (RP.negative) }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>{fmtMoney(currentMonth.expenses)} {t("axisReports.spentLabel")}</span>
                  <span>{fmtMoney(currentMonth.income)} {t("axisReports.receivedLabel")}</span>
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
              <span>{currentMonth.transactionCount} {t("axisReports.transactions")}</span>
              {currentMonth.topCategory !== "N/A" && <span>{t("axisReports.topSpend")} <strong className="text-foreground">{currentMonth.topCategory}</strong></span>}
            </div>
          </div>

          {/* Daily chart */}
          <div className="rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t("axisReports.spendByPeriod")} {groupByWeek ? t("axisReports.week") : t("axisReports.day")} — {capitalizedMonth}</p>
            {hasDailyData ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dailyThisMonth} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.10)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `${symbol}${v}`} />
                  <Tooltip content={<CustomTooltip fmtValue={fmtMoney} />} />
                  <Bar dataKey="expenses" name={t("axisReports.expenses")} fill={RP.negative} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">{t("axisReports.noSpendPeriod")}</p>
            )}
          </div>
        </div>

        {/* Right: Categories + Payment methods */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          {/* Categories this month */}
          <div className="rounded-2xl border bg-card p-5 flex-1" style={{ borderColor: `${color}12` }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">{t("axisReports.categoriesMonth")} {capitalizedMonth.split(" ")[0]}</p>
            {currentMonthByCategory?.length > 0 ? (
              currentMonthByCategory.map((cat: any, i: number) => (
                <div key={cat.name} className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ background: pieColors[i % pieColors.length] }} />
                      <span className="text-sm font-medium">{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{cat.pct}%</span>
                      <span className="text-sm font-semibold">{fmtMoney(cat.amount)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cat.pct}%`, background: pieColors[i % pieColors.length] }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t("axisReports.noCategorizedSpend")}</p>
            )}
          </div>

          {/* Payment methods */}
          {byPaymentMethod?.filter((p: any) => p.key !== "unknown").length > 0 && (
            <div className="rounded-2xl border bg-card p-5" style={{ borderColor: `${color}12` }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">{t("axisReports.paymentMethod")}</p>
              <div className="grid grid-cols-2 gap-2">
                {byPaymentMethod.filter((p: any) => p.key !== "unknown").map((pm: any, i: number) => {
                  const c = pmColors[pm.key] || color;
                  const isTop = i === 0;
                  const pmLabel = PM_LABEL_KEYS[pm.key] ? t(PM_LABEL_KEYS[pm.key]) : pm.key;
                  return (
                    <div key={pm.key} className="rounded-xl border p-3 flex flex-col gap-1" style={isTop ? { borderColor: `${c}30`, background: `${c}08` } : {}} data-testid={`payment-method-${pm.key}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold">{pmLabel}</p>
                        {isTop && <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase" style={{ background: `${c}15`, color: c }}>↑</span>}
                      </div>
                      <p className="text-base font-bold" style={{ color: c }}>{fmtMoney(pm.amount)}</p>
                      <p className="text-[10px] text-muted-foreground">{pm.count}x</p>
                      <div className="h-1 rounded-full bg-muted overflow-hidden mt-0.5">
                        <div className="h-full rounded-full" style={{ width: `${pm.pct}%`, background: c }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ ROW 2: 6-month chart + Establishments ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mt-4">

        {/* 6-month area chart */}
        <div className="xl:col-span-3 rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t("axisReports.history6Months")}</p>
          {hasMonthlyData ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={localizedMonthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={RP.positive} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={RP.positive} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={RP.negative} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={RP.negative} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.10)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `${symbol}${v}`} />
                <Tooltip content={<CustomTooltip fmtValue={fmtMoney} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="income" name={t("axisReports.income")} stroke={RP.positive} fill="url(#colorIncome)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="expenses" name={t("axisReports.expenses")} stroke={RP.negative} fill="url(#colorExpenses)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-20">{t("axisReports.addTransactions")}</p>
          )}
        </div>

        {/* Establishments */}
        {byEstablishment?.length > 0 && (
          <div className="xl:col-span-2 rounded-2xl border bg-card p-5" style={{ borderColor: `${color}12` }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">{t("axisReports.topSpendPlaces")}</p>
            {byEstablishment.slice(0, 7).map((place: any, i: number) => {
              const barColor = pieColors[i % pieColors.length];
              return (
                <div key={place.name} className="mb-3 last:mb-0" data-testid={`establishment-${i}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: `${barColor}18`, color: barColor }}>{i + 1}</div>
                      <span className="text-sm font-medium truncate">{formatTxDescription(place.name)}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] text-muted-foreground">{place.count}x</span>
                      <span className="text-xs font-semibold">{fmtMoney(place.amount)}</span>
                    </div>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${place.pct}%`, background: barColor }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ ROW 3: When + Summary metrics ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mt-4">
          {/* Time periods + hour chart */}
          <div className="xl:col-span-3 rounded-2xl border bg-card p-5" style={{ borderColor: `${color}12` }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">{t("axisReports.whenYouSpend")}</p>
            {!byTimePeriod?.some((p: any) => p.amount > 0) ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {t("axisReports.noTimeData")}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {byTimePeriod.map((period: any) => {
                    const isTopPeriod = period.amount === Math.max(...byTimePeriod.map((p: any) => p.amount));
                    const periodLabel = TIME_LABEL_KEYS[period.key] ? t(TIME_LABEL_KEYS[period.key]) : period.key;
                    return (
                      <div key={period.key} className="rounded-xl border p-3 flex flex-col gap-1" style={isTopPeriod ? { borderColor: `${color}30`, background: `${color}08` } : {}} data-testid={`time-period-${period.key}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-base">{period.emoji}</span>
                          {isTopPeriod && <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase" style={{ background: `${color}15`, color }}>{t("axisReports.peak")}</span>}
                        </div>
                        <p className="text-xs font-semibold">{periodLabel}</p>
                        <p className="text-sm font-bold" style={{ color: isTopPeriod ? color : "inherit" }}>{fmtMoney(period.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">{period.count}x</p>
                        <div className="h-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${period.pct}%`, background: isTopPeriod ? color : "hsl(var(--muted-foreground))" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {byHour?.some((h: any) => h.amount > 0) && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">{t("axisReports.spendByHour")}</p>
                      {peakHour && <span className="text-xs font-semibold" style={{ color }}>{t("axisReports.peakLabel")} {peakHour}</span>}
                    </div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={byHour} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.08)" />
                        <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={3} />
                        <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `${symbol}${v}`} />
                        <Tooltip content={<CustomTooltip fmtValue={fmtMoney} />} />
                        <Bar dataKey="amount" name={t("axisReports.expenses")} radius={[3, 3, 0, 0]}>
                          {byHour.map((entry: any, i: number) => <Cell key={i} fill={entry.hour === peakHour ? color : `${color}40`} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </>
                )}
              </>
            )}
          </div>

          {/* 6-month summary metrics */}
          <div className="xl:col-span-2 grid grid-cols-2 gap-3 content-start">
            <MetricCard icon={TrendingUp} label={t("axisReports.income")} value={fmtMoney(summary.totalIncome ?? 0)} color={RP.positive} />
            <MetricCard icon={TrendingDown} label={t("axisReports.expenses")} value={fmtMoney(summary.totalExpenses ?? 0)} color={RP.negative} />
            <MetricCard icon={ShoppingBag} label={t("axisReports.filterLast6")} value={fmtMoney(summary.avgMonthlyExpense ?? 0)} sub={t("axisReports.spentLabel")} color={color} />
            <MetricCard icon={Target} label={t("axisReports.completionRate")} value={`${summary.savingsRate}%`} sub={`${summary.transactionCount ?? 0} ${t("axisReports.transactions")}`} color={color} />

            {/* Global pie + goals in same column */}
            {byCategory.length > 0 && (
              <div className="col-span-2 rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{t("axisReports.categories6Months")}</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={byCategory} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={65} paddingAngle={2}>
                      {byCategory.map((_: any, i: number) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip fmtValue={fmtMoney} />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

      {/* ══ Goals ══ */}
      {goals?.length > 0 && (
        <>
          <SectionTitle>{t("axisReports.financialGoals")}</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {goals.map((g: any) => {
              const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
              const remaining = Number(g.targetAmount) - Number(g.currentAmount || 0);
              return (
                <div key={g.id} className="rounded-xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">{g.title}</span>
                    <span className="text-xs font-bold" style={{ color }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[11px] text-muted-foreground">{fmtMoney(Number(g.currentAmount || 0))} {t("axisReports.saved2")}</span>
                    <span className="text-[11px] text-muted-foreground">{t("axisReports.remaining")} {remaining > 0 ? remaining.toFixed(0) : "0"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ══ Transactions ══ */}
      <div className="flex items-center justify-between mt-6 mb-4">
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t("axisReports.txHistory")}</p>
          <div className="h-px bg-border flex-1 w-8" />
        </div>
        <div className="flex gap-1 ml-4">
          {(["all", "expense", "income"] as const).map(f => (
            <button key={f} onClick={() => setTxFilter(f)} data-testid={`filter-tx-${f}`} className="px-3 py-1 rounded-lg text-xs font-medium transition-all" style={txFilter === f ? { background: `${color}18`, color, border: `1px solid ${color}30` } : { color: "hsl(var(--muted-foreground))", border: "1px solid transparent" }}>
              {f === "all" ? t("axisReports.txAll") : f === "expense" ? t("axisReports.txExpenses") : t("axisReports.txIncome")}
            </button>
          ))}
        </div>
      </div>

      {filteredTx.length > 0 ? (
        <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: `${color}12` }}>
          <div className="grid grid-cols-1 xl:grid-cols-2">
            {filteredTx.map((tx: any, i: number) => {
              const isIncome = tx.type === "income";
              const txColor = isIncome ? (RP.positive) : (RP.negative);
              const isLastInCol = i === filteredTx.length - 1 || i === filteredTx.length - 2;
              return (
                <div key={tx.id} className={`flex items-center justify-between px-4 py-3 border-b border-border xl:${i % 2 === 0 && i < filteredTx.length - 1 ? "border-r" : ""} ${isLastInCol ? "border-b-0" : ""}`} data-testid={`tx-row-${tx.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${txColor}12` }}>
                      {isIncome ? <ArrowUpRight className="h-4 w-4" style={{ color: txColor }} /> : <Receipt className="h-4 w-4" style={{ color: txColor }} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{formatTxDescription(tx.description)}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground flex-wrap">
                        {tx.establishment && <><span className="font-medium text-foreground/60">{tx.establishment}</span><span>·</span></>}
                        <span>{tx.categoryName || t("axisReports.noCategory")}</span>
                        <span>·</span>
                        <span>{new Date(tx.date).toLocaleDateString(dateLocale, { day: "2-digit", month: "short" })}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold ml-3 flex-shrink-0" style={{ color: txColor }}>
                    {isIncome ? "+" : "-"}{fmtMoney(Number(tx.amount))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : <EmptyState icon={DollarSign} message={t("axisReports.noTransactions")} />}

      </>}
    </motion.div>
  );
}

// ======================== TASKS TAB ========================
function TasksReport({ color, isHigh }: { color: string; isHigh: boolean }) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
  const { theme } = useTheme();
  const RP = getReportPalette(theme);
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/reports/tasks"] });

  if (isLoading) return <div className="space-y-4 mt-4">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>;
  if (!data) return <EmptyState icon={CheckSquare} message={t("axisReports.noTaskData")} />;

  const { summary, byPriority, byCategory, urgentPending } = data;

  const barData = [
    { name: t("axisReports.completedMetric"), value: summary.completed, color },
    { name: t("axisReports.pendingMetric"), value: summary.pending, color: "hsl(var(--muted-foreground))" },
    { name: t("axisReports.overdueCount"), value: summary.overdue, color: RP.negative },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <MetricCard icon={CheckSquare} label={t("axisReports.totalMetric")} value={summary.total} color={color} />
        <MetricCard icon={Star} label={t("axisReports.completedMetric")} value={summary.completed} color={RP.positive} />
        <MetricCard icon={Clock} label={t("axisReports.pendingMetric")} value={summary.pending} color={color} />
        <MetricCard icon={Target} label={t("axisReports.completionRate")} value={`${summary.completionRate}%`} sub={summary.overdue > 0 ? `${summary.overdue} ${t("axisReports.overdueCount")}` : t("axisReports.onTime")} color={summary.completionRate >= 70 ? (RP.positive) : (RP.negative)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-2">
        <div>
          <SectionTitle>{t("axisReports.priorityByTitle")}</SectionTitle>
          <div className="rounded-2xl border bg-card p-5" style={{ borderColor: `${color}12` }}>
            <PriorityBar label={t("axisReports.highPriority")} total={byPriority.high.total} completed={byPriority.high.completed} color={RP.negative} />
            <PriorityBar label={t("axisReports.medPriority")} total={byPriority.medium.total} completed={byPriority.medium.completed} color={RP.schedule} />
            <PriorityBar label={t("axisReports.lowPriority")} total={byPriority.low.total} completed={byPriority.low.completed} color={RP.positive} />
          </div>
        </div>

        <div>
          <SectionTitle>{t("axisReports.overview")}</SectionTitle>
          <div className="rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name={t("axisReports.qty")} radius={[6, 6, 0, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {byCategory.length > 0 && (
        <>
          <SectionTitle>{t("axisReports.byCategory")}</SectionTitle>
          <div className="rounded-2xl border bg-card p-5" style={{ borderColor: `${color}12` }}>
            {byCategory.map((cat: any) => (
              <PriorityBar key={cat.name} label={cat.name === "general" ? t("axisReports.categoryGeneral") : cat.name} total={cat.count} completed={cat.completed} color={color} />
            ))}
          </div>
        </>
      )}

      <SectionTitle>{t("axisReports.urgentPending")}</SectionTitle>
      {urgentPending?.length > 0 ? (
        <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: `${color}12` }}>
          {urgentPending.map((task: any, i: number) => (
            <div key={task.id} className={`flex items-center gap-3 px-4 py-3 ${i < urgentPending.length - 1 ? "border-b border-border" : ""}`}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: RP.negative }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid={`report-urgent-${task.id}`}>{task.title}</p>
                {task.dueDate && <p className="text-[11px] text-muted-foreground">{t("axisReports.dueDate")} {new Date(task.dueDate).toLocaleDateString(dateLocale)}</p>}
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: `${RP.negative}15`, color: RP.negative }}>{t("axisReports.highLabel")}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <Star className="h-8 w-8 mx-auto mb-2 opacity-15" />
          <p className="text-sm text-muted-foreground">{t("axisReports.noUrgentTasks")}</p>
        </div>
      )}
    </motion.div>
  );
}

const DAY_KEY_MAP: Record<string, string> = {
  sun: "axisReports.daySun",
  mon: "axisReports.dayMon",
  tue: "axisReports.dayTue",
  wed: "axisReports.dayWed",
  thu: "axisReports.dayThu",
  fri: "axisReports.dayFri",
  sat: "axisReports.daySat",
};

// ======================== HABITS TAB ========================
function HabitsReport({ color, isHigh }: { color: string; isHigh: boolean }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const RP = getReportPalette(theme);
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/reports/habits"] });

  if (isLoading) return <div className="space-y-4 mt-4">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>;
  if (!data) return <EmptyState icon={Flame} message={t("axisReports.noHabitData")} />;

  const { summary, habits, weeklyConsistency } = data;
  const localizedWeekly = weeklyConsistency?.map((d: any) => ({
    ...d,
    day: DAY_KEY_MAP[d.day] ? t(DAY_KEY_MAP[d.day]) : d.day,
  })) ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <MetricCard icon={Flame} label={t("axisReports.totalHabits")} value={summary.totalHabits} color={color} />
        <MetricCard icon={Star} label={t("axisReports.bestStreak")} value={`${summary.bestStreak}d`} sub={summary.bestHabit} color={RP.positive} />
        <MetricCard icon={Target} label={t("axisReports.avgStreak")} value={`${summary.avgStreak}d`} color={color} />
        <MetricCard icon={CheckSquare} label={t("axisReports.checkins30")} value={summary.totalCheckinsMonth} color={RP.positive} />
      </div>

      <SectionTitle>{t("axisReports.weeklyConsistency")}</SectionTitle>
      <div className="rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={localizedWeekly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="completions" name={t("axisReports.checkins30")} fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionTitle>{t("axisReports.habitsStreak")}</SectionTitle>
      {habits?.length > 0 ? (
        <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: `${color}12` }}>
          {habits.map((h: any, i: number) => {
            const streakColor = isHigh
              ? h.streak >= 7 ? RP.positive : h.streak >= 3 ? RP.schedule : RP.negative
              : RP.primary;
            return (
              <div key={h.id} className={`px-5 py-4 ${i < habits.length - 1 ? "border-b border-border" : ""}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Flame className="h-4 w-4" style={{ color: streakColor }} />
                    <span className="text-sm font-medium" data-testid={`report-habit-${h.id}`}>{h.name}</span>
                    <span className="text-[11px] text-muted-foreground capitalize">{h.frequency === "daily" ? t("axisReports.daily") : t("axisReports.weekly")}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-bold" style={{ color: streakColor }}>{h.streak}d {t("axisReports.streak")}</span>
                    <span className="text-muted-foreground">{h.completionRate}% {t("axisReports.consistency")}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${h.completionRate}%`, background: streakColor }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : <EmptyState icon={Flame} message={t("axisReports.noHabitsYet")} />}
    </motion.div>
  );
}

// ======================== SCHEDULE TAB ========================
function ScheduleReport({ color, isHigh }: { color: string; isHigh: boolean }) {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
  const { theme } = useTheme();
  const RP = getReportPalette(theme);
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/reports/schedule"] });

  if (isLoading) return <div className="space-y-4 mt-4">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>;
  if (!data) return <EmptyState icon={Calendar} message={t("axisReports.noScheduleData")} />;

  const { summary, byDayOfWeek, upcoming, overdue } = data;
  const localizedByDay = byDayOfWeek?.map((d: any) => ({
    ...d,
    day: DAY_KEY_MAP[d.day] ? t(DAY_KEY_MAP[d.day]) : d.day,
  })) ?? [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <MetricCard icon={Calendar} label={t("axisReports.totalEvents")} value={summary.total} color={color} />
        <MetricCard icon={CheckSquare} label={t("axisReports.completedMetric")} value={summary.completed} color={RP.positive} />
        <MetricCard icon={Target} label={t("axisReports.completionRate")} value={`${summary.completionRate}%`} color={summary.completionRate >= 70 ? (RP.positive) : color} />
        <MetricCard icon={Zap} label={t("axisReports.aiSuggested")} value={summary.aiSuggested} sub={`${summary.manuallyAdded} ${t("axisReports.manuals")}`} color={color} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">{t("axisReports.overallProgress")}</p>
          <span className="text-sm font-bold" style={{ color }}>{summary.completed}/{summary.total}</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${summary.completionRate}%`, background: isHigh ? `linear-gradient(90deg, ${color}, ${color}80)` : color }}
          />
        </div>
      </div>

      <SectionTitle>{t("axisReports.eventsByDay")}</SectionTitle>
      <div className="rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={localizedByDay} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="completed" name={t("axisReports.completedBar")} fill={RP.positive} radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="pending" name={t("axisReports.pendingBar")} fill={`${color}50`} radius={[4, 4, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-2">
        <div>
          <SectionTitle>{t("axisReports.upcomingEvents")}</SectionTitle>
          {upcoming?.length > 0 ? (
            <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: `${color}12` }}>
              {upcoming.map((item: any, i: number) => (
                <div key={item.id} className={`flex items-start gap-3 px-4 py-3 ${i < upcoming.length - 1 ? "border-b border-border" : ""}`}>
                  <div className="w-1 h-8 rounded-full flex-shrink-0 mt-0.5" style={{ background: color, opacity: i === 0 ? 1 : 0.4 }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`report-upcoming-${item.id}`}>{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(item.startTime).toLocaleDateString(dateLocale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 text-center">
              <p className="text-sm text-muted-foreground">{t("axisReports.noUpcomingEvents")}</p>
            </div>
          )}
        </div>

        <div>
          <SectionTitle>{t("axisReports.overdueEvents")}</SectionTitle>
          {overdue?.length > 0 ? (
            <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: `${RP.negative}20` }}>
              {overdue.map((item: any, i: number) => (
                <div key={item.id} className={`flex items-start gap-3 px-4 py-3 ${i < overdue.length - 1 ? "border-b border-border" : ""}`}>
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: RP.negative }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`report-overdue-${item.id}`}>{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(item.startTime).toLocaleDateString(dateLocale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 text-center">
              <p className="text-sm text-muted-foreground">{t("axisReports.allOnTime")}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ======================== MAIN PAGE ========================
export default function Reports() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
  const [activeTab, setActiveTab] = useState<"finance" | "tasks" | "habits" | "schedule">("finance");
  const { theme } = useTheme();
  const isHigh = theme.startsWith("high");
  const P = getReportPalette(theme);

  const TABS = [
    { id: "finance" as const, label: t("axisReports.tabFinance"), icon: DollarSign },
    { id: "tasks" as const, label: t("axisReports.tabTasks"), icon: CheckSquare },
    { id: "habits" as const, label: t("axisReports.tabHabits"), icon: Flame },
    { id: "schedule" as const, label: t("axisReports.tabSchedule"), icon: Calendar },
  ];

  const tabColors: Record<string, string> = {
    finance: P.finance,
    tasks: P.tasks,
    habits: P.habits,
    schedule: P.schedule,
  };

  const today = new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="px-6 py-6 pb-28">
      <title>{t("axisReports.pageTitle")}</title>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6">
        <p className="text-sm text-muted-foreground mb-0.5 capitalize">{today}</p>
        <h1 className="text-3xl font-bold tracking-tight">{t("axisReports.pageHeading")}</h1>
      </motion.div>

      {/* Tab Navigation */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
        <div className="flex gap-2 p-1.5 rounded-2xl bg-muted/40 border border-border w-fit">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const color = tabColors[tab.id];
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`tab-${tab.id}`}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
                style={isActive ? { background: `${color}15`, color, border: `1px solid ${color}25` } : { color: "hsl(var(--muted-foreground))", border: "1px solid transparent" }}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:block">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <div key={activeTab}>
          {activeTab === "finance" && <FinanceReport color={tabColors.finance} isHigh={isHigh} />}
          {activeTab === "tasks" && <TasksReport color={tabColors.tasks} isHigh={isHigh} />}
          {activeTab === "habits" && <HabitsReport color={tabColors.habits} isHigh={isHigh} />}
          {activeTab === "schedule" && <ScheduleReport color={tabColors.schedule} isHigh={isHigh} />}
        </div>
      </AnimatePresence>
    </div>
  );
}
