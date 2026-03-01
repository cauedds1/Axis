import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  X,
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

const MINT = "#4ECDC4";
const LAVANDA = "#A78BFA";
const CORAL = "#FF6B6B";

type Tab = "renda" | "gastos" | "rotina" | "notificacoes" | "whatsapp";

type RecurrenceType = "permanent" | "this_month" | "three_months" | "custom";
interface Recurrence {
  type: RecurrenceType;
  endDate?: string;
}

const RECURRENCE_OPTIONS: { type: RecurrenceType; label: string; sub: string; icon: any }[] = [
  { type: "permanent", label: "Permanente", sub: "Até você desativar", icon: Infinity },
  { type: "this_month", label: "Este mês", sub: "Só até o fim do mês", icon: Calendar },
  { type: "three_months", label: "3 meses", sub: "Próximos 3 meses", icon: CalendarRange },
  { type: "custom", label: "Personalizado", sub: "Escolher data", icon: CalendarDays },
];

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

function recurrenceLabel(rec: Recurrence): string {
  if (rec.type === "permanent") return "Permanente";
  if (rec.type === "this_month") return "Este mês";
  if (rec.type === "three_months") return "3 meses";
  if (rec.type === "custom" && rec.endDate) return rec.endDate;
  return "Este mês";
}

interface RecurrenceSelectorProps {
  value: Recurrence;
  onChange: (r: Recurrence) => void;
  accentColor: string;
}

function RecurrenceSelector({ value, onChange, accentColor }: RecurrenceSelectorProps) {
  return (
    <div>
      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">Duração</p>
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

const CATEGORIES = [
  { id: "moradia", label: "Moradia", emoji: "🏠" },
  { id: "alimentação", label: "Alimentação", emoji: "🍔" },
  { id: "transporte", label: "Transporte", emoji: "🚗" },
  { id: "saúde", label: "Saúde", emoji: "💊" },
  { id: "educação", label: "Educação", emoji: "📚" },
  { id: "lazer", label: "Lazer", emoji: "🎬" },
  { id: "assinatura", label: "Assinatura", emoji: "📱" },
  { id: "outros", label: "Outros", emoji: "📦" },
];

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DURATIONS = [
  { label: "30min", minutes: 30 },
  { label: "1h", minutes: 60 },
  { label: "1h30", minutes: 90 },
  { label: "2h", minutes: 120 },
  { label: "3h", minutes: 180 },
  { label: "4h+", minutes: 240 },
];

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
  const [val, setVal] = useState(savedIncome);
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  // New recurring income form state
  const [riName, setRiName] = useState("");
  const [riAmount, setRiAmount] = useState("");
  const [riDay, setRiDay] = useState("5");

  const currentMonth = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  })();

  const { data: recurringIncomes = [], isLoading: riLoading } = useQuery<RecurringIncome[]>({
    queryKey: ["/api/recurring-incomes"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!val || isNaN(parseFloat(val))) throw new Error("Valor inválido");
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
      toast({ title: "Erro ao salvar renda", variant: "destructive" });
    },
  });

  const addRIMutation = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(riAmount.replace(",", "."));
      const day = parseInt(riDay);
      if (!riName.trim() || isNaN(amt) || amt <= 0) throw new Error("Preencha nome e valor");
      if (day < 1 || day > 31) throw new Error("Dia inválido");
      await apiRequest("POST", "/api/recurring-incomes", { name: riName.trim(), amount: amt, dayOfMonth: day, active: true });
    },
    onSuccess: () => {
      setRiName("");
      setRiAmount("");
      setRiDay("5");
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-incomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Renda recorrente adicionada!" });
    },
    onError: (e: any) => {
      toast({ title: e.message || "Erro ao adicionar renda", variant: "destructive" });
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
      toast({ title: "Erro ao remover renda", variant: "destructive" });
    },
  });

  const totalRecurring = recurringIncomes.filter(r => r.active).reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-4" style={{ background: `${MINT}08`, border: `1px solid ${MINT}18` }}>
        <p className="text-xs text-white/40 leading-relaxed">
          Adicione suas rendas recorrentes. O sistema lançará automaticamente cada renda no dia certo, todo mês.
        </p>
      </div>

      {/* Recurring incomes list */}
      <div>
        <FieldLabel>Rendas automáticas</FieldLabel>

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
                    R${ri.amount.toFixed(2).replace(".", ",")} · Todo dia {ri.dayOfMonth}
                    {ri.lastPostedMonth === currentMonth && (
                      <span
                        className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{ background: `${MINT}22`, color: MINT }}
                      >
                        Postado em {new Date().toLocaleString("pt-BR", { month: "short" })}
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
              Total mensal automático: R${totalRecurring.toFixed(2).replace(".", ",")}
            </p>
          </div>
        ) : (
          <p className="text-xs text-white/25 mb-3">Nenhuma renda automática cadastrada ainda.</p>
        )}

        {/* Add form */}
        <div
          className="rounded-2xl p-3 space-y-2.5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[11px] text-white/30 font-medium uppercase tracking-wider">Adicionar renda</p>
          <StyledInput
            placeholder="Nome (ex: Salário, Freelance)"
            value={riName}
            onChange={e => setRiName(e.target.value)}
            data-testid="input-recurring-name"
          />
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-white/40 text-sm font-medium flex-shrink-0">R$</span>
              <input
                type="number"
                value={riAmount}
                onChange={e => setRiAmount(e.target.value)}
                placeholder="0,00"
                className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20 min-w-0"
                data-testid="input-recurring-amount"
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 w-28 flex-shrink-0" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
              <span className="text-white/40 text-xs flex-shrink-0">Dia</span>
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
              <><Plus className="h-4 w-4" /> Adicionar renda</>
            )}
          </button>
        </div>
      </div>

      {/* Reference income for AI */}
      <div>
        <FieldLabel>Referência de renda mensal (para a IA)</FieldLabel>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
          <span className="text-white/40 text-sm font-medium">R$</span>
          <input
            type="number"
            value={val || (totalRecurring > 0 ? String(totalRecurring) : "")}
            onChange={e => setVal(e.target.value)}
            placeholder={totalRecurring > 0 ? String(totalRecurring) : "0,00"}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
            data-testid="input-income"
          />
        </div>
        <p className="text-xs text-white/25 mt-1.5">Usado pela IA para calcular metas e alertas</p>
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
          <><Check className="h-4 w-4" /> Renda salva!</>
        ) : (
          "Salvar renda"
        )}
      </button>
    </div>
  );
}

function SectionGastos() {
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

  const addMutation = useMutation({
    mutationFn: async () => {
      const amtNum = parseFloat(amount);
      if (!desc.trim() || isNaN(amtNum) || amtNum <= 0) throw new Error("Preencha descrição e valor");

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
      toast({ title: "Erro ao adicionar gasto", description: e.message, variant: "destructive" });
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
      toast({ title: "Erro ao remover gasto", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const canAdd = desc.trim().length > 0 && parseFloat(amount) > 0 &&
    (category !== "outros" || customCategory.trim().length > 0);

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>Descrição</FieldLabel>
        <StyledInput
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Ex: Netflix, Aluguel, Plano de saúde..."
          data-testid="input-expense-desc"
        />
      </div>

      <div>
        <FieldLabel>Valor mensal</FieldLabel>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}>
          <span className="text-white/40 text-sm font-medium">R$</span>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0,00"
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/20"
            data-testid="input-expense-amount"
          />
        </div>
      </div>

      <div>
        <FieldLabel>Categoria</FieldLabel>
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
                placeholder="Nome da categoria personalizada..."
                data-testid="input-custom-category"
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <FieldLabel>Dia de vencimento</FieldLabel>
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
            {diaToggle ? "✓ Ativado" : "Opcional"}
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
                  placeholder="Ex: 10"
                  style={{ width: "100px" }}
                  data-testid="input-due-day"
                />
                <span className="text-xs text-white/30">de cada mês</span>
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
        {addMutation.isPending ? "Adicionando..." : "Adicionar gasto →"}
      </button>

      <AnimatePresence>
        {addedItems.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <p className="text-xs text-white/30 font-medium">Adicionados nesta sessão</p>
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
                    R$ {item.amount.toFixed(2)}/mês · {item.months} {item.months === 1 ? "mês" : "meses"}
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

function SectionRotina() {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState(60);
  const [recurrence, setRecurrence] = useState<Recurrence>({ type: "permanent" });
  const [addedItems, setAddedItems] = useState<AddedRoutine[]>([]);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const toggleDay = (d: number) => {
    setSelectedDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || selectedDays.length === 0) throw new Error("Preencha atividade e dias");
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
      toast({ title: "Erro ao adicionar rotina", description: e.message, variant: "destructive" });
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
      toast({ title: "Erro ao remover rotina", variant: "destructive" });
    } finally {
      setDeletingKey(null);
    }
  };

  const canAdd = title.trim().length > 0 && selectedDays.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <FieldLabel>Atividade</FieldLabel>
        <StyledInput
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Ex: Trabalho, Academia, Faculdade..."
          data-testid="input-routine-title"
        />
      </div>

      <div>
        <FieldLabel>Dias da semana</FieldLabel>
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
          <FieldLabel>Horário</FieldLabel>
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
          <FieldLabel>Duração</FieldLabel>
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
        {addMutation.isPending ? "Adicionando..." : "Adicionar rotina →"}
      </button>

      <AnimatePresence>
        {addedItems.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            <p className="text-xs text-white/30 font-medium">Adicionados nesta sessão</p>
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
  const { toast } = useToast();
  const { data, isLoading } = useQuery<NotifPrefs>({ queryKey: ["/api/user/notifications"] });

  const saveMutation = useMutation({
    mutationFn: async (prefs: Omit<NotifPrefs, "email">) => {
      await apiRequest("PATCH", "/api/user/notifications", prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notifications"] });
      toast({ title: "Preferências salvas" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar", variant: "destructive" });
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

  const HIGH = "#00E6FF";

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
          <p className="text-xs font-semibold" style={{ color: HIGH }}>Alertas enviados para</p>
        </div>
        <p className="text-sm text-white font-medium truncate" data-testid="text-notif-email">
          {data?.email || "—"}
        </p>
      </div>

      <div>
        <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider mb-3">Alertas imediatos</p>
        <div className="space-y-2">
          <ToggleRow
            label="Conta vencendo"
            description="Aviso 3 dias antes do vencimento de uma conta"
            field="billDueSoon"
            testId="toggle-bill-due-soon"
          />
          <ToggleRow
            label="Tarefas atrasadas"
            description="Avisa quando você tem tarefas com prazo vencido"
            field="overdueTask"
            testId="toggle-overdue-task"
          />
          <ToggleRow
            label="Meta próxima do prazo"
            description="Avisa quando uma meta de poupança está quase vencendo"
            field="goalDeadline"
            testId="toggle-goal-deadline"
          />
          <ToggleRow
            label="Disciplina em queda"
            description="Avisa quando seu score de disciplina cai abaixo de 4"
            field="lowDiscipline"
            testId="toggle-low-discipline"
          />
        </div>
      </div>

      <div>
        <p className="text-[11px] text-white/30 font-semibold uppercase tracking-wider mb-3">Resumos periódicos</p>
        <div className="space-y-2">
          <ToggleRow
            label="Resumo semanal"
            description="Toda segunda-feira: tarefas, contas, hábitos e score"
            field="weeklySummary"
            testId="toggle-weekly-summary"
          />
          <ToggleRow
            label="Lembrete de inatividade"
            description="Alerta quando você está offline por mais de 7 dias"
            field="offlineReminder"
            testId="toggle-offline-reminder"
          />
        </div>
      </div>

      <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-xs text-white/25 leading-relaxed">
          Os alertas são enviados automaticamente. O AXIS verifica contas e tarefas sempre que você acessa o app, e roda checagens periódicas a cada 6 horas quando o servidor está ativo.
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

function SectionWhatsApp() {
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
    mutationFn: () => apiRequest("POST", "/api/whatsapp/connect"),
    onSuccess: () => {
      refetch();
      setTimeout(() => refetch(), 1000);
      setTimeout(() => refetch(), 2500);
      setTimeout(() => refetch(), 4000);
    },
    onError: () => toast({ title: "Erro ao conectar WhatsApp", variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/disconnect"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] }); refetch(); },
    onError: () => toast({ title: "Erro ao desconectar", variant: "destructive" }),
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/reset"),
    onSuccess: () => { toast({ title: "Gerando novo QR code..." }); setTimeout(() => refetch(), 1200); },
    onError: () => toast({ title: "Erro ao gerar QR", variant: "destructive" }),
  });

  const phoneMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/user/whatsapp-phone", { phone }),
    onSuccess: () => { setPhoneSaved(true); toast({ title: "Número vinculado com sucesso!" }); setTimeout(() => setPhoneSaved(false), 2000); },
    onError: () => toast({ title: "Erro ao salvar número", variant: "destructive" }),
  });

  const wStatus = status?.status || "disconnected";

  const statusConfig = {
    disconnected: { label: "Desconectado", color: "#FF1744", icon: WifiOff },
    qr_pending:   { label: "Aguardando QR", color: "#FFA000", icon: QrCode },
    connected:    { label: "Conectado", color: "#00E5C8", icon: Wifi },
  }[wStatus] || { label: "Desconectado", color: "#FF1744", icon: WifiOff };

  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-1">WhatsApp Bot</p>
        <p className="text-xs text-white/40 leading-relaxed">
          Envie mensagens para o número vinculado e o AXIS processa automaticamente — gastos, tarefas, hábitos e compromissos.
        </p>
      </div>

      <div className="rounded-2xl p-4 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <StatusIcon className="h-5 w-5" style={{ color: statusConfig.color }} />
          <div>
            <p className="text-sm font-semibold text-white">{statusConfig.label}</p>
            {wStatus === "connected" && status?.phone && (
              <p className="text-[11px] font-medium" style={{ color: "#00E5C8" }}>
                Bot conectado em {formatBotPhone(status.phone)}
              </p>
            )}
          </div>
        </div>
        {isAdmin && wStatus === "connected" ? (
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "rgba(255,23,68,0.1)", color: "#FF1744", border: "1px solid rgba(255,23,68,0.2)" }}
            data-testid="button-whatsapp-disconnect"
          >
            {disconnectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Desconectar"}
          </button>
        ) : isAdmin && wStatus === "disconnected" ? (
          <button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "rgba(0,229,200,0.1)", color: "#00E5C8", border: "1px solid rgba(0,229,200,0.2)" }}
            data-testid="button-whatsapp-connect"
          >
            {connectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Conectar"}
          </button>
        ) : null}
      </div>

      {isAdmin && wStatus === "qr_pending" && status?.qrCode && (
        <div className="rounded-2xl p-4 flex flex-col items-center gap-3" style={{ background: "rgba(255,160,0,0.05)", border: "1px solid rgba(255,160,0,0.2)" }}>
          <p className="text-xs text-white/60 text-center">Abra o WhatsApp → Aparelhos conectados → Escanear QR</p>
          <img src={status.qrCode} alt="QR Code WhatsApp" className="w-48 h-48 rounded-xl" data-testid="img-whatsapp-qr" />
          <div className="flex items-center gap-3">
            <p className="text-[10px] text-white/30">QR expira em 60s</p>
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
              style={{ color: "#FFA000", background: "rgba(255,160,0,0.1)", border: "1px solid rgba(255,160,0,0.25)" }}
              data-testid="button-whatsapp-new-qr"
            >
              {resetMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Gerar novo QR
            </button>
          </div>
        </div>
      )}

      {isAdmin && wStatus === "qr_pending" && !status?.qrCode && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-white/40" />
            <span className="text-xs text-white/40">Gerando QR code...</span>
          </div>
          <button
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
            style={{ color: "#FFA000", background: "rgba(255,160,0,0.1)", border: "1px solid rgba(255,160,0,0.25)" }}
            data-testid="button-whatsapp-new-qr-fallback"
          >
            <RefreshCw className="h-3 w-3" />
            Tentar novamente
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Seu número de WhatsApp</p>
        <p className="text-xs text-white/40">Vincule seu número para receber e enviar mensagens ao AXIS.</p>
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+55 11 99999-9999"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-white/20"
            data-testid="input-whatsapp-phone"
          />
          <button
            onClick={() => phoneMutation.mutate()}
            disabled={phoneMutation.isPending || !phone.trim()}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-40 transition-all"
            style={{ background: phoneSaved ? "rgba(0,229,200,0.15)" : "rgba(255,255,255,0.06)", color: phoneSaved ? "#00E5C8" : "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}
            data-testid="button-save-whatsapp-phone"
          >
            {phoneMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : phoneSaved ? <Check className="h-3.5 w-3.5" /> : "Salvar"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl p-4 space-y-2" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">Exemplos de mensagens</p>
        {[
          "gastei 50 no almoço",
          "criar tarefa reunião de equipe sexta",
          "hábito academia todo dia às 7h",
          "agendar consulta médica segunda 10h",
        ].map(ex => (
          <div key={ex} className="flex items-start gap-2">
            <MessageCircle className="h-3 w-3 text-white/20 mt-0.5 shrink-0" />
            <span className="text-[11px] text-white/35 italic">"{ex}"</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TAB_META: { id: Tab; label: string; description: string; icon: any; accent: string }[] = [
  { id: "renda",        label: "Renda",        description: "Salário e receitas",    icon: DollarSign,   accent: MINT },
  { id: "gastos",       label: "Gastos Fixos", description: "Contas recorrentes",    icon: ClipboardList, accent: CORAL },
  { id: "rotina",       label: "Rotina",       description: "Hábitos e horários",    icon: Calendar,      accent: LAVANDA },
  { id: "notificacoes", label: "Alertas",      description: "Avisos por e-mail",     icon: Bell,          accent: "#00E6FF" },
  { id: "whatsapp",     label: "WhatsApp",     description: "Integração com bot",    icon: MessageCircle, accent: "#25D366" },
];

export function SetupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>("renda");
  const [savedIncome, setSavedIncome] = useState("");
  const { toast } = useToast();

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
      toast({ title: "Erro ao concluir configuração", variant: "destructive" });
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
          {/* Left sidebar nav */}
          <div
            className="flex flex-col w-56 shrink-0 py-5 px-3"
            style={{ borderRight: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}
          >
            <div className="px-2 mb-5">
              <h2 className="text-sm font-bold text-white">Configurar perfil</h2>
              <p className="text-[11px] text-white/35 mt-0.5 leading-tight">A IA usará isso para personalizar tudo</p>
            </div>

            <nav className="flex flex-col gap-1 flex-1">
              {TAB_META.map((tab, idx) => {
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
                      style={{
                        background: isActive ? `${tab.accent}20` : "rgba(255,255,255,0.05)",
                      }}
                    >
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{ color: isActive ? tab.accent : "rgba(255,255,255,0.3)" }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-xs font-semibold leading-tight"
                        style={{ color: isActive ? "white" : "rgba(255,255,255,0.45)" }}
                      >
                        {tab.label}
                      </p>
                      <p
                        className="text-[10px] leading-tight mt-0.5"
                        style={{ color: isActive ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)" }}
                      >
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
                {finishMutation.isPending ? "Salvando..." : "Concluir configuração"}
              </button>
              <button
                onClick={onClose}
                className="w-full py-2 text-[11px] text-white/25 hover:text-white/45 transition-colors"
                data-testid="button-skip-setup"
              >
                Fazer depois
              </button>
            </div>
          </div>

          {/* Right content area */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Content header */}
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

            {/* Scrollable content */}
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
