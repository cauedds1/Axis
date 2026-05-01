import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Activity, Database, Server, Edit, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  SectionTitle, SubTitle, StatCard, TableWrapper, Th, Td,
} from "../AdminComponents";
import { fmtDateTime } from "../admin-utils";

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

  const ENV_HINT_KEYS = [
    "OPENAI_API_KEY", "SENDGRID_API_KEY", "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET", "ADMIN_EMAIL", "APP_URL", "DATABASE_URL",
  ];
  const getEnvHint = (key: string) => {
    if (!ENV_HINT_KEYS.includes(key)) return "";
    return t(`system.envHints.${key}` as Parameters<typeof t>[0]);
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
        <StatCard label={t("system.memory")} value={health.memory?.heapUsed != null ? `${health.memory.heapUsed} MB` : "—"} icon={Database} />
        <StatCard label={t("system.nodeVersion")} value={health.nodeVersion ?? "—"} icon={Server} />
        <StatCard label={t("system.dbConnected")} value={health.dbConnected ? t("system.yes") : t("system.no")} icon={Database}
          color={health.dbConnected ? "text-green-400" : "text-red-400"} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SubTitle>{t("system.maintenance")}</SubTitle>
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${maintenanceMode ? "bg-yellow-400" : "bg-green-400"}`} />
            <span className="text-sm font-medium">{maintenanceMode ? t("system.enabled") : t("system.disabled")}</span>
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
          <SubTitle>{t("system.rateLimitsCard")}</SubTitle>
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
          <SubTitle>{t("system.envVars")}</SubTitle>
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
                {!ev.set && getEnvHint(ev.key) && (
                  <p className="text-muted-foreground pl-5">{getEnvHint(ev.key)}</p>
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
            <thead><tr><Th>{t("system.name")}</Th><Th>{t("system.window")}</Th><Th>{t("system.max")}</Th><Th>{t("system.description")}</Th></tr></thead>
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
