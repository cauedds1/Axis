import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Calendar } from "lucide-react";
import type { BusinessBill, BusinessReceivable } from "@shared/schema";

const GREEN = "#34D399";
const ACCENT = "#F87171";
const BLUE = "#3B82F6";
const AMBER = "#F59E0B";

function fmtCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function isThisMonth(d: string | Date) {
  const now = new Date();
  const date = new Date(d);
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function getWeekLabel(dueDate: string | Date): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return "Vencidos";
  if (diffDays <= 7) return "Esta semana";
  if (diffDays <= 14) return "Próxima semana";
  if (diffDays <= 21) return "Em 3 semanas";
  return "Em 4 semanas ou mais";
}

const WEEK_ORDER = ["Vencidos", "Esta semana", "Próxima semana", "Em 3 semanas", "Em 4 semanas ou mais"];

type TimelineItem =
  | { kind: "bill"; data: BusinessBill }
  | { kind: "receivable"; data: BusinessReceivable };

export default function BusinessCashflow() {
  const { data: orgs } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const orgId = orgs?.[0]?.id;

  const { data: bills = [], isLoading: billsLoading } = useQuery<BusinessBill[]>({
    queryKey: ["/api/business/organizations", orgId, "bills"],
    enabled: !!orgId,
  });

  const { data: receivables = [], isLoading: recLoading } = useQuery<BusinessReceivable[]>({
    queryKey: ["/api/business/organizations", orgId, "receivables"],
    enabled: !!orgId,
  });

  const isLoading = billsLoading || recLoading;

  const totalAPagar = bills
    .filter(b => b.status !== "paid" && isThisMonth(b.dueDate as string))
    .reduce((acc, b) => acc + b.amount, 0);

  const totalAReceber = receivables
    .filter(r => r.status !== "received" && isThisMonth(r.dueDate as string))
    .reduce((acc, r) => acc + r.amount, 0);

  const saldoProjetado = totalAReceber - totalAPagar;

  const pendingBills = bills.filter(b => b.status !== "paid");
  const pendingRec = receivables.filter(r => r.status !== "received");

  const allItems: TimelineItem[] = [
    ...pendingBills.map(b => ({ kind: "bill" as const, data: b })),
    ...pendingRec.map(r => ({ kind: "receivable" as const, data: r })),
  ].sort((a, b) => new Date(a.data.dueDate as string).getTime() - new Date(b.data.dueDate as string).getTime());

  const grouped: Record<string, TimelineItem[]> = {};
  for (const item of allItems) {
    const label = getWeekLabel(item.data.dueDate as string);
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(item);
  }

  const summaryCards = [
    { label: "Total a Pagar", sublabel: "mês atual — pendente", value: fmtCurrency(totalAPagar), color: ACCENT, icon: ArrowDownCircle },
    { label: "Total a Receber", sublabel: "mês atual — pendente", value: fmtCurrency(totalAReceber), color: GREEN, icon: ArrowUpCircle },
    {
      label: "Saldo Projetado",
      sublabel: saldoProjetado >= 0 ? "resultado positivo" : "atenção: déficit",
      value: fmtCurrency(saldoProjetado),
      color: saldoProjetado >= 0 ? BLUE : ACCENT,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">Visão geral das entradas e saídas do mês</p>
        </div>

        {saldoProjetado < 0 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 rounded-2xl p-4 border flex items-start gap-3"
            style={{ background: "rgba(248,113,113,0.07)", borderColor: "rgba(248,113,113,0.25)" }}
          >
            <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: ACCENT }} />
            <div>
              <p className="text-sm font-bold" style={{ color: ACCENT }}>Atenção: Furo de Caixa Projetado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                As contas a pagar superam os recebíveis este mês em{" "}
                <span className="font-bold" style={{ color: ACCENT }}>{fmtCurrency(Math.abs(saldoProjetado))}</span>.
                Revise seus prazos ou antecipe cobranças.
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {summaryCards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="rounded-2xl border border-border/50 bg-card p-5"
              style={{ borderTop: `3px solid ${card.color}` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <card.icon className="w-4 h-4" style={{ color: card.color }} />
                <p className="text-sm font-semibold">{card.label}</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{card.sublabel}</p>
              <p className="text-2xl font-bold" style={{ color: card.color }}>{isLoading ? "—" : card.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Próximos 30 dias</h2>
          <span className="text-xs text-muted-foreground">— entradas e saídas pendentes</span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-12 rounded-2xl bg-muted/30 animate-pulse" />)}
          </div>
        ) : allItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma movimentação futura</p>
            <p className="text-xs mt-1 opacity-60">Adicione contas a pagar e a receber para ver o fluxo</p>
          </div>
        ) : (
          <div className="space-y-6">
            {WEEK_ORDER.filter(w => grouped[w]?.length > 0).map(weekLabel => (
              <div key={weekLabel}>
                <div className="flex items-center gap-3 mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{weekLabel}</p>
                  <div className="flex-1 h-px bg-border/40" />
                  <div className="text-xs text-muted-foreground">
                    {grouped[weekLabel].reduce((acc, item) => {
                      return item.kind === "receivable" ? acc + item.data.amount : acc - item.data.amount;
                    }, 0) >= 0 ? (
                      <span style={{ color: GREEN }}>+{fmtCurrency(grouped[weekLabel].reduce((acc, item) => item.kind === "receivable" ? acc + item.data.amount : acc - item.data.amount, 0))}</span>
                    ) : (
                      <span style={{ color: ACCENT }}>{fmtCurrency(grouped[weekLabel].reduce((acc, item) => item.kind === "receivable" ? acc + item.data.amount : acc - item.data.amount, 0))}</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {grouped[weekLabel].map((item, idx) => {
                    const isBill = item.kind === "bill";
                    const color = isBill ? ACCENT : GREEN;
                    const d = item.data;
                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3"
                      >
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
                          {isBill
                            ? <ArrowDownCircle className="w-3.5 h-3.5" style={{ color }} />
                            : <ArrowUpCircle className="w-3.5 h-3.5" style={{ color }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {isBill ? (d as BusinessBill).supplier : (d as BusinessReceivable).client}
                            {" · "}
                            {fmtDate(d.dueDate as string)}
                          </p>
                        </div>
                        <p className="text-sm font-bold flex-shrink-0" style={{ color }}>
                          {isBill ? "-" : "+"}{fmtCurrency(d.amount)}
                        </p>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
