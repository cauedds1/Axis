import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { ArrowRight, LogOut, ReceiptText, CheckCircle2, TrendingUp, BarChart3, Smartphone, Users, FileSpreadsheet, Sparkles, MessageSquare, Zap } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

const PRIMARY = "#3B82F6";
const INDIGO = "#6366F1";
const CYAN = "#0EA5E9";
const EMERALD = "#10B981";
const AMBER = "#F59E0B";

function ExpensesCard({ delay, t }: { delay: number; t: (k: string) => string }) {
  const items = [
    { label: t("businessWelcome.exampleFood"), value: "R$ 89,00", cat: t("businessWelcome.categoryFood") },
    { label: t("businessWelcome.exampleUber"), value: "R$ 34,50", cat: t("businessWelcome.categoryTransport") },
    { label: t("businessWelcome.exampleSupplies"), value: "R$ 127,00", cat: t("businessWelcome.categorySupplies") },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative rounded-2xl p-4 overflow-hidden flex flex-col group"
      style={{ background: "rgba(255,255,255,0.028)", border: `1px solid ${PRIMARY}22` }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${PRIMARY}60, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${PRIMARY}08 0%, transparent 65%)` }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${PRIMARY}18`, border: `1px solid ${PRIMARY}28` }}>
            <ReceiptText className="w-3.5 h-3.5" style={{ color: PRIMARY }} />
          </div>
          <span className="text-white font-bold text-sm">{t("businessWelcome.expenses")}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${PRIMARY}15`, color: PRIMARY }}>{t("businessWelcome.aiActive")}</span>
      </div>

      <div className="space-y-2 flex-1">
        {items.map(({ label, value, cat }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: delay + 0.2 + i * 0.08 }}
            className="flex items-center justify-between"
          >
            <div>
              <p className="text-xs text-white/70 leading-tight">{label}</p>
              <p className="text-[10px] text-white/30">{cat}</p>
            </div>
            <span className="text-xs font-semibold text-white/80">{value}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center gap-1.5">
        <MessageSquare className="w-3 h-3" style={{ color: PRIMARY }} />
        <span className="text-[10px] text-white/30">{t("businessWelcome.sentViaWhatsApp")}</span>
      </div>
    </motion.div>
  );
}

function ApprovalsCard({ delay, t }: { delay: number; t: (k: string) => string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative rounded-2xl p-4 overflow-hidden flex flex-col group"
      style={{ background: "rgba(255,255,255,0.028)", border: `1px solid ${AMBER}22` }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${AMBER}60, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${AMBER}07 0%, transparent 65%)` }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${AMBER}18`, border: `1px solid ${AMBER}28` }}>
            <CheckCircle2 className="w-3.5 h-3.5" style={{ color: AMBER }} />
          </div>
          <span className="text-white font-bold text-sm">{t("businessWelcome.approvals")}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${EMERALD}15`, color: EMERALD }}>{t("businessWelcome.allGood")}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center py-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: delay + 0.3, type: "spring" }}
          className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
          style={{ background: `${EMERALD}18`, border: `1px solid ${EMERALD}30` }}
        >
          <CheckCircle2 className="w-5 h-5" style={{ color: EMERALD }} />
        </motion.div>
        <p className="text-sm font-bold text-white/80">0 {t("businessWelcome.pendingApprovals")}</p>
        <p className="text-[10px] text-white/30 mt-0.5">{t("businessWelcome.noPendingApprovals")}</p>
      </div>

      <div className="mt-2">
        <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 0.8, delay: delay + 0.5, ease: "easeOut" }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${EMERALD}, ${EMERALD}80)` }}
          />
        </div>
        <p className="text-[10px] text-white/25 mt-1">100% {t("businessWelcome.processed")}</p>
      </div>
    </motion.div>
  );
}

function CashflowCard({ delay, t }: { delay: number; t: (k: string) => string }) {
  const bars = [30, 55, 45, 70, 40, 60, 50];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative rounded-2xl p-4 overflow-hidden flex flex-col group"
      style={{ background: "rgba(255,255,255,0.028)", border: `1px solid ${EMERALD}22` }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${EMERALD}60, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${EMERALD}07 0%, transparent 65%)` }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${EMERALD}18`, border: `1px solid ${EMERALD}28` }}>
            <TrendingUp className="w-3.5 h-3.5" style={{ color: EMERALD }} />
          </div>
          <span className="text-white font-bold text-sm">{t("businessWelcome.cashflow")}</span>
        </div>
      </div>

      <div className="flex items-end gap-1 mb-3 h-10">
        {bars.map((h, i) => (
          <motion.div
            key={i}
            initial={{ height: 0 }}
            animate={{ height: `${h}%` }}
            transition={{ duration: 0.6, delay: delay + 0.2 + i * 0.05, ease: "easeOut" }}
            className="flex-1 rounded-sm"
            style={{ background: i % 2 === 0 ? `${EMERALD}30` : `${CYAN}30`, minHeight: 3 }}
          />
        ))}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/35">{t("businessWelcome.receivable")}</span>
          <span className="text-[10px] font-semibold" style={{ color: EMERALD }}>R$ 0,00</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-white/35">{t("businessWelcome.payable")}</span>
          <span className="text-[10px] font-semibold text-white/50">R$ 0,00</span>
        </div>
      </div>
    </motion.div>
  );
}

function ReportsCard({ delay, t }: { delay: number; t: (k: string) => string }) {
  const reportItems = [
    { icon: FileSpreadsheet, label: t("businessWelcome.excelByPeriod"), color: EMERALD },
    { icon: Users, label: t("businessWelcome.byCollaborator"), color: CYAN },
    { icon: Smartphone, label: t("businessWelcome.zipReceipts"), color: INDIGO },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="relative rounded-2xl p-4 overflow-hidden flex flex-col group"
      style={{ background: "rgba(255,255,255,0.028)", border: `1px solid ${INDIGO}22` }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${INDIGO}60, transparent)` }} />
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: `radial-gradient(ellipse at 50% 0%, ${INDIGO}07 0%, transparent 65%)` }} />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${INDIGO}18`, border: `1px solid ${INDIGO}28` }}>
            <BarChart3 className="w-3.5 h-3.5" style={{ color: INDIGO }} />
          </div>
          <span className="text-white font-bold text-sm">{t("businessWelcome.reports")}</span>
        </div>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${INDIGO}15`, color: INDIGO }}>{t("businessWelcome.available")}</span>
      </div>

      <div className="space-y-2 flex-1">
        {reportItems.map(({ icon: Icon, label, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: delay + 0.2 + i * 0.1 }}
            className="flex items-center gap-2.5"
          >
            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
              <Icon className="w-3 h-3" style={{ color }} />
            </div>
            <span className="text-xs text-white/55">{label}</span>
          </motion.div>
        ))}
      </div>

      <div className="mt-3 pt-2.5 border-t border-white/[0.05] flex items-center gap-1.5">
        <Sparkles className="w-3 h-3" style={{ color: INDIGO }} />
        <span className="text-[10px] text-white/30">{t("businessWelcome.exportToAccountant")}</span>
      </div>
    </motion.div>
  );
}

export default function BusinessWelcome() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    document.title = t("businessWelcome.pageTitle");
  }, [t]);

  const firstName = user?.firstName || "você";

  const steps = [
    {
      n: "01",
      title: t("businessWelcome.step1Title"),
      desc: t("businessWelcome.step1Desc"),
      active: true,
    },
    {
      n: "02",
      title: t("businessWelcome.step2Title"),
      desc: t("businessWelcome.step2Desc"),
      active: false,
    },
    {
      n: "03",
      title: t("businessWelcome.step3Title"),
      desc: t("businessWelcome.step3Desc"),
      active: false,
    },
  ];

  async function handleStart() {
    try {
      await apiRequest("POST", "/api/onboarding", {});
    } catch {
    }
    setLocation("/business/app");
  }

  return (
    <div className="h-screen bg-[#080808] text-white overflow-hidden flex flex-col">
      <div className="absolute top-0 left-[20%] w-[600px] h-[350px] rounded-full pointer-events-none" style={{ background: `radial-gradient(ellipse, rgba(59,130,246,0.07) 0%, transparent 70%)`, filter: "blur(80px)" }} />
      <div className="absolute bottom-0 right-[10%] w-[500px] h-[350px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 65%)`, filter: "blur(70px)" }} />
      <div className="landing-grain" />

      <div className="relative z-10 flex flex-col h-full w-full max-w-[1400px] mx-auto px-12 xl:px-20 py-6">

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between mb-6 flex-shrink-0"
        >
          <div className="flex items-center gap-3">
            <img src="/logo-business.png" alt="AXIS Business" className="w-16 h-16 rounded-xl object-cover" />
            <div>
              <span className="text-base font-bold tracking-tight block">AXIS</span>
              <span className="text-[11px] font-medium tracking-widest uppercase" style={{ color: PRIMARY }}>Business</span>
            </div>
          </div>
          <button
            onClick={() => { logout(); setLocation("/business"); }}
            className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition-colors"
            data-testid="button-business-welcome-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
            {t("businessWelcome.logout")}
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
                {([PRIMARY, INDIGO, CYAN, EMERALD] as const).map((color, i) => (
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
                <span className="text-white/35 block text-2xl md:text-3xl font-medium mb-1">{t("businessWelcome.hello", { name: firstName })}</span>
                <span style={{ background: `linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.75) 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {t("businessWelcome.title")}{" "}
                </span>
                <span style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${CYAN})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {t("businessWelcome.titleBusiness")}.
                </span>
              </h1>

              <p className="text-white/45 text-base leading-relaxed">
                {t("businessWelcome.subtitle")}
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
                      background: step.active ? `linear-gradient(135deg, ${PRIMARY}22, ${CYAN}22)` : "rgba(255,255,255,0.04)",
                      border: step.active ? `1px solid ${PRIMARY}40` : "1px solid rgba(255,255,255,0.07)",
                      color: step.active ? PRIMARY : "rgba(255,255,255,0.25)",
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
                onClick={handleStart}
                className="flex items-center gap-2.5 px-6 py-4 rounded-xl font-semibold text-base w-full justify-center transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{ background: `linear-gradient(135deg, ${PRIMARY}, ${CYAN})`, color: "#fff", boxShadow: `0 4px 24px ${PRIMARY}40` }}
                data-testid="button-business-welcome-start"
              >
                <Zap className="w-4 h-4 opacity-80" />
                {t("businessWelcome.ctaButton")}
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-center text-xs text-white/20 mt-3">
                {t("businessWelcome.ctaHint")}
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
              {t("businessWelcome.awaitingLabel")}
            </motion.p>

            <div className="grid grid-cols-2 gap-3 flex-1" style={{ gridTemplateRows: "1fr 1fr" }}>
              <ExpensesCard delay={0.25} t={t} />
              <ApprovalsCard delay={0.33} t={t} />
              <CashflowCard delay={0.41} t={t} />
              <ReportsCard delay={0.49} t={t} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
