import { useState, Component } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, Plus, X, TrendingDown, TrendingUp, RefreshCw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeSelector } from "@/components/theme-toggle";
import { useTheme, type AxisTheme } from "@/components/theme-provider";

class StepErrorBoundary extends Component<
  { children: React.ReactNode; onError?: (err: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error("StepErrorBoundary caught:", error);
    this.props.onError?.(error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="py-6 space-y-3">
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13 }}>Erro ao carregar esta etapa.</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}
          >
            Tentar novamente
          </button>
          {this.state.error && (
            <details style={{ textAlign: "left" }}>
              <summary style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", cursor: "pointer" }}>Detalhes</summary>
              <code style={{ display: "block", marginTop: 6, fontSize: 9, color: "#FF6B6B", whiteSpace: "pre-wrap", wordBreak: "break-all", padding: 8, background: "rgba(255,107,107,0.06)", borderRadius: 6, maxHeight: 120, overflow: "auto" }}>
                {this.state.error.message}{"\n"}{this.state.error.stack?.slice(0, 400)}
              </code>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const CORAL = "#FF6B6B";
const GOLD = "#FFB347";
const LAVANDA = "#A78BFA";
const MINT = "#4ECDC4";

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}
function rgbToHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}
function rgbToHsl([r, g, b]: [number, number, number]): string {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

const RED: [number, number, number] = [229, 62, 62];
const BLUE: [number, number, number] = [74, 144, 226];
const GREEN: [number, number, number] = [34, 197, 94];

function getDisciplineColor(score: number): { hex: string; hsl: string } {
  const t = (score - 1) / 9;
  let rgb: [number, number, number];
  if (t <= 0.5) {
    rgb = lerpColor(RED, BLUE, t / 0.5);
  } else {
    rgb = lerpColor(BLUE, GREEN, (t - 0.5) / 0.5);
  }
  return { hex: rgbToHex(rgb), hsl: rgbToHsl(rgb) };
}

const moduleOptions = [
  { id: "finance", label: "Finanças", desc: "Gastos, receitas e metas", icon: "💰", color: CORAL },
  { id: "schedule", label: "Agenda", desc: "Compromissos e calendário", icon: "📅", color: GOLD },
  { id: "tasks", label: "Tarefas", desc: "To-do list inteligente", icon: "✅", color: LAVANDA },
  { id: "habits", label: "Hábitos", desc: "Streaks e disciplina", icon: "🔄", color: MINT },
];

const personalityOptions = [
  { id: "calm", label: "Calmo", desc: "Tranquilo e paciente", icon: "🌊" },
  { id: "direct", label: "Direto", desc: "Sem rodeios", icon: "⚡" },
  { id: "motivator", label: "Motivador", desc: "Sempre incentivando", icon: "🚀" },
  { id: "strict", label: "Rigoroso", desc: "Cobra resultados", icon: "🎯" },
];

function AmbientBackground({ color = CORAL }: { color?: string }) {
  return (
    <>
      <div className="absolute inset-0" style={{ background: "#060608" }} />
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${color}0D 0%, transparent 60%)`, filter: "blur(80px)" }} />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(167,139,250,0.06) 0%, transparent 55%)`, filter: "blur(70px)" }} />
      <div className="landing-grain" />
      <div className="absolute top-[18%] left-[8%] w-1.5 h-1.5 rounded-full landing-float-1" style={{ background: CORAL, opacity: 0.14 }} />
      <div className="absolute top-[65%] right-[10%] w-1 h-1 rounded-full landing-float-2" style={{ background: GOLD, opacity: 0.12 }} />
      <div className="absolute bottom-[20%] left-[45%] w-2 h-2 rounded-full landing-float-3" style={{ background: LAVANDA, opacity: 0.1 }} />
    </>
  );
}

type Phase = "question" | "setup";

export default function Onboarding() {
  const [step, setStep] = useState(0); // 0=nome 1=módulos 2=score 3=personalidade+tema
  const [direction, setDirection] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [activeModules, setActiveModules] = useState<string[]>(["finance", "schedule", "tasks", "habits"]);
  const [disciplineScore, setDisciplineScore] = useState(5);
  const [aiPersonality, setAiPersonality] = useState("calm");
  const [theme, setThemeVal] = useState<AxisTheme>("slim");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSetupSubmitting, setIsSetupSubmitting] = useState(false);
  const [phase, setPhase] = useState<Phase>("question");

  // Setup phase state
  type SetupIncome = { name: string; amount: number; dayOfMonth: number };
  type SetupBill = { title: string; amount: number; dueDay: number };
  type SetupHabit = { name: string; emoji: string; frequency: string; targetTime: string };
  const [setupIncomes, setSetupIncomes] = useState<SetupIncome[]>([]);
  const [setupBills, setSetupBills] = useState<SetupBill[]>([]);
  const [setupHabits, setSetupHabits] = useState<SetupHabit[]>([]);
  const [riName, setRiName] = useState("");
  const [riAmount, setRiAmount] = useState("");
  const [riDay, setRiDay] = useState("5");
  const [bTitle, setBTitle] = useState("");
  const [bAmount, setBAmount] = useState("");
  const [bDay, setBDay] = useState("10");
  const [hName, setHName] = useState("");
  const [hEmoji, setHEmoji] = useState("⚡");
  const [hFreq, setHFreq] = useState<"daily" | "weekly">("daily");
  const [hTime, setHTime] = useState("");

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setTheme } = useTheme();

  const TOTAL_STEPS = 4;

  const goNext = () => {
    setDirection(1);
    setStep(s => s + 1);
  };

  const goPrev = () => {
    setDirection(-1);
    setStep(s => s - 1);
  };

  const stepColors = [CORAL, GOLD, getDisciplineColor(disciplineScore).hex, LAVANDA];
  const currentColor = stepColors[step] ?? CORAL;

  const canProceed = () => {
    if (step === 0) return firstName.trim().length > 0;
    if (step === 1) return activeModules.length > 0;
    return true;
  };

  const finish = async () => {
    setIsSubmitting(true);
    try {
      setTheme(theme);
      await apiRequest("POST", "/api/onboarding", {
        profile: { firstName: firstName.trim(), disciplineScore },
        activeModules,
        theme,
        aiPersonality,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setPhase("setup");
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToDashboard = () => {
    queryClient.setQueryData(["/api/auth/user"], (old: any) =>
      old ? { ...old, onboardingCompleted: true } : old
    );
    queryClient.setQueryData(["/api/user/profile"], (old: any) =>
      old?.user ? { ...old, user: { ...old.user, onboardingCompleted: true } } : old
    );
    setLocation("/");
    queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
  };

  const addIncome = () => {
    const amt = parseFloat(riAmount);
    const day = parseInt(riDay);
    if (!riName.trim() || !amt || amt <= 0 || !day || day < 1 || day > 31) return;
    setSetupIncomes(prev => [...prev, { name: riName.trim(), amount: amt, dayOfMonth: day }]);
    setRiName(""); setRiAmount(""); setRiDay("5");
  };

  const addBill = () => {
    const amt = parseFloat(bAmount);
    const day = parseInt(bDay);
    if (!bTitle.trim() || !amt || amt <= 0 || !day || day < 1 || day > 31) return;
    setSetupBills(prev => [...prev, { title: bTitle.trim(), amount: amt, dueDay: day }]);
    setBTitle(""); setBAmount(""); setBDay("10");
  };

  const addHabit = () => {
    if (!hName.trim()) return;
    setSetupHabits(prev => [...prev, { name: hName.trim(), emoji: hEmoji, frequency: hFreq, targetTime: hTime }]);
    setHName(""); setHEmoji("⚡"); setHFreq("daily"); setHTime("");
  };

  const submitSetup = async () => {
    setIsSetupSubmitting(true);
    try {
      for (const inc of setupIncomes) {
        await apiRequest("POST", "/api/recurring-incomes", { ...inc, active: true });
      }
      for (const bill of setupBills) {
        await apiRequest("POST", "/api/bills", {
          ...bill, type: "expense", recurrenceType: "permanent", active: true, notes: null, category: null,
        });
      }
      for (const h of setupHabits) {
        await apiRequest("POST", "/api/habits", {
          name: h.name, emoji: h.emoji, frequency: h.frequency,
          targetTime: h.targetTime || null,
          weekdays: h.frequency === "weekly" ? "[]" : null,
        });
      }
      const totalIncome = setupIncomes.reduce((s, i) => s + i.amount, 0);
      await apiRequest("POST", "/api/onboarding/setup", {
        currentIncome: totalIncome > 0 ? totalIncome : null,
        fixedExpenses: null,
        routine: null,
        firstName: firstName || null,
      });
    } catch {
      // silent — don't block navigation
    } finally {
      setIsSetupSubmitting(false);
    }
    await goToDashboard();
  };

  const inputCls = "bg-transparent text-white text-sm outline-none placeholder:text-white/20 w-full";
  const fieldBox = { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" };
  const sectionCard = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 };
  const SETUP_EMOJIS = ["⚡", "🏃", "📚", "💧", "🧘", "🍎", "😴", "💊", "🚶", "🥗", "💪", "🎯"];

  if (phase === "setup") {
    return (
      <div className="min-h-screen relative flex items-start justify-center px-4 py-10 text-white overflow-y-auto">
        <AmbientBackground color={MINT} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-md w-full pb-6"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: MINT }}>Quase lá</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">Olá, {firstName || "você"}!</h2>
          <p className="text-sm text-white/45 mb-1">Configure o AXIS para te conhecer desde o primeiro dia.</p>
          <p className="text-xs text-white/25 mb-7">Tudo opcional — pode preencher depois nas configurações.</p>

          <div className="space-y-5">
            {/* RENDA */}
            <div style={sectionCard} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4" style={{ color: "#4ECDC4" }} />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Rendas automáticas</span>
              </div>
              {setupIncomes.map((inc, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2 mb-2"
                  style={{ background: "rgba(78,205,196,0.08)", border: "1px solid rgba(78,205,196,0.15)" }}>
                  <div>
                    <span className="text-sm text-white/80">{inc.name}</span>
                    <span className="text-xs text-white/40 ml-2">R${inc.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · dia {inc.dayOfMonth}</span>
                  </div>
                  <button onClick={() => setSetupIncomes(p => p.filter((_, j) => j !== i))} data-testid={`remove-income-${i}`}>
                    <X className="w-3.5 h-3.5 text-white/30 hover:text-white/70" />
                  </button>
                </div>
              ))}
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <div className="flex-1 rounded-xl border px-3 py-2" style={fieldBox}>
                  <input value={riName} onChange={e => setRiName(e.target.value)} placeholder="Salário, Freelance…" className={inputCls} data-testid="input-ri-name" onKeyDown={e => e.key === "Enter" && addIncome()} />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 sm:w-24 sm:flex-none rounded-xl border px-3 py-2 flex items-center gap-1" style={fieldBox}>
                    <span className="text-white/30 text-xs">R$</span>
                    <input value={riAmount} onChange={e => setRiAmount(e.target.value)} placeholder="0" type="number" className={`${inputCls} w-full`} data-testid="input-ri-amount" onKeyDown={e => e.key === "Enter" && addIncome()} />
                  </div>
                  <div className="w-20 rounded-xl border px-3 py-2 flex items-center gap-1" style={fieldBox}>
                    <span className="text-white/30 text-xs">dia</span>
                    <input value={riDay} onChange={e => setRiDay(e.target.value)} type="number" min={1} max={31} className={`${inputCls} w-full`} data-testid="input-ri-day" onKeyDown={e => e.key === "Enter" && addIncome()} />
                  </div>
                  <button onClick={addIncome} className="rounded-xl px-3 py-2 flex items-center justify-center shrink-0 transition-opacity hover:opacity-80 min-w-[44px]"
                    style={{ background: "rgba(78,205,196,0.15)", border: "1px solid rgba(78,205,196,0.25)" }} data-testid="button-add-income">
                    <Plus className="w-4 h-4" style={{ color: "#4ECDC4" }} />
                  </button>
                </div>
              </div>
            </div>

            {/* GASTOS FIXOS */}
            <div style={sectionCard} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4" style={{ color: "#FF6B6B" }} />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Gastos fixos mensais</span>
              </div>
              {setupBills.map((b, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2 mb-2"
                  style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.15)" }}>
                  <div>
                    <span className="text-sm text-white/80">{b.title}</span>
                    <span className="text-xs text-white/40 ml-2">R${b.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · dia {b.dueDay}</span>
                  </div>
                  <button onClick={() => setSetupBills(p => p.filter((_, j) => j !== i))} data-testid={`remove-bill-${i}`}>
                    <X className="w-3.5 h-3.5 text-white/30 hover:text-white/70" />
                  </button>
                </div>
              ))}
              <div className="flex flex-col sm:flex-row gap-2 mt-1">
                <div className="flex-1 rounded-xl border px-3 py-2" style={fieldBox}>
                  <input value={bTitle} onChange={e => setBTitle(e.target.value)} placeholder="Aluguel, Netflix, Academia…" className={inputCls} data-testid="input-bill-title" onKeyDown={e => e.key === "Enter" && addBill()} />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 sm:w-24 sm:flex-none rounded-xl border px-3 py-2 flex items-center gap-1" style={fieldBox}>
                    <span className="text-white/30 text-xs">R$</span>
                    <input value={bAmount} onChange={e => setBAmount(e.target.value)} placeholder="0" type="number" className={`${inputCls} w-full`} data-testid="input-bill-amount" onKeyDown={e => e.key === "Enter" && addBill()} />
                  </div>
                  <div className="w-20 rounded-xl border px-3 py-2 flex items-center gap-1" style={fieldBox}>
                    <span className="text-white/30 text-xs">dia</span>
                    <input value={bDay} onChange={e => setBDay(e.target.value)} type="number" min={1} max={31} className={`${inputCls} w-full`} data-testid="input-bill-day" onKeyDown={e => e.key === "Enter" && addBill()} />
                  </div>
                  <button onClick={addBill} className="rounded-xl px-3 py-2 flex items-center justify-center shrink-0 transition-opacity hover:opacity-80 min-w-[44px]"
                    style={{ background: "rgba(255,107,107,0.12)", border: "1px solid rgba(255,107,107,0.25)" }} data-testid="button-add-bill">
                    <Plus className="w-4 h-4" style={{ color: "#FF6B6B" }} />
                  </button>
                </div>
              </div>
            </div>

            {/* HÁBITOS */}
            <div style={sectionCard} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="w-4 h-4" style={{ color: "#A78BFA" }} />
                <span className="text-xs font-semibold uppercase tracking-wider text-white/60">Hábitos e rotina</span>
              </div>
              {setupHabits.map((h, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2 mb-2"
                  style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>
                  <div className="flex items-center gap-2">
                    <span>{h.emoji}</span>
                    <span className="text-sm text-white/80">{h.name}</span>
                    <span className="text-xs text-white/35">{h.frequency === "daily" ? "diário" : "semanal"}{h.targetTime ? ` · ${h.targetTime}` : ""}</span>
                  </div>
                  <button onClick={() => setSetupHabits(p => p.filter((_, j) => j !== i))} data-testid={`remove-habit-${i}`}>
                    <X className="w-3.5 h-3.5 text-white/30 hover:text-white/70" />
                  </button>
                </div>
              ))}
              <div className="flex gap-1.5 flex-wrap mb-3">
                {SETUP_EMOJIS.map(em => (
                  <button key={em} onClick={() => setHEmoji(em)}
                    className="w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all"
                    style={{
                      background: hEmoji === em ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${hEmoji === em ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.07)"}`,
                    }}
                    data-testid={`emoji-${em}`}
                  >{em}</button>
                ))}
              </div>
              <div className="flex gap-2 mb-2">
                <div className="flex-1 rounded-xl border px-3 py-2" style={fieldBox}>
                  <input value={hName} onChange={e => setHName(e.target.value)} placeholder="Exercitar, Meditar, Ler…" className={inputCls} data-testid="input-habit-name" onKeyDown={e => e.key === "Enter" && addHabit()} />
                </div>
                <div className="w-24 rounded-xl border px-3 py-2" style={fieldBox}>
                  <input value={hTime} onChange={e => setHTime(e.target.value)} placeholder="07:00" type="time" className={inputCls} data-testid="input-habit-time" />
                </div>
              </div>
              <div className="flex gap-2">
                {(["daily", "weekly"] as const).map(f => (
                  <button key={f} onClick={() => setHFreq(f)}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: hFreq === f ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${hFreq === f ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.07)"}`,
                      color: hFreq === f ? "#A78BFA" : "rgba(255,255,255,0.4)",
                    }}
                    data-testid={`freq-${f}`}
                  >{f === "daily" ? "Diário" : "Semanal"}</button>
                ))}
                <button onClick={addHabit}
                  className="rounded-xl px-4 py-2 flex items-center justify-center gap-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                  style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)", color: "#A78BFA" }}
                  data-testid="button-add-habit">
                  <Plus className="w-3.5 h-3.5" /> Adicionar
                </button>
              </div>
            </div>
          </div>

          <div className="mt-7 space-y-3">
            <button
              onClick={submitSetup}
              disabled={isSetupSubmitting}
              className="auth-submit-button w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="button-setup-submit"
            >
              {isSetupSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isSetupSubmitting ? "Salvando…" : "Salvar e ir ao dashboard"}
            </button>
            <button
              onClick={goToDashboard}
              disabled={isSetupSubmitting}
              className="w-full py-2 text-sm text-white/30 hover:text-white/50 transition-colors"
              data-testid="button-setup-skip"
            >
              Fazer depois →
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col text-white overflow-hidden">
      <title>AXIS — Configuração inicial</title>
      <AmbientBackground color={currentColor} />

      {/* Progress bar */}
      <div className="relative z-10 h-1" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
          transition={{ duration: 0.4 }}
          style={{ background: `linear-gradient(90deg, ${CORAL}, ${GOLD})` }}
          data-testid="progress-onboarding"
        />
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              initial={{ opacity: 0, x: direction * 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -32 }}
              transition={{ duration: 0.28 }}
            >
              {/* Step counter */}
              <div className="flex items-center justify-between mb-8">
                <div />
                <span className="text-xs text-white/25" data-testid="text-step-counter">
                  {step + 1} de {TOTAL_STEPS}
                </span>
              </div>

              {/* ── STEP 0: Nome ── */}
              {step === 0 && (
                <>
                  <h2 className="text-2xl font-bold mb-2 leading-snug" data-testid="text-onboarding-question">
                    Como posso te chamar?
                  </h2>
                  <p className="text-sm text-white/35 mb-8 leading-relaxed">Para personalizar como o AXIS se comunica com você</p>
                  <form onSubmit={(e) => { e.preventDefault(); if (canProceed()) goNext(); }}>
                    <input
                      value={firstName}
                      onChange={e => setFirstName(e.target.value)}
                      placeholder="Seu nome"
                      className="auth-input text-base"
                      autoFocus
                      data-testid="input-onboarding"
                    />
                  </form>
                </>
              )}

              {/* ── STEP 1: Módulos ── */}
              {step === 1 && (
                <>
                  <h2 className="text-2xl font-bold mb-2 leading-snug" data-testid="text-onboarding-question">
                    O que você quer usar?
                  </h2>
                  <p className="text-sm text-white/35 mb-8 leading-relaxed">Ative os módulos que fazem sentido para você — pode mudar a qualquer momento</p>
                  <div className="space-y-2.5">
                    {moduleOptions.map((mod) => {
                      const active = activeModules.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          onClick={() => {
                            setActiveModules(prev =>
                              active ? prev.filter(m => m !== mod.id) : [...prev, mod.id]
                            );
                          }}
                          className="w-full text-left px-5 py-3.5 rounded-xl border transition-all duration-200"
                          style={{
                            background: active ? `${mod.color}10` : "rgba(255,255,255,0.03)",
                            borderColor: active ? `${mod.color}50` : "rgba(255,255,255,0.07)",
                          }}
                          data-testid={`button-module-${mod.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{mod.icon}</span>
                              <div>
                                <span className="text-sm font-semibold text-white/85">{mod.label}</span>
                                <p className="text-xs text-white/35 mt-0.5">{mod.desc}</p>
                              </div>
                            </div>
                            {active && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: mod.color }} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── STEP 2: Score de disciplina ── */}
              {step === 2 && (
                <>
                  <h2 className="text-2xl font-bold mb-2 leading-snug" data-testid="text-onboarding-question">
                    De 1 a 10, como você avalia sua disciplina hoje?
                  </h2>
                  <p className="text-sm text-white/35 mb-8 leading-relaxed">Seja honesto — isso é o ponto de partida real do seu score. Não existe resposta errada.</p>
                  <div className="space-y-8">
                    <div className="text-center">
                      <span
                        className="text-7xl font-bold transition-colors duration-300"
                        style={{ color: getDisciplineColor(disciplineScore).hex }}
                        data-testid="text-slider-value"
                      >
                        {disciplineScore}
                      </span>
                      <span className="text-2xl text-white/25 ml-1">/10</span>
                    </div>
                    <div
                      className="px-2"
                      style={{ "--primary": getDisciplineColor(disciplineScore).hsl } as React.CSSProperties}
                    >
                      <Slider
                        value={[disciplineScore]}
                        onValueChange={(vals) => { if (vals.length > 0 && typeof vals[0] === "number") setDisciplineScore(vals[0]); }}
                        min={1}
                        max={10}
                        step={1}
                        className="py-4"
                        data-testid="slider-discipline"
                      />
                      <div className="flex justify-between mt-2">
                        <span className="text-xs text-white/25">Sem disciplina</span>
                        <span className="text-xs text-white/25">Máxima disciplina</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* ── STEP 3: Personalidade + Tema ── */}
              {step === 3 && (
                <StepErrorBoundary>
                  <>
                    <h2 className="text-2xl font-bold mb-2 leading-snug" data-testid="text-onboarding-question">
                      Como prefere que o AXIS fale com você?
                    </h2>
                    <p className="text-sm text-white/35 mb-6 leading-relaxed">Define o tom de todas as respostas e sugestões do assistente</p>

                    <div className="grid grid-cols-2 gap-2.5 mb-8">
                      {personalityOptions.map((p) => {
                        const isSelected = aiPersonality === p.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => setAiPersonality(p.id)}
                            className="text-left px-4 py-4 rounded-xl border transition-all duration-200"
                            style={{
                              background: isSelected ? `${LAVANDA}10` : "rgba(255,255,255,0.03)",
                              borderColor: isSelected ? `${LAVANDA}50` : "rgba(255,255,255,0.07)",
                            }}
                            data-testid={`button-personality-${p.id}`}
                          >
                            <div className="text-lg mb-1.5">{p.icon}</div>
                            <span className="text-sm font-semibold text-white/85 block">{p.label}</span>
                            <p className="text-xs text-white/35 mt-0.5">{p.desc}</p>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 mt-2" style={{ color: LAVANDA }} />}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-sm text-white/35 mb-4">Escolha seu visual</p>
                    <ThemeSelector
                      value={theme}
                      onChange={(t) => setThemeVal(t)}
                    />
                  </>
                </StepErrorBoundary>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10">
            <button
              onClick={goPrev}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              data-testid="button-onboarding-back"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>

            {step < TOTAL_STEPS - 1 ? (
              <button
                onClick={goNext}
                disabled={!canProceed()}
                className="auth-submit-button px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                data-testid="button-onboarding-next"
              >
                Próximo <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={isSubmitting}
                className="auth-submit-button px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
                data-testid="button-onboarding-finish"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isSubmitting ? "Salvando…" : "Concluir"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
