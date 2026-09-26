import { useState } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, CheckCircle2, Clock, XCircle, Banknote,
  ImageOff, X, Eye, ShieldCheck,
} from "lucide-react";
import axisLogoPath from "@/assets/images/logo-report.png";
import { format } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";


function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function statusConfig(status: string, t: (k: string) => string) {
  switch (status) {
    case "approved": return { label: t("axisPublicReport.statusApproved"), color: "#22C55E", bg: "#22C55E18", icon: CheckCircle2, border: "#22C55E40" };
    case "paid":     return { label: t("axisPublicReport.statusPaid"),     color: "#818CF8", bg: "#818CF818", icon: Banknote,     border: "#818CF840" };
    case "rejected": return { label: t("axisPublicReport.statusRejected"), color: "#F87171", bg: "#F8717118", icon: XCircle,      border: "#F8717140" };
    default:         return { label: t("axisPublicReport.statusPending"),  color: "#F59E0B", bg: "#F59E0B18", icon: Clock,        border: "#F59E0B40" };
  }
}

function ReceiptLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt={t("axisPublicReport.receiptAlt")}
        className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

export default function PublicReport() {
  const { t, i18n } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const dateLocale = i18n.language === "pt-BR" ? ptBR : enUS;

  const { data, isLoading, isError } = useQuery<{
    org: { name: string; tradeName?: string; logoUrl?: string; logoBase64?: string; primaryColor?: string };
    collaboratorName: string;
    startDate: string;
    endDate: string;
    expenses: any[];
    expiresAt: string;
  }>({
    queryKey: ["/api/public/report", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/report/${token}`);
      if (!res.ok) throw new Error("not found");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const PRIMARY = data?.org?.primaryColor || "#3B82F6";
  const orgLogoSrc = data?.org?.logoUrl ?? (data?.org?.logoBase64 ? `data:image/jpeg;base64,${data.org.logoBase64.replace(/^data:[^;]+;base64,/, "")}` : null);

  const sorted = (data?.expenses ?? []).slice().sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalGeral    = sorted.reduce((s: number, e: any) => s + e.amount, 0);
  const totalAprovado = sorted.filter((e: any) => e.status === "approved" || e.status === "paid").reduce((s: number, e: any) => s + e.amount, 0);
  const totalPendente = sorted.filter((e: any) => e.status === "pending_review").reduce((s: number, e: any) => s + e.amount, 0);
  const totalPago     = sorted.filter((e: any) => e.status === "paid").reduce((s: number, e: any) => s + e.amount, 0);

  const periodLabel = (() => {
    try {
      const s = data?.startDate ? format(new Date(data.startDate), "dd/MM/yyyy", { locale: dateLocale }) : "—";
      const e = data?.endDate   ? format(new Date(data.endDate),   "dd/MM/yyyy", { locale: dateLocale }) : "—";
      return `${s} — ${e}`;
    } catch { return "—"; }
  })();

  const expensesCountLabel = (count: number) =>
    count === 1 ? `1 ${t("axisPublicReport.expenses_one")}` : `${count} ${t("axisPublicReport.expenses_other")}`;

  return (
    <div className="min-h-screen" style={{ background: "hsl(222 47% 7%)", color: "hsl(210 40% 98%)" }}>
      {lightboxSrc && <ReceiptLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <div className="fixed bottom-5 right-5 z-10 pointer-events-none">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", opacity: 0.35 }}>
          <img src={axisLogoPath} alt="AXIS" className="w-3.5 h-3.5 object-contain" />
          <span className="text-[10px] font-semibold tracking-wide" style={{ color: "hsl(210 40% 98%)" }}>{t("axisPublicReport.brand")}</span>
        </div>
      </div>

      <header className="border-b sticky top-0 z-40 backdrop-blur-sm" style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(15,20,35,0.9)" }}>
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {orgLogoSrc ? (
              <img src={orgLogoSrc} alt="Logo" className="h-9 w-auto max-w-[160px] object-contain" />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                style={{ background: PRIMARY }}
              >
                {(data?.org?.tradeName || data?.org?.name || "?").slice(0, 2).toUpperCase()}
              </div>
            )}
            {!orgLogoSrc && (
              <span className="font-semibold text-sm" style={{ color: "hsl(210 40% 98%)" }}>
                {data?.org?.tradeName || data?.org?.name || ""}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            {t("axisPublicReport.verifiedAccess")}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {isLoading && (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-28 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="flex gap-3">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-16 flex-1 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />)}
            </div>
            <Skeleton className="h-40 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
            <Skeleton className="h-40 rounded-2xl" style={{ background: "rgba(255,255,255,0.06)" }} />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)" }}>
              <XCircle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <p className="text-lg font-semibold" style={{ color: "hsl(210 40% 98%)" }}>{t("axisPublicReport.invalidTitle")}</p>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                {t("axisPublicReport.invalidDesc")}<br />{t("axisPublicReport.invalidHint")}
              </p>
            </div>
          </div>
        )}

        {data && !isLoading && !isError && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            <div className="rounded-2xl p-5 mb-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {orgLogoSrc && (
                    <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <img src={orgLogoSrc} alt={data.org.tradeName || data.org.name} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{t("axisPublicReport.reimbursementReport")}</p>
                    <h1 className="text-2xl font-bold" style={{ color: "hsl(210 40% 98%)" }}>{data.collaboratorName}</h1>
                    <p className="text-sm mt-0.5" style={{ color: PRIMARY }}>{data.org.tradeName || data.org.name}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>{t("axisPublicReport.period")}</p>
                  <p className="text-sm font-semibold" style={{ color: "hsl(210 40% 98%)" }}>{periodLabel}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {expensesCountLabel(sorted.length)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mb-6 flex-wrap">
              {[
                { label: t("axisPublicReport.totalGeneral"), value: totalGeral,    color: PRIMARY },
                { label: t("axisPublicReport.approved"),     value: totalAprovado, color: "#22C55E" },
                { label: t("axisPublicReport.pending"),      value: totalPendente, color: "#F59E0B" },
                { label: t("axisPublicReport.paid"),         value: totalPago,     color: "#818CF8" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl p-4 flex flex-col gap-1 flex-1 min-w-[110px]"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</p>
                  <p className="text-base font-bold" style={{ color }}>{formatBRL(value)}</p>
                </div>
              ))}
            </div>

            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <FileText className="w-10 h-10" style={{ color: "rgba(255,255,255,0.2)" }} />
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{t("axisPublicReport.noExpenses")}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {sorted.map((expense: any) => {
                  const cfg = statusConfig(expense.status ?? "pending_review", t);
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
                              ? <img src={receiptSrc} alt={t("axisPublicReport.receiptAlt")} className="w-full h-full object-cover" />
                              : <ImageOff className="w-5 h-5" style={{ color: "rgba(255,255,255,0.2)" }} />
                            }
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-tight truncate" style={{ color: "hsl(210 40% 98%)" }}>
                                  {expense.establishment || expense.description || t("axisPublicReport.noDescriptionAlt")}
                                </p>
                                {expense.establishment && expense.description && expense.description !== expense.establishment && (
                                  <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.45)" }}>{expense.description}</p>
                                )}
                              </div>
                              <p className="text-sm font-bold shrink-0" style={{ color: PRIMARY }}>
                                {formatBRL(expense.amount)}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap mt-2">
                              <span className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                                {format(expDate, t("axisPublicReport.dateFormat"), { locale: dateLocale })}
                              </span>
                              {expense.categoryName && (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${PRIMARY}18`, color: PRIMARY }}>
                                  {expense.categoryName}
                                </span>
                              )}
                              {expense.paymentMethod && (
                                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{expense.paymentMethod}</span>
                              )}
                              <Badge className="text-[10px] gap-1 py-0 h-5 px-1.5 border"
                                style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
                                <StatusIcon className="w-2.5 h-2.5" />
                                {cfg.label}
                              </Badge>
                            </div>

                            {expense.rejectionComment && (
                              <p className="text-xs mt-1.5" style={{ color: "#F87171" }}>💬 {expense.rejectionComment}</p>
                            )}

                            {receiptItems && receiptItems.length > 0 && (
                              <div className="mt-3 rounded-xl overflow-hidden"
                                style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider px-3 pt-2 pb-1"
                                  style={{ background: "rgba(255,255,255,0.02)", color: "rgba(255,255,255,0.4)" }}>
                                  {t("axisPublicReport.receiptItems")}
                                </p>
                                <div className="flex flex-col divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                                  {receiptItems.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between gap-3 px-3 py-1.5">
                                      <span className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.6)" }}>{item.description}</span>
                                      <span className="text-xs font-medium shrink-0" style={{ color: "hsl(210 40% 98%)" }}>{formatBRL(item.amount)}</span>
                                    </div>
                                  ))}
                                  <div className="flex items-center justify-between gap-3 px-3 py-1.5"
                                    style={{ background: "rgba(255,255,255,0.03)" }}>
                                    <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>{t("axisPublicReport.receiptTotal")}</span>
                                    <span className="text-xs font-bold" style={{ color: PRIMARY }}>{formatBRL(expense.amount)}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {receiptSrc && (
                              <div className="mt-3">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1.5 h-7 text-xs"
                                  style={{ borderColor: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)", background: "transparent" }}
                                  onClick={() => setLightboxSrc(receiptSrc)}
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  {t("axisPublicReport.showReceipt")}
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

            <div className="mt-8 pt-4 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-1.5 opacity-40">
                <img src={axisLogoPath} alt="AXIS" className="w-4 h-4 object-contain" />
                <span className="text-[11px] font-semibold" style={{ color: "hsl(210 40% 98%)" }}>{t("axisPublicReport.brand")}</span>
              </div>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                {t("axisPublicReport.validUntil")} {data.expiresAt ? format(new Date(data.expiresAt), "dd/MM/yyyy", { locale: dateLocale }) : "—"}
              </p>
            </div>

          </motion.div>
        )}
      </main>
    </div>
  );
}
