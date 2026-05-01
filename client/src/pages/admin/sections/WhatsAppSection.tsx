import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Phone, X, AlertTriangle, Check, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  SectionTitle, SubTitle, TableWrapper, Th, Td, EmptyRow, Pagination, SortIcon,
} from "../AdminComponents";
import { fmtDateTime, adminFetch, formatWhatsAppType } from "../admin-utils";

type WaMode = "single" | "dual";
type InstanceKey = "default" | "personal" | "business";

interface InstanceData {
  status: string;
  phone: string | null;
  qrCode: string | null;
}

interface ModeData {
  mode: WaMode;
  instances: Record<InstanceKey, InstanceData>;
}

function InstanceCard({
  label,
  instance,
  data,
  onConnect,
  onDisconnect,
  onReset,
  connectPending,
  disconnectPending,
  resetPending,
}: {
  label: string;
  instance: InstanceKey;
  data: InstanceData | undefined;
  onConnect: (instance: InstanceKey) => void;
  onDisconnect: (instance: InstanceKey) => void;
  onReset: (instance: InstanceKey) => void;
  connectPending: boolean;
  disconnectPending: boolean;
  resetPending: boolean;
}) {
  const { t } = useTranslation("axisAdmin");
  const status = data?.status ?? "disconnected";
  const isConnected = status === "connected";
  const hasQr = !!data?.qrCode;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <SubTitle>{label}</SubTitle>
      <div className="flex items-center gap-2">
        <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : status === "qr_pending" ? "bg-yellow-400 animate-pulse" : "bg-red-400"}`} />
        <span className={`font-medium text-sm ${isConnected ? "text-green-400" : status === "qr_pending" ? "text-yellow-400" : "text-red-400"}`}>
          {isConnected ? t("whatsapp.connected") : status === "qr_pending" ? t("whatsapp.connecting") : t("whatsapp.disconnected")}
        </span>
      </div>

      {data?.phone && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Phone className="h-3.5 w-3.5" />{data.phone}
        </div>
      )}

      {hasQr && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{t("whatsapp.scanQr")}</div>
          <img src={data!.qrCode!} alt="WhatsApp QR Code"
            className="rounded-lg border border-border w-40 h-40 object-contain bg-white"
            data-testid={`img-whatsapp-qr-${instance}`} />
          <div className="text-xs text-yellow-400 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {t("whatsapp.qrExpires")}
          </div>
        </div>
      )}

      {!hasQr && isConnected && (
        <div className="text-emerald-400 text-xs flex items-center gap-2">
          <Check className="h-3.5 w-3.5" /> {t("whatsapp.connected")}
        </div>
      )}

      {!hasQr && !isConnected && !data?.phone && (
        <div className="text-muted-foreground text-xs">{t("whatsapp.connectFirst")}</div>
      )}

      <div className="flex gap-2 flex-wrap">
        {!isConnected && (
          <Button data-testid={`button-whatsapp-connect-${instance}`} size="sm"
            onClick={() => onConnect(instance)}
            disabled={connectPending || status === "qr_pending"}>
            {connectPending ? t("common.loading") : t("whatsapp.connect")}
          </Button>
        )}
        {isConnected && (
          <Button data-testid={`button-whatsapp-disconnect-${instance}`} size="sm" variant="outline"
            className="text-amber-400 border-amber-400/40"
            onClick={() => onDisconnect(instance)}
            disabled={disconnectPending}>
            <X className="h-3.5 w-3.5 mr-1" /> {t("whatsapp.disconnect")}
          </Button>
        )}
        <Button data-testid={`button-whatsapp-reset-${instance}`} size="sm" variant="outline"
          className="text-destructive border-destructive/40"
          onClick={() => onReset(instance)}
          disabled={resetPending}>
          {t("whatsapp.resetConfig")}
        </Button>
      </div>
    </div>
  );
}

export function WhatsAppSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirmDisconnect, setConfirmDisconnect] = useState<InstanceKey | null>(null);
  const [confirmReset, setConfirmReset] = useState<InstanceKey | null>(null);
  const [confirmModeChange, setConfirmModeChange] = useState<WaMode | null>(null);
  const [qrPollingInstances, setQrPollingInstances] = useState<Set<InstanceKey>>(new Set());

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  const isPolling = qrPollingInstances.size > 0;

  const { data: modeData, isLoading: modeLoading } = useQuery<ModeData>({
    queryKey: ["/api/admin/whatsapp/mode"],
    queryFn: () => adminFetch("/api/admin/whatsapp/mode"),
    refetchInterval: isPolling ? 3000 : false,
  });

  const mode = modeData?.mode ?? "single";

  const { data: statusData, isLoading: statusLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/whatsapp/status"],
    queryFn: () => adminFetch("/api/whatsapp/status"),
    refetchInterval: (isPolling && qrPollingInstances.has("default")) ? 3000 : false,
    enabled: mode === "single",
  });

  const logsParams = new URLSearchParams({ page: String(page), limit: "20", sortBy, sortDir });
  if (search) logsParams.set("search", search);
  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: Record<string, unknown>[]; total: number }>({
    queryKey: ["/api/admin/whatsapp/logs", page, search, sortBy, sortDir],
    queryFn: () => adminFetch(`/api/admin/whatsapp/logs?${logsParams}`),
  });

  const status = (statusData?.status as string) ?? "disconnected";
  const isConnected = status === "connected";

  const setMode = useMutation({
    mutationFn: async (newMode: WaMode) => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/mode", { mode: newMode });
      return res.json();
    },
    onSuccess: () => {
      setQrPollingInstances(new Set());
      setConfirmModeChange(null);
      toast({ title: t("whatsapp.modeChanged") });
      qc.invalidateQueries({ queryKey: ["/api/admin/whatsapp/mode"] });
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  const connect = useMutation({
    mutationFn: async (instance: InstanceKey) => {
      const res = await apiRequest("POST", "/api/whatsapp/connect", { instance });
      return res.json() as Promise<{ status?: string; qrCode?: string }>;
    },
    onSuccess: (data, instance) => {
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/whatsapp/mode"] });
      if (data?.qrCode || data?.status === "qr_pending") {
        setQrPollingInstances(prev => new Set(prev).add(instance));
        toast({ title: t("whatsapp.connecting") });
      } else if (data?.status === "connected") {
        setQrPollingInstances(prev => { const s = new Set(prev); s.delete(instance); return s; });
        toast({ title: t("whatsapp.connected") });
      }
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  const disconnect = useMutation({
    mutationFn: async (instance: InstanceKey) => {
      await apiRequest("POST", "/api/whatsapp/disconnect", { instance });
    },
    onSuccess: (_data, instance) => {
      setQrPollingInstances(prev => { const s = new Set(prev); s.delete(instance); return s; });
      setConfirmDisconnect(null);
      toast({ title: t("whatsapp.disconnected") });
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/whatsapp/mode"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  const reset = useMutation({
    mutationFn: async (instance: InstanceKey) => {
      await apiRequest("POST", "/api/whatsapp/reset", { instance });
    },
    onSuccess: (_data, instance) => {
      setQrPollingInstances(prev => { const s = new Set(prev); s.delete(instance); return s; });
      setConfirmReset(null);
      toast({ title: t("whatsapp.disconnected") });
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/whatsapp/mode"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  useEffect(() => {
    if (status === "qr_pending") setQrPollingInstances(prev => new Set(prev).add("default"));
    if (status === "connected" || status === "disconnected") {
      setQrPollingInstances(prev => { const s = new Set(prev); s.delete("default"); return s; });
    }
  }, [status]);

  useEffect(() => {
    if (!modeData?.instances) return;
    setQrPollingInstances(prev => {
      const next = new Set(prev);
      for (const [key, inst] of Object.entries(modeData.instances) as [InstanceKey, InstanceData][]) {
        if (inst.status === "connected" || inst.status === "disconnected") {
          next.delete(key);
        }
      }
      return next;
    });
  }, [modeData]);

  return (
    <div className="space-y-6">
      <SectionTitle>{t("whatsapp.title")}</SectionTitle>

      {/* Mode Toggle */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <SubTitle>{t("whatsapp.mode")}</SubTitle>
        {modeLoading ? (
          <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
        ) : (
          <div className="flex gap-3 flex-wrap">
            <button
              data-testid="button-mode-single"
              onClick={() => mode !== "single" && setConfirmModeChange("single")}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left w-full max-w-xs ${mode === "single" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-background"}`}
            >
              <div className="mt-0.5">
                {mode === "single" ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div>
                <div className="font-medium text-sm">{t("whatsapp.modeSingle")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t("whatsapp.modeSingleDesc")}</div>
              </div>
            </button>
            <button
              data-testid="button-mode-dual"
              onClick={() => mode !== "dual" && setConfirmModeChange("dual")}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left w-full max-w-xs ${mode === "dual" ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-background"}`}
            >
              <div className="mt-0.5">
                {mode === "dual" ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div>
                <div className="font-medium text-sm">{t("whatsapp.modeDual")}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t("whatsapp.modeDualDesc")}</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Connection Cards */}
      {mode === "single" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <SubTitle>{t("whatsapp.connection")}</SubTitle>
            {statusLoading ? (
              <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : status === "qr_pending" ? "bg-yellow-400 animate-pulse" : "bg-red-400"}`} />
                  <span className={`font-medium ${isConnected ? "text-green-400" : status === "qr_pending" ? "text-yellow-400" : "text-red-400"}`}>
                    {isConnected ? t("whatsapp.connected") : status === "qr_pending" ? t("whatsapp.connecting") : t("whatsapp.disconnected")}
                  </span>
                </div>
                {statusData?.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />{statusData.phone as string}
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  {!isConnected && (
                    <Button data-testid="button-whatsapp-connect" size="sm"
                      onClick={() => connect.mutate("default")} disabled={connect.isPending || status === "qr_pending"}>
                      {connect.isPending ? t("common.loading") : t("whatsapp.connect")}
                    </Button>
                  )}
                  {isConnected && (
                    <Button data-testid="button-whatsapp-disconnect" size="sm" variant="outline"
                      className="text-amber-400 border-amber-400/40" onClick={() => setConfirmDisconnect("default")}>
                      <X className="h-3.5 w-3.5 mr-1" /> {t("whatsapp.disconnect")}
                    </Button>
                  )}
                  <Button data-testid="button-whatsapp-reset" size="sm" variant="outline"
                    className="text-destructive border-destructive/40" onClick={() => setConfirmReset("default")}>
                    {t("whatsapp.resetConfig")}
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <SubTitle>QR Code</SubTitle>
            {statusData?.qrCode ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">{t("whatsapp.scanQr")}</div>
                <img src={statusData!.qrCode as string} alt="WhatsApp QR Code"
                  className="rounded-lg border border-border w-48 h-48 object-contain bg-white"
                  data-testid="img-whatsapp-qr" />
                <div className="text-xs text-yellow-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> {t("whatsapp.qrExpires")}
                </div>
              </div>
            ) : isConnected ? (
              <div className="text-emerald-400 text-sm flex items-center gap-2">
                <Check className="h-4 w-4" /> {t("whatsapp.connected")}
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">{t("whatsapp.connectFirst")}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <InstanceCard
            label={t("whatsapp.personalInstance")}
            instance="personal"
            data={modeData?.instances?.personal}
            onConnect={(i) => connect.mutate(i)}
            onDisconnect={(i) => setConfirmDisconnect(i)}
            onReset={(i) => setConfirmReset(i)}
            connectPending={connect.isPending}
            disconnectPending={disconnect.isPending}
            resetPending={reset.isPending}
          />
          <InstanceCard
            label={t("whatsapp.businessInstance")}
            instance="business"
            data={modeData?.instances?.business}
            onConnect={(i) => connect.mutate(i)}
            onDisconnect={(i) => setConfirmDisconnect(i)}
            onReset={(i) => setConfirmReset(i)}
            connectPending={connect.isPending}
            disconnectPending={disconnect.isPending}
            resetPending={reset.isPending}
          />
        </div>
      )}

      {/* Mode change confirmation dialog */}
      <Dialog open={confirmModeChange !== null} onOpenChange={() => setConfirmModeChange(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {confirmModeChange === "dual" ? t("whatsapp.modeDual") : t("whatsapp.modeSingle")}
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">{t("whatsapp.modeWarning")}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmModeChange(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-mode-change"
              onClick={() => confirmModeChange && setMode.mutate(confirmModeChange)}
              disabled={setMode.isPending}>
              {setMode.isPending ? t("common.loading") : t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disconnect confirmation */}
      <Dialog open={confirmDisconnect !== null} onOpenChange={() => setConfirmDisconnect(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("whatsapp.disconnect")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("whatsapp.disconnectNote")}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDisconnect(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-disconnect-whatsapp" variant="destructive"
              onClick={() => confirmDisconnect && disconnect.mutate(confirmDisconnect)}
              disabled={disconnect.isPending}>{t("whatsapp.disconnect")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation */}
      <Dialog open={confirmReset !== null} onOpenChange={() => setConfirmReset(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("whatsapp.resetConfig")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("whatsapp.resetNote")}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(null)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-reset-whatsapp" variant="destructive"
              onClick={() => confirmReset && reset.mutate(confirmReset)}
              disabled={reset.isPending}>{t("whatsapp.resetConfig")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-3">
        <SubTitle>{t("whatsapp.logs")}</SubTitle>
        <Input
          data-testid="input-search-wlogs"
          className="h-8 w-56 text-xs bg-background border-border"
          placeholder={t("common.search") + "…"}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>
      {logsLoading ? (
        <div className="text-muted-foreground">{t("common.loading")}</div>
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th onClick={() => toggleSort("sender_phone")}>{t("whatsapp.sender")}<SortIcon field="sender_phone" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("message_type")}>{t("whatsapp.messageType")}<SortIcon field="message_type" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("result")}>{t("whatsapp.result")}<SortIcon field="result" sort={sortBy} dir={sortDir} /></Th>
                <Th onClick={() => toggleSort("created_at")}>{t("whatsapp.receivedAt")}<SortIcon field="created_at" sort={sortBy} dir={sortDir} /></Th>
              </tr>
            </thead>
            <tbody>
              {(logsData?.logs ?? []).length === 0 ? (
                <EmptyRow colSpan={4} label={t("common.noData")} />
              ) : (logsData?.logs ?? []).map((l, i) => (
                <tr key={i} className="hover:bg-accent/30" data-testid={`row-wlog-${i}`}>
                  <Td className="font-mono text-xs">{(l.senderPhone ?? l.sender_phone ?? "—") as string}</Td>
                  <Td><Badge variant="outline" className="text-xs">{formatWhatsAppType((l.messageType ?? l.message_type) as string, t)}</Badge></Td>
                  <Td className="text-sm max-w-xs truncate">{(l.result ?? "—") as string}</Td>
                  <Td className="text-muted-foreground">{fmtDateTime((l.createdAt ?? l.created_at) as string)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} total={logsData?.total ?? 0} limit={20} onPage={setPage} />
        </>
      )}
    </div>
  );
}
