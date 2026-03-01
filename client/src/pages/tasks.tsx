import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckSquare, Plus, Trash2, Flame, Loader2, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { AnimatePresence, motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import { CaptureButton } from "@/components/capture-button";
import type { PersonalTask, Habit } from "@shared/schema";

const HIGH_PRIMARY = "#00E6FF";
const SLIM_PRIMARY = "#7A9E8A";

const PRIORITY_OPTIONS = [
  { value: "high", label: "Alta", color: "#FF1744" },
  { value: "medium", label: "Média", color: "#FFA000" },
  { value: "low", label: "Baixa", color: "#00E5C8" },
] as const;

const HABIT_EMOJIS = ["⚡", "🏋️", "📚", "💧", "🧘", "🍎", "😴", "💊", "🚶", "✍️"];
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{children}</p>
  );
}

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", ...props.style }}
    />
  );
}

function StyledTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 resize-none"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
    />
  );
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
      <h2 className="text-base font-bold text-white">{title}</h2>
      <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white/70">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function TaskSheet({ open, onClose, accent }: { open: boolean; onClose: () => void; accent: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: "",
    priority: "medium" as "high" | "medium" | "low",
    category: "",
    description: "",
    dueDate: "",
    dueTime: "",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title.trim(),
        priority: form.priority,
        category: form.category.trim() || null,
        description: form.description.trim() || null,
      };
      if (form.dueDate) {
        const timeStr = form.dueTime || "23:59";
        payload.dueDate = new Date(`${form.dueDate}T${timeStr}:00`).toISOString();
      }
      const res = await apiRequest("POST", "/api/tasks", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setForm({ title: "", priority: "medium", category: "", description: "", dueDate: "", dueTime: "" });
      onClose();
      toast({ title: "Tarefa criada" });
    },
    onError: () => toast({ title: "Erro ao criar tarefa", variant: "destructive" }),
  });

  const canSave = form.title.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[460px] p-0 flex flex-col border-0"
        style={{ background: "#0d0d12", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        <SheetHeader title="Nova tarefa" onClose={onClose} />

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <FieldLabel>O que precisa fazer?</FieldLabel>
            <StyledInput
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Ligar para o cliente, Estudar inglês..."
              autoFocus
              data-testid="input-task-title"
            />
          </div>

          <div>
            <FieldLabel>Prioridade</FieldLabel>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, priority: opt.value }))}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                  style={{
                    background: form.priority === opt.value ? `${opt.color}15` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${form.priority === opt.value ? `${opt.color}40` : "rgba(255,255,255,0.07)"}`,
                    color: form.priority === opt.value ? opt.color : "rgba(255,255,255,0.35)",
                  }}
                  data-testid={`pill-priority-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Descrição <span className="normal-case font-normal text-white/25">(opcional)</span></FieldLabel>
            <StyledTextarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Notas, links, contexto..."
              rows={3}
              data-testid="textarea-task-description"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Data de vencimento</FieldLabel>
              <StyledInput
                type="date"
                value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                style={{ colorScheme: "dark" }}
                data-testid="input-task-due-date"
              />
            </div>
            <div>
              <FieldLabel>Horário</FieldLabel>
              <StyledInput
                type="time"
                value={form.dueTime}
                onChange={e => setForm(f => ({ ...f, dueTime: e.target.value }))}
                disabled={!form.dueDate}
                style={{ colorScheme: "dark", opacity: form.dueDate ? 1 : 0.4 }}
                data-testid="input-task-due-time"
              />
            </div>
          </div>

          <div>
            <FieldLabel>Categoria <span className="normal-case font-normal text-white/25">(opcional)</span></FieldLabel>
            <StyledInput
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              placeholder="Ex: Trabalho, Pessoal, Estudos..."
              data-testid="input-task-category"
            />
          </div>
        </div>

        <div className="px-6 py-4 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSave}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ background: accent, color: "#060608" }}
            data-testid="button-submit-task"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {mutation.isPending ? "Criando..." : "Criar tarefa"}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HabitSheet({ open, onClose, accent }: { open: boolean; onClose: () => void; accent: string }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "",
    frequency: "daily" as "daily" | "weekly",
    emoji: "⚡",
    targetTime: "",
    description: "",
    weekdays: [] as number[],
  });

  const toggleWeekday = (d: number) => {
    setForm(f => ({
      ...f,
      weekdays: f.weekdays.includes(d) ? f.weekdays.filter(x => x !== d) : [...f.weekdays, d],
    }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/habits", {
        name: form.name.trim(),
        frequency: form.frequency,
        emoji: form.emoji,
        targetTime: form.targetTime || null,
        description: form.description.trim() || null,
        weekdays: form.weekdays.length > 0 ? form.weekdays : undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setForm({ name: "", frequency: "daily", emoji: "⚡", targetTime: "", description: "", weekdays: [] });
      onClose();
      toast({ title: "Compromisso criado" });
    },
    onError: () => toast({ title: "Erro ao criar compromisso", variant: "destructive" }),
  });

  const canSave = form.name.trim().length > 0;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[460px] p-0 flex flex-col border-0"
        style={{ background: "#0d0d12", borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        <SheetHeader title="Novo compromisso" onClose={onClose} />

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <FieldLabel>Ícone</FieldLabel>
            <div className="grid grid-cols-5 gap-2">
              {HABIT_EMOJIS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, emoji: e }))}
                  className="py-2.5 rounded-xl text-xl flex items-center justify-center transition-all duration-150"
                  style={{
                    background: form.emoji === e ? `${accent}15` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${form.emoji === e ? `${accent}40` : "rgba(255,255,255,0.07)"}`,
                  }}
                  data-testid={`pill-emoji-${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Nome do compromisso</FieldLabel>
            <StyledInput
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Exercitar, Meditar, Ler..."
              autoFocus
              data-testid="input-habit-name"
            />
          </div>

          <div>
            <FieldLabel>Frequência</FieldLabel>
            <div className="flex gap-2">
              {([["daily", "Diário"], ["weekly", "Semanal"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, frequency: val, weekdays: [] }))}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150"
                  style={{
                    background: form.frequency === val ? `${accent}15` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${form.frequency === val ? `${accent}40` : "rgba(255,255,255,0.07)"}`,
                    color: form.frequency === val ? accent : "rgba(255,255,255,0.35)",
                  }}
                  data-testid={`pill-frequency-${val}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {form.frequency === "weekly" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
              >
                <FieldLabel>Dias da semana</FieldLabel>
                <div className="flex gap-1.5">
                  {DAYS.map((d, i) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleWeekday(i)}
                      className="flex-1 py-2 rounded-lg text-[10px] font-semibold transition-all duration-150"
                      style={{
                        background: form.weekdays.includes(i) ? `${accent}15` : "rgba(255,255,255,0.03)",
                        border: `1px solid ${form.weekdays.includes(i) ? `${accent}40` : "rgba(255,255,255,0.07)"}`,
                        color: form.weekdays.includes(i) ? accent : "rgba(255,255,255,0.25)",
                      }}
                      data-testid={`pill-weekday-${i}`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <FieldLabel>Horário alvo <span className="normal-case font-normal text-white/25">(opcional)</span></FieldLabel>
            <StyledInput
              type="time"
              value={form.targetTime}
              onChange={e => setForm(f => ({ ...f, targetTime: e.target.value }))}
              style={{ colorScheme: "dark" }}
              data-testid="input-habit-target-time"
            />
          </div>

          <div>
            <FieldLabel>Motivação / Observações <span className="normal-case font-normal text-white/25">(opcional)</span></FieldLabel>
            <StyledTextarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Por que esse compromisso é importante para você?"
              rows={3}
              data-testid="textarea-habit-description"
            />
          </div>
        </div>

        <div className="px-6 py-4 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !canSave}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{ background: accent, color: "#060608" }}
            data-testid="button-submit-habit"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
            {mutation.isPending ? "Criando..." : "Criar compromisso"}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-white/30 hover:text-white/50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Tasks() {
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);
  const { toast } = useToast();
  const { theme } = useTheme();
  const accent = theme === "high" ? HIGH_PRIMARY : SLIM_PRIMARY;

  const { data: tasks = [] } = useQuery<PersonalTask[]>({ queryKey: ["/api/tasks"] });
  const { data: habits = [] } = useQuery<Habit[]>({ queryKey: ["/api/habits"] });

  const toggleTaskMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/tasks/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const checkHabitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/habits/${id}/check`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const deleteHabitMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/habits/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const pending = tasks.filter(t => t.status === "pending");
  const completed = tasks.filter(t => t.status === "completed");

  const priorityColor: Record<string, string> = {
    high: "#FF1744",
    medium: "#FFA000",
    low: "#00E5C8",
  };

  function formatDueDate(dueDate: Date | string | null | undefined): string | null {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isToday = d.toDateString() === today.toDateString();
    const isTomorrow = d.toDateString() === tomorrow.toDateString();
    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const hasTime = timeStr !== "23:59";
    if (isToday) return `Hoje${hasTime ? ` · ${timeStr}` : ""}`;
    if (isTomorrow) return `Amanhã${hasTime ? ` · ${timeStr}` : ""}`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + (hasTime ? ` · ${timeStr}` : "");
  }

  return (
    <div className="px-6 py-6 space-y-6 pb-28">
      <title>AXIS - Tarefas e Compromissos</title>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-tasks-title">Tarefas e Compromissos</h1>
      </div>

      <div className="mb-4">
        <CaptureButton variant="inline" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Tasks column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4" /> Tarefas ({pending.length} pendentes)
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowAddTask(true)} data-testid="button-add-task">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-1">
            {pending.map((task) => {
              const due = formatDueDate(task.dueDate);
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
              return (
                <div key={task.id} className="flex items-start gap-2 p-3 rounded-lg hover:bg-muted/50 group" data-testid={`row-task-${task.id}`}>
                  <button
                    onClick={() => toggleTaskMutation.mutate({ id: task.id, status: "completed" })}
                    className="h-5 w-5 mt-0.5 rounded border border-border flex items-center justify-center shrink-0 hover:border-primary transition-colors"
                    data-testid={`button-complete-task-${task.id}`}
                  >
                    {toggleTaskMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{task.title}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      {task.category && <span className="text-[10px] text-muted-foreground">{task.category}</span>}
                      {due && (
                        <span className="text-[10px] flex items-center gap-0.5" style={{ color: isOverdue ? "#FF1744" : "rgba(255,255,255,0.3)" }}>
                          <Clock className="h-2.5 w-2.5" />{due}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                    <div className="h-2 w-2 rounded-full" style={{ background: priorityColor[task.priority] }} />
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteTaskMutation.mutate(task.id)} data-testid={`button-delete-task-${task.id}`}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {pending.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhuma tarefa pendente</p>}
          </div>

          {completed.length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-muted-foreground cursor-pointer mb-2">Concluídas ({completed.length})</summary>
              <div className="space-y-1">
                {completed.map((task) => (
                  <div key={task.id} className="flex items-center gap-2 p-2 rounded-lg opacity-50">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <p className="text-sm line-through truncate">{task.title}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Habits column */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Flame className="h-4 w-4" /> Compromissos
            </h2>
            <Button size="sm" variant="outline" onClick={() => setShowAddHabit(true)} data-testid="button-add-habit">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {habits.map((habit) => {
              const today = new Date().toISOString().split("T")[0];
              const checkedToday = habit.lastChecked === today;
              const habitEmoji = (habit as any).emoji || "⚡";
              const habitTime = (habit as any).targetTime as string | null;
              return (
                <div
                  key={habit.id}
                  className="rounded-2xl p-4 flex items-center justify-between"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid ${checkedToday ? "rgba(78,205,196,0.25)" : "rgba(255,255,255,0.07)"}`,
                  }}
                  data-testid={`card-habit-${habit.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{habitEmoji}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{habit.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Flame className="h-3 w-3" /> {habit.streak} dias
                        </span>
                        <span className="text-[10px] text-muted-foreground">{habit.frequency === "daily" ? "Diário" : "Semanal"}</span>
                        {habitTime && (
                          <span className="text-[10px] text-white/30 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />{habitTime}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={checkedToday ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => checkHabitMutation.mutate(habit.id)}
                      data-testid={`button-check-habit-${habit.id}`}
                    >
                      <Check className={`h-4 w-4 ${checkedToday ? "text-green-500" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteHabitMutation.mutate(habit.id)} data-testid={`button-delete-habit-${habit.id}`}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {habits.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum compromisso ainda</p>}
          </div>
        </div>
      </div>

      <TaskSheet open={showAddTask} onClose={() => setShowAddTask(false)} accent={accent} />
      <HabitSheet open={showAddHabit} onClose={() => setShowAddHabit(false)} accent={accent} />
    </div>
  );
}
