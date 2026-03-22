import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/hooks/use-currency";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Check, X, Loader2, ChevronLeft, ChevronRight, RefreshCw, TrendingDown, TrendingUp, CheckSquare, Clock, Ban, Stethoscope, PartyPopper, AlertCircle, Undo2, CalendarClock, Trash2, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CaptureButton } from "@/components/capture-button";
import { useTheme, getPrimaryHex, getModulePalette } from "@/components/theme-provider";
import { motion, AnimatePresence } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import type { ScheduleItem, Habit, Bill, ScheduleItemCancellation } from "@shared/schema";

function parseWeekdays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export default function Agenda() {
  const { t, i18n } = useTranslation();
  const { fmtMoney } = useCurrency();
  const lang = i18n.language === "pt-BR" ? "pt-BR" : "en-US";
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
  const [panelItemMenuId, setPanelItemMenuId] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; entityType: "schedule" | "habit"; entityId: string; entityTitle: string; date: string }>({ open: false, entityType: "schedule", entityId: "", entityTitle: "", date: "" });
  const [cancelType, setCancelType] = useState<"holiday" | "medical" | "other">("other");
  const [cancelReason, setCancelReason] = useState("");
  const [postponeDialog, setPostponeDialog] = useState<{ open: boolean; item: ScheduleItem | null }>({ open: false, item: null });
  const [postponeDate, setPostponeDate] = useState("");
  const [postponeTime, setPostponeTime] = useState("08:00");
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

  const { data: cancellations = [] } = useQuery<ScheduleItemCancellation[]>({
    queryKey: ["/api/schedule/cancellations", periodStart.toISOString().split("T")[0], periodEnd.toISOString().split("T")[0]],
    queryFn: async () => {
      const s = periodStart.toISOString().split("T")[0];
      const e = periodEnd.toISOString().split("T")[0];
      const res = await fetch(`/api/schedule/cancellations?startDate=${s}&endDate=${e}`, { credentials: "include" });
      return res.json();
    },
  });

  function getCancellation(itemId: string, dateStr: string): ScheduleItemCancellation | undefined {
    return cancellations.find(c => c.scheduleItemId === itemId && c.date === dateStr);
  }

  function getCancellationForHabit(habitId: string, dateStr: string): ScheduleItemCancellation | undefined {
    return cancellations.find(c => c.habitId === habitId && c.date === dateStr);
  }

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

  const cancelTodayMutation = useMutation({
    mutationFn: async ({ entityType, entityId, date, type, reason }: { entityType: "schedule" | "habit"; entityId: string; date: string; type: string; reason: string }) => {
      const route = entityType === "habit"
        ? `/api/habits/${entityId}/cancel-today`
        : `/api/schedule/${entityId}/cancel-today`;
      const res = await apiRequest("POST", route, { date, type, reason: reason || undefined });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/cancellations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/habits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setCancelDialog({ open: false, entityType: "schedule", entityId: "", entityTitle: "", date: "" });
      setCancelReason("");
      setCancelType("other");
      setPanelItemMenuId(null);
      toast({ title: t("axisAgenda.absenceRegistered"), description: data.disciplineMsg });
    },
    onError: () => toast({ title: t("axisAgenda.cancelError"), variant: "destructive" }),
  });

  const removeCancellationMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/schedule/cancellations/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule/cancellations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setPanelItemMenuId(null);
    },
    onError: () => toast({ title: t("axisAgenda.undoCancelError"), variant: "destructive" }),
  });

  const postponeMutation = useMutation({
    mutationFn: async ({ id, newDateTime }: { id: string; newDateTime: string }) => {
      const res = await apiRequest("POST", `/api/schedule/${id}/postpone`, { newDateTime });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setPostponeDialog({ open: false, item: null });
      setPostponeDate("");
      setPanelItemMenuId(null);
      toast({ title: t("axisAgenda.postponed") });
    },
    onError: () => toast({ title: t("axisAgenda.postponeError"), variant: "destructive" }),
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
      toast({ title: t("axisAgenda.taskCreated") });
    },
    onError: () => toast({ title: t("axisAgenda.taskError"), variant: "destructive" }),
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
      toast({ title: count === 1 ? t("axisAgenda.appointmentCreated") : t("axisAgenda.appointmentsCreated", { count }) });
    },
    onError: () => toast({ title: t("axisAgenda.appointmentError"), variant: "destructive" }),
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
      <title>{t("axisAgenda.pageTitle")}</title>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" data-testid="text-agenda-title">{t("axisAgenda.title")}</h1>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-schedule">
          <Plus className="h-4 w-4 mr-1" /> {t("axisAgenda.new")}
        </Button>
      </div>

      <div className="mb-4">
        <CaptureButton variant="inline" />
      </div>

      {pendingApprovals.length > 0 && (
        <Card className="border-primary/30" data-testid="card-pending-approvals">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary">{t("axisAgenda.aiSuggestions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingApprovals.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(item.startTime).toLocaleString(lang, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
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
          {periodStart.toLocaleDateString(lang, { month: "short", day: "numeric" })} — {periodEnd.toLocaleDateString(lang, { month: "short", day: "numeric" })}
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
                {day.toLocaleDateString(lang, { weekday: "short" }).replace(".", "")}
                <span className="ml-1">{day.getDate()}</span>
              </p>

              {dayItems.map((item) => {
                const cancelled = getCancellation(item.id, dayStr);
                return (
                  <div
                    key={item.id}
                    className={`text-[10px] p-1 rounded mb-1 truncate cursor-pointer transition-all ${
                      cancelled ? "line-through opacity-60" :
                      item.status === "done" ? "line-through opacity-50" :
                      item.suggestedByAi ? "opacity-90" : ""
                    }`}
                    style={{
                      background: cancelled ? "rgba(251,146,60,0.10)" :
                        item.status === "done" ? "rgba(78,205,196,0.08)" :
                        item.suggestedByAi ? `${accent}15` : "rgba(255,255,255,0.05)",
                      color: cancelled ? "#fb923c" :
                        item.status === "done" ? MP.positive :
                        item.suggestedByAi ? accent : "rgba(255,255,255,0.7)",
                    }}
                    onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: item.id, status: item.status === "done" ? "approved" : "done" }); }}
                    data-testid={`schedule-item-${item.id}`}
                    data-no-panel
                  >
                    {cancelled && <Ban className="inline h-2 w-2 mr-0.5 opacity-70" />}
                    {new Date(item.startTime).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })} {item.title}
                  </div>
                );
              })}

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
                    title={isToday ? (isDone ? t("axisAgenda.markNotDone") : t("axisAgenda.markDone")) : habit.name}
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
                    title={paid ? t("axisAgenda.markUnpaid") : (isExpense ? t("axisAgenda.markPaid") : t("axisAgenda.markReceived"))}
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
          const headerLabel = d.toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long" });
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
                    {isToday && <div className="text-[10px] mt-0.5" style={{ color: accent }}>{t("axisAgenda.today")}</div>}
                  </div>
                  <button onClick={() => setDayPanelDate(null)} className="p-1 rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-colors" data-testid="button-close-day-panel">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                  {/* Schedule items */}
                  {panelItems.length > 0 && (
                    <div>
                      <p className={SECTION}>{t("axisAgenda.sectionAgenda")}</p>
                      <div className="space-y-1.5">
                        {panelItems.map(item => {
                          const cancelled = getCancellation(item.id, dStr);
                          const menuOpen = panelItemMenuId === item.id;
                          const cancelIcon = cancelled?.type === "holiday" ? <PartyPopper className="h-2.5 w-2.5" /> : cancelled?.type === "medical" ? <Stethoscope className="h-2.5 w-2.5" /> : <Ban className="h-2.5 w-2.5" />;
                          return (
                            <div key={item.id} className="rounded-xl overflow-hidden"
                              style={{ border: cancelled ? "1px solid rgba(251,146,60,0.25)" : menuOpen ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.07)" }}
                              data-testid={`panel-schedule-${item.id}`}>
                              <div className="flex items-center gap-2 p-2 cursor-pointer"
                                style={{ background: cancelled ? "rgba(251,146,60,0.07)" : item.status === "done" ? "rgba(78,205,196,0.08)" : menuOpen ? `${accent}08` : "rgba(255,255,255,0.04)" }}
                                onClick={() => setPanelItemMenuId(menuOpen ? null : item.id)}>
                                <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                                  style={{ borderColor: cancelled ? "#fb923c" : item.status === "done" ? MP.positive : "rgba(255,255,255,0.2)", background: cancelled ? "rgba(251,146,60,0.2)" : item.status === "done" ? `${MP.positive}50` : "transparent" }}>
                                  {cancelled ? cancelIcon : item.status === "done" ? <Check className="h-2.5 w-2.5" style={{ color: MP.positive }} /> : null}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-xs ${cancelled ? "line-through text-white/30" : item.status === "done" ? "line-through text-white/30" : "text-white/80"}`}>{item.title}</div>
                                  <div className="text-[10px] flex items-center gap-1" style={{ color: cancelled ? "#fb923c80" : "rgba(255,255,255,0.3)" }}>
                                    <Clock className="h-2.5 w-2.5" />
                                    {new Date(item.startTime).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}
                                    {cancelled && <span className="ml-1 capitalize">· {cancelled.type === "holiday" ? t("axisAgenda.holiday") : cancelled.type === "medical" ? t("axisAgenda.medical") : t("axisAgenda.other")}</span>}
                                  </div>
                                </div>
                              </div>
                              {menuOpen && (
                                <div className="px-2 pb-2 pt-1 flex gap-1.5" style={{ background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                  {cancelled ? (
                                    <button
                                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
                                      onClick={() => removeCancellationMutation.mutate(cancelled.id)}
                                      data-testid={`button-undo-cancel-${item.id}`}>
                                      <Undo2 className="h-3 w-3" /> {t("axisAgenda.undoCancel")}
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                                        style={{ background: `${MP.positive}20`, color: MP.positive }}
                                        onClick={() => { updateStatusMutation.mutate({ id: item.id, status: item.status === "done" ? "approved" : "done" }); setPanelItemMenuId(null); }}
                                        data-testid={`button-done-${item.id}`}>
                                        <Check className="h-3 w-3" /> {item.status === "done" ? t("axisAgenda.undo") : t("axisAgenda.done")}
                                      </button>
                                      <button
                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                                        style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}
                                        onClick={() => { setCancelDialog({ open: true, entityType: "schedule", entityId: item.id, entityTitle: item.title, date: dStr }); setCancelType("other"); setCancelReason(""); }}
                                        data-testid={`button-cancel-today-${item.id}`}>
                                        <Ban className="h-3 w-3" /> {t("axisAgenda.cancelToday")}
                                      </button>
                                      <button
                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                                        style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}
                                        onClick={() => { const _st = new Date(item.startTime); const _hh = String(_st.getHours()).padStart(2, "0"); const _mm = String(_st.getMinutes()).padStart(2, "0"); setPostponeDialog({ open: true, item }); setPostponeDate(dStr); setPostponeTime(`${_hh}:${_mm}`); setPanelItemMenuId(null); }}
                                        data-testid={`button-postpone-${item.id}`}>
                                        <CalendarClock className="h-3 w-3" /> {t("axisAgenda.postpone")}
                                      </button>
                                      <button
                                        className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                                        style={{ background: "rgba(239,68,68,0.12)", color: "#f87171" }}
                                        onClick={() => { deleteMutation.mutate(item.id); setPanelItemMenuId(null); }}
                                        data-testid={`button-delete-${item.id}`}>
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Habits */}
                  {panelHabits.length > 0 && (
                    <div>
                      <p className={SECTION}>{t("axisAgenda.sectionHabits")}</p>
                      <div className="space-y-1.5">
                        {panelHabits.map(habit => {
                          const isDone = (habit as any).lastChecked === dStr;
                          const habitCancelled = getCancellationForHabit(habit.id, dStr);
                          const menuOpen = panelItemMenuId === `h-${habit.id}`;
                          const cancelIcon = habitCancelled?.type === "holiday" ? <PartyPopper className="h-3 w-3" /> : habitCancelled?.type === "medical" ? <Stethoscope className="h-3 w-3" /> : <Ban className="h-3 w-3" />;
                          return (
                            <div key={habit.id} className="rounded-xl overflow-hidden"
                              style={{ border: habitCancelled ? "1px solid rgba(251,146,60,0.25)" : menuOpen ? `1px solid ${accent}40` : "1px solid rgba(255,255,255,0.07)" }}
                              data-testid={`panel-habit-${habit.id}`}>
                              <div className="flex items-center gap-2 p-2 cursor-pointer"
                                style={{ background: habitCancelled ? "rgba(251,146,60,0.07)" : isDone ? "rgba(78,205,196,0.08)" : menuOpen ? `${accent}08` : "rgba(255,255,255,0.04)" }}
                                onClick={() => setPanelItemMenuId(menuOpen ? null : `h-${habit.id}`)}>
                                <span className="text-base">{(habit as any).emoji || "⚡"}</span>
                                <div className="flex-1 min-w-0">
                                  <div className={`text-xs ${habitCancelled ? "line-through text-white/30" : isDone ? "line-through text-white/30" : "text-white/80"}`}>{habit.name}</div>
                                  <div className="text-[10px] flex items-center gap-1" style={{ color: habitCancelled ? "#fb923c80" : "rgba(255,255,255,0.3)" }}>
                                    {(habit as any).targetTime && <><Clock className="h-2.5 w-2.5" />{(habit as any).targetTime}</>}
                                    {habitCancelled && <span className="ml-1">· {habitCancelled.type === "holiday" ? `🏖️ ${t("axisAgenda.holiday")}` : habitCancelled.type === "medical" ? `🏥 ${t("axisAgenda.medical")}` : `❌ ${t("axisAgenda.cancelled")}`}</span>}
                                  </div>
                                </div>
                                {!habitCancelled && isDone && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: MP.positive }} />}
                                {habitCancelled && cancelIcon}
                              </div>
                              {menuOpen && (
                                <div className="px-2 pb-2 pt-1 flex gap-1.5" style={{ background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                  {habitCancelled ? (
                                    <button
                                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}
                                      onClick={() => removeCancellationMutation.mutate(habitCancelled.id)}
                                      data-testid={`button-undo-cancel-habit-${habit.id}`}>
                                      <Undo2 className="h-3 w-3" /> {t("axisAgenda.undoCancel")}
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                                        style={{ background: `${MP.positive}20`, color: MP.positive, opacity: isDone ? 0.5 : 1 }}
                                        onClick={() => { if (isToday && !isDone) { checkHabitMutation.mutate(habit.id); setPanelItemMenuId(null); } }}
                                        data-testid={`button-done-habit-${habit.id}`}>
                                        <Check className="h-3 w-3" /> {isDone ? `${t("axisAgenda.done")} ✓` : t("axisAgenda.done")}
                                      </button>
                                      <button
                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                                        style={{ background: "rgba(251,146,60,0.15)", color: "#fb923c" }}
                                        onClick={() => { setCancelDialog({ open: true, entityType: "habit", entityId: habit.id, entityTitle: habit.name, date: dStr }); setCancelType("other"); setCancelReason(""); setPanelItemMenuId(null); }}
                                        data-testid={`button-cancel-today-habit-${habit.id}`}>
                                        <Ban className="h-3 w-3" /> {t("axisAgenda.cancelToday")}
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bills */}
                  {panelBills.length > 0 && (
                    <div>
                      <p className={SECTION}>{t("axisAgenda.sectionBills")}</p>
                      <div className="space-y-1.5">
                        {panelBills.map(bill => {
                          const paid = isBillPaid(bill);
                          const isExpense = bill.type === "expense";
                          const billColor = isExpense ? MP.negative : MP.positive;
                          const menuOpen = panelItemMenuId === `b-${bill.id}`;
                          return (
                            <div key={bill.id} className="rounded-xl overflow-hidden"
                              style={{ border: `1px solid ${menuOpen ? `${billColor}40` : paid ? `${billColor}15` : `${billColor}25`}` }}
                              data-testid={`panel-bill-${bill.id}`}>
                              <div className="flex items-center gap-2 p-2 cursor-pointer"
                                style={{ background: paid ? `${billColor}08` : menuOpen ? `${billColor}10` : `${billColor}10` }}
                                onClick={() => setPanelItemMenuId(menuOpen ? null : `b-${bill.id}`)}>
                                {isExpense ? <TrendingDown className="h-4 w-4 shrink-0" style={{ color: billColor }} /> : <TrendingUp className="h-4 w-4 shrink-0" style={{ color: billColor }} />}
                                <div className="flex-1 min-w-0">
                                  <div className={`text-xs ${paid ? "line-through text-white/30" : "text-white/80"}`}>{bill.title}</div>
                                  <div className="text-[10px]" style={{ color: `${billColor}80` }}>
                                    {fmtMoney(bill.amount)} · {t("axisAgenda.dueDay", { day: bill.dueDay })}
                                  </div>
                                </div>
                                {paid && <Check className="h-3.5 w-3.5 shrink-0" style={{ color: billColor }} />}
                              </div>
                              {menuOpen && (
                                <div className="px-2 pb-2 pt-1 flex gap-1.5" style={{ background: "rgba(0,0,0,0.2)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                                  <button
                                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
                                    style={{ background: `${billColor}20`, color: billColor }}
                                    onClick={() => { toggleBillPaidMutation.mutate(bill); setPanelItemMenuId(null); }}
                                    data-testid={`button-pay-bill-${bill.id}`}>
                                    <DollarSign className="h-3 w-3" /> {paid ? t("axisAgenda.unmarkPayment") : isExpense ? t("axisAgenda.markPaid") : t("axisAgenda.markReceived")}
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {panelItems.length === 0 && panelHabits.length === 0 && panelBills.length === 0 && (
                    <div className="py-6 text-center text-white/25 text-sm">{t("axisAgenda.noItems")}</div>
                  )}
                </div>

                {/* Add form */}
                <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                  {/* Type toggle: Tarefa / Compromisso */}
                  <div className="flex gap-2">
                    {(["task","schedule"] as const).map(mode => {
                      const label = mode === "task" ? t("axisAgenda.typeTask") : t("axisAgenda.typeAppointment");
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
                        const label = p === "high" ? t("axisAgenda.priorityHigh") : p === "medium" ? t("axisAgenda.priorityMedium") : t("axisAgenda.priorityLow");
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
                          const label = rec ? t("axisAgenda.recurring") : t("axisAgenda.onlyThisDay");
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
                                { key: "this_month", label: t("axisAgenda.recThisMonth"), sub: t("axisAgenda.recThisMonthSub") },
                                { key: "three_months", label: t("axisAgenda.recThreeMonths"), sub: t("axisAgenda.recThreeMonthsSub") },
                                { key: "permanent", label: t("axisAgenda.recOneYear"), sub: t("axisAgenda.recOneYearSub") },
                                { key: "custom", label: t("axisAgenda.recCustom"), sub: t("axisAgenda.recCustomSub") },
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
                      placeholder={addMode === "task" ? t("axisAgenda.placeholderTask") : t("axisAgenda.placeholderAppointment")}
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

      {/* Cancel today dialog */}
      <Dialog open={cancelDialog.open} onOpenChange={(o) => { if (!o) { setCancelDialog({ open: false, entityType: "schedule", entityId: "", entityTitle: "", date: "" }); setCancelReason(""); } }}>
        <DialogContent style={{ background: "#0d0d12", border: "1px solid rgba(255,255,255,0.08)" }} data-testid="dialog-cancel-today">
          <DialogHeader>
            <DialogTitle className="text-white text-base">{t("axisAgenda.cancelDialogTitle")}</DialogTitle>
            {cancelDialog.entityTitle && (
              <p className="text-[12px] text-white/40 mt-0.5">{cancelDialog.entityTitle} · {cancelDialog.date}</p>
            )}
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-2">{t("axisAgenda.cancelReason")}</p>
              <div className="flex gap-2">
                {([
                  { key: "holiday", label: t("axisAgenda.holiday"), icon: PartyPopper, color: "#34d399" },
                  { key: "medical", label: t("axisAgenda.medical"), icon: Stethoscope, color: "#60a5fa" },
                  { key: "other",   label: t("axisAgenda.other"),   icon: AlertCircle, color: "#fb923c" },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all text-[11px] font-medium"
                    style={{
                      background: cancelType === opt.key ? `${opt.color}20` : "rgba(255,255,255,0.04)",
                      border: `1px solid ${cancelType === opt.key ? opt.color + "60" : "rgba(255,255,255,0.07)"}`,
                      color: cancelType === opt.key ? opt.color : "rgba(255,255,255,0.45)",
                    }}
                    onClick={() => setCancelType(opt.key)}
                    data-testid={`cancel-type-${opt.key}`}>
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[10px] text-white/30 px-1">
                {cancelType === "holiday" && t("axisAgenda.cancelHolidayDesc")}
                {cancelType === "medical" && t("axisAgenda.cancelMedicalDesc")}
                {cancelType === "other" && t("axisAgenda.cancelOtherDesc")}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">{t("axisAgenda.cancelNote")}</p>
              <Textarea
                placeholder={t("axisAgenda.cancelNotePlaceholder")}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="resize-none text-xs"
                rows={2}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
                data-testid="input-cancel-reason"
              />
            </div>
            <button
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#fb923c", color: "#fff" }}
              disabled={cancelTodayMutation.isPending}
              onClick={() => {
                if (!cancelDialog.entityId) return;
                cancelTodayMutation.mutate({ entityType: cancelDialog.entityType, entityId: cancelDialog.entityId, date: cancelDialog.date, type: cancelType, reason: cancelReason });
              }}
              data-testid="button-confirm-cancel-today">
              {cancelTodayMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : <Ban className="h-4 w-4 inline mr-1" />}
              {t("axisAgenda.cancelDialogTitle")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Postpone dialog */}
      <Dialog open={postponeDialog.open} onOpenChange={(o) => { if (!o) setPostponeDialog({ open: false, item: null }); }}>
        <DialogContent style={{ background: "#0d0d12", border: "1px solid rgba(255,255,255,0.08)" }} data-testid="dialog-postpone">
          <DialogHeader>
            <DialogTitle className="text-white text-base">{t("axisAgenda.postponeTitle")}</DialogTitle>
            {postponeDialog.item && <p className="text-[12px] text-white/40 mt-0.5">{postponeDialog.item.title}</p>}
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div>
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">{t("axisAgenda.postponeNewDate")}</p>
              <Input type="date" value={postponeDate} onChange={e => setPostponeDate(e.target.value)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
                data-testid="input-postpone-date" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">{t("axisAgenda.postponeTime")}</p>
              <Input type="time" value={postponeTime} onChange={e => setPostponeTime(e.target.value)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
                data-testid="input-postpone-time" />
            </div>
            <button
              className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: "#60a5fa", color: "#fff" }}
              disabled={postponeMutation.isPending || !postponeDate}
              onClick={() => {
                if (!postponeDialog.item || !postponeDate) return;
                const newDateTime = new Date(`${postponeDate}T${postponeTime}:00`).toISOString();
                postponeMutation.mutate({ id: postponeDialog.item.id, newDateTime });
              }}
              data-testid="button-confirm-postpone">
              {postponeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : <CalendarClock className="h-4 w-4 inline mr-1" />}
              {t("axisAgenda.postponeConfirm")}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("axisAgenda.newAppointmentTitle")}</DialogTitle></DialogHeader>
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
            <Input placeholder={t("axisAgenda.appointmentTitlePlaceholder")} value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} required data-testid="input-schedule-title" />
            <Input placeholder={t("axisAgenda.appointmentDescPlaceholder")} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} data-testid="input-schedule-description" />
            <Input type="datetime-local" value={form.startTime} onChange={(e) => setForm(p => ({ ...p, startTime: e.target.value }))} required data-testid="input-schedule-start" />
            <Input type="datetime-local" value={form.endTime} onChange={(e) => setForm(p => ({ ...p, endTime: e.target.value }))} data-testid="input-schedule-end" />
            <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-schedule">
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} {t("axisAgenda.create")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
