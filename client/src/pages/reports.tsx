import { useState } from "react";
import { formatTxDescription } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useTheme, getModulePalette } from "@/components/theme-provider";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
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

function CustomTooltip({ active, payload, label }: any) {
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
          <span className="font-semibold text-foreground">{typeof p.value === "number" && p.name?.includes("R$") ? `R$ ${p.value.toFixed(2)}` : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, color, trend }: { icon: any; label: string; value: string | number; sub?: string; color: string; trend?: { value: number; label: string } }) {
  return (
    <div
      className="rounded-2xl border bg-card p-5 flex flex-col gap-3 transition-all duration-200 hover:shadow-md"
      style={{ borderColor: `${color}15` }}
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}14` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend.value >= 0 ? "text-green-500" : "text-red-400"}`}>
            {trend.value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend.value)}%
          </div>
        )}
      </div>
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
      {Math.abs(value)}% vs mês anterior
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
    { id: "current", label: "Mês atual" },
    { id: "last", label: "Mês passado" },
    { id: "last3", label: "3 meses" },
    { id: "last6", label: "6 meses" },
    { id: "custom", label: "Personalizado" },
  ];

  const pmColors: Record<string, string> = {
    debit: RP.tasks,
    credit: RP.negative,
    pix: RP.positive,
    cash: RP.schedule,
    other: RP.primary,
  };

  const { summary, currentMonth, monthly, byCategory, currentMonthByCategory, dailyThisMonth, groupByWeek, byPaymentMethod, byEstablishment, byHour, byTimePeriod, peakHour, recentTransactions, goals, periodLabel: backendPeriodLabel } = data || {};

  const filteredTx = recentTransactions?.filter((tx: any) => txFilter === "all" || tx.type === txFilter) || [];
  const hasCurrentMonthData = currentMonth ? (currentMonth.income > 0 || currentMonth.expenses > 0) : false;
  const hasMonthlyData = monthly?.some((m: any) => m.income > 0 || m.expenses > 0) ?? false;
  const hasDailyData = dailyThisMonth?.some((d: any) => d.expenses > 0) ?? false;
  const displayPeriod = backendPeriodLabel || (currentMonth?.name || "");
  const capitalizedMonth = displayPeriod.charAt(0).toUpperCase() + displayPeriod.slice(1);

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
            <span className="text-xs text-muted-foreground font-medium">De</span>
            <input
              type="date"
              data-testid="input-custom-start"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="text-xs border border-border rounded-lg px-2 py-1.5 bg-background text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            <span className="text-xs text-muted-foreground font-medium">até</span>
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
      {!isLoading && !data && <EmptyState icon={DollarSign} message="Sem dados financeiros ainda" />}
      {!isLoading && data && <>

      {/* ══ ROW 1: Hero mês + Categorias do mês ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mt-4">

        {/* Left: Hero card + daily chart */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          {/* Hero */}
          <div className="rounded-2xl border p-5 flex-1" style={{ borderColor: `${color}20`, background: `${color}06` }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Período selecionado</p>
                <h2 className="text-2xl font-bold">{capitalizedMonth}</h2>
              </div>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                <Wallet className="h-5 w-5" style={{ color }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-background/60 border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Receitas</p>
                <p className="text-xl font-bold" style={{ color: RP.positive }} data-testid="metric-receitas-mes">
                  R$ {currentMonth.income.toFixed(0)}
                </p>
                <TrendBadge value={currentMonth.incomeTrend} invertColor={false} />
              </div>
              <div className="rounded-xl bg-background/60 border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Gastos</p>
                <p className="text-xl font-bold" style={{ color: RP.negative }} data-testid="metric-gastos-mes">
                  R$ {currentMonth.expenses.toFixed(0)}
                </p>
                <TrendBadge value={currentMonth.expenseTrend} invertColor={true} />
              </div>
              <div className="rounded-xl bg-background/60 border border-border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Saldo</p>
                <p className="text-xl font-bold" style={{ color: currentMonth.balance >= 0 ? (RP.positive) : (RP.negative) }} data-testid="metric-saldo-mes">
                  R$ {currentMonth.balance.toFixed(0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">{currentMonth.savingsRate}% economizado</p>
              </div>
            </div>

            {currentMonth.income > 0 && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Gastos vs Receita</span>
                  <span>{Math.min(100, Math.round((currentMonth.expenses / currentMonth.income) * 100))}% da renda</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (currentMonth.expenses / currentMonth.income) * 100)}%`, background: currentMonth.expenses <= currentMonth.income ? (RP.positive) : (RP.negative) }} />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>R$ {currentMonth.expenses.toFixed(0)} gastos</span>
                  <span>R$ {currentMonth.income.toFixed(0)} recebidos</span>
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-4 pt-3 border-t border-border/50 text-xs text-muted-foreground">
              <span>{currentMonth.transactionCount} transações</span>
              {currentMonth.topCategory !== "N/A" && <span>Maior gasto: <strong className="text-foreground">{currentMonth.topCategory}</strong></span>}
            </div>
          </div>

          {/* Daily chart */}
          <div className="rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Gastos por {groupByWeek ? "semana" : "dia"} — {capitalizedMonth}</p>
            {hasDailyData ? (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={dailyThisMonth} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.10)" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="expenses" name="Gastos" fill={RP.negative} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum gasto registrado no período</p>
            )}
          </div>
        </div>

        {/* Right: Categories + Payment methods */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          {/* Categories this month */}
          <div className="rounded-2xl border bg-card p-5 flex-1" style={{ borderColor: `${color}12` }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Categorias — {capitalizedMonth.split(" ")[0]}</p>
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
                      <span className="text-sm font-semibold">R$ {cat.amount.toFixed(0)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${cat.pct}%`, background: pieColors[i % pieColors.length] }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Sem gastos categorizados no período</p>
            )}
          </div>

          {/* Payment methods */}
          {byPaymentMethod?.filter((p: any) => p.key !== "Não informado").length > 0 && (
            <div className="rounded-2xl border bg-card p-5" style={{ borderColor: `${color}12` }}>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Forma de pagamento</p>
              <div className="grid grid-cols-2 gap-2">
                {byPaymentMethod.filter((p: any) => p.key !== "Não informado").map((pm: any, i: number) => {
                  const c = pmColors[pm.key] || color;
                  const isTop = i === 0;
                  return (
                    <div key={pm.key} className="rounded-xl border p-3 flex flex-col gap-1" style={isTop ? { borderColor: `${c}30`, background: `${c}08` } : {}} data-testid={`payment-method-${pm.key}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold">{pm.label}</p>
                        {isTop && <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase" style={{ background: `${c}15`, color: c }}>↑</span>}
                      </div>
                      <p className="text-base font-bold" style={{ color: c }}>R$ {pm.amount.toFixed(0)}</p>
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
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Histórico — últimos 6 meses</p>
          {hasMonthlyData ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={monthly} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
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
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="income" name="Receitas" stroke={RP.positive} fill="url(#colorIncome)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="expenses" name="Gastos" stroke={RP.negative} fill="url(#colorExpenses)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-20">Adicione transações para ver o histórico</p>
          )}
        </div>

        {/* Establishments */}
        {byEstablishment?.length > 0 && (
          <div className="xl:col-span-2 rounded-2xl border bg-card p-5" style={{ borderColor: `${color}12` }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Onde você mais gasta</p>
            {byEstablishment.slice(0, 7).map((place: any, i: number) => {
              const barColor = pieColors[i % pieColors.length];
              return (
                <div key={place.name} className="mb-3 last:mb-0" data-testid={`establishment-${i}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ background: `${barColor}18`, color: barColor }}>{i + 1}</div>
                      <span className="text-sm font-medium truncate">{place.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] text-muted-foreground">{place.count}x</span>
                      <span className="text-xs font-semibold">R$ {place.amount.toFixed(0)}</span>
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
      {byTimePeriod?.some((p: any) => p.amount > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mt-4">
          {/* Time periods + hour chart */}
          <div className="xl:col-span-3 rounded-2xl border bg-card p-5" style={{ borderColor: `${color}12` }}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">Quando você mais gasta</p>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {byTimePeriod.map((period: any) => {
                const isTopPeriod = period.amount === Math.max(...byTimePeriod.map((p: any) => p.amount));
                return (
                  <div key={period.label} className="rounded-xl border p-3 flex flex-col gap-1" style={isTopPeriod ? { borderColor: `${color}30`, background: `${color}08` } : {}} data-testid={`time-period-${period.label}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-base">{period.emoji}</span>
                      {isTopPeriod && <span className="text-[9px] font-bold px-1 py-0.5 rounded uppercase" style={{ background: `${color}15`, color }}>Pico</span>}
                    </div>
                    <p className="text-xs font-semibold">{period.label}</p>
                    <p className="text-sm font-bold" style={{ color: isTopPeriod ? color : "inherit" }}>R$ {period.amount.toFixed(0)}</p>
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
                  <p className="text-xs text-muted-foreground">Gastos por hora do dia</p>
                  {peakHour && <span className="text-xs font-semibold" style={{ color }}>Pico: {peakHour}</span>}
                </div>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={byHour} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.08)" />
                    <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={3} />
                    <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="amount" name="Gastos" radius={[3, 3, 0, 0]}>
                      {byHour.map((entry: any, i: number) => <Cell key={i} fill={entry.hour === peakHour ? color : `${color}40`} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </>
            )}
          </div>

          {/* 6-month summary metrics */}
          <div className="xl:col-span-2 grid grid-cols-2 gap-3 content-start">
            <MetricCard icon={TrendingUp} label="Receitas" value={`R$ ${summary.totalIncome.toFixed(0)}`} color={RP.positive} />
            <MetricCard icon={TrendingDown} label="Gastos" value={`R$ ${summary.totalExpenses.toFixed(0)}`} color={RP.negative} />
            <MetricCard icon={ShoppingBag} label="Média/mês" value={`R$ ${summary.avgMonthlyExpense?.toFixed(0) ?? "0"}`} sub="em gastos" color={color} />
            <MetricCard icon={Target} label="Taxa de economia" value={`${summary.savingsRate}%`} sub={`${summary.transactionCount ?? 0} transações`} color={color} />

            {/* Global pie + goals in same column */}
            {byCategory.length > 0 && (
              <div className="col-span-2 rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Categorias — 6 meses</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={byCategory} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={65} paddingAngle={2}>
                      {byCategory.map((_: any, i: number) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ Goals ══ */}
      {goals?.length > 0 && (
        <>
          <SectionTitle>Metas financeiras</SectionTitle>
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
                    <span className="text-[11px] text-muted-foreground">R$ {Number(g.currentAmount || 0).toFixed(0)} guardados</span>
                    <span className="text-[11px] text-muted-foreground">Faltam R$ {remaining > 0 ? remaining.toFixed(0) : "0"}</span>
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
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Histórico de transações</p>
          <div className="h-px bg-border flex-1 w-8" />
        </div>
        <div className="flex gap-1 ml-4">
          {(["all", "expense", "income"] as const).map(f => (
            <button key={f} onClick={() => setTxFilter(f)} data-testid={`filter-tx-${f}`} className="px-3 py-1 rounded-lg text-xs font-medium transition-all" style={txFilter === f ? { background: `${color}18`, color, border: `1px solid ${color}30` } : { color: "hsl(var(--muted-foreground))", border: "1px solid transparent" }}>
              {f === "all" ? "Tudo" : f === "expense" ? "Gastos" : "Receitas"}
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
                        <span>{tx.categoryName || "Sem categoria"}</span>
                        <span>·</span>
                        <span>{new Date(tx.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-sm font-bold ml-3 flex-shrink-0" style={{ color: txColor }}>
                    {isIncome ? "+" : "-"}R$ {Number(tx.amount).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : <EmptyState icon={DollarSign} message="Nenhuma transação encontrada" />}

      </>}
    </motion.div>
  );
}

// ======================== TASKS TAB ========================
function TasksReport({ color, isHigh }: { color: string; isHigh: boolean }) {
  const { theme } = useTheme();
  const RP = getReportPalette(theme);
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/reports/tasks"] });

  if (isLoading) return <div className="space-y-4 mt-4">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>;
  if (!data) return <EmptyState icon={CheckSquare} message="Sem dados de tarefas" />;

  const { summary, byPriority, byCategory, urgentPending } = data;

  const barData = [
    { name: "Concluídas", value: summary.completed, color },
    { name: "Pendentes", value: summary.pending, color: "hsl(var(--muted-foreground))" },
    { name: "Atrasadas", value: summary.overdue, color: RP.negative },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <MetricCard icon={CheckSquare} label="Total" value={summary.total} color={color} />
        <MetricCard icon={Star} label="Concluídas" value={summary.completed} color={RP.positive} />
        <MetricCard icon={Clock} label="Pendentes" value={summary.pending} color={color} />
        <MetricCard icon={Target} label="Taxa de conclusão" value={`${summary.completionRate}%`} sub={summary.overdue > 0 ? `${summary.overdue} atrasadas` : "Em dia"} color={summary.completionRate >= 70 ? (RP.positive) : (RP.negative)} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-2">
        <div>
          <SectionTitle>Por prioridade</SectionTitle>
          <div className="rounded-2xl border bg-card p-5" style={{ borderColor: `${color}12` }}>
            <PriorityBar label="Alta prioridade" total={byPriority.high.total} completed={byPriority.high.completed} color={RP.negative} />
            <PriorityBar label="Média prioridade" total={byPriority.medium.total} completed={byPriority.medium.completed} color={RP.schedule} />
            <PriorityBar label="Baixa prioridade" total={byPriority.low.total} completed={byPriority.low.completed} color={RP.positive} />
          </div>
        </div>

        <div>
          <SectionTitle>Visão geral</SectionTitle>
          <div className="rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={barData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="Qtd" radius={[6, 6, 0, 0]}>
                  {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {byCategory.length > 0 && (
        <>
          <SectionTitle>Por categoria</SectionTitle>
          <div className="rounded-2xl border bg-card p-5" style={{ borderColor: `${color}12` }}>
            {byCategory.map((cat: any) => (
              <PriorityBar key={cat.name} label={cat.name} total={cat.count} completed={cat.completed} color={color} />
            ))}
          </div>
        </>
      )}

      <SectionTitle>Tarefas urgentes pendentes</SectionTitle>
      {urgentPending?.length > 0 ? (
        <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: `${color}12` }}>
          {urgentPending.map((t: any, i: number) => (
            <div key={t.id} className={`flex items-center gap-3 px-4 py-3 ${i < urgentPending.length - 1 ? "border-b border-border" : ""}`}>
              <AlertCircle className="h-4 w-4 flex-shrink-0" style={{ color: RP.negative }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" data-testid={`report-urgent-${t.id}`}>{t.title}</p>
                {t.dueDate && <p className="text-[11px] text-muted-foreground">Prazo: {new Date(t.dueDate).toLocaleDateString("pt-BR")}</p>}
              </div>
              <span className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: `${RP.negative}15`, color: RP.negative }}>Alta</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border bg-card p-6 text-center">
          <Star className="h-8 w-8 mx-auto mb-2 opacity-15" />
          <p className="text-sm text-muted-foreground">Nenhuma tarefa urgente pendente</p>
        </div>
      )}
    </motion.div>
  );
}

// ======================== HABITS TAB ========================
function HabitsReport({ color, isHigh }: { color: string; isHigh: boolean }) {
  const { theme } = useTheme();
  const RP = getReportPalette(theme);
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/reports/habits"] });

  if (isLoading) return <div className="space-y-4 mt-4">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>;
  if (!data) return <EmptyState icon={Flame} message="Sem dados de compromissos" />;

  const { summary, habits, weeklyConsistency } = data;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <MetricCard icon={Flame} label="Total de compromissos" value={summary.totalHabits} color={color} />
        <MetricCard icon={Star} label="Melhor streak" value={`${summary.bestStreak}d`} sub={summary.bestHabit} color={RP.positive} />
        <MetricCard icon={Target} label="Streak médio" value={`${summary.avgStreak}d`} color={color} />
        <MetricCard icon={CheckSquare} label="Check-ins (30d)" value={summary.totalCheckinsMonth} color={RP.positive} />
      </div>

      <SectionTitle>Consistência semanal</SectionTitle>
      <div className="rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyConsistency} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="completions" name="Check-ins" fill={color} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <SectionTitle>Compromissos — streak e consistência</SectionTitle>
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
                    <span className="text-[11px] text-muted-foreground capitalize">{h.frequency === "daily" ? "diário" : "semanal"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-bold" style={{ color: streakColor }}>{h.streak}d streak</span>
                    <span className="text-muted-foreground">{h.completionRate}% consistência</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${h.completionRate}%`, background: streakColor }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : <EmptyState icon={Flame} message="Nenhum compromisso criado ainda" />}
    </motion.div>
  );
}

// ======================== SCHEDULE TAB ========================
function ScheduleReport({ color, isHigh }: { color: string; isHigh: boolean }) {
  const { theme } = useTheme();
  const RP = getReportPalette(theme);
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/reports/schedule"] });

  if (isLoading) return <div className="space-y-4 mt-4">{[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>;
  if (!data) return <EmptyState icon={Calendar} message="Sem dados de agenda" />;

  const { summary, byDayOfWeek, upcoming, overdue } = data;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <MetricCard icon={Calendar} label="Total de eventos" value={summary.total} color={color} />
        <MetricCard icon={CheckSquare} label="Concluídos" value={summary.completed} color={RP.positive} />
        <MetricCard icon={Target} label="Taxa de conclusão" value={`${summary.completionRate}%`} color={summary.completionRate >= 70 ? (RP.positive) : color} />
        <MetricCard icon={Zap} label="Sugeridos por IA" value={summary.aiSuggested} sub={`${summary.manuallyAdded} manuais`} color={color} />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted-foreground">Progresso geral</p>
          <span className="text-sm font-bold" style={{ color }}>{summary.completed}/{summary.total}</span>
        </div>
        <div className="h-3 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${summary.completionRate}%`, background: isHigh ? `linear-gradient(90deg, ${color}, ${color}80)` : color }}
          />
        </div>
      </div>

      <SectionTitle>Eventos por dia da semana</SectionTitle>
      <div className="rounded-2xl border bg-card p-4" style={{ borderColor: `${color}12` }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={byDayOfWeek} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.12)" />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="completed" name="Concluídos" fill={RP.positive} radius={[4, 4, 0, 0]} stackId="a" />
            <Bar dataKey="pending" name="Pendentes" fill={`${color}50`} radius={[4, 4, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-2">
        <div>
          <SectionTitle>Próximos eventos</SectionTitle>
          {upcoming?.length > 0 ? (
            <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: `${color}12` }}>
              {upcoming.map((item: any, i: number) => (
                <div key={item.id} className={`flex items-start gap-3 px-4 py-3 ${i < upcoming.length - 1 ? "border-b border-border" : ""}`}>
                  <div className="w-1 h-8 rounded-full flex-shrink-0 mt-0.5" style={{ background: color, opacity: i === 0 ? 1 : 0.4 }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`report-upcoming-${item.id}`}>{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(item.startTime).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 text-center">
              <p className="text-sm text-muted-foreground">Nenhum evento futuro</p>
            </div>
          )}
        </div>

        <div>
          <SectionTitle>Eventos não concluídos</SectionTitle>
          {overdue?.length > 0 ? (
            <div className="rounded-2xl border bg-card overflow-hidden" style={{ borderColor: `${RP.negative}20` }}>
              {overdue.map((item: any, i: number) => (
                <div key={item.id} className={`flex items-start gap-3 px-4 py-3 ${i < overdue.length - 1 ? "border-b border-border" : ""}`}>
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: RP.negative }} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`report-overdue-${item.id}`}>{item.title}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(item.startTime).toLocaleDateString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border bg-card p-5 text-center">
              <p className="text-sm text-muted-foreground">Tudo em dia</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ======================== MAIN PAGE ========================
const TABS = [
  { id: "finance", label: "Finanças", icon: DollarSign },
  { id: "tasks", label: "Tarefas", icon: CheckSquare },
  { id: "habits", label: "Compromissos", icon: Flame },
  { id: "schedule", label: "Agenda", icon: Calendar },
] as const;

type TabId = typeof TABS[number]["id"];

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabId>("finance");
  const { theme } = useTheme();
  const isHigh = theme.startsWith("high");
  const P = getReportPalette(theme);

  const tabColors: Record<TabId, string> = {
    finance: P.finance,
    tasks: P.tasks,
    habits: P.habits,
    schedule: P.schedule,
  };

  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="px-6 py-6 pb-28">
      <title>AXIS — Relatórios</title>

      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-6">
        <p className="text-sm text-muted-foreground mb-0.5 capitalize">{today}</p>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
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
