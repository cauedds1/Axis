import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowRight, ArrowLeft, Loader2, Shield, Lock, Eye, Settings, CheckCircle2, Zap, Target, Sparkles, Plus, X, TrendingDown, TrendingUp, RefreshCw } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ThemeSelector } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";

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

const RED: [number, number, number]  = [229, 62,  62 ];
const BLUE: [number, number, number] = [74,  144, 226];
const GREEN: [number, number, number]= [34,  197, 94 ];

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

interface Step {
  id: string;
  layer: 1 | 2 | 3 | 4;
  question: string;
  context: string;
  type: "text" | "select" | "slider" | "modules" | "theme" | "personality";
  options?: string[];
  field: string;
  placeholder?: string;
}

const steps: Step[] = [
  { id: "name", layer: 1, question: "Como posso te chamar?", context: "Para personalizar como o AXIS se comunica com você", type: "text", field: "firstName", placeholder: "Seu nome" },
  { id: "age", layer: 1, question: "Quantos anos você tem?", context: "Nos ajuda a calibrar metas e recomendações certas para o seu momento de vida", type: "text", field: "age", placeholder: "Ex: 28" },
  { id: "profession", layer: 1, question: "Qual sua profissão?", context: "Para entender seu contexto e categorizar melhor sua renda e gastos", type: "text", field: "profession", placeholder: "Ex: Designer, Engenheiro..." },
  { id: "city", layer: 1, question: "Em que cidade você mora?", context: "Para referências de custo de vida e contexto regional nas análises", type: "text", field: "city", placeholder: "Ex: São Paulo" },
  { id: "workType", layer: 1, question: "Qual seu tipo de trabalho?", context: "Define como vamos categorizar e analisar sua renda", type: "select", field: "workType", options: ["CLT", "PJ / Freelancer", "Empreendedor", "Estudante", "Outro"] },
  { id: "discipline", layer: 2, question: "De 1 a 10, como você avalia sua disciplina hoje?", context: "Seja honesto — isso é o ponto de partida real para o seu score. Não existe resposta errada.", type: "slider", field: "disciplineScore" },
  { id: "mainProblem", layer: 2, question: "Qual é o maior problema que você enfrenta hoje?", context: "O AXIS vai focar nessa área primeiro para te ajudar com o que mais importa", type: "text", field: "mainProblem", placeholder: "Ex: Não consigo organizar minhas finanças..." },
  { id: "feeling", layer: 2, question: "Como você se sente sobre sua vida agora?", context: "Calibra o tom e a abordagem do seu assistente", type: "select", field: "feelingStatus", options: ["Travado", "No piloto automático", "Crescendo devagar", "Evoluindo rápido", "No meu melhor"] },
  { id: "oneYearGoal", layer: 3, question: "Onde você quer estar daqui a 1 ano?", context: "Cria metas financeiras e de compromissos alinhadas ao que você realmente quer", type: "text", field: "oneYearGoal", placeholder: "Ex: Ter economizado R$20k e estar num emprego melhor" },
  { id: "incomeGoal", layer: 3, question: "Quanto você quer estar ganhando por mês?", context: "Define alertas, metas de economia e benchmarks financeiros personalizados", type: "text", field: "incomeGoal", placeholder: "Ex: R$8.000" },
  { id: "focusArea", layer: 3, question: "Qual área da sua vida você mais quer melhorar?", context: "Prioriza os módulos e sugestões mais relevantes para o seu objetivo principal", type: "select", field: "focusArea", options: ["Finanças", "Produtividade", "Saúde", "Carreira", "Relacionamentos", "Tudo"] },
  { id: "modules", layer: 4, question: "Quais módulos você quer ativar?", context: "Ative apenas o que vai usar — você pode mudar isso a qualquer momento", type: "modules", field: "activeModules" },
  { id: "personality", layer: 4, question: "Como você prefere que o AXIS fale com você?", context: "Define o tom de todas as respostas, alertas e sugestões do assistente", type: "personality", field: "aiPersonality" },
  { id: "theme", layer: 4, question: "Escolha seu visual", context: "Personalize a aparência do dashboard — pode mudar depois nas configurações", type: "theme", field: "theme" },
];

const LAYER_ENDS: Record<number, number> = { 1: 4, 2: 7, 3: 10, 4: 13 };
const LAYER_STARTS: Record<number, number> = { 1: 0, 2: 5, 3: 8, 4: 11 };

const layerInfo = {
  1: { label: "Perfil", color: CORAL, icon: "👤" },
  2: { label: "Situação", color: GOLD, icon: "📍" },
  3: { label: "Metas", color: LAVANDA, icon: "🎯" },
  4: { label: "Preferências", color: MINT, icon: "⚙️" },
};

const layerTransitions = [
  {
    fromLayer: 1 as const,
    toLayer: 2 as const,
    completedTitle: "Perfil básico pronto",
    completedItems: ["Nome e identidade registrados", "Profissão e contexto mapeados", "Localização e tipo de trabalho"],
    nextTitle: "Agora vamos entender sua situação atual",
    nextDesc: "Perguntas sobre onde você está hoje — honestas, sem julgamento e 100% confidenciais.",
    trustMsg: "Suas respostas ficam só entre você e o AXIS",
    color: GOLD,
  },
  {
    fromLayer: 2 as const,
    toLayer: 3 as const,
    completedTitle: "Situação atual mapeada",
    completedItems: ["Score de disciplina calculado", "Principal desafio identificado", "Momento de vida registrado"],
    nextTitle: "Agora suas metas e ambições",
    nextDesc: "Onde você quer chegar? Vamos criar um plano personalizado com base nos seus objetivos reais.",
    trustMsg: "Usamos isso só para criar metas e benchmarks úteis para você",
    color: LAVANDA,
  },
  {
    fromLayer: 3 as const,
    toLayer: 4 as const,
    completedTitle: "Metas registradas",
    completedItems: ["Objetivo de 1 ano definido", "Meta de renda configurada", "Área de foco estabelecida"],
    nextTitle: "Por fim, vamos personalizar sua experiência",
    nextDesc: "Escolha quais módulos ativar e como o AXIS deve se comunicar com você.",
    trustMsg: "Tudo pode ser ajustado depois nas configurações",
    color: MINT,
  },
];

const moduleOptions = [
  { id: "finance", label: "Finanças", desc: "Gastos, receitas e metas", color: CORAL },
  { id: "schedule", label: "Agenda", desc: "Compromissos e calendário", color: GOLD },
  { id: "tasks", label: "Tarefas", desc: "To-do list inteligente", color: LAVANDA },
  { id: "habits", label: "Compromissos", desc: "Streaks e disciplina", color: MINT },
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
      <div className="absolute top-[50%] left-[30%] w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(255,179,71,0.04) 0%, transparent 50%)`, filter: "blur(60px)" }} />
      <div className="landing-grain" />
      <div className="absolute top-[18%] left-[8%] w-1.5 h-1.5 rounded-full landing-float-1" style={{ background: CORAL, opacity: 0.14 }} />
      <div className="absolute top-[65%] right-[10%] w-1 h-1 rounded-full landing-float-2" style={{ background: GOLD, opacity: 0.12 }} />
      <div className="absolute bottom-[20%] left-[45%] w-2 h-2 rounded-full landing-float-3" style={{ background: LAVANDA, opacity: 0.1 }} />
    </>
  );
}

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-6 text-white overflow-hidden">
      <AmbientBackground color={CORAL} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 max-w-lg w-full text-center"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center justify-center gap-3 mb-10"
        >
          <img src="/logo.png" alt="AXIS" className="w-14 h-14 rounded-2xl object-cover" />
          <span className="text-2xl font-bold tracking-tight">AXIS</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-4xl font-bold tracking-tight leading-tight mb-4"
        >
          Antes de começar,{" "}
          <span style={{ background: `linear-gradient(135deg, ${CORAL}, ${GOLD})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            vamos te conhecer
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-white/50 text-base leading-relaxed mb-10"
        >
          Vamos fazer algumas perguntas para personalizar 100% da sua experiência.
          Alguns dados podem ser sensíveis — por isso explicamos <span className="text-white/70 font-medium">por que precisamos de cada informação</span>.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="grid grid-cols-3 gap-3 mb-10"
        >
          {[
            { icon: Lock, label: "Criptografado", desc: "Trafego e armazenamento seguros", color: CORAL },
            { icon: Eye, label: "Nunca vendido", desc: "Seus dados não são produto", color: GOLD },
            { icon: Settings, label: "Só para você", desc: "Apenas para personalização", color: LAVANDA },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl text-center"
              style={{ background: `${item.color}08`, border: `1px solid ${item.color}15` }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${item.color}12` }}>
                <item.icon className="w-4 h-4" style={{ color: item.color }} />
              </div>
              <span className="text-xs font-semibold text-white/80">{item.label}</span>
              <span className="text-[11px] text-white/35 leading-tight">{item.desc}</span>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center justify-center gap-2 mb-8 py-3 px-5 rounded-2xl mx-auto w-fit"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Shield className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs text-white/35">14 perguntas · cerca de 3 minutos</span>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          onClick={onStart}
          className="auth-submit-button w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
          data-testid="button-start-onboarding"
        >
          Começar configuração
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </motion.div>
    </div>
  );
}

function LayerTransitionScreen({
  transition,
  onContinue,
  onBack,
}: {
  transition: typeof layerTransitions[0];
  onContinue: () => void;
  onBack: () => void;
}) {
  const nextLayerInfo = layerInfo[transition.toLayer];
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-6 text-white overflow-hidden">
      <AmbientBackground color={transition.color} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-md w-full"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl p-6 mb-6"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <CheckCircle2 className="w-5 h-5" style={{ color: transition.color }} />
            <h3 className="font-semibold text-white/90">{transition.completedTitle}</h3>
          </div>
          <div className="space-y-2">
            {transition.completedItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.08 }}
                className="flex items-center gap-2.5"
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: transition.color, opacity: 0.7 }} />
                <span className="text-sm text-white/45">{item}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{nextLayerInfo.icon}</span>
            <span className="text-xs font-medium text-white/30 uppercase tracking-widest">{nextLayerInfo.label}</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-3" style={{ color: "white" }}>
            {transition.nextTitle}
          </h2>
          <p className="text-white/45 text-sm leading-relaxed">{transition.nextDesc}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="flex items-center gap-2 mb-6 py-2.5 px-4 rounded-xl w-fit"
          style={{ background: `${transition.color}0A`, border: `1px solid ${transition.color}18` }}
        >
          <Shield className="w-3.5 h-3.5" style={{ color: transition.color, opacity: 0.7 }} />
          <span className="text-xs" style={{ color: transition.color, opacity: 0.8 }}>{transition.trustMsg}</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="flex items-center gap-3"
        >
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors px-4 py-4 rounded-2xl flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            data-testid="button-transition-back"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <button
            onClick={onContinue}
            className="auth-submit-button flex-1 py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
            data-testid="button-transition-continue"
          >
            Continuar
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function Onboarding() {
  const [phase, setPhase] = useState<"intro" | "question" | "transition" | "diagnosis" | "setup" | "finished">("intro");
  const [currentStep, setCurrentStep] = useState(0);
  const [pendingTransition, setPendingTransition] = useState<typeof layerTransitions[0] | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({
    activeModules: ["finance", "schedule", "tasks", "habits"],
    aiPersonality: "calm",
    theme: "slim",
    disciplineScore: 5,
  });
  const [textInput, setTextInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSetupSubmitting, setIsSetupSubmitting] = useState(false);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);
  // Setup phase — structured items
  type SetupIncome  = { name: string; amount: number; dayOfMonth: number };
  type SetupBill    = { title: string; amount: number; dueDay: number };
  type SetupHabit   = { name: string; emoji: string; frequency: string; targetTime: string };
  const [setupIncomes, setSetupIncomes] = useState<SetupIncome[]>([]);
  const [setupBills,   setSetupBills  ] = useState<SetupBill[]>([]);
  const [setupHabits,  setSetupHabits ] = useState<SetupHabit[]>([]);
  // Income form
  const [riName,   setRiName  ] = useState("");
  const [riAmount, setRiAmount] = useState("");
  const [riDay,    setRiDay   ] = useState("5");
  // Bill form
  const [bTitle,  setBTitle ] = useState("");
  const [bAmount, setBAmount] = useState("");
  const [bDay,    setBDay   ] = useState("10");
  // Habit form
  const [hName,  setHName ] = useState("");
  const [hEmoji, setHEmoji] = useState("⚡");
  const [hFreq,  setHFreq ] = useState<"daily"|"weekly">("daily");
  const [hTime,  setHTime ] = useState("");
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { setTheme } = useTheme();

  const step = steps[currentStep];
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isLast = currentStep === steps.length - 1;
  const currentLayer = step?.layer ?? 1;
  const layerColor = layerInfo[currentLayer]?.color ?? CORAL;

  const setAnswer = useCallback((field: string, value: any) => {
    setAnswers(prev => ({ ...prev, [field]: value }));
  }, []);

  const commitTextAndAdvance = () => {
    if (step.type === "text" && textInput.trim()) {
      setAnswer(step.field, step.field === "age" ? parseInt(textInput) || textInput : textInput);
      setTextInput("");
    }
  };

  const tryGoNext = (stepIndex: number) => {
    const nextIndex = stepIndex + 1;
    if (nextIndex >= steps.length) return;
    const currentStepObj = steps[stepIndex];
    const nextStepObj = steps[nextIndex];
    if (currentStepObj.layer !== nextStepObj.layer) {
      const t = layerTransitions.find(lt => lt.fromLayer === currentStepObj.layer);
      if (t) {
        setPendingTransition(t);
        setCurrentStep(nextIndex);
        setPhase("transition");
        return;
      }
    }
    setCurrentStep(nextIndex);
  };

  const restoreTextForStep = useCallback((stepIndex: number) => {
    const target = steps[stepIndex];
    if (target?.type === "text") {
      const saved = answers[target.field];
      setTextInput(saved !== undefined ? String(saved) : "");
    } else {
      setTextInput("");
    }
  }, [answers]);

  const next = () => {
    commitTextAndAdvance();
    tryGoNext(currentStep);
  };

  const prev = () => {
    if (currentStep > 0) {
      const prevIndex = currentStep - 1;
      setCurrentStep(prevIndex);
      restoreTextForStep(prevIndex);
      setPhase("question");
    } else {
      setPhase("intro");
    }
  };

  const skip = () => {
    setTextInput("");
    tryGoNext(currentStep);
  };

  const finish = async () => {
    if (step.type === "text" && textInput.trim()) {
      setAnswer(step.field, textInput);
    }
    setIsSubmitting(true);
    try {
      const profileFields = ["age", "profession", "workType", "city", "disciplineScore", "mainProblem", "feelingStatus", "oneYearGoal", "incomeGoal", "focusArea"];
      const profile: Record<string, any> = {};
      for (const f of profileFields) {
        if (answers[f] !== undefined) profile[f] = answers[f];
      }
      setTheme(answers.theme || "slim");
      const res = await apiRequest("POST", "/api/onboarding", {
        profile,
        activeModules: answers.activeModules,
        theme: answers.theme,
        aiPersonality: answers.aiPersonality,
      });
      const data = await res.json();
      if (data.diagnosis) {
        setDiagnosis(data.diagnosis);
        setPhase("diagnosis");
      } else {
        await goToDashboard();
      }
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToDashboard = async () => {
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
        firstName: answers.firstName || null,
      });
    } catch {
      // silent — don't block dashboard navigation
    } finally {
      setIsSetupSubmitting(false);
    }
    await goToDashboard();
  };

  if (phase === "finished") {
    return (
      <div className="min-h-screen relative flex items-center justify-center bg-[#060608] text-white">
        <AmbientBackground color={CORAL} />
        <div className="relative z-10 text-center">
          <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-4" style={{ borderColor: `${CORAL}40`, borderTopColor: CORAL }} />
          <p className="text-white/40">Preparando seu dashboard...</p>
        </div>
      </div>
    );
  }

  if (phase === "diagnosis" && diagnosis) {
    return (
      <div className="min-h-screen relative flex items-center justify-center px-6 text-white overflow-hidden">
        <AmbientBackground color={LAVANDA} />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 max-w-md w-full"
        >
          <div className="flex items-center gap-2.5 mb-6">
            <Sparkles className="w-5 h-5" style={{ color: LAVANDA }} />
            <h2 className="text-2xl font-bold" data-testid="text-diagnosis-title">Seu diagnóstico AXIS</h2>
          </div>
          <div className="rounded-2xl p-6 mb-8" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
            <p className="text-sm leading-relaxed text-white/65" data-testid="text-diagnosis">{diagnosis}</p>
          </div>
          <button
            onClick={() => setPhase("setup")}
            className="auth-submit-button w-full py-4 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
            data-testid="button-go-setup"
          >
            Continuar <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  const SETUP_EMOJIS = ["⚡","🏃","📚","💧","🧘","🍎","😴","💊","🚶","🥗","💪","🎯"];

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

  const inputCls = "bg-transparent text-white text-sm outline-none placeholder:text-white/20 w-full";
  const fieldBox = { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" };
  const sectionCard = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16 };

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
            <Sparkles className="w-4 h-4" style={{ color: MINT }} />
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: MINT }}>Quase lá</span>
          </div>
          <h2 className="text-2xl font-bold mb-1">Olá, {answers.firstName || "você"}!</h2>
          <p className="text-sm text-white/45 mb-1">Configure o AXIS para te conhecer desde o primeiro dia.</p>
          <p className="text-xs text-white/25 mb-7">Tudo opcional — pode preencher depois nas configurações.</p>

          <div className="space-y-5">

            {/* ── RENDA ── */}
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

              <div className="flex gap-2 mt-1">
                <div className="flex-1 rounded-xl border px-3 py-2" style={fieldBox}>
                  <input value={riName} onChange={e => setRiName(e.target.value)} placeholder="Salário, Freelance…" className={inputCls} data-testid="input-ri-name" onKeyDown={e => e.key === "Enter" && addIncome()} />
                </div>
                <div className="w-24 rounded-xl border px-3 py-2 flex items-center gap-1" style={fieldBox}>
                  <span className="text-white/30 text-xs">R$</span>
                  <input value={riAmount} onChange={e => setRiAmount(e.target.value)} placeholder="0" type="number" className={`${inputCls} w-full`} data-testid="input-ri-amount" onKeyDown={e => e.key === "Enter" && addIncome()} />
                </div>
                <div className="w-20 rounded-xl border px-3 py-2 flex items-center gap-1" style={fieldBox}>
                  <span className="text-white/30 text-xs">dia</span>
                  <input value={riDay} onChange={e => setRiDay(e.target.value)} type="number" min={1} max={31} className={`${inputCls} w-full`} data-testid="input-ri-day" onKeyDown={e => e.key === "Enter" && addIncome()} />
                </div>
                <button onClick={addIncome} className="rounded-xl px-3 py-2 flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
                  style={{ background: "rgba(78,205,196,0.15)", border: "1px solid rgba(78,205,196,0.25)" }} data-testid="button-add-income">
                  <Plus className="w-4 h-4" style={{ color: "#4ECDC4" }} />
                </button>
              </div>
            </div>

            {/* ── GASTOS FIXOS ── */}
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

              <div className="flex gap-2 mt-1">
                <div className="flex-1 rounded-xl border px-3 py-2" style={fieldBox}>
                  <input value={bTitle} onChange={e => setBTitle(e.target.value)} placeholder="Aluguel, Netflix, Academia…" className={inputCls} data-testid="input-bill-title" onKeyDown={e => e.key === "Enter" && addBill()} />
                </div>
                <div className="w-24 rounded-xl border px-3 py-2 flex items-center gap-1" style={fieldBox}>
                  <span className="text-white/30 text-xs">R$</span>
                  <input value={bAmount} onChange={e => setBAmount(e.target.value)} placeholder="0" type="number" className={`${inputCls} w-full`} data-testid="input-bill-amount" onKeyDown={e => e.key === "Enter" && addBill()} />
                </div>
                <div className="w-20 rounded-xl border px-3 py-2 flex items-center gap-1" style={fieldBox}>
                  <span className="text-white/30 text-xs">dia</span>
                  <input value={bDay} onChange={e => setBDay(e.target.value)} type="number" min={1} max={31} className={`${inputCls} w-full`} data-testid="input-bill-day" onKeyDown={e => e.key === "Enter" && addBill()} />
                </div>
                <button onClick={addBill} className="rounded-xl px-3 py-2 flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
                  style={{ background: "rgba(255,107,107,0.12)", border: "1px solid rgba(255,107,107,0.25)" }} data-testid="button-add-bill">
                  <Plus className="w-4 h-4" style={{ color: "#FF6B6B" }} />
                </button>
              </div>
            </div>

            {/* ── HÁBITOS ── */}
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

              {/* emoji grid */}
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
                {(["daily","weekly"] as const).map(f => (
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

  if (phase === "intro") {
    return <IntroScreen onStart={() => setPhase("question")} />;
  }

  if (phase === "transition" && pendingTransition) {
    return (
      <LayerTransitionScreen
        transition={pendingTransition}
        onContinue={() => {
          setPendingTransition(null);
          setPhase("question");
        }}
        onBack={() => {
          const backIndex = LAYER_ENDS[pendingTransition.fromLayer];
          setPendingTransition(null);
          setCurrentStep(backIndex);
          restoreTextForStep(backIndex);
          setPhase("question");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen relative flex flex-col text-white overflow-hidden">
      <title>AXIS — Configuração inicial</title>
      <AmbientBackground color={layerColor} />

      <div className="relative z-10 h-1" style={{ background: "rgba(255,255,255,0.05)" }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4 }}
          style={{ background: `linear-gradient(90deg, ${CORAL}, ${GOLD})` }}
          data-testid="progress-onboarding"
        />
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: `${layerColor}12`, color: layerColor, border: `1px solid ${layerColor}20` }}
                  >
                    {layerInfo[currentLayer].icon} {layerInfo[currentLayer].label}
                  </span>
                </div>
                <span className="text-xs text-white/25" data-testid="text-step-counter">
                  {currentStep + 1} de {totalSteps}
                </span>
              </div>

              <h2 className="text-2xl font-bold mb-2 leading-snug" data-testid="text-onboarding-question">
                {step.question}
              </h2>
              <p className="text-sm text-white/35 mb-8 leading-relaxed">{step.context}</p>

              {step.type === "text" && (
                <form onSubmit={(e) => { e.preventDefault(); isLast ? finish() : next(); }}>
                  <input
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={step.placeholder}
                    className="auth-input text-base"
                    autoFocus
                    data-testid="input-onboarding"
                  />
                </form>
              )}

              {step.type === "select" && step.options && (
                <div className="space-y-2.5">
                  {step.options.map((opt) => {
                    const isSelected = answers[step.field] === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setAnswer(step.field, opt)}
                        className="w-full text-left px-5 py-3.5 rounded-xl border transition-all duration-200"
                        style={{
                          background: isSelected ? `${layerColor}10` : "rgba(255,255,255,0.03)",
                          borderColor: isSelected ? `${layerColor}50` : "rgba(255,255,255,0.07)",
                          boxShadow: isSelected ? `0 0 0 1px ${layerColor}30` : "none",
                        }}
                        data-testid={`button-option-${opt.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-white/85">{opt}</span>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: layerColor }} />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {step.type === "slider" && (
                <div className="space-y-8">
                  <div className="text-center">
                    <span
                      className="text-7xl font-bold transition-colors duration-300"
                      style={{ color: getDisciplineColor(answers.disciplineScore).hex }}
                      data-testid="text-slider-value"
                    >
                      {answers.disciplineScore}
                    </span>
                    <span className="text-2xl text-white/25 ml-1">/10</span>
                  </div>
                  <div
                    className="px-2"
                    style={{ "--primary": getDisciplineColor(answers.disciplineScore).hsl } as React.CSSProperties}
                  >
                    <Slider
                      value={[answers.disciplineScore]}
                      onValueChange={([v]) => setAnswer("disciplineScore", v)}
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
              )}

              {step.type === "modules" && (
                <div className="space-y-2.5">
                  {moduleOptions.map((mod) => {
                    const active = (answers.activeModules || []).includes(mod.id);
                    return (
                      <button
                        key={mod.id}
                        onClick={() => {
                          const current = answers.activeModules || [];
                          setAnswer("activeModules", active ? current.filter((m: string) => m !== mod.id) : [...current, mod.id]);
                        }}
                        className="w-full text-left px-5 py-3.5 rounded-xl border transition-all duration-200"
                        style={{
                          background: active ? `${mod.color}10` : "rgba(255,255,255,0.03)",
                          borderColor: active ? `${mod.color}50` : "rgba(255,255,255,0.07)",
                        }}
                        data-testid={`button-module-${mod.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-semibold text-white/85">{mod.label}</span>
                            <p className="text-xs text-white/35 mt-0.5">{mod.desc}</p>
                          </div>
                          {active && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: mod.color }} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {step.type === "personality" && (
                <div className="grid grid-cols-2 gap-2.5">
                  {personalityOptions.map((p) => {
                    const isSelected = answers.aiPersonality === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setAnswer("aiPersonality", p.id)}
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
              )}

              {step.type === "theme" && (
                <ThemeSelector
                  value={answers.theme || "slim"}
                  onChange={(t) => setAnswer("theme", t)}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-10">
            <button
              onClick={prev}
              disabled={phase === "question" && currentStep === 0}
              className="flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              data-testid="button-onboarding-back"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>

            <div className="flex gap-2.5 items-center">
              <button
                onClick={skip}
                className="text-sm text-white/25 hover:text-white/45 transition-colors px-2 py-1"
                data-testid="button-onboarding-skip"
              >
                Pular
              </button>
              {isLast ? (
                <button
                  onClick={finish}
                  disabled={isSubmitting}
                  className="auth-submit-button px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
                  data-testid="button-onboarding-finish"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Finalizar
                </button>
              ) : (
                <button
                  onClick={next}
                  className="auth-submit-button px-6 py-3 rounded-xl font-semibold text-sm flex items-center gap-2"
                  data-testid="button-onboarding-next"
                >
                  Próximo <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
