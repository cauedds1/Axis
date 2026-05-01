import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Activity, Database, Server, Edit, Check, X, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  SectionTitle, SubTitle, StatCard, TableWrapper, Th, Td, EmptyRow, Pagination, SortIcon,
} from "../AdminComponents";
import { fmtDateTime, adminFetch } from "../admin-utils";

interface HealthData {
  dbConnected: boolean;
  uptime: number;
  nodeVersion: string;
  memory: { rss: number; heapUsed: number; heapTotal: number };
}

interface ConfigEntry {
  key: string;
  value?: string;
  updatedAt?: string;
  updated_at?: string;
}

interface EnvVar {
  key: string;
  set: boolean;
  value?: string;
}

interface RateLimitEntry {
  windowMs: number;
  max: number;
  description?: string;
}

const AUDIT_ACTION_TYPES = [
  "impersonate", "impersonate_stop", "delete_user", "deactivate_user", "reactivate_user",
  "reset_password", "update_plan", "maintenance_on", "maintenance_off", "seed_demo", "reset_demo",
];

type SortDir = "asc" | "desc";

export function SystemSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: healthData } = useQuery<HealthData>({ queryKey: ["/api/admin/system/health"] });
  const { data: configData, isLoading: configLoading } = useQuery<{
    envVars: EnvVar[]; configs: ConfigEntry[]; maintenanceMode: boolean;
  }>({ queryKey: ["/api/admin/system/config"] });
  const { data: rateLimitData } = useQuery<Record<string, RateLimitEntry>>({ queryKey: ["/api/admin/rate-limits/status"] });

  const [editConfig, setEditConfig] = useState<ConfigEntry | null>(null);
  const [editValue, setEditValue] = useState("");

  // Audit log state
  const [auditPage, setAuditPage] = useState(1);
  const [auditActor, setAuditActor] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditSortBy, setAuditSortBy] = useState("created_at");
  const [auditSortDir, setAuditSortDir] = useState<SortDir>("desc");

  const toggleAuditSort = (col: string) => {
    if (auditSortBy === col) setAuditSortDir(d => d === "asc" ? "desc" : "asc");
    else { setAuditSortBy(col); setAuditSortDir("asc"); }
    setAuditPage(1);
  };

  const auditParams = new URLSearchParams({ page: String(auditPage), limit: "20", sortBy: auditSortBy, sortDir: auditSortDir });
  if (auditActor) auditParams.set("actor", auditActor);
  if (auditAction) auditParams.set("action", auditAction);

  const { data: auditData, isLoading: auditLoading } = useQuery<{ logs: Record<string, unknown>[]; total: number }>({
    queryKey: ["/api/admin/audit-logs", auditPage, auditActor, auditAction, auditSortBy, auditSortDir],
    queryFn: () => adminFetch(`/api/admin/audit-logs?${auditParams.toString()}`),
  });

  const auditLogs = auditData?.logs ?? [];

  const health = healthData ?? {} as HealthData;
  const envVars = configData?.envVars ?? [];
  const configs = configData?.configs ?? [];
  const maintenanceMode = configData?.maintenanceMode ?? false;
  const rateLimits = rateLimitData ?? {};

  const maintenance = useMutation({
    mutationFn: (enabled: boolean) => apiRequest("POST", "/api/admin/system/maintenance", { enabled }),
    onSuccess: (_data, enabled) => {
      toast({ title: enabled ? t("system.maintenanceEnabled") : t("system.maintenanceDisabled") });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/config"] });
    },
  });

  const updateConfig = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiRequest("POST", "/api/admin/system/config", { key, value }),
    onSuccess: () => {
      toast({ title: t("common.save") + " ✓" });
      qc.invalidateQueries({ queryKey: ["/api/admin/system/config"] });
      setEditConfig(null);
    },
  });

  const ENV_HINTS: Record<string, string> = {
    OPENAI_API_KEY: "Required for AI features (chat, transcription, PDF analysis). Get yours at platform.openai.com → API Keys.",
    SENDGRID_API_KEY: "Required for email alerts. Create a key in SendGrid → Settings → API Keys.",
    STRIPE_SECRET_KEY: "Required for payments. Found in Stripe Dashboard → Developers → API Keys.",
    STRIPE_WEBHOOK_SECRET: "Required for Stripe webhook events. Generate in Stripe Dashboard → Webhooks → your endpoint.",
    ADMIN_EMAIL: "Your admin email address. Set to your own email to unlock this admin panel.",
    APP_URL: "Public app URL (e.g. https://axis.replit.app). Used in email templates.",
    DATABASE_URL: "PostgreSQL connection string. Auto-configured by Replit Postgres integration.",
  };

  const formatUptime = (s: number) => {
    if (!s) return "—";
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  };

  return (
    <div className="space-y-6">
      <SectionTitle>{t("system.title")}</SectionTitle>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label={t("system.uptime")} value={formatUptime(health.uptime)} icon={Activity} color="text-green-400" />
        <StatCard label="Memory (heap used)" value={health.memory?.heapUsed != null ? `${health.memory.heapUsed} MB` : "—"} icon={Database} />
        <StatCard label={t("system.nodeVersion")} value={health.nodeVersion ?? "—"} icon={Server} />
        <StatCard label={t("system.dbConnected")} value={health.dbConnected ? "✓ Yes" : "✗ No"} icon={Database}
          color={health.dbConnected ? "text-green-400" : "text-red-400"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SubTitle>{t("system.maintenance")}</SubTitle>
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${maintenanceMode ? "bg-yellow-400" : "bg-green-400"}`} />
            <span className="text-sm font-medium">{maintenanceMode ? "ENABLED" : "DISABLED"}</span>
          </div>
          <div className="flex gap-2">
            <Button data-testid="button-enable-maintenance" size="sm" variant="outline"
              onClick={() => maintenance.mutate(true)} disabled={maintenanceMode || maintenance.isPending}>
              {t("system.enable")}
            </Button>
            <Button data-testid="button-disable-maintenance" size="sm" variant="outline"
              onClick={() => maintenance.mutate(false)} disabled={!maintenanceMode || maintenance.isPending}>
              {t("system.disable")}
            </Button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SubTitle>Rate Limits</SubTitle>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            {Object.entries(rateLimits).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="font-mono capitalize">{k}</span>
                <span>{v.max} req / {Math.round(v.windowMs / 60_000)}m</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {envVars.length > 0 && (
        <div>
          <SubTitle>Environment Variables</SubTitle>
          <div className="space-y-2">
            {envVars.map((ev, i) => (
              <div key={i} className={`flex flex-col gap-0.5 p-3 rounded-lg border text-xs ${ev.set ? "border-border bg-card" : "border-yellow-500/30 bg-yellow-500/5"}`}
                data-testid={`env-row-${ev.key}`}>
                <div className="flex items-center gap-2">
                  {ev.set
                    ? <Check className="h-3.5 w-3.5 text-green-400 shrink-0" />
                    : <X className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                  <span className="font-mono font-semibold">{ev.key}</span>
                  {ev.set && <span className="font-mono text-muted-foreground ml-2">{ev.value ?? "***"}</span>}
                </div>
                {!ev.set && ENV_HINTS[ev.key] && (
                  <p className="text-muted-foreground pl-5">{ENV_HINTS[ev.key]}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {configs.length > 0 && (
        <div>
          <SubTitle>{t("system.config")}</SubTitle>
          {configLoading ? (
            <div className="text-muted-foreground">{t("common.loading")}</div>
          ) : (
            <TableWrapper>
              <thead>
                <tr>
                  <Th>{t("system.key")}</Th>
                  <Th>{t("system.value")}</Th>
                  <Th>{t("system.updatedAt")}</Th>
                  <Th>{t("users.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c, i) => (
                  <tr key={i} className="hover:bg-accent/30" data-testid={`row-config-${i}`}>
                    <Td className="font-mono text-xs">{c.key}</Td>
                    <Td className="font-mono text-xs max-w-xs truncate">{c.value ?? "—"}</Td>
                    <Td className="text-muted-foreground">{fmtDateTime((c.updatedAt ?? c.updated_at) as string)}</Td>
                    <Td>
                      <Button data-testid={`button-edit-config-${i}`} variant="ghost" size="sm"
                        onClick={() => { setEditConfig(c); setEditValue(c.value ?? ""); }}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrapper>
          )}
        </div>
      )}

      {Object.keys(rateLimits).length > 0 && (
        <div>
          <SubTitle>{t("system.rateLimits")}</SubTitle>
          <TableWrapper>
            <thead><tr><Th>Name</Th><Th>{t("system.window")}</Th><Th>{t("system.max")}</Th><Th>{t("system.description")}</Th></tr></thead>
            <tbody>
              {Object.entries(rateLimits).map(([key, val]) => (
                <tr key={key} className="hover:bg-accent/30">
                  <Td className="font-mono text-xs">{key}</Td>
                  <Td className="text-muted-foreground">{val.windowMs / 1000}s</Td>
                  <Td>{val.max}</Td>
                  <Td className="text-muted-foreground text-xs">{val.description}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
        </div>
      )}

      {/* ── Audit Log subsection ───────────────────────────────────────── */}
      <div className="border-t border-border pt-6 space-y-4">
        <SubTitle>{t("audit.title")}</SubTitle>
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input data-testid="input-audit-actor" className="pl-9" placeholder={t("audit.actor")}
              value={auditActor} onChange={e => { setAuditActor(e.target.value); setAuditPage(1); }} />
          </div>
          <Select value={auditAction || "all"} onValueChange={v => { setAuditAction(v === "all" ? "" : v); setAuditPage(1); }}>
            <SelectTrigger data-testid="select-audit-action" className="w-48">
              <SelectValue placeholder={t("audit.action")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {AUDIT_ACTION_TYPES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {auditLoading ? (
          <div className="text-muted-foreground">{t("common.loading")}</div>
        ) : (
          <>
            <TableWrapper>
              <thead>
                <tr>
                  <Th onClick={() => toggleAuditSort("actor_email")}>{t("audit.actor")}<SortIcon field="actor_email" sort={auditSortBy} dir={auditSortDir} /></Th>
                  <Th onClick={() => toggleAuditSort("action")}>{t("audit.action")}<SortIcon field="action" sort={auditSortBy} dir={auditSortDir} /></Th>
                  <Th>{t("audit.target")}</Th>
                  <Th>{t("audit.targetId")}</Th>
                  <Th onClick={() => toggleAuditSort("created_at")}>{t("audit.timestamp")}<SortIcon field="created_at" sort={auditSortBy} dir={auditSortDir} /></Th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <EmptyRow colSpan={5} label={t("common.noData")} />
                ) : auditLogs.map((l, i) => (
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
            <Pagination page={auditPage} total={auditData?.total ?? 0} limit={20} onPage={setAuditPage} />
          </>
        )}
      </div>

      <Dialog open={!!editConfig} onOpenChange={() => setEditConfig(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("system.editConfig")}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="font-mono text-xs">{editConfig?.key}</Label>
            <Textarea data-testid="textarea-config-value" value={editValue} onChange={e => setEditValue(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditConfig(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-save-config"
              onClick={() => updateConfig.mutate({ key: editConfig!.key, value: editValue })}
              disabled={updateConfig.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
