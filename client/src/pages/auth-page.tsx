import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, createContext, useContext } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Loader2, ArrowRight, ArrowLeft, Mic, Calendar, Flame } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme, type AxisTheme } from "@/components/theme-provider";
import { getLandingPalette, type LandingPalette } from "@/lib/landing-palette";

const AuthPaletteContext = createContext<LandingPalette>(getLandingPalette("slim"));

function useAuthPalette() {
  return useContext(AuthPaletteContext);
}

const DEMO_ICONS = [Mic, Calendar, Flame];

function FeatureRotator() {
  const { t } = useTranslation();
  const LP = useAuthPalette();
  const features = [
    { text: t("axisAuth.feature0"), color: LP.primary },
    { text: t("axisAuth.feature1"), color: LP.secondary },
    { text: t("axisAuth.feature2"), color: LP.tertiary },
    { text: t("axisAuth.feature3"), color: LP.success },
    { text: t("axisAuth.feature4"), color: LP.secondary },
  ];
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIdx((prev) => (prev + 1) % features.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [features.length]);

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

function DemoCard({ cardIndex, delay }: { cardIndex: number; delay: number }) {
  const { t } = useTranslation();
  const LP = useAuthPalette();
  const Icon = DEMO_ICONS[cardIndex];
  const colors = [LP.primary, LP.secondary, LP.tertiary];
  const rgbs = [LP.primaryRgb, LP.secondaryRgb, LP.tertiaryRgb];
  const color = colors[cardIndex];
  const rgb = rgbs[cardIndex];
  const bg = `rgba(${rgb},0.08)`;
  const border = `rgba(${rgb},0.15)`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay }}
      className="rounded-xl p-4 border"
      style={{ background: bg, borderColor: border }}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: bg, border: `1px solid ${border}` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/35 mb-1 italic leading-relaxed">{t(`axisAuth.card${cardIndex}Voice`)}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-3 h-3 flex-shrink-0" style={{ color }} />
            <p className="text-xs font-semibold text-white/80">{t(`axisAuth.card${cardIndex}Result`)}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ color, background: bg, border: `1px solid ${border}` }}>
              {t(`axisAuth.card${cardIndex}Tag`)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function BrandPanel() {
  const { t } = useTranslation();
  const LP = useAuthPalette();
  const modules = [
    { key: "module0", color: LP.primary },
    { key: "module1", color: LP.secondary },
    { key: "module2", color: LP.tertiary },
    { key: "module3", color: LP.success },
  ];
  return (
    <div className="relative flex flex-col justify-between h-full p-10 xl:p-14 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "#060608" }} />

      <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.primaryRgb},0.09) 0%, rgba(${LP.secondaryRgb},0.04) 40%, transparent 65%)`, filter: "blur(90px)" }} />
      <div className="absolute bottom-[-10%] left-[-15%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.tertiaryRgb},0.07) 0%, transparent 55%)`, filter: "blur(70px)" }} />
      <div className="absolute top-[40%] left-[20%] w-[350px] h-[350px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.secondaryRgb},0.04) 0%, transparent 55%)`, filter: "blur(60px)" }} />
      <div className="absolute bottom-[30%] right-[10%] w-[200px] h-[200px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.successRgb},0.04) 0%, transparent 55%)`, filter: "blur(50px)" }} />

      <div className="landing-grain" />

      <div className="absolute top-[18%] left-[12%] w-1.5 h-1.5 rounded-full landing-float-1" style={{ background: LP.primary, opacity: 0.18 }} />
      <div className="absolute top-[55%] right-[15%] w-1 h-1 rounded-full landing-float-2" style={{ background: LP.secondary, opacity: 0.15 }} />
      <div className="absolute bottom-[22%] left-[35%] w-2 h-2 rounded-full landing-float-3" style={{ background: LP.tertiary, opacity: 0.12 }} />
      <div className="absolute top-[30%] right-[30%] w-px h-20 rotate-45 landing-float-2" style={{ background: `linear-gradient(to bottom, transparent, ${LP.primary}18, transparent)` }} />
      <div className="absolute bottom-[45%] left-[22%] w-px h-24 -rotate-12 landing-float-1" style={{ background: `linear-gradient(to bottom, transparent, ${LP.secondary}14, transparent)` }} />

      <div className="relative z-10">
        <div className="flex items-center gap-3.5 mb-1">
          <img src="/logo.png" alt="AXIS" className="w-16 h-16 rounded-2xl object-cover" />
          <div>
            <span className="text-2xl font-bold tracking-tight text-white block" data-testid="text-brand-name">AXIS</span>
            <span className="text-xs text-white/25 tracking-wide">{t("axisAuth.brandSubtitle")}</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center py-10 gap-8">
        <div>
          <h2 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.08] mb-5">
            <span className="text-white">{t("axisAuth.heroTitle1")}</span>{" "}
            <span style={{ background: `linear-gradient(135deg, ${LP.primary} 0%, ${LP.secondary} 50%, ${LP.tertiary} 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              {t("axisAuth.heroGradient")}
            </span>
            <br />
            <span className="text-white/30 text-3xl xl:text-4xl">{t("axisAuth.heroSubtitle")}</span>
          </h2>
          <FeatureRotator />
        </div>

        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <DemoCard key={i} cardIndex={i} delay={i * 0.12} />
          ))}
        </div>
      </div>

      <div className="relative z-10">
        <div className="h-px w-full mb-5" style={{ background: "linear-gradient(to right, transparent, rgba(255,255,255,0.05), transparent)" }} />
        <div className="flex items-center gap-6">
          {modules.map((mod) => (
            <div key={mod.key} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: mod.color, boxShadow: `0 0 6px ${mod.color}60` }} />
              <span className="text-xs text-white/25" data-testid={`text-module-${mod.key}`}>{t(`axisAuth.${mod.key}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const { login, register, isLoggingIn, isRegistering, loginError, registerError } = useAuth();
  const [, setLocation] = useLocation();
  const { theme } = useTheme();
  const LP = getLandingPalette(theme as AxisTheme);

  const cssVars = {
    "--lp-primary-rgb": LP.primaryRgb,
    "--lp-secondary-rgb": LP.secondaryRgb,
    "--lp-tertiary-rgb": LP.tertiaryRgb,
    "--lp-success-rgb": LP.successRgb,
  } as React.CSSProperties;

  useEffect(() => {
    document.title = `AXIS — ${isLogin ? t("axisAuth.loginTitle") : t("axisAuth.registerTitle")}`;
  }, [isLogin, t]);

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
    <AuthPaletteContext.Provider value={LP}>
      <div className="min-h-screen flex flex-col lg:flex-row bg-[#0a0a0a] text-white relative" style={cssVars}>
        <button
          onClick={() => setLocation("/")}
          className="absolute top-4 left-4 z-50 flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors text-sm"
          data-testid="button-back-to-landing"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("axisAuth.backButton")}
        </button>

        <div className="hidden lg:block lg:w-[52%] xl:w-[55%]">
          <div className="h-screen sticky top-0">
            <BrandPanel />
          </div>
        </div>

        <div className="lg:hidden relative">
          <div className="relative px-6 py-5 overflow-hidden">
            <div className="absolute inset-0" style={{ background: "#060608" }} />
            <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.primaryRgb},0.08) 0%, transparent 60%)`, filter: "blur(50px)" }} />
            <div className="landing-grain" />
            <div className="relative z-10 flex items-center gap-3">
              <img src="/logo.png" alt="AXIS" className="w-14 h-14 rounded-xl object-cover" />
              <div>
                <span className="text-xl font-bold tracking-tight block">AXIS</span>
                <p className="text-white/35 text-xs">{t("axisAuth.mobileSubtitle")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12 lg:py-0 relative">
          <div className="absolute inset-0" style={{ background: "#0d0d10" }} />
          <div className="absolute top-[15%] right-[8%] w-[280px] h-[280px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.primaryRgb},0.04) 0%, transparent 60%)`, filter: "blur(60px)" }} />
          <div className="absolute bottom-[20%] left-[5%] w-[200px] h-[200px] rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, rgba(${LP.tertiaryRgb},0.04) 0%, transparent 60%)`, filter: "blur(50px)" }} />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-[400px] relative z-10"
          >
            <div className="mb-9">
              <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="text-auth-title">
                {isLogin ? t("axisAuth.loginTitle") : t("axisAuth.registerTitle")}
              </h1>
              <p className="text-sm text-white/35">
                {isLogin ? t("axisAuth.loginSubtitle") : t("axisAuth.registerSubtitle")}
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
                      {t("axisAuth.nameLabel")}
                    </label>
                    <input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder={t("axisAuth.firstNamePh")}
                      required={!isLogin}
                      tabIndex={isLogin ? -1 : 0}
                      className="auth-input"
                      data-testid="input-first-name"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-xs text-white/40 mb-2 font-medium tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>
                      {t("axisAuth.surnameLabel")}
                    </label>
                    <input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder={t("axisAuth.lastNamePh")}
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
                  {t("axisAuth.emailLabel")}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("axisAuth.emailPlaceholder")}
                  required
                  className="auth-input"
                  data-testid="input-email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs text-white/40 mb-2 font-medium tracking-wide uppercase" style={{ letterSpacing: "0.06em" }}>
                  {t("axisAuth.passwordLabel")}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("axisAuth.passwordPh")}
                  required
                  minLength={6}
                  className="auth-input"
                  data-testid="input-password"
                />
              </div>

              {error && (
                <div
                  className="flex items-start gap-2.5 text-xs py-3 px-4 rounded-xl"
                  style={{ background: `rgba(${LP.primaryRgb},0.08)`, border: `1px solid rgba(${LP.primaryRgb},0.18)`, color: LP.primary }}
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
                      {isLogin ? t("axisAuth.loginBtn") : t("axisAuth.registerBtn")}
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
                  <>{t("axisAuth.noAccount")}{" "}<span className="font-semibold" style={{ color: LP.primary }}>{t("axisAuth.createNow")}</span></>
                ) : (
                  <>{t("axisAuth.hasAccount")}{" "}<span className="font-semibold" style={{ color: LP.primary }}>{t("axisAuth.signIn")}</span></>
                )}
              </button>
            </div>

            <div className="mt-10 pt-6" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="flex items-center justify-center gap-7">
                {[
                  { key: "badgeFree", color: LP.primary },
                  { key: "badgeNoCard", color: LP.secondary },
                  { key: "badgeSeconds", color: LP.tertiary },
                ].map((item) => (
                  <div key={item.key} className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full" style={{ background: item.color, boxShadow: `0 0 4px ${item.color}80` }} />
                    <span className="text-[11px] text-white/22">{t(`axisAuth.${item.key}`)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AuthPaletteContext.Provider>
  );
}
