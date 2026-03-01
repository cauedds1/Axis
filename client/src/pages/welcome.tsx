import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { ArrowRight, Mic, Calendar, CheckSquare, TrendingUp, Sparkles, Zap, Flame, Coffee, ShoppingCart, Car, LogOut } from "lucide-react";
import { useEffect } from "react";

const CORAL = "#FF6B6B";
const GOLD = "#FFB347";
const LAVANDA = "#A78BFA";
const MINT = "#4ECDC4";

const steps = [
  { n: "01", title: "Conte sobre você", desc: "Perguntas rápidas para o AXIS entender seu contexto e objetivos", active: true },
  { n: "02", title: "Ative os módulos", desc: "Escolha quais áreas da vida você quer organizar agora", active: false },
  { n: "03", title: "Comece a usar", desc: "Fale por voz, envie texto ou foto — o AXIS organiza tudo", active: false },
];

const bars = [55, 80, 40, 95, 60, 75, 50];

function FinanceCard({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative rounded-2xl p-4 overflow-hidden flex flex-col group"
      style={{ background: "rgba(255,255,255,0.028)", border: `1px solid ${CORAL}22` }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${CORAL}60, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${CORAL}08 0%, transparent 65%)` }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${CORAL}18`, border: `1px solid ${CORAL}28` }}>
            <TrendingUp className="w-3.5 h-3.5" style={{ color: CORAL }} />
          </div>
          <span className="text-white font-bold text-sm">Finanças</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${CORAL}15`, color: CORAL }}>Voz + texto</span>
      </div>

      <div className="flex items-end gap-1 mb-3 h-10">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.6, delay: delay + 0.2 + i * 0.05, ease: "easeOut" }}
            className="flex-1 rounded-sm"
            style={{ background: i === 3 ? CORAL : `${CORAL}30`, minHeight: 3 }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] text-white/35 mb-0.5">Gastos este mês</p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.6 }}
            className="text-base font-bold text-white"
          >R$3.240</motion.p>
        </div>
        <div className="space-y-1">
          {[
            { icon: Coffee, label: "Café R$8" },
            { icon: ShoppingCart, label: "Mercado R$180" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-[10px] text-white/35">
              <Icon className="w-2.5 h-2.5" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function AgendaCard({ delay }: { delay: number }) {
  const events = [
    { time: "09:00", label: "Daily standup", dot: GOLD },
    { time: "14:00", label: "Consulta médica", dot: CORAL },
    { time: "19:00", label: "Academia", dot: MINT },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative rounded-2xl p-4 overflow-hidden flex flex-col group"
      style={{ background: "rgba(255,255,255,0.028)", border: `1px solid ${GOLD}22` }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}60, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${GOLD}07 0%, transparent 65%)` }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}18`, border: `1px solid ${GOLD}28` }}>
            <Calendar className="w-3.5 h-3.5" style={{ color: GOLD }} />
          </div>
          <span className="text-white font-bold text-sm">Agenda</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${GOLD}15`, color: GOLD }}>Hoje</span>
      </div>

      <div className="space-y-2 flex-1">
        {events.map(({ time, label, dot }, i) => (
          <motion.div
            key={time}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: delay + 0.2 + i * 0.1 }}
            className="flex items-center gap-2.5"
          >
            <span className="text-[10px] text-white/30 w-10 flex-shrink-0 font-mono">{time}</span>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot, boxShadow: `0 0 6px ${dot}60` }} />
            <span className="text-xs text-white/65 truncate">{label}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" style={{ color: GOLD }} />
        <span className="text-[10px] text-white/30">IA sugere o melhor horário</span>
      </div>
    </motion.div>
  );
}

function TasksCard({ delay }: { delay: number }) {
  const tasks = [
    { label: "Enviar relatório", done: true },
    { label: "Responder emails", done: true },
    { label: "Reunião às 15h", done: false },
    { label: "Revisar proposta", done: false },
  ];
  const done = tasks.filter(t => t.done).length;
  const pct = Math.round((done / tasks.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative rounded-2xl p-4 overflow-hidden flex flex-col group"
      style={{ background: "rgba(255,255,255,0.028)", border: `1px solid ${LAVANDA}22` }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${LAVANDA}60, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${LAVANDA}07 0%, transparent 65%)` }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${LAVANDA}18`, border: `1px solid ${LAVANDA}28` }}>
            <CheckSquare className="w-3.5 h-3.5" style={{ color: LAVANDA }} />
          </div>
          <span className="text-white font-bold text-sm">Tarefas</span>
        </div>
        <span className="text-[10px] font-medium" style={{ color: LAVANDA }}>{done}/{tasks.length} feitas</span>
      </div>

      <div className="space-y-1.5 flex-1">
        {tasks.map(({ label, done: isDone }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: delay + 0.2 + i * 0.08 }}
            className="flex items-center gap-2"
          >
            <div
              className="w-3.5 h-3.5 rounded-[4px] flex items-center justify-center flex-shrink-0 border"
              style={{ background: isDone ? `${LAVANDA}25` : "transparent", borderColor: isDone ? LAVANDA : "rgba(255,255,255,0.12)" }}
            >
              {isDone && <div className="w-1.5 h-1.5 rounded-full" style={{ background: LAVANDA }} />}
            </div>
            <span className={`text-xs truncate ${isDone ? "line-through text-white/25" : "text-white/60"}`}>{label}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-3">
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: delay + 0.5, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${LAVANDA}, ${LAVANDA}80)` }}
          />
        </div>
        <p className="text-[10px] text-white/25 mt-1">{pct}% concluído hoje</p>
      </div>
    </motion.div>
  );
}

function HabitsCard({ delay }: { delay: number }) {
  const habits = [
    { label: "Meditar", streak: 12, color: CORAL },
    { label: "Exercício", streak: 8, color: GOLD },
    { label: "Leitura", streak: 21, color: MINT },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative rounded-2xl p-4 overflow-hidden flex flex-col group"
      style={{ background: "rgba(255,255,255,0.028)", border: `1px solid ${MINT}22` }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${MINT}60, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${MINT}07 0%, transparent 65%)` }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${MINT}18`, border: `1px solid ${MINT}28` }}>
            <Zap className="w-3.5 h-3.5" style={{ color: MINT }} />
          </div>
          <span className="text-white font-bold text-sm">Compromissos</span>
        </div>
        <div className="flex items-center gap-1">
          <Flame className="w-3 h-3" style={{ color: CORAL }} />
          <span className="text-[10px] font-bold" style={{ color: CORAL }}>Score 78</span>
        </div>
      </div>

      <div className="space-y-2.5 flex-1">
        {habits.map(({ label, streak, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2 + i * 0.1 }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/60">{label}</span>
              <div className="flex items-center gap-1">
                <Flame className="w-2.5 h-2.5" style={{ color }} />
                <span className="text-[10px] font-bold" style={{ color }}>{streak}d</span>
              </div>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(streak * 4, 100)}%` }}
                transition={{ duration: 0.7, delay: delay + 0.3 + i * 0.1, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{ background: color }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center gap-1.5">
        <Car className="w-3 h-3 text-white/20" />
        <span className="text-[10px] text-white/25">Sem dias pulados essa semana</span>
      </div>
    </motion.div>
  );
}

export default function Welcome() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "AXIS — Bem-vindo";
  }, []);

  const firstName = user?.firstName || "você";

  return (
    <div className="h-screen bg-[#080808] text-white overflow-hidden flex flex-col">
      <div className="absolute top-0 left-[20%] w-[600px] h-[350px] rounded-full pointer-events-none" style={{ background: `radial-gradient(ellipse, rgba(255,107,107,0.06) 0%, transparent 70%)`, filter: "blur(80px)" }} />
      <div className="absolute bottom-0 right-[10%] w-[500px] h-[350px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 65%)`, filter: "blur(70px)" }} />
      <div className="landing-grain" />

      <div className="relative z-10 flex flex-col h-full w-full max-w-[1400px] mx-auto px-12 xl:px-20 py-6">

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between mb-6 flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AXIS" className="w-16 h-16 rounded-xl object-cover" />
            <span className="text-base font-bold tracking-tight">AXIS</span>
          </div>
          <button
            onClick={() => { logout(); setLocation("/"); }}
            className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition-colors"
            data-testid="button-welcome-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-12 xl:gap-20 flex-1 min-h-0">

          <div className="flex flex-col justify-between">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <div className="flex items-center gap-2 mb-5">
                {([CORAL, GOLD, LAVANDA, MINT] as const).map((color, i) => (
                  <motion.div
                    key={color}
                    initial={{ scaleX: 0, opacity: 0 }}
                    animate={{ scaleX: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.15 + i * 0.08, ease: "easeOut" }}
                    style={{ background: color, transformOrigin: "left", width: [32, 20, 12, 8][i], height: 3, borderRadius: 99 }}
                  />
                ))}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.08] mb-4">
                <span className="text-white/35 block text-2xl md:text-3xl font-medium mb-1">Olá, {firstName}.</span>
                <span style={{ background: `linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.75) 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Bem-vindo ao{" "}
                </span>
                <span style={{ background: `linear-gradient(135deg, ${CORAL}, ${GOLD})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  AXIS.
                </span>
              </h1>

              <p className="text-white/45 text-base leading-relaxed">
                Um assistente que aprende como você pensa, fala e vive — e organiza tudo sem burocracia.
              </p>
            </motion.div>

            <div className="space-y-4">
              {steps.map((step, i) => (
                <motion.div
                  key={step.n}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.3 + i * 0.1 }}
                  className="flex gap-4 items-start"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 font-bold text-[11px]"
                    style={{
                      background: step.active ? `linear-gradient(135deg, ${CORAL}22, ${GOLD}22)` : "rgba(255,255,255,0.04)",
                      border: step.active ? `1px solid ${CORAL}40` : "1px solid rgba(255,255,255,0.07)",
                      color: step.active ? CORAL : "rgba(255,255,255,0.25)"
                    }}
                  >
                    {step.n}
                  </div>
                  <div>
                    <p className="text-white/85 font-semibold text-[15px] leading-tight mb-1">{step.title}</p>
                    <p className="text-white/38 text-sm leading-snug">{step.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              <button
                onClick={() => setLocation("/onboarding")}
                className="auth-submit-button flex items-center gap-2.5 px-6 py-4 rounded-xl font-semibold text-base w-full justify-center"
                data-testid="button-prosseguir"
              >
                <Mic className="w-4 h-4 opacity-75" />
                Prosseguir para configuração
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-center text-xs text-white/20 mt-3">
                Menos de 3 minutos · Pode pular qualquer etapa
              </p>
            </motion.div>
          </div>

          <div className="flex flex-col justify-between min-h-0">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[11px] font-semibold tracking-widest uppercase text-white/22 mb-3 flex-shrink-0"
            >
              O que está te esperando
            </motion.p>

            <div className="grid grid-cols-2 gap-3 flex-1" style={{ gridTemplateRows: "1fr 1fr" }}>
              <FinanceCard delay={0.25} />
              <AgendaCard delay={0.33} />
              <TasksCard delay={0.41} />
              <HabitsCard delay={0.49} />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
