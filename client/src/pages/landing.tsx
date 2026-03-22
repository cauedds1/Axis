import { Link } from "wouter";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowRight, Mic, MessageSquare, TrendingUp, Calendar, ListChecks, Brain, Smartphone, Zap, ChevronDown, Volume2, Camera, FileText, Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useTheme, ALL_THEMES, type AxisTheme } from "@/components/theme-provider";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

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

function getDemoExamples(LP: LandingPalette, t: (k: string) => string) {
  return [
    { input: t("axisLanding.demo0Input"), result: t("axisLanding.demo0Result"), label: t("axisLanding.demo0Label"), color: LP.primary, bg: LP.primaryMuted, icon: <Mic className="w-4 h-4" /> },
    { input: t("axisLanding.demo1Input"), result: t("axisLanding.demo1Result"), label: t("axisLanding.demo1Label"), color: LP.secondary, bg: LP.secondaryMuted, icon: <Calendar className="w-4 h-4" /> },
    { input: t("axisLanding.demo2Input"), result: t("axisLanding.demo2Result"), label: t("axisLanding.demo2Label"), color: LP.tertiary, bg: LP.tertiaryMuted, icon: <ListChecks className="w-4 h-4" /> },
  ];
}

function TypewriterDemo() {
  const LP = useContext(LPContext);
  const { t } = useTranslation();
  const demoExamples = getDemoExamples(LP, t);
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
            {t("axisLanding.youSay")}
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
  const { t } = useTranslation();
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
          <text x="350" y="237" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="600">{t("axisLanding.orbitalFinance")}</text>
        </g>

        <g className="landing-orbit-reverse" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="310" cy="210" r="8" fill={LP.secondary} opacity="0.9" />
          <circle cx="310" cy="210" r="12" fill={LP.secondary} opacity="0.15" />
          <text x="310" y="235" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="600">{t("axisLanding.orbitalAgenda")}</text>
        </g>

        <g className="landing-orbit-slow" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="270" cy="210" r="7" fill={LP.tertiary} opacity="0.9" />
          <circle cx="270" cy="210" r="11" fill={LP.tertiary} opacity="0.15" />
          <text x="270" y="233" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="600">{t("axisLanding.orbitalHabits")}</text>
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
  const { t } = useTranslation();

  const messages = [
    { type: "user", text: t("axisLanding.waMsg0"), time: "14:32" },
    { type: "bot", text: t("axisLanding.waMsg1"), time: "14:32" },
    { type: "user", text: t("axisLanding.waMsg2Audio"), time: "14:33", isAudio: true },
    { type: "bot", text: t("axisLanding.waMsg3"), time: "14:33" },
    { type: "user", text: t("axisLanding.waMsg4"), time: "14:35" },
    { type: "bot", text: t("axisLanding.waMsg5"), time: "14:35" },
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
            <p className="text-white/60 text-[11px]">{t("axisLanding.waBotOnline")}</p>
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
            {t("axisLanding.waInputPlaceholder")}
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
  const { t } = useTranslation();
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
              <p className="text-sm font-bold text-white/90">{t("axisLanding.dashGreeting")}</p>
              <p className="text-[11px] text-white/40">{t("axisLanding.dashMonth")}</p>
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
                <span className="text-[10px] text-white/40">{t("axisLanding.dashDiscipline")}</span>
              </motion.div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: t("axisLanding.dashCardBalance"), value: "R$ 3.280", color: LP.success, change: "+12%" },
              { label: t("axisLanding.dashCardExpenses"), value: "R$ 1.420", color: LP.primary, change: "-8%" },
              { label: t("axisLanding.dashCardIncome"), value: "R$ 4.700", color: LP.secondary, change: "+5%" },
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
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">{t("axisLanding.dashMonthlyExp")}</p>
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
              <p className="text-xs text-white/40 uppercase tracking-wider mb-3">{t("axisLanding.dashPendingTasks")}</p>
              <div className="space-y-2">
                {[
                  { text: t("axisLanding.dashTask0"), priority: LP.primary, done: false },
                  { text: t("axisLanding.dashTask1"), priority: LP.secondary, done: false },
                  { text: t("axisLanding.dashTask2"), priority: LP.tertiary, done: true },
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
  const { t } = useTranslation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const habits = [
    { name: t("axisLanding.habit0"), streak: 12, pct: 85 },
    { name: t("axisLanding.habit1"), streak: 7, pct: 60 },
    { name: t("axisLanding.habit2"), streak: 23, pct: 95 },
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
  const { t } = useTranslation();
  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <div className="rounded-xl rounded-tr-sm px-3 py-2 text-xs text-white/80 max-w-[70%]"
          style={{ background: `rgba(${LP.primaryRgb},0.15)`, border: `1px solid rgba(${LP.primaryRgb},0.1)` }}>
          {t("axisLanding.miniChatQ")}
        </div>
      </div>
      <div className="flex justify-start">
        <div className="rounded-xl rounded-tl-sm px-3 py-2 text-xs text-white/80 max-w-[80%]"
          style={{ background: `rgba(${LP.secondaryRgb},0.12)`, border: `1px solid rgba(${LP.secondaryRgb},0.08)` }}>
          {t("axisLanding.miniChatA")}
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

function getModuleShowcase(LP: LandingPalette, t: (k: string) => string) {
  return [
    { title: t("axisLanding.mod0Title"), desc: t("axisLanding.mod0Desc"), color: LP.primary, bg: LP.primaryMuted, visual: <MiniFinanceChart />, icon: <TrendingUp className="w-5 h-5" />, features: [t("axisLanding.mod0F0"), t("axisLanding.mod0F1"), t("axisLanding.mod0F2"), t("axisLanding.mod0F3")] },
    { title: t("axisLanding.mod1Title"), desc: t("axisLanding.mod1Desc"), color: LP.secondary, bg: LP.secondaryMuted, visual: <MiniCalendar />, icon: <Calendar className="w-5 h-5" />, features: [t("axisLanding.mod1F0"), t("axisLanding.mod1F1"), t("axisLanding.mod1F2"), t("axisLanding.mod1F3")] },
    { title: t("axisLanding.mod2Title"), desc: t("axisLanding.mod2Desc"), color: LP.tertiary, bg: LP.tertiaryMuted, visual: <MiniHabits />, icon: <ListChecks className="w-5 h-5" />, features: [t("axisLanding.mod2F0"), t("axisLanding.mod2F1"), t("axisLanding.mod2F2"), t("axisLanding.mod2F3")] },
    { title: t("axisLanding.mod3Title"), desc: t("axisLanding.mod3Desc"), color: LP.primary, bg: `rgba(${LP.primaryRgb},0.08)`, visual: <MiniChat />, icon: <Brain className="w-5 h-5" />, features: [t("axisLanding.mod3F0"), t("axisLanding.mod3F1"), t("axisLanding.mod3F2"), t("axisLanding.mod3F3")] },
    { title: t("axisLanding.mod4Title"), desc: t("axisLanding.mod4Desc"), color: LP.success, bg: `rgba(${LP.successRgb},0.1)`, visual: (
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `rgba(${LP.successRgb},0.15)`, border: `1px solid rgba(${LP.successRgb},0.2)` }}>
          <Smartphone className="w-6 h-6" style={{ color: LP.success }} />
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-20 rounded-full" style={{ background: `rgba(${LP.successRgb},0.2)` }} />
          <div className="h-2 w-14 rounded-full" style={{ background: `rgba(${LP.successRgb},0.1)` }} />
        </div>
      </div>
    ), icon: <MessageSquare className="w-5 h-5" />, features: [t("axisLanding.mod4F0"), t("axisLanding.mod4F1"), t("axisLanding.mod4F2"), t("axisLanding.mod4F3")] },
  ];
}

function getSteps(LP: LandingPalette, t: (k: string) => string) {
  return [
    { title: t("axisLanding.step0Title"), desc: t("axisLanding.step0Desc"), type: "voice" as const, color: LP.primary },
    { title: t("axisLanding.step1Title"), desc: t("axisLanding.step1Desc"), type: "ai" as const, color: LP.secondary },
    { title: t("axisLanding.step2Title"), desc: t("axisLanding.step2Desc"), type: "done" as const, color: LP.tertiary },
  ];
}

function getMarqueeItems(t: (k: string) => string) {
  return [
    t("axisLanding.mq0"), t("axisLanding.mq1"), t("axisLanding.mq2"), t("axisLanding.mq3"),
    t("axisLanding.mq4"), t("axisLanding.mq5"), t("axisLanding.mq6"), t("axisLanding.mq7"),
    t("axisLanding.mq8"), t("axisLanding.mq9"), t("axisLanding.mq10"), t("axisLanding.mq11"),
  ];
}

function getFaqItems(t: (k: string) => string) {
  return [
    { q: t("axisLanding.faq0Q"), a: t("axisLanding.faq0A") },
    { q: t("axisLanding.faq1Q"), a: t("axisLanding.faq1A") },
    { q: t("axisLanding.faq2Q"), a: t("axisLanding.faq2A") },
    { q: t("axisLanding.faq3Q"), a: t("axisLanding.faq3A") },
    { q: t("axisLanding.faq4Q"), a: t("axisLanding.faq4A") },
    { q: t("axisLanding.faq5Q"), a: t("axisLanding.faq5A") },
    { q: t("axisLanding.faq6Q"), a: t("axisLanding.faq6A") },
  ];
}

function FAQItem({ item, index }: { item: { q: string; a: string }; index: number }) {
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
  const { t } = useTranslation();
  const LP = getLandingPalette(theme as AxisTheme);
  const moduleShowcase = getModuleShowcase(LP, t);
  const steps = getSteps(LP, t);
  const marqueeItems = getMarqueeItems(t);
  const faqItems = getFaqItems(t);

  const cycleTheme = () => {
    const idx = ALL_THEMES.indexOf(theme as AxisTheme);
    const next = ALL_THEMES[(idx + 1) % ALL_THEMES.length];
    setTheme(next);
  };

  const toggleLang = () => {
    const next = i18n.language === "pt-BR" ? "en" : "pt-BR";
    i18n.changeLanguage(next);
  };

  useEffect(() => {
    document.title = t("axisLanding.pageTitle");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", t("axisLanding.metaDesc"));
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
            <img src="/logo.png" alt="AXIS" className="w-12 h-12 rounded-xl object-cover" />
            <span className="text-lg font-bold tracking-tight">AXIS</span>
            <button
              onClick={cycleTheme}
              className="w-7 h-7 rounded-full flex items-center justify-center border border-white/10 hover:border-white/20 transition-all group relative"
              style={{ background: `rgba(${LP.primaryRgb},0.15)` }}
              title={`Tema: ${theme}`}
              data-testid="button-cycle-theme"
            >
              <Palette className="w-3 h-3 transition-colors" style={{ color: LP.primary }} />
              <span className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-[#08080f]" style={{ background: LP.primary }} />
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLang}
              className="hidden sm:flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border border-white/10 hover:border-white/25 transition-all"
              style={{ color: "rgba(255,255,255,0.45)" }}
              data-testid="button-lang-toggle"
            >
              <span style={{ color: i18n.language === "pt-BR" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)" }}>{t("axisLanding.langTogglePT")}</span>
              <span className="text-white/20">|</span>
              <span style={{ color: i18n.language === "en" ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)" }}>{t("axisLanding.langToggleEN")}</span>
            </button>
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
            <Link href="/auth">
              <Button
                className="landing-cta-button border-0 text-sm font-semibold px-5"
                size="sm"
                data-testid="button-header-login"
              >
                {t("axisLanding.headerStartFree")}
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
                {t("axisLanding.heroTitle1")}{" "}
                <span className="landing-gradient-text">{t("axisLanding.heroGradient")}</span>
                <br />
                <span className="text-white/50">{t("axisLanding.heroSub1")}</span>
                <br className="md:hidden" />
                <span className="text-white/50"> {t("axisLanding.heroSub2")}</span>
              </h1>
              <p className="text-lg md:text-xl text-white/45 max-w-lg mb-10 leading-relaxed" data-testid="text-hero-subtitle">
                {t("axisLanding.heroParagraph")}
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
                    {t("axisLanding.heroCta")}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </Link>
              <div className="flex items-center gap-2 text-sm text-white/30">
                <Check className="w-4 h-4" style={{ color: LP.success }} />
                <span>{t("axisLanding.heroNoCard")}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="flex items-center gap-6 mt-8"
            >
              {[
                { icon: <Mic className="w-3.5 h-3.5" />, label: t("axisLanding.inputVoice") },
                { icon: <MessageSquare className="w-3.5 h-3.5" />, label: t("axisLanding.inputText") },
                { icon: <Camera className="w-3.5 h-3.5" />, label: t("axisLanding.inputPhoto") },
                { icon: <FileText className="w-3.5 h-3.5" />, label: t("axisLanding.inputPDF") },
                { icon: <Smartphone className="w-3.5 h-3.5" />, label: t("axisLanding.inputWhatsApp") },
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
                {t("axisLanding.demoLabel")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-demo-title">
                {t("axisLanding.demoTitle1")} <span className="landing-gradient-text">{t("axisLanding.demoTitle2")}</span>
              </h2>
              <p className="text-white/35 text-base leading-relaxed mb-6 max-w-md">
                {t("axisLanding.demoDesc")}
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
                  { value: 3, suffix: "s", prefix: "< ", label: t("axisLanding.stat0Label"), color: LP.primary },
                  { value: 5, suffix: "x", prefix: "", label: t("axisLanding.stat1Label"), color: LP.secondary },
                  { value: 0, suffix: "", prefix: "", label: t("axisLanding.stat2Label"), color: LP.tertiary },
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
                  { icon: <Mic className="w-3.5 h-3.5" />, label: t("axisLanding.inputVoice"), color: LP.primary },
                  { icon: <MessageSquare className="w-3.5 h-3.5" />, label: t("axisLanding.inputText"), color: LP.secondary },
                  { icon: <Camera className="w-3.5 h-3.5" />, label: t("axisLanding.inputPhoto"), color: LP.tertiary },
                  { icon: <FileText className="w-3.5 h-3.5" />, label: t("axisLanding.inputPDF"), color: LP.accent },
                  { icon: <Smartphone className="w-3.5 h-3.5" />, label: t("axisLanding.inputWhatsApp"), color: LP.success },
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
                {t("axisLanding.waTitle1")}{" "}
                <span className="landing-whatsapp-glow">WhatsApp.</span>
                <br />
                <span className="text-white/40">{t("axisLanding.waTitle2")}</span>
              </h2>
              <p className="text-white/40 text-base leading-relaxed mb-6 max-w-md">
                {t("axisLanding.waDesc")}
              </p>
              <div className="flex flex-wrap gap-2 mb-8">
                {[t("axisLanding.waTag0"), t("axisLanding.waTag1"), t("axisLanding.waTag2"), t("axisLanding.waTag3"), t("axisLanding.waTag4")].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: `rgba(${LP.successRgb},0.1)`, color: LP.success, border: `1px solid rgba(${LP.successRgb},0.15)` }}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-3">
                {[
                  { cmd: t("axisLanding.waEx0Cmd"), result: t("axisLanding.waEx0Result"), color: LP.primary },
                  { cmd: t("axisLanding.waEx1Cmd"), result: t("axisLanding.waEx1Result"), color: LP.secondary },
                  { cmd: t("axisLanding.waEx2Cmd"), result: t("axisLanding.waEx2Result"), color: LP.success },
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
                  { value: 24, suffix: "h", label: t("axisLanding.waStat0"), color: LP.success },
                  { value: 2, suffix: "s", prefix: "< ", label: t("axisLanding.waStat1"), color: LP.secondary },
                  { value: 0, suffix: "", label: t("axisLanding.waStat2"), color: LP.tertiary },
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
              {t("axisLanding.dashLabel")}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              {t("axisLanding.dashTitle1")} <span className="landing-gradient-text">{t("axisLanding.dashTitle2")}</span>
            </h2>
            <p className="text-white/35 text-lg mt-4 max-w-lg mx-auto">
              {t("axisLanding.dashDesc")}
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
              {t("axisLanding.modulesLabel")}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              {t("axisLanding.modulesTitle1")}{" "}
              <span className="text-white/30">{t("axisLanding.modulesTitle2")}</span>
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
              {t("axisLanding.howLabel")}
            </p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
              {t("axisLanding.howTitle1")} <span className="text-white/30">{t("axisLanding.howTitle2")}</span>
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
              {t("axisLanding.faqLabel")}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight" data-testid="text-faq-title">
              {t("axisLanding.faqTitle")}
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
              {t("axisLanding.ctaTitle1")} <span className="landing-gradient-text">{t("axisLanding.ctaTitle2")}</span>
            </h2>
            <p className="text-white/40 text-lg mb-10 max-w-md mx-auto">
              {t("axisLanding.ctaDesc")}
            </p>
            <Link href="/auth">
              <button
                className="landing-cta-button group relative px-10 py-4 rounded-xl font-semibold text-base transition-all"
                data-testid="button-cta-start"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {t("axisLanding.ctaButton")}
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </Link>

            <div className="flex items-center justify-center gap-6 mt-6 text-xs text-white/25">
              <span className="flex items-center gap-1"><Check className="w-3 h-3" style={{ color: LP.success }} /> {t("axisLanding.ctaFree")}</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3" style={{ color: LP.success }} /> {t("axisLanding.ctaNoCard")}</span>
              <span className="flex items-center gap-1"><Check className="w-3 h-3" style={{ color: LP.success }} /> {t("axisLanding.ctaWhatsApp")}</span>
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
                {t("axisLanding.crossLabel")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                {t("axisLanding.crossTitle1")}{" "}
                <span className="landing-gradient-text">{t("axisLanding.crossTitle2")}</span>
              </h2>
              <p className="text-white/40 text-base leading-relaxed mb-8 max-w-md">
                {t("axisLanding.crossDesc")}
              </p>
              <div className="flex flex-wrap gap-2 mb-8">
                {[t("axisLanding.crossTag0"), t("axisLanding.crossTag1"), t("axisLanding.crossTag2"), t("axisLanding.crossTag3")].map((tag) => (
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
                    {t("axisLanding.crossButton")}
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
                  { step: "01", icon: <Camera className="w-4 h-4" />, title: t("axisLanding.crossStep0Title"), desc: t("axisLanding.crossStep0Desc"), result: t("axisLanding.crossStep0Result"), color: LP.primary, colorRgb: LP.primaryRgb },
                  { step: "02", icon: <Zap className="w-4 h-4" />, title: t("axisLanding.crossStep1Title"), desc: t("axisLanding.crossStep1Desc"), result: t("axisLanding.crossStep1Result"), color: LP.secondary, colorRgb: LP.secondaryRgb },
                  { step: "03", icon: <Check className="w-4 h-4" />, title: t("axisLanding.crossStep2Title"), desc: t("axisLanding.crossStep2Desc"), result: t("axisLanding.crossStep2Result"), color: LP.tertiary, colorRgb: LP.tertiaryRgb },
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
              {t("axisLanding.footerPrivacy")}
            </Link>
            <Link href="/terms" className="hover:text-white/50 transition-colors" data-testid="link-terms">
              {t("axisLanding.footerTerms")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
    </LPContext.Provider>
  );
}
