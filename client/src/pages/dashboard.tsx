import { useQuery } from "@tanstack/react-query";
import { DollarSign, Calendar, CheckSquare, Flame, TrendingUp, TrendingDown, ArrowRight, Target, Sparkles, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { CaptureButton } from "@/components/capture-button";
import { motion, AnimatePresence } from "framer-motion";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTheme, getPrimaryHex } from "@/components/theme-provider";
import { SetupSheet } from "@/components/setup-sheet";

const HIGH_PALETTE = {
  primary: "#00E6FF",
  finance: "#FF1744",
  agenda: "#FFA000",
  tasks: "#AE73FF",
  habits: "#00E5C8",
  positive: "#00E5C8",
  negative: "#FF1744",
};

const SLIM_PALETTE = {
  primary: "#7A9E8A",
  finance: "#7A9E8A",
  agenda: "#7A9E8A",
  tasks: "#7A9E8A",
  habits: "#7A9E8A",
  positive: "#5A8F70",
  negative: "#9E7575",
};

const MINT = "#00E5C8";


function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="h-8 w-32 rounded bg-muted" />
      <div className="h-2 w-full rounded bg-muted" />
      <div className="h-2 w-3/4 rounded bg-muted" />
    </div>
  );
}

function ModuleCard({
  children,
  color,
  href,
  testId,
  delay = 0,
  isHigh,
}: {
  children: ReactNode;
  color: string;
  href: string;
  testId: string;
  delay?: number;
  isHigh: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl border bg-card overflow-hidden group transition-all duration-200"
      style={{ borderColor: `${color}18` }}
      data-testid={testId}
    >
      <div
        className="h-[3px] w-full"
        style={{
          background: isHigh
            ? `linear-gradient(90deg, ${color}, ${color}55)`
            : color,
          opacity: isHigh ? 1 : 0.6,
        }}
      />
      <div className="p-5">
        {children}
        <Link href={href}>
          <button
            className="mt-4 flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: isHigh ? color : "hsl(var(--muted-foreground))" }}
          >
            Ver detalhes <ArrowRight className="h-3 w-3" />
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

function ProgressBar({
  value,
  max,
  color,
  isHigh,
}: {
  value: number;
  max: number;
  color: string;
  isHigh: boolean;
}) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: isHigh ? `linear-gradient(90deg, ${color}, ${color}80)` : color,
          boxShadow: isHigh ? `0 0 6px ${color}50` : "none",
        }}
      />
    </div>
  );
}

function CardIcon({
  icon: Icon,
  color,
  isHigh,
}: {
  icon: any;
  color: string;
  isHigh: boolean;
}) {
  if (isHigh) {
    return (
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: `${color}18` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
    );
  }
  return <Icon className="h-4 w-4 opacity-50" style={{ color }} />;
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/dashboard"] });
  const { data: setupStatus } = useQuery<{ completed: boolean }>({ queryKey: ["/api/onboarding/setup/status"] });
  const [showSetupModal, setShowSetupModal] = useState(false);
  const { theme } = useTheme();
  const isHigh = theme.startsWith("high");
  const setupPending = setupStatus !== undefined && !setupStatus.completed;
  const P = { ...(isHigh ? HIGH_PALETTE : SLIM_PALETTE), primary: getPrimaryHex(theme) };

  const hour = new Date().getHours();
  const greetWord = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const name = data?.userName || "";
  const disciplineScore = data?.disciplineScore || 5;

  const scoreColor = disciplineScore <= 4 ? "#FF1744" : disciplineScore <= 7 ? "#2979FF" : "#00E5C8";

  const activeModules: string[] = data?.activeModules || [];
  const showAll = activeModules.length === 0;

  if (isLoading) {
    return (
      <div className="px-6 py-6 space-y-6">
        <div className="space-y-2">
          <div className="h-4 w-20 rounded bg-muted animate-pulse" />
          <div className="h-8 w-56 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 pb-28 space-y-6">
      <title>AXIS — Dashboard</title>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <p className="text-sm text-muted-foreground mb-0.5">{greetWord}</p>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={
              isHigh && name
                ? {
                    background: `linear-gradient(135deg, #fff 40%, ${P.primary})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }
                : {}
            }
            data-testid="text-greeting"
          >
            {name || "Dashboard"}
          </h1>
        </div>

        {/* Discipline Score */}
        <div
          className="flex flex-col items-center justify-center rounded-2xl px-5 py-3 min-w-[90px]"
          style={{
            background: `${scoreColor}0D`,
            border: `1px solid ${scoreColor}20`,
          }}
        >
          <Flame
            className={`h-4 w-4 mb-1 ${isHigh ? "high-flame" : ""}`}
            style={{ color: isHigh ? HIGH_PALETTE.negative : SLIM_PALETTE.primary }}
          />
          <span
            className={`text-2xl font-bold leading-none ${isHigh ? "high-score-text" : ""}`}
            style={{ color: scoreColor }}
            data-testid="text-dashboard-discipline"
          >
            {disciplineScore}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5">/10</span>
        </div>
      </motion.div>

      {/* Capture */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
      >
        <CaptureButton variant="inline" />
      </motion.div>

      {/* Module Cards */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Finance */}
        {(showAll || activeModules.includes("finance")) && data?.finance && (
          <ModuleCard color={P.finance} href="/finance" testId="card-finance-summary" delay={0.12} isHigh={isHigh}>
            <div className="flex items-center gap-2 mb-4">
              <CardIcon icon={DollarSign} color={P.finance} isHigh={isHigh} />
              <span className="text-sm font-semibold text-muted-foreground">Finanças do mês</span>
            </div>

            <div
              className="text-3xl font-bold mb-1"
              style={{ color: data.finance.balance >= 0 ? P.positive : P.negative }}
              data-testid="text-balance"
            >
              R$ {data.finance.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mb-4">saldo atual</p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingDown className="h-3 w-3" style={{ color: P.negative }} /> Gastos
                </span>
                <span className="font-semibold" data-testid="text-total-expenses">
                  R$ {data.finance.totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <ProgressBar
                value={data.finance.totalExpenses}
                max={data.finance.totalExpenses + data.finance.totalIncome}
                color={P.negative}
                isHigh={isHigh}
              />

              <div className="flex items-center justify-between text-xs mt-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" style={{ color: P.positive }} /> Receitas
                </span>
                <span className="font-semibold" data-testid="text-total-income">
                  R$ {data.finance.totalIncome.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <ProgressBar
                value={data.finance.totalIncome}
                max={data.finance.totalExpenses + data.finance.totalIncome}
                color={P.positive}
                isHigh={isHigh}
              />
            </div>
          </ModuleCard>
        )}

        {/* Agenda */}
        {(showAll || activeModules.includes("schedule")) && (
          <ModuleCard color={P.agenda} href="/agenda" testId="card-schedule-today" delay={0.17} isHigh={isHigh}>
            <div className="flex items-center gap-2 mb-4">
              <CardIcon icon={Calendar} color={P.agenda} isHigh={isHigh} />
              <span className="text-sm font-semibold text-muted-foreground">Agenda de hoje</span>
            </div>

            {data?.schedule?.length > 0 ? (
              <div className="space-y-3">
                {data.schedule.slice(0, 3).map((item: any, i: number) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{
                        background: P.agenda,
                        opacity: i === 0 ? 0.9 : 0.3,
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" data-testid={`text-schedule-${item.id}`}>
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-15" />
                <p className="text-sm text-muted-foreground">Dia livre — sem compromissos</p>
              </div>
            )}
          </ModuleCard>
        )}

        {/* Tasks */}
        {(showAll || activeModules.includes("tasks")) && (
          <ModuleCard color={P.tasks} href="/tasks" testId="card-tasks-summary" delay={0.22} isHigh={isHigh}>
            <div className="flex items-center gap-2 mb-4">
              <CardIcon icon={CheckSquare} color={P.tasks} isHigh={isHigh} />
              <span className="text-sm font-semibold text-muted-foreground">Tarefas</span>
            </div>

            <div className="flex items-end gap-2 mb-3">
              <span
                className="text-4xl font-bold"
                style={{ color: P.tasks }}
                data-testid="text-pending-tasks"
              >
                {data?.tasks?.pending || 0}
              </span>
              <span className="text-sm text-muted-foreground mb-1">pendentes</span>
            </div>

            {data?.tasks?.urgent?.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Urgentes</p>
                {data.tasks.urgent.slice(0, 3).map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <div
                      className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                      style={{ background: P.negative }}
                    />
                    <span className="truncate" data-testid={`text-urgent-task-${t.id}`}>{t.title}</span>
                  </div>
                ))}
              </div>
            )}
          </ModuleCard>
        )}

        {/* Habits */}
        {(showAll || activeModules.includes("habits")) && data?.habits && (
          <ModuleCard color={P.habits} href="/tasks" testId="card-habits-summary" delay={0.27} isHigh={isHigh}>
            <div className="flex items-center gap-2 mb-4">
              <CardIcon icon={Flame} color={P.habits} isHigh={isHigh} />
              <span className="text-sm font-semibold text-muted-foreground">Compromissos</span>
            </div>

            {data.habits.length > 0 ? (
              <div className="space-y-3">
                {data.habits.slice(0, 4).map((h: any) => {
                  const streakColor = isHigh
                    ? h.streak >= 7 ? HIGH_PALETTE.primary : h.streak >= 3 ? HIGH_PALETTE.agenda : HIGH_PALETTE.negative
                    : SLIM_PALETTE.primary;

                  return (
                    <div key={h.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="text-sm font-medium truncate max-w-[60%]"
                          data-testid={`text-habit-${h.id}`}
                        >
                          {h.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <Flame className="h-3 w-3" style={{ color: streakColor }} />
                          <span className="text-xs font-bold" style={{ color: streakColor }}>
                            {h.streak}d
                          </span>
                        </div>
                      </div>
                      <ProgressBar
                        value={Math.min(h.streak, 30)}
                        max={30}
                        color={streakColor}
                        isHigh={isHigh}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4 text-center">
                <Target className="h-8 w-8 mx-auto mb-2 opacity-15" />
                <p className="text-sm text-muted-foreground">Nenhum compromisso ainda</p>
              </div>
            )}
          </ModuleCard>
        )}

        {/* Setup Pending Card */}
        {setupPending && (
          <motion.button
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
            onClick={() => setShowSetupModal(true)}
            className="rounded-2xl border bg-card overflow-hidden text-left transition-all duration-200 hover:opacity-80 group"
            style={{ borderColor: `${MINT}18` }}
            data-testid="button-setup-pending-card"
          >
            <div className="h-[3px] w-full" style={{ background: isHigh ? `linear-gradient(90deg, ${MINT}, ${MINT}55)` : MINT, opacity: isHigh ? 1 : 0.6 }} />
            <div className="p-5 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-4">
                {isHigh ? (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${MINT}18` }}>
                    <Sparkles className="h-4 w-4" style={{ color: MINT }} />
                  </div>
                ) : (
                  <Sparkles className="h-4 w-4 opacity-50" style={{ color: MINT }} />
                )}
                <span className="text-sm font-semibold text-muted-foreground">Perfil incompleto</span>
              </div>
              <p className="text-lg font-bold mb-1" style={{ color: MINT }}>Finalize seu cadastro</p>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                Adicione sua renda, gastos fixos e rotina para que o AXIS configure tudo automaticamente desde agora.
              </p>
              <div className="mt-auto flex items-center gap-1.5 text-xs font-medium" style={{ color: isHigh ? MINT : "hsl(var(--muted-foreground))" }}>
                Completar agora <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </motion.button>
        )}
      </div>

      <SetupSheet open={showSetupModal} onClose={() => setShowSetupModal(false)} />
    </div>
  );
}
