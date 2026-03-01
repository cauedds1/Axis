import { Link } from "wouter";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";

const CORAL = "#FF6B6B";
const GOLD = "#FFB347";
const LAVANDA = "#A78BFA";
const CORAL_MUTED = "rgba(255,107,107,0.15)";
const GOLD_MUTED = "rgba(255,179,71,0.12)";
const LAVANDA_MUTED = "rgba(167,139,250,0.12)";

function AnimatedCounter({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    if (isInView) {
      animate(count, target, { duration: 2, ease: "easeOut" });
    }
  }, [isInView, target, count]);

  useEffect(() => {
    const unsubscribe = rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = `${prefix}${v}${suffix}`;
    });
    return unsubscribe;
  }, [rounded, prefix, suffix]);

  return <span ref={ref} className="tabular-nums">{prefix}0{suffix}</span>;
}

const demoExamples = [
  {
    input: '"Gastei 45 reais no almoço"',
    result: "R$ 45,00 · Alimentação · Almoço",
    label: "Gasto registrado",
    color: CORAL,
    bg: CORAL_MUTED,
  },
  {
    input: '"Reunião amanhã às 14h"',
    result: "Amanhã, 14:00 – 15:00 · Reunião",
    label: "Evento criado",
    color: GOLD,
    bg: GOLD_MUTED,
  },
  {
    input: '"Preciso estudar 2h por dia"',
    result: "Compromisso: Estudar · 2h/dia · Streak: 0",
    label: "Compromisso adicionado",
    color: LAVANDA,
    bg: LAVANDA_MUTED,
  },
];

function TypewriterDemo() {
  const [exampleIdx, setExampleIdx] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [phase, setPhase] = useState<"typing" | "result" | "pause">("typing");

  useEffect(() => {
    const example = demoExamples[exampleIdx];
    const text = example.input;

    if (phase === "typing") {
      setShowResult(false);
      setDisplayText("");
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setDisplayText(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setTimeout(() => setPhase("result"), 400);
        }
      }, 45);
      return () => clearInterval(interval);
    }

    if (phase === "result") {
      setShowResult(true);
      const timeout = setTimeout(() => setPhase("pause"), 2500);
      return () => clearTimeout(timeout);
    }

    if (phase === "pause") {
      const timeout = setTimeout(() => {
        setExampleIdx((prev) => (prev + 1) % demoExamples.length);
        setPhase("typing");
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [phase, exampleIdx]);

  const example = demoExamples[exampleIdx];

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: example.color }} />
          <span className="text-xs uppercase tracking-widest" style={{ color: example.color }}>
            Você diz
          </span>
        </div>
        <p className="text-xl md:text-2xl font-medium text-white/90 mb-6 min-h-[2em] font-mono" data-testid="text-demo-input">
          {displayText}
          <span className="animate-blink text-white/40">|</span>
        </p>

        <motion.div
          initial={false}
          animate={{ opacity: showResult ? 1 : 0, y: showResult ? 0 : 12 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="rounded-xl p-4" style={{ background: example.bg }}>
            <p className="text-xs uppercase tracking-widest mb-1" style={{ color: example.color }}>
              {example.label}
            </p>
            <p className="text-base md:text-lg font-semibold text-white/90" data-testid="text-demo-result">
              {example.result}
            </p>
          </div>
        </motion.div>
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {demoExamples.map((ex, i) => (
          <button
            key={i}
            onClick={() => { setExampleIdx(i); setPhase("typing"); }}
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              background: i === exampleIdx ? ex.color : "rgba(255,255,255,0.15)",
              transform: i === exampleIdx ? "scale(1.4)" : "scale(1)",
            }}
            data-testid={`button-demo-dot-${i}`}
          />
        ))}
      </div>
    </div>
  );
}

function OrbitalGraphic() {
  return (
    <div className="relative w-[240px] h-[240px] sm:w-[320px] sm:h-[320px] md:w-[420px] md:h-[420px]">
      <svg viewBox="0 0 420 420" className="w-full h-full" style={{ filter: "drop-shadow(0 0 40px rgba(255,107,107,0.1))" }}>
        <circle cx="210" cy="210" r="140" fill="none" stroke="rgba(255,107,107,0.08)" strokeWidth="1" />
        <circle cx="210" cy="210" r="100" fill="none" stroke="rgba(255,179,71,0.08)" strokeWidth="1" />
        <circle cx="210" cy="210" r="60" fill="none" stroke="rgba(167,139,250,0.08)" strokeWidth="1" />

        <g className="landing-orbit" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="350" cy="210" r="8" fill={CORAL} opacity="0.9" />
          <text x="350" y="235" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10" fontWeight="500">Finanças</text>
        </g>

        <g className="landing-orbit-reverse" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="310" cy="210" r="7" fill={GOLD} opacity="0.9" />
          <text x="310" y="233" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10" fontWeight="500">Agenda</text>
        </g>

        <g className="landing-orbit-slow" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="270" cy="210" r="6" fill={LAVANDA} opacity="0.9" />
          <text x="270" y="231" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="10" fontWeight="500">Compromissos</text>
        </g>

        <g className="landing-orbit-mid" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="150" cy="120" r="5" fill="rgba(255,107,107,0.6)" />
        </g>
        <g className="landing-orbit-reverse" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="280" cy="300" r="4" fill="rgba(255,179,71,0.5)" />
        </g>

        <defs>
          <clipPath id="orbital-logo-clip">
            <circle cx="210" cy="210" r="54" />
          </clipPath>
        </defs>
        <circle cx="210" cy="210" r="58" fill="rgba(255,107,107,0.08)" />
        <image href="/logo.png" x="152" y="152" width="116" height="116" clipPath="url(#orbital-logo-clip)" preserveAspectRatio="xMidYMid slice" />
      </svg>
    </div>
  );
}

function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="landing-float-1 absolute top-[15%] left-[10%] w-3 h-3 rounded-full" style={{ background: CORAL, opacity: 0.12 }} />
      <div className="landing-float-2 absolute top-[25%] right-[15%] w-2 h-2 rounded-full" style={{ background: GOLD, opacity: 0.1 }} />
      <div className="landing-float-3 absolute top-[60%] left-[8%] w-4 h-4 rounded-full" style={{ background: LAVANDA, opacity: 0.08 }} />
      <div className="landing-float-1 absolute top-[70%] right-[12%] w-2.5 h-2.5 rounded-full" style={{ background: CORAL, opacity: 0.1 }} />
      <div className="landing-float-2 absolute top-[40%] left-[80%] w-1.5 h-1.5 rounded-full" style={{ background: GOLD, opacity: 0.15 }} />
      <div className="landing-float-3 absolute top-[85%] left-[30%] w-3 h-3 rounded-full" style={{ background: LAVANDA, opacity: 0.06 }} />

      <div className="landing-float-2 absolute top-[20%] left-[45%] w-px h-16 rotate-45" style={{ background: `linear-gradient(to bottom, transparent, ${CORAL}20, transparent)` }} />
      <div className="landing-float-1 absolute top-[50%] right-[25%] w-px h-20 -rotate-12" style={{ background: `linear-gradient(to bottom, transparent, ${GOLD}15, transparent)` }} />
      <div className="landing-float-3 absolute top-[75%] left-[60%] w-px h-12 rotate-30" style={{ background: `linear-gradient(to bottom, transparent, ${LAVANDA}18, transparent)` }} />
    </div>
  );
}

function MiniFinanceChart() {
  const bars = [35, 60, 45, 80, 55, 70, 90];
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="flex items-end gap-1.5 h-20">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={isInView ? { height: `${h}%` } : {}}
          transition={{ delay: i * 0.08, duration: 0.5, ease: "easeOut" }}
          className="w-5 rounded-t"
          style={{ background: i === bars.length - 1 ? CORAL : `rgba(255,107,107,${0.2 + i * 0.08})` }}
        />
      ))}
    </div>
  );
}

function MiniCalendar() {
  const days = ["S", "T", "Q", "Q", "S", "S", "D"];
  const slots = [
    [0, 1, 0, 1],
    [1, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 1, 1],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((d, i) => (
        <div key={i} className="text-center text-[10px] text-white/40 mb-1">{d}</div>
      ))}
      {slots.map((col, ci) =>
        col.map((filled, ri) => (
          <div
            key={`${ci}-${ri}`}
            className="h-3.5 rounded-sm"
            style={{
              background: filled ? `${GOLD}${filled ? "60" : "00"}` : "rgba(255,255,255,0.04)",
            }}
          />
        ))
      )}
    </div>
  );
}

function MiniHabits() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const habits = [
    { name: "Leitura", streak: 12, pct: 85 },
    { name: "Exercício", streak: 7, pct: 60 },
    { name: "Meditação", streak: 23, pct: 95 },
  ];

  return (
    <div ref={ref} className="space-y-2.5">
      {habits.map((h, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-white/60">{h.name}</span>
            <span style={{ color: LAVANDA }} className="font-mono text-[11px]">{h.streak}d</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={isInView ? { width: `${h.pct}%` } : {}}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: LAVANDA }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniChat() {
  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <div className="rounded-xl rounded-tr-sm px-3 py-2 text-xs text-white/80 max-w-[70%]"
          style={{ background: "rgba(255,107,107,0.15)" }}>
          Quanto gastei esse mês?
        </div>
      </div>
      <div className="flex justify-start">
        <div className="rounded-xl rounded-tl-sm px-3 py-2 text-xs text-white/80 max-w-[80%]"
          style={{ background: "rgba(255,179,71,0.12)" }}>
          Você gastou R$ 2.340 em fevereiro. 42% foi em alimentação.
        </div>
      </div>
    </div>
  );
}

function StepIllustration({ type }: { type: "voice" | "ai" | "done" }) {
  if (type === "voice") {
    return (
      <svg viewBox="0 0 60 60" className="w-14 h-14">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.rect
            key={i}
            x={8 + i * 10}
            y={20}
            width={4}
            rx={2}
            fill={CORAL}
            initial={{ height: 20 }}
            animate={{ height: [20, 10 + Math.random() * 30, 20] }}
            transition={{ duration: 0.8 + i * 0.1, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </svg>
    );
  }

  if (type === "ai") {
    return (
      <svg viewBox="0 0 60 60" className="w-14 h-14">
        <motion.circle cx="30" cy="30" r="18" fill="none" stroke={GOLD} strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1, rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        <motion.circle cx="30" cy="30" r="10" fill="none" stroke={GOLD} strokeWidth="1.5" opacity="0.5"
          animate={{ rotate: -360 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
        <circle cx="30" cy="30" r="3" fill={GOLD} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 60 60" className="w-14 h-14">
      <motion.path
        d="M 18 32 L 26 40 L 42 22"
        fill="none"
        stroke={LAVANDA}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2, ease: "easeOut" }}
      />
    </svg>
  );
}

const moduleShowcase = [
  {
    title: "Finanças",
    desc: "Registre por voz, texto, foto ou PDF. Veja pra onde vai cada real.",
    color: CORAL,
    bg: CORAL_MUTED,
    visual: <MiniFinanceChart />,
    extraContent: (
      <div className="mt-3 rounded-lg p-2.5 bg-white/[0.03] border border-white/5">
        <div className="flex justify-between text-xs">
          <span className="text-white/50">Almoço · Alimentação</span>
          <span style={{ color: CORAL }} className="font-mono">-R$ 45</span>
        </div>
      </div>
    ),
  },
  {
    title: "Agenda",
    desc: "Diga o compromisso. A IA sugere o horário. Você aprova.",
    color: GOLD,
    bg: GOLD_MUTED,
    visual: <MiniCalendar />,
    extraContent: null,
  },
  {
    title: "Tarefas & Compromissos",
    desc: "Streaks, progresso e score de disciplina. Tudo automático.",
    color: LAVANDA,
    bg: LAVANDA_MUTED,
    visual: <MiniHabits />,
    extraContent: null,
  },
  {
    title: "Chat Inteligente",
    desc: "Pergunte qualquer coisa sobre seus dados. A IA sabe tudo.",
    color: CORAL,
    bg: "rgba(255,107,107,0.08)",
    visual: <MiniChat />,
    extraContent: null,
  },
];

const steps = [
  { title: "Fale ou digite", desc: "Diga o que precisa. A IA escuta.", type: "voice" as const, color: CORAL },
  { title: "IA entende", desc: "Classifica, categoriza, organiza.", type: "ai" as const, color: GOLD },
  { title: "Pronto", desc: "Registrado automaticamente.", type: "done" as const, color: LAVANDA },
];

export default function Landing() {
  useEffect(() => {
    document.title = "AXIS — Organize sua vida. Por voz ou texto.";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "AXIS organiza finanças, agenda, tarefas e compromissos com inteligência artificial. Por voz ou texto.");
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden relative">
      <div className="landing-grain" />

      <header className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/[0.04]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AXIS" className="w-16 h-16 rounded-xl object-cover" />
            <span className="text-lg font-bold tracking-tight">AXIS</span>
          </div>
          <Link href="/auth">
            <Button
              variant="ghost"
              size="sm"
              className="text-white/70 border border-white/10"
              data-testid="button-header-login"
            >
              Entrar
            </Button>
          </Link>
        </div>
      </header>

      <section className="relative min-h-screen flex items-center justify-center px-6 pt-16">
        <FloatingShapes />
        <div className="absolute top-1/3 right-[15%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(255,107,107,0.06) 0%, rgba(255,179,71,0.03) 40%, transparent 70%)`, filter: "blur(60px)" }} />
        <div className="absolute bottom-[10%] left-[10%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 60%)`, filter: "blur(80px)" }} />
        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-20 max-w-6xl mx-auto">
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6" data-testid="text-hero-title">
                Organize{" "}
                <span className="landing-gradient-text">sua vida.</span>
                <br />
                <span className="text-white/50">Por voz ou texto.</span>
              </h1>
              <p className="text-lg md:text-xl text-white/40 max-w-lg mb-10 leading-relaxed" data-testid="text-hero-subtitle">
                Diga o que precisa. O AXIS entende, categoriza e organiza finanças, agenda, tarefas e compromissos automaticamente.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <Link href="/auth">
                <button
                  className="landing-cta-button group relative px-8 py-4 rounded-xl font-semibold text-base transition-all"
                  data-testid="button-hero-start"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Começar agora
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="flex-shrink-0"
          >
            <OrbitalGraphic />
          </motion.div>
        </div>

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2">
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-5 h-8 rounded-full border border-white/15 flex items-start justify-center p-1.5"
          >
            <div className="w-1 h-1.5 rounded-full bg-white/30" />
          </motion.div>
        </div>
      </section>

      <section className="py-28 px-6 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none" style={{ background: `radial-gradient(ellipse, rgba(255,107,107,0.04) 0%, rgba(255,179,71,0.02) 40%, transparent 70%)`, filter: "blur(60px)" }} />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: CORAL }}>
              Veja na prática
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight" data-testid="text-demo-title">
              Fale. O AXIS faz o resto.
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <TypewriterDemo />
          </motion.div>
        </div>
      </section>

      <div className="relative h-px w-full">
        <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[200px] pointer-events-none" style={{ background: `linear-gradient(90deg, transparent, rgba(167,139,250,0.05) 30%, rgba(255,179,71,0.04) 70%, transparent)`, filter: "blur(40px)" }} />
      </div>

      <section className="py-28 px-6 relative">
        <div className="absolute top-[20%] left-[-5%] w-[400px] h-[600px] rounded-full pointer-events-none" style={{ background: `radial-gradient(ellipse, rgba(255,107,107,0.05) 0%, transparent 60%)`, filter: "blur(80px)" }} />
        <div className="absolute top-[40%] right-[-5%] w-[350px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(ellipse, rgba(255,179,71,0.04) 0%, transparent 60%)`, filter: "blur(70px)" }} />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: GOLD }}>
              Módulos
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Tudo que você precisa.{" "}
              <span className="text-white/30">Nada que não precisa.</span>
            </h2>
          </motion.div>

          <div className="space-y-8">
            {moduleShowcase.map((mod, i) => (
              <motion.div
                key={mod.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
                className="landing-module-card group relative rounded-2xl p-[1px]"
                style={{ "--module-color": mod.color, "--module-color-rgb": mod.color === CORAL ? "255,107,107" : mod.color === GOLD ? "255,179,71" : "167,139,250" } as React.CSSProperties}
                data-testid={`panel-module-${mod.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="absolute inset-0 rounded-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-500" style={{ background: `linear-gradient(135deg, ${mod.color}25, transparent 50%, ${mod.color}08)` }} />

                <div className="relative rounded-2xl bg-[#0d0d0d] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full rounded-r" style={{ background: `linear-gradient(to bottom, ${mod.color}, ${mod.color}30)` }} />

                  <div className="absolute top-[-50%] left-[-20%] w-[300px] h-[300px] rounded-full pointer-events-none opacity-30 group-hover:opacity-50 transition-opacity duration-500" style={{ background: `radial-gradient(circle, ${mod.color}12, transparent 60%)`, filter: "blur(40px)" }} />

                  <div className="flex-1 relative z-10 pl-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${mod.color}15`, border: `1px solid ${mod.color}25` }}>
                        <div className="w-2 h-2 rounded-full" style={{ background: mod.color, boxShadow: `0 0 8px ${mod.color}60` }} />
                      </div>
                      <h3 className="text-xl md:text-2xl font-bold" style={{ color: mod.color }}>
                        {mod.title}
                      </h3>
                    </div>
                    <p className="text-white/50 text-base leading-relaxed max-w-md">
                      {mod.desc}
                    </p>
                  </div>

                  <div className="w-full md:w-60 flex-shrink-0 relative z-10">
                    <div className="rounded-xl p-4 border border-white/[0.06]" style={{ background: `linear-gradient(135deg, ${mod.color}08, rgba(255,255,255,0.02))` }}>
                      {mod.visual}
                      {mod.extraContent}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 px-6 relative">
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 20% 50%, rgba(255,107,107,0.03) 0%, transparent 50%), radial-gradient(ellipse at 80% 50%, rgba(167,139,250,0.03) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(255,179,71,0.02) 0%, transparent 40%)` }} />
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-center"
          >
            {[
              { value: 3, suffix: "s", prefix: "< ", label: "pra registrar um gasto", color: CORAL },
              { value: 5, suffix: "x", prefix: "", label: "menos toques que apps tradicionais", color: GOLD },
              { value: 0, suffix: "", prefix: "", label: "toques pra manter um compromisso", color: LAVANDA },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                data-testid={`stat-${i}`}
              >
                <div className="text-5xl md:text-6xl font-bold mb-2" style={{ color: stat.color }}>
                  <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
                </div>
                <p className="text-white/40 text-sm">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="py-28 px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full pointer-events-none" style={{ background: `radial-gradient(ellipse, rgba(167,139,250,0.04) 0%, transparent 60%)`, filter: "blur(60px)" }} />
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: LAVANDA }}>
              Como funciona
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Três passos. Zero esforço.
            </h2>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-4">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="flex-1 flex flex-col items-center text-center relative"
              >
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border border-white/[0.06]"
                  style={{ background: `${step.color}10` }}>
                  <StepIllustration type={step.type} />
                </div>
                <h3 className="text-lg font-bold mb-1" style={{ color: step.color }}>{step.title}</h3>
                <p className="text-white/40 text-sm">{step.desc}</p>

                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 -right-4 w-8">
                    <svg viewBox="0 0 32 8" className="w-full">
                      <motion.line
                        x1="0" y1="4" x2="28" y2="4"
                        stroke="rgba(255,255,255,0.12)" strokeWidth="1" strokeDasharray="4 3"
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + i * 0.2, duration: 0.6 }}
                      />
                      <motion.polygon
                        points="26,1 32,4 26,7"
                        fill="rgba(255,255,255,0.12)"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.8 + i * 0.2 }}
                      />
                    </svg>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 px-6 relative overflow-hidden">
        <div className="absolute inset-0 landing-cta-bg" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-cta-title">
              Pronto pra organizar sua vida?
            </h2>
            <p className="text-white/40 text-lg mb-10 max-w-md mx-auto">
              Crie sua conta em 30 segundos. Sem cartão. Sem compromisso.
            </p>
            <Link href="/auth">
              <button
                className="landing-cta-button group relative px-10 py-4 rounded-xl font-semibold text-base transition-all"
                data-testid="button-cta-start"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Criar minha conta
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="py-10 px-6 border-t border-white/[0.04]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/25">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AXIS" className="w-6 h-6 rounded object-cover opacity-60" />
            <span>AXIS 2026</span>
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white/50 transition-colors" data-testid="link-privacy">
              Privacidade
            </Link>
            <Link href="/terms" className="hover:text-white/50 transition-colors" data-testid="link-terms">
              Termos
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
