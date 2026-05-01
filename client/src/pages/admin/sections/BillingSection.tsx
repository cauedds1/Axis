import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Search, ExternalLink, Brain, Users, TrendingUp, AlertTriangle, Zap, CreditCard } from "lucide-react";
import { BarChart2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  SectionTitle, SubTitle, StatCard, TableWrapper, Th, Td, EmptyRow, Pagination, SortIcon,
} from "../AdminComponents";
import { fmtDate, fmtCurrency, adminFetch, PIE_COLORS } from "../admin-utils";

type SortDir = "asc" | "desc";

export function BillingSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const { data: overview } = useQuery<Record<string, unknown>>({ queryKey: ["/api/admin/billing/overview"] });

  const billingParams = new URLSearchParams({ page: String(page), limit: "20", sortBy, sortDir });
  if (search) billingParams.set("search", search);

  const { data: subData, isLoading } = useQuery<{ subscriptions: Record<string, unknown>[]; total: number }>({
    queryKey: ["/api/admin/billing/subscriptions", page, search, sortBy, sortDir],
    queryFn: () => adminFetch(`/api/admin/billing/subscriptions?${billingParams.toString()}`),
  });

  const ov = overview ?? {};

  return (
    <div className="space-y-6">
      <SectionTitle>{t("billing.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Paying Users" value={(ov.payingUsers as number) ?? 0} icon={CreditCard} color="text-green-400" />
        <StatCard label="Personal AI" value={(ov.personalAICount as number) ?? 0} icon={Brain} color="text-violet-400" />
        <StatCard label="Team Plan" value={(ov.teamCount as number) ?? 0} icon={Users} color="text-blue-400" />
        <StatCard label={t("billing.mrrStripe")} value={fmtCurrency(ov.mrr as number)} icon={TrendingUp} color="text-emerald-400" />
        <StatCard label="Starter (Free)" value={(ov.starterCount as number) ?? 0} icon={Users} />
        <StatCard label="Trial Users" value={(ov.trialUsers as number) ?? 0} icon={AlertTriangle} color="text-yellow-400" />
        <StatCard label="New This Month" value={(ov.newSubscribersThisMonth as number) ?? 0} icon={Zap} color="text-blue-400" />
        <StatCard label="Prev Month" value={(ov.newSubscribersPrevMonth as number) ?? 0} icon={BarChart2} />
      </div>

      {((ov.personalAICount as number) + (ov.teamCount as number) + (ov.starterCount as number)) > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <SubTitle>Plan Distribution</SubTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={[
                  { name: "Personal AI", value: (ov.personalAICount as number) ?? 0 },
                  { name: "Team", value: (ov.teamCount as number) ?? 0 },
                  { name: "Starter (Free)", value: (ov.starterCount as number) ?? 0 },
                  { name: "Trial", value: (ov.trialUsers as number) ?? 0 },
                ].filter(d => d.value > 0)}
                dataKey="value" nameKey="name" cx="50%" cy="50%"
                innerRadius={50} outerRadius={80}
                data-testid="chart-plan-donut"
              >
                {[0, 1, 2, 3].map(i => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      <SubTitle>Subscribed Users</SubTitle>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input data-testid="input-billing-search" className="pl-9" placeholder={t("common.search")}
          value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      </div>
      {isLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th onClick={() => toggleSort("email")}>Email<SortIcon field="email" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("plan")}>{t("billing.plan")}<SortIcon field="plan" sort={sortBy} dir={sortDir} /></Th>
                <Th>Stripe Sub ID</Th>
                <Th onClick={() => toggleSort("trial_ends_at")}>Trial Ends<SortIcon field="trial_ends_at" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("created_at")}>{t("billing.currentPeriodEnd")}<SortIcon field="created_at" sort={sortBy} dir={sortDir} /></Th>
                <Th>Stripe</Th>
              </tr>
            </thead>
            <tbody>
              {(subData?.subscriptions ?? []).length === 0 ? (
                <EmptyRow colSpan={6} label={t("common.noData")} />
              ) : (subData?.subscriptions ?? []).map((s, i) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-sub-${i}`}>
                  <Td className="text-muted-foreground text-xs">{s.email as string}</Td>
                  <Td><Badge variant="outline" className="text-xs capitalize">{s.plan as string}</Badge></Td>
                  <Td className="font-mono text-xs max-w-xs truncate">
                    {s.stripe_subscription_id
                      ? <a href={`https://dashboard.stripe.com/subscriptions/${s.stripe_subscription_id}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">{s.stripe_subscription_id as string}</a>
                      : <span className="text-muted-foreground">—</span>}
                  </Td>
                  <Td className="text-muted-foreground">{fmtDate(s.trial_ends_at as string)}</Td>
                  <Td className="text-muted-foreground">{fmtDate(s.created_at as string)}</Td>
                  <Td>
                    {s.stripe_customer_id ? (
                      <a href={`https://dashboard.stripe.com/customers/${s.stripe_customer_id}`} target="_blank" rel="noreferrer" data-testid={`link-stripe-customer-${i}`}>
                        <Button variant="ghost" size="sm"><ExternalLink className="h-3.5 w-3.5 text-blue-400" /></Button>
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
