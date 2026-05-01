import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Search, Brain, Activity, Zap, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SectionTitle, SubTitle, StatCard, TableWrapper, Th, Td, EmptyRow, Pagination, SortIcon,
} from "../AdminComponents";
import { fmtDateTime, adminFetch, PIE_COLORS, AI_CALL_TYPES } from "../admin-utils";

type SortDir = "asc" | "desc";

export function AISection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [callTypeFilter, setCallTypeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const { data: overview } = useQuery<{
    today: number; yesterday: number; thisMonth: number; prevMonth: number;
    breakdown: { call_type?: string; callType?: string; count: number; total_tokens?: number; totalTokens?: number }[];
  }>({ queryKey: ["/api/admin/ai/overview"] });

  const { data: status } = useQuery<{ set: boolean; valid: boolean }>({ queryKey: ["/api/admin/ai/status"] });

  const aiLogsParams = new URLSearchParams({ page: String(page), limit: "20", sortBy, sortDir });
  if (search) aiLogsParams.set("search", search);
  if (callTypeFilter !== "all") aiLogsParams.set("callType", callTypeFilter);

  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: Record<string, unknown>[]; total: number }>({
    queryKey: ["/api/admin/ai/logs", page, search, callTypeFilter, sortBy, sortDir],
    queryFn: () => adminFetch(`/api/admin/ai/logs?${aiLogsParams.toString()}`),
  });

  const breakdown = overview?.breakdown ?? [];
  const pieData = breakdown.map(b => ({
    callType: b.call_type ?? b.callType,
    count: b.count,
    totalTokens: b.total_tokens ?? b.totalTokens,
  }));

  return (
    <div className="space-y-6">
      <SectionTitle>{t("ai.title")}</SectionTitle>

      {status && !status.valid && (
        <div className={`flex items-start gap-3 p-4 rounded-lg border ${status.set ? "border-yellow-500/40 bg-yellow-500/10" : "border-red-500/40 bg-red-500/10"}`}
          data-testid="banner-ai-key-warning">
          <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${status.set ? "text-yellow-400" : "text-red-400"}`} />
          <div>
            <p className={`font-semibold text-sm ${status.set ? "text-yellow-300" : "text-red-300"}`}>
              {status.set ? t("ai.keyInvalid") : t("ai.keyMissing")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status.set ? t("ai.keyInvalidHint") : t("ai.keyMissingHint")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today" value={overview?.today ?? 0} icon={Brain} color="text-violet-400" />
        <StatCard label="Yesterday" value={overview?.yesterday ?? 0} icon={Brain} />
        <StatCard label="This Month" value={overview?.thisMonth ?? 0} icon={Activity} color="text-blue-400" />
        <StatCard label={t("ai.status")}
          value={status?.valid ? "✓ OK" : status?.set ? "⚠ Key set, invalid" : "✗ Not set"}
          icon={Zap} color={status?.valid ? "text-green-400" : "text-red-400"} />
      </div>

      {pieData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-4">
            <SubTitle>{t("ai.byType")}</SubTitle>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={pieData} dataKey="count" nameKey="callType" cx="50%" cy="50%" outerRadius={70}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#1a1a1a", border: "1px solid #333", color: "#fff" }}
                  formatter={(val: number, _name: string, props: { payload?: { callType: string } }) => [val, props.payload?.callType]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <SubTitle>{t("ai.byType")} — Table</SubTitle>
            <TableWrapper>
              <thead><tr><Th>{t("ai.callType")}</Th><Th>{t("ai.count")}</Th><Th>{t("ai.tokens")}</Th></tr></thead>
              <tbody>
                {pieData.map((b, i) => (
                  <tr key={i} className="hover:bg-accent/30">
                    <Td><Badge variant="outline" className="text-xs">{b.callType as string}</Badge></Td>
                    <Td className="font-mono">{b.count}</Td>
                    <Td className="font-mono text-xs">{b.totalTokens ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          </div>
        </div>
      )}

      <div>
        <SubTitle>AI Call Logs</SubTitle>
        <div className="flex flex-wrap gap-3 mb-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input data-testid="input-ai-search" className="pl-9" placeholder={t("common.search")}
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={callTypeFilter} onValueChange={v => { setCallTypeFilter(v); setPage(1); }}>
            <SelectTrigger data-testid="select-ai-calltype" className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {AI_CALL_TYPES.map(ct => <SelectItem key={ct} value={ct}>{ct}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {logsLoading ? (
          <div className="text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <>
            <TableWrapper>
              <thead>
                <tr>
                  <Th onClick={() => toggleSort("user_email")}>User<SortIcon field="user_email" sort={sortBy} dir={sortDir} /></Th>
                  <Th onClick={() => toggleSort("call_type")}>Type<SortIcon field="call_type" sort={sortBy} dir={sortDir} /></Th>
                  <Th onClick={() => toggleSort("tokens_used")}>Tokens<SortIcon field="tokens_used" sort={sortBy} dir={sortDir} /></Th>
                  <Th onClick={() => toggleSort("created_at")}>Time<SortIcon field="created_at" sort={sortBy} dir={sortDir} /></Th>
                </tr>
              </thead>
              <tbody>
                {(logsData?.logs ?? []).length === 0 ? (
                  <EmptyRow colSpan={4} label={t("common.noData")} />
                ) : (logsData?.logs ?? []).map((c, i) => (
                  <tr key={i} className="hover:bg-accent/30" data-testid={`row-ai-${i}`}>
                    <Td className="text-muted-foreground text-xs">{(c.user_email as string) ?? "anon"}</Td>
                    <Td><Badge variant="outline" className="text-xs">{c.call_type as string}</Badge></Td>
                    <Td className="font-mono text-xs">{(c.tokens_used as string) ?? "—"}</Td>
                    <Td className="text-muted-foreground">{fmtDateTime(c.created_at as string)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
            <Pagination page={page} total={logsData?.total ?? 0} limit={20} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
