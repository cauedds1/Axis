import { Link } from "wouter";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowRight, Mic, MessageSquare, TrendingUp, Calendar, ListChecks, Brain, Smartphone, Zap, ChevronDown, Volume2, Camera, FileText, Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useTheme, ALL_THEMES, type AxisTheme } from "@/components/theme-provider";

interface LandingPalette {
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
  success: string;
  primaryRgb: string;
  secondaryRgb: string;
  tertiaryRgb: string;
  accentRgb: string;
  successRgb: string;
  primaryMuted: string;
  secondaryMuted: string;
  tertiaryMuted: string;
}

function getLandingPalette(theme: AxisTheme): LandingPalette {
  const palettes: Record<AxisTheme, LandingPalette> = {
    "high": {
      primary: "#FF6B6B", secondary: "#FFB347", tertiary: "#A78BFA", accent: "#00E6FF", success: "#4ECDC4",
      primaryRgb: "255,107,107", secondaryRgb: "255,179,71", tertiaryRgb: "167,139,250", accentRgb: "0,230,255", successRgb: "78,205,196",
      primaryMuted: "rgba(255,107,107,0.15)", secondaryMuted: "rgba(255,179,71,0.12)", tertiaryMuted: "rgba(167,139,250,0.12)",
    },
    "high-purple": {
      primary: "#B066FF", secondary: "#6478FF", tertiary: "#DC78C8", accent: "#E0A0FF", success: "#8BE0D0",
      primaryRgb: "176,102,255", secondaryRgb: "100,120,255", tertiaryRgb: "220,120,200", accentRgb: "224,160,255", successRgb: "139,224,208",
      primaryMuted: "rgba(176,102,255,0.15)", secondaryMuted: "rgba(100,120,255,0.12)", tertiaryMuted: "rgba(220,120,200,0.12)",
    },
    "high-gold": {
      primary: "#FFD426", secondary: "#FF9632", tertiary: "#DCB450", accent: "#FFE880", success: "#A0D890",
      primaryRgb: "255,212,38", secondaryRgb: "255,150,50", tertiaryRgb: "220,180,80", accentRgb: "255,232,128", successRgb: "160,216,144",
      primaryMuted: "rgba(255,212,38,0.15)", secondaryMuted: "rgba(255,150,50,0.12)", tertiaryMuted: "rgba(220,180,80,0.12)",
    },
    "high-coral": {
      primary: "#FF5C3A", secondary: "#FF8C32", tertiary: "#E66482", accent: "#FFB070", success: "#70D0B0",
      primaryRgb: "255,92,58", secondaryRgb: "255,140,50", tertiaryRgb: "230,100,130", accentRgb: "255,176,112", successRgb: "112,208,176",
      primaryMuted: "rgba(255,92,58,0.15)", secondaryMuted: "rgba(255,140,50,0.12)", tertiaryMuted: "rgba(230,100,130,0.12)",
    },
    "high-red": {
      primary: "#E8001C", secondary: "#CC0033", tertiary: "#FF2244", accent: "#FF6666", success: "#00CC66",
      primaryRgb: "232,0,28", secondaryRgb: "204,0,51", tertiaryRgb: "255,34,68", accentRgb: "255,102,102", successRgb: "0,204,102",
      primaryMuted: "rgba(232,0,28,0.15)", secondaryMuted: "rgba(204,0,51,0.12)", tertiaryMuted: "rgba(255,34,68,0.12)",
    },
    "slim": {
      primary: "#7A9E8A", secondary: "#9EAA8E", tertiary: "#8B9E7A", accent: "#B8C4A8", success: "#7A9E8A",
      primaryRgb: "122,158,138", secondaryRgb: "158,170,142", tertiaryRgb: "139,158,122", accentRgb: "184,196,168", successRgb: "122,158,138",
      primaryMuted: "rgba(122,158,138,0.15)", secondaryMuted: "rgba(158,170,142,0.12)", tertiaryMuted: "rgba(139,158,122,0.12)",
    },
    "slim-indigo": {
      primary: "#6B7FD9", secondary: "#8B9BD0", tertiary: "#7B8FC0", accent: "#A0ADE0", success: "#6B7FD9",
      primaryRgb: "107,127,217", secondaryRgb: "139,155,208", tertiaryRgb: "123,143,192", accentRgb: "160,173,224", successRgb: "107,127,217",
      primaryMuted: "rgba(107,127,217,0.15)", secondaryMuted: "rgba(139,155,208,0.12)", tertiaryMuted: "rgba(123,143,192,0.12)",
    },
    "slim-rose": {
      primary: "#C46B7A", secondary: "#D08B96", tertiary: "#B87A88", accent: "#E0A0AE", success: "#C46B7A",
      primaryRgb: "196,107,122", secondaryRgb: "208,139,150", tertiaryRgb: "184,122,136", accentRgb: "224,160,174", successRgb: "196,107,122",
      primaryMuted: "rgba(196,107,122,0.15)", secondaryMuted: "rgba(208,139,150,0.12)", tertiaryMuted: "rgba(184,122,136,0.12)",
    },
    "slim-amber": {
      primary: "#D4913A", secondary: "#C8A060", tertiary: "#B89050", accent: "#E0C090", success: "#D4913A",
      primaryRgb: "212,145,58", secondaryRgb: "200,160,96", tertiaryRgb: "184,144,80", accentRgb: "224,192,144", successRgb: "212,145,58",
      primaryMuted: "rgba(212,145,58,0.15)", secondaryMuted: "rgba(200,160,96,0.12)", tertiaryMuted: "rgba(184,144,80,0.12)",
    },
  };
  return palettes[theme] ?? palettes["high"];
}

const LPContext = createContext<LandingPalette>(getLandingPalette("high"));

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

function getDemoExamples(LP: LandingPalette) {
  return [
    { input: '"Gastei 45 reais no almoço"', result: "R$ 45,00 · Alimentação · Almoço", label: "Gasto registrado", color: LP.primary, bg: LP.primaryMuted, icon: <Mic className="w-4 h-4" /> },
    { input: '"Reunião amanhã às 14h"', result: "Amanhã, 14:00 – 15:00 · Reunião", label: "Evento criado", color: LP.secondary, bg: LP.secondaryMuted, icon: <Calendar className="w-4 h-4" /> },
    { input: '"Preciso estudar 2h por dia"', result: "Hábito: Estudar · 2h/dia · Streak: 0", label: "Hábito adicionado", color: LP.tertiary, bg: LP.tertiaryMuted, icon: <ListChecks className="w-4 h-4" /> },
  ];
}

function TypewriterDemo() {
  const LP = useContext(LPContext);
  const demoExamples = getDemoExamples(LP);
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${example.color}15, transparent 70%)`, filter: "blur(30px)" }} />

        <div className="flex items-center gap-3 mb-1 relative z-10">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: example.color }} />
          <span className="text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: example.color }}>
            {example.icon}
            Você diz
          </span>
        </div>
        <p className="text-xl md:text-2xl font-medium text-white/90 mb-6 min-h-[2em] font-mono relative z-10" data-testid="text-demo-input">
          {displayText}
          <span className="animate-blink text-white/40">|</span>
        </p>

        <motion.div
          initial={false}
          animate={{ opacity: showResult ? 1 : 0, y: showResult ? 0 : 12 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10"
        >
          <div className="rounded-xl p-4" style={{ background: example.bg, border: `1px solid ${example.color}25` }}>
            <div className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5" style={{ color: example.color }} />
              <p className="text-xs uppercase tracking-widest" style={{ color: example.color }}>
                {example.label}
              </p>
            </div>
            <p className="text-base md:text-lg font-semibold text-white/90 mt-1" data-testid="text-demo-result">
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
              boxShadow: i === exampleIdx ? `0 0 8px ${ex.color}60` : "none",
            }}
            data-testid={`button-demo-dot-${i}`}
          />
        ))}
      </div>
    </div>
  );
}

function OrbitalGraphic() {
  const LP = useContext(LPContext);
  return (
    <div className="relative w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] md:w-[440px] md:h-[440px]">
      <div className="absolute inset-0 rounded-full landing-pulse-ring" style={{ background: `radial-gradient(circle, ${LP.primary}08, transparent 70%)` }} />
      <svg viewBox="0 0 420 420" className="w-full h-full" style={{ filter: `drop-shadow(0 0 60px rgba(${LP.primaryRgb},0.12))` }}>
        <circle cx="210" cy="210" r="180" fill="none" stroke={`rgba(${LP.primaryRgb},0.06)`} strokeWidth="0.5" strokeDasharray="4 6" />
        <circle cx="210" cy="210" r="140" fill="none" stroke={`rgba(${LP.primaryRgb},0.1)`} strokeWidth="1" />
        <circle cx="210" cy="210" r="100" fill="none" stroke={`rgba(${LP.secondaryRgb},0.1)`} strokeWidth="1" />
        <circle cx="210" cy="210" r="60" fill="none" stroke={`rgba(${LP.tertiaryRgb},0.1)`} strokeWidth="1" />

        <g className="landing-orbit" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="350" cy="210" r="9" fill={LP.primary} opacity="0.9" />
          <circle cx="350" cy="210" r="14" fill={LP.primary} opacity="0.15" />
          <text x="350" y="237" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="600">Finanças</text>
        </g>

        <g className="landing-orbit-reverse" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="310" cy="210" r="8" fill={LP.secondary} opacity="0.9" />
          <circle cx="310" cy="210" r="12" fill={LP.secondary} opacity="0.15" />
          <text x="310" y="235" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="600">Agenda</text>
        </g>

        <g className="landing-orbit-slow" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="270" cy="210" r="7" fill={LP.tertiary} opacity="0.9" />
          <circle cx="270" cy="210" r="11" fill={LP.tertiary} opacity="0.15" />
          <text x="270" y="233" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="600">Hábitos</text>
        </g>

        <g className="landing-orbit-mid" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="150" cy="120" r="5" fill={`rgba(${LP.primaryRgb},0.7)`} />
        </g>
        <g className="landing-orbit-reverse" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="280" cy="300" r="4" fill={`rgba(${LP.secondaryRgb},0.6)`} />
        </g>
        <g className="landing-orbit" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="130" cy="280" r="3" fill={`rgba(${LP.tertiaryRgb},0.5)`} />
        </g>

        <defs>
          <clipPath id="orbital-logo-clip">
            <circle cx="210" cy="210" r="54" />
          </clipPath>
          <radialGradient id="logo-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={`rgba(${LP.primaryRgb},0.15)`} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle cx="210" cy="210" r="70" fill="url(#logo-glow)" />
        <circle cx="210" cy="210" r="58" fill={`rgba(${LP.primaryRgb},0.1)`} />
        <image href="/logo.png" x="152" y="152" width="116" height="116" clipPath="url(#orbital-logo-clip)" preserveAspectRatio="xMidYMid slice" />
      </svg>
    </div>
  );
}

function FloatingShapes() {
  const LP = useContext(LPContext);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="landing-float-1 absolute top-[15%] left-[10%] w-4 h-4 rounded-full" style={{ background: LP.primary, opacity: 0.15 }} />
      <div className="landing-float-2 absolute top-[25%] right-[15%] w-3 h-3 rounded-full" style={{ background: LP.secondary, opacity: 0.12 }} />
      <div className="landing-float-3 absolute top-[60%] left-[8%] w-5 h-5 rounded-full" style={{ background: LP.tertiary, opacity: 0.1 }} />
      <div className="landing-float-1 absolute top-[70%] right-[12%] w-3 h-3 rounded-full" style={{ background: LP.primary, opacity: 0.12 }} />
      <div className="landing-float-2 absolute top-[40%] left-[80%] w-2 h-2 rounded-full" style={{ background: LP.secondary, opacity: 0.18 }} />
      <div className="landing-float-3 absolute top-[85%] left-[30%] w-4 h-4 rounded-full" style={{ background: LP.tertiary, opacity: 0.08 }} />
      <div className="landing-float-1 absolute top-[50%] left-[50%] w-2 h-2 rounded-full" style={{ background: LP.success, opacity: 0.1 }} />

      <div className="landing-float-2 absolute top-[20%] left-[45%] w-px h-20 rotate-45" style={{ background: `linear-gradient(to bottom, transparent, ${LP.primary}30, transparent)` }} />
      <div className="landing-float-1 absolute top-[50%] right-[25%] w-px h-24 -rotate-12" style={{ background: `linear-gradient(to bottom, transparent, ${LP.secondary}25, transparent)` }} />
      <div className="landing-float-3 absolute top-[75%] left-[60%] w-px h-16 rotate-[30deg]" style={{ background: `linear-gradient(to bottom, transparent, ${LP.tertiary}25, transparent)` }} />
    </div>
  );
}

function WhatsAppSimulation() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const messages = [
    { type: "user", text: "Gastei 80 no mercado", time: "14:32" },
    { type: "bot", text: "Registrado! R$ 80,00 em Alimentação (Mercado). Seu gasto total do mês: R$ 1.420,00.", time: "14:32" },
    { type: "user", text: "Audio (0:03)", time: "14:33", isAudio: true },
    { type: "bot", text: "Transcrição: \"Reunião com o João amanhã às 15h\"\n\nEvento criado: Reunião com João\nAmanhã, 15:00 – 16:00", time: "14:33" },
    { type: "user", text: "Quanto gastei esse mês?", time: "14:35" },
    { type: "bot", text: "Este mês você gastou R$ 1.420,00\n\nAlimentação: R$ 580 (41%)\nTransporte: R$ 340 (24%)\nMoradia: R$ 500 (35%)", time: "14:35" },
  ];

  return (
    <div ref={ref} className="w-full max-w-md mx-auto">
      <div className="rounded-2xl overflow-hidden border border-white/10">
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #075E54, #128C7E)" }}>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
            <img src="/logo.png" alt="AXIS" className="w-7 h-7 rounded-full object-cover" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold">AXIS Bot</p>
            <p className="text-white/60 text-[11px]">online</p>
          </div>
          <div className="ml-auto flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </div>
        </div>

        <div className="p-4 space-y-3 min-h-[320px]" style={{ background: "linear-gradient(180deg, #0b1014 0%, #0d1117 100%)" }}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ delay: i * 0.4, duration: 0.4, ease: "easeOut" }}
              className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                data-testid={`text-whatsapp-msg-${i}`}
                className={`max-w-[80%] rounded-xl px-3.5 py-2.5 relative ${msg.type === "user" ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                style={{
                  background: msg.type === "user" ? "rgba(0,230,100,0.12)" : "rgba(255,255,255,0.06)",
                  border: msg.type === "user" ? "1px solid rgba(0,230,100,0.15)" : "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {msg.isAudio ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center">
                      <Volume2 className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div className="flex gap-0.5">
                      {[6, 10, 8, 14, 7, 12, 9, 16, 5, 11, 8, 13, 6, 15, 7, 10, 12, 8].map((h, j) => (
                        <div key={j} className="w-0.5 rounded-full bg-green-400/60" style={{ height: `${h}px` }} />
                      ))}
                    </div>
                    <span className="text-[10px] text-white/40 ml-1">0:03</span>
                  </div>
                ) : (
                  <p className="text-[13px] text-white/85 whitespace-pre-line leading-relaxed">{msg.text}</p>
                )}
                <p className="text-[10px] text-white/30 text-right mt-1">{msg.time}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: "#0d1117", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex-1 rounded-full px-4 py-2 text-xs text-white/30 bg-white/[0.04] border border-white/[0.06]">
            Digite uma mensagem...
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(0,230,100,0.15)" }}>
            <Mic className="w-4 h-4 text-green-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardPreview() {
  const LP = useContext(LPContext);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const bars = [35, 52, 45, 68, 40, 75, 90, 55, 62, 48, 70, 85];

  return (
    <div ref={ref} className="w-full max-w-3xl mx-auto">
      <div className="landing-app-window rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/70" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <div className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 rounded-md bg-white/[0.04] text-[11px] text-white/30 font-mono">myaxis.com.br/dashboard</div>
          </div>
        </div>

        <div className="p-5 md:p-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg overflow-hidden">
              <img src="/logo.png" alt="AXIS" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold text-white/90">Boa tarde, Lucas!</p>
              <p className="text-[11px] text-white/40">Março 2026</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={isInView ? { scale: 1 } : {}}
                transition={{ delay: 0.6, type: "spring" }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{ background: `rgba(${LP.successRgb},0.1)`, border: `1px solid rgba(${LP.successRgb},0.2)` }}
              >
                <Zap className="w-3.5 h-3.5" style={{ color: LP.success }} />
                <span className="text-xs font-bold" style={{ color: LP.success }}>7.2</span>
                <span className="text-[10px] text-white/40">disciplina</span>
              </motion.div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: "Saldo", value: "R$ 3.280", color: LP.success, change: "+12%" },
              { label: "Gastos", value: "R$ 1.420", color: LP.primary, change: "-8%" },
              { label: "Receitas", value: "R$ 4.700", color: LP.secondary, change: "+5%" },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1, duration: 0.5 }}
                className="rounded-xl p-3.5 border border-white/[0.06]"
                style={{ background: `linear-gradient(135deg, ${card.color}08, transparent)` }}
                data-testid={`panel-dashboard-${card.label.toLowerCase()}`}
              >
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{card.label}</p>
                <p className="text-lg font-bold text-white/90" data-testid={`text-dashboard-${card.label.toLowerCase()}`}>{card.value}</p>
                <p className="text-[11px] font-medium mt-0.5" style={{ color: card.color }}>{card.change}</p>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Gastos por Mês</p>
              <div className="flex items-end gap-1 h-24">
                {bars.map((h, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={isInView ? { height: `${h}%` } : {}}
                    transition={{ delay: 0.4 + i * 0.05, duration: 0.5, ease: "easeOut" }}
                    className="flex-1 rounded-t"
                    style={{ background: i === bars.length - 1 ? LP.primary : `rgba(${LP.primaryRgb},${0.15 + (i / bars.length) * 0.4})` }}
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]">
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Tarefas Pendentes</p>
              <div className="space-y-2">
                {[
                  { text: "Pagar fatura do cartão", priority: LP.primary, done: false },
                  { text: "Reunião com equipe", priority: LP.secondary, done: false },
                  { text: "Enviar relatório", priority: LP.tertiary, done: true },
                ].map((task, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={isInView ? { opacity: 1, x: 0 } : {}}
                    transition={{ delay: 0.6 + i * 0.12 }}
                    className="flex items-center gap-2.5"
                  >
                    <div className="w-4 h-4 rounded border flex items-center justify-center"
                      style={{ borderColor: task.done ? LP.success : "rgba(255,255,255,0.15)", background: task.done ? `${LP.success}20` : "transparent" }}>
                      {task.done && <Check className="w-2.5 h-2.5" style={{ color: LP.success }} />}
                    </div>
                    <span className={`text-xs ${task.done ? "line-through text-white/30" : "text-white/70"}`}>{task.text}</span>
                    <div className="w-1.5 h-1.5 rounded-full ml-auto" style={{ background: task.priority }} />
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.04]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">Hábitos hoje</span>
                  <span className="text-[11px] font-mono" style={{ color: LP.success }}>2/3</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={isInView ? { width: "66%" } : {}}
                    transition={{ delay: 0.9, duration: 0.7, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${LP.success}, ${LP.tertiary})` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniFinanceChart() {
  const LP = useContext(LPContext);
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
          style={{ background: i === bars.length - 1 ? LP.primary : `rgba(${LP.primaryRgb},${0.2 + i * 0.08})` }}
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
  const LP = useContext(LPContext);
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
              background: filled ? `${LP.secondary}60` : "rgba(255,255,255,0.04)",
            }}
          />
        ))
      )}
    </div>
  );
}

function MiniHabits() {
  const LP = useContext(LPContext);
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
            <span style={{ color: LP.tertiary }} className="font-mono text-[11px]">{h.streak}d</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={isInView ? { width: `${h.pct}%` } : {}}
              transition={{ delay: 0.3 + i * 0.15, duration: 0.7, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${LP.tertiary}, ${LP.tertiary}cc)` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MiniChat() {
  const LP = useContext(LPContext);
  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <div className="rounded-xl rounded-tr-sm px-3 py-2 text-xs text-white/80 max-w-[70%]"
          style={{ background: `rgba(${LP.primaryRgb},0.15)`, border: `1px solid rgba(${LP.primaryRgb},0.1)` }}>
          Quanto gastei esse mês?
        </div>
      </div>
      <div className="flex justify-start">
        <div className="rounded-xl rounded-tl-sm px-3 py-2 text-xs text-white/80 max-w-[80%]"
          style={{ background: `rgba(${LP.secondaryRgb},0.12)`, border: `1px solid rgba(${LP.secondaryRgb},0.08)` }}>
          Você gastou R$ 2.340 em fevereiro. 42% foi em alimentação.
        </div>
      </div>
    </div>
  );
}

function StepIllustration({ type, LP }: { type: "voice" | "ai" | "done"; LP: LandingPalette }) {
  if (type === "voice") {
    return (
      <svg viewBox="0 0 60 60" className="w-14 h-14">
        {([14, 30, 22, 38, 18] as const).map((h, i) => (
          <motion.rect
            key={i}
            x={8 + i * 10}
            y={20}
            width={4}
            rx={2}
            fill={LP.primary}
            initial={{ height: 20 }}
            animate={{ height: [20, h, 20] }}
            transition={{ duration: 0.8 + i * 0.1, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </svg>
    );
  }

  if (type === "ai") {
    return (
      <svg viewBox="0 0 60 60" className="w-14 h-14">
        <motion.circle cx="30" cy="30" r="18" fill="none" stroke={LP.secondary} strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1, rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        <motion.circle cx="30" cy="30" r="10" fill="none" stroke={LP.secondary} strokeWidth="1.5" opacity="0.5"
          animate={{ rotate: -360 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        />
        <circle cx="30" cy="30" r="3" fill={LP.secondary} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 60 60" className="w-14 h-14">
      <motion.path
        d="M 18 32 L 26 40 L 42 22"
        fill="none"
        stroke={LP.tertiary}
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

function getModuleShowcase(LP: LandingPalette) {
  return [
    { title: "Finanças", desc: "Registre gastos por voz, texto, foto de recibo ou PDF. A IA categoriza automaticamente e você acompanha pra onde vai cada real.", color: LP.primary, bg: LP.primaryMuted, visual: <MiniFinanceChart />, icon: <TrendingUp className="w-5 h-5" />, features: ["Foto de recibo", "PDF de extrato", "Categorização por IA", "Metas financeiras"] },
    { title: "Agenda", desc: "Diga o compromisso e a IA sugere o melhor horário. Aprove com um toque. Sem conflitos, sem esforço.", color: LP.secondary, bg: LP.secondaryMuted, visual: <MiniCalendar />, icon: <Calendar className="w-5 h-5" />, features: ["Sugestão inteligente", "Sem conflitos", "Aprovação rápida", "Lembretes"] },
    { title: "Tarefas & Hábitos", desc: "Streaks, progresso e score de disciplina automático. A IA avalia suas justificativas e te mantém no trilho.", color: LP.tertiary, bg: LP.tertiaryMuted, visual: <MiniHabits />, icon: <ListChecks className="w-5 h-5" />, features: ["Streaks diários", "Score de disciplina", "Justificativas IA", "Prioridades"] },
    { title: "Chat Inteligente", desc: "Pergunte qualquer coisa sobre seus dados. A IA tem memória de longo prazo e acesso total ao seu contexto.", color: LP.primary, bg: `rgba(${LP.primaryRgb},0.08)`, visual: <MiniChat />, icon: <Brain className="w-5 h-5" />, features: ["Memória longa", "Acesso total", "Análises", "Sugestões"] },
    { title: "WhatsApp Bot", desc: "Registre gastos, consulte saldo, crie tarefas e muito mais — tudo direto pelo WhatsApp. Manda áudio e o bot transcreve.", color: LP.success, bg: `rgba(${LP.successRgb},0.1)`, visual: (
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `rgba(${LP.successRgb},0.15)`, border: `1px solid rgba(${LP.successRgb},0.2)` }}>
          <Smartphone className="w-6 h-6" style={{ color: LP.success }} />
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-20 rounded-full" style={{ background: `rgba(${LP.successRgb},0.2)` }} />
          <div className="h-2 w-14 rounded-full" style={{ background: `rgba(${LP.successRgb},0.1)` }} />
        </div>
      </div>
    ), icon: <MessageSquare className="w-5 h-5" />, features: ["Áudio → texto", "Gastos por voz", "Consultar saldo", "Criar tarefas"] },
  ];
}

function getSteps(LP: LandingPalette) {
  return [
    { title: "Fale ou digite", desc: "Texto, voz, foto, PDF ou WhatsApp. Do jeito que for mais fácil.", type: "voice" as const, color: LP.primary },
    { title: "IA entende", desc: "Classifica, categoriza e organiza em milissegundos.", type: "ai" as const, color: LP.secondary },
    { title: "Pronto", desc: "Tudo registrado. Zero esforço. Vida organizada.", type: "done" as const, color: LP.tertiary },
  ];
}

const marqueeItems = [
  "Por voz ou texto",
  "WhatsApp integrado",
  "IA que aprende",
  "Score de disciplina",
  "Relatórios visuais",
  "Privacidade total",
  "Foto de recibo",
  "PDF de extrato",
  "Streaks diários",
  "Memória longa",
  "Zero configuração",
  "Áudio → Texto",
];

const faqItems = [
  { q: "O AXIS é gratuito?", a: "Sim! Você cria sua conta em segundos e tem acesso a todas as funcionalidades principais sem pagar nada — finanças, agenda, tarefas, hábitos, chat com IA e o bot do WhatsApp. Não pedimos cartão de crédito. A ideia é que você experimente o AXIS sem nenhuma barreira e sinta o impacto na sua rotina antes de qualquer coisa." },
  { q: "Funciona no WhatsApp?", a: "Funciona sim, e essa é uma das partes mais legais. Você conecta seu WhatsApp ao AXIS e passa a registrar gastos, criar tarefas, agendar compromissos e consultar seu saldo — tudo por mensagem de texto ou áudio. Mandou um áudio dizendo \"gastei 30 no uber\"? O bot transcreve, entende e registra automaticamente. Você nem precisa abrir o app pra manter tudo organizado." },
  { q: "Meus dados estão seguros?", a: "Totalmente. Seus dados são armazenados com criptografia e ficam completamente isolados — ninguém além de você tem acesso. Não vendemos, não compartilhamos e não usamos seus dados pra treinar modelos. Você tem controle total: pode exportar tudo ou excluir sua conta e todos os dados a qualquer momento, sem burocracia." },
  { q: "Preciso instalar algum app?", a: "Não precisa instalar nada. O AXIS funciona 100% no navegador, em qualquer dispositivo — computador, tablet ou celular. É só abrir o site e usar. E se preferir, o bot funciona direto no WhatsApp que você já tem instalado. Sem downloads, sem atualizações, sem ocupar espaço no celular." },
  { q: "Como a IA funciona?", a: "A IA do AXIS entende linguagem natural em português. Você fala ou digita do jeito que quiser — \"gastei 50 no almoço\", \"reunião com o João sexta às 15h\", \"quero ler 30 minutos por dia\" — e ela categoriza, organiza e registra tudo automaticamente. Com o tempo, ela aprende seus padrões de gastos, horários e hábitos, ficando cada vez mais precisa nas sugestões. Ela também avalia suas justificativas de hábitos e tarefas usando um score de disciplina gamificado." },
  { q: "Posso usar por voz?", a: "Com certeza. Você pode enviar áudios pelo WhatsApp ou usar o microfone direto no app. O AXIS transcreve o áudio em tempo real e interpreta o que você disse. Funciona também com fotos de recibos e PDFs de extratos bancários — a IA lê, extrai os valores e categoriza cada gasto automaticamente." },
  { q: "O que é o Score de Disciplina?", a: "É um sistema de gamificação que acompanha o quanto você está mantendo suas tarefas e hábitos em dia. Completar tarefas e manter streaks de hábitos aumenta seu score, enquanto atrasos e tarefas ignoradas diminuem. A IA também avalia suas justificativas — se você explicar por que não fez algo, ela pode aceitar parcialmente e reduzir a penalidade. É uma forma de te manter motivado sem ser punitivo." },
];

function FAQItem({ item, index }: { item: typeof faqItems[0]; index: number }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className="border-b border-white/[0.06] last:border-0"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 text-left group"
        data-testid={`button-faq-${index}`}
      >
        <span className="text-base font-medium text-white/80 group-hover:text-white transition-colors pr-4">{item.q}</span>
        <ChevronDown className={`w-4 h-4 text-white/30 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <p className="text-sm text-white/50 leading-relaxed pb-5">{item.a}</p>
      )}
    </motion.div>
  );
}

export default function Landing() {
  const { theme, setTheme } = useTheme();
  const LP = getLandingPalette(theme as AxisTheme);
  const moduleShowcase = getModuleShowcase(LP);
  const steps = getSteps(LP);

  const cycleTheme = () => {
    const idx = ALL_THEMES.indexOf(theme as AxisTheme);
    const next = ALL_THEMES[(idx + 1) % ALL_THEMES.length];
    setTheme(next);
  };

  useEffect(() => {
    document.title = "AXIS — Organize sua vida. Por voz, texto ou WhatsApp.";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "AXIS organiza finanças, agenda, tarefas e hábitos com inteligência artificial. Por voz, texto ou WhatsApp.");
  }, []);

  const cssVars = {
    "--lp-primary-rgb": LP.primaryRgb,
    "--lp-secondary-rgb": LP.secondaryRgb,
    "--lp-tertiary-rgb": LP.tertiaryRgb,
    "--lp-accent-rgb": LP.accentRgb,
    "--lp-success-rgb": LP.successRgb,
  } as React.CSSProperties;

  return (
    <LPContext.Provider value={LP}>
    <div className="min-h-screen landing-bg text-white overflow-x-hidden relative" style={cssVars}>
      <div className="landing-grain" />
      <div className="landing-grid-dots" />

      <div className="landing-blob absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.primaryRgb},0.12) 0%, transparent 60%)`, filter: "blur(80px)" }} />
      <div className="landing-blob-2 absolute top-[30%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.tertiaryRgb},0.1) 0%, transparent 60%)`, filter: "blur(80px)" }} />
      <div className="landing-blob-3 absolute top-[60%] left-[-8%] w-[450px] h-[450px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.secondaryRgb},0.08) 0%, transparent 60%)`, filter: "blur(80px)" }} />

      <header className="fixed top-0 w-full z-50 bg-[#08080f]/70 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AXIS" className="w-10 h-10 rounded-xl object-cover" />
            <span className="text-lg font-bold tracking-tight">AXIS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/business">
              <button
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 transition-all"
                style={{ color: "rgba(255,255,255,0.45)" }}
                data-testid="button-axis-business"
              >
                AXIS Business
                <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
            <button
              onClick={cycleTheme}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-white/10 hover:border-white/20 transition-all group relative"
              style={{ background: `rgba(${LP.primaryRgb},0.15)` }}
              title={`Tema: ${theme}`}
              data-testid="button-cycle-theme"
            >
              <Palette className="w-3.5 h-3.5 transition-colors" style={{ color: LP.primary }} />
              <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-[#08080f]" style={{ background: LP.primary }} />
            </button>
            <Link href="/auth">
              <Button
                className="landing-cta-button border-0 text-sm font-semibold px-5"
                size="sm"
                data-testid="button-header-login"
              >
                Começar grátis
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative min-h-screen flex items-center justify-center px-6 pt-16">
        <FloatingShapes />
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
                <span className="text-white/50">Por voz, texto</span>
                <br className="md:hidden" />
                <span className="text-white/50"> ou WhatsApp.</span>
              </h1>
              <p className="text-lg md:text-xl text-white/45 max-w-lg mb-10 leading-relaxed" data-testid="text-hero-subtitle">
                Diga o que precisa — o AXIS entende, categoriza e organiza finanças, agenda, tarefas e hábitos automaticamente. Na web ou direto no WhatsApp.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <Link href="/auth">
                <button
                  className="landing-cta-button group relative px-8 py-4 rounded-xl font-semibold text-base transition-all"
                  data-testid="button-hero-start"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Começar agora — é grátis
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </Link>
              <div className="flex items-center gap-2 text-sm text-white/30">
                <Check className="w-4 h-4" style={{ color: LP.success }} />
                <span>Sem cartão de crédito</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="flex items-center gap-6 mt-8"
            >
              {[
                { icon: <Mic className="w-3.5 h-3.5" />, label: "Voz" },
                { icon: <MessageSquare className="w-3.5 h-3.5" />, label: "Texto" },
                { icon: <Camera className="w-3.5 h-3.5" />, label: "Foto" },
                { icon: <FileText className="w-3.5 h-3.5" />, label: "PDF" },
                { icon: <Smartphone className="w-3.5 h-3.5" />, label: "WhatsApp" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-white/30 text-xs">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
              ))}
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

      <div className="landing-section-divider max-w-4xl mx-auto" />

      <section className="py-20 md:py-28 px-6 relative">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: LP.primary }}>
                Veja na prática
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-demo-title">
                Fale. O AXIS <span className="landing-gradient-text">faz o resto.</span>
              </h2>
              <p className="text-white/35 text-base leading-relaxed mb-6 max-w-md">
                Registre um gasto, crie um compromisso ou inicie um hábito — tudo com uma frase.
              </p>
              <TypewriterDemo />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="flex flex-col gap-6"
            >
              <div className="grid grid-cols-1 gap-4">
                {[
                  { value: 3, suffix: "s", prefix: "< ", label: "pra registrar um gasto", color: LP.primary },
                  { value: 5, suffix: "x", prefix: "", label: "menos toques que apps tradicionais", color: LP.secondary },
                  { value: 0, suffix: "", prefix: "", label: "toques pra manter um hábito", color: LP.tertiary },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.12 }}
                    className="flex items-center gap-5 rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]"
                    data-testid={`stat-${i}`}
                  >
                    <div className="text-4xl md:text-5xl font-bold tabular-nums" style={{ color: stat.color }}>
                      <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix} />
                    </div>
                    <p className="text-white/45 text-sm leading-snug">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  { icon: <Mic className="w-3.5 h-3.5" />, label: "Voz", color: LP.primary },
                  { icon: <MessageSquare className="w-3.5 h-3.5" />, label: "Texto", color: LP.secondary },
                  { icon: <Camera className="w-3.5 h-3.5" />, label: "Foto", color: LP.tertiary },
                  { icon: <FileText className="w-3.5 h-3.5" />, label: "PDF", color: LP.accent },
                  { icon: <Smartphone className="w-3.5 h-3.5" />, label: "WhatsApp", color: LP.success },
                ].map((input, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03]"
                    data-testid={`input-type-${i}`}
                  >
                    <span style={{ color: input.color }}>{input.icon}</span>
                    <span className="text-xs text-white/50">{input.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <div className="landing-section-divider max-w-4xl mx-auto" />

      <section className="py-20 md:py-28 px-6 relative">
        <div className="landing-blob-2 absolute top-[20%] right-[-15%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.successRgb},0.08) 0%, transparent 60%)`, filter: "blur(70px)" }} />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-whatsapp-title">
                Tudo pelo{" "}
                <span className="landing-whatsapp-glow">WhatsApp.</span>
                <br />
                <span className="text-white/40">Sem abrir o app.</span>
              </h2>
              <p className="text-white/40 text-base leading-relaxed mb-6 max-w-md">
                Mande uma mensagem de texto ou áudio pro bot do AXIS. Ele transcreve, entende e registra tudo automaticamente. Consulte saldo, veja tarefas pendentes, crie compromissos — tudo na conversa.
              </p>
              <div className="flex flex-wrap gap-2 mb-8">
                {["Áudio → Texto", "Registrar gastos", "Consultar saldo", "Criar tarefas", "Foto de recibo"].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: `rgba(${LP.successRgb},0.1)`, color: LP.success, border: `1px solid rgba(${LP.successRgb},0.15)` }}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-3">
                {[
                  { cmd: "Gastei 30 no uber", result: "Transporte registrado", color: LP.primary },
                  { cmd: "Reunião amanhã 14h", result: "Evento criado", color: LP.secondary },
                  { cmd: "Como tá meu saldo?", result: "R$ 3.280 disponível", color: LP.success },
                ].map((ex, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 border border-white/[0.06] bg-white/[0.02]"
                    data-testid={`panel-whatsapp-example-${i}`}
                  >
                    <span className="text-sm text-white/50 flex-1">"{ex.cmd}"</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                    <span className="text-sm font-medium flex-shrink-0" style={{ color: ex.color }}>{ex.result}</span>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mt-6">
                {[
                  { value: 24, suffix: "h", label: "Disponível", color: LP.success },
                  { value: 2, suffix: "s", prefix: "< ", label: "Resposta", color: LP.secondary },
                  { value: 0, suffix: "", label: "Downloads", color: LP.tertiary },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="text-center rounded-lg py-3 border border-white/[0.06] bg-white/[0.02]"
                    data-testid={`panel-whatsapp-stat-${i}`}
                  >
                    <div className="text-2xl font-bold tabular-nums" style={{ color: stat.color }}>
                      <AnimatedCounter target={stat.value} suffix={stat.suffix} prefix={stat.prefix || ""} />
                    </div>
                    <p className="text-[11px] text-white/35 mt-0.5">{stat.label}</p>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <WhatsAppSimulation />
            </motion.div>
          </div>
        </div>
      </section>

      <div className="landing-section-divider max-w-4xl mx-auto" />

      <section className="py-24 md:py-32 px-6 relative">
        <div className="landing-blob absolute top-[10%] left-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(255,107,107,0.06) 0%, transparent 60%)`, filter: "blur(70px)" }} />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: LP.secondary }}>
              Painel completo
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Tudo <span className="landing-gradient-text">num só lugar.</span>
            </h2>
            <p className="text-white/35 text-lg mt-4 max-w-lg mx-auto">
              Dashboard inteligente com tudo que você precisa ver em 30 segundos.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15, duration: 0.7 }}
          >
            <DashboardPreview />
          </motion.div>
        </div>
      </section>

      <div className="landing-section-divider max-w-4xl mx-auto" />

      <section className="py-24 md:py-32 px-6 relative">
        <div className="landing-blob-3 absolute top-[40%] right-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(167,139,250,0.08) 0%, transparent 60%)`, filter: "blur(70px)" }} />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: LP.tertiary }}>
              Módulos
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Tudo que você precisa.{" "}
              <span className="text-white/30">Nada que não precisa.</span>
            </h2>
          </motion.div>

          <div className="space-y-6">
            {moduleShowcase.map((mod, i) => (
              <motion.div
                key={mod.title}
                initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1, duration: 0.6, ease: "easeOut" }}
                className="landing-module-card group relative rounded-2xl p-[1px]"
                style={{ "--module-color": mod.color, "--module-color-rgb": mod.color === LP.primary ? LP.primaryRgb : mod.color === LP.secondary ? LP.secondaryRgb : mod.color === LP.tertiary ? LP.tertiaryRgb : mod.color === LP.success ? LP.successRgb : LP.primaryRgb } as React.CSSProperties}
                data-testid={`panel-module-${mod.title.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="absolute inset-0 rounded-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-500" style={{ background: `linear-gradient(135deg, ${mod.color}25, transparent 50%, ${mod.color}08)` }} />

                <div className="relative rounded-2xl bg-[#0d0d14] p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6 overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full rounded-r" style={{ background: `linear-gradient(to bottom, ${mod.color}, ${mod.color}30)` }} />
                  <div className="absolute top-[-50%] left-[-20%] w-[300px] h-[300px] rounded-full pointer-events-none opacity-30 group-hover:opacity-50 transition-opacity duration-500" style={{ background: `radial-gradient(circle, ${mod.color}15, transparent 60%)`, filter: "blur(40px)" }} />

                  <div className="flex-1 relative z-10 pl-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${mod.color}15`, border: `1px solid ${mod.color}25`, color: mod.color }}>
                        {mod.icon}
                      </div>
                      <h3 className="text-xl md:text-2xl font-bold" style={{ color: mod.color }}>
                        {mod.title}
                      </h3>
                    </div>
                    <p className="text-white/50 text-base leading-relaxed max-w-md mb-3">
                      {mod.desc}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {mod.features.map((f) => (
                        <span key={f} className="px-2 py-0.5 rounded text-[11px] text-white/40" style={{ background: `${mod.color}08`, border: `1px solid ${mod.color}12` }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="w-full md:w-56 flex-shrink-0 relative z-10">
                    <div className="rounded-xl p-4 border border-white/[0.06]" style={{ background: `linear-gradient(135deg, ${mod.color}08, rgba(255,255,255,0.02))` }}>
                      {mod.visual}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-8 relative overflow-hidden" data-testid="section-marquee">
        <div className="landing-marquee-container">
          <div className="landing-marquee">
            {[...marqueeItems, ...marqueeItems].map((item, i) => (
              <span key={i} className="landing-marquee-item">
                <span className="w-1.5 h-1.5 rounded-full inline-block mr-3" style={{ background: [LP.primary, LP.secondary, LP.tertiary, LP.success, LP.accent][i % 5] }} />
                {item}
              </span>
            ))}
          </div>
          <div className="landing-marquee landing-marquee-reverse" style={{ marginTop: "12px" }}>
            {[...marqueeItems.slice().reverse(), ...marqueeItems.slice().reverse()].map((item, i) => (
              <span key={i} className="landing-marquee-item">
                <span className="w-1.5 h-1.5 rounded-full inline-block mr-3" style={{ background: [LP.success, LP.tertiary, LP.primary, LP.accent, LP.secondary][i % 5] }} />
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-[#08080f] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-[#08080f] to-transparent z-10 pointer-events-none" />
      </section>

      <div className="landing-section-divider max-w-4xl mx-auto" />

      <section className="py-24 md:py-32 px-6 relative">
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: LP.secondary }}>
              Como funciona
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              Três passos. <span className="text-white/30">Zero esforço.</span>
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
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5 border border-white/[0.08]"
                  style={{ background: `${step.color}10` }}>
                  <StepIllustration type={step.type} LP={LP} />
                </div>
                <h3 className="text-lg font-bold mb-1" style={{ color: step.color }}>{step.title}</h3>
                <p className="text-white/40 text-sm max-w-[200px]">{step.desc}</p>

                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-10 -right-4 w-8">
                    <svg viewBox="0 0 32 8" className="w-full">
                      <motion.line
                        x1="0" y1="4" x2="28" y2="4"
                        stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3"
                        initial={{ pathLength: 0 }}
                        whileInView={{ pathLength: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.5 + i * 0.2, duration: 0.6 }}
                      />
                      <motion.polygon
                        points="26,1 32,4 26,7"
                        fill="rgba(255,255,255,0.15)"
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

      <div className="landing-section-divider max-w-4xl mx-auto" />

      <section className="py-24 md:py-32 px-6 relative">
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: LP.tertiary }}>
              Dúvidas frequentes
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-faq-title">
              Perguntas frequentes
            </h2>
          </motion.div>

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 md:px-8 divide-white/[0.06]">
            {faqItems.map((item, i) => (
              <FAQItem key={i} item={item} index={i} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-28 md:py-36 px-6 relative overflow-hidden">
        <div className="absolute inset-0 landing-cta-bg" />
        <div className="landing-blob absolute top-[20%] left-[30%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.primaryRgb},0.1) 0%, transparent 60%)`, filter: "blur(80px)" }} />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4" data-testid="text-cta-title">
              Pronto pra <span className="landing-gradient-text">organizar sua vida?</span>
            </h2>
            <p className="text-white/40 text-lg mb-10 max-w-md mx-auto">
              Crie sua conta em 30 segundos. Sem cartão. Sem compromisso. Use pelo navegador ou WhatsApp.
            </p>
            <Link href="/auth">
              <button
                className="landing-cta-button group relative px-10 py-4 rounded-xl font-semibold text-base transition-all"
                data-testid="button-cta-start"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Criar minha conta grátis
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </Link>

            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-white/25">
              <span className="flex items-center gap-1"><Check className="w-3 h-3" style={{ color: LP.success }} /> Grátis</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3" style={{ color: LP.success }} /> Sem cartão</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3" style={{ color: LP.success }} /> WhatsApp</span>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="landing-section-divider max-w-4xl mx-auto" />

      <section className="py-20 md:py-28 px-6 relative" data-testid="section-business-crosslink">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: LP.secondary }}>
                Para empresas
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Sua equipe também{" "}
                <span className="landing-gradient-text">merece isso.</span>
              </h2>
              <p className="text-white/40 text-base leading-relaxed mb-8 max-w-md">
                Com o AXIS Business, colaboradores enviam o recibo pelo WhatsApp e as despesas aparecem organizadas no painel — prontas pra aprovação e exportação. Sem planilha, sem papel perdido.
              </p>
              <div className="flex flex-wrap gap-2 mb-8">
                {["Foto → registrado", "IA extrai os dados", "Gestor aprova", "Exporta Excel"].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: `rgba(${LP.secondaryRgb},0.1)`, color: LP.secondary, border: `1px solid rgba(${LP.secondaryRgb},0.15)` }}>
                    {tag}
                  </span>
                ))}
              </div>
              <Link href="/business">
                <button
                  className="landing-cta-button group relative px-8 py-4 rounded-xl font-semibold text-base transition-all"
                  data-testid="button-crosslink-to-business"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Conhecer AXIS Business
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-1 gap-4"
            >
              <div className="relative">
                <div className="absolute left-[27px] top-[52px] h-[calc(100%-104px)] w-px pointer-events-none"
                  style={{ background: `linear-gradient(to bottom, rgba(${LP.primaryRgb},0.25), rgba(${LP.secondaryRgb},0.2), rgba(${LP.tertiaryRgb},0.15))` }} />
                {[
                  { step: "01", icon: <Camera className="w-4 h-4" />, title: "Colaborador fotografa o recibo", desc: "Envia pelo WhatsApp que já usa. Nenhum app novo pra baixar.", result: "foto salva no sistema", color: LP.primary, colorRgb: LP.primaryRgb },
                  { step: "02", icon: <Zap className="w-4 h-4" />, title: "IA registra e classifica", desc: "Estabelecimento, valor, categoria e imagem — tudo automático.", result: "despesa registrada", color: LP.secondary, colorRgb: LP.secondaryRgb },
                  { step: "03", icon: <Check className="w-4 h-4" />, title: "Gestor aprova e exporta", desc: "Painel com todas as despesas da equipe, relatório Excel em um clique.", result: "Excel exportado", color: LP.tertiary, colorRgb: LP.tertiaryRgb },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.14 }}
                    className="flex items-start gap-4 rounded-xl p-4 mb-3 last:mb-0 border-l-2 bg-white/[0.02]"
                    style={{ borderLeftColor: item.color, borderTopColor: "rgba(255,255,255,0.05)", borderRightColor: "rgba(255,255,255,0.05)", borderBottomColor: "rgba(255,255,255,0.05)", borderTopWidth: "1px", borderRightWidth: "1px", borderBottomWidth: "1px" }}
                    data-testid={`crosslink-step-${i}`}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `rgba(${item.colorRgb},0.12)`, border: `1px solid rgba(${item.colorRgb},0.2)` }}>
                      <span style={{ color: item.color }}>{item.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: item.color, opacity: 0.6 }}>{item.step}</span>
                        <p className="text-sm font-semibold text-white/85">{item.title}</p>
                      </div>
                      <p className="text-xs text-white/40 leading-relaxed mb-2">{item.desc}</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium" style={{ background: `rgba(${item.colorRgb},0.1)`, color: item.color }}>
                        <Check className="w-2.5 h-2.5" />
                        {item.result}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <footer className="py-10 px-6 border-t border-white/[0.06]">
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
    </LPContext.Provider>
  );
}
