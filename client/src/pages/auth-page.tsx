import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, ArrowRight, Mic, Calendar, TrendingUp, Flame, CheckCircle2 } from "lucide-react";

const CORAL = "#FF6B6B";
const GOLD = "#FFB347";
const LAVANDA = "#A78BFA";
const MINT = "#4ECDC4";

const features = [
  { text: "Registre gastos por voz em 3 segundos", color: CORAL },
  { text: "Agenda inteligente com sugestão de horários", color: GOLD },
  { text: "Compromissos com streaks e score de disciplina", color: LAVANDA },
  { text: "Chat com IA que conhece todos os seus dados", color: MINT },
  { text: "Foto de nota fiscal vira gasto categorizado", color: GOLD },
];

const demoCards = [
  {
    icon: Mic,
    color: CORAL,
    bg: "rgba(255,107,107,0.08)",
    border: "rgba(255,107,107,0.15)",
    voice: '"Gastei 45 reais no almoço"',
    result: "R$ 45,00 · Alimentação",
    tag: "Gasto registrado",
  },
  {
    icon: Calendar,
    color: GOLD,
    bg: "rgba(255,179,71,0.08)",
    border: "rgba(255,179,71,0.15)",
    voice: '"Reunião amanhã às 14h"',
    result: "Amanhã, 14:00 · Reunião",
    tag: "Evento criado",
  },
  {
    icon: Flame,
    color: LAVANDA,
    bg: "rgba(167,139,250,0.08)",
    border: "rgba(167,139,250,0.15)",
    voice: '"Estudar 2h por dia"',
    result: "Compromisso · Streak: 12 dias",
    tag: "Compromisso adicionado",
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
          <p className="text-xs text-white/35 mb-1 italic leading-relaxed">{card.voice}</p>
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

      <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(255,107,107,0.09) 0%, rgba(255,179,71,0.04) 40%, transparent 65%)`, filter: "blur(90px)" }} />
      <div className="absolute bottom-[-10%] left-[-15%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(167,139,250,0.07) 0%, transparent 55%)`, filter: "blur(70px)" }} />
      <div className="absolute top-[40%] left-[20%] w-[350px] h-[350px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(255,179,71,0.04) 0%, transparent 55%)`, filter: "blur(60px)" }} />
      <div className="absolute bottom-[30%] right-[10%] w-[200px] h-[200px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(78,205,196,0.04) 0%, transparent 55%)`, filter: "blur(50px)" }} />

      <div className="landing-grain" />

      <div className="absolute top-[18%] left-[12%] w-1.5 h-1.5 rounded-full landing-float-1" style={{ background: CORAL, opacity: 0.18 }} />
      <div className="absolute top-[55%] right-[15%] w-1 h-1 rounded-full landing-float-2" style={{ background: GOLD, opacity: 0.15 }} />
      <div className="absolute bottom-[22%] left-[35%] w-2 h-2 rounded-full landing-float-3" style={{ background: LAVANDA, opacity: 0.12 }} />
      <div className="absolute top-[30%] right-[30%] w-px h-20 rotate-45 landing-float-2" style={{ background: `linear-gradient(to bottom, transparent, ${CORAL}18, transparent)` }} />
      <div className="absolute bottom-[45%] left-[22%] w-px h-24 -rotate-12 landing-float-1" style={{ background: `linear-gradient(to bottom, transparent, ${GOLD}14, transparent)` }} />

      <div className="relative z-10">
        <div className="flex items-center gap-3.5 mb-1">
          <img src="/logo.png" alt="AXIS" className="w-16 h-16 rounded-2xl object-cover" />
          <div>
            <span className="text-2xl font-bold tracking-tight text-white block" data-testid="text-brand-name">AXIS</span>
            <span className="text-xs text-white/25 tracking-wide">Seu assistente de vida</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center py-10 gap-8">
        <div>
          <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.08] mb-5">
            <span className="text-white">Organize</span>{" "}
            <span style={{ background: `linear-gradient(135deg, ${CORAL} 0%, ${GOLD} 50%, ${LAVANDA} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              sua vida.
            </span>
            <br />
            <span className="text-white/30 text-3xl xl:text-4xl">Por voz ou texto.</span>
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
            { label: "Finanças", color: CORAL },
            { label: "Agenda", color: GOLD },
            { label: "Compromissos", color: LAVANDA },
            { label: "IA", color: MINT },
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

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const { login, register, isLoggingIn, isRegistering, loginError, registerError } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = `AXIS — ${isLogin ? "Entrar" : "Criar conta"}`;
  }, [isLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await login({ email, password });
        setLocation("/");
      } else {
        await register({ email, password, firstName, lastName });
        setLocation("/welcome");
      }
    } catch {}
  };

  const error = isLogin ? loginError : registerError;
  const isLoading = isLoggingIn || isRegistering;

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
          <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(255,107,107,0.08) 0%, transparent 60%)`, filter: "blur(50px)" }} />
          <div className="landing-grain" />
          <div className="relative z-10 flex items-center gap-3">
            <img src="/logo.png" alt="AXIS" className="w-14 h-14 rounded-xl object-cover" />
            <div>
              <span className="text-xl font-bold tracking-tight block">AXIS</span>
              <p className="text-white/35 text-xs">Organize sua vida. Por voz ou texto.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:py-0 relative">
        <div className="absolute inset-0" style={{ background: "#0d0d10" }} />
        <div className="absolute top-[15%] right-[8%] w-[280px] h-[280px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(255,107,107,0.04) 0%, transparent 60%)`, filter: "blur(60px)" }} />
        <div className="absolute bottom-[20%] left-[5%] w-[200px] h-[200px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 60%)`, filter: "blur(50px)" }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[400px] relative z-10"
        >
          <div className="mb-9">
            <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-auth-title">
              {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
            </h1>
            <p className="text-sm text-white/35">
              {isLogin ? "Entre com suas credenciais para continuar" : "Comece a organizar sua vida agora"}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
            data-testid="form-auth"
          >
            <div
              className="overflow-hidden transition-all duration-300"
              style={{ maxHeight: isLogin ? "0px" : "120px", opacity: isLogin ? 0 : 1 }}
            >
              <div className="grid grid-cols-2 gap-3 pb-1">
                <div>
                  <label htmlFor="firstName" className="block text-xs text-white/40 mb-2 font-medium tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>
                    Nome
                  </label>
                  <input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="João"
                    required={!isLogin}
                    tabIndex={isLogin ? -1 : 0}
                    className="auth-input"
                    data-testid="input-first-name"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-xs text-white/40 mb-2 font-medium tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>
                    Sobrenome
                  </label>
                  <input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Silva"
                    required={!isLogin}
                    tabIndex={isLogin ? -1 : 0}
                    className="auth-input"
                    data-testid="input-last-name"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-xs text-white/40 mb-2 font-medium tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="auth-input"
                data-testid="input-email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs text-white/40 mb-2 font-medium tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                minLength={6}
                className="auth-input"
                data-testid="input-password"
              />
            </div>

            {error && (
              <div
                className="flex items-start gap-2.5 text-xs py-3 px-4 rounded-xl"
                style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.18)", color: CORAL }}
                data-testid="text-auth-error"
              >
                <span className="mt-0.5 flex-shrink-0">⚠</span>
                <span>{(error as Error).message}</span>
              </div>
            )}

            <div className="pt-1">
              <button
                type="submit"
                disabled={isLoading}
                className="auth-submit-button w-full py-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                data-testid="button-auth-submit"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {isLogin ? "Entrar na conta" : "Criar minha conta"}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-7 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-white/30 transition-colors hover:text-white/50"
              data-testid="button-toggle-auth-mode"
            >
              {isLogin ? (
                <>Não tem conta?{" "}<span className="font-semibold" style={{ color: CORAL }}>Criar agora</span></>
              ) : (
                <>Já tem conta?{" "}<span className="font-semibold" style={{ color: CORAL }}>Entrar</span></>
              )}
            </button>
          </div>

          <div className="mt-10 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="flex items-center justify-center gap-7">
              {[
                { label: "Gratuito", color: CORAL },
                { label: "Sem cartão", color: GOLD },
                { label: "30 segundos", color: LAVANDA },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full" style={{ background: item.color, boxShadow: `0 0 4px ${item.color}80` }} />
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
