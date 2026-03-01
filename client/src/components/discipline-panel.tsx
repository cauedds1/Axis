import { useQuery } from "@tanstack/react-query";
import { X, TrendingUp, TrendingDown, Minus, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DisciplineEntry {
  id: string;
  score: number;
  previousScore: number;
  delta: number;
  reasons: string[];
  createdAt: string;
}

function scoreColor(score: number): string {
  if (score <= 4) return "#FF6B6B";
  if (score <= 7) return "#4A90E2";
  return "#4ECDC4";
}

function scoreLabel(score: number): string {
  if (score <= 2) return "Crítico";
  if (score <= 4) return "Baixo";
  if (score <= 6) return "Regular";
  if (score <= 8) return "Sólido";
  return "Elite";
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0)
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: "#4ECDC4" }}>
        <TrendingUp className="h-3 w-3" />+{delta}
      </span>
    );
  if (delta < 0)
    return (
      <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: "#FF6B6B" }}>
        <TrendingDown className="h-3 w-3" />{delta}
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground">
      <Minus className="h-3 w-3" />0
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const { data: history = [], isLoading } = useQuery<DisciplineEntry[]>({
    queryKey: ["/api/discipline/history"],
    enabled: open,
  });

  const color = scoreColor(score);
  const label = scoreLabel(score);
  const latest = history[0];
  const delta = latest?.delta ?? 0;
  const currentReasons: string[] = Array.isArray(latest?.reasons) ? latest.reasons : [];

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
            className="fixed left-[var(--sidebar-width,240px)] top-0 bottom-0 z-50 w-80 flex flex-col overflow-hidden"
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
            <div className="p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame className="h-4 w-4" style={{ color }} />
                  <span className="text-sm font-semibold text-foreground">Score de Disciplina</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
                  data-testid="button-close-discipline"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Big score + label + delta */}
              <div className="flex items-end gap-4 mb-3">
                <div>
                  <div
                    className="text-6xl font-black leading-none tabular-nums"
                    style={{ color }}
                    data-testid="text-discipline-score-panel"
                  >
                    {score}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">de 10 pontos</div>
                </div>
                <div className="pb-1.5">
                  <div className="text-base font-bold mb-1" style={{ color }}>
                    {label}
                  </div>
                  <DeltaBadge delta={delta} />
                </div>
              </div>

              {/* Score progress bar */}
              <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-4">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${(score / 10) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  style={{
                    background: `linear-gradient(90deg, ${color}, ${color}80)`,
                    boxShadow: `0 0 10px ${color}50`,
                  }}
                />
              </div>

              {/* Points accumulator toward next level */}
              {(() => {
                const pts = disciplinePoints;
                const isPositive = pts >= 0;
                const barColor = isPositive ? "#4ECDC4" : "#FF6B6B";
                const barPct = Math.min(Math.abs(pts) / 8 * 100, 100);
                const nextAction = isPositive ? "subir" : "descer";
                const ptsLeft = 8 - Math.abs(pts);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">Pontos acumulados</span>
                      <span className="text-[11px] font-bold" style={{ color: barColor }}>
                        {pts >= 0 ? "+" : ""}{pts} / 8
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${barPct}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        style={{ background: barColor, boxShadow: `0 0 6px ${barColor}60` }}
                      />
                    </div>
                    <p className="text-[10px] text-white/25 mt-1">
                      {Math.abs(pts) === 0
                        ? "Complete tarefas ou marque hábitos para acumular pontos"
                        : `Faltam ${ptsLeft} pt${ptsLeft !== 1 ? "s" : ""} para ${nextAction} de nível`}
                    </p>
                  </div>
                );
              })()}
            </div>

            {/* How points are earned/lost */}
            <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="text-[10px] text-white/30 font-medium uppercase tracking-wider mb-3">Como funciona</div>
              <div className="space-y-1.5">
                {[
                  { label: "Tarefa alta prioridade concluída", pts: "+6", color: "#4ECDC4" },
                  { label: "Tarefa média prioridade concluída", pts: "+4", color: "#4ECDC4" },
                  { label: "Tarefa baixa prioridade concluída", pts: "+3", color: "#4ECDC4" },
                  { label: "Hábito diário marcado como feito",  pts: "+2", color: "#4ECDC4" },
                  { label: "Tarefa em atraso detectada",        pts: "−4", color: "#FF6B6B" },
                ].map(({ label, pts, color: c }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-[11px] text-white/40">{label}</span>
                    <span className="text-[11px] font-bold tabular-nums shrink-0 ml-3" style={{ color: c }}>{pts} pts</span>
                  </div>
                ))}
                <div className="pt-1.5 mt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                  <span className="text-[10px] text-white/20">A cada 8 pts acumulados a disciplina sobe ou desce 1 nível</span>
                </div>
              </div>
            </div>

            {/* Current state — reasons from latest entry */}
            {currentReasons.length > 0 && (
              <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-3">
                  Estado atual
                </div>
                <div className="space-y-1.5">
                  {currentReasons.map((reason, i) => (
                    <div
                      key={i}
                      className="text-[12px] text-muted-foreground leading-snug flex items-start gap-2"
                    >
                      <span className="flex-shrink-0 opacity-50 mt-0.5">·</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* History list */}
            <div className="flex-1 overflow-y-auto">
              <div
                className="px-5 py-3 text-[10px] text-muted-foreground font-medium uppercase tracking-wider border-b"
                style={{ borderColor: "rgba(255,255,255,0.06)" }}
              >
                Histórico de alterações
              </div>

              {isLoading && (
                <div className="flex items-center justify-center h-24">
                  <div
                    className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: `${color} transparent transparent transparent` }}
                  />
                </div>
              )}

              {!isLoading && history.length === 0 && (
                <div className="px-5 py-10 text-center">
                  <div className="text-muted-foreground text-sm mb-1">Nenhum registro ainda.</div>
                  <div className="text-muted-foreground text-xs opacity-60">
                    O score é registrado automaticamente quando muda ou uma vez por dia.
                  </div>
                </div>
              )}

              {history.map((entry) => {
                const entryColor = scoreColor(entry.score);
                const parsedReasons: string[] = Array.isArray(entry.reasons) ? entry.reasons : [];
                return (
                  <div
                    key={entry.id}
                    className="px-5 py-4 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.04)" }}
                    data-testid={`discipline-entry-${entry.id}`}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0"
                          style={{
                            background: `${entryColor}15`,
                            border: `1px solid ${entryColor}28`,
                            color: entryColor,
                          }}
                        >
                          {entry.score}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground">{scoreLabel(entry.score)}</div>
                          <div className="text-[10px] text-muted-foreground">{formatDate(entry.createdAt)}</div>
                        </div>
                      </div>
                      <DeltaBadge delta={entry.delta} />
                    </div>

                    {parsedReasons.length > 0 && (
                      <div className="space-y-1 pl-0.5">
                        {parsedReasons.map((reason, j) => (
                          <div
                            key={j}
                            className="text-[11px] text-muted-foreground leading-snug flex items-start gap-1.5"
                          >
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
