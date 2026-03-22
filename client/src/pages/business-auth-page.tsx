import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, ArrowRight, ArrowLeft, Camera, Zap, CheckCircle2, FileSpreadsheet, Shield, Building2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

const PRIMARY   = "#3B82F6";
const SECONDARY = "#6366F1";
const TERTIARY  = "#8B5CF6";
const ACCENT    = "#0EA5E9";

const SEGMENT_KEYS = [
  "seg0", "seg1", "seg2", "seg3", "seg4", "seg5", "seg6", "seg7", "seg8", "seg9", "seg10", "seg11",
];

const JOB_TITLE_KEYS = [
  "job0", "job1", "job2", "job3", "job4",
];

const FEATURE_KEYS = [
  { key: "feature0", color: PRIMARY },
  { key: "feature1", color: SECONDARY },
  { key: "feature2", color: ACCENT },
  { key: "feature3", color: TERTIARY },
  { key: "feature4", color: PRIMARY },
];

const DEMO_CARD_DEFS = [
  { icon: Camera, color: PRIMARY, bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.15)", labelKey: "card0Label", resultKey: "card0Result", tagKey: "card0Tag" },
  { icon: Zap, color: SECONDARY, bg: "rgba(99,102,241,0.08)", border: "rgba(99,102,241,0.15)", labelKey: "card1Label", resultKey: "card1Result", tagKey: "card1Tag" },
  { icon: FileSpreadsheet, color: TERTIARY, bg: "rgba(139,92,246,0.08)", border: "rgba(139,92,246,0.15)", labelKey: "card2Label", resultKey: "card2Result", tagKey: "card2Tag" },
];

function FeatureRotator() {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((prev) => (prev + 1) % FEATURE_KEYS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-14 relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 flex items-center"
        >
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: FEATURE_KEYS[idx].color }} />
            <p className="text-base text-white/60 font-medium leading-snug" data-testid="text-feature-highlight">
              {t(`axisBizAuth.${FEATURE_KEYS[idx].key}`)}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DemoCard({ def, delay }: { def: typeof DEMO_CARD_DEFS[0]; delay: number }) {
  const { t } = useTranslation();
  const Icon = def.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-xl p-4 border"
      style={{ background: def.bg, borderColor: def.border }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: def.bg, border: `1px solid ${def.border}` }}>
          <Icon className="w-4 h-4" style={{ color: def.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/35 mb-1 italic leading-relaxed">{t(`axisBizAuth.${def.labelKey}`)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: def.color }} />
            <p className="text-xs font-semibold text-white/80">{t(`axisBizAuth.${def.resultKey}`)}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ color: def.color, background: def.bg, border: `1px solid ${def.border}` }}>
              {t(`axisBizAuth.${def.tagKey}`)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BrandPanel() {
  const { t } = useTranslation();
  return (
    <div className="relative flex flex-col justify-between h-full p-10 xl:p-14 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "#060608" }} />
      <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(59,130,246,0.10) 0%, rgba(99,102,241,0.05) 40%, transparent 65%)`, filter: "blur(90px)" }} />
      <div className="absolute bottom-[-10%] left-[-15%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 55%)`, filter: "blur(70px)" }} />
      <div className="absolute top-[40%] left-[20%] w-[350px] h-[350px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(14,165,233,0.04) 0%, transparent 55%)`, filter: "blur(60px)" }} />
      <div className="absolute bottom-[30%] right-[10%] w-[200px] h-[200px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 55%)`, filter: "blur(50px)" }} />
      <div className="landing-grain" />
      <div className="absolute top-[18%] left-[12%] w-1.5 h-1.5 rounded-full landing-float-1" style={{ background: PRIMARY, opacity: 0.15 }} />
      <div className="absolute top-[55%] right-[15%] w-1 h-1 rounded-full landing-float-2" style={{ background: SECONDARY, opacity: 0.12 }} />
      <div className="absolute bottom-[22%] left-[35%] w-2 h-2 rounded-full landing-float-3" style={{ background: TERTIARY, opacity: 0.10 }} />
      <div className="absolute top-[30%] right-[30%] w-px h-20 rotate-45 landing-float-2" style={{ background: `linear-gradient(to bottom, transparent, rgba(59,130,246,0.15), transparent)` }} />
      <div className="absolute bottom-[45%] left-[22%] w-px h-24 -rotate-12 landing-float-1" style={{ background: `linear-gradient(to bottom, transparent, rgba(99,102,241,0.12), transparent)` }} />

      <div className="relative z-10">
        <div className="flex items-center gap-3.5 mb-1">
          <img src="/logo-business.png" alt="AXIS Business" className="w-16 h-16 rounded-2xl object-cover" />
          <div>
            <span className="text-2xl font-bold tracking-tight text-white block" data-testid="text-brand-name">
              AXIS <span style={{ color: PRIMARY }}>Business</span>
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-start pt-0 pb-10 gap-8">
        <div>
          <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.08] mb-5">
            <span className="text-white">{t("axisBizAuth.heroTitle1")}</span>{" "}
            <span style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 50%, ${TERTIARY} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {t("axisBizAuth.heroTitle2")}
            </span>
            <br />
            <span className="text-white/30 text-3xl xl:text-4xl">{t("axisBizAuth.heroSub")}</span>
          </h2>
          <FeatureRotator />
        </div>
        <div className="flex flex-col gap-3">
          {DEMO_CARD_DEFS.map((def, i) => (
            <DemoCard key={i} def={def} delay={i * 0.12} />
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <div className="h-px w-full mb-5" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)" }} />
        <div className="flex items-center gap-6">
          {[
            { label: t("axisBizAuth.modReceipts"), color: PRIMARY },
            { label: t("axisBizAuth.modApprovals"), color: SECONDARY },
            { label: t("axisBizAuth.modAudit"), color: TERTIARY },
            { label: t("axisBizAuth.modReports"), color: ACCENT },
          ].map((mod) => (
            <div key={mod.label} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: mod.color, boxShadow: `0 0 6px ${mod.color}60` }} />
              <span className="text-xs text-white/25" data-testid={`text-module-${mod.label.toLowerCase()}`}>{mod.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

const STEP_LABEL_KEYS = ["stepLabel0", "stepLabel1", "stepLabel2"];

function StepIndicator({ step }: { step: number }) {
  const { t } = useTranslation();
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/35 font-medium">{t("axisBizAuth.stepOf", { current: step, total: 3 })}</span>
        <span className="text-xs font-semibold" style={{ color: PRIMARY }}>{t(`axisBizAuth.${STEP_LABEL_KEYS[step - 1]}`)}</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full transition-all duration-500"
            style={{
              background: s <= step
                ? `linear-gradient(90deg, ${PRIMARY}, ${SECONDARY})`
                : "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

const inputClass = "auth-input";
const labelClass = "block text-xs text-white/40 mb-2 font-medium tracking-wide uppercase";
const selectStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.85)",
  borderRadius: "12px",
  padding: "12px 14px",
  fontSize: "14px",
  width: "100%",
  outline: "none",
  appearance: "none" as const,
};

export default function BusinessAuthPage() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [isCollaboratorLogin, setIsCollaboratorLogin] = useState(false);
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  const [collabEmail, setCollabEmail] = useState("");
  const [collabPassword, setCollabPassword] = useState("");
  const [collabLoginError, setCollabLoginError] = useState<string | null>(null);
  const [collabIsLoading, setCollabIsLoading] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segment, setSegment] = useState("");

  const [closingDay, setClosingDay] = useState("5");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = `AXIS Business — ${isLogin ? t("axisBizAuth.titleLogin") : t("axisBizAuth.titleRegister")}`;
  }, [isLogin, t]);

  useEffect(() => {
    if (isLogin) setStep(1);
  }, [isLogin]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/business/auth/login", { email, password });
      const userData = await res.json();
      queryClient.setQueryData(["/api/auth/user"], userData);
      if (!userData?.onboardingCompleted) {
        setLocation("/business/welcome");
      } else {
        setLocation("/business/app");
      }
    } catch (err: any) {
      setLoginError(err?.message ?? t("axisBizAuth.loginError"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCollaboratorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCollabLoginError(null);
    setCollabIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/business/auth/collaborator-login", { email: collabEmail, password: collabPassword });
      const userData = await res.json();
      queryClient.setQueryData(["/api/auth/user"], userData);
      setLocation("/business/app");
    } catch (err: any) {
      setCollabLoginError(err?.message ?? t("axisBizAuth.loginError"));
    } finally {
      setCollabIsLoading(false);
    }
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleStep2Next = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(3);
  };

  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsLoading(true);
    try {
      const registerRes = await apiRequest("POST", "/api/business/auth/register", { email, password, firstName, lastName });
      const userData = await registerRes.json();
      queryClient.setQueryData(["/api/auth/user"], userData);
      const rawCnpj = cnpj.replace(/\D/g, "");
      await apiRequest("POST", "/api/business/organizations", {
        name: companyName,
        tradeName: tradeName || undefined,
        cnpj: rawCnpj || undefined,
        segment: segment || undefined,
        closingDay: closingDay ? parseInt(closingDay) : undefined,
        jobTitle: jobTitle || undefined,
      });
      setLocation("/business/welcome");
    } catch (err: any) {
      setSubmitError(err?.message ?? t("axisBizAuth.registerError"));
    } finally {
      setIsLoading(false);
    }
  };

  const error = isLogin ? (loginError ? new Error(loginError) : null) : (submitError ? new Error(submitError) : null);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0a0a0a] text-white relative">
      <button
        onClick={() => setLocation("/business")}
        className="absolute top-4 left-4 z-50 flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors text-sm"
        data-testid="button-back-to-landing"
      >
        <ArrowLeft className="w-4 h-4" />
        {t("axisBizAuth.back")}
      </button>
      <div className="hidden lg:block lg:w-[52%] xl:w-[55%]">
        <div className="h-screen sticky top-0">
          <BrandPanel />
        </div>
      </div>

      <div className="lg:hidden relative">
        <div className="relative px-6 py-5 overflow-hidden">
          <div className="absolute inset-0" style={{ background: "#060608" }} />
          <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(59,130,246,0.09) 0%, transparent 60%)`, filter: "blur(50px)" }} />
          <div className="landing-grain" />
          <div className="relative z-10 flex items-center gap-3">
            <img src="/logo-business.png" alt="AXIS Business" className="w-14 h-14 rounded-xl object-cover" />
            <div>
              <span className="text-xl font-bold tracking-tight block">
                AXIS <span style={{ color: PRIMARY }}>Business</span>
              </span>
              <p className="text-white/35 text-xs">{t("axisBizAuth.corpExpenseManagement")}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start lg:items-center justify-center px-6 py-10 lg:py-0 relative overflow-y-auto">
        <div className="absolute inset-0" style={{ background: "#0d0d10" }} />
        <div className="absolute top-[15%] right-[8%] w-[280px] h-[280px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 60%)`, filter: "blur(60px)" }} />
        <div className="absolute bottom-[20%] left-[5%] w-[200px] h-[200px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 60%)`, filter: "blur(50px)" }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[420px] relative z-10 py-4"
        >
          {isLogin ? (
            isCollaboratorLogin ? (
              <>
                <div className="mb-9">
                  <button
                    type="button"
                    onClick={() => { setIsCollaboratorLogin(false); setCollabLoginError(null); }}
                    className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors mb-5"
                    data-testid="button-back-to-manager-login"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {t("axisBizAuth.backToManagerLogin")}
                  </button>
                  <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-auth-title">
                    {t("axisBizAuth.collabAccess")}
                  </h1>
                  <p className="text-sm text-white/35">{t("axisBizAuth.collabSubtitle")}</p>
                </div>

                <form onSubmit={handleCollaboratorLogin} className="space-y-4" data-testid="form-collab-login">
                  <div>
                    <label className={labelClass}>{t("axisBizAuth.email")}</label>
                    <input type="email" value={collabEmail} onChange={(e) => setCollabEmail(e.target.value)} placeholder={t("axisBizAuth.emailPlaceholder")} required className={inputClass} data-testid="input-collab-email" />
                  </div>
                  <div>
                    <label className={labelClass}>{t("axisBizAuth.password")}</label>
                    <input type="password" value={collabPassword} onChange={(e) => setCollabPassword(e.target.value)} placeholder={t("axisBizAuth.collabPasswordPlaceholder")} required className={inputClass} data-testid="input-collab-password" />
                  </div>
                  {collabLoginError && (
                    <div className="flex items-start gap-2.5 text-xs py-3 px-4 rounded-xl" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: PRIMARY }} data-testid="text-collab-auth-error">
                      <span className="mt-0.5 flex-shrink-0">⚠</span>
                      <span>{collabLoginError}</span>
                    </div>
                  )}
                  <div className="pt-1">
                    <button type="submit" disabled={collabIsLoading} className="w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, boxShadow: `0 4px 24px rgba(59,130,246,0.25)` }} data-testid="button-collab-submit">
                      {collabIsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{t("axisBizAuth.loginAsCollab")}</span><ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </div>
                </form>
              </>
            ) : (
            <>
              <div className="mb-9">
                <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-auth-title">
                  {t("axisBizAuth.loginHeading")}
                </h1>
                <p className="text-sm text-white/35">{t("axisBizAuth.loginSubtitle")}</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4" data-testid="form-auth-login">
                <div>
                  <label className={labelClass}>{t("axisBizAuth.corpEmail")}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("axisBizAuth.emailPlaceholder")} required className={inputClass} data-testid="input-email" />
                </div>
                <div>
                  <label className={labelClass}>{t("axisBizAuth.password")}</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("axisBizAuth.passwordPlaceholder")} required minLength={6} className={inputClass} data-testid="input-password" />
                </div>
                {error && (
                  <div className="flex items-start gap-2.5 text-xs py-3 px-4 rounded-xl" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: PRIMARY }} data-testid="text-auth-error">
                    <span className="mt-0.5 flex-shrink-0">⚠</span>
                    <span>{(error as Error).message}</span>
                  </div>
                )}
                <div className="pt-1">
                  <button type="submit" disabled={isLoading} className="w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, boxShadow: `0 4px 24px rgba(59,130,246,0.25)` }} data-testid="button-auth-submit">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{t("axisBizAuth.loginBtn")}</span><ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </form>
            </>
            )
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-auth-title">
                  {t("axisBizAuth.registerHeading")}
                </h1>
                <p className="text-sm text-white/35">{t("axisBizAuth.registerSubtitle")}</p>
              </div>

              <StepIndicator step={step} />

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.form
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleStep1Next}
                    className="space-y-4"
                    data-testid="form-step1"
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>{t("axisBizAuth.firstName")}</label>
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t("axisBizAuth.firstNamePh")} required className={inputClass} data-testid="input-first-name" />
                      </div>
                      <div>
                        <label className={labelClass}>{t("axisBizAuth.lastName")}</label>
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t("axisBizAuth.lastNamePh")} required className={inputClass} data-testid="input-last-name" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>{t("axisBizAuth.jobTitle")}</label>
                      <select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required style={selectStyle} data-testid="select-job-title">
                        <option value="" disabled style={{ background: "#1a1a1f" }}>{t("axisBizAuth.selectJobTitle")}</option>
                        {JOB_TITLE_KEYS.map((key) => (
                          <option key={key} value={t(`axisBizAuth.${key}`)} style={{ background: "#1a1a1f" }}>{t(`axisBizAuth.${key}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>{t("axisBizAuth.corpEmail")}</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("axisBizAuth.emailPlaceholder")} required className={inputClass} data-testid="input-email" />
                    </div>
                    <div>
                      <label className={labelClass}>{t("axisBizAuth.password")}</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("axisBizAuth.passwordPlaceholder")} required minLength={6} className={inputClass} data-testid="input-password" />
                    </div>
                    <div className="pt-1">
                      <button type="submit" className="w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, boxShadow: `0 4px 24px rgba(59,130,246,0.25)` }} data-testid="button-step1-next">
                        {t("axisBizAuth.step1Next")} <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.form>
                )}

                {step === 2 && (
                  <motion.form
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleStep2Next}
                    className="space-y-4"
                    data-testid="form-step2"
                  >
                    <div>
                      <label className={labelClass}>{t("axisBizAuth.companyName")} <span style={{ color: PRIMARY }}>*</span></label>
                      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={t("axisBizAuth.companyNamePh")} required className={inputClass} data-testid="input-company-name" />
                    </div>
                    <div>
                      <label className={labelClass}>{t("axisBizAuth.tradeName")} <span className="text-white/20 normal-case font-normal">({t("axisBizAuth.optional")})</span></label>
                      <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder={t("axisBizAuth.tradeNamePh")} className={inputClass} data-testid="input-trade-name" />
                    </div>
                    <div>
                      <label className={labelClass}>{t("axisBizAuth.cnpj")} <span className="text-white/20 normal-case font-normal">({t("axisBizAuth.optional")})</span></label>
                      <input
                        value={cnpj}
                        onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                        placeholder="00.000.000/0000-00"
                        inputMode="numeric"
                        className={inputClass}
                        data-testid="input-cnpj"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>{t("axisBizAuth.segment")}</label>
                      <select value={segment} onChange={(e) => setSegment(e.target.value)} required style={selectStyle} data-testid="select-segment">
                        <option value="" disabled style={{ background: "#1a1a1f" }}>{t("axisBizAuth.selectSegment")}</option>
                        {SEGMENT_KEYS.map((key) => (
                          <option key={key} value={t(`axisBizAuth.${key}`)} style={{ background: "#1a1a1f" }}>{t(`axisBizAuth.${key}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all text-white/50 hover:text-white/70" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} data-testid="button-step2-back">
                        <ArrowLeft className="h-4 w-4" /> {t("axisBizAuth.back")}
                      </button>
                      <button type="submit" className="flex-[2] py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, boxShadow: `0 4px 24px rgba(59,130,246,0.25)` }} data-testid="button-step2-next">
                        {t("axisBizAuth.step2Next")} <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.form>
                )}

                {step === 3 && (
                  <motion.form
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                    onSubmit={handleStep3Submit}
                    className="space-y-4"
                    data-testid="form-step3"
                  >
                    <div
                      className="rounded-xl p-4 flex items-start gap-3"
                      style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.12)" }}
                    >
                      <Building2 className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: PRIMARY }} />
                      <div>
                        <p className="text-sm font-semibold text-white/80">{companyName}</p>
                        {tradeName && <p className="text-xs text-white/35 mt-0.5">{tradeName}</p>}
                        {segment && <p className="text-xs text-white/35">{segment}</p>}
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>{t("axisBizAuth.closingDay")}</label>
                      <select value={closingDay} onChange={(e) => setClosingDay(e.target.value)} style={selectStyle} data-testid="select-closing-day">
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d} style={{ background: "#1a1a1f" }}>{t("axisBizAuth.dayNum", { d })}</option>
                        ))}
                      </select>
                      <p className="text-xs text-white/30 mt-2 leading-relaxed">
                        {t("axisBizAuth.closingDayDesc")}
                      </p>
                    </div>

                    {submitError && (
                      <div className="flex items-start gap-2.5 text-xs py-3 px-4 rounded-xl" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: PRIMARY }} data-testid="text-auth-error">
                        <span className="mt-0.5 flex-shrink-0">⚠</span>
                        <span>{submitError}</span>
                      </div>
                    )}

                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => setStep(2)} className="flex-1 py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all text-white/50 hover:text-white/70" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} data-testid="button-step3-back">
                        <ArrowLeft className="h-4 w-4" /> {t("axisBizAuth.back")}
                      </button>
                      <button type="submit" disabled={isLoading} className="flex-[2] py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, boxShadow: `0 4px 24px rgba(59,130,246,0.25)` }} data-testid="button-auth-submit">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>{t("axisBizAuth.createCorpAccount")}</span><ArrowRight className="h-4 w-4" /></>}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </>
          )}

          <div className="mt-7 text-center flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setStep(1); setSubmitError(null); setIsCollaboratorLogin(false); }}
              className="text-sm text-white/30 transition-colors hover:text-white/50"
              data-testid="button-toggle-auth-mode"
            >
              {isLogin ? (
                <>{t("axisBizAuth.noAccount")}{" "}<span className="font-semibold" style={{ color: PRIMARY }}>{t("axisBizAuth.createNow")}</span></>
              ) : (
                <>{t("axisBizAuth.hasAccount")}{" "}<span className="font-semibold" style={{ color: PRIMARY }}>{t("axisBizAuth.signIn")}</span></>
              )}
            </button>
            {isLogin && !isCollaboratorLogin && (
              <button
                type="button"
                onClick={() => { setIsCollaboratorLogin(true); setLoginError(null); }}
                className="flex items-center gap-1.5 text-xs text-white/20 hover:text-white/40 transition-colors"
                data-testid="button-collab-login-toggle"
              >
                {t("axisBizAuth.loginAsCollabBtn")}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex items-center justify-center gap-5">
              {[
                { key: "trustLGPD", color: PRIMARY },
                { key: "trustSecure", color: SECONDARY },
                { key: "trustSupport", color: TERTIARY },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-1.5">
                  <Shield className="w-2.5 h-2.5 flex-shrink-0" style={{ color: item.color, opacity: 0.6 }} />
                  <span className="text-[11px] text-white/22">{t(`axisBizAuth.${item.key}`)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
