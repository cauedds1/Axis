import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckSquare, Plus, Trash2, Flame, Loader2, Check, X, Clock, AlertTriangle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [justifyTask, setJustifyTask] = useState<PersonalTask | null>(null);
  const [justifyText, setJustifyText] = useState("");
  const [justifyResult, setJustifyResult] = useState<{ verdict: string; feedback: string; score: number; creditPoints: number; netPenalty: number } | null>(null);
  const [detailTask, setDetailTask] = useState<PersonalTask | null>(null);
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

  const justifyMutation = useMutation({
    mutationFn: async ({ id, justification }: { id: string; justification: string }) => {
      const res = await apiRequest("POST", `/api/tasks/${id}/justify`, { justification });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao enviar justificativa");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setJustifyResult({ ...data.judgment, netPenalty: data.netPenalty });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao enviar justificativa", variant: "destructive" });
    },
  });

  const now = new Date();
  const needsJustification = tasks.filter(
    t => t.status === "pending" && t.dueDate && new Date(t.dueDate) < now && (t as any).justificationScore == null
  );
  const pending = tasks.filter(t => t.status === "pending" && !(t.dueDate && new Date(t.dueDate) < now && (t as any).justificationScore == null));
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

  function closeJustifyDialog() {
    setJustifyTask(null);
    setJustifyText("");
    setJustifyResult(null);
  }

  const scoreColors: Record<number, string> = { 1: "#FF1744", 2: "#FF5722", 3: "#FFA000", 4: "#8BC34A", 5: "#00E5C8" };

  return (
    <div className="px-6 py-6 space-y-6 pb-28">
      <title>AXIS - Tarefas e Compromissos</title>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-tasks-title">Tarefas e Compromissos</h1>
      </div>

      <div className="mb-4">
        <CaptureButton variant="inline" />
      </div>

      {needsJustification.length > 0 && (
        <div className="rounded-2xl p-4 space-y-3" style={{ background: "rgba(255,170,0,0.07)", border: "1px solid rgba(255,170,0,0.2)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: "#FFA000" }} />
            <p className="text-sm font-semibold" style={{ color: "#FFA000" }}>
              {needsJustification.length} tarefa{needsJustification.length > 1 ? "s" : ""} em atraso — justifique o atraso
            </p>
          </div>
          <p className="text-xs text-white/40">A IA vai avaliar sua justificativa e isso afetará sua disciplina.</p>
          <div className="space-y-2">
            {needsJustification.map(task => (
              <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,170,0,0.12)" }} data-testid={`row-justify-task-${task.id}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  {task.dueDate && (
                    <p className="text-[10px] text-white/30 mt-0.5 flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDueDate(task.dueDate)} — em atraso
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => { setJustifyTask(task); setJustifyText(""); setJustifyResult(null); }}
                  className="shrink-0 text-xs font-semibold gap-1"
                  style={{ background: "rgba(255,170,0,0.15)", color: "#FFA000", border: "1px solid rgba(255,170,0,0.3)" }}
                  data-testid={`button-justify-task-${task.id}`}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Justificar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                <div key={task.id} className="flex items-start gap-2 p-3 rounded-lg hover:bg-muted/50 group cursor-pointer" onClick={() => setDetailTask(task)} data-testid={`row-task-${task.id}`}>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTaskMutation.mutate({ id: task.id, status: "completed" }); }}
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={(e) => { e.stopPropagation(); deleteTaskMutation.mutate(task.id); }} data-testid={`button-delete-task-${task.id}`}>
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

      <Dialog open={!!detailTask} onOpenChange={v => { if (!v) setDetailTask(null); }}>
        <DialogContent className="max-w-md border-0 p-0" style={{ background: "#0d0d12", border: "1px solid rgba(255,255,255,0.09)" }}>
          {detailTask && (
            <>
              <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <DialogHeader>
                  <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" style={{ color: accent }} />
                    Detalhes da tarefa
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Título</p>
                  <p className="text-sm text-white leading-relaxed" data-testid="text-task-detail-title">{detailTask.title}</p>
                </div>

                {detailTask.description && (
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Descrição</p>
                    <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap" data-testid="text-task-detail-desc">{detailTask.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Prioridade</p>
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ background: priorityColor[detailTask.priority] }} />
                      <p className="text-sm font-medium text-white capitalize">{detailTask.priority === "high" ? "Alta" : detailTask.priority === "medium" ? "Média" : "Baixa"}</p>
                    </div>
                  </div>
                  <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Status</p>
                    <p className="text-sm font-medium text-white capitalize">{detailTask.status === "completed" ? "Concluída" : "Pendente"}</p>
                  </div>
                </div>

                {detailTask.category && (
                  <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Categoria</p>
                    <p className="text-sm font-medium text-white">{detailTask.category}</p>
                  </div>
                )}

                {detailTask.dueDate && (
                  <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mb-0.5">Prazo</p>
                    <p className="text-sm font-medium text-white flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-white/40" />
                      {formatDueDate(detailTask.dueDate)}
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {detailTask.status === "pending" && (
                    <button
                      onClick={() => { toggleTaskMutation.mutate({ id: detailTask.id, status: "completed" }); setDetailTask(null); }}
                      className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                      style={{ background: accent, color: "#060608" }}
                      data-testid="button-complete-task-detail"
                    >
                      <Check className="h-4 w-4" /> Concluir tarefa
                    </button>
                  )}
                  <button
                    onClick={() => { deleteTaskMutation.mutate(detailTask.id); setDetailTask(null); }}
                    className="py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
                    style={{ background: "rgba(255,23,68,0.1)", color: "#FF1744", border: "1px solid rgba(255,23,68,0.2)" }}
                    data-testid="button-delete-task-detail"
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!justifyTask} onOpenChange={v => { if (!v) closeJustifyDialog(); }}>
        <DialogContent className="max-w-md border-0 p-0" style={{ background: "#0d0d12", border: "1px solid rgba(255,255,255,0.09)" }}>
          <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" style={{ color: "#FFA000" }} />
                Justificativa de atraso
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5 space-y-4">
            {justifyTask && !justifyResult && (
              <>
                <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-xs text-white/40 mb-0.5">Tarefa em atraso</p>
                  <p className="text-sm font-medium text-white">{justifyTask.title}</p>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-2">Por que você não completou essa tarefa? A IA vai avaliar sua justificativa.</p>
                  <textarea
                    value={justifyText}
                    onChange={e => setJustifyText(e.target.value)}
                    placeholder="Explique o motivo do atraso com honestidade..."
                    rows={4}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 resize-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                    data-testid="textarea-justification"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="ghost"
                    className="flex-1 text-white/40"
                    onClick={closeJustifyDialog}
                    data-testid="button-cancel-justification"
                  >
                    Cancelar
                  </Button>
                  <button
                    onClick={() => justifyMutation.mutate({ id: justifyTask.id, justification: justifyText })}
                    disabled={justifyMutation.isPending || justifyText.trim().length < 5}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                    style={{ background: "#FFA000", color: "#060608" }}
                    data-testid="button-submit-justification"
                  >
                    {justifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar para a IA"}
                  </button>
                </div>
              </>
            )}

            {justifyResult && (
              <div className="space-y-4">
                <div className="text-center py-2">
                  <p className="text-4xl font-black" style={{ color: scoreColors[justifyResult.score] ?? "#FFA000" }}>
                    {justifyResult.score}/5
                  </p>
                  <p className="text-sm font-semibold mt-1 capitalize" style={{ color: scoreColors[justifyResult.score] ?? "#FFA000" }}>
                    Justificativa {justifyResult.verdict}
                  </p>
                </div>
                <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-sm text-white/80 italic">"{justifyResult.feedback}"</p>
                </div>
                <div className="rounded-xl px-4 py-3 text-center" style={{ background: `${justifyResult.netPenalty >= 0 ? "rgba(0,229,200,0.06)" : "rgba(255,23,68,0.06)"}`, border: `1px solid ${justifyResult.netPenalty >= 0 ? "rgba(0,229,200,0.15)" : "rgba(255,23,68,0.15)"}` }}>
                  <p className="text-xs text-white/40 mb-0.5">Impacto na disciplina</p>
                  <p className="text-sm font-bold" style={{ color: justifyResult.netPenalty >= 0 ? "#00E5C8" : "#FF1744" }}>
                    {justifyResult.creditPoints > 0 ? `${justifyResult.netPenalty} pts (${justifyResult.creditPoints} de crédito aplicado)` : `${justifyResult.netPenalty} pts`}
                  </p>
                </div>
                <button
                  onClick={closeJustifyDialog}
                  className="w-full py-2.5 rounded-xl font-semibold text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", color: "white" }}
                  data-testid="button-close-justification-result"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
