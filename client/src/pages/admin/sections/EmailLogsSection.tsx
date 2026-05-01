import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, Mail, Send, CheckCircle, XCircle, Percent } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SectionTitle, StatCard, TableWrapper, Th, Td, EmptyRow, Pagination, SortIcon,
} from "../AdminComponents";
import { fmtDateTime, adminFetch } from "../admin-utils";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Canonical alert type names — must match alertType values written in server/alerts.ts
const ALERT_TYPES = ["bill_due_soon", "overdue_tasks", "goal_deadline", "low_discipline", "weekly_summary", "offline_reminder", "admin_test_email"];

type SortDir = "asc" | "desc";

export function EmailLogsSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [alertType, setAlertType] = useState("all");
  const [sortBy, setSortBy] = useState("sent_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [testRecipient, setTestRecipient] = useState("");

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  };

  const emailParams = new URLSearchParams({ page: String(page), limit: "20", sortBy, sortDir });
  if (search) emailParams.set("search", search);
  if (alertType !== "all") emailParams.set("alertType", alertType);

  const { data, isLoading } = useQuery<{
    logs: Record<string, unknown>[];
    total: number;
    typeCounts?: { alert_type: string; count: number }[];
    currentMonth?: number;
    prevMonth?: number;
    totalSent?: number;
    totalFailed?: number;
    successRate?: number;
  }>({
    queryKey: ["/api/admin/email-logs", page, search, alertType, sortBy, sortDir],
    queryFn: () => adminFetch(`/api/admin/email-logs?${emailParams.toString()}`),
  });

  const testEmailMutation = useMutation({
    mutationFn: async (recipient: string) => {
      const res = await apiRequest("POST", "/api/admin/system/test-email", { recipient: recipient || undefined });
      return res.json() as Promise<{ recipient: string }>;
    },
    onSuccess: (result: { recipient: string }) => {
      toast({ title: t("email.testSent"), description: result.recipient });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-logs"] });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    },
  });

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-4">
      <SectionTitle>{t("email.title")}</SectionTitle>

      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-border bg-card">
        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground">{t("email.testEmailLabel")}</span>
        <Input
          data-testid="input-test-email-recipient"
          className="flex-1 min-w-48 h-8 text-sm"
          placeholder={t("email.testRecipientPlaceholder")}
          value={testRecipient}
          onChange={e => setTestRecipient(e.target.value)}
        />
        <Button
          data-testid="button-send-test-email"
          size="sm"
          onClick={() => testEmailMutation.mutate(testRecipient)}
          disabled={testEmailMutation.isPending}
        >
          <Send className="h-3 w-3 mr-1" />
          {testEmailMutation.isPending ? t("common.loading") : t("email.sendTest")}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("email.totalSent")} value={data?.totalSent ?? 0} icon={CheckCircle} color="text-emerald-400" />
        <StatCard label={t("email.totalFailed")} value={data?.totalFailed ?? 0} icon={XCircle} color="text-red-400" />
        <StatCard label={t("email.successRate")} value={`${data?.successRate ?? 100}%`} icon={Percent} color={(data?.successRate ?? 100) >= 95 ? "text-emerald-400" : "text-yellow-400"} />
        <StatCard label={t("email.thisMonth")} value={data?.currentMonth ?? 0} icon={Mail} color="text-blue-400" />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input data-testid="input-email-search" className="pl-9" placeholder={t("email.to")}
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={alertType} onValueChange={v => { setAlertType(v); setPage(1); }}>
          <SelectTrigger data-testid="select-alert-type" className="w-48">
            <SelectValue placeholder={t("email.alertType")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("email.allTypes")}</SelectItem>
            {ALERT_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
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
                <Th onClick={() => toggleSort("recipient")}>{t("email.to")}<SortIcon field="recipient" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("alert_type")}>{t("email.alertType")}<SortIcon field="alert_type" sort={sortBy} dir={sortDir} /></Th>
                <Th>{t("email.status")}</Th>
                <Th onClick={() => toggleSort("sent_at")}>{t("email.sentAt")}<SortIcon field="sent_at" sort={sortBy} dir={sortDir} /></Th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <EmptyRow colSpan={4} label={t("common.noData")} />
              ) : logs.map((l, i) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-email-${i}`}>
                  <Td className="text-muted-foreground text-xs">{(l.recipient ?? l.user_email ?? l.userId ?? "—") as string}</Td>
                  <Td><Badge variant="outline" className="text-xs">{(l.alert_type ?? l.alertType) as string}</Badge></Td>
                  <Td>
                    <Badge variant="outline" className={`text-xs ${(l.status ?? "sent") === "failed" ? "border-red-500 text-red-400" : "border-green-500 text-green-400"}`}>
                      {(l.status ?? "sent") === "failed" ? t("email.failed") : t("email.sent")}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">{fmtDateTime((l.sent_at ?? l.sentAt) as string)}</Td>
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
