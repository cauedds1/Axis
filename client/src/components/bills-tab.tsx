import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Check, X, TrendingDown, TrendingUp, DollarSign, AlertCircle, Clock, CheckCircle, Infinity, Calendar, CalendarRange, CalendarDays, Loader2, ChevronDown, ChevronUp, Store, User, CreditCard, FileText, Tag, RotateCcw, Pencil } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme, getPrimaryHex, getModulePalette } from "@/components/theme-provider";
import type { Bill, Transaction, CreditCard as CreditCardType, RecurringIncome } from "@shared/schema";

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

function recLabel(type: RecurrenceType, t: (k: string) => string): string {
  if (type === "permanent") return t("axisFinance.permanent");
  if (type === "this_month") return t("axisFinance.thisMonth");
  if (type === "three_months") return t("axisFinance.threeMonths");
  return t("axisFinance.periodCustom");
}

function isBillActiveInMonth(bill: Bill, y: number, m: number): boolean {
  if (!bill.active) return false;

  // axiscard-future bills: use the monthKey in notes as the single source of
  // truth for which month they belong to — never rely on createdAt, which may
  // have been stored as midnight UTC and shifted by client timezone.
  if (bill.notes?.startsWith("axiscard-future:")) {
    const parts = bill.notes.split(":");
    const [yearStr, monthStr] = parts[2].split("-");
    return y === parseInt(yearStr) && m === parseInt(monthStr) - 1;
  }

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

type PeriodFilter = "current" | "last" | "next" | "custom";

function getMonthsForPeriod(period: PeriodFilter, customStart?: string, customEnd?: string): Array<{ y: number; m: number }> {
  const now = new Date();
  const months: Array<{ y: number; m: number }> = [];

  if (period === "current") {
    months.push({ y: now.getFullYear(), m: now.getMonth() });
  } else if (period === "last") {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth() });
  } else if (period === "next") {
    const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth() });
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

function getPeriodLabel(period: PeriodFilter, months: Array<{ y: number; m: number }>, lang = "en-US"): string {
  if (months.length === 0) {
    const now = new Date();
    return now.toLocaleString(lang, { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
  }
  if (months.length === 1) {
    const d = new Date(months[0].y, months[0].m, 1);
    return d.toLocaleString(lang, { month: "long", year: "numeric" }).replace(/^\w/, c => c.toUpperCase());
  }
  const first = new Date(months[months.length - 1].y, months[months.length - 1].m, 1);
  const last = new Date(months[0].y, months[0].m, 1);
  const f = first.toLocaleString(lang, { month: "short", year: "numeric" });
  const l = last.toLocaleString(lang, { month: "short", year: "numeric" });
  return `${f} — ${l}`;
}

function getRecurrenceOptions(t: (k: string) => string): { type: RecurrenceType; label: string; sub: string; icon: any }[] {
  return [
    { type: "permanent", label: t("axisFinance.permanent"), sub: t("axisFinance.recPermanentSub"), icon: Infinity },
    { type: "this_month", label: t("axisFinance.thisMonth"), sub: t("axisFinance.recThisMonthSub"), icon: Calendar },
    { type: "three_months", label: t("axisFinance.threeMonths"), sub: t("axisFinance.rec3MonthsSub"), icon: CalendarRange },
    { type: "custom", label: t("axisFinance.periodCustom"), sub: t("axisFinance.recCustomSub"), icon: CalendarDays },
  ];
}

function RecurrenceSelector({ value, onChange, accent }: { value: Recurrence; onChange: (r: Recurrence) => void; accent: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.recurrence")}</p>
      <div className="grid grid-cols-2 gap-2">
        {getRecurrenceOptions(t).map(opt => {
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
  const { theme: _theme } = useTheme();
  const _MP = getModulePalette(_theme as any);
  const EXPENSE_COLOR = _MP.negative;
  const INCOME_COLOR = _MP.positive;
  const { toast } = useToast();
  const { t } = useTranslation();
  const { symbol } = useCurrency();
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
      toast({ title: t("axisFinance.billRegistered") });
    },
    onError: (e: any) => toast({ title: t("axisFinance.billSaveError"), description: e.message, variant: "destructive" }),
  });

  const canSave = form.title.trim().length > 0 && parseFloat(form.amount) > 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" style={{ background: "#0d0d12", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white">{t("axisFinance.newBill")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Type toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {([["expense", t("axisFinance.toBePaid"), EXPENSE_COLOR], ["income", t("axisFinance.toBeReceived"), INCOME_COLOR]] as const).map(([val, label, color]) => (
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

          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.descriptionLabel")}</p>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t("axisFinance.billDescPlaceholder")}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              data-testid="input-bill-title"
            />
          </div>

          {/* Amount */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.amountLabel")}</p>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-white/40 text-sm font-medium">{symbol}</span>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
                data-testid="input-bill-amount"
              />
            </div>
          </div>

          {/* Due day + Category */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.dueDay")}</p>
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
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.categoryLabel")}</p>
              <input
                value={form.categoryName}
                onChange={e => setForm(f => ({ ...f, categoryName: e.target.value }))}
                placeholder={t("axisFinance.categoryPlaceholder2")}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                data-testid="input-bill-category"
              />
            </div>
          </div>

          {/* Recurrence */}
          <RecurrenceSelector value={recurrence} onChange={setRecurrence} accent={form.type === "expense" ? EXPENSE_COLOR : INCOME_COLOR} />

          {/* Notes */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.notesOptional")}</p>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={t("axisFinance.notesBillPlaceholder")}
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
            {mutation.isPending ? t("axisFinance.saving") : t("axisFinance.registerBill")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditBillModal({ bill, onClose, accent }: { bill: Bill; onClose: () => void; accent: string }) {
  const { theme: _theme } = useTheme();
  const _MP = getModulePalette(_theme as any);
  const EXPENSE_COLOR = _MP.negative;
  const INCOME_COLOR = _MP.positive;
  const { toast } = useToast();
  const { t } = useTranslation();
  const { symbol } = useCurrency();
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
        recurrenceEndDate: endDate,
        notes: form.notes.trim() || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      onClose();
      toast({ title: t("axisFinance.billUpdated") });
    },
    onError: (e: any) => toast({ title: t("axisFinance.billUpdateError"), description: e.message, variant: "destructive" }),
  });

  const canSave = form.title.trim().length > 0 && parseFloat(form.amount) > 0;
  const billAccent = form.type === "expense" ? EXPENSE_COLOR : INCOME_COLOR;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" style={{ background: "#0d0d12", border: "1px solid rgba(255,255,255,0.08)" }}>
        <DialogHeader>
          <DialogTitle className="text-white">{t("axisFinance.editBill")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {([["expense", t("axisFinance.toBePaid"), EXPENSE_COLOR], ["income", t("axisFinance.toBeReceived"), INCOME_COLOR]] as const).map(([val, label, color]) => (
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
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.descriptionLabel")}</p>
            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t("axisFinance.billDescEditPlaceholder")}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              data-testid="input-edit-bill-title"
            />
          </div>

          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.amountLabel")}</p>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-white/40 text-sm font-medium">{symbol}</span>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
                data-testid="input-edit-bill-amount"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.dueDay")}</p>
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
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.categoryLabel")}</p>
              <input
                value={form.categoryName}
                onChange={e => setForm(f => ({ ...f, categoryName: e.target.value }))}
                placeholder={t("axisFinance.categoryPlaceholder2")}
                className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                data-testid="input-edit-bill-category"
              />
            </div>
          </div>

          <RecurrenceSelector value={recurrence} onChange={setRecurrence} accent={billAccent} />

          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisFinance.notesOptional")}</p>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={t("axisFinance.notesBillPlaceholder")}
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
            {mutation.isPending ? t("axisFinance.saving") : t("axisFinance.saveChanges")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function getPeriodOpts(t: (k: string) => string): { id: PeriodFilter; label: string }[] {
  return [
    { id: "current", label: t("axisFinance.periodCurrent") },
    { id: "last",    label: t("axisFinance.periodLast") },
    { id: "next",    label: t("axisFinance.periodNextMonth") },
    { id: "custom",  label: t("axisFinance.periodCustom") },
  ];
}

export function BillsTab() {
  const { theme } = useTheme();
  const accent = getPrimaryHex(theme);
  const MP = getModulePalette(theme as any);
  const EXPENSE_COLOR = MP.negative;
  const INCOME_COLOR = MP.positive;
  const { toast } = useToast();
  const { t, i18n } = useTranslation();
  const { fmtMoney } = useCurrency();
  const [showAdd, setShowAdd] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "paid" | "overdue">("all");
  const [filterPeriod, setFilterPeriod] = useState<PeriodFilter>("current");
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: rawBills = [], isLoading } = useQuery<Bill[]>({ queryKey: ["/api/bills"] });
  const allBills = rawBills;
  const { data: allTransactions = [] } = useQuery<Transaction[]>({ queryKey: ["/api/transactions"] });
  const { data: creditCards = [] } = useQuery<CreditCardType[]>({ queryKey: ["/api/credit-cards"] });
  const { data: recurringIncomes = [] } = useQuery<RecurringIncome[]>({ queryKey: ["/api/recurring-incomes"] });

  const lang = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
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
    onError: () => toast({ title: t("axisFinance.billUpdateError"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/bills/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      toast({ title: t("axisFinance.billDeleteDone") });
    },
    onError: () => toast({ title: t("axisFinance.billDeleteError"), variant: "destructive" }),
  });

  const activeBills = allBills.filter(b => isBillActiveInRange(b, periodMonths));

  const unpaidExpenses = activeBills.filter(b => b.type === "expense" && !isBillPaidInAllMonths(b, periodMonths));
  const unpaidIncomes = activeBills.filter(b => b.type === "income" && !isBillPaidInAllMonths(b, periodMonths));
  const totalPagar = unpaidExpenses.reduce((s, b) => s + b.amount * Math.max(1, periodMonths.filter(({ y, m }) => isBillActiveInMonth(b, y, m) && !isBillPaidInMonth(b, y, m)).length), 0);
  const totalReceber = unpaidIncomes.reduce((s, b) => s + b.amount * Math.max(1, periodMonths.filter(({ y, m }) => isBillActiveInMonth(b, y, m) && !isBillPaidInMonth(b, y, m)).length), 0);
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

  const now2 = new Date();

  // Compute projected upcoming invoice per credit card (before the invoice closes)
  const projectedCardInvoices = creditCards
    .filter(card => card.active)
    .map(card => {
      const todayDay = now2.getDate();
      const thisYear = now2.getFullYear();
      const thisMonthIdx = now2.getMonth();
      const pastClosing = todayDay >= card.closingDay;

      // Open cycle date range
      const cycleStart = pastClosing
        ? new Date(thisYear, thisMonthIdx, card.closingDay + 1)
        : new Date(thisYear, thisMonthIdx, 1);
      const cycleEnd = pastClosing
        ? new Date(thisYear, thisMonthIdx + 1, card.closingDay, 23, 59, 59)
        : new Date(thisYear, thisMonthIdx, card.closingDay, 23, 59, 59);

      const openCycleTotal = allTransactions
        .filter(tx => tx.creditCardId === card.id && tx.type === "expense")
        .filter(tx => { const d = new Date(tx.date!); return d >= cycleStart && d <= cycleEnd; })
        .reduce((s, tx) => s + tx.amount, 0);

      // Determine the due month for the upcoming invoice
      // Invoice closes: not pastClosing → this month's closingDay; pastClosing → next month's closingDay
      const closingMonthIdx = pastClosing ? thisMonthIdx + 1 : thisMonthIdx;
      const closingYear2 = thisYear + (closingMonthIdx > 11 ? 1 : 0);
      const closingMonthNorm = closingMonthIdx % 12;
      // Due is same month as closing if dueDay > closingDay, otherwise next month
      let dueYear: number, dueMonthIdx: number;
      if (card.dueDay > card.closingDay) {
        dueYear = closingYear2; dueMonthIdx = closingMonthNorm;
      } else {
        dueYear = closingMonthNorm === 11 ? closingYear2 + 1 : closingYear2;
        dueMonthIdx = (closingMonthNorm + 1) % 12;
      }

      // Show the projected invoice in the CLOSING month (not the due month).
      // e.g. Mercado Pago closes May 28 → appears in May, even though due June 4.
      const showInPeriod = periodMonths.some(({ y, m }) => y === closingYear2 && m === closingMonthNorm);
      return { card, openCycleTotal, dueYear, dueMonthIdx, showInPeriod };
    })
    .filter(p => p.showInPeriod && p.openCycleTotal > 0);

  const projectedInvoiceTotal = projectedCardInvoices.reduce((s, p) => s + p.openCycleTotal, 0);

  // For each axiscard-future bill, compute installment transactions that land in that
  // card's closing cycle for the target month. These are parcelada purchases registered
  // after the base invoice was scheduled — they must be added to the displayed amount.
  const cardFutureExtras = new Map<string, number>();
  activeBills
    .filter(b => b.notes?.startsWith("axiscard-future:"))
    .forEach(b => {
      const parts = b.notes!.split(":");
      const cardId = parseInt(parts[1]);
      const [yearStr, monthStr] = parts[2].split("-");
      const cycleYear = parseInt(yearStr);
      const cycleMonthIdx = parseInt(monthStr) - 1; // 0-indexed
      const card = creditCards.find(c => c.id === cardId);
      if (!card) return;
      // Cycle: previous month's (closingDay+1) → this month's closingDay
      // new Date with month=-1 correctly wraps to Dec of previous year in JS
      const cycleStart = new Date(cycleYear, cycleMonthIdx - 1, card.closingDay + 1);
      const cycleEnd = new Date(cycleYear, cycleMonthIdx, card.closingDay, 23, 59, 59);
      const extra = allTransactions
        .filter(tx => tx.creditCardId === cardId && tx.type === "expense")
        .filter(tx => { const d = new Date(tx.date!); return d >= cycleStart && d <= cycleEnd; })
        .reduce((s, tx) => s + tx.amount, 0);
      if (extra > 0) cardFutureExtras.set(b.id, extra);
    });
  const totalCardFutureExtras = Array.from(cardFutureExtras.values()).reduce((s, v) => s + v, 0);

  const totalPagar2 = totalPagar + projectedInvoiceTotal + totalCardFutureExtras;

  // Recurring incomes (salary, freelance, etc.) — active ones expected every month in the period
  const activeRecurringIncomes = recurringIncomes.filter(r => r.active);
  const totalRendaRecorrente = activeRecurringIncomes.reduce((s, r) => s + r.amount, 0) * periodMonths.length;

  // Projected balance = all income sources (income bills + recurring incomes) minus expenses
  const totalReceberTotal = totalReceber + totalRendaRecorrente;
  const saldoPrevisto = totalReceberTotal - totalPagar2;

  const todayMidnight = new Date(now2.getFullYear(), now2.getMonth(), now2.getDate());
  const overdueProjectedInvoices = projectedCardInvoices.filter(p => {
    const dueDate = new Date(p.dueYear, p.dueMonthIdx, p.card.dueDay);
    return dueDate < todayMidnight;
  });
  const showProjectedInvoices = filterType !== "income" && filterStatus !== "paid" && filterStatus !== "overdue";

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
          <h2 className="text-lg font-bold text-white">{t("axisFinance.billsTitle")}</h2>
          <p className="text-xs text-white/35 mt-0.5">
            {getPeriodLabel(filterPeriod, periodMonths, lang)}
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150"
          style={{ background: `${accent}18`, border: `1px solid ${accent}30`, color: accent }}
          data-testid="button-add-bill"
        >
          <Plus className="h-4 w-4" /> {t("axisFinance.newBill")}
        </button>
      </div>

      {/* Period filter */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          {getPeriodOpts(t).map(opt => {
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
            <span className="text-xs text-white/40 font-medium">{t("axisFinance.customFrom")}</span>
            <input
              type="date"
              data-testid="input-bill-custom-start"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="text-xs border border-white/10 rounded-lg px-2 py-1.5 bg-transparent text-white outline-none focus:ring-1 focus:ring-white/20"
            />
            <span className="text-xs text-white/40 font-medium">{t("axisFinance.customTo")}</span>
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
        <SummaryCard label={t("axisFinance.toBePaid")} value={fmtMoney(totalPagar2)} sub={`${unpaidExpenses.length + projectedCardInvoices.length} ${t("axisFinance.billsCount")}`} accent={EXPENSE_COLOR} icon={TrendingDown} />
        <SummaryCard
          label={t("axisFinance.toBeReceived")}
          value={fmtMoney(totalReceberTotal)}
          sub={activeRecurringIncomes.length > 0
            ? `${unpaidIncomes.length} ${t("axisFinance.billsCount")} + ${activeRecurringIncomes.length} renda${activeRecurringIncomes.length > 1 ? "s" : ""}`
            : `${unpaidIncomes.length} ${t("axisFinance.billsCount")}`}
          accent={INCOME_COLOR}
          icon={TrendingUp}
        />
        <SummaryCard label={t("axisFinance.projectedBalance")} value={fmtMoney(saldoPrevisto)} accent={saldoPrevisto >= 0 ? INCOME_COLOR : EXPENSE_COLOR} icon={DollarSign} />
        <SummaryCard label={t("axisFinance.overdue")} value={`${vencidas.length + overdueProjectedInvoices.length}`} sub={(vencidas.length + overdueProjectedInvoices.length) > 0 ? fmtMoney(vencidas.reduce((s, b) => s + b.amount, 0) + overdueProjectedInvoices.reduce((s, p) => s + p.openCycleTotal, 0)) : undefined} accent={(vencidas.length + overdueProjectedInvoices.length) > 0 ? EXPENSE_COLOR : "rgba(255,255,255,0.3)"} icon={AlertCircle} />
        {isSingleCurrentMonth ? (
          <SummaryCard label={t("axisFinance.next7Days")} value={`${proximos7.length}`} sub={proximos7.length > 0 ? fmtMoney(proximos7.reduce((s, b) => s + b.amount, 0)) : undefined} accent={proximos7.length > 0 ? MP.agenda : "rgba(255,255,255,0.3)"} icon={Clock} />
        ) : (
          <SummaryCard label={t("axisFinance.totalBills")} value={`${activeBills.length}`} sub={t("axisFinance.inPeriod")} accent="rgba(255,255,255,0.5)" icon={Clock} />
        )}
        <SummaryCard label={isSingleCurrentMonth ? t("axisFinance.paidThisMonth") : t("axisFinance.paidInPeriod")} value={fmtMoney(totalPagoMes)} sub={`${pagoMes.length} ${t("axisFinance.itemsCount")}`} accent={INCOME_COLOR} icon={CheckCircle} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {PILL(t("axisFinance.filterAll"), filterType === "all", () => setFilterType("all"))}
        {PILL(t("axisFinance.toBePaid"), filterType === "expense", () => setFilterType("expense"), EXPENSE_COLOR)}
        {PILL(t("axisFinance.toBeReceived"), filterType === "income", () => setFilterType("income"), INCOME_COLOR)}
        <div className="w-px bg-white/10 self-stretch mx-1" />
        {PILL(t("axisFinance.filterAllStatus"), filterStatus === "all", () => setFilterStatus("all"))}
        {PILL(t("axisFinance.filterPending"), filterStatus === "pending", () => setFilterStatus("pending"))}
        {PILL(t("axisFinance.filterPaid"), filterStatus === "paid", () => setFilterStatus("paid"), INCOME_COLOR)}
        {PILL(t("axisFinance.overdue"), filterStatus === "overdue", () => setFilterStatus("overdue"), EXPENSE_COLOR)}
      </div>

      {/* Bills list */}
      {isLoading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-white/30" /></div>
      ) : filtered.length === 0 && !(showProjectedInvoices && projectedCardInvoices.length > 0) ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-16 flex flex-col items-center gap-4 text-center"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <DollarSign className="h-8 w-8 text-white/20" />
          </div>
          <div>
            <p className="text-white/50 font-medium">{t("axisFinance.noBillsRegistered")}</p>
            <p className="text-white/25 text-sm mt-1">{t("axisFinance.noBillsHint")}</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: `${accent}18`, border: `1px solid ${accent}30`, color: accent }}
            data-testid="button-add-first-bill"
          >
            <Plus className="h-4 w-4" /> {t("axisFinance.registerFirstBill")}
          </button>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map(bill => {
              const isCardFuture = bill.notes?.startsWith("axiscard-future:");
              const paid = isBillPaidThisMonth(bill);
              const overdue = isBillOverdue(bill);
              const isExpense = bill.type === "expense";
              const rowAccent = isExpense ? EXPENSE_COLOR : INCOME_COLOR;
              const expanded = expandedId === bill.id;
              const today = new Date().getDate();
              const daysUntilDue = bill.dueDay - today;
              const isUpcomingSoon = !paid && !overdue && daysUntilDue >= 0 && daysUntilDue <= 5;
              const WARN_COLOR = MP.agenda;
              const statusColor = paid ? INCOME_COLOR : overdue ? EXPENSE_COLOR : isUpcomingSoon ? WARN_COLOR : "rgba(255,255,255,0.25)";
              const statusLabel = paid ? t("axisFinance.paid") : overdue ? t("axisFinance.overdue") : isUpcomingSoon ? (daysUntilDue === 0 ? t("axisFinance.duesToday") : t("axisFinance.duesInDays", { count: daysUntilDue })) : t("axisFinance.dueDayDisplay", { day: bill.dueDay });

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
                            {isCardFuture ? <CreditCard className="h-4 w-4" style={{ color: rowAccent }} /> : isExpense ? <TrendingDown className="h-4 w-4" style={{ color: rowAccent }} /> : <TrendingUp className="h-4 w-4" style={{ color: rowAccent }} />}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold truncate ${paid ? "line-through text-white/40" : "text-white"}`}>{bill.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {bill.categoryName && <span className="text-[10px] text-white/30">{bill.categoryName}</span>}
                              {isCardFuture
                                ? <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: `${EXPENSE_COLOR}15`, color: EXPENSE_COLOR }}>Fatura agendada</span>
                                : <span className="text-[10px] font-medium" style={{ color: statusColor }}>{statusLabel}</span>
                              }
                              {!isCardFuture && <span className="text-[10px] text-white/20">{recLabel(bill.recurrenceType as RecurrenceType, t)}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-base font-bold" style={{ color: paid ? "rgba(255,255,255,0.3)" : rowAccent }}>
                            {isExpense ? "-" : "+"}{fmtMoney(isCardFuture ? bill.amount + (cardFutureExtras.get(bill.id) ?? 0) : bill.amount)}
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
                            {!isCardFuture && bill.notes && (() => {
                              const lines = bill.notes.split("\n");
                              const info: { label: string; value: string; icon: any }[] = [];
                              for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed) continue;
                                if (trimmed.startsWith("Emissor:") || trimmed.startsWith("Issuer:")) {
                                  info.push({ label: t("axisFinance.issuer"), value: trimmed.replace(/^(Emissor|Issuer):/, "").trim(), icon: Store });
                                } else if (trimmed.startsWith("Destinatário:") || trimmed.startsWith("Destinatario:") || trimmed.startsWith("Recipient:")) {
                                  info.push({ label: t("axisFinance.recipient"), value: trimmed.replace(/^(Destinat[áa]rio|Recipient):/, "").trim(), icon: User });
                                } else if (trimmed.startsWith("Pagamento:") || trimmed.startsWith("Payment:")) {
                                  info.push({ label: t("axisFinance.paymentData"), value: trimmed.replace(/^(Pagamento|Payment):/, "").trim(), icon: CreditCard });
                                } else if (trimmed.startsWith("Descrição:") || trimmed.startsWith("Descricao:") || trimmed.startsWith("Description:")) {
                                  info.push({ label: t("axisFinance.serviceProduct"), value: trimmed.replace(/^(Descri[çc][ãa]o|Description):/, "").trim(), icon: FileText });
                                } else {
                                  info.push({ label: t("axisFinance.observation"), value: trimmed, icon: FileText });
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
                                <span>{t("axisFinance.dueDayDisplay", { day: bill.dueDay })}</span>
                              </div>
                              {bill.categoryName && (
                                <div className="flex items-center gap-1.5">
                                  <Tag className="h-3 w-3" />
                                  <span>{bill.categoryName}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5">
                                <RotateCcw className="h-3 w-3" />
                                <span>{recLabel(bill.recurrenceType as RecurrenceType, t)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <DollarSign className="h-3 w-3" />
                                <span>{isExpense ? t("axisFinance.toBePaid") : t("axisFinance.toBeReceived")}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {!isCardFuture && (
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
                                  {paid ? t("axisFinance.undoPayment") : t("axisFinance.markAsPaid")}
                                </button>
                              )}
                              {isCardFuture && (
                                <div className="space-y-1">
                                  {(cardFutureExtras.get(bill.id) ?? 0) > 0 && (
                                    <div className="rounded-lg p-2.5 space-y-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                      <div className="flex justify-between text-[11px]">
                                        <span className="text-white/40">Fatura agendada</span>
                                        <span className="text-white/50">-{fmtMoney(bill.amount)}</span>
                                      </div>
                                      <div className="flex justify-between text-[11px]">
                                        <span className="text-white/40">+ Parcelas registradas</span>
                                        <span style={{ color: EXPENSE_COLOR }}>-{fmtMoney(cardFutureExtras.get(bill.id)!)}</span>
                                      </div>
                                      <div className="flex justify-between text-[11px] font-semibold pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                                        <span className="text-white/60">Total estimado</span>
                                        <span className="text-white/80">-{fmtMoney(bill.amount + cardFutureExtras.get(bill.id)!)}</span>
                                      </div>
                                    </div>
                                  )}
                                  <p className="text-[11px] text-white/25 italic flex items-center gap-1">
                                    <CreditCard className="h-3 w-3" /> Gerenciado pelo cartão
                                  </p>
                                </div>
                              )}
                              <div className="flex-1" />
                              {!isCardFuture && (
                                <>
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
                                </>
                              )}
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
          {showProjectedInvoices && projectedCardInvoices.map(({ card, openCycleTotal, dueYear, dueMonthIdx }) => {
            const dueLabel = new Date(dueYear, dueMonthIdx, card.dueDay).toLocaleString(lang, { day: "numeric", month: "short", year: "numeric" });
            return (
              <motion.div
                key={`projected-${card.id}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${EXPENSE_COLOR}20` }}
                data-testid={`card-projected-invoice-${card.id}`}
              >
                <div className="flex">
                  <div className="w-1 shrink-0 rounded-l-2xl" style={{ background: EXPENSE_COLOR }} />
                  <div className="flex-1 px-4 py-3 flex items-center gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${EXPENSE_COLOR}12` }}>
                      <CreditCard className="h-4 w-4" style={{ color: EXPENSE_COLOR }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate text-white">{t("axisFinance.invoiceOf", { name: card.name })}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-white/30">{card.bank || card.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ background: `${EXPENSE_COLOR}15`, color: EXPENSE_COLOR }}>
                          {t("axisFinance.estimatedLabel")}
                        </span>
                        <span className="text-[10px] font-medium" style={{ color: MP.agenda }}>{dueLabel}</span>
                      </div>
                    </div>
                    <span className="text-base font-bold shrink-0" style={{ color: EXPENSE_COLOR }}>
                      -{fmtMoney(openCycleTotal)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {allBills.filter(b => !b.active).length > 0 && (
        <p className="text-xs text-white/20 text-center">
          {t("axisFinance.inactiveBillsCount", { count: allBills.filter(b => !b.active).length })}
        </p>
      )}

      <AddBillModal open={showAdd} onClose={() => setShowAdd(false)} accent={accent} />
  {editingBill && (
    <EditBillModal bill={editingBill} onClose={() => setEditingBill(null)} accent={accent} />
  )}
    </div>
  );
}
