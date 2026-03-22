import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  CreditCard, Plus, Trash2, Loader2, Calendar, AlertCircle,
  Pencil, Check, X, ShoppingCart, TrendingUp, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditTransactionDialog } from "@/components/edit-transaction-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme, getModulePalette } from "@/components/theme-provider";
import { useCurrency } from "@/hooks/use-currency";

function getInvoiceMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function daysUntilClosing(closingDay: number): number {
  const now = new Date();
  const today = now.getDate();
  if (today < closingDay) return closingDay - today;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, closingDay);
  return Math.ceil((nextMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const CARD_COLORS = [
  "#7C3AED", "#2563EB", "#059669", "#DC2626", "#D97706", "#DB2777", "#0891B2", "#374151",
];

const CATEGORIES = [
  "Alimentação", "Mercado", "Combustível", "Saúde", "Farmácia", "Lazer",
  "Roupas", "Eletrônicos", "Educação", "Transporte", "Assinaturas", "Outros",
];

interface CardFormData {
  name: string;
  bank: string;
  limit: string;
  closingDay: string;
  dueDay: string;
  color: string;
}

const EMPTY_FORM: CardFormData = { name: "", bank: "", limit: "", closingDay: "", dueDay: "", color: "#7C3AED" };

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">{children}</p>;
}

function FieldInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
    />
  );
}

function Divider() {
  return <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />;
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/40">{icon}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">{children}</span>
    </div>
  );
}

/* ─── Card Detail Panel ──────────────────────────────────────────────────── */
function CardDetailSheet({
  card,
  onClose,
  onDelete,
}: {
  card: any;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const { toast } = useToast();
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const { fmtMoney, symbol } = useCurrency();
  const lang = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
  const CATEGORY_LABELS: Record<string, string> = {
    "Alimentação": t("axisFinance.ccCatFood"),
    "Mercado": t("axisFinance.ccCatGrocery"),
    "Combustível": t("axisFinance.ccCatFuel"),
    "Saúde": t("axisFinance.ccCatHealth"),
    "Farmácia": t("axisFinance.ccCatPharmacy"),
    "Lazer": t("axisFinance.ccCatLeisure"),
    "Roupas": t("axisFinance.ccCatClothing"),
    "Eletrônicos": t("axisFinance.ccCatElectronics"),
    "Educação": t("axisFinance.ccCatEducation"),
    "Transporte": t("axisFinance.ccCatTransport"),
    "Assinaturas": t("axisFinance.ccCatSubscription"),
    "Outros": t("axisFinance.ccCatOther"),
  };
  const MP = getModulePalette(theme as any);
  const NEGATIVE = MP.negative;
  const POSITIVE = MP.positive;

  const cardColor = card.color || "#7C3AED";
  const currentMonthKey = getInvoiceMonthKey();

  // Tabs: overview, purchase, history
  const [tab, setTab] = useState<"overview" | "purchase" | "invoice">("overview");

  // Edit transaction
  const [editingTx, setEditingTx] = useState<any>(null);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: card.name,
    bank: card.bank,
    limit: String(card.limit),
    closingDay: String(card.closingDay),
    dueDay: String(card.dueDay),
    color: card.color || "#7C3AED",
  });

  // Purchase form
  const [purchase, setPurchase] = useState({
    description: "",
    amount: "",
    installments: "1",
    categoryName: "",
    establishment: "",
    date: new Date().toISOString().split("T")[0],
  });

  const { data: invoiceData, isLoading: invoiceLoading } = useQuery<any>({
    queryKey: ["/api/credit-cards", card.id, "invoices"],
    queryFn: async () => {
      const res = await fetch(`/api/credit-cards/${card.id}/invoices`, { credentials: "include" });
      return res.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/credit-cards/${card.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards"] });
      setEditing(false);
      toast({ title: t("axisFinance.cardUpdated") });
    },
    onError: () => toast({ title: t("axisFinance.cardUpdateError"), variant: "destructive" }),
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      const installments = parseInt(purchase.installments) || 1;
      const payload: any = {
        amount: parseFloat(purchase.amount),
        description: purchase.description.trim() || purchase.establishment.trim() || t("axisFinance.purchase"),
        type: "expense",
        date: purchase.date,
        categoryName: purchase.categoryName || undefined,
        establishment: purchase.establishment.trim() || undefined,
        creditCardId: card.id,
        installments,
      };
      const res = await apiRequest("POST", "/api/transactions", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards", card.id, "invoices"] });
      setPurchase({ description: "", amount: "", installments: "1", categoryName: "", establishment: "", date: new Date().toISOString().split("T")[0] });
      toast({ title: t("axisFinance.purchaseAdded") });
      setTab("overview");
    },
    onError: () => toast({ title: t("axisFinance.purchaseError"), variant: "destructive" }),
  });

  function handleSaveEdit() {
    const limitNum = parseFloat(editForm.limit);
    const closingNum = parseInt(editForm.closingDay);
    const dueNum = parseInt(editForm.dueDay);
    if (!editForm.name || !editForm.bank || isNaN(limitNum) || isNaN(closingNum) || isNaN(dueNum)) {
      toast({ title: t("axisFinance.fillAllFields"), variant: "destructive" });
      return;
    }
    updateMutation.mutate({
      name: editForm.name,
      bank: editForm.bank,
      limit: limitNum,
      closingDay: closingNum,
      dueDay: dueNum,
      color: editForm.color,
    });
  }

  // Limit history
  let limitHistory: Array<{ date: string; limit: number }> = [];
  try { limitHistory = card.limitHistory ? JSON.parse(card.limitHistory) : []; } catch {}

  const daysLeft = daysUntilClosing(card.closingDay);

  // Current month invoice
  const currentInvoice = invoiceData?.invoices?.find((i: any) => i.monthKey === currentMonthKey);
  const currentTx: any[] = currentInvoice?.transactions ?? (invoiceData?.openTransactions ?? []);
  const computedUsed = currentTx.reduce((s: number, t: any) => s + Number(t.amount), 0);
  const displayUsed = invoiceData ? computedUsed : (card.usedThisMonth ?? 0);

  const pct = Math.min(100, displayUsed / Math.max(card.limit, 1) * 100);
  const isHigh = pct > 80;
  const available = Math.max(0, card.limit - displayUsed);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#0a0a0f" }}
    >
      {/* ── Card Header ── */}
      <div
        className="flex-shrink-0 relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${cardColor}22 0%, ${cardColor}08 100%)`,
          borderBottom: `1px solid ${cardColor}25`,
        }}
      >
        {/* top accent bar */}
        <div className="h-1 w-full" style={{ background: cardColor }} />

        <div className="px-5 pt-4 pb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-lg font-bold text-white leading-tight">{card.name}</p>
              <p className="text-sm text-white/45 mt-0.5">{card.bank}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setEditing(!editing); setTab("overview"); }}
                className="p-2 rounded-xl transition-colors hover:bg-white/8"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                data-testid="button-edit-card"
              >
                <Pencil className="h-3.5 w-3.5 text-white/50" />
              </button>
              <button
                onClick={() => onDelete(card.id)}
                className="p-2 rounded-xl transition-colors hover:bg-red-500/15"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                data-testid="button-delete-card-panel"
              >
                <Trash2 className="h-3.5 w-3.5 text-white/40" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl transition-colors hover:bg-white/8"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <X className="h-3.5 w-3.5 text-white/50" />
              </button>
            </div>
          </div>

          {/* Limit numbers */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: t("axisFinance.cardLimit"), value: card.limit, color: "text-white" },
              { label: t("axisFinance.cardUsed"), value: card.usedThisMonth ?? 0, color: isHigh ? "text-red-400" : "text-white" },
              { label: t("axisFinance.cardAvailable"), value: available, color: "text-emerald-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-2.5 text-center" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-sm font-bold ${color}`}>{fmtMoney(value)}</p>
              </div>
            ))}
          </div>

          {/* Limit bar */}
          <div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, background: isHigh ? "#ef4444" : cardColor }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-white/30">{pct.toFixed(0)}% {t("axisFinance.cardUsedPct")}</p>
              <p className="text-[10px] text-white/30">
                {isHigh
                  ? <span className="text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3 inline" /> {t("axisFinance.highUsage")}</span>
                  : t("axisFinance.closesInDays", { count: daysLeft })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-[11px] text-white/30 flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {t("axisFinance.closesDay", { day: card.closingDay })}
            </span>
            <span className="text-white/15">·</span>
            <span className="text-[11px] text-white/30">{t("axisFinance.dueDayDisplay", { day: card.dueDay })}</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-5 gap-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {([
            ["overview", t("axisFinance.tabInvoice"), null],
            ["purchase", t("axisFinance.tabRegisterPurchase"), null],
            ["invoice", t("axisFinance.tabHistory"), null],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setTab(id); setEditing(false); }}
              className="flex-1 py-3 text-xs font-semibold transition-all relative"
              style={{ color: tab === id ? cardColor : "rgba(255,255,255,0.3)" }}
              data-testid={`tab-card-${id}`}
            >
              {label}
              {tab === id && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                  style={{ background: cardColor }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Edit mode overlay ── */}
        {editing && (
          <div className="px-5 py-5 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <SectionTitle icon={<Pencil className="h-3.5 w-3.5" />}>{t("axisFinance.editCard")}</SectionTitle>
              <button onClick={() => setEditing(false)} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <FieldLabel>{t("axisFinance.cardName")}</FieldLabel>
              <FieldInput value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder={t("axisFinance.cardNamePlaceholder")} data-testid="input-edit-card-name" />
            </div>
            <div>
              <FieldLabel>{t("axisFinance.cardBank")}</FieldLabel>
              <FieldInput value={editForm.bank} onChange={e => setEditForm(f => ({ ...f, bank: e.target.value }))} placeholder={t("axisFinance.cardBankPlaceholder")} data-testid="input-edit-card-bank" />
            </div>
            <div>
              <FieldLabel>{t("axisFinance.cardLimitLabel")}</FieldLabel>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <span className="text-white/35 text-sm font-semibold">{symbol}</span>
                <input type="number" step="0.01" value={editForm.limit} onChange={e => setEditForm(f => ({ ...f, limit: e.target.value }))}
                  placeholder="0.00" className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
                  data-testid="input-edit-card-limit" />
              </div>
              {limitHistory.length > 0 && (
                <p className="text-[10px] text-white/25 mt-1.5">
                  {t("axisFinance.prevLimit")}: {fmtMoney(limitHistory[limitHistory.length - 1]?.limit ?? card.limit)}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>{t("axisFinance.closingDay")}</FieldLabel>
                <div className="relative">
                  <FieldInput type="number" min="1" max="31" value={editForm.closingDay} onChange={e => setEditForm(f => ({ ...f, closingDay: e.target.value }))} data-testid="input-edit-card-closing" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/25 pointer-events-none">{t("axisFinance.dayLabel")}</span>
                </div>
              </div>
              <div>
                <FieldLabel>{t("axisFinance.dueDay")}</FieldLabel>
                <div className="relative">
                  <FieldInput type="number" min="1" max="31" value={editForm.dueDay} onChange={e => setEditForm(f => ({ ...f, dueDay: e.target.value }))} data-testid="input-edit-card-due" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/25 pointer-events-none">{t("axisFinance.dayLabel")}</span>
                </div>
              </div>
            </div>
            <div>
              <FieldLabel>{t("axisFinance.cardColor")}</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                {CARD_COLORS.map(color => (
                  <button key={color} type="button"
                    onClick={() => setEditForm(f => ({ ...f, color }))}
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{ background: color, borderColor: editForm.color === color ? "white" : "transparent" }}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]"
              style={{ background: cardColor, color: "#060608" }}
              data-testid="button-save-card-edit"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {updateMutation.isPending ? t("axisFinance.saving") : t("axisFinance.saveChanges")}
            </button>
          </div>
        )}

        {/* ── Tab: Fatura (overview) ── */}
        {!editing && tab === "overview" && (
          <div className="px-5 py-5 space-y-5">

            {/* Current invoice status */}
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between mb-3">
                <SectionTitle icon={<Calendar className="h-3.5 w-3.5" />}>{t("axisFinance.currentInvoice")}</SectionTitle>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-lg"
                  style={{ background: "rgba(234,179,8,0.12)", color: "#eab308" }}
                >
                  {t("axisFinance.invoiceOpen")}
                </span>
              </div>
              <p className="text-2xl font-bold text-white mb-0.5">{fmtMoney(displayUsed)}</p>
              <p className="text-[11px] text-white/30">{t("axisFinance.closesDay", { day: card.closingDay })} · {t("axisFinance.dueDayDisplay", { day: card.dueDay })}</p>
            </div>

            {/* Transactions */}
            {invoiceLoading && (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-white/30" /></div>
            )}

            {!invoiceLoading && currentTx.length === 0 && (
              <div className="text-center py-8">
                <ShoppingCart className="h-8 w-8 text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/30">{t("axisFinance.noPurchasesInvoice")}</p>
                <button
                  onClick={() => setTab("purchase")}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                  style={{ background: `${cardColor}18`, color: cardColor, border: `1px solid ${cardColor}30` }}
                >
                  {t("axisFinance.tabRegisterPurchase")}
                </button>
              </div>
            )}

            {currentTx.length > 0 && (
              <div className="space-y-2">
                <SectionTitle icon={<ShoppingCart className="h-3.5 w-3.5" />}>{t("axisFinance.monthPurchases")}</SectionTitle>
                {currentTx.map((tx: any) => {
                  let badge: string | null = null;
                  try {
                    const info = JSON.parse(tx.installmentInfo || "null");
                    if (info) badge = `${info.current}/${info.total}`;
                  } catch {}
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-xl px-4 py-3"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                      data-testid={`card-tx-${tx.id}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{tx.description}</p>
                        <p className="text-[11px] text-white/35">
                          {new Date(tx.date).toLocaleDateString(lang)}
                          {tx.categoryName && ` · ${tx.categoryName}`}
                          {tx.establishment && ` · ${tx.establishment}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {badge && (
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: `${cardColor}20`, color: cardColor }}
                          >
                            {badge}
                          </span>
                        )}
                        <span className="text-sm font-bold text-red-400">{fmtMoney(tx.amount)}</span>
                        <button
                          onClick={() => setEditingTx(tx)}
                          className="p-1 rounded opacity-30 hover:opacity-80 transition-opacity"
                          data-testid={`button-edit-card-tx-${tx.id}`}
                          title={t("axisFinance.editTransaction")}
                        >
                          <Pencil className="h-3.5 w-3.5 text-white" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Past invoices */}
            {!invoiceLoading && invoiceData?.invoices && invoiceData.invoices.filter((i: any) => i.monthKey !== currentMonthKey).length > 0 && (
              <div className="space-y-2">
                <SectionTitle icon={<Calendar className="h-3.5 w-3.5" />}>{t("axisFinance.pastInvoices")}</SectionTitle>
                {invoiceData.invoices
                  .filter((i: any) => i.monthKey !== currentMonthKey)
                  .map((inv: any) => {
                    const [y, m] = inv.monthKey.split("-");
                    const label = new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString(lang, { month: "long", year: "numeric" });
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between rounded-xl px-4 py-3"
                        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                        data-testid={`invoice-past-${inv.monthKey}`}
                      >
                        <div>
                          <p className="text-sm font-medium text-white capitalize">{label}</p>
                          <p className="text-[11px]" style={{ color: inv.status === "paid" ? "#22c55e" : inv.status === "closed" ? "#60a5fa" : "#eab308" }}>
                            {inv.status === "paid" ? t("axisFinance.invoicePaid") : inv.status === "closed" ? t("axisFinance.invoiceClosed") : t("axisFinance.invoiceOpen")}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-white">{fmtMoney(inv.total)}</p>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Registrar compra ── */}
        {!editing && tab === "purchase" && (
          <div className="px-5 py-5 space-y-4">
            <SectionTitle icon={<ShoppingCart className="h-3.5 w-3.5" />}>{t("axisFinance.newPurchaseCard")}</SectionTitle>

            {/* Amount */}
            <div>
              <FieldLabel>{t("axisFinance.amountLabel")}</FieldLabel>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <span className="text-white/35 text-sm font-semibold">{symbol}</span>
                <input
                  type="number"
                  step="0.01"
                  value={purchase.amount}
                  onChange={e => setPurchase(p => ({ ...p, amount: e.target.value }))}
                  placeholder={t("axisFinance.amountPlaceholder")}
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20 font-medium"
                  data-testid="input-purchase-amount"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <FieldLabel>{t("axisFinance.descriptionLabel")}</FieldLabel>
              <FieldInput
                value={purchase.description}
                onChange={e => setPurchase(p => ({ ...p, description: e.target.value }))}
                placeholder={t("axisFinance.purchaseDescPlaceholder")}
                data-testid="input-purchase-description"
              />
            </div>

            {/* Establishment */}
            <div>
              <FieldLabel>{t("axisFinance.establishmentLabel")}</FieldLabel>
              <FieldInput
                value={purchase.establishment}
                onChange={e => setPurchase(p => ({ ...p, establishment: e.target.value }))}
                placeholder={t("axisFinance.establishmentPlaceholder")}
                data-testid="input-purchase-establishment"
              />
            </div>

            {/* Installments */}
            <div>
              <FieldLabel>{t("axisFinance.installmentsLabel")}</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                {["1", "2", "3", "4", "5", "6", "10", "12", "18", "24"].map(n => {
                  const active = purchase.installments === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPurchase(p => ({ ...p, installments: n }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: active ? `${cardColor}20` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? `${cardColor}40` : "rgba(255,255,255,0.08)"}`,
                        color: active ? cardColor : "rgba(255,255,255,0.4)",
                      }}
                      data-testid={`installments-${n}`}
                    >
                      {n === "1" ? t("axisFinance.inCashLabel") : `${n}x`}
                    </button>
                  );
                })}
              </div>
              {parseInt(purchase.installments) > 1 && parseFloat(purchase.amount) > 0 && (
                <p className="text-[11px] text-white/35 mt-2">
                  {purchase.installments}x {t("axisFinance.ofAmount")} {fmtMoney(parseFloat(purchase.amount) / parseInt(purchase.installments))}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <FieldLabel>{t("axisFinance.categoryLabel")}</FieldLabel>
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map(cat => {
                  const active = purchase.categoryName === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setPurchase(p => ({ ...p, categoryName: active ? "" : cat }))}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: active ? `${cardColor}20` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? `${cardColor}40` : "rgba(255,255,255,0.07)"}`,
                        color: active ? cardColor : "rgba(255,255,255,0.4)",
                      }}
                      data-testid={`category-${cat}`}
                    >
                      {CATEGORY_LABELS[cat] ?? cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date */}
            <div>
              <FieldLabel>{t("axisFinance.purchaseDateLabel")}</FieldLabel>
              <FieldInput
                type="date"
                value={purchase.date}
                onChange={e => setPurchase(p => ({ ...p, date: e.target.value }))}
                data-testid="input-purchase-date"
              />
            </div>

            <div className="pt-2">
              <button
                onClick={() => purchaseMutation.mutate()}
                disabled={purchaseMutation.isPending || !purchase.amount || parseFloat(purchase.amount) <= 0}
                className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]"
                style={{ background: cardColor, color: "#060608" }}
                data-testid="button-submit-purchase"
              >
                {purchaseMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Check className="h-4 w-4" />}
                {purchaseMutation.isPending
                  ? t("axisFinance.registering")
                  : parseInt(purchase.installments) > 1 ? t("axisFinance.registerInInstallments", { n: purchase.installments }) : t("axisFinance.registerPurchase")}
              </button>
            </div>
          </div>
        )}

        {/* ── Tab: Histórico de limite ── */}
        {!editing && tab === "invoice" && (
          <div className="px-5 py-5 space-y-5">
            <SectionTitle icon={<TrendingUp className="h-3.5 w-3.5" />}>{t("axisFinance.limitEvolution")}</SectionTitle>

            {limitHistory.length === 0 && (
              <div className="text-center py-8">
                <TrendingUp className="h-8 w-8 text-white/15 mx-auto mb-2" />
                <p className="text-sm text-white/30">{t("axisFinance.noLimitHistory")}</p>
                <p className="text-[11px] text-white/20 mt-1">{t("axisFinance.noLimitHistoryHint")}</p>
              </div>
            )}

            {limitHistory.length > 0 && (
              <div className="space-y-0">
                {limitHistory.map((entry, i) => {
                  const prev = limitHistory[i - 1];
                  const isIncrease = prev ? entry.limit > prev.limit : null;
                  const diff = prev ? Math.abs(entry.limit - prev.limit) : 0;
                  return (
                    <div key={i} className="relative flex items-start gap-4 pb-5">
                      {/* Timeline line */}
                      {i < limitHistory.length - 1 && (
                        <div className="absolute left-[15px] top-8 bottom-0 w-px" style={{ background: "rgba(255,255,255,0.07)" }} />
                      )}
                      {/* Dot */}
                      <div
                        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5"
                        style={{
                          background: isIncrease === null ? `${cardColor}20` : isIncrease ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                          border: `1px solid ${isIncrease === null ? `${cardColor}40` : isIncrease ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                        }}
                      >
                        {isIncrease === null
                          ? <CreditCard className="h-3.5 w-3.5" style={{ color: cardColor }} />
                          : isIncrease
                            ? <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                            : <ArrowDownRight className="h-3.5 w-3.5 text-red-400" />}
                      </div>
                      {/* Content */}
                      <div className="flex-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-white">{fmtMoney(entry.limit)}</p>
                          {prev && (
                            <span
                              className="text-[11px] font-semibold"
                              style={{ color: isIncrease ? "#22c55e" : "#ef4444" }}
                            >
                              {isIncrease ? "+" : "-"}{fmtMoney(diff)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/30 mt-0.5">
                          {new Date(entry.date).toLocaleDateString(lang, { day: "2-digit", month: "long", year: "numeric" })}
                          {isIncrease === null && ` · ${t("axisFinance.initialLimit")}`}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Current (if not in history) */}
                {limitHistory[limitHistory.length - 1]?.limit !== card.limit && (
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${cardColor}20`, border: `1px solid ${cardColor}40` }}>
                      <CreditCard className="h-3.5 w-3.5" style={{ color: cardColor }} />
                    </div>
                    <div className="flex-1 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-sm font-bold text-white">{fmtMoney(card.limit)}</p>
                      <p className="text-[11px] text-white/30 mt-0.5">{t("axisFinance.currentLimit")}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <EditTransactionDialog transaction={editingTx} onClose={() => setEditingTx(null)} />
    </div>
  );
}

/* ─── Main Tab ───────────────────────────────────────────────────────────── */
export function CreditCardsTab() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { fmtMoney, symbol } = useCurrency();
  const MP = getModulePalette(theme as any);

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CardFormData>(EMPTY_FORM);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);

  const { data: cards = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/credit-cards"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/credit-cards", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards"] });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      toast({ title: t("axisFinance.cardAdded") });
    },
    onError: () => toast({ title: t("axisFinance.cardAddError"), variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/credit-cards/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credit-cards"] });
      setDeleteCardId(null);
      setSelectedCardId(null);
      toast({ title: t("axisFinance.cardRemoved") });
    },
    onError: () => toast({ title: t("axisFinance.cardRemoveError"), variant: "destructive" }),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const limitNum = parseFloat(form.limit);
    const closingNum = parseInt(form.closingDay);
    const dueNum = parseInt(form.dueDay);
    if (!form.name || !form.bank || isNaN(limitNum) || isNaN(closingNum) || isNaN(dueNum)) {
      toast({ title: t("axisFinance.fillAllFields"), variant: "destructive" });
      return;
    }
    createMutation.mutate({ name: form.name, bank: form.bank, limit: limitNum, closingDay: closingNum, dueDay: dueNum, color: form.color });
  }

  const currentMonthKey = getInvoiceMonthKey();
  const selectedCard = selectedCardId ? cards.find((c: any) => c.id === selectedCardId) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{t("axisFinance.tapCardToManage")}</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.09)" }}
          data-testid="button-add-credit-card"
        >
          <Plus className="h-3.5 w-3.5" /> {t("axisFinance.add")}
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      )}

      {!isLoading && cards.length === 0 && (
        <div
          className="rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px dashed rgba(255,255,255,0.1)" }}
        >
          <CreditCard className="h-10 w-10 text-white/15" />
          <div>
            <p className="font-semibold text-sm text-white/60">{t("axisFinance.noCardsRegistered")}</p>
            <p className="text-xs text-white/30 mt-1">{t("axisFinance.noCardsHint")}</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all mt-1"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.09)" }}
            data-testid="button-add-credit-card-empty"
          >
            <Plus className="h-3.5 w-3.5" /> {t("axisFinance.addCard")}
          </button>
        </div>
      )}

      {/* Card list — each card is clickable */}
      <div className="space-y-3">
        {cards.map((card: any) => {
          const pct = Math.min(100, (card.usedThisMonth ?? 0) / Math.max(card.limit, 1) * 100);
          const isHigh = pct > 80;
          const available = Math.max(0, card.limit - (card.usedThisMonth ?? 0));
          const daysLeft = daysUntilClosing(card.closingDay);
          const cardColor = card.color || "#7C3AED";

          return (
            <button
              key={card.id}
              type="button"
              className="w-full text-left rounded-2xl overflow-hidden transition-all active:scale-[0.98] hover:brightness-110"
              style={{
                background: `linear-gradient(135deg, ${cardColor}18 0%, rgba(255,255,255,0.025) 100%)`,
                border: `1px solid ${cardColor}25`,
              }}
              onClick={() => setSelectedCardId(card.id)}
              data-testid={`card-credit-${card.id}`}
            >
              {/* Color bar */}
              <div className="h-1 w-full" style={{ background: cardColor }} />

              <div className="px-4 py-4">
                {/* Name + bank + pct */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-sm text-white leading-tight">{card.name}</p>
                    <p className="text-xs text-white/40 mt-0.5">{card.bank}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isHigh && <AlertCircle className="h-4 w-4 text-red-400" />}
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-lg"
                      style={{ background: isHigh ? "rgba(239,68,68,0.15)" : `${cardColor}15`, color: isHigh ? "#ef4444" : cardColor }}
                    >
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {/* Three columns */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: t("axisFinance.cardLimit"), value: card.limit, color: "text-white" },
                    { label: t("axisFinance.cardUsed"), value: card.usedThisMonth ?? 0, color: isHigh ? "text-red-400" : "text-white" },
                    { label: t("axisFinance.cardAvailable"), value: available, color: "text-emerald-400" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className="text-[9px] text-white/30 uppercase tracking-wide">{label}</p>
                      <p className={`text-xs font-bold mt-0.5 ${color}`}>{fmtMoney(value)}</p>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, background: isHigh ? "#ef4444" : cardColor }}
                  />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] text-white/25 flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> {t("axisFinance.closesDay", { day: card.closingDay })} · {t("axisFinance.dueDayDisplay", { day: card.dueDay })}
                  </span>
                  <span className="text-[10px] text-white/25">
                    {isHigh ? <span className="text-red-400">{t("axisFinance.highLimit")}</span> : t("axisFinance.daysToClose", { count: daysLeft })}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Card Detail Sheet ── */}
      <Sheet open={!!selectedCard} onOpenChange={(o) => { if (!o) setSelectedCardId(null); }}>
        <SheetContent
          side="right"
          className="p-0 w-full sm:max-w-md border-l-0"
          style={{ background: "#0a0a0f", borderLeft: "1px solid rgba(255,255,255,0.07)" }}
        >
          {selectedCard && (
            <CardDetailSheet
              card={selectedCard}
              onClose={() => setSelectedCardId(null)}
              onDelete={(id) => { setDeleteCardId(id); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add card dialog ── */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) setForm(EMPTY_FORM); }}>
        <DialogContent
          className="max-w-md flex flex-col p-0 gap-0 overflow-hidden"
          style={{ background: "#0d0d12", border: "1px solid rgba(255,255,255,0.08)", maxHeight: "88vh" }}
        >
          <div className="flex-shrink-0 px-6 pt-6 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <DialogHeader>
              <DialogTitle className="text-white text-base font-semibold">{t("axisFinance.newCreditCard")}</DialogTitle>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4" data-testid="form-add-credit-card">
            <div>
              <FieldLabel>{t("axisFinance.cardName")}</FieldLabel>
              <FieldInput placeholder={t("axisFinance.cardNamePlaceholderLong")} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} data-testid="input-card-name" />
            </div>
            <div>
              <FieldLabel>{t("axisFinance.cardBank")}</FieldLabel>
              <FieldInput placeholder={t("axisFinance.cardBankPlaceholderLong")} value={form.bank} onChange={e => setForm(p => ({ ...p, bank: e.target.value }))} data-testid="input-card-bank" />
            </div>
            <div>
              <FieldLabel>{t("axisFinance.cardLimitLabel")}</FieldLabel>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
                <span className="text-white/35 text-sm font-semibold">{symbol}</span>
                <input type="number" step="0.01" value={form.limit} onChange={e => setForm(p => ({ ...p, limit: e.target.value }))} placeholder="5000.00" className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20" data-testid="input-card-limit" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>{t("axisFinance.closingDay")}</FieldLabel>
                <div className="relative">
                  <FieldInput type="number" min={1} max={31} placeholder="15" value={form.closingDay} onChange={e => setForm(p => ({ ...p, closingDay: e.target.value }))} data-testid="input-card-closing-day" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/25 pointer-events-none">{t("axisFinance.dayLabel")}</span>
                </div>
              </div>
              <div>
                <FieldLabel>{t("axisFinance.dueDay")}</FieldLabel>
                <div className="relative">
                  <FieldInput type="number" min={1} max={31} placeholder="22" value={form.dueDay} onChange={e => setForm(p => ({ ...p, dueDay: e.target.value }))} data-testid="input-card-due-day" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-white/25 pointer-events-none">{t("axisFinance.dayLabel")}</span>
                </div>
              </div>
            </div>
            <div>
              <FieldLabel>{t("axisFinance.cardColor")}</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                {CARD_COLORS.map(color => (
                  <button key={color} type="button" onClick={() => setForm(p => ({ ...p, color }))}
                    className="h-7 w-7 rounded-full border-2 transition-all"
                    style={{ background: color, borderColor: form.color === color ? "white" : "transparent" }}
                    data-testid={`button-card-color-${color}`}
                  />
                ))}
              </div>
            </div>
          </form>

          <div className="flex-shrink-0 px-6 pb-6 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
            <button
              type="button"
              onClick={handleSubmit as any}
              disabled={createMutation.isPending}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[0.98]"
              style={{ background: form.color, color: "#060608" }}
              data-testid="button-submit-credit-card"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {createMutation.isPending ? t("axisFinance.adding") : t("axisFinance.addCard")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteCardId} onOpenChange={(o) => { if (!o) setDeleteCardId(null); }}>
        <AlertDialogContent data-testid="dialog-confirm-delete-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("axisFinance.removeCardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("axisFinance.removeCardDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-card">{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteCardId) deleteMutation.mutate(deleteCardId); }}
              data-testid="button-confirm-delete-card"
            >
              {t("common.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
