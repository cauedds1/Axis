import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, TrendingDown, Users, Zap, BarChart2, CreditCard, Brain } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { SectionTitle, SubTitle, StatCard } from "../AdminComponents";
import { fmtCurrency, PIE_COLORS } from "../admin-utils";

interface RevenueData {
  mrr: number;
  arr: number;
  prevMrr: number;
  mrrGrowthPct: number | null;
  personalAICount: number;
  teamCount: number;
  starterCount: number;
  trialUsers: number;
  payingUsers: number;
  newPayingThisMonth: number;
  newPayingPrevMonth: number;
  personalAIRevenue: number;
  teamRevenue: number;
  mrrHistory: { month: string; mrr: number }[];
}

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground text-xs">—</span>;
  const positive = pct >= 0;
  return (
    <Badge
      variant="outline"
      className={`text-xs gap-1 ${positive ? "text-emerald-400 border-emerald-400/30" : "text-red-400 border-red-400/30"}`}
      data-testid="badge-mrr-growth"
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{pct.toFixed(1)}%
    </Badge>
  );
}

export function RevenueSection() {
  const { t } = useTranslation("axisAdmin");

  const { data, isLoading } = useQuery<RevenueData>({ queryKey: ["/api/admin/revenue/overview"] });

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!data) return <div className="text-muted-foreground">{t("common.error")}</div>;

  const planBreakdown = [
    { name: t("billing.personalAI"), value: data.personalAIRevenue },
    { name: t("billing.teamPlan"), value: data.teamRevenue },
  ].filter(d => d.value > 0);

  const chartData = (data.mrrHistory ?? []).map(row => ({
    month: row.month?.slice(0, 7) ?? row.month,
    mrr: Number(row.mrr) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <SectionTitle>{t("revenue.title")}</SectionTitle>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 md:col-span-2" data-testid="card-mrr">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
            {t("revenue.mrr")}
          </div>
          <div className="flex items-end gap-3">
            <div className="text-3xl font-bold text-emerald-400">{fmtCurrency(data.mrr)}</div>
            <GrowthBadge pct={data.mrrGrowthPct} />
          </div>
          <div className="text-muted-foreground text-xs">
            {t("revenue.prevMrr")}: {fmtCurrency(data.prevMrr)}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1" data-testid="card-arr">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wider">
            <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
            {t("revenue.arr")}
          </div>
          <div className="text-2xl font-bold text-blue-400">{fmtCurrency(data.arr)}</div>
        </div>

        <StatCard label={t("revenue.payingUsers")} value={data.payingUsers} icon={CreditCard} color="text-violet-400" />
        <StatCard label={t("revenue.personalAI")} value={data.personalAICount} icon={Brain} color="text-violet-400" />
        <StatCard label={t("revenue.teamPlan")} value={data.teamCount} icon={Users} color="text-blue-400" />
        <StatCard label={t("revenue.trialUsers")} value={data.trialUsers} icon={BarChart2} color="text-yellow-400" />
        <StatCard label={t("revenue.newThisMonth")} value={data.newPayingThisMonth} icon={Zap} color="text-emerald-400" />
        <StatCard label={t("revenue.newPrevMonth")} value={data.newPayingPrevMonth} icon={BarChart2} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {chartData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <SubTitle>{t("revenue.mrrTrend")}</SubTitle>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} data-testid="chart-mrr-trend">
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fill: "#888" }}
                  tickFormatter={(s: string) => s?.slice(5) ?? s}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#888" }}
                  tickFormatter={(v: number) => `R$${v}`}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }}
                  formatter={(v: number) => [fmtCurrency(v), "MRR"]}
                />
                <Line
                  type="monotone"
                  dataKey="mrr"
                  stroke="#7a9e8a"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#7a9e8a" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {planBreakdown.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <SubTitle>{t("revenue.planBreakdown")}</SubTitle>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart data-testid="chart-plan-revenue">
                <Pie
                  data={planBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                >
                  {planBreakdown.map((_entry, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }}
                  formatter={(v: number) => [fmtCurrency(v), ""]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>{t("billing.personalAI")}</span>
                <span className="font-mono">{fmtCurrency(data.personalAIRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span>{t("billing.teamPlan")}</span>
                <span className="font-mono">{fmtCurrency(data.teamRevenue)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
