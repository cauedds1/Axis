import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Users, Activity, Zap, Building2, Brain, MessageSquare, Mail, TrendingUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { StatCard, SectionTitle, SubTitle, TableWrapper, Th, Td, EmptyRow, SortIcon } from "../AdminComponents";
import { fmtDate, adminFetch, formatPlan, formatAccountType } from "../admin-utils";
import { Button } from "@/components/ui/button";

interface StatsData {
  users: { total: number; personal: number; business: number; collaborators: number; currentMonth: number; prevMonth: number; newToday: number };
  activeUsers: { last7d: number; last30d: number; prevLast30d: number };
  transactions: { total: number; currentMonth: number; prevMonth: number };
  organizations: { total: number; currentMonth: number; prevMonth: number };
  aiCalls30d: number;
  whatsappMessages30d: number;
  emailAlerts30d: number;
  dailySignups: { day: string; count: number }[];
  topUsers: { id: string; email: string; first_name: string; last_name: string; account_type: string; plan: string; activity_count: number; tx_count: number }[];
}

const PIE_COLORS = ["#7a9e8a", "#6b8ee0", "#e08a6b"];

type TopUser = { id: string; email: string; first_name: string; last_name: string; account_type: string; plan: string; activity_count: number; tx_count: number };

export function DashboardSection() {
  const { t } = useTranslation("axisAdmin");
  const [topPeriod, setTopPeriod] = useState<"7d" | "30d" | "all">("30d");
  const [topSort, setTopSort] = useState("activity_count");
  const [topDir, setTopDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading } = useQuery<StatsData>({ queryKey: ["/api/admin/stats"] });
  const { data: topData } = useQuery<{ topUsers: TopUser[] }>({
    queryKey: ["/api/admin/top-users", topPeriod, topSort, topDir],
    queryFn: () => adminFetch(`/api/admin/top-users?period=${topPeriod}&sortBy=${topSort}&sortDir=${topDir}`),
  });

  const toggleTopSort = (col: string) => {
    if (topSort === col) setTopDir(d => d === "asc" ? "desc" : "asc");
    else { setTopSort(col); setTopDir("desc"); }
  };

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!data) return <div className="text-muted-foreground">{t("common.error")}</div>;

  const userTypeData = [
    { name: t("dashboard.personal"), value: data.users.personal },
    { name: t("dashboard.business"), value: data.users.business },
    { name: t("dashboard.collaborators"), value: data.users.collaborators },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <SectionTitle>{t("dashboard.title")}</SectionTitle>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("dashboard.totalUsers")} value={data.users.total} icon={Users} />
        <StatCard label={t("dashboard.activeToday")} value={data.activeUsers.last7d} sub={t("dashboard.last7d")} icon={Activity} color="text-green-400" />
        <StatCard label={t("dashboard.newUsersToday")} value={data.users.newToday} icon={Zap} color="text-blue-400" />
        <StatCard label={t("dashboard.organizations")} value={data.organizations.total} icon={Building2} color="text-violet-400" />
        <StatCard label={t("dashboard.aiCalls")} value={data.aiCalls30d} icon={Brain} color="text-violet-400" />
        <StatCard label={t("dashboard.whatsappMessages")} value={data.whatsappMessages30d} icon={MessageSquare} color="text-green-400" />
        <StatCard label={t("dashboard.emailAlerts")} value={data.emailAlerts30d} icon={Mail} color="text-yellow-400" />
        <StatCard label={t("dashboard.transactions")} value={data.transactions.total} icon={TrendingUp} color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.dailySignups.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <SubTitle>{t("dashboard.dailySignups")}</SubTitle>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.dailySignups}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(s: string) => s?.slice(5) ?? s} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }} />
                <Bar dataKey="count" fill="#7a9e8a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {userTypeData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <SubTitle>{t("dashboard.userTypeBreakdown")}</SubTitle>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={userTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={35}>
                  {userTypeData.map((_entry, index) => (
                    <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <SubTitle>{t("dashboard.topUsers")}</SubTitle>
          <div className="flex gap-1">
            {(["7d", "30d", "all"] as const).map((p) => (
              <Button key={p} variant={topPeriod === p ? "secondary" : "ghost"} size="sm"
                className="h-6 px-2 text-xs" onClick={() => setTopPeriod(p)}>
                {p === "7d" ? t("dashboard.period7d") : p === "30d" ? t("dashboard.period30d") : t("dashboard.allTime")}
              </Button>
            ))}
          </div>
        </div>
        <TableWrapper>
          <thead>
            <tr>
              <Th>{t("users.email")}</Th>
              <Th>{t("users.type")}</Th>
              <Th>{t("users.plan")}</Th>
              <Th className="text-right" onClick={() => toggleTopSort("activity_count")}>
                {t("dashboard.activityCount")}<SortIcon field="activity_count" sort={topSort} dir={topDir} />
              </Th>
              <Th className="text-right" onClick={() => toggleTopSort("tx_count")}>
                {t("dashboard.txCount")}<SortIcon field="tx_count" sort={topSort} dir={topDir} />
              </Th>
            </tr>
          </thead>
          <tbody>
            {(topData?.topUsers ?? []).length === 0 ? (
              <EmptyRow colSpan={5} label={t("common.empty")} />
            ) : (
              (topData?.topUsers ?? []).map((u) => (
                <tr key={u.id} className="border-t border-border hover:bg-muted/20 transition-colors">
                  <Td data-testid={`text-topuser-email-${u.id}`}>{u.email}</Td>
                  <Td>{formatAccountType(u.account_type, t)}</Td>
                  <Td>{formatPlan(u.plan, t)}</Td>
                  <Td className="text-right font-mono">{u.activity_count}</Td>
                  <Td className="text-right font-mono">{u.tx_count}</Td>
                </tr>
              ))
            )}
          </tbody>
        </TableWrapper>
      </div>
    </div>
  );
}
