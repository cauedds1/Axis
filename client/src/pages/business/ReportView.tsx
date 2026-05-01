import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, ArrowLeft, CheckCircle2, Clock, XCircle,
  Banknote, ImageOff, X, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { useBusinessTheme, getBusinessPrimaryHex } from "@/components/theme-provider";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";

function ReceiptLightbox({ src, onClose, receipt }: { src: string; onClose: () => void; receipt: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        onClick={onClose}
        data-testid="button-close-lightbox"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={receipt}
        className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  const { fmtMoney } = useCurrency();
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1 flex-1 min-w-[120px]"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-bold" style={{ color }}>{fmtMoney(value)}</p>
    </div>
  );
}

export default function ReportView() {
  const { t, i18n } = useTranslation();
  const { fmtMoney } = useCurrency();
  const dateLocale = i18n.language.startsWith("pt") ? ptBR : enUS;
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const statusConfig = (status: string) => {
    switch (status) {
      case "approved": return { label: t("axisBiz.collabReport.statusApproved"), color: "#22C55E", bg: "#22C55E18", icon: CheckCircle2, border: "#22C55E40" };
      case "paid":     return { label: t("axisBiz.collabReport.statusPaid"),     color: "#818CF8", bg: "#818CF818", icon: Banknote,     border: "#818CF840" };
      case "rejected": return { label: t("axisBiz.collabReport.statusRejected"), color: "#F87171", bg: "#F8717118", icon: XCircle,      border: "#F8717140" };
      default:         return { label: t("axisBiz.collabReport.statusPending"),  color: "#F59E0B", bg: "#F59E0B18", icon: Clock,        border: "#F59E0B40" };
    }
  };

  const params = new URLSearchParams(window.location.search);
  const orgId     = params.get("orgId") ?? "";
  const startDate = params.get("startDate") ?? "";
  const endDate   = params.get("endDate") ?? "";
  const userId    = params.get("userId") ?? "";

  const { data: orgs } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const activeOrg = orgs?.find(o => o.id === orgId) ?? orgs?.[0];

  const { data: expenses, isLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", orgId, "expenses", "view", startDate, endDate, userId],
    queryFn: async () => {
      if (!orgId) return [];
      const p = new URLSearchParams();
      if (startDate) p.set("startDate", startDate);
      if (endDate)   p.set("endDate", endDate);
      if (userId)    p.set("userId", userId);
      const res = await fetch(`/api/business/organizations/${orgId}/expenses?${p}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!orgId,
  });

  const sorted = (expenses ?? []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const collaboratorName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim() || t("axisBiz.collabHome.defaultName");

  const totalGeral    = sorted.reduce((s, e) => s + e.amount, 0);
  const totalAprovado = sorted.filter(e => e.status === "approved" || e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const totalPendente = sorted.filter(e => e.status === "pending_review").reduce((s, e) => s + e.amount, 0);
  const totalPago     = sorted.filter(e => e.status === "paid").reduce((s, e) => s + e.amount, 0);

  const periodLabel = (() => {
    try {
      const s = startDate ? format(new Date(startDate), "dd/MM/yyyy", { locale: dateLocale }) : "—";
      const e = endDate   ? format(new Date(endDate),   "dd/MM/yyyy", { locale: dateLocale }) : "—";
      return `${s} — ${e}`;
    } catch { return "—"; }
  })();

  if (isLoading) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {lightboxSrc && <ReceiptLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} receipt={t("axisBiz.collab.reportView.receipt")} />}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setLocation("/business/app/relatorio")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-back-report"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("common.back")}
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: primaryHex }} />
            <span className="text-lg font-bold text-foreground">{t("axisBiz.collabReport.title")}</span>
          </div>
        </div>

        <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              {(activeOrg?.logoUrl || activeOrg?.logoBase64) && (
                <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <img
                    src={activeOrg.logoUrl ?? activeOrg.logoBase64}
                    alt={activeOrg.tradeName || activeOrg.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{t("axisBiz.collabReport.reimbursementReport")}</p>
                <h2 className="text-2xl font-bold text-foreground">{collaboratorName}</h2>
                <p className="text-sm mt-0.5" style={{ color: primaryHex }}>{activeOrg?.tradeName || activeOrg?.name || "—"}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">{t("axisBiz.collabReport.period")}</p>
              <p className="text-sm font-semibold text-foreground">{periodLabel}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("axisBiz.collabReport.expense", { count: sorted.length })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mb-6 flex-wrap">
          <SummaryCard label={t("axisBiz.collabReport.summaryTotal")}      value={totalGeral}    color={primaryHex} />
          <SummaryCard label={t("axisBiz.collabReport.summaryApproved")}   value={totalAprovado} color="#22C55E" />
          <SummaryCard label={t("axisBiz.collabReport.summaryPending")}    value={totalPendente} color="#F59E0B" />
          <SummaryCard label={t("axisBiz.collabReport.summaryReimbursed")} value={totalPago}     color="#818CF8" />
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <FileText className="w-10 h-10 text-muted-foreground opacity-30" />
            <p className="text-muted-foreground text-sm">{t("axisBiz.collabReport.noExpenses")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {sorted.map(expense => {
              const cfg = statusConfig(expense.status ?? "pending_review");
              const StatusIcon = cfg.icon;
              const expDate = expense.date ? new Date(expense.date) : new Date();
              const receiptSrc = expense.receiptImageUrl
                ? expense.receiptImageUrl
                : expense.receiptImageBase64
                  ? `data:image/jpeg;base64,${expense.receiptImageBase64.replace(/^data:[^;]+;base64,/, "")}`
                  : null;

              let receiptItems: { description: string; amount: number }[] | null = null;
              if (expense.receiptItems) {
                try { receiptItems = JSON.parse(expense.receiptItems); } catch {}
              }

              return (
                <motion.div
                  key={expense.id}
                  data-testid={`card-expense-${expense.id}`}
                  className="rounded-2xl overflow-hidden flex"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <div className="w-1 shrink-0 rounded-l-2xl" style={{ background: cfg.color }} />
                  <div className="flex-1 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        {receiptSrc
                          ? <img src={receiptSrc} alt={t("axisBiz.collab.reportView.receipt")} className="w-full h-full object-cover" />
                          : <ImageOff className="w-5 h-5 text-muted-foreground opacity-40" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground leading-tight truncate">
                              {expense.establishment || expense.description || t("axisBiz.collabReport.noDescription")}
                            </p>
                            {expense.establishment && expense.description && expense.description !== expense.establishment && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">{expense.description}</p>
                            )}
                          </div>
                          <p className="text-sm font-bold shrink-0" style={{ color: primaryHex }}>
                            {fmtMoney(expense.amount)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mt-2">
                          <span className="text-xs text-muted-foreground">
                            {format(expDate, i18n.language.startsWith("pt") ? "dd 'de' MMMM 'de' yyyy" : "MMMM d, yyyy", { locale: dateLocale })}
                          </span>
                          {expense.categoryName && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: `${primaryHex}18`, color: primaryHex }}>
                              {expense.categoryName}
                            </span>
                          )}
                          {expense.paymentMethod && (
                            <span className="text-xs text-muted-foreground opacity-70">{expense.paymentMethod}</span>
                          )}
                          <Badge
                            className="text-[10px] gap-1 py-0 h-5 px-1.5 border"
                            style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
                          >
                            <StatusIcon className="w-2.5 h-2.5" />
                            {cfg.label}
                          </Badge>
                        </div>

                        {expense.rejectionComment && (
                          <p className="text-xs text-red-400 mt-1.5 opacity-80">💬 {expense.rejectionComment}</p>
                        )}

                        {receiptItems && receiptItems.length > 0 && (
                          <div className="mt-3 rounded-xl overflow-hidden"
                            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 pt-2 pb-1"
                              style={{ background: "rgba(255,255,255,0.02)" }}>
                              {t("axisBiz.collab.reportView.receiptItems")}
                            </p>
                            <div className="flex flex-col divide-y divide-border/20">
                              {receiptItems.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between gap-3 px-3 py-1.5">
                                  <span className="text-xs text-foreground/75 flex-1">{item.description}</span>
                                  <span className="text-xs font-medium text-foreground shrink-0">{fmtMoney(item.amount)}</span>
                                </div>
                              ))}
                              <div className="flex items-center justify-between gap-3 px-3 py-1.5"
                                style={{ background: "rgba(255,255,255,0.03)" }}>
                                <span className="text-xs font-semibold text-muted-foreground">{t("axisBiz.collab.reportView.total")}</span>
                                <span className="text-xs font-bold" style={{ color: primaryHex }}>{fmtMoney(expense.amount)}</span>
                              </div>
                            </div>
                          </div>
                        )}

                        {receiptSrc && (
                          <div className="mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-7 text-xs border-border/40 hover:bg-white/5"
                              onClick={() => setLightboxSrc(receiptSrc)}
                              data-testid={`button-show-receipt-${expense.id}`}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {t("axisBiz.collab.reportView.showReceipt")}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" style={{ color: primaryHex }} />
            <span className="text-xs font-semibold" style={{ color: primaryHex }}>AXIS Business</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("axisBiz.collab.reportView.generatedAt", { date: format(new Date(), "dd/MM/yyyy HH:mm", { locale: dateLocale }) })}
          </p>
        </div>

      </motion.div>
    </div>
  );
}
