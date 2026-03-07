import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, ArrowUpCircle, CheckCircle2, AlertTriangle, Trash2, X, Clock,
} from "lucide-react";
import type { BusinessReceivable } from "@shared/schema";

const GREEN = "#34D399";
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";
const ACCENT = "#F87171";

const PAYMENT_METHODS = ["Pix", "Cartão de Crédito", "Cartão de Débito", "Boleto", "Dinheiro", "Transferência", "Outro"];

function fmtCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getDueStatus(dueDate: string | Date, status: string) {
  if (status === "received") return "received";
  const now = new Date();
  const due = new Date(dueDate);
  const diffDays = Math.ceil((due.getTime() - now.setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays < 0) return "overdue";
  if (diffDays <= 1) return "urgent";
  return "pending";
}

function StatusBadge({ status, dueDate }: { status: string; dueDate: string }) {
  const s = getDueStatus(dueDate, status);
  const map: Record<string, { label: string; color: string; bg: string }> = {
    received: { label: "Recebida", color: GREEN, bg: "rgba(52,211,153,0.12)" },
    overdue: { label: "Vencida", color: ACCENT, bg: "rgba(248,113,113,0.12)" },
    urgent: { label: "Vence hoje/amanhã", color: AMBER, bg: "rgba(245,158,11,0.12)" },
    pending: { label: "Pendente", color: BLUE, bg: "rgba(59,130,246,0.12)" },
  };
  const cfg = map[s] ?? map.pending;
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: cfg.color, background: cfg.bg }}>
      {cfg.label}
    </span>
  );
}

function ReceivableRow({
  rec,
  onReceive,
  onDelete,
}: {
  rec: BusinessReceivable;
  onReceive: (paymentMethod: string) => void;
  onDelete: () => void;
}) {
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState("Pix");
  const s = getDueStatus(rec.dueDate as string, rec.status);
  const leftColor = s === "received" ? GREEN : s === "overdue" ? ACCENT : s === "urgent" ? AMBER : BLUE;

  return (
    <>
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-background border border-border rounded-2xl w-full max-w-xs shadow-2xl p-5">
            <h3 className="font-bold mb-1">Dar Baixa</h3>
            <p className="text-xs text-muted-foreground mb-4">Como o valor foi recebido?</p>
            <div className="space-y-1.5 mb-4">
              {PAYMENT_METHODS.map(m => (
                <button key={m} onClick={() => setPayMethod(m)}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm transition-all"
                  style={payMethod === m ? { background: "rgba(52,211,153,0.12)", color: GREEN, border: "1px solid rgba(52,211,153,0.3)" } : { background: "hsl(var(--muted)/0.3)", border: "1px solid transparent" }}
                  data-testid={`option-payment-${m.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPayModal(false)} className="flex-1 py-2 rounded-xl text-sm bg-muted" data-testid="button-cancel-baixa">Cancelar</button>
              <button onClick={() => { onReceive(payMethod); setShowPayModal(false); }} className="flex-1 py-2 rounded-xl text-sm text-white font-semibold" style={{ background: GREEN }} data-testid="button-confirm-baixa">
                Confirmar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="rounded-2xl border border-border/50 bg-card overflow-hidden"
        style={{ borderLeft: `3px solid ${leftColor}` }}
      >
        <div className="flex items-center gap-3 px-4 py-3.5">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{rec.description}</p>
              <StatusBadge status={rec.status} dueDate={rec.dueDate as string} />
              {rec.paymentMethod && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{rec.paymentMethod}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {rec.client && <span className="text-xs text-muted-foreground">{rec.client}</span>}
              {rec.costCenter && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">📁 {rec.costCenter}</span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <p className="text-sm font-bold" style={{ color: leftColor }}>{fmtCurrency(rec.amount)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {rec.status === "received" ? `Recebido ${fmtDate(rec.receivedAt as string ?? rec.dueDate as string)}` : `Vence ${fmtDate(rec.dueDate as string)}`}
            </p>
          </div>

          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {rec.status !== "received" && (
              <button onClick={() => setShowPayModal(true)} className="p-1.5 rounded-lg hover:bg-green-500/10 transition-colors" title="Dar Baixa" data-testid={`button-receive-${rec.id}`}>
                <CheckCircle2 className="w-3.5 h-3.5" style={{ color: GREEN }} />
              </button>
            )}
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Excluir" data-testid={`button-delete-receivable-${rec.id}`}>
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

const EMPTY_FORM = {
  description: "", amount: "", dueDate: "", client: "", paymentMethod: "", costCenter: "", notes: "",
};

function NewReceivableModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/business/organizations/${orgId}/receivables`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "receivables"] }); onClose(); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ ...form, amount: parseFloat(form.amount) });
  };

  const field = (key: keyof typeof EMPTY_FORM, label: string, type = "text", required = false, placeholder = "") => (
    <div>
      <label className="block text-xs text-muted-foreground mb-1.5 font-medium">{label}{required && " *"}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        required={required}
        placeholder={placeholder}
        className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        data-testid={`input-receivable-${key}`}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="modal-new-receivable">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div>
            <h2 className="font-bold text-base">Novo Recebível</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Registrar venda, serviço ou cobrança futura</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors" data-testid="button-close-modal-receivable">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {field("description", "Descrição", "text", true, "Venda, prestação de serviço...")}
          <div className="grid grid-cols-2 gap-3">
            {field("amount", "Valor (R$)", "number", true, "0,00")}
            {field("dueDate", "Vencimento", "date", true)}
          </div>
          {field("client", "Cliente", "text", false, "Nome do cliente")}
          <div>
            <label className="block text-xs text-muted-foreground mb-1.5 font-medium">Forma de Pagamento</label>
            <select value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
              className="w-full bg-muted/50 border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="select-receivable-paymentMethod"
            >
              <option value="">Selecione...</option>
              {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field("costCenter", "Centro de Custo", "text", false, "Ex: Projeto X")}
            {field("notes", "Observações", "text", false, "Opcional...")}
          </div>
          <div className="pt-2">
            <button type="submit" disabled={mutation.isPending} className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50" style={{ background: "linear-gradient(135deg, #059669, #34D399)" }} data-testid="button-submit-receivable">
              {mutation.isPending ? "Salvando..." : "Salvar recebível"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

type TabFilter = "all" | "pending" | "overdue" | "received";

export default function BusinessReceivables() {
  const [tab, setTab] = useState<TabFilter>("all");
  const [showModal, setShowModal] = useState(false);

  const { data: orgs } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const orgId = orgs?.[0]?.id;

  const { data: receivables = [], isLoading } = useQuery<BusinessReceivable[]>({
    queryKey: ["/api/business/organizations", orgId, "receivables"],
    enabled: !!orgId,
  });

  const receiveMutation = useMutation({
    mutationFn: ({ id, paymentMethod }: { id: string; paymentMethod: string }) =>
      apiRequest("PATCH", `/api/business/organizations/${orgId}/receivables/${id}`, {
        status: "received", receivedAt: new Date().toISOString(), paymentMethod,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "receivables"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/business/organizations/${orgId}/receivables/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "receivables"] }),
  });

  const overdueItems = receivables.filter(r => getDueStatus(r.dueDate as string, r.status) === "overdue");
  const totalPending = receivables.filter(r => r.status !== "received").reduce((acc, r) => acc + r.amount, 0);
  const totalReceived = receivables.filter(r => r.status === "received").reduce((acc, r) => acc + r.amount, 0);

  const filtered = receivables.filter(r => {
    if (tab === "all") return true;
    if (tab === "pending") return r.status === "pending";
    if (tab === "overdue") return getDueStatus(r.dueDate as string, r.status) === "overdue";
    if (tab === "received") return r.status === "received";
    return true;
  });

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Pendentes" },
    { key: "overdue", label: "Vencidas" },
    { key: "received", label: "Recebidas" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {showModal && orgId && <NewReceivableModal orgId={orgId} onClose={() => setShowModal(false)} />}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Contas a Receber</h1>
            <p className="text-sm text-muted-foreground">Vendas, cobranças e recebimentos futuros</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: "linear-gradient(135deg, #059669, #34D399)" }} data-testid="button-new-receivable">
            <Plus className="w-4 h-4" />
            Novo Recebível
          </button>
        </div>

        {overdueItems.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-5 rounded-2xl p-4 border" style={{ background: "rgba(248,113,113,0.06)", borderColor: "rgba(248,113,113,0.2)" }}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4" style={{ color: ACCENT }} />
              <p className="text-sm font-semibold" style={{ color: ACCENT }}>Inadimplência — {overdueItems.length} conta{overdueItems.length > 1 ? "s" : ""} vencida{overdueItems.length > 1 ? "s" : ""}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Total em atraso: <span className="font-bold" style={{ color: ACCENT }}>{fmtCurrency(overdueItems.reduce((acc, r) => acc + r.amount, 0))}</span>
            </p>
          </motion.div>
        )}

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "A Receber (mês)", value: fmtCurrency(totalPending), color: BLUE, icon: ArrowUpCircle },
            { label: "Já Recebido", value: fmtCurrency(totalReceived), color: GREEN, icon: CheckCircle2 },
            { label: "Vencidos sem baixa", value: String(overdueItems.length), color: ACCENT, icon: AlertTriangle },
          ].map((card, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="rounded-2xl border border-border/50 bg-card p-4"
              style={{ borderTop: `3px solid ${card.color}` }}
            >
              <div className="flex items-center gap-2 mb-2">
                <card.icon className="w-3.5 h-3.5" style={{ color: card.color }} />
                <p className="text-xs text-muted-foreground font-medium">{card.label}</p>
              </div>
              <p className="text-xl font-bold" style={{ color: card.color }}>{card.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border/30 mb-4 w-fit">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={tab === t.key ? { background: "hsl(var(--background))", color: "hsl(var(--foreground))", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" } : { color: "hsl(var(--muted-foreground))" }}
              data-testid={`tab-receivables-${t.key}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-2xl bg-muted/30 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ArrowUpCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhum recebível aqui</p>
            <p className="text-xs mt-1 opacity-60">Adicione um recebível com o botão acima</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map(rec => (
                <ReceivableRow
                  key={rec.id}
                  rec={rec}
                  onReceive={(pm) => receiveMutation.mutate({ id: rec.id, paymentMethod: pm })}
                  onDelete={() => deleteMutation.mutate(rec.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
