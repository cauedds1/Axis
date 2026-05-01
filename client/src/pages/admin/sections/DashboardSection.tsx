import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Users, Activity, Zap, Building2, Brain, MessageSquare, Mail, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { StatCard, SectionTitle, SubTitle } from "../AdminComponents";

export function DashboardSection() {
  const { t } = useTranslation("axisAdmin");
  const { data, isLoading } = useQuery<Record<string, unknown>>({ queryKey: ["/api/admin/stats"] });

  if (isLoading) return <div className="text-muted-foreground">{t("common.loading")}</div>;
  if (!data) return <div className="text-muted-foreground">{t("common.error")}</div>;

  const d = data as Record<string, Record<string, unknown>>;

  return (
    <div className="space-y-6">
      <SectionTitle>{t("dashboard.title")}</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("dashboard.totalUsers")} value={(d.users?.total as number) ?? 0} icon={Users} />
        <StatCard label={t("dashboard.activeToday")} value={(d.activeUsers?.last7d as number) ?? 0} icon={Activity} color="text-green-400" sub="last 7d" />
        <StatCard label={t("dashboard.newUsersToday")} value={(d.users?.newToday as number) ?? 0} icon={Zap} color="text-blue-400" />
        <StatCard label="Organizations" value={(d.organizations?.total as number) ?? 0} icon={Building2} color="text-violet-400" />
        <StatCard label={t("dashboard.aiCalls")} value={(data.aiCalls30d as number) ?? 0} icon={Brain} color="text-violet-400" />
        <StatCard label={t("dashboard.whatsappMessages")} value={(data.whatsappMessages30d as number) ?? 0} icon={MessageSquare} color="text-green-400" />
        <StatCard label={t("dashboard.emailAlerts")} value={(data.emailAlerts30d as number) ?? 0} icon={Mail} color="text-yellow-400" />
        <StatCard label="Transactions" value={(d.transactions?.total as number) ?? 0} icon={TrendingUp} color="text-emerald-400" />
      </div>

      {Array.isArray(data.dailySignups) && (data.dailySignups as unknown[]).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <SubTitle>Daily Signups (30d)</SubTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.dailySignups as object[]}>
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(s: string) => s?.slice(5) ?? s} />
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
