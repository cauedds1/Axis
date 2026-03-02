import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Check, X, Loader2, ChevronLeft, ChevronRight, RefreshCw, TrendingDown, TrendingUp, CheckSquare, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CaptureButton } from "@/components/capture-button";
import { useTheme, getPrimaryHex, getModulePalette } from "@/components/theme-provider";
import { motion, AnimatePresence } from "framer-motion";
import type { ScheduleItem, Habit, Bill } from "@shared/schema";

function parseWeekdays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export default function Agenda() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", startTime: "", endTime: "" });
  const [dayPanelDate, setDayPanelDate] = useState<Date | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskPriority, setTaskPriority] = useState<"high" | "medium" | "low">("medium");
  const [addMode, setAddMode] = useState<"task" | "schedule">("task");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<"this_month" | "three_months" | "permanent" | "custom">("this_month");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("08:00");
  const { toast } = useToast();
  const { theme } = useTheme();
  const accent = getPrimaryHex(theme);
  const MP = getModulePalette(theme as any);

  const periodStart = new Date(selectedDate);
  const dayOfMonth = periodStart.getDate();
  const isFirstHalf = dayOfMonth <= 15;
  periodStart.setDate(isFirstHalf ? 1 : 16);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(periodStart);
  if (isFirstHalf) {
    periodEnd.setDate(15);
  } else {
    const lastDay = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0).getDate();
    periodEnd.setDate(lastDay);
  }
  periodEnd.setHours(23, 59, 59, 999);

  const { data: items = [], isLoading } = useQuery<ScheduleItem[]>({
    queryKey: ["/api/schedule", periodStart.toISOString(), periodEnd.toISOString()],
    queryFn: async () => {
      const res = await fetch(`/api/schedule?startDate=${periodStart.toISOString()}&endDate=${periodEnd.toISOString()}`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: habits = [] } = useQuery<Habit[]>({ queryKey: ["/api/habits"] });
  const { data: bills = [] } = useQuery<Bill[]>({ queryKey: ["/api/bills"] });

  const currentMonthKey = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  })();

  function isBillActiveThisMonth(bill: Bill): boolean {
    if (!bill.active) return false;
    const now = new Date();
    const y = now.getFullYear(); const m = now.getMonth();
    const created = new Date(bill.createdAt!);
    const cy = created.getFullYear(); const cm = created.getMonth();
    if (y < cy || (y === cy && m < cm)) return false;
    if (bill.recurrenceType === "permanent") return true;
    if (bill.recurrenceType === "this_month") return y === cy && m === cm;
    if (bill.recurrenceType === "three_months") return new Date(y, m, 1) <= new Date(cy, cm + 3, 1);
    if (bill.recurrenceType === "custom" && bill.recurrenceEndDate) return new Date(y, m, 1) <= new Date(bill.recurrenceEndDate);
    return false;
  }

  function isBillPaid(bill: Bill): boolean {
    try { return JSON.parse(bill.paidMonths || "[]").includes(currentMonthKey); } catch { return false; }
  }

  function billsForDay(day: Date): Bill[] {
    const d = day.getDate();
    const m = day.getMonth();
    const y = day.getFullYear();
    const now = new Date();
    if (y !== now.getFullYear() || m !== now.getMonth()) return [];
    return bills.filter(b => isBillActiveThisMonth(b) && b.dueDay === d);
  }

  const toggleBillPaidMutation = useMutation({
    mutationFn: async (bill: Bill) => {
      const paid: string[] = (() => { try { return JSON.parse(bill.paidMonths || "[]"); } catch { return []; } })();
      const newPaid = paid.includes(currentMonthKey)
        ? paid.filter(m => m !== currentMonthKey)
        : [...paid, currentMonthKey];
      await apiRequest("PATCH", `/api/bills/${bill.id}`, { paidMonths: JSON.stringify(newPaid) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bills"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/schedule", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      setShowAdd(false);
      setForm({ title: "", description: "", startTime: "", endTime: "" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/schedule/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
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

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/schedule/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async ({ title, priority, dueDate }: { title: string; priority: string; dueDate: Date }) => {
      await apiRequest("POST", "/api/tasks", { title, priority, dueDate: dueDate.toISOString() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setTaskTitle("");
      setTaskPriority("medium");
      toast({ title: "Tarefa criada" });
    },
    onError: () => toast({ title: "Erro ao criar tarefa", variant: "destructive" }),
  });

  const createScheduleFromPanelMutation = useMutation({
    mutationFn: async ({ title, baseDate, time, recurring, recType, recEndDate }: {
      title: string; baseDate: Date; time: string; recurring: boolean;
      recType: "this_month" | "three_months" | "permanent" | "custom"; recEndDate: string;
    }) => {
      const [h, m] = time.split(":").map(Number);
      const getEndDate = () => {
        const now = new Date();
        if (recType === "this_month") return new Date(now.getFullYear(), now.getMonth() + 1, 0);
        if (recType === "three_months") { const d = new Date(now); d.setMonth(d.getMonth() + 3); return d; }
        if (recType === "permanent") { const d = new Date(now); d.setFullYear(d.getFullYear() + 1); return d; }
        if (recType === "custom" && recEndDate) return new Date(recEndDate);
        return new Date(now.getFullYear(), now.getMonth() + 1, 0);
      };
      const dates: Date[] = [];
      if (!recurring) {
        const dt = new Date(baseDate);
        dt.setHours(h, m, 0, 0);
        dates.push(dt);
      } else {
        const dow = baseDate.getDay();
        const end = getEndDate();
        const cur = new Date(baseDate);
        cur.setHours(h, m, 0, 0);
        while (cur <= end && dates.length < 52) {
          dates.push(new Date(cur));
          cur.setDate(cur.getDate() + 7);
        }
      }
      for (const dt of dates) {
        const end = new Date(dt.getTime() + 60 * 60 * 1000);
        await apiRequest("POST", "/api/schedule", { title, startTime: dt.toISOString(), endTime: end.toISOString() });
      }
      return dates.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setTaskTitle("");
      setIsRecurring(false);
      setRecurrenceType("this_month");
      setRecurrenceEndDate("");
      toast({ title: count === 1 ? "Compromisso criado" : `${count} compromissos criados` });
    },
    onError: () => toast({ title: "Erro ao criar compromisso", variant: "destructive" }),
  });

  const daysInPeriod = periodEnd.getDate() - periodStart.getDate() + 1;
  const periodDays = Array.from({ length: daysInPeriod }, (_, i) => {
    const d = new Date(periodStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const prev15 = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 15);
    setSelectedDate(d);
  };

  const next15 = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 15);
    setSelectedDate(d);
  };

  function habitsForDay(day: Date): Habit[] {
    const dayOfWeek = day.getDay();
    return habits.filter(h => {
      if (h.frequency === "daily") return true;
      if (h.frequency === "weekly") {
        const wd = parseWeekdays((h as any).weekdays);
        return wd.length > 0 && wd.includes(dayOfWeek);
      }
      return false;
    });
  }

  const pendingApprovals = items.filter(i => i.suggestedByAi && i.status === "pending");
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="px-6 py-6 space-y-6 pb-28">
      <title>AXIS - Agenda</title>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-agenda-title">Agenda</h1>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-schedule">
          <Plus className="h-4 w-4 mr-1" /> Novo
        </Button>
      </div>

      <div className="mb-4">
        <CaptureButton variant="inline" />
      </div>

      {pendingApprovals.length > 0 && (
        <Card className="border-primary/30" data-testid="card-pending-approvals">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary">Sugestões da IA pendentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.startTime).toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateStatusMutation.mutate({ id: item.id, status: "approved" })} data-testid={`button-approve-${item.id}`}>
                    <Check className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(item.id)} data-testid={`button-reject-${item.id}`}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={prev15} data-testid="button-prev-period">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {periodStart.toLocaleDateString("pt-BR", { month: "short", day: "numeric" })} — {periodEnd.toLocaleDateString("pt-BR", { month: "short", day: "numeric" })}
        </span>
        <Button variant="ghost" size="icon" onClick={next15} data-testid="button-next-period">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
        {periodDays.map((day) => {
          const isToday = day.toDateString() === new Date().toDateString();
          const dayStr = day.toISOString().split("T")[0];
          const dayItems = items.filter(i => new Date(i.startTime).toDateString() === day.toDateString());
          const dayHabits = habitsForDay(day);
          const dayBills = billsForDay(day);

          return (
            <div
              key={day.toISOString()}
              className={`p-2 rounded-lg min-h-[120px] cursor-pointer transition-all hover:bg-white/5 ${isToday ? "bg-primary/5 border border-primary/20" : "bg-card border border-border"}`}
              onClick={(e) => { if ((e.target as HTMLElement).closest("[data-no-panel]")) return; setDayPanelDate(day); }}
              data-testid={`day-cell-${dayStr}`}
            >
              <p className={`text-xs mb-2 ${isToday ? "font-bold" : "text-muted-foreground"}`} style={isToday ? { color: accent } : undefined}>
                {day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                <span className="ml-1">{day.getDate()}</span>
              </p>

              {dayItems.map((item) => (
                <div
                  key={item.id}
                  className={`text-[10px] p-1 rounded mb-1 truncate cursor-pointer transition-all ${
                    item.status === "done" ? "line-through opacity-50" :
                    item.suggestedByAi ? "opacity-90" : ""
                  }`}
                  style={{
                    background: item.status === "done" ? "rgba(78,205,196,0.08)" :
                      item.suggestedByAi ? `${accent}15` : "rgba(255,255,255,0.05)",
                    color: item.status === "done" ? MP.positive :
                      item.suggestedByAi ? accent : "rgba(255,255,255,0.7)",
                  }}
                  onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: item.id, status: item.status === "done" ? "approved" : "done" }); }}
                  data-testid={`schedule-item-${item.id}`}
                  data-no-panel
                >
                  {new Date(item.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} {item.title}
                </div>
              ))}

              {dayHabits.map((habit) => {
                const isDone = (habit as any).lastChecked === dayStr;
                const emoji = (habit as any).emoji || "⚡";
                const time = (habit as any).targetTime;
                return (
                  <div
                    key={`habit-${habit.id}`}
                    className="text-[10px] p-1 rounded mb-1 truncate cursor-pointer transition-all flex items-center gap-1"
                    style={{
                      background: isDone ? "rgba(78,205,196,0.08)" : "rgba(255,255,255,0.03)",
                      color: isDone ? MP.positive : "rgba(255,255,255,0.45)",
                      border: `1px solid ${isDone ? "rgba(78,205,196,0.2)" : "rgba(255,255,255,0.06)"}`,
                      textDecoration: isDone ? "line-through" : "none",
                    }}
                    onClick={(e) => { e.stopPropagation(); isToday && checkHabitMutation.mutate(habit.id); }}
                    title={isToday ? (isDone ? "Marcar como não feito" : "Marcar como feito") : habit.name}
                    data-testid={`habit-agenda-${habit.id}-${dayStr}`}
                    data-no-panel
                  >
                    <RefreshCw className="h-2 w-2 shrink-0 opacity-50" />
                    <span className="truncate">{emoji} {time ? `${time} ` : ""}{habit.name}</span>
                  </div>
                );
              })}

              {dayBills.map((bill) => {
                const paid = isBillPaid(bill);
                const isExpense = bill.type === "expense";
                const billColor = isExpense ? MP.negative : MP.positive;
                return (
                  <div
                    key={`bill-${bill.id}`}
                    className="text-[10px] p-1 rounded mb-1 cursor-pointer transition-all flex items-center gap-1"
                    style={{
                      background: paid ? `${billColor}08` : `${billColor}12`,
                      color: paid ? `${billColor}60` : billColor,
                      border: `1px solid ${paid ? `${billColor}15` : `${billColor}30`}`,
                      textDecoration: paid ? "line-through" : "none",
                      opacity: paid ? 0.6 : 1,
                    }}
                    onClick={(e) => { e.stopPropagation(); toggleBillPaidMutation.mutate(bill); }}
                    title={paid ? "Marcar como não pago" : (isExpense ? "Marcar como pago" : "Marcar como recebido")}
                    data-testid={`bill-agenda-${bill.id}`}
                    data-no-panel
                  >
                    {isExpense
                      ? <TrendingDown className="h-2 w-2 shrink-0" />
                      : <TrendingUp className="h-2 w-2 shrink-0" />
                    }
                    <span className="truncate">{bill.title}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── DAY DETAIL PANEL ── */}
      <AnimatePresence>
        {dayPanelDate && (() => {
          const d = dayPanelDate;
          const dStr = d.toISOString().split("T")[0];
          const isToday = d.toDateString() === new Date().toDateString();
          const panelItems  = items.filter(i => new Date(i.startTime).toDateString() === d.toDateString());
          const panelHabits = habitsForDay(d);
          const panelBills  = billsForDay(d);
          const headerLabel = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
          const SECTION = "text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2";

          return (
            <>
              <motion.div
                className="fixed inset-0 z-40"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setDayPanelDate(null)}
              />
              <motion.div
                className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-80 flex flex-col overflow-hidden"
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 40, opacity: 0 }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                style={{ background: "#0d0d12", borderLeft: "1px solid rgba(255,255,255,0.07)", boxShadow: "-8px 0 40px rgba(0,0,0,0.7)" }}
                data-testid="panel-day-detail"
              >
                {/* Header */}
                <div className="px-5 pt-5 pb-4 border-b flex items-start justify-between" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  <div>
                    <div className="text-base font-bold text-white capitalize">{headerLabel}</div>
                    {isToday && <div className="text-[10px] mt-0.5" style={{ color: accent }}>Hoje</div>}
                  </div>
                  <button onClick={() => setDayPanelDate(null)} className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors" data-testid="button-close-day-panel">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                  {/* Schedule items */}
                  {panelItems.length > 0 && (
                    <div>
                      <p className={SECTION}>Agenda</p>
                      <div className="space-y-1.5">
                        {panelItems.map(item => (
                          <div key={item.id} className="flex items-center gap-2 p-2 rounded-xl cursor-pointer"
                            style={{ background: item.status === "done" ? "rgba(78,205,196,0.08)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                            onClick={() => updateStatusMutation.mutate({ id: item.id, status: item.status === "done" ? "approved" : "done" })}
                            data-testid={`panel-schedule-${item.id}`}>
                            <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                              style={{ borderColor: item.status === "done" ? MP.positive : "rgba(255,255,255,0.2)", background: item.status === "done" ? `${MP.positive}50` : "transparent" }}>
                              {item.status === "done" && <Check className="h-2.5 w-2.5" style={{ color: MP.positive }} />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs ${item.status === "done" ? "line-through text-white/30" : "text-white/80"}`}>{item.title}</div>
                              <div className="text-[10px] text-white/30 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {new Date(item.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Habits */}
                  {panelHabits.length > 0 && (
                    <div>
                      <p className={SECTION}>Compromissos</p>
                      <div className="space-y-1.5">
                        {panelHabits.map(habit => {
                          const isDone = (habit as any).lastChecked === dStr;
                          return (
                            <div key={habit.id} className="flex items-center gap-2 p-2 rounded-xl cursor-pointer"
                              style={{ background: isDone ? "rgba(78,205,196,0.08)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                              onClick={() => isToday && checkHabitMutation.mutate(habit.id)}
                              data-testid={`panel-habit-${habit.id}`}>
                              <span className="text-base">{(habit as any).emoji || "⚡"}</span>
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs ${isDone ? "line-through text-white/30" : "text-white/80"}`}>{habit.name}</div>
                                {(habit as any).targetTime && <div className="text-[10px] text-white/30">{(habit as any).targetTime}</div>}
                              </div>
                              {isDone && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: MP.positive }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bills */}
                  {panelBills.length > 0 && (
                    <div>
                      <p className={SECTION}>Contas</p>
                      <div className="space-y-1.5">
                        {panelBills.map(bill => {
                          const paid = isBillPaid(bill);
                          const isExpense = bill.type === "expense";
                          const billColor = isExpense ? MP.negative : MP.positive;
                          return (
                            <div key={bill.id} className="flex items-center gap-2 p-2 rounded-xl cursor-pointer"
                              style={{ background: paid ? `${billColor}08` : `${billColor}10`, border: `1px solid ${paid ? `${billColor}15` : `${billColor}25`}` }}
                              onClick={() => toggleBillPaidMutation.mutate(bill)}
                              data-testid={`panel-bill-${bill.id}`}>
                              {isExpense ? <TrendingDown className="h-4 w-4 shrink-0" style={{ color: billColor }} /> : <TrendingUp className="h-4 w-4 shrink-0" style={{ color: billColor }} />}
                              <div className="flex-1 min-w-0">
                                <div className={`text-xs ${paid ? "line-through text-white/30" : "text-white/80"}`}>{bill.title}</div>
                                <div className="text-[10px]" style={{ color: `${billColor}80` }}>R${bill.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                              </div>
                              {paid && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: billColor }} />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {panelItems.length === 0 && panelHabits.length === 0 && panelBills.length === 0 && (
                    <div className="py-6 text-center text-white/25 text-sm">Nenhum item para este dia</div>
                  )}
                </div>

                {/* Add form */}
                <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  {/* Type toggle: Tarefa / Compromisso */}
                  <div className="flex gap-2">
                    {(["task","schedule"] as const).map(mode => {
                      const label = mode === "task" ? "Tarefa" : "Compromisso";
                      const icon = mode === "task" ? <CheckSquare className="h-3 w-3" /> : <Clock className="h-3 w-3" />;
                      const active = addMode === mode;
                      return (
                        <button key={mode} onClick={() => { setAddMode(mode); setIsRecurring(false); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all"
                          style={{
                            background: active ? `${accent}18` : "rgba(255,255,255,0.04)",
                            border: `1px solid ${active ? `${accent}40` : "rgba(255,255,255,0.08)"}`,
                            color: active ? accent : "rgba(255,255,255,0.35)",
                          }}
                          data-testid={`tab-add-${mode}`}>
                          {icon}{label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Task-specific: priority pills */}
                  {addMode === "task" && (
                    <div className="flex gap-1.5">
                      {(["high","medium","low"] as const).map(p => {
                        const label = p === "high" ? "Alta" : p === "medium" ? "Média" : "Baixa";
                        const col = p === "high" ? MP.negative : p === "medium" ? MP.agenda : MP.tasks;
                        return (
                          <button key={p} onClick={() => setTaskPriority(p)}
                            className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                            style={{
                              background: taskPriority === p ? `${col}20` : "rgba(255,255,255,0.04)",
                              border: `1px solid ${taskPriority === p ? `${col}40` : "rgba(255,255,255,0.07)"}`,
                              color: taskPriority === p ? col : "rgba(255,255,255,0.35)",
                            }}
                            data-testid={`priority-${p}`}>
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Schedule-specific: time + recurrence */}
                  {addMode === "schedule" && (
                    <div className="space-y-2">
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        className="w-full bg-transparent border rounded-xl px-3 py-2 text-sm text-white outline-none"
                        style={{ borderColor: "rgba(255,255,255,0.1)", colorScheme: "dark" }}
                        data-testid="input-schedule-time"
                      />
                      {/* Recurrence toggle */}
                      <div className="flex gap-1.5">
                        {([false, true] as const).map(rec => {
                          const label = rec ? "Recorrente" : "Somente esse dia";
                          const active = isRecurring === rec;
                          return (
                            <button key={String(rec)} onClick={() => setIsRecurring(rec)}
                              className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                              style={{
                                background: active ? `${accent}18` : "rgba(255,255,255,0.04)",
                                border: `1px solid ${active ? `${accent}40` : "rgba(255,255,255,0.07)"}`,
                                color: active ? accent : "rgba(255,255,255,0.35)",
                              }}
                              data-testid={`recurrence-toggle-${rec}`}>
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Duration cards when recurring */}
                      <AnimatePresence>
                        {isRecurring && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                          >
                            <div className="grid grid-cols-2 gap-1.5 pt-1">
                              {([
                                { key: "this_month", label: "Este mês", sub: "Até fim do mês" },
                                { key: "three_months", label: "3 meses", sub: "Próximos 3 meses" },
                                { key: "permanent", label: "1 ano", sub: "Próximos 12 meses" },
                                { key: "custom", label: "Personalizado", sub: "Escolher data" },
                              ] as const).map(opt => {
                                const active = recurrenceType === opt.key;
                                return (
                                  <button key={opt.key} onClick={() => setRecurrenceType(opt.key)}
                                    className="flex flex-col items-start px-2.5 py-2 rounded-xl text-left transition-all"
                                    style={{
                                      background: active ? `${accent}10` : "rgba(255,255,255,0.03)",
                                      border: `1px solid ${active ? `${accent}30` : "rgba(255,255,255,0.07)"}`,
                                    }}
                                    data-testid={`recurrence-type-${opt.key}`}>
                                    <span className="text-[11px] font-semibold" style={{ color: active ? "white" : "rgba(255,255,255,0.45)" }}>{opt.label}</span>
                                    <span className="text-[9px]" style={{ color: active ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.2)" }}>{opt.sub}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {recurrenceType === "custom" && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden mt-1.5"
                              >
                                <input
                                  type="date"
                                  value={recurrenceEndDate}
                                  min={new Date().toISOString().split("T")[0]}
                                  onChange={e => setRecurrenceEndDate(e.target.value)}
                                  className="w-full bg-transparent border rounded-xl px-3 py-2 text-sm text-white outline-none"
                                  style={{ borderColor: "rgba(255,255,255,0.1)", colorScheme: "dark" }}
                                  data-testid="input-recurrence-end-date"
                                />
                              </motion.div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Title input + submit */}
                  <div className="flex gap-2">
                    <input
                      value={taskTitle}
                      onChange={e => setTaskTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key !== "Enter" || !taskTitle.trim()) return;
                        if (addMode === "task") createTaskMutation.mutate({ title: taskTitle.trim(), priority: taskPriority, dueDate: d });
                        else createScheduleFromPanelMutation.mutate({ title: taskTitle.trim(), baseDate: d, time: scheduleTime, recurring: isRecurring, recType: recurrenceType, recEndDate: recurrenceEndDate });
                      }}
                      placeholder={addMode === "task" ? "O que precisa fazer?" : "Título do compromisso..."}
                      className="flex-1 bg-transparent border rounded-xl px-3 py-2 text-sm text-white outline-none placeholder:text-white/20"
                      style={{ borderColor: "rgba(255,255,255,0.1)" }}
                      data-testid="input-day-item-title"
                    />
                    <button
                      onClick={() => {
                        if (!taskTitle.trim()) return;
                        if (addMode === "task") createTaskMutation.mutate({ title: taskTitle.trim(), priority: taskPriority, dueDate: d });
                        else createScheduleFromPanelMutation.mutate({ title: taskTitle.trim(), baseDate: d, time: scheduleTime, recurring: isRecurring, recType: recurrenceType, recEndDate: recurrenceEndDate });
                      }}
                      disabled={!taskTitle.trim() || createTaskMutation.isPending || createScheduleFromPanelMutation.isPending}
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity hover:opacity-80 disabled:opacity-30"
                      style={{ background: `${accent}20`, border: `1px solid ${accent}40` }}
                      data-testid="button-create-day-item">
                      {(createTaskMutation.isPending || createScheduleFromPanelMutation.isPending)
                        ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: accent }} />
                        : <Plus className="h-4 w-4" style={{ color: accent }} />}
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo compromisso</DialogTitle></DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate({
                title: form.title,
                description: form.description || null,
                startTime: new Date(form.startTime).toISOString(),
                endTime: form.endTime ? new Date(form.endTime).toISOString() : null,
              });
            }}
            className="space-y-4"
            data-testid="form-add-schedule"
          >
            <Input placeholder="Título" value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} required data-testid="input-schedule-title" />
            <Input placeholder="Descrição (opcional)" value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} data-testid="input-schedule-description" />
            <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm(p => ({ ...p, startTime: e.target.value }))} required data-testid="input-schedule-start" />
            <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm(p => ({ ...p, endTime: e.target.value }))} data-testid="input-schedule-end" />
            <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-schedule">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Criar
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
