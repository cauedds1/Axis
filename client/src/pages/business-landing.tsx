import { Link } from "wouter";
import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowRight, Camera, FileSpreadsheet, Users, Check, ArrowLeft, Building2, Smartphone, Receipt, BarChart3, Zap, Shield, ChevronRight, Mic, Calendar, Flame, Palette } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

type BizPalette = {
  primary: string; secondary: string; tertiary: string; accent: string; success: string;
  primaryRgb: string; secondaryRgb: string; tertiaryRgb: string; accentRgb: string; successRgb: string;
  primaryMuted: string; secondaryMuted: string; tertiaryMuted: string;
};

type BizTheme = "blue" | "indigo" | "teal" | "violet" | "emerald";
const BIZ_THEMES: BizTheme[] = ["blue", "indigo", "teal", "violet", "emerald"];

function getBizPalette(theme: BizTheme): BizPalette {
  const p: Record<BizTheme, BizPalette> = {
    blue: {
      primary: "#3B82F6", secondary: "#6366F1", tertiary: "#8B5CF6", accent: "#0EA5E9", success: "#10B981",
      primaryRgb: "59,130,246", secondaryRgb: "99,102,241", tertiaryRgb: "139,92,246", accentRgb: "14,165,233", successRgb: "16,185,129",
      primaryMuted: "rgba(59,130,246,0.15)", secondaryMuted: "rgba(99,102,241,0.12)", tertiaryMuted: "rgba(139,92,246,0.12)",
    },
    indigo: {
      primary: "#6366F1", secondary: "#8B5CF6", tertiary: "#A78BFA", accent: "#7C3AED", success: "#10B981",
      primaryRgb: "99,102,241", secondaryRgb: "139,92,246", tertiaryRgb: "167,139,250", accentRgb: "124,58,237", successRgb: "16,185,129",
      primaryMuted: "rgba(99,102,241,0.15)", secondaryMuted: "rgba(139,92,246,0.12)", tertiaryMuted: "rgba(167,139,250,0.12)",
    },
    teal: {
      primary: "#0EA5E9", secondary: "#06B6D4", tertiary: "#14B8A6", accent: "#38BDF8", success: "#10B981",
      primaryRgb: "14,165,233", secondaryRgb: "6,182,212", tertiaryRgb: "20,184,166", accentRgb: "56,189,248", successRgb: "16,185,129",
      primaryMuted: "rgba(14,165,233,0.15)", secondaryMuted: "rgba(6,182,212,0.12)", tertiaryMuted: "rgba(20,184,166,0.12)",
    },
    violet: {
      primary: "#7C3AED", secondary: "#8B5CF6", tertiary: "#A78BFA", accent: "#6D28D9", success: "#10B981",
      primaryRgb: "124,58,237", secondaryRgb: "139,92,246", tertiaryRgb: "167,139,250", accentRgb: "109,40,217", successRgb: "16,185,129",
      primaryMuted: "rgba(124,58,237,0.15)", secondaryMuted: "rgba(139,92,246,0.12)", tertiaryMuted: "rgba(167,139,250,0.12)",
    },
    emerald: {
      primary: "#10B981", secondary: "#059669", tertiary: "#34D399", accent: "#6EE7B7", success: "#10B981",
      primaryRgb: "16,185,129", secondaryRgb: "5,150,105", tertiaryRgb: "52,211,153", accentRgb: "110,231,183", successRgb: "16,185,129",
      primaryMuted: "rgba(16,185,129,0.15)", secondaryMuted: "rgba(5,150,105,0.12)", tertiaryMuted: "rgba(52,211,153,0.12)",
    },
  };
  return p[theme];
}

const BizContext = createContext<BizPalette>(getBizPalette("blue"));

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

function BusinessFloatingShapes() {
  const BIZ = useContext(BizContext);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="landing-float-1 absolute top-[15%] left-[10%] w-4 h-4 rounded-full" style={{ background: BIZ.primary, opacity: 0.15 }} />
      <div className="landing-float-2 absolute top-[25%] right-[15%] w-3 h-3 rounded-full" style={{ background: BIZ.secondary, opacity: 0.12 }} />
      <div className="landing-float-3 absolute top-[60%] left-[8%] w-5 h-5 rounded-full" style={{ background: BIZ.tertiary, opacity: 0.1 }} />
      <div className="landing-float-1 absolute top-[70%] right-[12%] w-3 h-3 rounded-full" style={{ background: BIZ.primary, opacity: 0.12 }} />
      <div className="landing-float-2 absolute top-[40%] left-[80%] w-2 h-2 rounded-full" style={{ background: BIZ.secondary, opacity: 0.18 }} />
      <div className="landing-float-3 absolute top-[85%] left-[30%] w-4 h-4 rounded-full" style={{ background: BIZ.tertiary, opacity: 0.08 }} />
      <div className="landing-float-1 absolute top-[50%] left-[50%] w-2 h-2 rounded-full" style={{ background: BIZ.accent, opacity: 0.1 }} />
      <div className="landing-float-2 absolute top-[20%] left-[45%] w-px h-20 rotate-45" style={{ background: `linear-gradient(to bottom, transparent, ${BIZ.primary}30, transparent)` }} />
      <div className="landing-float-1 absolute top-[50%] right-[25%] w-px h-24 -rotate-12" style={{ background: `linear-gradient(to bottom, transparent, ${BIZ.secondary}25, transparent)` }} />
      <div className="landing-float-3 absolute top-[75%] left-[60%] w-px h-16 rotate-[30deg]" style={{ background: `linear-gradient(to bottom, transparent, ${BIZ.tertiary}25, transparent)` }} />
    </div>
  );
}

function CorporateOrbital() {
  const BIZ = useContext(BizContext);
  return (
    <div className="relative w-[260px] h-[260px] sm:w-[340px] sm:h-[340px] md:w-[440px] md:h-[440px]">
      <div className="absolute inset-0 rounded-full landing-pulse-ring" style={{ background: `radial-gradient(circle, ${BIZ.primary}08, transparent 70%)` }} />
      <svg viewBox="0 0 420 420" className="w-full h-full" style={{ filter: `drop-shadow(0 0 60px rgba(${BIZ.primaryRgb},0.14))` }}>
        <circle cx="210" cy="210" r="180" fill="none" stroke={`rgba(${BIZ.primaryRgb},0.06)`} strokeWidth="0.5" strokeDasharray="4 6" />
        <circle cx="210" cy="210" r="140" fill="none" stroke={`rgba(${BIZ.primaryRgb},0.1)`} strokeWidth="1" />
        <circle cx="210" cy="210" r="100" fill="none" stroke={`rgba(${BIZ.secondaryRgb},0.1)`} strokeWidth="1" />
        <circle cx="210" cy="210" r="60" fill="none" stroke={`rgba(${BIZ.tertiaryRgb},0.1)`} strokeWidth="1" />

        <g className="landing-orbit" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="350" cy="210" r="9" fill={BIZ.success} opacity="0.9" />
          <circle cx="350" cy="210" r="14" fill={BIZ.success} opacity="0.15" />
          <text x="350" y="237" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="10" fontWeight="600">WhatsApp</text>
        </g>

        <g className="landing-orbit-reverse" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="310" cy="210" r="8" fill={BIZ.primary} opacity="0.9" />
          <circle cx="310" cy="210" r="12" fill={BIZ.primary} opacity="0.15" />
          <text x="310" y="235" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="10" fontWeight="600">Receipts</text>
        </g>

        <g className="landing-orbit-slow" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="270" cy="210" r="7" fill={BIZ.secondary} opacity="0.9" />
          <circle cx="270" cy="210" r="11" fill={BIZ.secondary} opacity="0.15" />
          <text x="270" y="233" textAnchor="middle" fill="rgba(255,255,255,0.65)" fontSize="10" fontWeight="600">Report</text>
        </g>

        <g className="landing-orbit-mid" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="150" cy="120" r="5" fill={`rgba(${BIZ.primaryRgb},0.7)`} />
        </g>
        <g className="landing-orbit-reverse" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="280" cy="300" r="4" fill={`rgba(${BIZ.tertiaryRgb},0.6)`} />
        </g>
        <g className="landing-orbit" style={{ transformOrigin: "210px 210px" }}>
          <circle cx="130" cy="280" r="3" fill={`rgba(${BIZ.secondaryRgb},0.5)`} />
        </g>

        <defs>
          <clipPath id="biz-orbital-clip">
            <circle cx="210" cy="210" r="54" />
          </clipPath>
          <radialGradient id="biz-logo-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={`rgba(${BIZ.primaryRgb},0.2)`} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>

        <circle cx="210" cy="210" r="70" fill="url(#biz-logo-glow)" />
        <circle cx="210" cy="210" r="58" fill={`rgba(${BIZ.primaryRgb},0.1)`} />
        <image href="/logo-business.png" x="152" y="152" width="116" height="116" clipPath="url(#biz-orbital-clip)" preserveAspectRatio="xMidYMid slice" />
      </svg>
    </div>
  );
}

function ReceiptFlowDemo() {
  const BIZ = useContext(BizContext);
  const { t } = useTranslation();
  const receiptExamples = [
    { input: t("axisBizLanding.receiptInput0"), result: t("axisBizLanding.receiptResult0"), label: t("axisBizLanding.receiptLabel0"), color: BIZ.primary, bg: BIZ.primaryMuted, category: t("axisBizLanding.catFood") },
    { input: t("axisBizLanding.receiptInput1"), result: t("axisBizLanding.receiptResult1"), label: t("axisBizLanding.receiptLabel1"), color: BIZ.secondary, bg: BIZ.secondaryMuted, category: t("axisBizLanding.catTransport") },
    { input: t("axisBizLanding.receiptInput2"), result: t("axisBizLanding.receiptResult2"), label: t("axisBizLanding.receiptLabel2"), color: BIZ.tertiary, bg: BIZ.tertiaryMuted, category: t("axisBizLanding.catLodging") },
    { input: t("axisBizLanding.receiptInput3"), result: t("axisBizLanding.receiptResult3"), label: t("axisBizLanding.receiptLabel3"), color: BIZ.accent, bg: "rgba(14,165,233,0.12)", category: t("axisBizLanding.catFuel") },
  ];
  const [exampleIdx, setExampleIdx] = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [showResult, setShowResult] = useState(false);
  const [phase, setPhase] = useState<"typing" | "result" | "pause">("typing");

  useEffect(() => {
    const example = receiptExamples[exampleIdx];
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
      }, 40);
      return () => clearInterval(interval);
    }

    if (phase === "result") {
      setShowResult(true);
      const timeout = setTimeout(() => setPhase("pause"), 2800);
      return () => clearTimeout(timeout);
    }

    if (phase === "pause") {
      const timeout = setTimeout(() => {
        setExampleIdx((prev) => (prev + 1) % receiptExamples.length);
        setPhase("typing");
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [phase, exampleIdx]);

  const example = receiptExamples[exampleIdx];

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${example.color}15, transparent 70%)`, filter: "blur(30px)" }} />

        <div className="flex items-center gap-3 mb-1 relative z-10">
          <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: example.color }} />
          <span className="text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: example.color }}>
            <Camera className="w-3.5 h-3.5" />
            {t("axisBizLanding.collabSends")}
          </span>
        </div>
        <p className="text-xl md:text-2xl font-medium text-white/90 mb-6 min-h-[2em] font-mono relative z-10" data-testid="text-biz-demo-input">
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
            <div className="flex items-center gap-2 mb-1">
              <Check className="w-3.5 h-3.5" style={{ color: example.color }} />
              <p className="text-xs uppercase tracking-widest" style={{ color: example.color }}>
                {example.label}
              </p>
            </div>
            <p className="text-base md:text-lg font-semibold text-white/90" data-testid="text-biz-demo-result">
              {example.result}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: `${example.color}20`, color: example.color }}>
                {example.category}
              </span>
              <span className="text-xs text-white/30">{t("axisBizLanding.imageSaved")}</span>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="flex justify-center gap-2 mt-4">
        {receiptExamples.map((ex, i) => (
          <button
            key={i}
            onClick={() => { setExampleIdx(i); setPhase("typing"); }}
            className="w-2 h-2 rounded-full transition-all duration-300"
            style={{
              background: i === exampleIdx ? ex.color : "rgba(255,255,255,0.15)",
              transform: i === exampleIdx ? "scale(1.4)" : "scale(1)",
              boxShadow: i === exampleIdx ? `0 0 8px ${ex.color}60` : "none",
            }}
            data-testid={`button-biz-demo-dot-${i}`}
          />
        ))}
      </div>
    </div>
  );
}

function BizWhatsAppChat() {
  const BIZ = useContext(BizContext);
  const { t } = useTranslation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const messages = [
    { type: "user", text: t("axisBizLanding.chatMsg0"), time: "09:14", isPhoto: true },
    { type: "bot", text: t("axisBizLanding.chatMsg1"), time: "09:14" },
    { type: "user", text: t("axisBizLanding.chatMsg2"), time: "09:15" },
    { type: "bot", text: t("axisBizLanding.chatMsg3"), time: "09:15" },
    { type: "user", text: t("axisBizLanding.chatMsg4"), time: "09:22" },
    { type: "bot", text: t("axisBizLanding.chatMsg5"), time: "09:22" },
  ];

  return (
    <div ref={ref} className="w-full max-w-md mx-auto">
      <div className="rounded-2xl overflow-hidden border border-white/10">
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: "linear-gradient(135deg, #075E54, #128C7E)" }}>
          <img src="/logo-business.png" alt="AXIS Business" className="w-9 h-9 rounded-full object-cover" />
          <div>
            <p className="text-white text-sm font-semibold">{t("axisBizLanding.chatBotName")}</p>
            <p className="text-white/60 text-[11px]">Acme Corp · {t("axisBizLanding.online")}</p>
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
              transition={{ delay: i * 0.45, duration: 0.4, ease: "easeOut" }}
              className={`flex ${msg.type === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                data-testid={`text-biz-chat-msg-${i}`}
                className={`max-w-[82%] rounded-xl px-3.5 py-2.5 ${msg.type === "user" ? "rounded-tr-sm" : "rounded-tl-sm"}`}
                style={{
                  background: msg.type === "user" ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.06)",
                  border: msg.type === "user" ? `1px solid rgba(${BIZ.primaryRgb},0.2)` : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {msg.isPhoto ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `rgba(${BIZ.primaryRgb},0.2)` }}>
                      <Camera className="w-3.5 h-3.5" style={{ color: BIZ.primary }} />
                    </div>
                    <span className="text-[13px] text-white/70">{t("axisBizLanding.photoReceipt")}</span>
                  </div>
                ) : (
                  <p className="text-[13px] text-white/85 whitespace-pre-line leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }}
                  />
                )}
                <p className="text-[10px] text-white/30 text-right mt-1">{msg.time}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="px-3 py-2.5 flex items-center gap-2" style={{ background: "#0d1117", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex-1 rounded-full px-4 py-2 text-xs text-white/30 bg-white/[0.04] border border-white/[0.06]">
            {t("axisBizLanding.chatInputPh")}
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `rgba(${BIZ.primaryRgb},0.15)` }}>
            <Camera className="w-4 h-4" style={{ color: BIZ.primary }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpensePanelPreview() {
  const BIZ = useContext(BizContext);
  const { t } = useTranslation();
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  const expenses = [
    { collaborator: "Ana Lima", description: t("axisBizLanding.expenseDesc0"), amount: "R$ 87,50", category: t("axisBizLanding.catFood"), status: "approved", date: "06/03" },
    { collaborator: "Carlos M.", description: "Uber Trip", amount: "R$ 34,20", category: t("axisBizLanding.catTransport"), status: "pending", date: "06/03" },
    { collaborator: "Juliana R.", description: "Hotel Ibis SP", amount: "R$ 320,00", category: t("axisBizLanding.catLodging"), status: "pending", date: "05/03" },
    { collaborator: "Ana Lima", description: t("axisBizLanding.expenseDesc3"), amount: "R$ 180,60", category: t("axisBizLanding.catFuel"), status: "rejected", date: "04/03" },
  ];

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    approved: { label: t("axisBizLanding.statusApproved"), color: BIZ.success, bg: `rgba(${BIZ.successRgb},0.12)` },
    pending: { label: t("axisBizLanding.statusPending"), color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
    rejected: { label: t("axisBizLanding.statusRejected"), color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
  };

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
            <div className="px-4 py-1 rounded-md bg-white/[0.04] text-[11px] text-white/30 font-mono">axis.com.br/business/app/expenses</div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          <div className="flex items-center gap-3 mb-5">
            <img src="/logo-business.png" alt="AXIS Business" className="w-8 h-8 rounded-lg object-cover" />
            <div>
              <p className="text-sm font-bold text-white/90">Acme Corp</p>
              <p className="text-[11px] text-white/40">{t("axisBizLanding.expensePanelTitle")}</p>
            </div>
            <motion.div
              initial={{ scale: 0 }}
              animate={isInView ? { scale: 1 } : {}}
              transition={{ delay: 0.5, type: "spring" }}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer"
              style={{ background: `rgba(${BIZ.successRgb},0.1)`, border: `1px solid rgba(${BIZ.successRgb},0.2)` }}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" style={{ color: BIZ.success }} />
              <span className="text-xs font-medium" style={{ color: BIZ.success }}>{t("axisBizLanding.exportExcel")}</span>
            </motion.div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: t("axisBizLanding.totalMonth"), value: "R$ 622,30", color: BIZ.primary },
              { label: t("axisBizLanding.pendingExpenses"), value: t("axisBizLanding.pendingCount"), color: "#F59E0B" },
              { label: t("axisBizLanding.approvedExpenses"), value: "R$ 87,50", color: BIZ.success },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="rounded-xl p-3 border border-white/[0.06]"
                style={{ background: `linear-gradient(135deg, ${card.color}08, transparent)` }}
              >
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{card.label}</p>
                <p className="text-base font-bold text-white/90">{card.value}</p>
              </motion.div>
            ))}
          </div>

          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <div className="grid grid-cols-5 gap-2 px-4 py-2 border-b border-white/[0.04]">
              {[t("axisBizLanding.colCollaborator"), t("axisBizLanding.colDesc"), t("axisBizLanding.colAmount"), t("axisBizLanding.colCategory"), t("axisBizLanding.colStatus")].map((h) => (
                <p key={h} className="text-[10px] text-white/30 uppercase tracking-wider font-medium">{h}</p>
              ))}
            </div>
            {expenses.map((exp, i) => {
              const st = statusConfig[exp.status];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <p className="text-xs text-white/70 truncate">{exp.collaborator}</p>
                  <p className="text-xs text-white/60 truncate">{exp.description}</p>
                  <p className="text-xs font-semibold text-white/85">{exp.amount}</p>
                  <p className="text-xs text-white/45">{exp.category}</p>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md self-start" style={{ color: st.color, background: st.bg }}>
                    {st.label}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BusinessLanding() {
  const { t } = useTranslation();
  const [bizTheme, setBizTheme] = useState<BizTheme>("blue");
  const BIZ = getBizPalette(bizTheme);

  const cycleTheme = () => {
    const idx = BIZ_THEMES.indexOf(bizTheme);
    setBizTheme(BIZ_THEMES[(idx + 1) % BIZ_THEMES.length]);
  };

  const cssVars = {
    "--lp-primary-rgb": BIZ.primaryRgb,
    "--lp-secondary-rgb": BIZ.secondaryRgb,
    "--lp-tertiary-rgb": BIZ.tertiaryRgb,
    "--lp-accent-rgb": BIZ.accentRgb,
    "--lp-success-rgb": BIZ.successRgb,
  } as React.CSSProperties;

  return (
  <BizContext.Provider value={BIZ}>
    <div className="min-h-screen landing-bg text-white overflow-x-hidden relative" style={cssVars}>
      <div className="landing-grain" />
      <div className="landing-grid-dots" />

      <div className="landing-blob absolute top-[-10%] left-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${BIZ.primaryRgb},0.12) 0%, transparent 60%)`, filter: "blur(80px)" }} />
      <div className="landing-blob-2 absolute top-[30%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${BIZ.secondaryRgb},0.09) 0%, transparent 60%)`, filter: "blur(80px)" }} />
      <div className="landing-blob-3 absolute top-[60%] left-[-8%] w-[450px] h-[450px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${BIZ.tertiaryRgb},0.07) 0%, transparent 60%)`, filter: "blur(80px)" }} />

      <header className="fixed top-0 w-full z-50 bg-[#08080f]/70 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-business.png" alt="AXIS Business" className="w-12 h-12 rounded-lg object-cover" />
            <div className="flex items-center gap-1">
              <span className="text-base font-bold tracking-tight">AXIS</span>
              <span className="text-base font-bold tracking-tight" style={{ color: BIZ.primary }}> Business</span>
            </div>
            <button
              onClick={cycleTheme}
              className="w-7 h-7 rounded-full flex items-center justify-center border border-white/10 hover:border-white/20 transition-all group relative"
              style={{ background: `rgba(${BIZ.primaryRgb},0.15)` }}
              title={`${t("axisBizLanding.theme")}: ${bizTheme}`}
              data-testid="button-biz-cycle-theme"
            >
              <Palette className="w-3 h-3 transition-colors" style={{ color: BIZ.primary }} />
              <span className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-[#08080f]" style={{ background: BIZ.primary }} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/">
              <button
                className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 transition-all"
                style={{ color: "rgba(255,255,255,0.45)" }}
                data-testid="button-back-personal"
              >
                <ArrowLeft className="w-3 h-3" />
                {t("axisBizLanding.axisPersonal")}
              </button>
            </Link>
            <Link href="/business/auth">
              <button
                className="landing-cta-button group relative px-5 py-2 rounded-xl font-semibold text-sm transition-all border-0"
                data-testid="button-biz-header-cta"
              >
                {t("axisBizLanding.startFree")}
              </button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative min-h-screen flex items-center justify-center px-6 pt-16">
        <BusinessFloatingShapes />
        <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-20 max-w-6xl mx-auto">
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6" data-testid="text-biz-hero-title">
                {t("axisBizLanding.heroTitle1")}{" "}
                <span className="landing-gradient-text">{t("axisBizLanding.heroTitle2")}</span>
                <br />
                <span className="text-white/50">{t("axisBizLanding.heroTitle3")}</span>
                <br className="md:hidden" />
                <span className="text-white/50"> {t("axisBizLanding.heroTitle4")}</span>
              </h1>
              <p className="text-lg md:text-xl text-white/45 max-w-lg mb-10 leading-relaxed" data-testid="text-biz-hero-subtitle">
                {t("axisBizLanding.heroSubtitle")}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center gap-4"
            >
              <Link href="/business/auth">
                <button
                  className="landing-cta-button group relative px-8 py-4 rounded-xl font-semibold text-base transition-all"
                  data-testid="button-biz-hero-start"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {t("axisBizLanding.startNowFree")}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              </Link>
              <div className="flex items-center gap-2 text-sm text-white/30">
                <Check className="w-4 h-4" style={{ color: BIZ.success }} />
                <span>{t("axisBizLanding.noCard")}</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="flex items-center gap-6 mt-8"
            >
              {[
                { icon: <Camera className="w-3.5 h-3.5" />, label: t("axisBizLanding.chipPhoto") },
                { icon: <Smartphone className="w-3.5 h-3.5" />, label: "WhatsApp" },
                { icon: <FileSpreadsheet className="w-3.5 h-3.5" />, label: "Excel" },
                { icon: <Zap className="w-3.5 h-3.5" />, label: t("axisBizLanding.chipAI") },
                { icon: <Shield className="w-3.5 h-3.5" />, label: t("axisBizLanding.chipPublicLink") },
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
            <CorporateOrbital />
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
              <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: BIZ.primary }}>
                {t("axisBizLanding.seeInAction")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-biz-demo-title">
                {t("axisBizLanding.demoTitle1")}{" "}
                <span className="landing-gradient-text">{t("axisBizLanding.demoTitle2")}</span>
              </h2>
              <p className="text-white/35 text-base leading-relaxed mb-6 max-w-md">
                {t("axisBizLanding.demoDesc")}
              </p>
              <ReceiptFlowDemo />
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
                  { value: 0, suffix: "", prefix: "", label: t("axisBizLanding.statLabel0"), color: BIZ.primary },
                  { value: 2, suffix: "s", prefix: "< ", label: t("axisBizLanding.statLabel1"), color: BIZ.secondary },
                  { value: 100, suffix: "%", prefix: "", label: t("axisBizLanding.statLabel2"), color: BIZ.tertiary },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.12 }}
                    className="flex items-center gap-5 rounded-xl p-4 border border-white/[0.06] bg-white/[0.02]"
                    data-testid={`biz-stat-${i}`}
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
                  { icon: <Camera className="w-3.5 h-3.5" />, label: t("axisBizLanding.chipPhoto"), color: BIZ.primary },
                  { icon: <Smartphone className="w-3.5 h-3.5" />, label: "WhatsApp", color: BIZ.success },
                  { icon: <Receipt className="w-3.5 h-3.5" />, label: t("axisBizLanding.chipReceipt"), color: BIZ.secondary },
                  { icon: <FileSpreadsheet className="w-3.5 h-3.5" />, label: "Excel", color: BIZ.tertiary },
                  { icon: <Zap className="w-3.5 h-3.5" />, label: t("axisBizLanding.chipAI"), color: BIZ.accent },
                ].map((input, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.06 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03]"
                    data-testid={`biz-input-type-${i}`}
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
        <div className="landing-blob-2 absolute top-[20%] right-[-15%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${BIZ.successRgb},0.07) 0%, transparent 60%)`, filter: "blur(70px)" }} />
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-biz-whatsapp-title">
                {t("axisBizLanding.waTitle1")}{" "}
                <span className="landing-whatsapp-glow">WhatsApp.</span>
                <br />
                <span className="text-white/40">{t("axisBizLanding.waTitle2")}</span>
              </h2>
              <p className="text-white/40 text-base leading-relaxed mb-6 max-w-md">
                {t("axisBizLanding.waDesc")}
              </p>
              <div className="flex flex-wrap gap-2 mb-8">
                {[t("axisBizLanding.waTag0"), t("axisBizLanding.waTag1"), t("axisBizLanding.waTag2"), t("axisBizLanding.waTag3"), t("axisBizLanding.waTag4")].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: `rgba(${BIZ.successRgb},0.1)`, color: BIZ.success, border: `1px solid rgba(${BIZ.successRgb},0.15)` }}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="space-y-3">
                {[
                  { cmd: t("axisBizLanding.waEx0Cmd"), result: t("axisBizLanding.waEx0Result"), color: BIZ.primary },
                  { cmd: t("axisBizLanding.waEx1Cmd"), result: t("axisBizLanding.waEx1Result"), color: BIZ.secondary },
                  { cmd: t("axisBizLanding.waEx2Cmd"), result: t("axisBizLanding.waEx2Result"), color: BIZ.success },
                ].map((ex, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -15 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 border border-white/[0.06] bg-white/[0.02]"
                    data-testid={`biz-whatsapp-example-${i}`}
                  >
                    <span className="text-sm text-white/50 flex-1">{ex.cmd}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                    <span className="text-sm font-medium flex-shrink-0" style={{ color: ex.color }}>{ex.result}</span>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mt-6">
                {[
                  { value: 24, suffix: "h", label: t("axisBizLanding.waStatLabel0"), color: BIZ.success },
                  { value: 3, suffix: "s", prefix: "< ", label: t("axisBizLanding.waStatLabel1"), color: BIZ.secondary },
                  { value: 0, suffix: "", label: t("axisBizLanding.waStatLabel2"), color: BIZ.tertiary },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="text-center rounded-lg py-3 border border-white/[0.06] bg-white/[0.02]"
                    data-testid={`biz-whatsapp-stat-${i}`}
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
              <BizWhatsAppChat />
            </motion.div>
          </div>
        </div>
      </section>

      <div className="landing-section-divider max-w-4xl mx-auto" />

      <section className="py-20 md:py-28 px-6 relative">
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: BIZ.primary }}>{t("axisBizLanding.managerPanel")}</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4" data-testid="text-biz-panel-title">
              {t("axisBizLanding.panelTitle1")}{" "}
              <span className="landing-gradient-text">{t("axisBizLanding.panelTitle2")}</span>
            </h2>
            <p className="text-white/35 text-base max-w-lg mx-auto leading-relaxed">
              {t("axisBizLanding.panelDesc")}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
          >
            <ExpensePanelPreview />
          </motion.div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
            {[
              { icon: <Camera className="w-5 h-5" />, title: t("axisBizLanding.featTitle0"), desc: t("axisBizLanding.featDesc0"), color: BIZ.primary },
              { icon: <Check className="w-5 h-5" />, title: t("axisBizLanding.featTitle1"), desc: t("axisBizLanding.featDesc1"), color: BIZ.success },
              { icon: <FileSpreadsheet className="w-5 h-5" />, title: t("axisBizLanding.featTitle2"), desc: t("axisBizLanding.featDesc2"), color: BIZ.secondary },
              { icon: <Users className="w-5 h-5" />, title: t("axisBizLanding.featTitle3"), desc: t("axisBizLanding.featDesc3"), color: BIZ.tertiary },
            ].map((feat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="rounded-xl p-4 border border-white/[0.06] bg-white/[0.02] flex flex-col gap-3"
                data-testid={`biz-feature-${i}`}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${feat.color}15`, border: `1px solid ${feat.color}20` }}>
                  <span style={{ color: feat.color }}>{feat.icon}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/85 mb-0.5">{feat.title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{feat.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="landing-section-divider max-w-4xl mx-auto" />

      <section className="py-24 md:py-32 px-6 relative overflow-hidden">
        <div className="absolute inset-0 landing-cta-bg pointer-events-none" />
        <div className="landing-blob absolute top-[10%] left-[20%] w-[500px] h-[400px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${BIZ.primaryRgb},0.1) 0%, transparent 60%)`, filter: "blur(80px)" }} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center gap-6"
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2" style={{ background: `rgba(${BIZ.primaryRgb},0.15)`, border: `1px solid rgba(${BIZ.primaryRgb},0.25)` }}>
            <BarChart3 className="w-8 h-8" style={{ color: BIZ.primary }} />
          </div>

          <h2 className="text-4xl md:text-5xl font-bold tracking-tight" data-testid="text-biz-cta-title">
            {t("axisBizLanding.ctaTitle1")}{" "}
            <span className="landing-gradient-text">{t("axisBizLanding.ctaTitle2")}</span>
          </h2>
          <p className="text-lg text-white/40 max-w-xl leading-relaxed">
            {t("axisBizLanding.ctaDesc")}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
            <Link href="/business/auth">
              <button
                className="landing-cta-button group relative px-10 py-4 rounded-xl font-semibold text-base transition-all"
                data-testid="button-biz-cta-final"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {t("axisBizLanding.createFreeAccount")}
                  <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
            </Link>
            <div className="flex items-center gap-2 text-sm text-white/30">
              <Check className="w-4 h-4" style={{ color: BIZ.success }} />
              <span>{t("axisBizLanding.noCardCancel")}</span>
            </div>
          </div>
        </motion.div>
      </section>

      <div className="landing-section-divider max-w-4xl mx-auto" />

      <section className="py-20 md:py-28 px-6 relative" data-testid="section-personal-crosslink">
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: BIZ.secondary }}>
                {t("axisBizLanding.forYouToo")}
              </p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                {t("axisBizLanding.personalTitle1")}{" "}
                <span className="landing-gradient-text">{t("axisBizLanding.personalTitle2")}</span>
              </h2>
              <p className="text-white/40 text-base leading-relaxed mb-8 max-w-md">
                {t("axisBizLanding.personalDesc")}
              </p>
              <div className="flex flex-wrap gap-2 mb-8">
                {[t("axisBizLanding.perTag0"), t("axisBizLanding.perTag1"), t("axisBizLanding.perTag2"), t("axisBizLanding.perTag3"), "WhatsApp"].map((tag) => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: `rgba(${BIZ.secondaryRgb},0.1)`, color: BIZ.secondary, border: `1px solid rgba(${BIZ.secondaryRgb},0.15)` }}>
                    {tag}
                  </span>
                ))}
              </div>
              <Link href="/">
                <button
                  className="landing-cta-button group relative px-8 py-4 rounded-xl font-semibold text-base transition-all"
                  data-testid="button-crosslink-to-personal"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {t("axisBizLanding.discoverPersonal")}
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
                  style={{ background: `linear-gradient(to bottom, rgba(${BIZ.primaryRgb},0.25), rgba(${BIZ.secondaryRgb},0.2), rgba(${BIZ.tertiaryRgb},0.15))` }} />
                {[
                  { step: "01", icon: <Mic className="w-4 h-4" />, title: t("axisBizLanding.perStep0Title"), desc: t("axisBizLanding.perStep0Desc"), result: t("axisBizLanding.perStep0Result"), color: BIZ.primary, colorRgb: BIZ.primaryRgb },
                  { step: "02", icon: <Calendar className="w-4 h-4" />, title: t("axisBizLanding.perStep1Title"), desc: t("axisBizLanding.perStep1Desc"), result: t("axisBizLanding.perStep1Result"), color: BIZ.secondary, colorRgb: BIZ.secondaryRgb },
                  { step: "03", icon: <Flame className="w-4 h-4" />, title: t("axisBizLanding.perStep2Title"), desc: t("axisBizLanding.perStep2Desc"), result: t("axisBizLanding.perStep2Result"), color: BIZ.tertiary, colorRgb: BIZ.tertiaryRgb },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.14 }}
                    className="flex items-start gap-4 rounded-xl p-4 mb-3 last:mb-0 border-l-2 bg-white/[0.02]"
                    style={{ borderLeftColor: item.color, borderTopColor: "rgba(255,255,255,0.05)", borderRightColor: "rgba(255,255,255,0.05)", borderBottomColor: "rgba(255,255,255,0.05)", borderTopWidth: "1px", borderRightWidth: "1px", borderBottomWidth: "1px" }}
                    data-testid={`personal-crosslink-step-${i}`}
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

      <footer className="px-6 py-8 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo-business.png" alt="AXIS Business" className="w-6 h-6 rounded-md object-cover" />
            <span className="text-sm font-semibold">AXIS Business</span>
          </div>
          <p className="text-xs text-white/25">
            {t("axisBizLanding.footerText1")}{" "}
            <Link href="/">
              <span className="underline cursor-pointer text-white/40 hover:text-white/60 transition-colors">AXIS</span>
            </Link>
            {" "}{t("axisBizLanding.footerText2")}
          </p>
        </div>
      </footer>
    </div>
  </BizContext.Provider>
  );
}
