import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, TrendingUp, TrendingDown, Minus, Flame, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme, getModulePalette } from "@/components/theme-provider";
import { useTranslation } from "react-i18next";

interface DisciplineEntry {
  id: string;
  score: number;
  previousScore: number;
  delta: number;
  reasons: string[];
  createdAt: string;
}

function scoreColor(score: number, negative: string, primary: string, positive: string): string {
  if (score <= 4) return negative;
  if (score <= 7) return primary;
  return positive;
}

function DeltaBadge({ delta, positive, negative }: { delta: number; positive: string; negative: string }) {
  if (delta > 0)
    return (
      <span className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: positive }}>
        <TrendingUp className="h-3 w-3" />+{delta}
      </span>
    );
  if (delta < 0)
    return (
      <span className="flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: negative }}>
        <TrendingDown className="h-3 w-3" />{delta}
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-semibold text-muted-foreground">
      <Minus className="h-3 w-3" />0
    </span>
  );
}

function HowItWorks({ positive, negative, warn }: { positive: string; negative: string; warn: string }) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const Row = ({ label, pts, color }: { label: string; pts: string; color: string }) => (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-white/40">{label}</span>
      <span className="text-[10px] font-bold tabular-nums shrink-0 ml-2" style={{ color }}>{pts} pts</span>
    </div>
  );

  return (
    <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-1.5">{t("axisDiscipline.howItWorks")}</div>

      <div className="space-y-0.5">
        <Row label={t("axisDiscipline.tasksCompleted")} pts="+3 a +6" color={positive} />
        <Row label={t("axisDiscipline.habitsCompleted")} pts="+2" color={positive} />
        <Row label={t("axisDiscipline.spendingControl")} pts="+4 a −6" color={warn} />
        <Row label={t("axisDiscipline.delays")} pts="−4" color={negative} />
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 mt-1.5 text-[9px] text-white/25 hover:text-white/40 transition-colors"
        data-testid="button-toggle-discipline-details"
      >
        {expanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
        {expanded ? t("axisDiscipline.hideDetails") : t("axisDiscipline.viewDetails")}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2">
              <div>
                <div className="text-[9px] text-white/25 font-semibold uppercase tracking-wider mb-0.5">{t("axisDiscipline.tasksSectionTitle")}</div>
                <Row label={t("axisDiscipline.highPriority")} pts="+6" color={positive} />
                <Row label={t("axisDiscipline.mediumPriority")} pts="+4" color={positive} />
                <Row label={t("axisDiscipline.lowPriority")} pts="+3" color={positive} />
                <Row label={t("axisDiscipline.lateTask")} pts="−4" color={negative} />
              </div>
              <div>
                <div className="text-[9px] text-white/25 font-semibold uppercase tracking-wider mb-0.5">{t("axisDiscipline.spendingSectionTitle")}</div>
                <Row label={t("axisDiscipline.spendingGood")} pts="+4" color={positive} />
                <Row label={t("axisDiscipline.spendingOk")} pts="+2" color={positive} />
                <Row label={t("axisDiscipline.spendingNeutral")} pts="0" color="rgba(255,255,255,0.3)" />
                <Row label={t("axisDiscipline.spendingMildExcess")} pts="−2" color={warn} />
                <Row label={t("axisDiscipline.spendingModerateExcess")} pts="−4" color={negative} />
                <Row label={t("axisDiscipline.spendingHeavyExcess")} pts="−6" color={negative} />
              </div>
              <div>
                <div className="text-[9px] text-white/25 font-semibold uppercase tracking-wider mb-0.5">{t("axisDiscipline.aiJustifications")}</div>
                <Row label={t("axisDiscipline.justificationExcellent")} pts="+3" color={positive} />
                <Row label={t("axisDiscipline.justificationGood")} pts="+2" color={positive} />
                <Row label={t("axisDiscipline.justificationAcceptable")} pts="+1" color={positive} />
                <div className="text-[9px] text-white/20 mt-0.5">{t("axisDiscipline.aiEvaluatesNote")}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pt-1.5 mt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <span className="text-[9px] text-white/20">{t("axisDiscipline.levelNote")}</span>
      </div>
    </div>
  );
}

export function DisciplinePanel({
  open,
  onClose,
  score,
  disciplinePoints = 0,
}: {
  open: boolean;
  onClose: () => void;
  score: number;
  disciplinePoints?: number;
}) {
  const { theme } = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
  const MP = getModulePalette(theme as any);
  const { data: history = [], isLoading } = useQuery<DisciplineEntry[]>({
    queryKey: ["/api/discipline/history"],
    enabled: open,
  });

  function scoreLabel(s: number): string {
    if (s <= 2) return t("axisDiscipline.scoreCritical");
    if (s <= 4) return t("axisDiscipline.scoreLow");
    if (s <= 6) return t("axisDiscipline.scoreRegular");
    if (s <= 8) return t("axisDiscipline.scoreSolid");
    return t("axisDiscipline.scoreElite");
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString(lang, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const color = scoreColor(score, MP.negative, MP.primary, MP.positive);
  const label = scoreLabel(score);
  const latest = history[0];
  const delta = latest?.delta ?? 0;
  const currentReasons: string[] = Array.isArray(latest?.reasons) ? latest.reasons : [];

  const pts = disciplinePoints;
  const isPositive = pts >= 0;
  const barColor = isPositive ? MP.positive : MP.negative;
  const barPct = Math.min(Math.abs(pts) / 8 * 100, 100);
  const ptsLeft = 8 - Math.abs(pts);

  function ptsToLevelText(): string {
    if (Math.abs(pts) === 0) return t("axisDiscipline.completeToAccumulate");
    const countKey = ptsLeft === 1 ? (isPositive ? "ptsToRise" : "ptsToFall") : (isPositive ? "ptsToRisePlural" : "ptsToFallPlural");
    return t(`axisDiscipline.${countKey}`, { count: ptsLeft });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-0 md:left-[var(--sidebar-width,240px)] top-0 bottom-0 z-50 w-full md:w-72 flex flex-col overflow-hidden"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            style={{
              background: "#0d0d12",
              borderRight: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "4px 0 32px rgba(0,0,0,0.7)",
            }}
            data-testid="panel-discipline"
          >
            {/* Header */}
            <div className="px-4 pt-3 pb-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-1.5">
                  <Flame className="h-3.5 w-3.5" style={{ color }} />
                  <span className="text-xs font-semibold text-foreground">{t("axisDiscipline.scoreTitle")}</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
                  data-testid="button-close-discipline"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Score row — compact */}
              <div className="flex items-center gap-3 mb-2">
                <div
                  className="text-4xl font-black leading-none tabular-nums"
                  style={{ color }}
                  data-testid="text-discipline-score-panel"
                >
                  {score}
                </div>
                <div>
                  <div className="text-sm font-bold leading-tight" style={{ color }}>{label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{t("axisDiscipline.outOfPoints")}</div>
                  <div className="mt-0.5"><DeltaBadge delta={delta} positive={MP.positive} negative={MP.negative} /></div>
                </div>
              </div>

              {/* Score bar */}
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-2">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(score / 10) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{ background: `linear-gradient(90deg, ${color}, ${color}80)`, boxShadow: `0 0 8px ${color}50` }}
                />
              </div>

              {/* Points accumulator */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">{t("axisDiscipline.accumulatedPoints")}</span>
                <span className="text-[10px] font-bold" style={{ color: barColor }}>
                  {pts >= 0 ? "+" : ""}{pts} / 8
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden mb-1">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${barPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  style={{ background: barColor, boxShadow: `0 0 5px ${barColor}60` }}
                />
              </div>
              <p className="text-[10px] text-white/25">{ptsToLevelText()}</p>
            </div>

            {/* How it works — compact + expandable */}
            <HowItWorks positive={MP.positive} negative={MP.negative} warn={MP.agenda} />

            {/* Current state */}
            {currentReasons.length > 0 && (
              <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5">{t("axisDiscipline.currentState")}</div>
                <div className="space-y-1">
                  {currentReasons.map((reason, i) => (
                    <div key={i} className="text-[11px] text-muted-foreground leading-snug flex items-start gap-1.5">
                      <span className="flex-shrink-0 opacity-50 mt-0.5">·</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History */}
            <div className="flex-1 overflow-y-auto">
              <div
                className="px-4 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider border-b"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                {t("axisDiscipline.changeHistory")}
              </div>

              {isLoading && (
                <div className="flex items-center justify-center h-16">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${color} transparent transparent transparent` }}
                  />
                </div>
              )}

              {!isLoading && history.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <div className="text-muted-foreground text-xs mb-1">{t("axisDiscipline.noRecords")}</div>
                  <div className="text-muted-foreground text-[10px] opacity-60">
                    {t("axisDiscipline.autoRecordNote")}
                  </div>
                </div>
              )}

              {history.map((entry) => {
                const entryColor = scoreColor(entry.score, MP.negative, MP.primary, MP.positive);
                const parsedReasons: string[] = Array.isArray(entry.reasons) ? entry.reasons : [];
                return (
                  <div
                    key={entry.id}
                    className="px-4 py-2.5 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.04)" }}
                    data-testid={`discipline-entry-${entry.id}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{
                            background: `${entryColor}15`,
                            border: `1px solid ${entryColor}28`,
                            color: entryColor,
                          }}
                        >
                          {entry.score}
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-foreground">{scoreLabel(entry.score)}</div>
                          <div className="text-[9px] text-muted-foreground">{formatDate(entry.createdAt)}</div>
                        </div>
                      </div>
                      <DeltaBadge delta={entry.delta} positive={MP.positive} negative={MP.negative} />
                    </div>

                    {parsedReasons.length > 0 && (
                      <div className="space-y-0.5 pl-0.5">
                        {parsedReasons.map((reason, j) => (
                          <div key={j} className="text-[10px] text-muted-foreground leading-snug flex items-start gap-1">
                            <span className="flex-shrink-0 opacity-40 mt-0.5">·</span>
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
