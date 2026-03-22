import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, Pencil, Power, PowerOff, Loader2, TrendingDown, TrendingUp, RotateCcw, Calendar, Tag, Check, Infinity, CalendarRange, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme, getModulePalette } from "@/components/theme-provider";
import { useCurrency } from "@/hooks/use-currency";
import type { Bill } from "@shared/schema";

type RecurrenceType = "permanent" | "this_month" | "three_months" | "custom";

interface Recurrence {
  type: RecurrenceType;
  endDate?: string;
}

function getEndDate(rec: Recurrence): Date {
  const now = new Date();
  if (rec.type === "this_month") return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  if (rec.type === "three_months") return new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
  if (rec.type === "custom" && rec.endDate) return new Date(rec.endDate);
  return new Date(now.getFullYear() + 20, now.getMonth(), now.getDate());
}

function getRecurrenceOpts(t: (k: string) => string): { type: RecurrenceType; label: string; icon: any }[] {
  return [
    { type: "permanent", label: t("axisFinance.permanent"), icon: Infinity },
    { type: "this_month", label: t("axisFinance.thisMonth"), icon: Calendar },
    { type: "three_months", label: t("axisFinance.threeMonths"), icon: CalendarRange },
    { type: "custom", label: t("axisFinance.periodCustom"), icon: CalendarDays },
  ];
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">
      {children}
    </p>
  );
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 transition-colors focus:border-white/20"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", ...((props as any).style) }}
    />
  );
}

function SectionDivider() {
  return <div className="h-px my-1" style={{ background: "rgba(255,255,255,0.05)" }} />;
}

function BillFormModal({
  open,
  onClose,
  initialBill,
}: {
  open: boolean;
  onClose: () => void;
  initialBill?: Bill;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { symbol } = useCurrency();
  const { theme: _t } = useTheme();
  const _MP = getModulePalette(_t as any);
  const EXPENSE_COLOR = _MP.negative;
  const INCOME_COLOR = _MP.positive;
  const isEdit = !!initialBill;
  const [form, setForm] = useState({
    title: initialBill?.title ?? "",
    amount: initialBill ? String(initialBill.amount) : "",
    type: (initialBill?.type ?? "expense") as "expense" | "income",
    dueDay: String(initialBill?.dueDay ?? "5"),
    categoryName: initialBill?.categoryName ?? "",
    notes: initialBill?.notes ?? "",
  });
  const [recurrence, setRecurrence] = useState<Recurrence>(() => {
    const rt = (initialBill?.recurrenceType ?? "permanent") as RecurrenceType;
    if (rt === "custom" && initialBill?.recurrenceEndDate) {
      return { type: "custom", endDate: new Date(initialBill.recurrenceEndDate).toISOString().split("T")[0] };
    }
    return { type: rt };
  });

  const accent = form.type === "expense" ? EXPENSE_COLOR : INCOME_COLOR;

  const mutation = useMutation({
    mutationFn: async () => {
      const endDate = recurrence.type !== "permanent" ? getEndDate(recurrence).toISOString() : undefined;
      const payload = {
        title: form.title.trim(),
        amount: parseFloat(form.amount),
        type: form.type,
        dueDay: parseInt(form.dueDay) || 5,
        categoryName: form.categoryName.trim() || undefined,
        recurrenceType: recurrence.type,
        recurrenceEndDate: endDate,
        notes: form.notes.trim() || undefined,
      };
      if (isEdit) {
        const res = await apiRequest("PATCH", `/api/bills/${initialBill!.id}`, payload);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/bills", { ...payload, active: true, paidMonths: "[]" });
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      onClose();
      toast({ title: isEdit ? t("axisFinance.billUpdateDone") : t("axisFinance.billAddDone") });
    },
    onError: (e: any) => toast({ title: isEdit ? t("axisFinance.billUpdateError") : t("axisFinance.billAddError"), description: e.message, variant: "destructive" }),
  });

  const canSave = form.title.trim().length > 0 && parseFloat(form.amount) > 0;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-md flex flex-col p-0 gap-0 overflow-hidden"
        style={{
          background: "#0d0d12",
          border: "1px solid rgba(255,255,255,0.08)",
          maxHeight: "88vh",
        }}
      >
        {/* Header fixo */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <DialogHeader>
            <DialogTitle className="text-white text-base font-semibold">
              {isEdit ? t("axisFinance.editBill") : t("axisFinance.newBill")}
            </DialogTitle>
          </DialogHeader>

          {/* Toggle de tipo — maior e mais limpo */}
          <div
            className="flex rounded-xl overflow-hidden mt-4"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "3px" }}
          >
            {([["expense", t("axisFinance.expenseLabel"), EXPENSE_COLOR], ["income", t("axisFinance.incomeLabel"), INCOME_COLOR]] as const).map(([val, label, color]) => (
              <button
                key={val}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: val }))}
                className="flex-1 py-2 text-sm font-semibold transition-all duration-200 rounded-lg"
                style={{
                  background: form.type === val ? `${color}20` : "transparent",
                  color: form.type === val ? color : "rgba(255,255,255,0.28)",
                  boxShadow: form.type === val ? `0 0 0 1px ${color}30` : "none",
                }}
                data-testid={`toggle-manage-bill-type-${val}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Área de campos — scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Descrição */}
          <div>
            <FieldLabel>{t("axisFinance.descriptionLabel")}</FieldLabel>
            <FieldInput
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t("axisFinance.billTitlePlaceholder")}
              data-testid="input-manage-bill-title"
            />
          </div>

          <SectionDivider />

          {/* Valor */}
          <div>
            <FieldLabel>{t("axisFinance.amountLabel")}</FieldLabel>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <span className="text-white/35 text-sm font-semibold select-none">{symbol}</span>
              <input
                type="number"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder={t("axisFinance.amountPlaceholder")}
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20 font-medium"
                data-testid="input-manage-bill-amount"
              />
            </div>
          </div>

          <SectionDivider />

          {/* Dia de vencimento + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>{t("axisFinance.dueDay")}</FieldLabel>
              <div className="relative">
                <FieldInput
                  type="number"
                  min="1"
                  max="31"
                  value={form.dueDay}
                  onChange={e => setForm(f => ({ ...f, dueDay: e.target.value }))}
                  data-testid="input-manage-bill-due-day"
                />
              </div>
            </div>
            <div>
              <FieldLabel>{t("axisFinance.categoryLabel")}</FieldLabel>
              <FieldInput
                value={form.categoryName}
                onChange={e => setForm(f => ({ ...f, categoryName: e.target.value }))}
                placeholder={t("axisFinance.billCategoryPlaceholder")}
                data-testid="input-manage-bill-category"
              />
            </div>
          </div>

          <SectionDivider />

          {/* Recorrência */}
          <div>
            <FieldLabel>{t("axisFinance.recurrence")}</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {getRecurrenceOpts(t).map(opt => {
                const Icon = opt.icon;
                const active = recurrence.type === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => setRecurrence({ type: opt.type })}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: active ? `${accent}18` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${active ? `${accent}40` : "rgba(255,255,255,0.08)"}`,
                      color: active ? accent : "rgba(255,255,255,0.4)",
                    }}
                    data-testid={`recurrence-${opt.type}`}
                  >
                    <Icon className="h-3 w-3" />{opt.label}
                  </button>
                );
              })}
            </div>
            {recurrence.type === "custom" && (
              <div className="mt-2.5">
                <p className="text-[11px] text-white/30 mb-1.5">{t("axisFinance.recCustomSub")}</p>
                <input
                  type="date"
                  value={recurrence.endDate || ""}
                  onChange={e => setRecurrence({ type: "custom", endDate: e.target.value })}
                  className="rounded-xl px-3 py-2.5 text-sm text-white outline-none w-full"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                />
              </div>
            )}
          </div>

          <SectionDivider />

          {/* Observações */}
          <div>
            <FieldLabel>
              {t("axisFinance.notes")} <span className="normal-case font-normal text-white/20">({t("axisFinance.descriptionOptional").toLowerCase()})</span>
            </FieldLabel>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={t("axisFinance.notes") + "..."}
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
              data-testid="input-manage-bill-notes"
            />
          </div>
        </div>

        {/* Footer fixo com botão de submit — sempre visível */}
        <div
          className="flex-shrink-0 px-6 pb-6 pt-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSave}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]"
            style={{ background: accent, color: "#060608" }}
            data-testid="button-submit-manage-bill"
          >
            {mutation.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Check className="h-4 w-4" />}
            {mutation.isPending
              ? t("axisFinance.save") + "..."
              : isEdit ? t("axisFinance.saveChanges") : t("axisFinance.registerBill")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ManageBillsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { fmtMoney } = useCurrency();
  const { toast } = useToast();
  const { theme: _t2 } = useTheme();
  const _MP2 = getModulePalette(_t2 as any);
  const EXPENSE_COLOR = _MP2.negative;
  const INCOME_COLOR = _MP2.positive;
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "expense" | "income">("all");

  const { data: bills = [], isLoading } = useQuery<Bill[]>({
    queryKey: ["/api/bills"],
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ bill, active }: { bill: Bill; active: boolean }) => {
      const res = await apiRequest("PATCH", `/api/bills/${bill.id}`, { active });
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

  const filtered = bills.filter(b => filterType === "all" || b.type === filterType);
  const expenses = filtered.filter(b => b.type === "expense");
  const incomes = filtered.filter(b => b.type === "income");

  const activeCount = bills.filter(b => b.active).length;
  const inactiveCount = bills.filter(b => !b.active).length;

  function BillRow({ bill }: { bill: Bill }) {
    const isExpense = bill.type === "expense";
    const color = isExpense ? EXPENSE_COLOR : INCOME_COLOR;

    return (
      <div
        className="rounded-2xl p-4 transition-colors"
        style={{
          background: bill.active ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)",
          border: `1px solid ${bill.active ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)"}`,
        }}
        data-testid={`manage-bill-row-${bill.id}`}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5"
            style={{ background: `${color}12` }}
          >
            {isExpense
              ? <TrendingDown className="h-4 w-4" style={{ color }} />
              : <TrendingUp className="h-4 w-4" style={{ color }} />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="text-sm font-semibold text-white truncate"
                style={{ opacity: bill.active ? 1 : 0.4 }}
              >
                {bill.title}
              </span>
              {!bill.active && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}
                >
                  {t("axisFinance.inactive")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="text-base font-bold"
                style={{ color, opacity: bill.active ? 1 : 0.4 }}
              >
                {fmtMoney(Number(bill.amount))}
              </span>
              <div className="flex items-center gap-1 text-[11px] text-white/30">
                <Calendar className="h-3 w-3" />
                <span>{t("axisAgenda.dueDay", { day: bill.dueDay })}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-white/30">
                <RotateCcw className="h-3 w-3" />
                <span>{getRecurrenceOpts(t).find(o => o.type === (bill.recurrenceType ?? "permanent"))?.label}</span>
              </div>
              {bill.categoryName && (
                <div className="flex items-center gap-1 text-[11px] text-white/30">
                  <Tag className="h-3 w-3" />
                  <span>{bill.categoryName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Ações — agrupadas com separação visual clara */}
          <div
            className="flex items-center gap-0.5 flex-shrink-0 rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              type="button"
              onClick={() => setEditingBill(bill)}
              className="p-2 transition-colors hover:bg-white/6"
              title={t("common.edit")}
              data-testid={`button-manage-edit-${bill.id}`}
            >
              <Pencil className="h-3.5 w-3.5 text-white/35" />
            </button>
            <div className="w-px h-4 self-center" style={{ background: "rgba(255,255,255,0.07)" }} />
            <button
              type="button"
              onClick={() => toggleActiveMutation.mutate({ bill, active: !bill.active })}
              disabled={toggleActiveMutation.isPending}
              className="p-2 transition-colors hover:bg-white/6"
              title={bill.active ? t("axisFinance.deactivateBill") : t("axisFinance.reactivateBill")}
              data-testid={`button-manage-toggle-active-${bill.id}`}
            >
              {bill.active
                ? <PowerOff className="h-3.5 w-3.5" style={{ color: "rgba(255,200,0,0.55)" }} />
                : <Power className="h-3.5 w-3.5" style={{ color: "rgba(0,229,200,0.55)" }} />}
            </button>
            <div className="w-px h-4 self-center" style={{ background: "rgba(255,255,255,0.07)" }} />
            <button
              type="button"
              onClick={() => deleteMutation.mutate(bill.id)}
              disabled={deleteMutation.isPending}
              className="p-2 transition-colors hover:bg-red-500/10"
              title={t("common.delete")}
              data-testid={`button-manage-delete-${bill.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" style={{ color: EXPENSE_COLOR }} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
        <DialogContent
          className="max-w-lg flex flex-col p-0 gap-0 overflow-hidden"
          style={{
            background: "#0d0d12",
            border: "1px solid rgba(255,255,255,0.08)",
            maxHeight: "85vh",
          }}
        >
          {/* Header fixo — só o título, X nativo fica isolado */}
          <div
            className="flex-shrink-0 px-6 pt-6 pb-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <DialogHeader>
              <DialogTitle className="text-white text-base font-semibold">
                {t("axisFinance.manageBills")}
              </DialogTitle>
            </DialogHeader>

            {/* Filtros de tipo */}
            <div className="flex gap-1 mt-4">
              {([["all", t("axisFinance.filterAll")], ["expense", t("axisFinance.expenseLabel")], ["income", t("axisFinance.incomeLabel")]] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilterType(id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: filterType === id ? "rgba(255,255,255,0.09)" : "transparent",
                    color: filterType === id ? "white" : "rgba(255,255,255,0.35)",
                    border: `1px solid ${filterType === id ? "rgba(255,255,255,0.12)" : "transparent"}`,
                  }}
                  data-testid={`filter-manage-bills-${id}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Lista scrollável */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <RotateCcw className="h-5 w-5 text-white/20" />
                </div>
                <p className="text-sm text-white/30 mb-1">{t("axisFinance.noBillsRegistered")}</p>
                <p className="text-xs text-white/18">{t("axisFinance.noBillsHint")}</p>
              </div>
            )}

            {expenses.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <TrendingDown className="h-3.5 w-3.5" style={{ color: EXPENSE_COLOR }} />
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: EXPENSE_COLOR }}
                  >
                    {t("axisFinance.toPay")}
                  </span>
                  <span className="text-[11px] text-white/25">({expenses.length})</span>
                </div>
                {expenses.map(bill => <BillRow key={bill.id} bill={bill} />)}
              </div>
            )}

            {incomes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <TrendingUp className="h-3.5 w-3.5" style={{ color: INCOME_COLOR }} />
                  <span
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: INCOME_COLOR }}
                  >
                    {t("axisFinance.toReceive")}
                  </span>
                  <span className="text-[11px] text-white/25">({incomes.length})</span>
                </div>
                {incomes.map(bill => <BillRow key={bill.id} bill={bill} />)}
              </div>
            )}
          </div>

          {/* Footer fixo — resumo + botão Nova conta */}
          <div
            className="flex-shrink-0 flex items-center justify-between px-6 py-4"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-[11px] text-white/25">
              {t("axisFinance.billsActiveSummary", { active: activeCount, inactive: inactiveCount })}
            </p>
            <button
              onClick={() => setAddingNew(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
              style={{
                background: "rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.75)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              data-testid="button-manage-add-bill"
            >
              <Plus className="h-4 w-4" />
              {t("axisFinance.registerBill")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {(editingBill || addingNew) && (
        <BillFormModal
          open={true}
          onClose={() => { setEditingBill(null); setAddingNew(false); }}
          initialBill={editingBill ?? undefined}
        />
      )}
    </>
  );
}
