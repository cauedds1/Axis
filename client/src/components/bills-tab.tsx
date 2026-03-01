import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Check, X, TrendingDown, TrendingUp, DollarSign, AlertCircle, Clock, CheckCircle, Infinity, Calendar, CalendarRange, CalendarDays, Loader2, ChevronDown, ChevronUp, Store, User, CreditCard, FileText, Tag, RotateCcw, Pencil } from "lucide-react";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import type { Bill } from "@shared/schema";

const HIGH_PRIMARY = "#00E6FF";
const SLIM_PRIMARY = "#7A9E8A";
const EXPENSE_COLOR = "#FF1744";
const INCOME_COLOR = "#00E5C8";

type RecurrenceType = "permanent" | "this_month" | "three_months" | "custom";

interface Recurrence {
  type: RecurrenceType;
  endDate?: string;
}

function getEndDate(rec: Recurrence): Date {
  const now = new Date();
  if (rec.type === "permanent") return new Date(now.getFullYear() + 20, now.getMonth(), now.getDate());
  if (rec.type === "this_month") return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (rec.type === "three_months") return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
  if (rec.type === "custom" && rec.endDate) return new Date(rec.endDate);
  return new Date(now.getFullYear() + 20, now.getMonth(), now.getDate());
}

function recLabel(type: RecurrenceType): string {
  if (type === "permanent") return "Permanente";
  if (type === "this_month") return "Este mês";
  if (type === "three_months") return "3 meses";
  return "Personalizado";
}

function isBillActiveInMonth(bill: Bill, y: number, m: number): boolean {
  if (!bill.active) return false;
  const created = new Date(bill.createdAt!);
  const createdY = created.getFullYear();
  const createdM = created.getMonth();
  if (y < createdY || (y === createdY && m < createdM)) return false;
  if (bill.recurrenceType === "permanent") return true;
  if (bill.recurrenceType === "this_month") return y === createdY && m === createdM;
  if (bill.recurrenceType === "three_months") {
    const endDate = new Date(createdY, createdM + 3, createdM === 11 ? 28 : 1);
    return new Date(y, m, 1) <= endDate;
  }
  if (bill.recurrenceType === "custom" && bill.recurrenceEndDate) {
    return new Date(y, m, 1) <= new Date(bill.recurrenceEndDate);
  }
  return false;
}

function isBillActiveThisMonth(bill: Bill): boolean {
  const now = new Date();
  return isBillActiveInMonth(bill, now.getFullYear(), now.getMonth());
}

function isBillActiveInRange(bill: Bill, months: Array<{ y: number; m: number }>): boolean {
  return months.some(({ y, m }) => isBillActiveInMonth(bill, y, m));
}

function getPaidMonths(bill: Bill): string[] {
  try { return JSON.parse(bill.paidMonths || "[]"); } catch { return []; }
}

function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthKeyFromYM(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function isBillPaidInMonth(bill: Bill, y: number, m: number): boolean {
  return getPaidMonths(bill).includes(monthKeyFromYM(y, m));
}

function isBillPaidThisMonth(bill: Bill): boolean {
  return getPaidMonths(bill).includes(monthKey());
}

function isBillPaidInAllMonths(bill: Bill, months: Array<{ y: number; m: number }>): boolean {
  const activeMonths = months.filter(({ y, m }) => isBillActiveInMonth(bill, y, m));
  if (activeMonths.length === 0) return false;
  return activeMonths.every(({ y, m }) => isBillPaidInMonth(bill, y, m));
}

function isBillPaidInAnyMonth(bill: Bill, months: Array<{ y: number; m: number }>): boolean {
  return months.some(({ y, m }) => isBillPaidInMonth(bill, y, m));
}

function isBillOverdue(bill: Bill): boolean {
  if (isBillPaidThisMonth(bill)) return false;
  const today = new Date();
  return bill.dueDay < today.getDate();
}

function isBillOverdueInRange(bill: Bill, months: Array<{ y: number; m: number }>): boolean {
  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = now.getMonth();
  const currentDay = now.getDate();
  return months.some(({ y, m }) => {
    if (!isBillActiveInMonth(bill, y, m)) return false;
    if (isBillPaidInMonth(bill, y, m)) return false;
    if (y < currentY || (y === currentY && m < currentM)) return true;
    if (y === currentY && m === currentM && bill.dueDay < currentDay) return true;
    return false;
  });
}

type PeriodFilter = "current" | "last" | "last3" | "last6" | "custom";

function getMonthsForPeriod(period: PeriodFilter, customStart?: string, customEnd?: string): Array<{ y: number; m: number }> {
  const now = new Date();
  const months: Array<{ y: number; m: number }> = [];

  if (period === "current") {
    months.push({ y: now.getFullYear(), m: now.getMonth() });
  } else if (period === "last") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth() });
  } else if (period === "last3") {
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth() });
    }
  } else if (period === "last6") {
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth() });
    }
  } else if (period === "custom") {
    if (customStart && customEnd) {
      const start = new Date(customStart + "T00:00:00");
      const end = new Date(customEnd + "T00:00:00");
      const cur = new Date(start.getFullYear(), start.getMonth(), 1);
      while (cur <= end) {
        months.push({ y: cur.getFullYear(), m: cur.getMonth() });
        cur.setMonth(cur.getMonth() + 1);
      }
    }
    if (months.length === 0) months.push({ y: now.getFullYear(), m: now.getMonth() });
  }

  return months;
}

function getPeriodLabel(period: PeriodFilter, months: Array<{ y: number; m: number }>): string {
  if (months.length === 0) {
    const now = new Date();
    return now.toLocaleString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
  }
  if (months.length === 1) {
    const d = new Date(months[0].y, months[0].m, 1);
    return d.toLocaleString("pt-BR", { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
  }
  const first = new Date(months[months.length - 1].y, months[months.length - 1].m, 1);
  const last = new Date(months[0].y, months[0].m, 1);
  const f = first.toLocaleString("pt-BR", { month: "short", year: "numeric" });
  const l = last.toLocaleString("pt-BR", { month: "short", year: "numeric" });
  return `${f} — ${l}`;
}

const RECURRENCE_OPTIONS: { type: RecurrenceType; label: string; sub: string; icon: any }[] = [
  { type: "permanent", label: "Permanente", sub: "até você desativar", icon: Infinity },
  { type: "this_month", label: "Este mês", sub: "só o mês atual", icon: Calendar },
  { type: "three_months", label: "3 meses", sub: "próximos 3 meses", icon: CalendarRange },
  { type: "custom", label: "Personalizado", sub: "escolher data", icon: CalendarDays },
];

function RecurrenceSelector({ value, onChange, accent }: { value: Recurrence; onChange: (r: Recurrence) => void; accent: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Recorrência</p>
      <div className="grid grid-cols-2 gap-2">
        {RECURRENCE_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const selected = value.type === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => onChange({ type: opt.type })}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all duration-150"
              style={{
                background: selected ? `${accent}12` : "rgba(255,255,255,0.03)",
                border: `1px solid ${selected ? `${accent}35` : "rgba(255,255,255,0.07)"}`,
              }}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: selected ? accent : "rgba(255,255,255,0.3)" }} />
              <div>
                <p className="text-xs font-semibold leading-none mb-0.5" style={{ color: selected ? "white" : "rgba(255,255,255,0.4)" }}>{opt.label}</p>
                <p className="text-[10px] leading-none" style={{ color: "rgba(255,255,255,0.25)" }}>{opt.sub}</p>
              </div>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {value.type === "custom" && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto", marginTop: 8 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}>
            <input
              type="date"
              value={value.endDate || ""}
              onChange={e => onChange({ ...value, endDate: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SummaryCard({ label, value, sub, accent, icon: Icon }: { label: string; value: string; sub?: string; accent: string; icon: any }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${accent}18` }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">{label}</span>
      </div>
      <span className="text-xl font-bold" style={{ color: accent }}>{value}</span>
      {sub && <span className="text-[11px] text-white/30">{sub}</span>}
    </div>
  );
}

function AddBillModal({ open, onClose, accent }: { open: boolean; onClose: () => void; accent: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "",
    amount: "",
    type: "expense" as "expense" | "income",
    dueDay: "1",
    categoryName: "",
    notes: "",
  });
  const [recurrence, setRecurrence] = useState<Recurrence>({ type: "permanent" });

  const mutation = useMutation({
    mutationFn: async () => {
      const endDate = recurrence.type !== "permanent" ? getEndDate(recurrence).toISOString() : undefined;
      const res = await apiRequest("POST", "/api/bills", {
        title: form.title.trim(),
        amount: parseFloat(form.amount),
        type: form.type,
        dueDay: parseInt(form.dueDay) || 1,
        categoryName: form.categoryName.trim() || undefined,
        recurrenceType: recurrence.type,
        recurrenceEndDate: endDate,
        notes: form.notes.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      setForm({ title: "", amount: "", type: "expense", dueDay: "1", categoryName: "", notes: "" });
      setRecurrence({ type: "permanent" });
      onClose();
      toast({ title: "Conta cadastrada" });
    },
    onError: (e: any) => toast({ title: "Erro ao salvar conta", description: e.message, variant: "destructive" }),
  });

  const canSave = form.title.trim().length > 0 && parseFloat(form.amount) > 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" style={{ background: "#0d0d12", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white">Nova conta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Tipo toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {([["expense", "A Pagar", EXPENSE_COLOR], ["income", "A Receber", INCOME_COLOR]] as const).map(([val, label, color]) => (
              <button
                key={val}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: val }))}
                className="flex-1 py-2.5 text-sm font-semibold transition-all duration-150"
                style={{
                  background: form.type === val ? `${color}18` : "transparent",
                  color: form.type === val ? color : "rgba(255,255,255,0.3)",
                }}
                data-testid={`toggle-bill-type-${val}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Título */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Descrição</p>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Aluguel, Salário, Netflix..."
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              data-testid="input-bill-title"
            />
          </div>

          {/* Valor */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Valor</p>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-white/40 text-sm font-medium">R$</span>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
                data-testid="input-bill-amount"
              />
            </div>
          </div>

          {/* Vencimento + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Dia de vencimento</p>
              <input
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                data-testid="input-bill-due-day"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Categoria</p>
              <input
                value={form.categoryName}
                onChange={e => setForm(f => ({ ...f, categoryName: e.target.value }))}
                placeholder="Ex: Moradia..."
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                data-testid="input-bill-category"
              />
            </div>
          </div>

          {/* Recorrência */}
          <RecurrenceSelector value={recurrence} onChange={setRecurrence} accent={form.type === "expense" ? EXPENSE_COLOR : INCOME_COLOR} />

          {/* Observações */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Observações <span className="normal-case font-normal">(opcional)</span></p>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Anotações sobre esta conta..."
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              data-testid="input-bill-notes"
            />
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSave}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ background: form.type === "expense" ? EXPENSE_COLOR : INCOME_COLOR, color: "#060608" }}
            data-testid="button-submit-bill"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {mutation.isPending ? "Salvando..." : "Cadastrar conta"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditBillModal({ bill, onClose, accent }: { bill: Bill; onClose: () => void; accent: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: bill.title,
    amount: String(bill.amount),
    type: (bill.type ?? "expense") as "expense" | "income",
    dueDay: String(bill.dueDay),
    categoryName: bill.categoryName ?? "",
    notes: bill.notes ?? "",
  });
  const [recurrence, setRecurrence] = useState<Recurrence>(() => {
    const rt = (bill.recurrenceType ?? "permanent") as RecurrenceType;
    if (rt === "custom" && bill.recurrenceEndDate) {
      return { type: "custom", endDate: new Date(bill.recurrenceEndDate).toISOString().split("T")[0] };
    }
    return { type: rt };
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const endDate = recurrence.type !== "permanent" ? getEndDate(recurrence).toISOString() : undefined;
      const res = await apiRequest("PATCH", `/api/bills/${bill.id}`, {
        title: form.title.trim(),
        amount: parseFloat(form.amount),
        type: form.type,
        dueDay: parseInt(form.dueDay) || 1,
        categoryName: form.categoryName.trim() || undefined,
        recurrenceType: recurrence.type,
        recurrenceEndDate: endDate ?? null,
        notes: form.notes.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      onClose();
      toast({ title: "Conta atualizada" });
    },
    onError: (e: any) => toast({ title: "Erro ao atualizar conta", description: e.message, variant: "destructive" }),
  });

  const canSave = form.title.trim().length > 0 && parseFloat(form.amount) > 0;
  const billAccent = form.type === "expense" ? EXPENSE_COLOR : INCOME_COLOR;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" style={{ background: "#0d0d12", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white">Editar conta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {([["expense", "A Pagar", EXPENSE_COLOR], ["income", "A Receber", INCOME_COLOR]] as const).map(([val, label, color]) => (
              <button
                key={val}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: val }))}
                className="flex-1 py-2.5 text-sm font-semibold transition-all duration-150"
                style={{
                  background: form.type === val ? `${color}18` : "transparent",
                  color: form.type === val ? color : "rgba(255,255,255,0.3)",
                }}
                data-testid={`toggle-edit-bill-type-${val}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Descrição</p>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Aluguel, Netflix..."
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              data-testid="input-edit-bill-title"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Valor</p>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-white/40 text-sm font-medium">R$</span>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
                data-testid="input-edit-bill-amount"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Dia de vencimento</p>
              <input
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                data-testid="input-edit-bill-due-day"
              />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Categoria</p>
              <input
                value={form.categoryName}
                onChange={e => setForm(f => ({ ...f, categoryName: e.target.value }))}
                placeholder="Ex: Moradia..."
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                data-testid="input-edit-bill-category"
              />
            </div>
          </div>

          <RecurrenceSelector value={recurrence} onChange={setRecurrence} accent={billAccent} />

          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Observações <span className="normal-case font-normal">(opcional)</span></p>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Anotações sobre esta conta..."
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              data-testid="input-edit-bill-notes"
            />
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSave}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ background: billAccent, color: "#060608" }}
            data-testid="button-submit-edit-bill"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {mutation.isPending ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const PERIOD_OPTS: { id: PeriodFilter; label: string }[] = [
  { id: "current", label: "Mês atual" },
  { id: "last", label: "Mês passado" },
  { id: "last3", label: "3 meses" },
  { id: "last6", label: "6 meses" },
  { id: "custom", label: "Personalizado" },
];

export function BillsTab() {
  const { theme } = useTheme();
  const isHigh = theme === "high";
  const accent = isHigh ? HIGH_PRIMARY : SLIM_PRIMARY;
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>("current");
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: allBills = [], isLoading } = useQuery<Bill[]>({ queryKey: ["/api/bills"] });

  const periodMonths = getMonthsForPeriod(filterPeriod, customStart, customEnd);
  const isSingleCurrentMonth = filterPeriod === "current";

  const togglePaidMutation = useMutation({
    mutationFn: async ({ bill, paid }: { bill: Bill; paid: boolean }) => {
      const months = getPaidMonths(bill);
      const key = monthKey();
      const updated = paid ? [...months, key] : months.filter(m => m !== key);
      const res = await apiRequest("PATCH", `/api/bills/${bill.id}`, { paidMonths: JSON.stringify(updated) });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/bills"] }),
    onError: () => toast({ title: "Erro ao atualizar conta", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/bills/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: "Conta removida" });
    },
    onError: () => toast({ title: "Erro ao remover conta", variant: "destructive" }),
  });

  const activeBills = allBills.filter(b => isBillActiveInRange(b, periodMonths));

  const unpaidExpenses = activeBills.filter(b => b.type === "expense" && !isBillPaidInAllMonths(b, periodMonths));
  const unpaidIncomes = activeBills.filter(b => b.type === "income" && !isBillPaidInAllMonths(b, periodMonths));
  const totalPagar = unpaidExpenses.reduce((s, b) => s + b.amount * Math.max(1, periodMonths.filter(({ y, m }) => isBillActiveInMonth(b, y, m) && !isBillPaidInMonth(b, y, m)).length), 0);
  const totalReceber = unpaidIncomes.reduce((s, b) => s + b.amount * Math.max(1, periodMonths.filter(({ y, m }) => isBillActiveInMonth(b, y, m) && !isBillPaidInMonth(b, y, m)).length), 0);
  const saldoPrevisto = totalReceber - totalPagar;
  const vencidas = activeBills.filter(b => b.type === "expense" && isBillOverdueInRange(b, periodMonths));
  const hoje = new Date().getDate();
  const proximos7 = isSingleCurrentMonth
    ? activeBills.filter(b => !isBillPaidThisMonth(b) && b.dueDay >= hoje && b.dueDay <= hoje + 7)
    : [];
  const pagoMes = activeBills.filter(b => isBillPaidInAnyMonth(b, periodMonths));
  const totalPagoMes = pagoMes.reduce((s, b) => {
    const paidCount = periodMonths.filter(({ y, m }) => isBillActiveInMonth(b, y, m) && isBillPaidInMonth(b, y, m)).length;
    return s + b.amount * paidCount;
  }, 0);

  const filtered = activeBills.filter(b => {
    if (filterType !== "all" && b.type !== filterType) return false;
    if (filterStatus === "paid" && !isBillPaidInAnyMonth(b, periodMonths)) return false;
    if (filterStatus === "pending" && (isBillPaidInAllMonths(b, periodMonths) || isBillOverdueInRange(b, periodMonths))) return false;
    if (filterStatus === "overdue" && !isBillOverdueInRange(b, periodMonths)) return false;
    return true;
  });

  const PILL = (label: string, active: boolean, onClick: () => void, color?: string) => (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150"
      style={{
        background: active ? (color ? `${color}18` : `${accent}18`) : "rgba(255,255,255,0.04)",
        border: `1px solid ${active ? (color ? `${color}35` : `${accent}35`) : "rgba(255,255,255,0.07)"}`,
        color: active ? (color || accent) : "rgba(255,255,255,0.35)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Contas a Pagar / Receber</h2>
          <p className="text-xs text-white/35 mt-0.5">
            {getPeriodLabel(filterPeriod, periodMonths)}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30`, color: accent }}
          data-testid="button-add-bill"
        >
          <Plus className="h-4 w-4" /> Nova Conta
        </button>
      </div>

      {/* Period filter */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTS.map(opt => {
            const isActive = filterPeriod === opt.id;
            return (
              <button
                key={opt.id}
                data-testid={`filter-period-${opt.id}`}
                onClick={() => {
                  setFilterPeriod(opt.id);
                  setShowCustomDates(opt.id === "custom");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200"
                style={isActive
                  ? { background: `${accent}18`, color: accent, borderColor: `${accent}40` }
                  : { background: "transparent", color: "rgba(255,255,255,0.35)", borderColor: "rgba(255,255,255,0.07)" }
                }
              >
                <CalendarDays className="h-3 w-3" />
                {opt.label}
              </button>
            );
          })}
        </div>
        {showCustomDates && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
            <span className="text-xs text-white/40 font-medium">De</span>
            <input
              type="date"
              data-testid="input-bill-custom-start"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-transparent text-white outline-none focus:ring-1 focus:ring-white/20"
            />
            <span className="text-xs text-white/40 font-medium">até</span>
            <input
              type="date"
              data-testid="input-bill-custom-end"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-transparent text-white outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SummaryCard label="A Pagar" value={`R$ ${fmtBRL(totalPagar)}`} sub={`${unpaidExpenses.length} conta(s)`} accent={EXPENSE_COLOR} icon={TrendingDown} />
        <SummaryCard label="A Receber" value={`R$ ${fmtBRL(totalReceber)}`} sub={`${unpaidIncomes.length} conta(s)`} accent={INCOME_COLOR} icon={TrendingUp} />
        <SummaryCard label="Saldo Previsto" value={`R$ ${fmtBRL(saldoPrevisto)}`} accent={saldoPrevisto >= 0 ? INCOME_COLOR : EXPENSE_COLOR} icon={DollarSign} />
        <SummaryCard label="Vencidas" value={`${vencidas.length}`} sub={vencidas.length > 0 ? `R$ ${fmtBRL(vencidas.reduce((s, b) => s + b.amount, 0))}` : undefined} accent={vencidas.length > 0 ? "#FF1744" : "rgba(255,255,255,0.3)"} icon={AlertCircle} />
        {isSingleCurrentMonth ? (
          <SummaryCard label="Próximos 7 dias" value={`${proximos7.length}`} sub={proximos7.length > 0 ? `R$ ${fmtBRL(proximos7.reduce((s, b) => s + b.amount, 0))}` : undefined} accent={proximos7.length > 0 ? "#FFA000" : "rgba(255,255,255,0.3)"} icon={Clock} />
        ) : (
          <SummaryCard label="Total Contas" value={`${activeBills.length}`} sub={`no período`} accent="rgba(255,255,255,0.5)" icon={Clock} />
        )}
        <SummaryCard label={isSingleCurrentMonth ? "Pago este Mês" : "Pago no Período"} value={`R$ ${fmtBRL(totalPagoMes)}`} sub={`${pagoMes.length} item(s)`} accent={INCOME_COLOR} icon={CheckCircle} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {PILL("Todos", filterType === "all", () => setFilterType("all"))}
        {PILL("A pagar", filterType === "expense", () => setFilterType("expense"), EXPENSE_COLOR)}
        {PILL("A receber", filterType === "income", () => setFilterType("income"), INCOME_COLOR)}
        <div className="w-px bg-white/10 self-stretch mx-1" />
        {PILL("Todos status", filterStatus === "all", () => setFilterStatus("all"))}
        {PILL("Pendentes", filterStatus === "pending", () => setFilterStatus("pending"))}
        {PILL("Pagos", filterStatus === "paid", () => setFilterStatus("paid"), INCOME_COLOR)}
        {PILL("Vencidos", filterStatus === "overdue", () => setFilterStatus("overdue"), EXPENSE_COLOR)}
      </div>

      {/* Bills list */}
      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/30" /></div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-16 flex flex-col items-center gap-4 text-center"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <DollarSign className="h-8 w-8 text-white/20" />
          </div>
          <div>
            <p className="text-white/50 font-medium">Nenhuma conta cadastrada</p>
            <p className="text-white/25 text-sm mt-1">Adicione suas contas fixas para acompanhar tudo</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: `${accent}18`, border: `1px solid ${accent}30`, color: accent }}
            data-testid="button-add-first-bill"
          >
            <Plus className="h-4 w-4" /> Cadastrar primeira conta
          </button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map(bill => {
              const paid = isBillPaidThisMonth(bill);
              const overdue = isBillOverdue(bill);
              const isExpense = bill.type === "expense";
              const rowAccent = isExpense ? EXPENSE_COLOR : INCOME_COLOR;
              const expanded = expandedId === bill.id;
              const today = new Date().getDate();
              const daysUntilDue = bill.dueDay - today;
              const isUpcomingSoon = !paid && !overdue && daysUntilDue >= 0 && daysUntilDue <= 5;
              const WARN_COLOR = "#FFA000";
              const statusColor = paid ? INCOME_COLOR : overdue ? EXPENSE_COLOR : isUpcomingSoon ? WARN_COLOR : "rgba(255,255,255,0.25)";
              const statusLabel = paid ? "Pago" : overdue ? "Vencido" : isUpcomingSoon ? (daysUntilDue === 0 ? "Vence hoje!" : `Vence em ${daysUntilDue}d`) : `Dia ${bill.dueDay}`;

              return (
                <motion.div
                  key={bill.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: isUpcomingSoon ? "rgba(255,160,0,0.04)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${paid ? "rgba(255,255,255,0.06)" : overdue ? `${EXPENSE_COLOR}25` : isUpcomingSoon ? `${WARN_COLOR}35` : "rgba(255,255,255,0.07)"}`,
                    opacity: paid ? 0.65 : 1,
                  }}
                  data-testid={`card-bill-${bill.id}`}
                >
                  {/* Left accent bar */}
                  <div className="flex">
                    <div className="w-1 shrink-0 rounded-l-2xl" style={{ background: paid ? "rgba(255,255,255,0.1)" : rowAccent }} />

                    <div className="flex-1 p-4">
                      <div
                        className="flex items-center justify-between gap-3 cursor-pointer select-none"
                        onClick={() => setExpandedId(expanded ? null : bill.id)}
                        data-testid={`button-expand-bill-${bill.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${rowAccent}15` }}>
                            {isExpense ? <TrendingDown className="h-4 w-4" style={{ color: rowAccent }} /> : <TrendingUp className="h-4 w-4" style={{ color: rowAccent }} />}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold truncate ${paid ? "line-through text-white/40" : "text-white"}`}>{bill.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {bill.categoryName && <span className="text-[10px] text-white/30">{bill.categoryName}</span>}
                              <span className="text-[10px] font-medium" style={{ color: statusColor }}>{statusLabel}</span>
                              <span className="text-[10px] text-white/20">{recLabel(bill.recurrenceType as RecurrenceType)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-base font-bold" style={{ color: paid ? "rgba(255,255,255,0.3)" : rowAccent }}>
                            {isExpense ? "-" : "+"}R$ {fmtBRL(bill.amount)}
                          </span>
                          <div className="p-1.5">
                            {expanded ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.18 }}
                            className="space-y-3 pt-3"
                            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            {bill.notes && (() => {
                              const lines = bill.notes.split("\n");
                              const info: { label: string; value: string; icon: any }[] = [];
                              for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed) continue;
                                if (trimmed.startsWith("Emissor:")) {
                                  info.push({ label: "Emissor", value: trimmed.replace("Emissor:", "").trim(), icon: Store });
                                } else if (trimmed.startsWith("Destinatário:") || trimmed.startsWith("Destinatario:")) {
                                  info.push({ label: "Destinatário", value: trimmed.replace(/Destinat[áa]rio:/, "").trim(), icon: User });
                                } else if (trimmed.startsWith("Pagamento:")) {
                                  info.push({ label: "Pagamento", value: trimmed.replace("Pagamento:", "").trim(), icon: CreditCard });
                                } else if (trimmed.startsWith("Descrição:") || trimmed.startsWith("Descricao:")) {
                                  info.push({ label: "Serviço/Produto", value: trimmed.replace(/Descri[çc][ãa]o:/, "").trim(), icon: FileText });
                                } else {
                                  info.push({ label: "Observação", value: trimmed, icon: FileText });
                                }
                              }

                              return info.length > 0 ? (
                                <div
                                  className="rounded-xl p-3 space-y-2.5"
                                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
                                  data-testid={`bill-details-${bill.id}`}
                                >
                                  {info.map((item, i) => {
                                    const Icon = item.icon;
                                    return (
                                      <div key={i} className="flex gap-2.5">
                                        <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "rgba(255,255,255,0.3)" }} />
                                        <div className="min-w-0">
                                          <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "rgba(255,255,255,0.25)" }}>{item.label}</p>
                                          <p className="text-xs text-white/70 break-words whitespace-pre-wrap">{item.value}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null;
                            })()}

                            <div className="flex items-center gap-3 text-[11px] text-white/30">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" />
                                <span>Vence dia {bill.dueDay}</span>
                              </div>
                              {bill.categoryName && (
                                <div className="flex items-center gap-1.5">
                                  <Tag className="h-3 w-3" />
                                  <span>{bill.categoryName}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5">
                                <RotateCcw className="h-3 w-3" />
                                <span>{recLabel(bill.recurrenceType as RecurrenceType)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <DollarSign className="h-3 w-3" />
                                <span>{isExpense ? "A Pagar" : "A Receber"}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => togglePaidMutation.mutate({ bill, paid: !paid })}
                                disabled={togglePaidMutation.isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                                style={{
                                  background: paid ? "rgba(255,255,255,0.06)" : `${INCOME_COLOR}15`,
                                  border: `1px solid ${paid ? "rgba(255,255,255,0.09)" : `${INCOME_COLOR}30`}`,
                                  color: paid ? "rgba(255,255,255,0.4)" : INCOME_COLOR,
                                }}
                                data-testid={`button-toggle-paid-${bill.id}`}
                              >
                                {togglePaidMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : paid ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                                {paid ? "Desfazer pagamento" : "Marcar como pago"}
                              </button>
                              <div className="flex-1" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setEditingBill(bill); }}
                                className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                                data-testid={`button-edit-bill-${bill.id}`}
                              >
                                <Pencil className="h-3.5 w-3.5 text-white/30" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteMutation.mutate(bill.id)}
                                disabled={deleteMutation.isPending}
                                className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                                data-testid={`button-delete-bill-${bill.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" style={{ color: EXPENSE_COLOR }} />
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {allBills.filter(b => !b.active).length > 0 && (
        <p className="text-xs text-white/20 text-center">
          {allBills.filter(b => !b.active).length} conta(s) inativa(s) não exibida(s)
        </p>
      )}

      <AddBillModal open={showAdd} onClose={() => setShowAdd(false)} accent={accent} />
  {editingBill && (
    <EditBillModal bill={editingBill} onClose={() => setEditingBill(null)} accent={accent} />
  )}
    </div>
  );
}
