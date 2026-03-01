import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import {
  sendBillDueSoonEmail,
  sendOfflineReminderEmail,
  sendOverdueTaskEmail,
  sendWeeklySummaryEmail,
  sendGoalDeadlineEmail,
  sendLowDisciplineEmail,
} from "./integrations/sendgrid";

async function getUserEmailAndName(userId: string): Promise<{ email: string; name: string } | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.email) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "usuário";
  return { email: user.email, name };
}

function getEmailAlertPrefs(profile: { emailAlerts?: string | null }): {
  billDueSoon: boolean;
  offlineReminder: boolean;
  overdueTask: boolean;
  weeklySummary: boolean;
  goalDeadline: boolean;
  lowDiscipline: boolean;
} {
  try {
    const p = JSON.parse(profile.emailAlerts || "{}");
    return {
      billDueSoon: p.billDueSoon !== false,
      offlineReminder: p.offlineReminder !== false,
      overdueTask: p.overdueTask !== false,
      weeklySummary: p.weeklySummary !== false,
      goalDeadline: p.goalDeadline !== false,
      lowDiscipline: p.lowDiscipline !== false,
    };
  } catch {
    return { billDueSoon: true, offlineReminder: true, overdueTask: true, weeklySummary: true, goalDeadline: true, lowDiscipline: true };
  }
}

export async function updateLastLogin(userId: string): Promise<void> {
  await storage.upsertUserProfile(userId, { lastLoginAt: new Date() });
}

export async function checkAndSendBillAlerts(userId: string): Promise<void> {
  const profile = await storage.getUserProfile(userId);
  if (!profile) return;

  const prefs = getEmailAlertPrefs(profile);
  if (!prefs.billDueSoon) return;

  const userInfo = await getUserEmailAndName(userId);
  if (!userInfo) return;

  const bills = await storage.getBills(userId);
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  for (const bill of bills) {
    if (!bill.active) continue;
    if (bill.type !== "expense") continue;
    const daysLeft = bill.dueDay - today;
    if (daysLeft < 0 || daysLeft > 3) continue;
    const paidMonths: string[] = (() => { try { return JSON.parse(bill.paidMonths || "[]"); } catch { return []; } })();
    if (paidMonths.includes(currentMonthKey)) continue;
    const since25DaysAgo = new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000);
    const recentAlerts = await storage.getRecentAlerts(userId, "bill_due_soon", bill.id, since25DaysAgo);
    if (recentAlerts.length > 0) continue;
    await sendBillDueSoonEmail(userInfo.email, userInfo.name, bill.title, bill.amount, daysLeft);
    await storage.createEmailAlertLog({ userId, alertType: "bill_due_soon", referenceId: bill.id });
    console.log(`[alerts] Bill alert sent to ${userInfo.email} for "${bill.title}" (${daysLeft}d left)`);
  }
}

export async function checkAndSendOverdueTaskAlerts(userId: string): Promise<void> {
  const profile = await storage.getUserProfile(userId);
  if (!profile) return;
  const prefs = getEmailAlertPrefs(profile);
  if (!prefs.overdueTask) return;

  const userInfo = await getUserEmailAndName(userId);
  if (!userInfo) return;

  const tasks = await storage.getPersonalTasks(userId);
  const now = new Date();
  const overdue = tasks.filter(t => t.status === "pending" && t.dueDate && new Date(t.dueDate) < now);
  if (overdue.length === 0) return;

  const todayKey = now.toISOString().split("T")[0];
  const since2DaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const recentAlerts = await storage.getRecentAlerts(userId, "overdue_tasks", todayKey, since2DaysAgo);
  if (recentAlerts.length > 0) return;

  const taskList = overdue
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .map(t => ({
      title: t.title,
      priority: t.priority,
      daysOverdue: Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / (1000 * 60 * 60 * 24)),
    }));

  await sendOverdueTaskEmail(userInfo.email, userInfo.name, taskList);
  await storage.createEmailAlertLog({ userId, alertType: "overdue_tasks", referenceId: todayKey });
  console.log(`[alerts] Overdue tasks alert sent to ${userInfo.email} (${overdue.length} tasks)`);
}

export async function checkAndSendGoalDeadlineAlerts(userId: string): Promise<void> {
  const profile = await storage.getUserProfile(userId);
  if (!profile) return;
  const prefs = getEmailAlertPrefs(profile);
  if (!prefs.goalDeadline) return;

  const userInfo = await getUserEmailAndName(userId);
  if (!userInfo) return;

  const goals = await storage.getFinancialGoals(userId);
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  for (const goal of goals) {
    if (!goal.deadline) continue;
    const deadline = new Date(goal.deadline);
    if (deadline < now || deadline > sevenDaysFromNow) continue;
    if (goal.currentAmount >= goal.targetAmount) continue;

    const since5DaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const recentAlerts = await storage.getRecentAlerts(userId, "goal_deadline", goal.id, since5DaysAgo);
    if (recentAlerts.length > 0) continue;

    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    await sendGoalDeadlineEmail(userInfo.email, userInfo.name, goal.title, goal.targetAmount, goal.currentAmount, daysLeft);
    await storage.createEmailAlertLog({ userId, alertType: "goal_deadline", referenceId: goal.id });
    console.log(`[alerts] Goal deadline alert sent to ${userInfo.email} for "${goal.title}" (${daysLeft}d left)`);
  }
}

export async function checkAndSendLowDisciplineAlert(userId: string): Promise<void> {
  const profile = await storage.getUserProfile(userId);
  if (!profile) return;
  const prefs = getEmailAlertPrefs(profile);
  if (!prefs.lowDiscipline) return;

  const score = profile.disciplineScore ?? 5;
  if (score > 3) return;

  const userInfo = await getUserEmailAndName(userId);
  if (!userInfo) return;

  const since3DaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const recentAlerts = await storage.getRecentAlerts(userId, "low_discipline", null, since3DaysAgo);
  if (recentAlerts.length > 0) return;

  await sendLowDisciplineEmail(userInfo.email, userInfo.name, score);
  await storage.createEmailAlertLog({ userId, alertType: "low_discipline", referenceId: null });
  console.log(`[alerts] Low discipline alert sent to ${userInfo.email} (score: ${score})`);
}

async function checkAndSendWeeklySummaryForUser(userId: string): Promise<void> {
  const profile = await storage.getUserProfile(userId);
  if (!profile) return;
  const prefs = getEmailAlertPrefs(profile);
  if (!prefs.weeklySummary) return;

  const userInfo = await getUserEmailAndName(userId);
  if (!userInfo) return;

  const since5DaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  const recentAlerts = await storage.getRecentAlerts(userId, "weekly_summary", null, since5DaysAgo);
  if (recentAlerts.length > 0) return;

  const now = new Date();
  const tasks = await storage.getPersonalTasks(userId);
  const pendingTasks = tasks.filter(t => t.status === "pending").length;

  const bills = await storage.getBills(userId);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;

  const upcomingBills = bills.filter(b => {
    if (!b.active || b.type !== "expense") return false;
    const dueDay = b.dueDay;
    const dueDate = new Date(currentYear, currentMonth, dueDay);
    if (dueDate < now || dueDate > sevenDaysFromNow) return false;
    const paidMonths: string[] = (() => { try { return JSON.parse(b.paidMonths || "[]"); } catch { return []; } })();
    return !paidMonths.includes(currentMonthKey);
  }).map(b => ({ title: b.title, amount: b.amount, dueDay: b.dueDay }));

  const habits = await storage.getHabits(userId);
  const habitsChecked = habits.filter(h => {
    if (!h.lastChecked) return false;
    const lastCheck = new Date(h.lastChecked);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return lastCheck >= weekAgo;
  }).length;

  const disciplineScore = profile.disciplineScore ?? 5;

  await sendWeeklySummaryEmail(userInfo.email, userInfo.name, {
    pendingTasks,
    upcomingBills,
    disciplineScore,
    habitsChecked,
    totalHabits: habits.length,
  });
  await storage.createEmailAlertLog({ userId, alertType: "weekly_summary", referenceId: null });
  console.log(`[alerts] Weekly summary sent to ${userInfo.email}`);
}

export async function runPeriodicAlertsForAll(): Promise<void> {
  const profiles = await storage.getAllProfiles();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const isMonday = now.getDay() === 1;

  for (const profile of profiles) {
    const prefs = getEmailAlertPrefs(profile);

    if (prefs.offlineReminder) {
      const lastLogin = profile.lastLoginAt ? new Date(profile.lastLoginAt) : null;
      const createdAt = profile.createdAt ? new Date(profile.createdAt) : null;
      const referenceDate = lastLogin || createdAt;
      if (referenceDate && referenceDate <= sevenDaysAgo) {
        const recentAlerts = await storage.getRecentAlerts(profile.userId, "offline_reminder", null, sevenDaysAgo);
        if (recentAlerts.length === 0) {
          const userInfo = await getUserEmailAndName(profile.userId);
          if (userInfo) {
            const daysOffline = Math.floor((now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24));
            await sendOfflineReminderEmail(userInfo.email, userInfo.name, daysOffline);
            await storage.createEmailAlertLog({ userId: profile.userId, alertType: "offline_reminder", referenceId: null });
            console.log(`[alerts] Offline reminder sent to ${userInfo.email} (${daysOffline}d offline)`);
          }
        }
      }
    }

    if (isMonday && prefs.weeklySummary) {
      await checkAndSendWeeklySummaryForUser(profile.userId).catch(() => {});
    }
  }
}

// Keep for backwards compatibility (called from index.ts)
export async function checkAndSendOfflineAlerts(): Promise<void> {
  return runPeriodicAlertsForAll();
}
