import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Phone, X, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  SectionTitle, SubTitle, TableWrapper, Th, Td, EmptyRow, Pagination, SortIcon,
} from "../AdminComponents";
import { fmtDateTime, adminFetch, formatWhatsAppType } from "../admin-utils";

export function WhatsAppSection() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [qrPolling, setQrPolling] = useState(false);

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
    setPage(1);
  };

  const { data: statusData, isLoading: statusLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/whatsapp/status"],
    queryFn: () => adminFetch("/api/whatsapp/status"),
    refetchInterval: qrPolling ? 3000 : false,
  });

  const logsParams = new URLSearchParams({ page: String(page), limit: "20", sortBy, sortDir });
  if (search) logsParams.set("search", search);
  const { data: logsData, isLoading: logsLoading } = useQuery<{ logs: Record<string, unknown>[]; total: number }>({
    queryKey: ["/api/admin/whatsapp/logs", page, search, sortBy, sortDir],
    queryFn: () => adminFetch(`/api/admin/whatsapp/logs?${logsParams}`),
  });

  const status = (statusData?.status as string) ?? "disconnected";
  const isConnected = status === "connected";
  const hasQr = !!(statusData?.qrCode as string);

  const connect = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/connect");
      return res.json() as Promise<{ status?: string; qrCode?: string }>;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      if (data?.qrCode || data?.status === "qr_pending") {
        setQrPolling(true);
        toast({ title: t("whatsapp.connecting") });
      } else if (data?.status === "connected") {
        setQrPolling(false);
        toast({ title: t("whatsapp.connected") });
      }
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  const disconnect = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/disconnect"),
    onSuccess: () => {
      setQrPolling(false);
      setConfirmDisconnect(false);
      toast({ title: t("whatsapp.disconnected") });
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  const reset = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/reset"),
    onSuccess: () => {
      setQrPolling(false);
      setConfirmReset(false);
      toast({ title: t("whatsapp.disconnected") });
      qc.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  useEffect(() => {
    if (status === "qr_pending" && !qrPolling) setQrPolling(true);
    if (status === "connected" && qrPolling) setQrPolling(false);
    if (status === "disconnected" && qrPolling) setQrPolling(false);
  }, [status, qrPolling]);

  return (
    <div className="space-y-6">
      <SectionTitle>{t("whatsapp.title")}</SectionTitle>

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
                    onClick={() => connect.mutate()} disabled={connect.isPending || status === "qr_pending"}>
                    {connect.isPending ? t("common.loading") : t("whatsapp.connect")}
                  </Button>
                )}
                {isConnected && (
                  <Button data-testid="button-whatsapp-disconnect" size="sm" variant="outline"
                    className="text-amber-400 border-amber-400/40" onClick={() => setConfirmDisconnect(true)}>
                    <X className="h-3.5 w-3.5 mr-1" /> {t("whatsapp.disconnect")}
                  </Button>
                )}
                <Button data-testid="button-whatsapp-reset" size="sm" variant="outline"
                  className="text-destructive border-destructive/40" onClick={() => setConfirmReset(true)}>
                  {t("whatsapp.resetConfig")}
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <SubTitle>QR Code</SubTitle>
          {hasQr ? (
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

      <Dialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("whatsapp.disconnect")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("whatsapp.disconnectNote")}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDisconnect(false)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-disconnect-whatsapp" variant="destructive"
              onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>{t("whatsapp.disconnect")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>{t("whatsapp.resetConfig")}</DialogTitle></DialogHeader>
          <div className="text-sm text-muted-foreground">{t("whatsapp.resetNote")}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>{t("common.cancel")}</Button>
            <Button data-testid="button-confirm-reset-whatsapp" variant="destructive"
              onClick={() => reset.mutate()} disabled={reset.isPending}>{t("whatsapp.resetConfig")}</Button>
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
