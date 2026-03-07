import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Printer, Calendar, FileText, CheckCircle2, Clock, XCircle,
  Banknote, ChevronDown, ImageOff, ZoomIn,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBusinessTheme, getBusinessPrimaryHex } from "@/components/theme-provider";
import { motion } from "framer-motion";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

type Preset = "7d" | "30d" | "90d" | "current_month" | "prev_month" | "custom";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "7d", label: "Últimos 7 dias" },
  { key: "30d", label: "Últimos 30 dias" },
  { key: "90d", label: "Últimos 90 dias" },
  { key: "current_month", label: "Mês atual" },
  { key: "prev_month", label: "Mês anterior" },
  { key: "custom", label: "Personalizado" },
];

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

function statusConfig(status: string) {
  switch (status) {
    case "approved": return { label: "Aprovado",  color: "#22C55E", bg: "#22C55E18", icon: CheckCircle2, border: "#22C55E40" };
    case "paid":     return { label: "Pago",      color: "#818CF8", bg: "#818CF818", icon: Banknote,     border: "#818CF840" };
    case "rejected": return { label: "Rejeitado", color: "#F87171", bg: "#F8717118", icon: XCircle,      border: "#F8717140" };
    default:         return { label: "Pendente",  color: "#F59E0B", bg: "#F59E0B18", icon: Clock,        border: "#F59E0B40" };
  }
}

function ReceiptImage({ url, base64 }: { url?: string; base64?: string }) {
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
        <img src={src} alt="Comprovante" className="w-full h-full object-cover" onError={() => setErr(true)} />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center print:hidden">
          <ZoomIn className="w-4 h-4 text-white" />
        </div>
        <div className="receipt-print-img hidden print:block w-full h-full">
          <img src={src} alt="Comprovante" className="w-full h-full object-contain" />
        </div>
      </div>
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 print:hidden"
          onClick={() => setZoomed(false)}
        >
          <img src={src} alt="Comprovante" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </>
  );
}

export default function CollaboratorReport() {
  const { user } = useAuth();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);

  const [preset, setPreset] = useState<Preset>("30d");
  const [customStart, setCustomStart] = useState(() => format(subDays(new Date(), 29), "yyyy-MM-dd"));
  const [customEnd, setCustomEnd]     = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [showPresets, setShowPresets] = useState(false);

  const dates = preset === "custom"
    ? { start: new Date(customStart + "T00:00:00"), end: new Date(customEnd + "T23:59:59") }
    : getPresetDates(preset);

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
      if (!res.ok) throw new Error("Erro ao buscar despesas");
      return res.json();
    },
    enabled: !!activeOrg?.id && !!user?.id,
  });

  const sorted = (expenses ?? []).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalGeral    = sorted.reduce((s, e) => s + e.amount, 0);
  const totalAprovado = sorted.filter(e => e.status === "approved" || e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const totalPendente = sorted.filter(e => e.status === "pending_review").reduce((s, e) => s + e.amount, 0);
  const totalPago     = sorted.filter(e => e.status === "paid").reduce((s, e) => s + e.amount, 0);

  const presetLabel = PRESETS.find(p => p.key === preset)?.label ?? "Período";
  const periodLabel = `${format(dates.start, "dd/MM/yyyy", { locale: ptBR })} — ${format(dates.end, "dd/MM/yyyy", { locale: ptBR })}`;
  const collaboratorName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "collab-report-print";
    style.textContent = `
      @media print {
        body > * { display: none !important; }
        #collab-report-root { display: block !important; }
        .print-hide { display: none !important; }
        .print-show { display: block !important; }
        #collab-report-root { padding: 0; margin: 0; }
        .report-card { break-inside: avoid; border: 1px solid #e5e7eb !important; background: #fff !important; box-shadow: none !important; margin-bottom: 12px; }
        .report-card-border { background: #6b7280 !important; }
        .report-header-block { border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px; }
        .summary-row { display: flex; gap: 12px; margin-bottom: 24px; }
        .summary-card { border: 1px solid #e5e7eb !important; background: #f9fafb !important; flex: 1; padding: 12px; border-radius: 8px; }
        .summary-card .s-label { color: #6b7280 !important; font-size: 11px; }
        .summary-card .s-value { color: #111827 !important; font-weight: 700; font-size: 15px; }
        .expense-amount { color: #111827 !important; font-weight: 700; }
        .expense-meta { color: #374151 !important; }
        .expense-sub { color: #6b7280 !important; }
        .badge-status { border: 1px solid #d1d5db !important; background: #f3f4f6 !important; color: #374151 !important; }
        img { max-height: 80px !important; object-fit: contain !important; }
      }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById("collab-report-print")?.remove(); };
  }, []);

  const handlePrint = useCallback(() => {
    const root = document.getElementById("collab-report-root");
    if (!root) { window.print(); return; }
    const clone = root.cloneNode(true) as HTMLElement;
    clone.style.display = "block";
    clone.style.position = "fixed";
    clone.style.top = "0";
    clone.style.left = "0";
    clone.style.width = "100%";
    clone.style.zIndex = "99999";
    clone.style.background = "#fff";
    clone.style.padding = "32px";
    clone.style.boxSizing = "border-box";
    clone.querySelectorAll(".print-hide").forEach(el => (el as HTMLElement).style.display = "none");
    document.body.appendChild(clone);
    window.print();
    document.body.removeChild(clone);
  }, []);

  const isLoading = orgsLoading || expLoading;

  if (orgsLoading) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-4">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto print:p-0" id="collab-report-root">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        <div className="flex items-start justify-between mb-6 print-hide">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6" style={{ color: primaryHex }} />
              Relatório de Despesas
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Gere e imprima seu relatório para o financeiro</p>
          </div>
          <Button
            size="sm"
            className="gap-2 border-0 print-hide"
            style={{ background: primaryHex, color: "#fff" }}
            onClick={handlePrint}
            disabled={isLoading || sorted.length === 0}
            data-testid="button-print-report"
          >
            <Printer className="w-4 h-4" />
            Imprimir relatório
          </Button>
        </div>

        <div className="mb-5 print-hide">
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
              <span className="text-muted-foreground text-sm">até</span>
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
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Relatório de Reembolso</p>
              <h2 className="text-xl font-bold text-foreground">{collaboratorName}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{activeOrg?.tradeName || activeOrg?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-0.5">Período</p>
              <p className="text-sm font-semibold text-foreground">{periodLabel}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {sorted.length} {sorted.length === 1 ? "despesa" : "despesas"}
              </p>
            </div>
          </div>
        </div>

        <div className="summary-row grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Geral",  value: totalGeral,    color: primaryHex },
            { label: "Aprovado",     value: totalAprovado, color: "#22C55E" },
            { label: "Pendente",     value: totalPendente, color: "#F59E0B" },
            { label: "Reembolsado",  value: totalPago,     color: "#818CF8" },
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
            <p className="text-sm text-muted-foreground">Nenhuma despesa encontrada para este período.</p>
            <p className="text-xs text-muted-foreground opacity-60">Tente selecionar um período diferente.</p>
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
                    <ReceiptImage url={expense.receiptImageUrl} base64={expense.receiptImageBase64} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="expense-meta text-sm font-semibold text-foreground leading-tight" data-testid={`text-expense-description-${expense.id}`}>
                            {expense.establishment || expense.description || "Sem descrição"}
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
                          {format(expDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {sorted.length > 0 && (
          <div className="mt-6 flex justify-end print-hide">
            <Button
              size="sm"
              className="gap-2 border-0"
              style={{ background: primaryHex, color: "#fff" }}
              onClick={handlePrint}
              data-testid="button-print-report-bottom"
            >
              <Printer className="w-4 h-4" />
              Imprimir relatório
            </Button>
          </div>
        )}

      </motion.div>
    </div>
  );
}
