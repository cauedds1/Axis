import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, isAfter, isBefore, addDays, startOfMonth, endOfMonth, subMonths, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DollarSign, Receipt, CreditCard, TrendingDown, TrendingUp, Plus, Trash2, Pencil,
  Calendar, AlertCircle, CheckCircle2, Clock, ArrowDownCircle, ArrowUpCircle,
  ReceiptText, ChevronDown, ChevronUp, X, Loader2, Wallet
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BusinessExpense, BusinessBill, BusinessReceivable, BusinessCorporateCard } from "@shared/schema";

const PRIMARY = "#3B82F6";
const INDIGO = "#6366F1";
const EMERALD = "#10B981";
const AMBER = "#F59E0B";
const RED = "#EF4444";

function fmtBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return format(date, "d MMM · HH:mm", { locale: ptBR });
}

function fmtDateShort(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "";
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

type Period = "current" | "last" | "last3" | "last6" | "custom";

const PERIOD_OPTS: { id: Period; label: string }[] = [
  { id: "current", label: "Mês atual" },
  { id: "last", label: "Mês passado" },
  { id: "last3", label: "3 meses" },
  { id: "last6", label: "6 meses" },
  { id: "custom", label: "Personalizado" },
];

function getDateRange(period: Period, customStart?: string, customEnd?: string) {
  const now = new Date();
  if (period === "current") return { start: startOfMonth(now), end: endOfMonth(now) };
  if (period === "last") return { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) };
  if (period === "last3") return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
  if (period === "last6") return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
  if (period === "custom" && customStart && customEnd) return { start: new Date(customStart + "T00:00:00"), end: new Date(customEnd + "T23:59:59") };
  return { start: startOfMonth(now), end: endOfMonth(now) };
}

function getPeriodLabel(period: Period, range: { start: Date; end: Date }) {
  if (period === "current" || period === "last") {
    return range.start.toLocaleString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
  }
  const f = format(range.start, "MMM yyyy", { locale: ptBR });
  const l = format(range.end, "MMM yyyy", { locale: ptBR });
  return `${f} — ${l}`;
}

function SummaryCard({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color: string; icon: any }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-1 relative overflow-hidden" style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-xs text-muted-foreground font-medium tracking-wide uppercase">{label}</span>
      </div>
      <span className="text-2xl font-bold" style={{ color }}>{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function SmallSummaryCard({ label, value, sub, color, icon: Icon }: { label: string; value: string; sub?: string; color: string; icon: any }) {
  return (
    <div className="rounded-2xl p-3 flex flex-col gap-0.5" style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="w-3 h-3" style={{ color }} />
        <span className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">{label}</span>
      </div>
      <span className="text-lg font-bold" style={{ color }}>{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

// ─── LANÇAMENTOS TAB ─────────────────────────────────────────────────────────

function LancamentosTab({ orgId }: { orgId: string }) {
  const [period, setPeriod] = useState<Period>("current");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const range = getDateRange(period, customStart, customEnd);

  const { data: expenses = [], isLoading } = useQuery<(BusinessExpense & { userEmail?: string; userName?: string })[]>({
    queryKey: ["/api/business/organizations", orgId, "expenses"],
    queryFn: async () => {
      const res = await fetch(`/api/business/organizations/${orgId}/expenses`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar despesas");
      return res.json();
    },
  });

  const filtered = expenses.filter(e => {
    const d = new Date(e.date ?? e.createdAt ?? "");
    return d >= range.start && d <= range.end;
  });

  const totalSubmitted = filtered.reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalApproved = filtered.filter(e => e.status === "approved").reduce((s, e) => s + (e.amount ?? 0), 0);
  const totalPending = filtered.filter(e => e.status === "pending_review").reduce((s, e) => s + (e.amount ?? 0), 0);

  function statusColor(s: string) {
    if (s === "approved") return EMERALD;
    if (s === "rejected") return RED;
    return AMBER;
  }

  function statusLabel(s: string) {
    if (s === "approved") return "Aprovado";
    if (s === "rejected") return "Rejeitado";
    return "Pendente";
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_OPTS.map(opt => (
          <button
            key={opt.id}
            onClick={() => setPeriod(opt.id)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
            style={{
              background: period === opt.id ? `${PRIMARY}20` : "rgba(255,255,255,0.04)",
              color: period === opt.id ? PRIMARY : "rgba(255,255,255,0.5)",
              border: `1px solid ${period === opt.id ? `${PRIMARY}40` : "rgba(255,255,255,0.06)"}`,
            }}
            data-testid={`tab-period-${opt.id}`}
          >
            <Calendar className="w-3 h-3" />
            {opt.label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-7 text-xs w-36" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-7 text-xs w-36" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground -mt-3">{getPeriodLabel(period, range)}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryCard label="Despesas" value={fmtBRL(totalSubmitted)} sub={`${filtered.length} lançamento(s)`} color={RED} icon={TrendingDown} />
        <SummaryCard label="Aprovadas" value={fmtBRL(totalApproved)} sub={`${filtered.filter(e => e.status === "approved").length} aprovado(s)`} color={EMERALD} icon={TrendingUp} />
        <SummaryCard label="Pendentes" value={fmtBRL(totalPending)} sub={`${filtered.filter(e => e.status === "pending_review").length} aguardando`} color={AMBER} icon={Clock} />
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Lançamentos recentes</h2>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ReceiptText className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum lançamento neste período</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Colaboradores enviam recibos pelo WhatsApp</p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map(exp => (
              <div key={exp.id}>
                <button
                  onClick={() => setExpandedId(expandedId === exp.id ? null : exp.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/[0.03]"
                  data-testid={`row-expense-${exp.id}`}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: statusColor(exp.status), boxShadow: `0 0 6px ${statusColor(exp.status)}60` }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{exp.establishment || exp.description}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {exp.userName || exp.userEmail || "—"}
                      {exp.categoryName && <> · {exp.categoryName}</>}
                      {exp.paymentMethod && <> · {exp.paymentMethod}</>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                    <span className="text-sm font-semibold" style={{ color: RED }}>-{fmtBRL(exp.amount)}</span>
                    <span className="text-[10px] text-muted-foreground">{fmtDate(exp.date ?? exp.createdAt)}</span>
                  </div>
                  <Badge className="text-[9px] font-semibold ml-1 flex-shrink-0" style={{ background: `${statusColor(exp.status)}15`, color: statusColor(exp.status), border: `1px solid ${statusColor(exp.status)}30` }}>
                    {statusLabel(exp.status)}
                  </Badge>
                  {expandedId === exp.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                </button>
                {expandedId === exp.id && (
                  <div className="mx-3 mb-2 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    {(exp.receiptImageUrl || exp.receiptImageBase64) && (
                      <img
                        src={exp.receiptImageUrl ?? `data:image/jpeg;base64,${exp.receiptImageBase64}`}
                        alt="Recibo"
                        className="w-full max-h-52 object-contain rounded-lg mb-3"
                      />
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {exp.notes && <div className="col-span-2"><span className="text-muted-foreground">Obs: </span>{exp.notes}</div>}
                      <div><span className="text-muted-foreground">Data: </span>{fmtDateShort(exp.date ?? exp.createdAt)}</div>
                      <div><span className="text-muted-foreground">Fonte: </span>{exp.source}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CONTAS TAB ───────────────────────────────────────────────────────────────

type ContasFilter = "all" | "bills" | "receivables";
type StatusFilter = "all" | "pending" | "paid" | "overdue";

function ContasTab({ orgId }: { orgId: string }) {
  const [period, setPeriod] = useState<Period>("current");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [typeFilter, setTypeFilter] = useState<ContasFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  const range = getDateRange(period, customStart, customEnd);
  const today = startOfDay(new Date());
  const in7Days = addDays(today, 7);

  const { data: bills = [] } = useQuery<BusinessBill[]>({
    queryKey: ["/api/business/organizations", orgId, "bills"],
    queryFn: async () => (await fetch(`/api/business/organizations/${orgId}/bills`, { credentials: "include" })).json(),
  });

  const { data: receivables = [] } = useQuery<BusinessReceivable[]>({
    queryKey: ["/api/business/organizations", orgId, "receivables"],
    queryFn: async () => (await fetch(`/api/business/organizations/${orgId}/receivables`, { credentials: "include" })).json(),
  });

  const payBillMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/business/organizations/${orgId}/bills/${id}`, { status: "paid", paidAt: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "bills"] }); toast({ title: "Conta marcada como paga" }); },
  });

  const receiveReceivableMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("PATCH", `/api/business/organizations/${orgId}/receivables/${id}`, { status: "received", receivedAt: new Date().toISOString() }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "receivables"] }); toast({ title: "Recebimento registrado" }); },
  });

  const pendingBills = bills.filter(b => b.status === "pending");
  const pendingReceivables = receivables.filter(r => r.status === "pending");
  const overdueBills = bills.filter(b => b.status === "pending" && isBefore(new Date(b.dueDate), today));
  const overdueReceivables = receivables.filter(r => r.status === "pending" && isBefore(new Date(r.dueDate), today));
  const near7Bills = bills.filter(b => b.status === "pending" && !isBefore(new Date(b.dueDate), today) && isBefore(new Date(b.dueDate), in7Days));
  const near7Receivables = receivables.filter(r => r.status === "pending" && !isBefore(new Date(r.dueDate), today) && isBefore(new Date(r.dueDate), in7Days));

  const totalAPagar = pendingBills.reduce((s, b) => s + b.amount, 0);
  const totalAReceber = pendingReceivables.reduce((s, r) => s + r.amount, 0);
  const saldoPrevisto = totalAReceber - totalAPagar;

  const paidThisMonth = bills.filter(b => b.status === "paid" && b.paidAt && new Date(b.paidAt) >= range.start && new Date(b.paidAt) <= range.end).reduce((s, b) => s + b.amount, 0);
  const receivedThisMonth = receivables.filter(r => r.status === "received" && r.receivedAt && new Date(r.receivedAt) >= range.start && new Date(r.receivedAt) <= range.end).reduce((s, r) => s + r.amount, 0);

  type CombinedItem = { id: string; type: "bill" | "receivable"; description: string; party?: string | null; dueDate: Date; amount: number; status: string; paidAt?: Date | null; receivedAt?: Date | null };
  const combined: CombinedItem[] = [
    ...bills.map(b => ({ id: b.id, type: "bill" as const, description: b.description, party: b.supplier, dueDate: new Date(b.dueDate), amount: b.amount, status: b.status, paidAt: b.paidAt ? new Date(b.paidAt) : null })),
    ...receivables.map(r => ({ id: r.id, type: "receivable" as const, description: r.description, party: r.client, dueDate: new Date(r.dueDate), amount: r.amount, status: r.status, receivedAt: r.receivedAt ? new Date(r.receivedAt) : null })),
  ].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const visibleItems = combined.filter(item => {
    if (typeFilter === "bills" && item.type !== "bill") return false;
    if (typeFilter === "receivables" && item.type !== "receivable") return false;
    if (statusFilter === "pending" && item.status !== "pending") return false;
    if (statusFilter === "paid" && item.status !== "paid" && item.status !== "received") return false;
    if (statusFilter === "overdue") {
      if (item.status !== "pending") return false;
      if (!isBefore(item.dueDate, today)) return false;
    }
    return true;
  });

  function itemColor(item: CombinedItem) {
    if (item.status === "paid" || item.status === "received") return EMERALD;
    if (isBefore(item.dueDate, today)) return RED;
    if (isBefore(item.dueDate, in7Days)) return AMBER;
    return item.type === "bill" ? PRIMARY : EMERALD;
  }

  function itemStatusLabel(item: CombinedItem) {
    if (item.status === "paid") return "Pago";
    if (item.status === "received") return "Recebido";
    if (isBefore(item.dueDate, today)) return "Vencido";
    return "Pendente";
  }

  const typeFilters: { id: ContasFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "bills", label: "A pagar" },
    { id: "receivables", label: "A receber" },
  ];
  const statusFilters: { id: StatusFilter; label: string }[] = [
    { id: "all", label: "Todos status" },
    { id: "pending", label: "Pendentes" },
    { id: "paid", label: "Pagos" },
    { id: "overdue", label: "Vencidos" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {PERIOD_OPTS.map(opt => (
          <button key={opt.id} onClick={() => setPeriod(opt.id)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all font-medium"
            style={{ background: period === opt.id ? `${PRIMARY}20` : "rgba(255,255,255,0.04)", color: period === opt.id ? PRIMARY : "rgba(255,255,255,0.5)", border: `1px solid ${period === opt.id ? `${PRIMARY}40` : "rgba(255,255,255,0.06)"}` }}>
            <Calendar className="w-3 h-3" />{opt.label}
          </button>
        ))}
        {period === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-7 text-xs w-36" />
            <span className="text-xs text-muted-foreground">até</span>
            <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-7 text-xs w-36" />
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground -mt-3">{getPeriodLabel(period, range)}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SmallSummaryCard label="A Pagar" value={fmtBRL(totalAPagar)} sub={`${pendingBills.length} conta(s)`} color={RED} icon={TrendingDown} />
        <SmallSummaryCard label="A Receber" value={fmtBRL(totalAReceber)} sub={`${pendingReceivables.length} conta(s)`} color={EMERALD} icon={TrendingUp} />
        <SmallSummaryCard label="Saldo Previsto" value={fmtBRL(saldoPrevisto)} sub="" color={saldoPrevisto >= 0 ? EMERALD : RED} icon={Wallet} />
        <SmallSummaryCard label="Vencidas" value={String(overdueBills.length + overdueReceivables.length)} sub={fmtBRL(overdueBills.reduce((s, b) => s + b.amount, 0) + overdueReceivables.reduce((s, r) => s + r.amount, 0))} color={RED} icon={AlertCircle} />
        <SmallSummaryCard label="Próximos 7 dias" value={String(near7Bills.length + near7Receivables.length)} sub={fmtBRL(near7Bills.reduce((s, b) => s + b.amount, 0) + near7Receivables.reduce((s, r) => s + r.amount, 0))} color={AMBER} icon={Clock} />
        <SmallSummaryCard label="Pago este mês" value={fmtBRL(paidThisMonth + receivedThisMonth)} sub={`Pago + Recebido`} color={EMERALD} icon={CheckCircle2} />
      </div>

      <div className="flex flex-wrap gap-2">
        {typeFilters.map(f => (
          <button key={f.id} onClick={() => setTypeFilter(f.id)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{ background: typeFilter === f.id ? `${PRIMARY}20` : "rgba(255,255,255,0.04)", color: typeFilter === f.id ? PRIMARY : "rgba(255,255,255,0.45)", border: `1px solid ${typeFilter === f.id ? `${PRIMARY}40` : "rgba(255,255,255,0.06)"}` }}>
            {f.label}
          </button>
        ))}
        <div className="w-px h-5 bg-white/10 self-center" />
        {statusFilters.map(f => (
          <button key={f.id} onClick={() => setStatusFilter(f.id)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
            style={{ background: statusFilter === f.id ? `${INDIGO}20` : "rgba(255,255,255,0.04)", color: statusFilter === f.id ? INDIGO : "rgba(255,255,255,0.45)", border: `1px solid ${statusFilter === f.id ? `${INDIGO}40` : "rgba(255,255,255,0.06)"}` }}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {visibleItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Receipt className="w-8 h-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum item encontrado</p>
          </div>
        ) : visibleItems.map(item => {
          const color = itemColor(item);
          const isExpanded = expandedId === item.id;
          return (
            <div key={`${item.type}-${item.id}`} className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full flex items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.025]"
                style={{ borderLeft: `3px solid ${color}` }}
                data-testid={`row-conta-${item.id}`}
              >
                <div className="flex-shrink-0">
                  {item.type === "bill" ? <ArrowDownCircle className="w-4 h-4" style={{ color: RED }} /> : <ArrowUpCircle className="w-4 h-4" style={{ color: EMERALD }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {item.party || (item.type === "bill" ? "Fornecedor" : "Cliente")} · Venc. {fmtDateShort(item.dueDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-bold" style={{ color: item.type === "bill" ? RED : EMERALD }}>
                    {item.type === "bill" ? "-" : "+"}{fmtBRL(item.amount)}
                  </span>
                  <Badge className="text-[9px]" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                    {itemStatusLabel(item)}
                  </Badge>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </button>
              {isExpanded && (
                <div className="px-4 pb-3 pt-1 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.015)" }}>
                  <p className="text-xs text-muted-foreground">
                    {item.type === "bill" ? "Conta a pagar" : "Conta a receber"} · Vencimento: {fmtDateShort(item.dueDate)}
                  </p>
                  {item.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => item.type === "bill" ? payBillMutation.mutate(item.id) : receiveReceivableMutation.mutate(item.id)}
                      className="h-7 text-xs px-3"
                      style={{ background: `${EMERALD}20`, color: EMERALD, border: `1px solid ${EMERALD}40` }}
                      data-testid={`button-mark-paid-${item.id}`}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {item.type === "bill" ? "Marcar como pago" : "Dar baixa"}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CARTÕES CORPORATIVOS TAB ─────────────────────────────────────────────────

const CARD_BRANDS = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard"];

const BRAND_COLORS: Record<string, string> = {
  Visa: "#1A1F71",
  Mastercard: "#EB001B",
  Elo: "#FFD700",
  Amex: "#007BC1",
  Hipercard: "#C8102E",
};

const CARD_GRADIENTS = [
  "linear-gradient(135deg, #1e3a5f, #2563eb)",
  "linear-gradient(135deg, #1e1b4b, #4f46e5)",
  "linear-gradient(135deg, #064e3b, #059669)",
  "linear-gradient(135deg, #451a03, #d97706)",
  "linear-gradient(135deg, #3b0764, #7c3aed)",
];

function CorporateCardItem({ card, orgId, onEdit, onDelete }: { card: BusinessCorporateCard; orgId: string; onEdit: (c: BusinessCorporateCard) => void; onDelete: (id: string) => void }) {
  const available = card.limitAmount - card.currentBalance;
  const usedPct = card.limitAmount > 0 ? Math.min((card.currentBalance / card.limitAmount) * 100, 100) : 0;
  const gradient = CARD_GRADIENTS[parseInt(card.id?.slice(-1) ?? "0", 16) % CARD_GRADIENTS.length] ?? CARD_GRADIENTS[0];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
      <div className="p-4 relative" style={{ background: gradient }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 50%)" }} />
        <div className="relative flex items-start justify-between mb-4">
          <div>
            <p className="text-white/60 text-[11px] font-medium tracking-widest uppercase">Cartão Corporativo</p>
            <p className="text-white font-bold text-base mt-0.5">{card.name}</p>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => onEdit(card)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors" data-testid={`button-edit-card-${card.id}`}>
              <Pencil className="w-3 h-3 text-white" />
            </button>
            <button onClick={() => onDelete(card.id)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/10 hover:bg-red-500/40 transition-colors" data-testid={`button-delete-card-${card.id}`}>
              <Trash2 className="w-3 h-3 text-white" />
            </button>
          </div>
        </div>
        <p className="text-white/80 text-lg font-mono tracking-widest">•••• •••• •••• {card.last4}</p>
        <div className="flex items-end justify-between mt-3">
          <div>
            <p className="text-white/50 text-[10px]">TITULAR</p>
            <p className="text-white text-xs font-semibold">{card.holder.toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-[10px]">FECHAMENTO</p>
            <p className="text-white text-xs font-semibold">Dia {card.closingDay}</p>
          </div>
          <div className="text-right">
            <p className="text-white/50 text-[10px]">BANDEIRA</p>
            <p className="text-white text-xs font-bold">{card.brand.toUpperCase()}</p>
          </div>
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.028)" }}>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Gasto: <span className="font-semibold text-foreground">{fmtBRL(card.currentBalance)}</span></span>
          <span className="text-muted-foreground">Limite: <span className="font-semibold text-foreground">{fmtBRL(card.limitAmount)}</span></span>
          <span className="text-muted-foreground">Disponível: <span className="font-semibold" style={{ color: EMERALD }}>{fmtBRL(available)}</span></span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${usedPct}%`, background: usedPct > 80 ? RED : usedPct > 60 ? AMBER : PRIMARY }} />
        </div>
      </div>
    </div>
  );
}

function CartoesTab({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editCard, setEditCard] = useState<BusinessCorporateCard | null>(null);
  const [form, setForm] = useState({ name: "", last4: "", brand: "Visa", limitAmount: "", currentBalance: "", holder: "", closingDay: "1" });

  const { data: cards = [], isLoading } = useQuery<BusinessCorporateCard[]>({
    queryKey: ["/api/business/organizations", orgId, "cards"],
    queryFn: async () => (await fetch(`/api/business/organizations/${orgId}/cards`, { credentials: "include" })).json(),
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", `/api/business/organizations/${orgId}/cards`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "cards"] }); toast({ title: "Cartão adicionado" }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/business/organizations/${orgId}/cards/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "cards"] }); toast({ title: "Cartão atualizado" }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/business/organizations/${orgId}/cards/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "cards"] }); toast({ title: "Cartão removido" }); },
  });

  function openNew() { setForm({ name: "", last4: "", brand: "Visa", limitAmount: "", currentBalance: "", holder: "", closingDay: "1" }); setEditCard(null); setShowModal(true); }
  function openEdit(c: BusinessCorporateCard) { setForm({ name: c.name, last4: c.last4, brand: c.brand, limitAmount: String(c.limitAmount), currentBalance: String(c.currentBalance), holder: c.holder, closingDay: String(c.closingDay) }); setEditCard(c); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditCard(null); }

  function handleSubmit() {
    const payload = { name: form.name, last4: form.last4, brand: form.brand, limitAmount: parseFloat(form.limitAmount) || 0, currentBalance: parseFloat(form.currentBalance) || 0, holder: form.holder, closingDay: parseInt(form.closingDay) || 1, organizationId: orgId };
    if (editCard) updateMutation.mutate({ id: editCard.id, data: payload });
    else createMutation.mutate(payload);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button onClick={openNew} size="sm" className="gap-2" style={{ background: `${PRIMARY}20`, color: PRIMARY, border: `1px solid ${PRIMARY}40` }} data-testid="button-add-card">
          <Plus className="w-4 h-4" /> Novo Cartão
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground/25 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">Nenhum cartão corporativo</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Cadastre os cartões da empresa para rastrear gastos</p>
          <Button onClick={openNew} size="sm" className="mt-4 gap-2" style={{ background: `${PRIMARY}20`, color: PRIMARY, border: `1px solid ${PRIMARY}40` }}>
            <Plus className="w-3.5 h-3.5" /> Adicionar primeiro cartão
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map(card => (
            <CorporateCardItem key={card.id} card={card} orgId={orgId} onEdit={openEdit} onDelete={id => deleteMutation.mutate(id)} />
          ))}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={v => !v && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" style={{ color: PRIMARY }} />
              {editCard ? "Editar Cartão" : "Novo Cartão Corporativo"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Nome do cartão</label>
                <Input placeholder="Ex: Cartão Diretoria" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} data-testid="input-card-name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Últimos 4 dígitos</label>
                <Input placeholder="1234" maxLength={4} value={form.last4} onChange={e => setForm(f => ({ ...f, last4: e.target.value.replace(/\D/g, "") }))} data-testid="input-card-last4" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Bandeira</label>
                <Select value={form.brand} onValueChange={v => setForm(f => ({ ...f, brand: v }))}>
                  <SelectTrigger data-testid="select-card-brand"><SelectValue /></SelectTrigger>
                  <SelectContent>{CARD_BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Titular</label>
                <Input placeholder="Nome do titular" value={form.holder} onChange={e => setForm(f => ({ ...f, holder: e.target.value }))} data-testid="input-card-holder" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Limite (R$)</label>
                <Input type="number" placeholder="5000" value={form.limitAmount} onChange={e => setForm(f => ({ ...f, limitAmount: e.target.value }))} data-testid="input-card-limit" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Fatura atual (R$)</label>
                <Input type="number" placeholder="0" value={form.currentBalance} onChange={e => setForm(f => ({ ...f, currentBalance: e.target.value }))} data-testid="input-card-balance" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dia de fechamento</label>
                <Input type="number" min={1} max={28} placeholder="15" value={form.closingDay} onChange={e => setForm(f => ({ ...f, closingDay: e.target.value }))} data-testid="input-card-closing-day" />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" onClick={closeModal} className="flex-1">Cancelar</Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1" style={{ background: PRIMARY }} data-testid="button-save-card">
                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : editCard ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

type Tab = "lancamentos" | "contas" | "cartoes";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "lancamentos", label: "Lançamentos", icon: DollarSign },
  { id: "contas", label: "Contas", icon: Receipt },
  { id: "cartoes", label: "Cartões Corporativos", icon: CreditCard },
];

export default function BusinessFinancePage() {
  const [activeTab, setActiveTab] = useState<Tab>("lancamentos");

  const { data: orgs = [] } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const orgId: string = orgs[0]?.id ?? "";

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Finanças Corporativas</h1>
      </div>

      <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all font-medium"
            style={{
              background: activeTab === tab.id ? "rgba(255,255,255,0.08)" : "transparent",
              color: activeTab === tab.id ? "white" : "rgba(255,255,255,0.35)",
            }}
            data-testid={`tab-finance-${tab.id}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {orgId ? (
        <>
          {activeTab === "lancamentos" && <LancamentosTab orgId={orgId} />}
          {activeTab === "contas" && <ContasTab orgId={orgId} />}
          {activeTab === "cartoes" && <CartoesTab orgId={orgId} />}
        </>
      ) : (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
