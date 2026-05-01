import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { organizations } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  sendBillDueSoonEmail,
  sendOfflineReminderEmail,
  sendOverdueTaskEmail,
  sendWeeklySummaryEmail,
  sendGoalDeadlineEmail,
  sendLowDisciplineEmail,
} from "./integrations/sendgrid";
import { sendPersonalMonthlyReport, sendBusinessMonthlyReport } from "./monthly-reports";

type Lang = "en" | "pt";

async function getUserEmailAndName(userId: string): Promise<{ email: string; name: string } | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.email) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "user";
  return { email: user.email, name };
}

function getLang(profile: { language?: string | null }): Lang {
  return (profile.language === "en" ? "en" : "pt") as Lang;
}

function getEmailAlertPrefs(profile: { emailAlerts?: string | null }): {
  billDueSoon: boolean;
  offlineReminder: boolean;
  overdueTask: boolean;
  weeklySummary: boolean;
  goalDeadline: boolean;
  lowDiscipline: boolean;
  monthlyPersonal: boolean;
  monthlyBusiness: boolean;
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
      monthlyPersonal: p.monthlyPersonal !== false,
      monthlyBusiness: p.monthlyBusiness !== false,
    };
  } catch {
    return { billDueSoon: true, offlineReminder: true, overdueTask: true, weeklySummary: true, goalDeadline: true, lowDiscipline: true, monthlyPersonal: true, monthlyBusiness: true };
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

  const lang = getLang(profile);
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
    let billStatus = "sent";
    try {
      await sendBillDueSoonEmail(userInfo.email, userInfo.name, bill.title, bill.amount, daysLeft, lang);
    } catch (err: any) {
      billStatus = "failed";
      console.error(`[alerts] Bill alert failed for ${userInfo.email}: ${err?.message}`);
    }
    await storage.createEmailAlertLog({ userId, alertType: "bill_due_soon", referenceId: bill.id, recipient: userInfo.email, status: billStatus });
    if (billStatus === "sent") console.log(`[alerts] Bill alert sent to ${userInfo.email} for "${bill.title}" (${daysLeft}d left)`);
  }
}

export async function checkAndSendOverdueTaskAlerts(userId: string): Promise<void> {
  const profile = await storage.getUserProfile(userId);
  if (!profile) return;
  const prefs = getEmailAlertPrefs(profile);
  if (!prefs.overdueTask) return;

  const userInfo = await getUserEmailAndName(userId);
  if (!userInfo) return;

  const lang = getLang(profile);
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

  let overdueStatus = "sent";
  try {
    await sendOverdueTaskEmail(userInfo.email, userInfo.name, taskList, lang);
  } catch (err: any) {
    overdueStatus = "failed";
    console.error(`[alerts] Overdue tasks alert failed for ${userInfo.email}: ${err?.message}`);
  }
  await storage.createEmailAlertLog({ userId, alertType: "overdue_tasks", referenceId: todayKey, recipient: userInfo.email, status: overdueStatus });
  if (overdueStatus === "sent") console.log(`[alerts] Overdue tasks alert sent to ${userInfo.email} (${overdue.length} tasks)`);
}

export async function checkAndSendGoalDeadlineAlerts(userId: string): Promise<void> {
  const profile = await storage.getUserProfile(userId);
  if (!profile) return;
  const prefs = getEmailAlertPrefs(profile);
  if (!prefs.goalDeadline) return;

  const userInfo = await getUserEmailAndName(userId);
  if (!userInfo) return;

  const lang = getLang(profile);
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
    let goalStatus = "sent";
    try {
      await sendGoalDeadlineEmail(userInfo.email, userInfo.name, goal.title, goal.targetAmount, goal.currentAmount, daysLeft, lang);
    } catch (err: any) {
      goalStatus = "failed";
      console.error(`[alerts] Goal deadline alert failed for ${userInfo.email}: ${err?.message}`);
    }
    await storage.createEmailAlertLog({ userId, alertType: "goal_deadline", referenceId: goal.id, recipient: userInfo.email, status: goalStatus });
    if (goalStatus === "sent") console.log(`[alerts] Goal deadline alert sent to ${userInfo.email} for "${goal.title}" (${daysLeft}d left)`);
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

  const lang = getLang(profile);
  const since3DaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const recentAlerts = await storage.getRecentAlerts(userId, "low_discipline", null, since3DaysAgo);
  if (recentAlerts.length > 0) return;

  let disciplineStatus = "sent";
  try {
    await sendLowDisciplineEmail(userInfo.email, userInfo.name, score, lang);
  } catch (err: any) {
    disciplineStatus = "failed";
    console.error(`[alerts] Low discipline alert failed for ${userInfo.email}: ${err?.message}`);
  }
  await storage.createEmailAlertLog({ userId, alertType: "low_discipline", referenceId: null, recipient: userInfo.email, status: disciplineStatus });
  if (disciplineStatus === "sent") console.log(`[alerts] Low discipline alert sent to ${userInfo.email} (score: ${score})`);
}

async function checkAndSendWeeklySummaryForUser(userId: string): Promise<void> {
  const profile = await storage.getUserProfile(userId);
  if (!profile) return;
  const prefs = getEmailAlertPrefs(profile);
  if (!prefs.weeklySummary) return;

  const userInfo = await getUserEmailAndName(userId);
  if (!userInfo) return;

  const lang = getLang(profile);
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

  let weeklyStatus = "sent";
  try {
    await sendWeeklySummaryEmail(userInfo.email, userInfo.name, {
      pendingTasks,
      upcomingBills,
      disciplineScore,
      habitsChecked,
      totalHabits: habits.length,
    }, lang);
  } catch (err: any) {
    weeklyStatus = "failed";
    console.error(`[alerts] Weekly summary failed for ${userInfo.email}: ${err?.message}`);
  }
  await storage.createEmailAlertLog({ userId, alertType: "weekly_summary", referenceId: null, recipient: userInfo.email, status: weeklyStatus });
  if (weeklyStatus === "sent") console.log(`[alerts] Weekly summary sent to ${userInfo.email}`);
}

export async function runPeriodicAlertsForAll(): Promise<void> {
  const profiles = await storage.getAllProfiles();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const isMonday = now.getDay() === 1;
  const isFirstOfMonth = now.getDate() === 1;

  // For monthly reports, report on the previous month
  const reportMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const since20DaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);

  for (const profile of profiles) {
    const prefs = getEmailAlertPrefs(profile);
    const lang = getLang(profile);

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
            let offlineStatus = "sent";
            try {
              await sendOfflineReminderEmail(userInfo.email, userInfo.name, daysOffline, lang);
            } catch (err: any) {
              offlineStatus = "failed";
              console.error(`[alerts] Offline reminder failed for ${userInfo.email}: ${err?.message}`);
            }
            await storage.createEmailAlertLog({ userId: profile.userId, alertType: "offline_reminder", referenceId: null, recipient: userInfo.email, status: offlineStatus });
            if (offlineStatus === "sent") console.log(`[alerts] Offline reminder sent to ${userInfo.email} (${daysOffline}d offline)`);
          }
        }
      }
    }

    if (isMonday && prefs.weeklySummary) {
      await checkAndSendWeeklySummaryForUser(profile.userId).catch(() => {});
    }

    if (isFirstOfMonth && prefs.monthlyPersonal) {
      const recentPersonal = await storage.getRecentAlerts(profile.userId, "monthly_personal", null, since20DaysAgo);
      if (recentPersonal.length === 0) {
        const result = await sendPersonalMonthlyReport(profile.userId, reportMonth, reportYear).catch(() => "failed" as const);
        if (result !== "skipped") {
          const userInfo = await getUserEmailAndName(profile.userId);
          await storage.createEmailAlertLog({
            userId: profile.userId,
            alertType: "monthly_personal",
            referenceId: null,
            recipient: userInfo?.email || "",
            status: result,
          });
          if (result === "sent") console.log(`[alerts] Personal monthly report sent to ${userInfo?.email}`);
        }
      }
    }
  }

  if (isFirstOfMonth) {
    const allOrgs = await db.select().from(organizations);
    for (const org of allOrgs) {
      if (!org.adminUserId) continue;
      const adminProfile = await storage.getUserProfile(org.adminUserId);
      if (!adminProfile) continue;
      const prefs = getEmailAlertPrefs(adminProfile);
      if (!prefs.monthlyBusiness) continue;

      const recentBusiness = await storage.getRecentAlerts(org.adminUserId, "monthly_business", org.id, since20DaysAgo);
      if (recentBusiness.length > 0) continue;

      const result = await sendBusinessMonthlyReport(org.id, org.adminUserId, reportMonth, reportYear).catch(() => "failed" as const);
      if (result !== "skipped") {
        const userInfo = await getUserEmailAndName(org.adminUserId);
        await storage.createEmailAlertLog({
          userId: org.adminUserId,
          alertType: "monthly_business",
          referenceId: org.id,
          recipient: userInfo?.email || "",
          status: result,
        });
        if (result === "sent") console.log(`[alerts] Business monthly report sent for org ${org.name} to ${userInfo?.email}`);
      }
    }
  }
}

// Keep for backwards compatibility (called from index.ts)
export async function checkAndSendOfflineAlerts(): Promise<void> {
  return runPeriodicAlertsForAll();
}
