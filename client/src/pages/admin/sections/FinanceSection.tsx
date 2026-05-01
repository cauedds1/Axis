import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Search, TrendingUp, CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart2 } from "lucide-react";
import {
  SectionTitle, SubTitle, StatCard, TableWrapper, Th, Td, EmptyRow, Pagination, SortIcon,
} from "../AdminComponents";
import { fmtDate, fmtCurrency, adminFetch, CHART_PERIODS } from "../admin-utils";

type SortDir = "asc" | "desc";

export function FinanceSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const [chartPeriod, setChartPeriod] = useState(12);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const { data: overview } = useQuery<Record<string, unknown>>({ queryKey: ["/api/admin/finance/overview"] });

  const txParams = new URLSearchParams({ page: String(page), limit: "20", sortBy, sortDir });
  if (search) txParams.set("search", search);
  if (typeFilter !== "all") txParams.set("type", typeFilter);

  const { data: txData, isLoading } = useQuery<{ transactions: Record<string, unknown>[]; total: number }>({
    queryKey: ["/api/admin/finance/transactions", page, search, typeFilter, sortBy, sortDir],
    queryFn: () => adminFetch(`/api/admin/finance/transactions?${txParams.toString()}`),
  });

  const allChartData = ((overview?.monthlyVolume as Record<string, unknown>[]) ?? []).map(m => ({
    month: m.month as string,
    Volume: (m.total_volume ?? 0) as number,
  }));
  const chartData = chartPeriod >= 999 ? allChartData : allChartData.slice(-chartPeriod);

  return (
    <div className="space-y-6">
      <SectionTitle>{t("finance.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Current Month Volume" value={fmtCurrency(overview?.currentMonthVolume as number)} icon={TrendingUp} color="text-emerald-400" />
        <StatCard label="Prev Month Volume" value={fmtCurrency(overview?.prevMonthVolume as number)} icon={BarChart2} color="text-blue-400" />
        <StatCard label="Avg Spend / User" value={fmtCurrency(overview?.avgSpendPerUser as number)} icon={CreditCard} />
      </div>

      {allChartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <SubTitle>{t("finance.revenueByMonth")}</SubTitle>
            <div className="flex gap-1">
              {CHART_PERIODS.map(p => (
                <button key={p.label} data-testid={`button-chart-period-${p.label}`}
                  onClick={() => setChartPeriod(p.months)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${chartPeriod === p.months ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                  {p.label}
                </button>
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

      {Array.isArray(overview?.topCategories) && (overview.topCategories as Record<string, unknown>[]).length > 0 && (
        <div>
          <SubTitle>Top Expense Categories</SubTitle>
          <TableWrapper>
            <thead><tr><Th>Category</Th><Th>Total</Th><Th>Count</Th></tr></thead>
            <tbody>
              {(overview.topCategories as Record<string, unknown>[]).map((c, i) => (
                <tr key={i} className="hover:bg-accent/30">
                  <Td className="capitalize">{c.category_name as string}</Td>
                  <Td className="text-red-400">{fmtCurrency(c.total as number)}</Td>
                  <Td>{c.count as number}</Td>
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
            <Input data-testid="input-finance-search" className="pl-9" placeholder={t("common.search")}
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger data-testid="select-finance-type" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
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
                  <Th onClick={() => toggleSort("user_email")}>{t("finance.user")}<SortIcon field="user_email" sort={sortBy} dir={sortDir} /></Th>
                  <Th onClick={() => toggleSort("description")}>{t("finance.description")}<SortIcon field="description" sort={sortBy} dir={sortDir} /></Th>
                  <Th onClick={() => toggleSort("amount")}>{t("finance.amount")}<SortIcon field="amount" sort={sortBy} dir={sortDir} /></Th>
                  <Th>{t("finance.type")}</Th>
                  <Th onClick={() => toggleSort("date")}>{t("finance.date")}<SortIcon field="date" sort={sortBy} dir={sortDir} /></Th>
                </tr>
              </thead>
              <tbody>
                {(txData?.transactions ?? []).length === 0 ? (
                  <EmptyRow colSpan={5} label={t("common.noData")} />
                ) : (txData?.transactions ?? []).map((tx) => (
                  <tr key={tx.id as string} className="hover:bg-accent/30" data-testid={`row-tx-${tx.id}`}>
                    <Td className="text-muted-foreground text-xs">{(tx.user_email ?? tx.userEmail ?? "—") as string}</Td>
                    <Td className="font-medium max-w-xs truncate">{tx.description as string}</Td>
                    <Td className={tx.type === "income" ? "text-emerald-400" : "text-red-400"}>{fmtCurrency(tx.amount as number)}</Td>
                    <Td><Badge variant="outline" className="text-xs capitalize">{tx.type as string}</Badge></Td>
                    <Td className="text-muted-foreground">{fmtDate(tx.date as string)}</Td>
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
