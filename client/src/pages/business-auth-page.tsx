import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2, ArrowRight, ArrowLeft, Camera, Zap, CheckCircle2, FileSpreadsheet, Shield, Building2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const PRIMARY   = "#3B82F6";
const SECONDARY = "#6366F1";
const TERTIARY  = "#8B5CF6";
const ACCENT    = "#0EA5E9";

const SEGMENTS = [
  "Tecnologia e Software",
  "Consultoria e Serviços",
  "Varejo e Comércio",
  "Logística e Transporte",
  "Construção e Engenharia",
  "Saúde e Bem-estar",
  "Educação",
  "Indústria e Manufatura",
  "Agronegócio",
  "Marketing e Publicidade",
  "Alimentação e Hospitalidade",
  "Outro",
];

const JOB_TITLES = [
  "Proprietário / CEO",
  "Diretor Financeiro (CFO)",
  "Gestor / Gerente",
  "Analista Financeiro",
  "Outro",
];

const features = [
  { text: "Colaboradores enviam recibos pelo WhatsApp", color: PRIMARY },
  { text: "IA classifica e registra automaticamente", color: SECONDARY },
  { text: "Gestores aprovam com um clique", color: ACCENT },
  { text: "Relatórios Excel prontos para auditoria", color: TERTIARY },
  { text: "Conformidade com políticas de reembolso", color: PRIMARY },
];

const demoCards = [
  {
    icon: Camera,
    color: PRIMARY,
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.15)",
    label: "Ana Costa enviou um recibo",
    result: "R$ 847,00 · Viagem corporativa",
    tag: "Despesa registrada",
  },
  {
    icon: Zap,
    color: SECONDARY,
    bg: "rgba(99,102,241,0.08)",
    border: "rgba(99,102,241,0.15)",
    label: "IA processou automaticamente",
    result: "Ibis Styles SP · Hospedagem · 2 diárias",
    tag: "Classificado pela IA",
  },
  {
    icon: FileSpreadsheet,
    color: TERTIARY,
    bg: "rgba(139,92,246,0.08)",
    border: "rgba(139,92,246,0.15)",
    label: "Gestor aprovou o lote",
    result: "12 despesas · Total: R$ 4.320,00",
    tag: "Relatório gerado",
  },
];

function FeatureRotator() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((prev) => (prev + 1) % features.length);
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
            <div className="w-1 h-6 rounded-full flex-shrink-0" style={{ background: features[idx].color }} />
            <p className="text-base text-white/60 font-medium leading-snug" data-testid="text-feature-highlight">
              {features[idx].text}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function DemoCard({ card, delay }: { card: typeof demoCards[0]; delay: number }) {
  const Icon = card.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-xl p-4 border"
      style={{ background: card.bg, borderColor: card.border }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: card.bg, border: `1px solid ${card.border}` }}>
          <Icon className="w-4 h-4" style={{ color: card.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/35 mb-1 italic leading-relaxed">{card.label}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color: card.color }} />
            <p className="text-xs font-semibold text-white/80">{card.result}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ color: card.color, background: card.bg, border: `1px solid ${card.border}` }}>
              {card.tag}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BrandPanel() {
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

      <div className="relative z-10 flex-1 flex flex-col justify-start pt-4 pb-10 gap-8">
        <div>
          <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.08] mb-5">
            <span className="text-white">Controle total</span>{" "}
            <span style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 50%, ${TERTIARY} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              das despesas.
            </span>
            <br />
            <span className="text-white/30 text-3xl xl:text-4xl">Zero planilha manual.</span>
          </h2>
          <FeatureRotator />
        </div>
        <div className="flex flex-col gap-3">
          {demoCards.map((card, i) => (
            <DemoCard key={i} card={card} delay={i * 0.12} />
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <div className="h-px w-full mb-5" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)" }} />
        <div className="flex items-center gap-6">
          {[
            { label: "Recibos", color: PRIMARY },
            { label: "Aprovações", color: SECONDARY },
            { label: "Auditoria", color: TERTIARY },
            { label: "Relatórios", color: ACCENT },
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

const STEP_LABELS = ["Responsável", "Empresa", "Configuração"];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-white/35 font-medium">Passo {step} de 3</span>
        <span className="text-xs font-semibold" style={{ color: PRIMARY }}>{STEP_LABELS[step - 1]}</span>
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
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");

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
    document.title = `AXIS Business — ${isLogin ? "Entrar" : "Criar conta"}`;
  }, [isLogin]);

  useEffect(() => {
    if (isLogin) setStep(1);
  }, [isLogin]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoading(true);
    try {
      const userData = await apiRequest("POST", "/api/business/auth/login", { email, password });
      queryClient.setQueryData(["/api/auth/user"], userData);
      if (!userData?.onboardingCompleted) {
        setLocation("/business/welcome");
      } else {
        setLocation("/business/app");
      }
    } catch (err: any) {
      setLoginError(err?.message ?? "Email ou senha incorretos");
    } finally {
      setIsLoading(false);
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
      const userData = await apiRequest("POST", "/api/business/auth/register", { email, password, firstName, lastName });
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
      setSubmitError(err?.message ?? "Erro ao criar conta. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const error = isLogin ? (loginError ? new Error(loginError) : null) : (submitError ? new Error(submitError) : null);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#0a0a0a] text-white">
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
              <p className="text-white/35 text-xs">Gestão corporativa de despesas</p>
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
            <>
              <div className="mb-9">
                <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-auth-title">
                  Acesse sua conta
                </h1>
                <p className="text-sm text-white/35">Entre com suas credenciais para continuar</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4" data-testid="form-auth-login">
                <div>
                  <label className={labelClass}>E-mail corporativo</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" required className={inputClass} data-testid="input-email" />
                </div>
                <div>
                  <label className={labelClass}>Senha</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} className={inputClass} data-testid="input-password" />
                </div>
                {error && (
                  <div className="flex items-start gap-2.5 text-xs py-3 px-4 rounded-xl" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", color: PRIMARY }} data-testid="text-auth-error">
                    <span className="mt-0.5 flex-shrink-0">⚠</span>
                    <span>{(error as Error).message}</span>
                  </div>
                )}
                <div className="pt-1">
                  <button type="submit" disabled={isLoading} className="w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, boxShadow: `0 4px 24px rgba(59,130,246,0.25)` }} data-testid="button-auth-submit">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Entrar na conta</span><ArrowRight className="h-4 w-4" /></>}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="mb-7">
                <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-auth-title">
                  Criar conta corporativa
                </h1>
                <p className="text-sm text-white/35">Configure sua empresa e comece agora</p>
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
                        <label className={labelClass}>Nome</label>
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="João" required className={inputClass} data-testid="input-first-name" />
                      </div>
                      <div>
                        <label className={labelClass}>Sobrenome</label>
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Silva" required className={inputClass} data-testid="input-last-name" />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Cargo / Função</label>
                      <select value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required style={selectStyle} data-testid="select-job-title">
                        <option value="" disabled style={{ background: "#1a1a1f" }}>Selecione seu cargo</option>
                        {JOB_TITLES.map((t) => (
                          <option key={t} value={t} style={{ background: "#1a1a1f" }}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>E-mail corporativo</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" required className={inputClass} data-testid="input-email" />
                    </div>
                    <div>
                      <label className={labelClass}>Senha</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} className={inputClass} data-testid="input-password" />
                    </div>
                    <div className="pt-1">
                      <button type="submit" className="w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, boxShadow: `0 4px 24px rgba(59,130,246,0.25)` }} data-testid="button-step1-next">
                        Próximo: Dados da empresa <ArrowRight className="h-4 w-4" />
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
                      <label className={labelClass}>Razão Social <span style={{ color: PRIMARY }}>*</span></label>
                      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Empresa Ltda." required className={inputClass} data-testid="input-company-name" />
                    </div>
                    <div>
                      <label className={labelClass}>Nome Fantasia <span className="text-white/20 normal-case font-normal">(opcional)</span></label>
                      <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Como a empresa é conhecida" className={inputClass} data-testid="input-trade-name" />
                    </div>
                    <div>
                      <label className={labelClass}>CNPJ <span className="text-white/20 normal-case font-normal">(opcional)</span></label>
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
                      <label className={labelClass}>Segmento / Ramo de Atividade</label>
                      <select value={segment} onChange={(e) => setSegment(e.target.value)} required style={selectStyle} data-testid="select-segment">
                        <option value="" disabled style={{ background: "#1a1a1f" }}>Selecione o segmento</option>
                        {SEGMENTS.map((s) => (
                          <option key={s} value={s} style={{ background: "#1a1a1f" }}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all text-white/50 hover:text-white/70" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }} data-testid="button-step2-back">
                        <ArrowLeft className="h-4 w-4" /> Voltar
                      </button>
                      <button type="submit" className="flex-[2] py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, boxShadow: `0 4px 24px rgba(59,130,246,0.25)` }} data-testid="button-step2-next">
                        Próximo: Configuração <ArrowRight className="h-4 w-4" />
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
                      <label className={labelClass}>Dia de Fechamento</label>
                      <select value={closingDay} onChange={(e) => setClosingDay(e.target.value)} style={selectStyle} data-testid="select-closing-day">
                        {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                          <option key={d} value={d} style={{ background: "#1a1a1f" }}>Dia {d}</option>
                        ))}
                      </select>
                      <p className="text-xs text-white/30 mt-2 leading-relaxed">
                        O AXIS enviará relatórios automáticos de despesas nesse dia todo mês.
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
                        <ArrowLeft className="h-4 w-4" /> Voltar
                      </button>
                      <button type="submit" disabled={isLoading} className="flex-[2] py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white" style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${SECONDARY} 100%)`, boxShadow: `0 4px 24px rgba(59,130,246,0.25)` }} data-testid="button-auth-submit">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><span>Criar conta corporativa</span><ArrowRight className="h-4 w-4" /></>}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </>
          )}

          <div className="mt-7 text-center">
            <button
              type="button"
              onClick={() => { setIsLogin(!isLogin); setStep(1); setSubmitError(null); }}
              className="text-sm text-white/30 transition-colors hover:text-white/50"
              data-testid="button-toggle-auth-mode"
            >
              {isLogin ? (
                <>Não tem conta?{" "}<span className="font-semibold" style={{ color: PRIMARY }}>Criar agora</span></>
              ) : (
                <>Já tem conta?{" "}<span className="font-semibold" style={{ color: PRIMARY }}>Entrar</span></>
              )}
            </button>
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex items-center justify-center gap-5">
              {[
                { label: "LGPD", color: PRIMARY },
                { label: "Dados seguros", color: SECONDARY },
                { label: "Suporte dedicado", color: TERTIARY },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <Shield className="w-2.5 h-2.5 flex-shrink-0" style={{ color: item.color, opacity: 0.6 }} />
                  <span className="text-[11px] text-white/22">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
