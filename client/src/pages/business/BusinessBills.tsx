import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, ArrowDownCircle, CheckCircle2, Clock, AlertTriangle,
  Trash2, CheckSquare, Square, X, Paperclip, ExternalLink,
} from "lucide-react";
import type { BusinessBill } from "@shared/schema";

const ACCENT = "#F87171";
const AMBER = "#F59E0B";
const GREEN = "#34D399";
const BLUE = "#3B82F6";

function fmtCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getDueStatus(dueDate: string | Date, status: string) {
  if (status === "paid") return "paid";
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
    paid: { label: "Paga", color: GREEN, bg: "rgba(52,211,153,0.12)" },
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

function BillRow({
  bill,
  selected,
  onToggle,
  onPay,
  onDelete,
}: {
  bill: BusinessBill;
  selected: boolean;
  onToggle: () => void;
  onPay: () => void;
  onDelete: () => void;
}) {
  const s = getDueStatus(bill.dueDate as string, bill.status);
  const leftColor = s === "paid" ? GREEN : s === "overdue" ? ACCENT : s === "urgent" ? AMBER : BLUE;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rounded-2xl border border-border/50 bg-card overflow-hidden"
      style={{ borderLeft: `3px solid ${leftColor}` }}
    >
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button onClick={onToggle} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors" data-testid={`checkbox-bill-${bill.id}`}>
          {selected ? <CheckSquare className="w-4 h-4" style={{ color: BLUE }} /> : <Square className="w-4 h-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">{bill.description}</p>
            <StatusBadge status={bill.status} dueDate={bill.dueDate as string} />
          </div>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {bill.supplier && <span className="text-xs text-muted-foreground">{bill.supplier}</span>}
            {bill.categoryName && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{bill.categoryName}</span>
            )}
            {bill.costCenter && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">📁 {bill.costCenter}</span>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-bold" style={{ color: leftColor }}>{fmtCurrency(bill.amount)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Vence {fmtDate(bill.dueDate as string)}</p>
        </div>

        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
          {bill.receiptImageUrl && (
            <a href={bill.receiptImageUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-muted transition-colors" title="Ver comprovante" data-testid={`link-receipt-${bill.id}`}>
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          )}
          {bill.status !== "paid" && (
            <button onClick={onPay} className="p-1.5 rounded-lg hover:bg-green-500/10 transition-colors" title="Marcar como paga" data-testid={`button-pay-${bill.id}`}>
              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: GREEN }} />
            </button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors" title="Excluir" data-testid={`button-delete-bill-${bill.id}`}>
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

const EMPTY_FORM = {
  description: "", amount: "", dueDate: "", supplier: "", categoryName: "", paymentMethod: "", costCenter: "", notes: "",
};

function NewBillModal({ orgId, onClose }: { orgId: string; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/business/organizations/${orgId}/bills`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "bills"] }); onClose(); },
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
        data-testid={`input-bill-${key}`}
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" data-testid="modal-new-bill">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background border border-border rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div>
            <h2 className="font-bold text-base">Nova Conta a Pagar</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Registrar boleto, fornecedor ou despesa futura</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors" data-testid="button-close-modal">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {field("description", "Descrição", "text", true, "Aluguel, internet, fornecedor...")}
          <div className="grid grid-cols-2 gap-3">
            {field("amount", "Valor (R$)", "number", true, "0,00")}
            {field("dueDate", "Vencimento", "date", true)}
          </div>
          {field("supplier", "Fornecedor", "text", false, "Nome do fornecedor")}
          <div className="grid grid-cols-2 gap-3">
            {field("categoryName", "Categoria", "text", false, "Ex: Utilities")}
            {field("costCenter", "Centro de Custo", "text", false, "Ex: Projeto X")}
          </div>
          {field("notes", "Observações", "text", false, "Opcional...")}
          <div className="pt-2">
            <button type="submit" disabled={mutation.isPending} className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50" style={{ background: "linear-gradient(135deg, #2563EB, #6366F1)" }} data-testid="button-submit-bill">
              {mutation.isPending ? "Salvando..." : "Salvar conta"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

type TabFilter = "all" | "pending" | "overdue" | "paid";

export default function BusinessBills() {
  const [tab, setTab] = useState<TabFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);

  const { data: orgs } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const orgId = orgs?.[0]?.id;

  const { data: bills = [], isLoading } = useQuery<BusinessBill[]>({
    queryKey: ["/api/business/organizations", orgId, "bills"],
    enabled: !!orgId,
  });

  const payMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PATCH", `/api/business/organizations/${orgId}/bills/${id}`, { status: "paid", paidAt: new Date().toISOString() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "bills"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/business/organizations/${orgId}/bills/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "bills"] }),
  });

  const batchPayMutation = useMutation({
    mutationFn: (ids: string[]) => apiRequest("POST", `/api/business/organizations/${orgId}/bills/batch-pay`, { ids }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "bills"] }); setSelected(new Set()); },
  });

  const filtered = bills.filter(b => {
    if (tab === "all") return true;
    if (tab === "pending") return b.status === "pending";
    if (tab === "overdue") {
      const s = getDueStatus(b.dueDate as string, b.status);
      return s === "overdue";
    }
    if (tab === "paid") return b.status === "paid";
    return true;
  });

  const totalPending = bills.filter(b => b.status !== "paid").reduce((acc, b) => acc + b.amount, 0);
  const totalOverdue = bills.filter(b => getDueStatus(b.dueDate as string, b.status) === "overdue").reduce((acc, b) => acc + b.amount, 0);

  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "pending", label: "Pendentes" },
    { key: "overdue", label: "Vencidas" },
    { key: "paid", label: "Pagas" },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {showModal && orgId && <NewBillModal orgId={orgId} onClose={() => setShowModal(false)} />}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-1">Contas a Pagar</h1>
            <p className="text-sm text-muted-foreground">Controle de boletos, fornecedores e despesas futuras</p>
          </div>
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all" style={{ background: "linear-gradient(135deg, #2563EB, #6366F1)" }} data-testid="button-new-bill">
            <Plus className="w-4 h-4" />
            Nova Conta
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "A Pagar (mês)", value: fmtCurrency(totalPending), color: ACCENT, icon: ArrowDownCircle },
            { label: "Vencidas", value: fmtCurrency(totalOverdue), color: AMBER, icon: AlertTriangle },
            { label: "Contas cadastradas", value: String(bills.length), color: BLUE, icon: Clock },
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

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border/30">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={tab === t.key ? { background: "hsl(var(--background))", color: "hsl(var(--foreground))", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" } : { color: "hsl(var(--muted-foreground))" }}
                data-testid={`tab-bills-${t.key}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {selected.size > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => batchPayMutation.mutate(Array.from(selected))}
              disabled={batchPayMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: GREEN }}
              data-testid="button-batch-pay"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Pagar {selected.size} selecionada{selected.size > 1 ? "s" : ""}
            </motion.button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-2xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ArrowDownCircle className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Nenhuma conta aqui</p>
            <p className="text-xs mt-1 opacity-60">Adicione uma conta a pagar com o botão acima</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map(bill => (
                <BillRow
                  key={bill.id}
                  bill={bill}
                  selected={selected.has(bill.id)}
                  onToggle={() => toggleSelect(bill.id)}
                  onPay={() => payMutation.mutate(bill.id)}
                  onDelete={() => deleteMutation.mutate(bill.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
