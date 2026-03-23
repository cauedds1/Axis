import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  ExternalLink, Calendar, FileText, CheckCircle2, Clock, XCircle,
  Banknote, ChevronDown, ImageOff, ZoomIn, Copy, Loader2, Link2, Check,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useBusinessTheme, getBusinessPrimaryHex } from "@/components/theme-provider";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

type Preset = "7d" | "30d" | "90d" | "current_month" | "prev_month" | "custom";

function getPresetDates(preset: Preset): { start: Date; end: Date } {
  const now = new Date();
  switch (preset) {
    case "7d":   return { start: subDays(now, 6), end: now };
    case "30d":  return { start: subDays(now, 29), end: now };
    case "90d":  return { start: subDays(now, 89), end: now };
    case "current_month": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "prev_month": {
      const prev = subMonths(now, 1);
      return { start: startOfMonth(prev), end: endOfMonth(prev) };
    }
    default: return { start: subDays(now, 29), end: now };
  }
}

function ReceiptImage({ url, base64, receipt }: { url?: string; base64?: string; receipt: string }) {
  const [zoomed, setZoomed] = useState(false);
  const [err, setErr] = useState(false);
  const src = url || (base64 ? `data:image/jpeg;base64,${base64.replace(/^data:[^;]+;base64,/, "")}` : null);
  if (!src || err) return (
    <div className="print:hidden w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <ImageOff className="w-5 h-5 text-muted-foreground opacity-40" />
    </div>
  );
  return (
    <>
      <div
        className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 cursor-pointer relative group"
        style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={() => setZoomed(true)}
        data-testid="img-receipt-thumb"
      >
        <img src={src} alt={receipt} className="w-full h-full object-cover" onError={() => setErr(true)} />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center print:hidden">
          <ZoomIn className="w-4 h-4 text-white" />
        </div>
        <div className="receipt-print-img hidden print:block w-full h-full">
          <img src={src} alt={receipt} className="w-full h-full object-contain" />
        </div>
      </div>
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 print:hidden"
          onClick={() => setZoomed(false)}
        >
          <img src={src} alt={receipt} className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </>
  );
}

export default function CollaboratorReport() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language.startsWith("pt") ? ptBR : enUS;
  const { user } = useAuth();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);

  const PRESETS: { key: Preset; label: string }[] = [
    { key: "7d",           label: t("axisBiz.collabReport.presets.7d") },
    { key: "30d",          label: t("axisBiz.collabReport.presets.30d") },
    { key: "90d",          label: t("axisBiz.collabReport.presets.90d") },
    { key: "current_month", label: t("axisBiz.collabReport.presets.currentMonth") },
    { key: "prev_month",   label: t("axisBiz.collabReport.presets.prevMonth") },
    { key: "custom",       label: t("axisBiz.collabReport.presets.custom") },
  ];

  const statusConfig = (status: string) => {
    switch (status) {
      case "approved": return { label: t("axisBiz.collabReport.statusApproved"), color: "#22C55E", bg: "#22C55E18", icon: CheckCircle2, border: "#22C55E40" };
      case "paid":     return { label: t("axisBiz.collabReport.statusPaid"),     color: "#818CF8", bg: "#818CF818", icon: Banknote,     border: "#818CF840" };
      case "rejected": return { label: t("axisBiz.collabReport.statusRejected"), color: "#F87171", bg: "#F8717118", icon: XCircle,      border: "#F8717140" };
      default:         return { label: t("axisBiz.collabReport.statusPending"),  color: "#F59E0B", bg: "#F59E0B18", icon: Clock,        border: "#F59E0B40" };
    }
  };

  const [preset, setPreset] = useState<Preset>("30d");
  const [customStart, setCustomStart] = useState(() => format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd]     = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [showPresets, setShowPresets] = useState(false);

  const dates = useMemo(() =>
    preset === "custom"
      ? { start: new Date(customStart + "T00:00:00"), end: new Date(customEnd + "T23:59:59") }
      : getPresetDates(preset),
  [preset, customStart, customEnd]);

  const { data: orgs, isLoading: orgsLoading } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const activeOrg = orgs?.[0];

  const { data: expenses, isLoading: expLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "expenses", "report", dates.start.toISOString(), dates.end.toISOString(), user?.id],
    queryFn: async () => {
      if (!activeOrg?.id || !user?.id) return [];
      const params = new URLSearchParams({
        startDate: dates.start.toISOString(),
        endDate:   dates.end.toISOString(),
        userId:    user.id,
      });
      const res = await fetch(`/api/business/organizations/${activeOrg.id}/expenses?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
    enabled: !!activeOrg?.id && !!user?.id,
  });

  const sorted = (expenses ?? []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalGeral    = sorted.reduce((s, e) => s + e.amount, 0);
  const totalAprovado = sorted.filter(e => e.status === "approved" || e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const totalPendente = sorted.filter(e => e.status === "pending_review").reduce((s, e) => s + e.amount, 0);
  const totalPago     = sorted.filter(e => e.status === "paid").reduce((s, e) => s + e.amount, 0);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const presetLabel = PRESETS.find(p => p.key === preset)?.label ?? t("axisBiz.collabReport.period");
  const periodLabel = `${format(dates.start, "dd/MM/yyyy", { locale: dateLocale })} — ${format(dates.end, "dd/MM/yyyy", { locale: dateLocale })}`;
  const collaboratorName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  const shareMutation = useMutation({
    mutationFn: async () => {
      if (!activeOrg?.id || !user?.id) throw new Error("Incomplete data");
      const res = await apiRequest("POST", "/api/reports/share", {
        orgId:     activeOrg.id,
        userId:    user.id,
        startDate: dates.start.toISOString(),
        endDate:   dates.end.toISOString(),
      });
      const data = await res.json();
      return data as { token: string; url: string };
    },
    onSuccess: (data) => {
      const localUrl = `${window.location.origin}/r/${data.token}`;
      setShareUrl(localUrl);
      setShowShareModal(true);
      setCopied(false);
    },
  });

  const handleGenerate = () => {
    if (!activeOrg?.id || !user?.id) return;
    shareMutation.mutate();
  };

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLoading = orgsLoading || expLoading;

  if (orgsLoading) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );

  return (
    <>
    <div className="p-6 max-w-3xl mx-auto print:p-0" id="collab-report-root">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6" style={{ color: primaryHex }} />
              {t("axisBiz.collabReport.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("axisBiz.collabReport.subtitle")}</p>
          </div>
          <Button
            size="sm"
            className="gap-2 border-0"
            style={{ background: primaryHex, color: "#fff" }}
            onClick={handleGenerate}
            disabled={isLoading || sorted.length === 0 || shareMutation.isPending}
            data-testid="button-generate-report"
          >
            {shareMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {shareMutation.isPending ? t("axisBiz.collabReport.generating") : t("axisBiz.collabReport.generateReport")}
          </Button>
        </div>

        <div className="mb-5">
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9 text-sm w-full sm:w-auto justify-between sm:justify-start"
              onClick={() => setShowPresets(p => !p)}
              data-testid="button-period-selector"
            >
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {presetLabel}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            {showPresets && (
              <div
                className="absolute top-10 left-0 z-20 rounded-xl shadow-xl overflow-hidden min-w-[200px]"
                style={{ background: "hsl(var(--card))", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {PRESETS.map(p => (
                  <button
                    key={p.key}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                    style={{ color: preset === p.key ? primaryHex : undefined }}
                    onClick={() => { setPreset(p.key); setShowPresets(false); }}
                    data-testid={`option-preset-${p.key}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {preset === "custom" && (
            <div className="flex items-center gap-2 mt-3">
              <Input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="h-9 text-sm w-auto"
                data-testid="input-start-date"
              />
              <span className="text-muted-foreground text-sm">{t("axisBiz.collabReport.to")}</span>
              <Input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="h-9 text-sm w-auto"
                data-testid="input-end-date"
              />
            </div>
          )}
        </div>

        <div className="report-header-block mb-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">{t("axisBiz.collabReport.reimbursementReport")}</p>
              <h2 className="text-xl font-bold text-foreground">{collaboratorName}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{activeOrg?.tradeName || activeOrg?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-0.5">{t("axisBiz.collabReport.period")}</p>
              <p className="text-sm font-semibold text-foreground">{periodLabel}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("axisBiz.collabReport.expense", { count: sorted.length })}
              </p>
            </div>
          </div>
        </div>

        <div className="summary-row grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: t("axisBiz.collabReport.summaryTotal"),      value: totalGeral,    color: primaryHex },
            { label: t("axisBiz.collabReport.summaryApproved"),   value: totalAprovado, color: "#22C55E" },
            { label: t("axisBiz.collabReport.summaryPending"),    value: totalPendente, color: "#F59E0B" },
            { label: t("axisBiz.collabReport.summaryReimbursed"), value: totalPago,     color: "#818CF8" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="summary-card rounded-2xl p-4"
              style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="s-label text-xs text-muted-foreground mb-1">{label}</p>
              <p className="s-value text-base font-bold" style={{ color }}>{formatBRL(value)}</p>
            </div>
          ))}
        </div>

        {isLoading && !orgsLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : sorted.length === 0 ? (
          <div
            className="rounded-2xl p-12 flex flex-col items-center gap-3 text-center"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <FileText className="w-10 h-10 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">{t("axisBiz.collabReport.noExpenses")}</p>
            <p className="text-xs text-muted-foreground opacity-60">{t("axisBiz.collabReport.noExpensesHint")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sorted.map((expense, i) => {
              const cfg = statusConfig(expense.status);
              const StatusIcon = cfg.icon;
              const expDate = new Date(expense.date);
              return (
                <motion.div
                  key={expense.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.03 }}
                  className="report-card rounded-2xl overflow-hidden flex"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
                  data-testid={`card-expense-${expense.id}`}
                >
                  <div className="report-card-border w-1 flex-shrink-0" style={{ background: cfg.color }} />
                  <div className="flex-1 p-4 flex items-start gap-4">
                    <ReceiptImage url={expense.receiptImageUrl} base64={expense.receiptImageBase64} receipt={t("axisBiz.collabReport.receipt")} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="expense-meta text-sm font-semibold text-foreground leading-tight" data-testid={`text-expense-description-${expense.id}`}>
                            {expense.establishment || expense.description || t("axisBiz.collabReport.noDescription")}
                          </p>
                          {expense.establishment && expense.description && expense.description !== expense.establishment && (
                            <p className="expense-sub text-xs text-muted-foreground mt-0.5">{expense.description}</p>
                          )}
                        </div>
                        <p className="expense-amount text-sm font-bold flex-shrink-0" style={{ color: primaryHex }} data-testid={`text-expense-amount-${expense.id}`}>
                          {formatBRL(expense.amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        <span className="expense-sub text-xs text-muted-foreground">
                          {format(expDate, i18n.language.startsWith("pt") ? "dd 'de' MMMM 'de' yyyy" : "MMMM d, yyyy", { locale: dateLocale })}
                        </span>
                        {expense.categoryName && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${primaryHex}18`, color: primaryHex }}>
                            {expense.categoryName}
                          </span>
                        )}
                        {expense.paymentMethod && (
                          <span className="expense-sub text-xs text-muted-foreground opacity-70">{expense.paymentMethod}</span>
                        )}
                        <Badge
                          className="badge-status text-[10px] gap-1 py-0 h-5 px-1.5 border"
                          style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                        >
                          <StatusIcon className="w-2.5 h-2.5" />
                          {cfg.label}
                        </Badge>
                      </div>
                      {expense.rejectionComment && (
                        <p className="text-xs text-red-400 mt-1.5 opacity-80">💬 {expense.rejectionComment}</p>
                      )}
                      {expense.receiptItems && (() => {
                        try {
                          const items: { description: string; amount: number }[] = JSON.parse(expense.receiptItems);
                          if (!items.length) return null;
                          return (
                            <div className="mt-3 rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-2 pb-1" style={{ background: "rgba(255,255,255,0.02)" }}>
                                {t("axisBiz.collabReport.receiptItems")}
                              </p>
                              <div className="flex flex-col divide-y divide-border/20">
                                {items.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between gap-3 px-3 py-1.5">
                                    <span className="text-xs text-foreground/75 flex-1">{item.description}</span>
                                    <span className="text-xs font-medium text-foreground shrink-0">{formatBRL(item.amount)}</span>
                                  </div>
                                ))}
                                <div className="flex items-center justify-between gap-3 px-3 py-1.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                                  <span className="text-xs font-semibold text-muted-foreground">{t("axisBiz.collabReport.total")}</span>
                                  <span className="text-xs font-bold" style={{ color: primaryHex }}>{formatBRL(expense.amount)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        } catch { return null; }
                      })()}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {sorted.length > 0 && (
          <div className="mt-6 flex justify-end">
            <Button
              size="sm"
              className="gap-2 border-0"
              style={{ background: primaryHex, color: "#fff" }}
              onClick={handleGenerate}
              disabled={shareMutation.isPending}
              data-testid="button-generate-report-bottom"
            >
              {shareMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {shareMutation.isPending ? t("axisBiz.collabReport.generating") : t("axisBiz.collabReport.generateReport")}
            </Button>
          </div>
        )}

      </motion.div>
    </div>

    <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: primaryHex }} />
            {t("axisBiz.collabReport.reportGenerated")}
          </DialogTitle>
          <DialogDescription>
            {t("axisBiz.collabReport.shareHint")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={shareUrl ?? ""}
              className="flex-1 text-sm font-mono bg-muted"
              data-testid="input-share-url"
            />
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={handleCopy}
              data-testid="button-copy-link"
            >
              {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              {copied ? t("axisBiz.collabReport.copied") : t("axisBiz.collabReport.copy")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {t("axisBiz.collabReport.validDays")}
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              className="flex-1 gap-2"
              style={{ background: primaryHex, color: "#fff" }}
              onClick={() => shareUrl && window.open(shareUrl, "_blank")}
              data-testid="button-open-report"
            >
              <ExternalLink className="w-4 h-4" />
              {t("axisBiz.collabReport.openReport")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowShareModal(false)}
              data-testid="button-close-share-modal"
            >
              {t("axisBiz.collabReport.close")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
