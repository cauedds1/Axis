import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SectionTitle, TableWrapper, Th, Td, EmptyRow, Pagination, SortIcon,
} from "../AdminComponents";
import { fmtDateTime, adminFetch } from "../admin-utils";

const ACTION_TYPES = [
  "impersonate", "impersonate_stop", "delete_user", "deactivate_user", "reactivate_user",
  "reset_password", "update_plan", "maintenance_on", "maintenance_off", "seed_demo", "reset_demo",
];

type SortDir = "asc" | "desc";

export function AuditSection() {
  const { t } = useTranslation("axisAdmin");
  const [page, setPage] = useState(1);
  const [actor, setActor] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const auditParams = new URLSearchParams({ page: String(page), limit: "20", sortBy, sortDir });
  if (actor) auditParams.set("actor", actor);
  if (actionFilter) auditParams.set("action", actionFilter);

  const { data, isLoading } = useQuery<{ logs: Record<string, unknown>[]; total: number }>({
    queryKey: ["/api/admin/audit-logs", page, actor, actionFilter, sortBy, sortDir],
    queryFn: () => adminFetch(`/api/admin/audit-logs?${auditParams.toString()}`),
  });

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-4">
      <SectionTitle>{t("audit.title")}</SectionTitle>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-audit-actor" className="pl-9" placeholder={t("audit.actor")}
            value={actor} onChange={e => { setActor(e.target.value); setPage(1); }} />
        </div>
        <Select value={actionFilter || "all"} onValueChange={v => { setActionFilter(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger data-testid="select-audit-action" className="w-48">
            <SelectValue placeholder={t("audit.action")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("audit.allActions")}</SelectItem>
            {ACTION_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
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
                <Th onClick={() => toggleSort("actor_email")}>{t("audit.actor")}<SortIcon field="actor_email" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("action")}>{t("audit.action")}<SortIcon field="action" sort={sortBy} dir={sortDir} /></Th>
                <Th>{t("audit.target")}</Th>
                <Th>{t("audit.targetId")}</Th>
                <Th onClick={() => toggleSort("created_at")}>{t("audit.timestamp")}<SortIcon field="created_at" sort={sortBy} dir={sortDir} /></Th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <EmptyRow colSpan={5} label={t("common.noData")} />
              ) : logs.map((l, i) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-audit-${i}`}>
                  <Td className="text-muted-foreground text-xs">{(l.actor_email ?? l.actorEmail ?? l.actor_id ?? "—") as string}</Td>
                  <Td><Badge variant="outline" className="text-xs">{l.action as string}</Badge></Td>
                  <Td className="text-xs">{(l.target_type ?? l.targetType ?? "—") as string}</Td>
                  <Td className="font-mono text-xs text-muted-foreground max-w-xs truncate">{(l.target_id ?? l.targetId ?? "—") as string}</Td>
                  <Td className="text-muted-foreground">{fmtDateTime((l.created_at ?? l.createdAt) as string)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={data?.total ?? 0} limit={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}
