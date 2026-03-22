import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCurrency } from "@/hooks/use-currency";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme, getPrimaryHex } from "@/components/theme-provider";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Infinity,
  Calendar,
  CalendarRange,
  CalendarDays,
  Loader2,
  Check,
  Trash2,
  DollarSign,
  ClipboardList,
  Clock,
  ChevronRight,
  ChevronDown,
  Plus,
  Bell,
  Mail,
  MessageCircle,
  Wifi,
  WifiOff,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

const MINT = "#4ECDC4";
const LAVANDA = "#A78BFA";
const CORAL = "#FF6B6B";

type Tab = "renda" | "gastos" | "rotina" | "notificacoes" | "whatsapp";

type RecurrenceType = "permanent" | "this_month" | "three_months" | "custom";
interface Recurrence {
  type: RecurrenceType;
  endDate?: string;
}

function getEndDate(rec: Recurrence): Date {
  const now = new Date();
  if (rec.type === "permanent") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }
  if (rec.type === "this_month") {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  }
  if (rec.type === "three_months") {
    const d = new Date(now);
    d.setMonth(d.getMonth() + 3);
    return d;
  }
  if (rec.type === "custom" && rec.endDate) {
    return new Date(rec.endDate);
  }
  return new Date(now.getFullYear(), now.getMonth() + 1, 0);
}

interface RecurrenceSelectorProps {
  value: Recurrence;
  onChange: (r: Recurrence) => void;
  accentColor: string;
}

function RecurrenceSelector({ value, onChange, accentColor }: RecurrenceSelectorProps) {
  const { t } = useTranslation();

  const RECURRENCE_OPTIONS: { type: RecurrenceType; label: string; sub: string; icon: any }[] = [
    { type: "permanent", label: t("axisSetup.recurrence.permanent"), sub: t("axisSetup.recurrence.permanentSub"), icon: Infinity },
    { type: "this_month", label: t("axisSetup.recurrence.thisMonth"), sub: t("axisSetup.recurrence.thisMonthSub"), icon: Calendar },
    { type: "three_months", label: t("axisSetup.recurrence.threeMonths"), sub: t("axisSetup.recurrence.threeMonthsSub"), icon: CalendarRange },
    { type: "custom", label: t("axisSetup.recurrence.custom"), sub: t("axisSetup.recurrence.customSub"), icon: CalendarDays },
  ];

  return (
    <div>
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{t("axisSetup.recurrence.label")}</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        {RECURRENCE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = value.type === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => onChange({ ...value, type: opt.type })}
              className="flex items-start gap-2.5 p-3 rounded-xl text-left transition-all duration-150"
              style={{
                background: isActive ? `${accentColor}0F` : "rgba(255,255,255,0.03)",
                border: `1px solid ${isActive ? `${accentColor}35` : "rgba(255,255,255,0.07)"}`,
              }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: isActive ? `${accentColor}18` : "rgba(255,255,255,0.05)" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: isActive ? accentColor : "rgba(255,255,255,0.3)" }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: isActive ? "white" : "rgba(255,255,255,0.5)" }}>
                  {opt.label}
                </p>
                <p className="text-[10px]" style={{ color: isActive ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)" }}>
                  {opt.sub}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <AnimatePresence>
        {value.type === "custom" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <input
              type="date"
              value={value.endDate || ""}
              min={new Date().toISOString().split("T")[0]}
              onChange={e => onChange({ ...value, endDate: e.target.value })}
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", colorScheme: "dark" }}
              data-testid="input-recurrence-custom-date"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{children}</p>
  );
}

function StyledInput({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl px-3 py-2.5 text-sm text-white bg-transparent outline-none placeholder:text-white/20"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
    />
  );
}

interface RecurringIncome {
  id: string;
  userId: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  active: boolean;
  lastPostedMonth: string | null;
  createdAt: string;
}

function SectionRenda({
  savedIncome,
  onSave,
}: {
  savedIncome: string;
  onSave: (v: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { symbol, fmtMoney } = useCurrency();
  const lang = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
  const [val, setVal] = useState(savedIncome);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  const [riName, setRiName] = useState("");
  const [riAmount, setRiAmount] = useState("");
  const [riDay, setRiDay] = useState("5");
  const [riCategory, setRiCategory] = useState("trabalho");
  const [riCategoryOpen, setRiCategoryOpen] = useState(false);
  const [riCustomCategory, setRiCustomCategory] = useState("");
  const riCategoryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!riCategoryOpen) return;
    const handler = (e: MouseEvent) => {
      if (riCategoryRef.current && !riCategoryRef.current.contains(e.target as Node)) {
        setRiCategoryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [riCategoryOpen]);

  const currentMonth = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  })();

  const { data: recurringIncomes = [], isLoading: riLoading } = useQuery<RecurringIncome[]>({
    queryKey: ["/api/recurring-incomes"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!val || isNaN(parseFloat(val))) throw new Error(t("axisSetup.errorInvalidValue"));
      await apiRequest("POST", "/api/onboarding/setup", {
        currentIncome: parseFloat(val),
        fixedExpenses: null,
        routine: null,
      });
    },
    onSuccess: () => {
      onSave(val);
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/setup/status"] });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: () => {
      toast({ title: t("axisSetup.income.errorSave"), variant: "destructive" });
    },
  });

  const addRIMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(riAmount.replace(",", "."));
      const day = parseInt(riDay);
      if (!riName.trim() || isNaN(amt) || amt <= 0) throw new Error(t("axisSetup.income.errorFillNameAndValue"));
      if (day < 1 || day > 31) throw new Error(t("axisSetup.errorInvalidDay"));
      const finalCategory = riCategory === "outros" ? (riCustomCategory.trim() || "outros") : riCategory;
      await apiRequest("POST", "/api/recurring-incomes", { name: riName.trim(), amount: amt, dayOfMonth: day, active: true, categoryName: finalCategory });
    },
    onSuccess: () => {
      setRiName("");
      setRiAmount("");
      setRiDay("5");
      setRiCategory("trabalho");
      setRiCustomCategory("");
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-incomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: t("axisSetup.income.added") });
    },
    onError: (e: any) => {
      toast({ title: e.message || t("axisSetup.income.errorAdd"), variant: "destructive" });
    },
  });

  const deleteRIMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/recurring-incomes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-incomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: () => {
      toast({ title: t("axisSetup.income.errorDelete"), variant: "destructive" });
    },
  });

  const totalRecurring = recurringIncomes.filter(r => r.active).reduce((s, r) => s + r.amount, 0);

  const riCategoryOptions = [
    { value: "trabalho", label: t("axisSetup.income.catWork") },
    { value: "freelance", label: t("axisSetup.income.catFreelance") },
    { value: "investimentos", label: t("axisSetup.income.catInvestments") },
    { value: "aluguel", label: t("axisSetup.income.catRent") },
    { value: "outros", label: t("axisSetup.income.catOther") },
  ];
  const selectedLabel = riCategoryOptions.find(o => o.value === riCategory)?.label ?? riCategory;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4" style={{ background: `${MINT}08`, border: `1px solid ${MINT}18` }}>
        <p className="text-xs text-white/40 leading-relaxed">
          {t("axisSetup.income.info")}
        </p>
      </div>

      <div>
        <FieldLabel>{t("axisSetup.income.recurringTitle")}</FieldLabel>

        {riLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-white/30" />
          </div>
        ) : recurringIncomes.length > 0 ? (
          <div className="space-y-2 mb-3">
            {recurringIncomes.map(ri => (
              <div
                key={ri.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                data-testid={`recurring-income-${ri.id}`}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-sm"
                  style={{ background: `${MINT}18` }}
                >
                  💰
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{ri.name}</p>
                  <p className="text-xs text-white/40">
                    {fmtMoney(ri.amount)} · {t("axisSetup.income.everyDay")} {ri.dayOfMonth}
                    {ri.lastPostedMonth === currentMonth && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{ background: `${MINT}22`, color: MINT }}
                      >
                        {t("axisSetup.income.postedIn")} {new Date().toLocaleString(lang, { month: "short" })}
                      </span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => deleteRIMutation.mutate(ri.id)}
                  disabled={deleteRIMutation.isPending}
                  className="p-1.5 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
                  style={{ color: "#FF6B6B66" }}
                  data-testid={`button-delete-recurring-${ri.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <p className="text-xs text-white/25 text-right">
              {t("axisSetup.income.monthlyTotal")}: {fmtMoney(totalRecurring)}
            </p>
          </div>
        ) : (
          <p className="text-xs text-white/25 mb-3">{t("axisSetup.income.noRecurring")}</p>
        )}

        <div
          className="rounded-2xl p-3 space-y-2.5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[11px] text-white/30 font-medium uppercase tracking-wider">{t("axisSetup.income.addForm")}</p>
          <StyledInput
            placeholder={t("axisSetup.income.namePlaceholder")}
            value={riName}
            onChange={e => setRiName(e.target.value)}
            data-testid="input-recurring-name"
          />
          <div ref={riCategoryRef} className="relative" data-testid="select-recurring-category">
            <button
              type="button"
              onClick={() => setRiCategoryOpen(o => !o)}
              className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-white cursor-pointer"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <span>{selectedLabel}</span>
              <ChevronDown className={`w-4 h-4 text-white/40 transition-transform duration-200 ${riCategoryOpen ? "rotate-180" : ""}`} />
            </button>
            {riCategoryOpen && (
              <div
                className="absolute left-0 right-0 mt-1 rounded-xl overflow-hidden z-50"
                style={{ background: "#111118", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
              >
                {riCategoryOptions.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { setRiCategory(opt.value); setRiCategoryOpen(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm text-white/85 transition-colors"
                    style={{ background: riCategory === opt.value ? "rgba(255,255,255,0.08)" : "transparent" }}
                    onMouseEnter={e => { if (riCategory !== opt.value) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                    onMouseLeave={e => { if (riCategory !== opt.value) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {riCategory === "outros" && (
            <StyledInput
              placeholder={t("axisSetup.income.customCatPlaceholder")}
              value={riCustomCategory}
              onChange={e => setRiCustomCategory(e.target.value)}
              data-testid="input-recurring-custom-category"
            />
          )}
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-white/40 text-sm font-medium flex-shrink-0">{symbol}</span>
              <input
                type="number"
                value={riAmount}
                onChange={e => setRiAmount(e.target.value)}
                placeholder={t("axisFinance.amountPlaceholder")}
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20 min-w-0"
                data-testid="input-recurring-amount"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 w-28 flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-white/40 text-xs flex-shrink-0">{t("axisSetup.income.day")}</span>
              <input
                type="number"
                min={1}
                max={31}
                value={riDay}
                onChange={e => setRiDay(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm outline-none min-w-0 text-center"
                data-testid="input-recurring-day"
              />
            </div>
          </div>
          <button
            onClick={() => addRIMutation.mutate()}
            disabled={addRIMutation.isPending || !riName.trim() || !riAmount}
            className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ background: `${MINT}22`, color: MINT, border: `1px solid ${MINT}30` }}
            data-testid="button-add-recurring-income"
          >
            {addRIMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <><Plus className="h-4 w-4" /> {t("axisSetup.income.addBtn")}</>
            )}
          </button>
        </div>
      </div>

      <div>
        <FieldLabel>{t("axisSetup.income.refTitle")}</FieldLabel>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
          <span className="text-white/40 text-sm font-medium">{symbol}</span>
          <input
            type="number"
            value={val || (totalRecurring > 0 ? String(totalRecurring) : "")}
            onChange={e => setVal(e.target.value)}
            placeholder={totalRecurring > 0 ? String(totalRecurring) : t("axisFinance.amountPlaceholder")}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
            data-testid="input-income"
          />
        </div>
        <p className="text-xs text-white/25 mt-1.5">{t("axisSetup.income.refHint")}</p>
      </div>

      <button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || (!val && totalRecurring === 0)}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        style={{ background: MINT, color: "#060608" }}
        data-testid="button-save-income"
      >
        {saveMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <><Check className="h-4 w-4" /> {t("axisSetup.income.saved")}</>
        ) : (
          t("axisSetup.income.saveBtn")
        )}
      </button>
    </div>
  );
}

function SectionGastos() {
  const { t } = useTranslation();
  const { symbol, fmtMoney } = useCurrency();
  const { toast } = useToast();
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("outros");
  const [diaToggle, setDiaToggle] = useState(false);
  const [dia, setDia] = useState("1");
  const [recurrence, setRecurrence] = useState<Recurrence>({ type: "permanent" });
  const [addedItems, setAddedItems] = useState<AddedExpense[]>([]);
  const [customCategory, setCustomCategory] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const CATEGORIES = [
    { id: "moradia", label: t("axisSetup.expenses.catHousing"), emoji: "🏠" },
    { id: "alimentação", label: t("axisSetup.expenses.catFood"), emoji: "🍔" },
    { id: "transporte", label: t("axisSetup.expenses.catTransport"), emoji: "🚗" },
    { id: "saúde", label: t("axisSetup.expenses.catHealth"), emoji: "💊" },
    { id: "educação", label: t("axisSetup.expenses.catEducation"), emoji: "📚" },
    { id: "lazer", label: t("axisSetup.expenses.catLeisure"), emoji: "🎬" },
    { id: "assinatura", label: t("axisSetup.expenses.catSubscription"), emoji: "📱" },
    { id: "outros", label: t("axisSetup.expenses.catOther"), emoji: "📦" },
  ];

  const addMutation = useMutation({
    mutationFn: async () => {
      const amtNum = parseFloat(amount);
      if (!desc.trim() || isNaN(amtNum) || amtNum <= 0) throw new Error(t("axisSetup.expenses.errorFillDescAndValue"));

      const endDate = getEndDate(recurrence);
      const today = new Date();
      const diaNum = diaToggle ? parseInt(dia) || 1 : 1;

      const monthsToCreate: Date[] = [];
      const cur = new Date(today.getFullYear(), today.getMonth(), diaNum);
      if (cur < today) cur.setMonth(cur.getMonth() + 1);

      while (cur <= endDate && monthsToCreate.length < 12) {
        monthsToCreate.push(new Date(cur));
        cur.setMonth(cur.getMonth() + 1);
      }

      const results = await Promise.all(
        monthsToCreate.map(async (date) => {
          const resolvedCategory = category === "outros" && customCategory.trim()
            ? customCategory.trim().toLowerCase()
            : category;
          const res = await apiRequest("POST", "/api/transactions", {
            amount: amtNum,
            description: desc.trim(),
            type: "expense",
            categoryName: resolvedCategory,
            date: date.toISOString(),
          });
          return res.json();
        })
      );

      return { results, months: monthsToCreate.length };
    },
    onSuccess: ({ results, months }) => {
      const isCustom = category === "outros" && customCategory.trim();
      const cat = CATEGORIES.find(c => c.id === category);
      setAddedItems(prev => [
        {
          ids: results.map((r: any) => r.id),
          description: desc.trim(),
          amount: parseFloat(amount),
          category: isCustom ? customCategory.trim() : category,
          emoji: isCustom ? "🏷️" : (cat?.emoji || "📦"),
          months,
        },
        ...prev,
      ]);
      setDesc("");
      setAmount("");
      if (isCustom) setCustomCategory("");
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (e: any) => {
      toast({ title: t("axisSetup.expenses.errorAdd"), description: e.message, variant: "destructive" });
    },
  });

  const deleteItem = async (item: AddedExpense) => {
    setDeletingId(item.ids[0]);
    try {
      await Promise.all(item.ids.map(id => apiRequest("DELETE", `/api/transactions/${id}`)));
      setAddedItems(prev => prev.filter(i => i.ids[0] !== item.ids[0]));
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch {
      toast({ title: t("axisSetup.expenses.errorDelete"), variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const canAdd = desc.trim().length > 0 && parseFloat(amount) > 0 &&
    (category !== "outros" || customCategory.trim().length > 0);

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>{t("axisSetup.expenses.descLabel")}</FieldLabel>
        <StyledInput
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder={t("axisSetup.expenses.descPlaceholder")}
          data-testid="input-expense-desc"
        />
      </div>

      <div>
        <FieldLabel>{t("axisSetup.expenses.amountLabel")}</FieldLabel>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
          <span className="text-white/40 text-sm font-medium">{symbol}</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={t("axisFinance.amountPlaceholder")}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
            data-testid="input-expense-amount"
          />
        </div>
      </div>

      <div>
        <FieldLabel>{t("axisSetup.expenses.categoryLabel")}</FieldLabel>
        <div className="grid grid-cols-4 gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-center transition-all duration-150"
              style={{
                background: category === cat.id ? `${MINT}10` : "rgba(255,255,255,0.03)",
                border: `1px solid ${category === cat.id ? `${MINT}30` : "rgba(255,255,255,0.07)"}`,
              }}
              data-testid={`button-category-${cat.id}`}
            >
              <span className="text-base leading-none">{cat.emoji}</span>
              <span className="text-[10px] font-medium leading-tight" style={{ color: category === cat.id ? "white" : "rgba(255,255,255,0.35)" }}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>
        <AnimatePresence>
          {category === "outros" && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.18 }}
            >
              <StyledInput
                value={customCategory}
                onChange={e => setCustomCategory(e.target.value)}
                placeholder={t("axisSetup.expenses.customCatPlaceholder")}
                data-testid="input-custom-category"
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>{t("axisSetup.expenses.dueDay")}</FieldLabel>
          <button
            type="button"
            onClick={() => setDiaToggle(!diaToggle)}
            className="text-[10px] font-medium px-2 py-1 rounded-lg transition-colors"
            style={{
              background: diaToggle ? `${MINT}12` : "rgba(255,255,255,0.05)",
              color: diaToggle ? MINT : "rgba(255,255,255,0.3)",
              border: `1px solid ${diaToggle ? `${MINT}25` : "rgba(255,255,255,0.07)"}`,
            }}
            data-testid="toggle-due-date"
          >
            {diaToggle ? t("axisSetup.expenses.enabled") : t("axisSetup.expenses.optional")}
          </button>
        </div>
        <AnimatePresence>
          {diaToggle && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.18 }}>
              <div className="flex items-center gap-2">
                <StyledInput
                  type="number"
                  min="1"
                  max="31"
                  value={dia}
                  onChange={e => setDia(e.target.value)}
                  placeholder={t("axisSetup.expenses.dayPlaceholder")}
                  style={{ width: "100px" }}
                  data-testid="input-due-day"
                />
                <span className="text-xs text-white/30">{t("axisSetup.expenses.ofEachMonth")}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <RecurrenceSelector value={recurrence} onChange={setRecurrence} accentColor={MINT} />

      <button
        onClick={() => addMutation.mutate()}
        disabled={addMutation.isPending || !canAdd}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        style={{ background: MINT, color: "#060608" }}
        data-testid="button-add-expense"
      >
        {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {addMutation.isPending ? t("axisSetup.expenses.adding") : t("axisSetup.expenses.addBtn")}
      </button>

      <AnimatePresence>
        {addedItems.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <p className="text-xs text-white/30 font-medium">{t("axisSetup.expenses.addedSession")}</p>
            {addedItems.map((item) => (
              <motion.div
                key={item.ids[0]}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-base flex-shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate">{item.description}</p>
                  <p className="text-[10px] text-white/30">
                    {fmtMoney(item.amount)}{t("axisSetup.expenses.perMonth")} · {item.months} {item.months === 1 ? t("axisSetup.expenses.month") : t("axisSetup.expenses.months")}
                  </p>
                </div>
                <button
                  onClick={() => deleteItem(item)}
                  disabled={deletingId === item.ids[0]}
                  className="flex-shrink-0 text-white/20 hover:text-red-400 transition-colors p-1"
                  data-testid={`button-delete-expense-${item.ids[0]}`}
                >
                  {deletingId === item.ids[0] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface AddedExpense {
  ids: string[];
  description: string;
  amount: number;
  category: string;
  emoji: string;
  months: number;
}

interface AddedRoutine {
  ids: string[];
  title: string;
  days: number[];
  time: string;
  durationLabel: string;
  recurrenceLabel: string;
}

function SectionRotina() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [recurrence, setRecurrence] = useState<Recurrence>({ type: "permanent" });
  const [addedItems, setAddedItems] = useState<AddedRoutine[]>([]);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const DAYS = t("axisSetup.routine.dayNames", { returnObjects: true }) as string[];
  const DURATIONS = [
    { label: "30min", minutes: 30 },
    { label: "1h", minutes: 60 },
    { label: "1h30", minutes: 90 },
    { label: "2h", minutes: 120 },
    { label: "3h", minutes: 180 },
    { label: "4h+", minutes: 240 },
  ];

  const recurrenceLabel = (rec: Recurrence): string => {
    if (rec.type === "permanent") return t("axisSetup.recurrence.permanent");
    if (rec.type === "this_month") return t("axisSetup.recurrence.thisMonth");
    if (rec.type === "three_months") return t("axisSetup.recurrence.threeMonths");
    if (rec.type === "custom" && rec.endDate) return rec.endDate;
    return t("axisSetup.recurrence.thisMonth");
  };

  const toggleDay = (d: number) => {
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || selectedDays.length === 0) throw new Error(t("axisSetup.routine.errorFillTitleAndDays"));
      const endDate = getEndDate(recurrence);
      const today = new Date();
      const [h, m] = time.split(":").map(Number);

      const occurrences: { start: Date; end: Date }[] = [];
      const cursor = new Date(today);
      cursor.setHours(0, 0, 0, 0);

      while (cursor <= endDate && occurrences.length < 52) {
        if (selectedDays.includes(cursor.getDay())) {
          const start = new Date(cursor);
          start.setHours(h, m, 0, 0);
          const end = new Date(start.getTime() + duration * 60000);
          occurrences.push({ start, end });
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      const results = await Promise.all(
        occurrences.map(async ({ start, end }) => {
          const res = await apiRequest("POST", "/api/schedule", {
            title: title.trim(),
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            suggestedByAi: false,
          });
          return res.json();
        })
      );

      return results;
    },
    onSuccess: (results) => {
      const dur = DURATIONS.find(d => d.minutes === duration);
      setAddedItems(prev => [
        {
          ids: results.map((r: any) => r.id),
          title: title.trim(),
          days: [...selectedDays].sort(),
          time,
          durationLabel: dur?.label || `${duration}min`,
          recurrenceLabel: recurrenceLabel(recurrence),
        },
        ...prev,
      ]);
      setTitle("");
      setSelectedDays([]);
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (e: any) => {
      toast({ title: t("axisSetup.routine.errorAdd"), description: e.message, variant: "destructive" });
    },
  });

  const deleteItem = async (item: AddedRoutine) => {
    setDeletingKey(item.ids[0]);
    try {
      await Promise.all(item.ids.map(id => apiRequest("DELETE", `/api/schedule/${id}`)));
      setAddedItems(prev => prev.filter(i => i.ids[0] !== item.ids[0]));
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch {
      toast({ title: t("axisSetup.routine.errorDelete"), variant: "destructive" });
    } finally {
      setDeletingKey(null);
    }
  };

  const canAdd = title.trim().length > 0 && selectedDays.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>{t("axisSetup.routine.activityLabel")}</FieldLabel>
        <StyledInput
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t("axisSetup.routine.activityPlaceholder")}
          data-testid="input-routine-title"
        />
      </div>

      <div>
        <FieldLabel>{t("axisSetup.routine.daysLabel")}</FieldLabel>
        <div className="flex gap-1.5">
          {DAYS.map((day, i) => {
            const isActive = selectedDays.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                style={{
                  background: isActive ? `${LAVANDA}15` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? `${LAVANDA}40` : "rgba(255,255,255,0.07)"}`,
                  color: isActive ? LAVANDA : "rgba(255,255,255,0.3)",
                }}
                data-testid={`button-day-${day}`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <FieldLabel>{t("axisSetup.routine.timeLabel")}</FieldLabel>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", colorScheme: "dark" }}
            data-testid="input-routine-time"
          />
        </div>
        <div>
          <FieldLabel>{t("axisSetup.routine.durationLabel")}</FieldLabel>
          <div className="grid grid-cols-3 gap-1">
            {DURATIONS.map((d) => (
              <button
                key={d.minutes}
                type="button"
                onClick={() => setDuration(d.minutes)}
                className="py-2 rounded-lg text-[11px] font-semibold transition-all duration-150"
                style={{
                  background: duration === d.minutes ? `${LAVANDA}15` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${duration === d.minutes ? `${LAVANDA}35` : "rgba(255,255,255,0.07)"}`,
                  color: duration === d.minutes ? LAVANDA : "rgba(255,255,255,0.3)",
                }}
                data-testid={`button-duration-${d.label}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <RecurrenceSelector value={recurrence} onChange={setRecurrence} accentColor={LAVANDA} />

      <button
        onClick={() => addMutation.mutate()}
        disabled={addMutation.isPending || !canAdd}
        className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
        style={{ background: LAVANDA, color: "#060608" }}
        data-testid="button-add-routine"
      >
        {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {addMutation.isPending ? t("axisSetup.routine.adding") : t("axisSetup.routine.addBtn")}
      </button>

      <AnimatePresence>
        {addedItems.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <p className="text-xs text-white/30 font-medium">{t("axisSetup.routine.addedSession")}</p>
            {addedItems.map((item) => (
              <motion.div
                key={item.ids[0]}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${LAVANDA}15` }}>
                  <Clock className="h-3.5 w-3.5" style={{ color: LAVANDA }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate">{item.title}</p>
                  <p className="text-[10px] text-white/30">
                    {item.days.map(d => DAYS[d]).join(", ")} · {item.time} · {item.durationLabel} · {item.recurrenceLabel}
                  </p>
                </div>
                <button
                  onClick={() => deleteItem(item)}
                  disabled={deletingKey === item.ids[0]}
                  className="flex-shrink-0 text-white/20 hover:text-red-400 transition-colors p-1"
                  data-testid={`button-delete-routine-${item.ids[0]}`}
                >
                  {deletingKey === item.ids[0] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type NotifPrefs = {
  email: string;
  billDueSoon: boolean;
  offlineReminder: boolean;
  overdueTask: boolean;
  weeklySummary: boolean;
  goalDeadline: boolean;
  lowDiscipline: boolean;
};

type NotifKey = "billDueSoon" | "offlineReminder" | "overdueTask" | "weeklySummary" | "goalDeadline" | "lowDiscipline";

function SectionNotificacoes() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<NotifPrefs>({ queryKey: ["/api/user/notifications"] });

  const saveMutation = useMutation({
    mutationFn: async (prefs: Omit<NotifPrefs, "email">) => {
      await apiRequest("PATCH", "/api/user/notifications", prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notifications"] });
      toast({ title: t("axisSetup.alerts.saved") });
    },
    onError: () => {
      toast({ title: t("axisSetup.alerts.errorSave"), variant: "destructive" });
    },
  });

  const toggle = (key: NotifKey) => {
    if (!data || saveMutation.isPending) return;
    saveMutation.mutate({
      billDueSoon: data.billDueSoon,
      offlineReminder: data.offlineReminder,
      overdueTask: data.overdueTask,
      weeklySummary: data.weeklySummary,
      goalDeadline: data.goalDeadline,
      lowDiscipline: data.lowDiscipline,
      [key]: !data[key],
    });
  };

  const { theme } = useTheme();
  const HIGH = getPrimaryHex(theme);

  const ToggleRow = ({
    label,
    description,
    field,
    testId,
  }: {
    label: string;
    description: string;
    field: NotifKey;
    testId: string;
  }) => {
    const active = data?.[field] ?? true;
    return (
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3.5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="flex-1 pr-4">
          <p className="text-sm font-medium text-white">{label}</p>
          <p className="text-xs text-white/35 mt-0.5">{description}</p>
        </div>
        <button
          onClick={() => toggle(field)}
          disabled={saveMutation.isPending}
          className="relative w-11 h-6 rounded-full flex-shrink-0 transition-all duration-200"
          style={{ background: active ? HIGH : "rgba(255,255,255,0.12)" }}
          data-testid={testId}
        >
          <span
            className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200"
            style={{ left: active ? "calc(100% - 22px)" : "2px" }}
          />
        </button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4" style={{ background: `${HIGH}08`, border: `1px solid ${HIGH}18` }}>
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-3.5 w-3.5" style={{ color: HIGH }} />
          <p className="text-xs font-semibold" style={{ color: HIGH }}>{t("axisSetup.alerts.sentTo")}</p>
        </div>
        <p className="text-sm text-white font-medium truncate" data-testid="text-notif-email">
          {data?.email || "—"}
        </p>
      </div>

      <div>
        <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider mb-3">{t("axisSetup.alerts.immediate")}</p>
        <div className="space-y-2">
          <ToggleRow label={t("axisSetup.alerts.billDue")} description={t("axisSetup.alerts.billDueDesc")} field="billDueSoon" testId="toggle-bill-due-soon" />
          <ToggleRow label={t("axisSetup.alerts.overdue")} description={t("axisSetup.alerts.overdueDesc")} field="overdueTask" testId="toggle-overdue-task" />
          <ToggleRow label={t("axisSetup.alerts.goalDeadline")} description={t("axisSetup.alerts.goalDeadlineDesc")} field="goalDeadline" testId="toggle-goal-deadline" />
          <ToggleRow label={t("axisSetup.alerts.discipline")} description={t("axisSetup.alerts.disciplineDesc")} field="lowDiscipline" testId="toggle-low-discipline" />
        </div>
      </div>

      <div>
        <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider mb-3">{t("axisSetup.alerts.periodic")}</p>
        <div className="space-y-2">
          <ToggleRow label={t("axisSetup.alerts.weekly")} description={t("axisSetup.alerts.weeklyDesc")} field="weeklySummary" testId="toggle-weekly-summary" />
          <ToggleRow label={t("axisSetup.alerts.offline")} description={t("axisSetup.alerts.offlineDesc")} field="offlineReminder" testId="toggle-offline-reminder" />
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-xs text-white/25 leading-relaxed">
          {t("axisSetup.alerts.footer")}
        </p>
      </div>
    </div>
  );
}

function formatBotPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length === 13) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.startsWith("55") && d.length === 12) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return `+${d}`;
}

function getModulePalette(theme: string) {
  return {
    positive: "#4ECDC4",
    negative: "#FF6B6B",
    agenda: "#A78BFA",
  };
}

function SectionWhatsApp() {
  const { t } = useTranslation();
  const { theme: _wt } = useTheme();
  const _WMP = getModulePalette(_wt as any);
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [phoneSaved, setPhoneSaved] = useState(false);

  const { data: adminData } = useQuery<{ isAdmin: boolean }>({ queryKey: ["/api/auth/is-admin"], staleTime: 0 });
  const isAdmin = adminData?.isAdmin ?? false;

  const { data: status, refetch } = useQuery<{ status: string; qrCode?: string; phone?: string }>({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: 3000,
    staleTime: 0,
    gcTime: 0,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/connect");
      return res.json() as Promise<{ status: string; qrCode?: string }>;
    },
    onSuccess: (data) => {
      if (data?.qrCode) {
        queryClient.setQueryData(["/api/whatsapp/status"], (old: any) => ({ ...old, status: data.status, qrCode: data.qrCode }));
      }
      refetch();
      setTimeout(() => refetch(), 1500);
      setTimeout(() => refetch(), 3500);
    },
    onError: () => toast({ title: t("axisSetup.whatsapp.errorConnect"), variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/disconnect"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] }); refetch(); },
    onError: () => toast({ title: t("axisSetup.whatsapp.errorDisconnect"), variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/reset"),
    onSuccess: () => { toast({ title: t("axisSetup.whatsapp.generatingQrNew") }); setTimeout(() => refetch(), 1200); },
    onError: () => toast({ title: t("axisSetup.whatsapp.errorQr"), variant: "destructive" }),
  });

  const phoneMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/user/whatsapp-phone", { phone }),
    onSuccess: () => { setPhoneSaved(true); toast({ title: t("axisSetup.whatsapp.phoneSaved") }); setTimeout(() => setPhoneSaved(false), 2000); },
    onError: () => toast({ title: t("axisSetup.whatsapp.errorPhone"), variant: "destructive" }),
  });

  const wStatus = status?.status || "disconnected";

  const statusConfig = {
    disconnected: { label: t("axisSetup.whatsapp.statusDisconnected"), color: _WMP.negative, icon: WifiOff },
    qr_pending:   { label: t("axisSetup.whatsapp.statusPending"), color: _WMP.agenda, icon: QrCode },
    connected:    { label: t("axisSetup.whatsapp.statusConnected"), color: _WMP.positive, icon: Wifi },
  }[wStatus] || { label: t("axisSetup.whatsapp.statusDisconnected"), color: _WMP.negative, icon: WifiOff };

  const StatusIcon = statusConfig.icon;

  const waExamples = [
    t("axisSetup.whatsapp.ex1"),
    t("axisSetup.whatsapp.ex2"),
    t("axisSetup.whatsapp.ex3"),
    t("axisSetup.whatsapp.ex4"),
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">{t("axisSetup.whatsapp.title")}</p>
        <p className="text-xs text-white/40 leading-relaxed">
          {t("axisSetup.whatsapp.description")}
        </p>
      </div>

      <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <StatusIcon className="h-5 w-5" style={{ color: statusConfig.color }} />
          <div>
            <p className="text-sm font-semibold text-white">{statusConfig.label}</p>
            {wStatus === "connected" && status?.phone && (
              <p className="text-[11px] font-medium" style={{ color: _WMP.positive }}>
                {t("axisSetup.whatsapp.botConnectedAt")} {formatBotPhone(status.phone)}
              </p>
            )}
          </div>
        </div>
        {isAdmin && wStatus === "connected" ? (
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: `${_WMP.negative}1A`, color: _WMP.negative, border: `1px solid ${_WMP.negative}33` }}
            data-testid="button-whatsapp-disconnect"
          >
            {disconnectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("axisSetup.whatsapp.disconnect")}
          </button>
        ) : isAdmin && (wStatus === "disconnected" || wStatus === "qr_pending") ? (
          <button
            onClick={() => { connectMutation.mutate(); }}
            disabled={connectMutation.isPending}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: `${_WMP.positive}1A`, color: _WMP.positive, border: `1px solid ${_WMP.positive}33` }}
            data-testid="button-whatsapp-connect"
          >
            {connectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : wStatus === "qr_pending" ? t("axisSetup.whatsapp.reconnect") : t("axisSetup.whatsapp.connect")}
          </button>
        ) : null}
      </div>

      {isAdmin && wStatus === "qr_pending" && status?.qrCode && (
        <div className="rounded-2xl p-4 flex flex-col items-center gap-3" style={{ background: "rgba(255,160,0,0.05)", border: "1px solid rgba(255,160,0,0.2)" }}>
          <p className="text-xs text-white/60 text-center">{t("axisSetup.whatsapp.qrInstructions")}</p>
          <img src={status.qrCode} alt="QR Code WhatsApp" className="w-48 h-48 rounded-xl" data-testid="img-whatsapp-qr" />
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-white/30">{t("axisSetup.whatsapp.qrExpires")}</p>
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ color: _WMP.agenda, background: `${_WMP.agenda}1A`, border: `1px solid ${_WMP.agenda}40` }}
              data-testid="button-whatsapp-new-qr"
            >
              {resetMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {t("axisSetup.whatsapp.newQr")}
            </button>
          </div>
        </div>
      )}

      {isAdmin && wStatus === "qr_pending" && !status?.qrCode && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            <span className="text-xs text-white/40">{t("axisSetup.whatsapp.generatingQr")}</span>
          </div>
          <button
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            style={{ color: _WMP.agenda, background: `${_WMP.agenda}1A`, border: `1px solid ${_WMP.agenda}40` }}
            data-testid="button-whatsapp-new-qr-fallback"
          >
            <RefreshCw className="h-3 w-3" />
            {t("axisSetup.whatsapp.tryAgain")}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">{t("axisSetup.whatsapp.yourPhone")}</p>
        <p className="text-xs text-white/40">{t("axisSetup.whatsapp.phoneDesc")}</p>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder={t("axisSetup.whatsapp.phonePlaceholder")}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
            data-testid="input-whatsapp-phone"
          />
          <button
            onClick={() => phoneMutation.mutate()}
            disabled={phoneMutation.isPending || !phone.trim()}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-40 transition-all"
            style={{ background: phoneSaved ? `${_WMP.positive}26` : "rgba(255,255,255,0.06)", color: phoneSaved ? _WMP.positive : "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
            data-testid="button-save-whatsapp-phone"
          >
            {phoneMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : phoneSaved ? <Check className="h-3.5 w-3.5" /> : t("axisSetup.whatsapp.save")}
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">{t("axisSetup.whatsapp.examplesTitle")}</p>
        {waExamples.map(ex => (
          <div key={ex} className="flex items-start gap-2">
            <MessageCircle className="h-3 w-3 text-white/20 mt-0.5 shrink-0" />
            <span className="text-[11px] text-white/35 italic">"{ex}"</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SetupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>("renda");
  const [savedIncome, setSavedIncome] = useState("");
  const { toast } = useToast();
  const { theme } = useTheme();
  const primaryHex = getPrimaryHex(theme);

  const TAB_META: { id: Tab; label: string; description: string; icon: any; accent: string }[] = [
    { id: "renda",        label: t("axisSetup.tabs.renda"),        description: t("axisSetup.tabs.rendaDesc"),        icon: DollarSign,    accent: MINT },
    { id: "gastos",       label: t("axisSetup.tabs.gastos"),       description: t("axisSetup.tabs.gastosDesc"),       icon: ClipboardList,  accent: CORAL },
    { id: "rotina",       label: t("axisSetup.tabs.rotina"),       description: t("axisSetup.tabs.rotinaDesc"),       icon: Calendar,       accent: LAVANDA },
    { id: "notificacoes", label: t("axisSetup.tabs.notificacoes"), description: t("axisSetup.tabs.notificacoesDesc"), icon: Bell,           accent: primaryHex },
    { id: "whatsapp",     label: t("axisSetup.tabs.whatsapp"),     description: t("axisSetup.tabs.whatsappDesc"),     icon: MessageCircle,  accent: "#25D366" },
  ];

  const finishMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/onboarding/setup", {
        currentIncome: savedIncome ? parseFloat(savedIncome) : null,
        fixedExpenses: null,
        routine: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/setup/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      onClose();
    },
    onError: () => {
      toast({ title: t("axisSetup.errorFinish"), variant: "destructive" });
      onClose();
    },
  });

  const activeMeta = TAB_META.find(t => t.id === activeTab)!;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="p-0 gap-0 border-0 outline-none overflow-hidden"
        style={{
          background: "#0d0d12",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px",
          maxWidth: "860px",
          width: "95vw",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
        data-testid="dialog-setup"
      >
        <div className="flex flex-1 min-h-0">
          <div
            className="flex flex-col w-56 shrink-0 py-5 px-3"
            style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}
          >
            <div className="px-2 mb-5">
              <h2 className="text-sm font-bold text-white">{t("axisSetup.title")}</h2>
              <p className="text-[11px] text-white/35 mt-0.5 leading-tight">{t("axisSetup.subtitle")}</p>
            </div>

            <nav className="flex flex-col gap-1 flex-1">
              {TAB_META.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150 group"
                    style={{
                      background: isActive ? `${tab.accent}12` : "transparent",
                      border: `1px solid ${isActive ? `${tab.accent}28` : "transparent"}`,
                    }}
                    data-testid={`tab-${tab.id}`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all"
                      style={{ background: isActive ? `${tab.accent}20` : "rgba(255,255,255,0.05)" }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: isActive ? tab.accent : "rgba(255,255,255,0.3)" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold leading-tight" style={{ color: isActive ? "white" : "rgba(255,255,255,0.45)" }}>
                        {tab.label}
                      </p>
                      <p className="text-[10px] leading-tight mt-0.5" style={{ color: isActive ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)" }}>
                        {tab.description}
                      </p>
                    </div>
                    {isActive && (
                      <ChevronRight className="h-3 w-3 ml-auto flex-shrink-0" style={{ color: tab.accent }} />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto pt-4 px-1 space-y-2">
              <button
                onClick={() => finishMutation.mutate()}
                disabled={finishMutation.isPending}
                className="w-full py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all"
                style={{ background: MINT, color: "#060608" }}
                data-testid="button-finish-setup"
              >
                {finishMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {finishMutation.isPending ? t("axisSetup.saving") : t("axisSetup.finish")}
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-[11px] text-white/25 hover:text-white/45 transition-colors"
                data-testid="button-skip-setup"
              >
                {t("axisSetup.doLater")}
              </button>
            </div>
          </div>

          <div className="flex flex-col flex-1 min-w-0">
            <div
              className="flex items-center gap-3 px-6 py-4 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${activeMeta.accent}18` }}
              >
                <activeMeta.icon className="h-4 w-4" style={{ color: activeMeta.accent }} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">{activeMeta.label}</h3>
                <p className="text-[11px] text-white/35">{activeMeta.description}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.16 }}
                >
                  {activeTab === "renda" && (
                    <SectionRenda savedIncome={savedIncome} onSave={setSavedIncome} />
                  )}
                  {activeTab === "gastos" && <SectionGastos />}
                  {activeTab === "rotina" && <SectionRotina />}
                  {activeTab === "notificacoes" && <SectionNotificacoes />}
                  {activeTab === "whatsapp" && <SectionWhatsApp />}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
