import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { log } from "./log";
import { z } from "zod";
import bcrypt from "bcryptjs";
import multer from "multer";
import { transcribeAudio, detectIntentAndProcess, processReceiptPhoto, processMultipleReceipts, processPDFExtract, chatWithContext, generateOnboardingDiagnosis, deepAnalyzeOnboarding, parseFixedExpenses, parseRoutineToSchedule, saveEventToMemory, extractMemoryFromChat, analyzeSpendingDiscipline, judgeJustification, matchBillIdentity, saveUserIdentityEntity, getUserIdentityEntities } from "./ai";
import { updateLastLogin, checkAndSendBillAlerts, checkAndSendOverdueTaskAlerts, checkAndSendGoalDeadlineAlerts, checkAndSendLowDisciplineAlert } from "./alerts";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { whatsappManager } from "./whatsapp";
import { generateExpenseExcel } from "./business-reports";
import { uploadBase64Image, isStorageConfigured } from "./lib/file-storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const pendingChatBills = new Map<string, { extracted: any; expiresAt: number }>();

function getUserId(req: any): string {
  return req.session?.userId;
}

async function isAdminUser(req: any): Promise<boolean> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) { log("isAdminUser: ADMIN_EMAIL not set", "express"); return false; }
    const userId = getUserId(req);
    if (!userId) return false;
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const result = user?.email === adminEmail;
    return result;
  } catch (err: any) {
    log(`isAdminUser error: ${err?.message}`, "express");
    return false;
  }
}

function paramId(req: any): string {
  return req.params.id as string;
}

function getISOWeekLabel(d: Date): string {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ── DISCIPLINE POINT VALUES ────────────────────────────────────────────
// Positive actions
const DISCIPLINE_POINTS = {
  TASK_HIGH:           6,   // tarefa alta prioridade concluída
  TASK_MEDIUM:         4,   // tarefa média prioridade concluída
  TASK_LOW:            3,   // tarefa baixa prioridade concluída
  HABIT_CHECK:         2,   // hábito diário marcado como feito
  HABIT_MISSED:       -3,   // hábito não feito no dia programado
  TASK_OVERDUE:       -4,   // tarefa em atraso detectada
  SPENDING_OTIMO:     +4,   // finanças excelentes: gastos supérfluos < 5% da renda
  SPENDING_BOM:       +2,   // finanças boas: gastos supérfluos 5-10% da renda
  SPENDING_LEVE:      -2,   // gastos com besteiras leves (15-25% da renda)
  SPENDING_MODERADO:  -4,   // gastos com besteiras moderados (25-35% da renda)
  SPENDING_GRAVE:     -6,   // gastos com besteiras graves (>35% da renda)
  BILL_PAID_LATE:     -2,   // conta paga com atraso — quebra a sequência
} as const;
const DISCIPLINE_THRESHOLD = 8; // pontos para subir/descer 1 nível

async function adjustDisciplinePoints(userId: string, delta: number, reason: string): Promise<void> {
  try {
    const profile = await storage.getUserProfile(userId);
    const prevScore  = profile?.disciplineScore  ?? 5;
    const prevPoints = profile?.disciplinePoints ?? 0;

    let newPoints = prevPoints + delta;
    let newScore  = prevScore;

    while (newPoints >= DISCIPLINE_THRESHOLD) {
      newScore = Math.min(10, newScore + 1);
      newPoints -= DISCIPLINE_THRESHOLD;
    }
    while (newPoints <= -DISCIPLINE_THRESHOLD) {
      newScore = Math.max(1, newScore - 1);
      newPoints += DISCIPLINE_THRESHOLD;
    }

    await storage.upsertUserProfile(userId, { disciplineScore: newScore, disciplinePoints: newPoints });

    if (newScore !== prevScore) {
      await storage.createDisciplineHistory({
        userId,
        score: newScore,
        previousScore: prevScore,
        delta: newScore - prevScore,
        reasons: JSON.stringify([
          reason,
          `Disciplina ${prevScore} → ${newScore} (${delta > 0 ? "+" : ""}${delta} pts acumulados)`,
        ]),
      });
    }
  } catch {
    // silently fail
  }
}

async function penalizeOverdueTasks(userId: string): Promise<void> {
  try {
    const tasks = await storage.getPersonalTasks(userId);
    const now   = new Date();
    const overdue = tasks.filter(
      t => t.status !== "completed" && t.dueDate && new Date(t.dueDate) < now && !t.disciplinePenalized
    );
    for (const task of overdue) {
      const dueDate = new Date(task.dueDate!);
      const hoursLate = (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60);
      if (hoursLate < 48 && !task.justification) {
        continue;
      }
      await storage.updatePersonalTask(task.id, userId, { disciplinePenalized: true });
      await adjustDisciplinePoints(userId, DISCIPLINE_POINTS.TASK_OVERDUE, `❌ Tarefa "${task.title}" em atraso — ${DISCIPLINE_POINTS.TASK_OVERDUE} pts`);
    }
  } catch {
    // silently fail
  }
}

async function penalizeMissedHabits(userId: string): Promise<void> {
  try {
    const allHabits = await storage.getHabits(userId);
    if (allHabits.length === 0) return;

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    for (const habit of allHabits) {
      const createdDate = habit.createdAt ? new Date(habit.createdAt).toISOString().split("T")[0] : todayStr;

      let weekdays: number[] | null = null;
      if (habit.weekdays) {
        try { weekdays = typeof habit.weekdays === "string" ? JSON.parse(habit.weekdays) : habit.weekdays; } catch {}
      }

      const startDateStr = habit.lastPenalizedDate || habit.lastChecked || createdDate;
      const startDate = new Date(startDateStr + "T00:00:00");
      const checkDate = new Date(startDate);
      checkDate.setDate(checkDate.getDate() + 1);

      const logs = await storage.getHabitLogs(habit.id, userId);
      let missedDays = 0;
      const maxCheck = 14;
      let iterations = 0;

      while (checkDate.toISOString().split("T")[0] < todayStr && iterations < maxCheck) {
        iterations++;
        const dateStr = checkDate.toISOString().split("T")[0];
        const dayOfWeek = checkDate.getDay();

        let shouldHaveDone = false;
        if (habit.frequency === "daily") {
          shouldHaveDone = true;
        } else if (habit.frequency === "weekly" && weekdays && weekdays.length > 0) {
          shouldHaveDone = weekdays.includes(dayOfWeek);
        }

        if (shouldHaveDone) {
          const didIt = logs.some(l => l.date === dateStr && l.completed);
          if (!didIt) {
            missedDays++;
          }
        }

        checkDate.setDate(checkDate.getDate() + 1);
      }

      if (missedDays > 0) {
        const totalPenalty = DISCIPLINE_POINTS.HABIT_MISSED * missedDays;
        await adjustDisciplinePoints(
          userId,
          totalPenalty,
          `❌ Compromisso "${habit.name}" perdido ${missedDays}x — ${totalPenalty} pts`
        );

        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        await storage.updateHabit(habit.id, userId, {
          lastPenalizedDate: yesterdayStr,
          streak: 0,
        });
      } else if (iterations > 0) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        await storage.updateHabit(habit.id, userId, {
          lastPenalizedDate: yesterday.toISOString().split("T")[0],
        });
      }
    }
  } catch (err: any) {
    console.error("[discipline] Error penalizing missed habits:", err.message);
  }
}

async function analyzeSpendingForDiscipline(userId: string): Promise<void> {
  try {
    const profile = await storage.getUserProfile(userId);
    const lastAnalysis = profile?.lastSpendingAnalysis;
    const now = new Date();

    if (lastAnalysis) {
      const daysSince = (now.getTime() - new Date(lastAnalysis).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 3) return;
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [transactions, recurringIncomes, allTimeTx, userCards] = await Promise.all([
      storage.getTransactions(userId, { startDate: thirtyDaysAgo, endDate: now }),
      storage.getRecurringIncomes(userId),
      storage.getTransactions(userId, { endDate: now }),
      storage.getCreditCards(userId),
    ]);

    const expenses = transactions.filter(t => t.type === "expense");

    // Exige mínimo de 5 despesas para análise ser significativa
    if (expenses.length < 5) return;

    const monthlyIncome = recurringIncomes.reduce((s: number, r: any) => {
      const amount = Number(r.amount);
      if (r.frequency === "weekly") return s + amount * 4.33;
      if (r.frequency === "biweekly") return s + amount * 2;
      return s + amount;
    }, 0);

    if (monthlyIncome <= 0) return;

    // Compute bank balance (excluding credit card transactions since they don't reduce balance)
    const allExpenses = allTimeTx.filter(t => t.type === "expense" && !t.creditCardId).reduce((s, t) => s + Number(t.amount), 0);
    const allIncome = allTimeTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const bankBalance = (profile?.initialBalance ?? 0) + allIncome - allExpenses;

    // Compute credit card utilization for this month
    const monthTx = allTimeTx.filter(t => new Date(t.date!) >= startOfMonth);
    const cardContext = userCards.filter(c => c.active && Number(c.limit) > 0).map(card => {
      const cardTx = monthTx.filter(t => t.creditCardId === card.id && t.type === "expense");
      const used = cardTx.reduce((s, t) => s + Number(t.amount), 0);
      const limit = Number(card.limit);
      const utilizationPct = (used / limit) * 100;

      // Top categories on this card
      const catMap: Record<string, number> = {};
      for (const t of cardTx) {
        const cat = (t.categoryName || "outros").toLowerCase();
        catMap[cat] = (catMap[cat] || 0) + Number(t.amount);
      }
      const topCategories = Object.entries(catMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat, val]) => `${cat} R$${val.toFixed(0)}`)
        .join(", ") || "nenhuma";

      return { name: card.name, limit, used, utilizationPct, topCategories };
    });

    await storage.upsertUserProfile(userId, { lastSpendingAnalysis: now });

    const result = await analyzeSpendingDiscipline(
      transactions.map(t => ({ title: t.description || t.categoryName || "", amount: Number(t.amount), category: t.categoryName, type: t.type })),
      monthlyIncome,
      cardContext.length > 0 ? cardContext : undefined,
      bankBalance
    );

    let reason: string;
    if (result.penalty > 0) {
      const emoji = result.verdict === "ótimo" ? "💰" : "✅";
      reason = `${emoji} Finanças ${result.verdict} — ${result.message || "gastos controlados"} (+${result.penalty} pts)`;
    } else if (result.penalty < 0) {
      const details = result.badCategories.length > 0
        ? result.badCategories.slice(0, 3).join("; ")
        : "padrão de gastos supérfluos";
      reason = `💸 ${result.message || "Gastos imprudentes"} — ${details} (${result.penalty} pts)`;
    } else {
      return;
    }
    await adjustDisciplinePoints(userId, result.penalty, reason);
  } catch {
    // silently fail
  }
}

async function autoCloseInvoices(userId: string): Promise<void> {
  const now = new Date();
  const today = now.getDate();
  const cards = await storage.getCreditCards(userId);
  for (const card of cards) {
    if (!card.active) continue;
    if (today < card.closingDay) continue;
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const existing = await storage.getInvoiceByMonth(card.id, monthKey);
    if (existing && (existing.status === "closed" || existing.status === "paid")) continue;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const closingDate = new Date(now.getFullYear(), now.getMonth(), card.closingDay, 23, 59, 59);
    const allCardTx = await storage.getTransactions(userId, { creditCardId: card.id, startDate: startOfMonth, endDate: closingDate });
    const total = allCardTx.reduce((s, t) => s + Number(t.amount), 0);
    const bill = await storage.createBill({
      userId,
      title: `Fatura ${card.name}`,
      amount: total,
      type: "expense",
      dueDay: card.dueDay,
      categoryName: "Cartão de Crédito",
      recurrenceType: "this_month",
      active: true,
      paidMonths: "[]",
      notes: `Fatura automática do cartão ${card.name} — ${monthKey}`,
    });
    if (existing) {
      await storage.updateInvoice(existing.id, { status: "closed", total, billId: bill.id, closedAt: now });
    } else {
      await storage.createInvoice({ userId, creditCardId: card.id, monthKey, total, status: "closed", billId: bill.id, closedAt: now });
    }
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  app.get("/api/user/identity", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const entities = await getUserIdentityEntities(userId);
      res.json({ entities });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const profile = await storage.getUserProfile(userId);
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      res.json({ profile, user: { activeModules: user?.activeModules, theme: user?.theme, onboardingCompleted: user?.onboardingCompleted, aiPersonality: user?.aiPersonality } });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/user/initial-balance", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { amount } = req.body;
      if (typeof amount !== "number" || isNaN(amount) || amount < 0) {
        return res.status(400).json({ message: "Valor inválido" });
      }
      await storage.upsertUserProfile(userId, { initialBalance: amount } as any);
      res.json({ success: true, initialBalance: amount });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/user/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      const profile = await storage.getUserProfile(userId);
      const prefs = (() => {
        try { return JSON.parse(profile?.emailAlerts || "{}"); } catch { return {}; }
      })();
      res.json({
        email: user?.email || "",
        billDueSoon: prefs.billDueSoon !== false,
        offlineReminder: prefs.offlineReminder !== false,
        overdueTask: prefs.overdueTask !== false,
        weeklySummary: prefs.weeklySummary !== false,
        goalDeadline: prefs.goalDeadline !== false,
        lowDiscipline: prefs.lowDiscipline !== false,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/user/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { billDueSoon, offlineReminder, overdueTask, weeklySummary, goalDeadline, lowDiscipline } = req.body;
      const prefs = {
        billDueSoon: billDueSoon !== false,
        offlineReminder: offlineReminder !== false,
        overdueTask: overdueTask !== false,
        weeklySummary: weeklySummary !== false,
        goalDeadline: goalDeadline !== false,
        lowDiscipline: lowDiscipline !== false,
      };
      await storage.upsertUserProfile(userId, { emailAlerts: JSON.stringify(prefs) });
      res.json(prefs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/user/reset-data", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.resetUserData(userId);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/input/process", isAuthenticated, upload.single("audio"), async (req, res) => {
    try {
      const userId = getUserId(req);
      let text = req.body.text;

      if (req.file) {
        text = await transcribeAudio(req.file.buffer, req.file.mimetype);
      }

      if (!text) return res.status(400).json({ message: "Nenhum input fornecido" });

      const result = await detectIntentAndProcess(text, userId);

      let created: any = null;
      switch (result.intent) {
        case "expense":
        case "income":
          if (result.data.creditCardId && result.data.installments && result.data.installments > 1) {
            const card = await storage.getCreditCard(result.data.creditCardId, userId);
            if (card) {
              const groupId = crypto.randomUUID();
              const baseDate = result.data.date ? new Date(result.data.date) : new Date();
              const installAmt = Math.round((result.data.amount / result.data.installments) * 100) / 100;
              const purchaseDay = baseDate.getDate();
              const afterClosing = purchaseDay >= card.closingDay;
              const txList = Array.from({ length: result.data.installments }, (_, i) => {
                const offset = afterClosing ? i + 1 : i;
                return {
                  userId,
                  amount: installAmt,
                  description: `${result.data.description} (${i + 1}/${result.data.installments})`,
                  categoryName: result.data.categoryName || null,
                  type: "expense" as const,
                  date: new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1),
                  source: (req.file ? "voice" : "text") as string,
                  establishment: result.data.establishment || null,
                  location: null,
                  creditCardId: result.data.creditCardId,
                  installmentInfo: JSON.stringify({ current: i + 1, total: result.data.installments, groupId }),
                };
              });
              created = await storage.createManyTransactions(txList);
              break;
            }
          }
          created = await storage.createTransaction({
            userId,
            amount: result.data.amount,
            description: result.data.description,
            categoryName: result.data.categoryName || null,
            type: result.intent,
            date: result.data.date ? new Date(result.data.date) : new Date(),
            source: req.file ? "voice" : "text",
            establishment: result.data.establishment || null,
            location: null,
            creditCardId: result.data.creditCardId || null,
            installmentInfo: null,
          });
          break;
        case "task":
          created = await storage.createPersonalTask({
            userId,
            title: result.data.title,
            description: result.data.description || null,
            priority: result.data.priority || "medium",
            dueDate: result.data.dueDate ? new Date(result.data.dueDate) : null,
            category: result.data.category || null,
          });
          break;
        case "schedule":
          created = await storage.createScheduleItem({
            userId,
            title: result.data.title,
            description: result.data.description || null,
            startTime: new Date(result.data.startTime),
            endTime: result.data.endTime ? new Date(result.data.endTime) : null,
            suggestedByAi: true,
          });
          break;
        case "habit":
          created = await storage.createHabit({
            userId,
            name: result.data.name,
            frequency: result.data.frequency || "daily",
          });
          break;
        case "chat":
          const chatResponse = await chatWithContext(text, userId);
          await storage.createChatMessage({ userId, role: "user", content: text });
          await storage.createChatMessage({ userId, role: "assistant", content: chatResponse });
          created = { response: chatResponse };
          break;
      }

      res.json({ intent: result.intent, data: result.data, created, rawText: result.rawText });
    } catch (error: any) {
      console.error("Error processing input:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/finance/photo", isAuthenticated, upload.single("image"), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!req.file) return res.status(400).json({ message: "Nenhuma imagem enviada" });
      const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const result = await processMultipleReceipts(base64, userId);
      res.json(result);
    } catch (error: any) {
      console.error("Error processing photo:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/finance/photo/confirm", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);

      // Support both single receipt (legacy) and array of receipts
      const receiptsRaw: any[] = Array.isArray(req.body.receipts)
        ? req.body.receipts
        : [req.body];

      const created = await Promise.all(
        receiptsRaw.map(async (r: any) => {
          const { items, totalAmount, establishment, date, categoryName, location, paymentMethod, transactionType, description: bodyDesc } = r;
          const txItems: { description: string; amount: number }[] = (items || []).map((i: any) => ({
            description: String(i.description || ""),
            amount: Number(i.amount || 0),
          }));
          const total = Number(totalAmount) || txItems.reduce((s, i) => s + i.amount, 0);
          const desc = bodyDesc || establishment || (txItems.length === 1 ? txItems[0].description : "Nota fiscal");
          const type = transactionType === "income" ? "income" : "expense";

          return storage.createTransaction({
            userId,
            amount: total as any,
            description: desc,
            categoryName: categoryName || null,
            type,
            date: date ? new Date(date) : new Date(),
            source: "photo",
            establishment: establishment || null,
            location: location || null,
            paymentMethod: paymentMethod || null,
            receiptItems: txItems.length > 1 ? JSON.stringify(txItems) : null,
          });
        })
      );
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/finance/pdf", isAuthenticated, upload.single("pdf"), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!req.file) return res.status(400).json({ message: "Nenhum PDF enviado" });
      const result = await processPDFExtract(req.file.buffer, userId);
      res.json(result);
    } catch (error: any) {
      console.error("Error processing PDF:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/finance/pdf/confirm", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { docType } = req.body;

      if (docType === "bill") {
        const { title, amount, type, dueDay, categoryName, notes, recurrenceType, identityName, identityCnpj } = req.body;
        const parsedAmount = Number(amount);
        const parsedDueDay = Number(dueDay);
        if (!title || typeof title !== "string" || title.trim().length === 0) {
          return res.status(400).json({ message: "Título da conta é obrigatório" });
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          return res.status(400).json({ message: "Valor deve ser maior que zero" });
        }
        if (isNaN(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) {
          return res.status(400).json({ message: "Dia de vencimento deve ser entre 1 e 31" });
        }
        if (identityName && identityCnpj) {
          const cleanCnpj = (identityCnpj as string).replace(/[^0-9]/g, "");
          if (cleanCnpj.length === 11 || cleanCnpj.length === 14) {
            await saveUserIdentityEntity(userId, identityName, identityCnpj);
          }
        }
        const bill = await storage.createBill({
          userId,
          title: title.trim(),
          amount: parsedAmount,
          type: type === "income" ? "income" : "expense",
          dueDay: parsedDueDay,
          categoryName: categoryName || "outros",
          recurrenceType: recurrenceType || "this_month",
          active: true,
          paidMonths: "[]",
          notes: notes || null,
        });
        res.json({ created: "bill", bill });
      } else {
        const { transactions: txns } = req.body;
        const created = await storage.createManyTransactions(
          (txns || []).map((t: any) => ({
            userId,
            amount: t.amount,
            description: t.description,
            categoryName: t.categoryName || null,
            type: t.type || "expense",
            date: t.date ? new Date(t.date) : new Date(),
            source: "pdf",
            establishment: t.establishment || null,
            paymentMethod: t.paymentMethod || null,
            location: null,
          }))
        );
        res.json(created);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  async function filterNewTxns(userId: string, txns: any[]): Promise<{ toCreate: any[]; skipped: number }> {
    if (txns.length === 0) return { toCreate: [], skipped: 0 };
    const dates = txns.filter(t => t.date).map((t: any) => new Date(t.date));
    const minDate = dates.length > 0 ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))) : new Date();
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))) : new Date();
    minDate.setDate(minDate.getDate() - 1);
    maxDate.setDate(maxDate.getDate() + 1);
    const existing = await storage.getTransactions(userId, { startDate: minDate, endDate: maxDate });
    const toCreate = txns.filter((t: any) => {
      const tDate = t.date ? t.date.substring(0, 10) : null;
      const tAmount = Number(t.amount);
      const tDesc = (t.description || "").toLowerCase().trim();
      return !existing.some((e: any) => {
        const eDate = e.date ? new Date(e.date).toISOString().substring(0, 10) : null;
        const eAmount = Number(e.amount);
        const eDesc = (e.description || "").toLowerCase().trim();
        if (Math.abs(eAmount - tAmount) > 0.01 || e.type !== t.type) return false;
        if (tDate && eDate && tDate !== eDate) return false;
        const tShort = tDesc.substring(0, 15);
        const eShort = eDesc.substring(0, 15);
        return tShort.length > 3 && eShort.length > 3 && (tDesc.includes(eShort) || eDesc.includes(tShort));
      });
    });
    return { toCreate, skipped: txns.length - toCreate.length };
  }

  app.post("/api/chat/upload", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado" });
      const file = req.file;
      const isImage = file.mimetype.startsWith("image/");
      let imported = 0;
      let skipped = 0;
      let botMessage = "";

      if (isImage) {
        const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
        const multiResult = await processMultipleReceipts(base64, userId);
        const validReceipts = multiResult.receipts.filter((r: any) => r.totalAmount && r.imageType !== "unknown");

        if (validReceipts.length === 0) {
          botMessage = "🤔 Não consegui identificar transações nessa imagem. Tente uma foto mais clara do comprovante ou nota fiscal.";
        } else {
          const lines: string[] = [];
          for (const result of validReceipts) {
            const txDate = result.date ? new Date(result.date) : new Date();
            if (result.time && result.time !== "00:00") {
              const [h, m] = result.time.split(":").map(Number);
              txDate.setHours(h, m, 0, 0);
            }
            const txType = result.transactionType === "income" ? "income" : "expense";
            const txAmount = Number(result.totalAmount);
            const txEstablishment = result.establishment || null;
            const txDesc = result.items?.[0]?.description || result.receiverName || result.senderName || (txEstablishment ?? "Comprovante");

            const dayStart = new Date(txDate); dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(txDate); dayEnd.setHours(23, 59, 59, 999);
            const existing = await storage.getTransactions(userId, { startDate: dayStart, endDate: dayEnd });
            const isDuplicate = existing.some((e: any) =>
              Math.abs(Number(e.amount) - txAmount) < 0.01 && e.type === txType
            );

            if (isDuplicate) {
              skipped++;
              lines.push(`⚠️ Já cadastrado: ${txType === "income" ? "💰" : "💸"} R$ ${txAmount.toFixed(2)}${txEstablishment ? ` — ${txEstablishment}` : ""}`);
            } else {
              const txItems = result.items && result.items.length > 1 ? result.items : null;
              await storage.createTransaction({
                userId,
                amount: txAmount as any,
                description: txEstablishment || txDesc,
                categoryName: result.categoryName || "outros",
                type: txType as "expense" | "income",
                date: txDate,
                source: "photo",
                establishment: txEstablishment,
                paymentMethod: result.paymentMethod || null,
                location: result.location || null,
                receiptItems: txItems ? JSON.stringify(txItems.map((i: any) => ({ description: String(i.description || ""), amount: Number(i.amount || 0) }))) : null,
                dateOnly: !result.time || result.time === "00:00",
              });
              imported++;
              lines.push(`${txType === "income" ? "💰" : "💸"} R$ ${txAmount.toFixed(2)}${txEstablishment ? ` — ${txEstablishment}` : ""} · ${result.categoryName || "outros"}`);
            }
          }

          if (imported === 0) {
            botMessage = `⚠️ ${skipped > 1 ? `Todos os ${skipped} comprovantes já estavam cadastrados.` : "Essa transação parece já estar cadastrada."}\n\nNenhuma transação foi importada.`;
          } else if (validReceipts.length === 1) {
            botMessage = `✅ Comprovante importado!\n\n${lines[0]}\n📅 ${(validReceipts[0].date ? new Date(validReceipts[0].date) : new Date()).toLocaleDateString("pt-BR")}`;
          } else {
            botMessage = `✅ ${imported} comprovante${imported > 1 ? "s" : ""} importado${imported > 1 ? "s" : ""}${skipped > 0 ? ` (${skipped} já existia${skipped > 1 ? "m" : ""})` : ""}!\n\n${lines.join("\n")}`;
          }
        }
      } else {
        const extracted = await processPDFExtract(file.buffer, userId);

        if (extracted?.docType === "bill") {
          const hasBothEntities = extracted.issuerCnpj && extracted.recipientCnpj;
          let resolvedType: "income" | "expense" = extracted.type === "income" ? "income" : "expense";

          if (hasBothEntities) {
            const identityMatch = await matchBillIdentity(userId, extracted);
            if (identityMatch) {
              resolvedType = identityMatch.type;
            } else {
              botMessage = `🔍 *Quem é você nessa nota?*\n\n1️⃣ ${extracted.issuer || "Emissor"} (${extracted.issuerCnpj})\n2️⃣ ${extracted.recipient || "Destinatário"} (${extracted.recipientCnpj})\n\nResponda *1* ou *2* para eu registrar a conta corretamente.`;
              pendingChatBills.set(userId, { extracted, expiresAt: Date.now() + 10 * 60 * 1000 });
              await storage.createChatMessage({ userId, role: "assistant", content: botMessage });
              return res.json({ botMessage, imported: 0, skipped: 0 });
            }
          }

          const notesParts: string[] = [];
          if (extracted.description) notesParts.push(`Descrição: ${extracted.description}`);
          if (extracted.issuer) notesParts.push(`Emissor: ${extracted.issuer}${extracted.issuerCnpj ? ` (${extracted.issuerCnpj})` : ""}`);
          if (extracted.recipient) notesParts.push(`Destinatário: ${extracted.recipient}${extracted.recipientCnpj ? ` (${extracted.recipientCnpj})` : ""}`);
          if (extracted.paymentInfo) notesParts.push(`Pagamento: ${extracted.paymentInfo}`);
          const composedNotes = notesParts.length > 0 ? notesParts.join("\n") : null;

          const bill = await storage.createBill({
            userId,
            title: extracted.title || "Conta importada",
            amount: Number(extracted.amount) || 0,
            type: resolvedType,
            dueDay: Number(extracted.dueDay) || new Date().getDate(),
            categoryName: extracted.categoryName || "outros",
            recurrenceType: "this_month",
            active: true,
            paidMonths: "[]",
            notes: composedNotes,
          });
          imported = 1;
          const typeLabel = bill.type === "income" ? "💰 A receber" : "💸 A pagar";
          const msgLines = [`📋 *Conta registrada!*\n`, `*${bill.title}*`, `${typeLabel}: R$ ${Number(bill.amount).toFixed(2)}`, `📅 Vence dia ${bill.dueDay}`];
          if (extracted.description) msgLines.push(`\n📄 ${extracted.description}`);
          if (extracted.issuer) msgLines.push(`🏢 ${extracted.issuer}${extracted.issuerCnpj ? ` (${extracted.issuerCnpj})` : ""}`);
          if (extracted.recipient) msgLines.push(`👤 ${extracted.recipient}${extracted.recipientCnpj ? ` (${extracted.recipientCnpj})` : ""}`);
          if (extracted.paymentInfo) msgLines.push(`💳 ${extracted.paymentInfo}`);
          msgLines.push(`\nVeja em Contas no app.`);
          botMessage = msgLines.join("\n");
        } else {
          const txns: any[] = extracted?.transactions ?? [];
          if (txns.length === 0) {
            botMessage = "🤔 Nenhuma transação encontrada. Verifique se o arquivo é um extrato bancário em formato TXT ou CSV.";
          } else {
            const { toCreate, skipped: sk } = await filterNewTxns(userId, txns);
            skipped = sk;
            if (toCreate.length > 0) {
              await storage.createManyTransactions(toCreate.map((t: any) => ({
                userId,
                amount: Number(t.amount),
                description: t.description || "Sem descrição",
                categoryName: t.categoryName || "outros",
                type: (t.type === "income" ? "income" : "expense") as "expense" | "income",
                date: t.date ? new Date(t.date) : new Date(),
                source: "pdf" as const,
                establishment: t.establishment || null,
                paymentMethod: t.paymentMethod || null,
                dateOnly: !t.time || t.time === "00:00",
              })));
              imported = toCreate.length;
            }
            const totalExpense = toCreate.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + Number(t.amount), 0);
            const totalIncome = toCreate.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
            const parts: string[] = [];
            if (extracted.bankName) parts.push(`🏦 ${extracted.bankName}`);
            if (extracted.period) parts.push(`📅 ${extracted.period}`);
            if (imported === 0 && skipped > 0) {
              botMessage = `✅ Extrato analisado! Todas as ${skipped} transações já estavam cadastradas — nada novo para importar.`;
            } else {
              botMessage = `📊 *Extrato analisado!*${parts.length > 0 ? "\n" + parts.join("  ") : ""}\n\n✅ ${imported} importadas${skipped > 0 ? `  ⏭️ ${skipped} já cadastradas` : ""}\n\n💰 Receitas: R$ ${totalIncome.toFixed(2)}\n💸 Gastos: R$ ${totalExpense.toFixed(2)}`;
            }
          }
        }
      }

      const userLabel = isImage ? "📷 [foto de comprovante enviada]" : "📄 [extrato enviado]";
      await storage.createChatMessage({ userId, role: "user", content: userLabel });
      await storage.createChatMessage({ userId, role: "assistant", content: botMessage });
      res.json({ message: botMessage, imported, skipped });
    } catch (error: any) {
      console.error("Error processing chat upload:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/transactions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      autoCloseInvoices(userId).catch(() => {});
      const filters: any = {};
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      filters.endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      if (req.query.type) filters.type = req.query.type as string;
      if (req.query.categoryId) filters.categoryId = req.query.categoryId as string;
      if (req.query.creditCardId) filters.creditCardId = req.query.creditCardId as string;
      const result = await storage.getTransactions(userId, filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/transactions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        amount: z.number().positive(),
        description: z.string().min(1),
        categoryName: z.string().optional().nullable(),
        categoryId: z.string().optional().nullable(),
        type: z.enum(["income", "expense"]),
        date: z.string().optional(),
        establishment: z.string().optional().nullable(),
        location: z.string().optional().nullable(),
        paymentMethod: z.string().optional().nullable(),
        creditCardId: z.string().optional().nullable(),
        installments: z.number().int().min(1).max(24).optional(),
      });
      const data = schema.parse(req.body);

      if (data.creditCardId && data.installments && data.installments > 1) {
        const card = await storage.getCreditCard(data.creditCardId, userId);
        if (!card) return res.status(404).json({ message: "Cartão não encontrado" });
        const groupId = crypto.randomUUID();
        const baseDate = data.date ? new Date(data.date) : new Date();
        const installmentAmount = Math.round((data.amount / data.installments) * 100) / 100;
        const txList: any[] = [];
        const purchaseDay = baseDate.getDate();
        const afterClosing = purchaseDay >= card.closingDay;
        for (let i = 0; i < data.installments; i++) {
          const offset = afterClosing ? i + 1 : i;
          const txDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1);
          txList.push({
            userId,
            amount: installmentAmount,
            description: `${data.description} (${i + 1}/${data.installments})`,
            categoryName: data.categoryName || null,
            categoryId: data.categoryId || null,
            type: "expense" as const,
            date: txDate,
            source: "manual",
            establishment: data.establishment || null,
            location: data.location || null,
            paymentMethod: "credit_card",
            creditCardId: data.creditCardId,
            installmentInfo: JSON.stringify({ current: i + 1, total: data.installments, groupId }),
          });
        }
        const created = await storage.createManyTransactions(txList);
        saveEventToMemory(userId, `Compra parcelada no cartão ${card.name}: R$${data.amount.toFixed(2)} em ${data.installments}x — "${data.description}"`).catch(() => {});
        return res.status(201).json(created);
      }

      const tx = await storage.createTransaction({
        userId,
        amount: data.amount,
        description: data.description,
        categoryName: data.categoryName || null,
        categoryId: data.categoryId || null,
        type: data.type,
        date: data.date ? new Date(data.date) : new Date(),
        source: "manual",
        establishment: data.establishment || null,
        location: data.location || null,
        paymentMethod: data.paymentMethod || null,
        creditCardId: data.creditCardId || null,
        installmentInfo: null,
      });
      saveEventToMemory(userId, `Nova transação registrada: ${data.type === "expense" ? "gasto" : "receita"} de R$${data.amount.toFixed(2)} em ${data.categoryName || "sem categoria"} — "${data.description}"`).catch(() => {});
      res.status(201).json(tx);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/credit-cards", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const cards = await storage.getCreditCards(userId);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      const monthTx = await storage.getTransactions(userId, { startDate: startOfMonth, endDate: endOfMonth });
      const enriched = cards.map(card => {
        const usedThisMonth = monthTx
          .filter(t => t.creditCardId === card.id && t.type === "expense")
          .reduce((s, t) => s + Number(t.amount), 0);
        return { ...card, usedThisMonth };
      });
      res.json(enriched);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/credit-cards", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        name: z.string().min(1),
        bank: z.string().min(1),
        limit: z.number().positive(),
        closingDay: z.number().int().min(1).max(31),
        dueDay: z.number().int().min(1).max(31),
        color: z.string().optional().nullable(),
      });
      const data = schema.parse(req.body);
      const card = await storage.createCreditCard({ ...data, userId, active: true, color: data.color || "#7C3AED" });
      res.status(201).json(card);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/credit-cards/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        name: z.string().optional(),
        bank: z.string().optional(),
        limit: z.number().positive().optional(),
        closingDay: z.number().int().min(1).max(31).optional(),
        dueDay: z.number().int().min(1).max(31).optional(),
        color: z.string().optional().nullable(),
        active: z.boolean().optional(),
      });
      const data = schema.parse(req.body);
      const existing = await storage.getCreditCard(req.params.id, userId);
      if (!existing) return res.status(404).json({ message: "Cartão não encontrado" });
      let updatePayload: any = { ...data };
      if (data.limit !== undefined && data.limit !== existing.limit) {
        let history: Array<{ date: string; limit: number }> = [];
        try { history = existing.limitHistory ? JSON.parse(existing.limitHistory) : []; } catch {}
        if (history.length === 0) {
          history.push({ date: existing.createdAt ? new Date(existing.createdAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0], limit: existing.limit });
        }
        history.push({ date: new Date().toISOString().split("T")[0], limit: data.limit });
        updatePayload.limitHistory = JSON.stringify(history);
      }
      const card = await storage.updateCreditCard(req.params.id, userId, updatePayload);
      if (!card) return res.status(404).json({ message: "Cartão não encontrado" });
      res.json(card);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/credit-cards/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCreditCard(req.params.id, getUserId(req));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/credit-cards/:id/invoices", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const cardId = req.params.id;
      const card = await storage.getCreditCard(cardId, userId);
      if (!card) return res.status(404).json({ message: "Cartão não encontrado" });
      const invoices = await storage.getInvoices(userId, cardId);
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const openInvoice = invoices.find(i => i.status === "open" && i.monthKey === currentMonthKey);
      const allTx = await storage.getTransactions(userId, { creditCardId: cardId });
      const result = invoices.map(inv => {
        const txForInvoice = allTx.filter(tx => {
          const txDate = new Date(tx.date!);
          const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
          return txMonthKey === inv.monthKey;
        });
        const computedTotal = txForInvoice.reduce((s, t) => s + Number(t.amount), 0);
        return { ...inv, total: computedTotal, transactions: txForInvoice };
      });
      if (!openInvoice) {
        const openTx = allTx.filter(tx => {
          const txDate = new Date(tx.date!);
          const txMonthKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
          return txMonthKey === currentMonthKey;
        });
        const openTotal = openTx.reduce((s, t) => s + Number(t.amount), 0);
        result.unshift({ id: "open", userId, creditCardId: cardId, monthKey: currentMonthKey, total: openTotal, status: "open", billId: null, closedAt: null, createdAt: null, transactions: openTx } as any);
      }
      res.json({ card, invoices: result });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/transactions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { amount, description, categoryName, establishment, date, type, paymentMethod, creditCardId } = req.body;
      const fields: Record<string, any> = {};
      if (amount !== undefined) fields.amount = Number(amount);
      if (description !== undefined) fields.description = description;
      if (categoryName !== undefined) fields.categoryName = categoryName;
      if (establishment !== undefined) fields.establishment = establishment || null;
      if (date !== undefined) fields.date = new Date(date);
      if (type !== undefined) fields.type = type;
      if (paymentMethod !== undefined) fields.paymentMethod = paymentMethod || null;
      if (creditCardId !== undefined) fields.creditCardId = creditCardId || null;
      const updated = await storage.updateTransaction(paramId(req), userId, fields);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/transactions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteTransaction(paramId(req), userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      res.json(await storage.getCategories(userId));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ name: z.string().min(1), icon: z.string().optional().nullable(), color: z.string().optional().nullable(), type: z.enum(["income", "expense"]).default("expense") });
      const data = schema.parse(req.body);
      res.status(201).json(await storage.createCategory({ userId, ...data }));
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/categories/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCategory(paramId(req), getUserId(req));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/goals", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getFinancialGoals(getUserId(req)));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/goals", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        title: z.string().min(1),
        emoji: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        targetAmount: z.number().positive().optional().nullable(),
        currentAmount: z.number().min(0).optional(),
        deadline: z.string().optional().nullable(),
      });
      const data = schema.parse(req.body);
      const goal = await storage.createFinancialGoal({
        userId,
        title: data.title,
        emoji: data.emoji ?? null,
        description: data.description ?? null,
        targetAmount: data.targetAmount ?? null,
        currentAmount: data.currentAmount ?? 0,
        deadline: data.deadline ? new Date(data.deadline) : null,
      });
      saveEventToMemory(userId, `Nova reserva financeira criada: "${data.title}"${data.targetAmount ? ` — alvo R$${data.targetAmount}` : ""}${data.currentAmount ? ` — já guardado: R$${data.currentAmount}` : ""}`).catch(() => {});
      res.status(201).json(goal);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/goals/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        title: z.string().optional(),
        emoji: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        targetAmount: z.number().optional().nullable(),
        currentAmount: z.number().optional(),
        status: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const goal = await storage.updateFinancialGoal(paramId(req), userId, data);
      if (!goal) return res.status(404).json({ message: "Reserva não encontrada" });
      if (data.currentAmount !== undefined) {
        saveEventToMemory(userId, `Depósito na reserva "${goal.title}": R$${data.currentAmount} guardados`).catch(() => {});
      }
      res.json(goal);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/goals/:id/deposit", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ amount: z.number().positive() });
      const { amount } = schema.parse(req.body);
      const goals = await storage.getFinancialGoals(userId);
      const goal = goals.find(g => g.id === paramId(req));
      if (!goal) return res.status(404).json({ message: "Reserva não encontrada" });
      const [updatedGoal, tx] = await Promise.all([
        storage.updateFinancialGoal(paramId(req), userId, { currentAmount: goal.currentAmount + amount }),
        storage.createTransaction({
          userId,
          amount,
          description: `Reserva: ${goal.title}`,
          type: "expense",
          categoryName: "reserva",
          source: "manual",
          date: new Date(),
          establishment: null,
          paymentMethod: null,
          location: null,
        }),
      ]);
      saveEventToMemory(userId, `Depósito de R$${amount} na reserva "${goal.title}" — total: R$${updatedGoal?.currentAmount}`).catch(() => {});
      res.json({ goal: updatedGoal, transaction: tx });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/goals/:id/withdraw", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ amount: z.number().positive() });
      const { amount } = schema.parse(req.body);
      const goals = await storage.getFinancialGoals(userId);
      const goal = goals.find(g => g.id === paramId(req));
      if (!goal) return res.status(404).json({ message: "Reserva não encontrada" });
      if (amount > goal.currentAmount) return res.status(400).json({ message: "Valor maior que o saldo da reserva" });
      const [updatedGoal, tx] = await Promise.all([
        storage.updateFinancialGoal(paramId(req), userId, { currentAmount: goal.currentAmount - amount }),
        storage.createTransaction({
          userId,
          amount,
          description: `Saque da reserva: ${goal.title}`,
          type: "income",
          categoryName: "reserva",
          source: "manual",
          date: new Date(),
          establishment: null,
          paymentMethod: null,
          location: null,
        }),
      ]);
      saveEventToMemory(userId, `Saque de R$${amount} da reserva "${goal.title}" — saldo restante: R$${updatedGoal?.currentAmount}`).catch(() => {});
      res.json({ goal: updatedGoal, transaction: tx });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/goals/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteFinancialGoal(paramId(req), getUserId(req));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/schedule", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const filters: any = {};
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      if (req.query.status) filters.status = req.query.status as string;
      res.json(await storage.getScheduleItems(userId, filters));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/schedule", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ title: z.string().min(1), description: z.string().optional().nullable(), startTime: z.string(), endTime: z.string().optional().nullable(), suggestedByAi: z.boolean().optional() });
      const data = schema.parse(req.body);
      res.status(201).json(await storage.createScheduleItem({ userId, title: data.title, description: data.description || null, startTime: new Date(data.startTime), endTime: data.endTime ? new Date(data.endTime) : null, suggestedByAi: data.suggestedByAi || false }));
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/schedule/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ title: z.string().optional(), description: z.string().optional().nullable(), startTime: z.string().optional(), endTime: z.string().optional().nullable(), status: z.string().optional() });
      const data = schema.parse(req.body);
      const updateData: any = { ...data };
      if (data.startTime) updateData.startTime = new Date(data.startTime);
      if (data.endTime) updateData.endTime = new Date(data.endTime);
      const item = await storage.updateScheduleItem(paramId(req), userId, updateData);
      if (!item) return res.status(404).json({ message: "Compromisso não encontrado" });
      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/schedule/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteScheduleItem(paramId(req), getUserId(req));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/schedule/cancellations", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const startDate = (req.query.startDate as string) || "";
      const endDate = (req.query.endDate as string) || "";
      res.json(await storage.getScheduleCancellations(userId, startDate, endDate));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/schedule/:id/cancel-today", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const scheduleItemId = paramId(req);
      const schema = z.object({
        date: z.string(),
        type: z.enum(["holiday", "medical", "other"]),
        reason: z.string().optional(),
      });
      const { date, type, reason } = schema.parse(req.body);

      const item = await storage.updateScheduleItem(scheduleItemId, userId, {});
      if (!item) return res.status(404).json({ message: "Compromisso não encontrado" });

      const cancellation = await storage.createScheduleCancellation({ userId, scheduleItemId, date, reason, type });

      let delta = 0;
      let disciplineMsg = "";
      if (type === "holiday") {
        delta = 0;
        disciplineMsg = `🏖️ Feriado em "${item.title}" — sem penalidade`;
      } else if (type === "medical") {
        delta = -1;
        disciplineMsg = `🏥 Atestado em "${item.title}" — justificativa aceita (${delta} pt)`;
      } else {
        delta = -3;
        disciplineMsg = `❌ Falta em "${item.title}" sem justificativa (${delta} pts)`;
      }

      if (delta !== 0) {
        await adjustDisciplinePoints(userId, delta, disciplineMsg);
      }

      res.status(201).json({ cancellation, disciplineMsg });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/schedule/cancellations/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteScheduleCancellation(paramId(req), getUserId(req));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getPersonalTasks(getUserId(req)));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ title: z.string().min(1), description: z.string().optional().nullable(), priority: z.enum(["high", "medium", "low"]).default("medium"), dueDate: z.string().optional().nullable(), category: z.string().optional().nullable() });
      const data = schema.parse(req.body);
      res.status(201).json(await storage.createPersonalTask({ userId, title: data.title, description: data.description || null, priority: data.priority, dueDate: data.dueDate ? new Date(data.dueDate) : null, category: data.category || null }));
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ title: z.string().optional(), description: z.string().optional().nullable(), status: z.string().optional(), priority: z.string().optional(), dueDate: z.string().optional().nullable(), category: z.string().optional().nullable() });
      const data = schema.parse(req.body);
      const updateData: any = { ...data };
      if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
      const task = await storage.updatePersonalTask(paramId(req), userId, updateData);
      if (!task) return res.status(404).json({ message: "Tarefa não encontrada" });
      if (data.status === "done" || data.status === "completed") {
        saveEventToMemory(userId, `Tarefa concluída: "${task.title}"`).catch(() => {});
        const pts = task.priority === "high" ? DISCIPLINE_POINTS.TASK_HIGH
                  : task.priority === "low"  ? DISCIPLINE_POINTS.TASK_LOW
                  : DISCIPLINE_POINTS.TASK_MEDIUM;
        adjustDisciplinePoints(userId, pts, `✅ Tarefa "${task.title}" concluída — +${pts} pts`).catch(() => {});
      }
      res.json(task);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deletePersonalTask(paramId(req), getUserId(req));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/tasks/:id/justify", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ justification: z.string().min(5).max(500) });
      const { justification } = schema.parse(req.body);

      const tasks = await storage.getPersonalTasks(userId);
      const task = tasks.find(t => t.id === paramId(req));
      if (!task) return res.status(404).json({ message: "Tarefa não encontrada" });
      if (task.justificationScore !== null && task.justificationScore !== undefined) {
        return res.status(400).json({ message: "Justificativa já enviada anteriormente" });
      }

      const now = new Date();
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      const daysLate = dueDate ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      const judgment = await judgeJustification(task.title, daysLate, justification);

      await storage.updatePersonalTask(task.id, userId, {
        justification,
        justificationScore: judgment.score,
        disciplinePenalized: true,
      });

      const netPenalty = DISCIPLINE_POINTS.TASK_OVERDUE + judgment.creditPoints;
      const reason = judgment.creditPoints > 0
        ? `⚠️ Tarefa "${task.title}" em atraso — justificativa ${judgment.verdict} (+${judgment.creditPoints} de crédito, net ${netPenalty} pts)`
        : `❌ Tarefa "${task.title}" em atraso — justificativa ${judgment.verdict} (${DISCIPLINE_POINTS.TASK_OVERDUE} pts)`;

      await adjustDisciplinePoints(userId, netPenalty, reason);

      res.json({ judgment, netPenalty });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors[0].message });
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/habits", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getHabits(getUserId(req)));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/habits", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        name: z.string().min(1),
        frequency: z.enum(["daily", "weekly"]).default("daily"),
        emoji: z.string().optional(),
        targetTime: z.string().optional().nullable(),
        endTime: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        weekdays: z.array(z.number()).optional(),
      });
      const data = schema.parse(req.body);
      res.status(201).json(await storage.createHabit({
        userId,
        name: data.name,
        frequency: data.frequency,
        emoji: data.emoji || "⚡",
        targetTime: data.targetTime || null,
        endTime: data.endTime || null,
        description: data.description || null,
        weekdays: data.weekdays && data.weekdays.length > 0 ? JSON.stringify(data.weekdays) : null,
      }));
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/habits/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        name: z.string().optional(),
        frequency: z.string().optional(),
        emoji: z.string().optional(),
        targetTime: z.string().optional().nullable(),
        endTime: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        weekdays: z.array(z.number()).optional().nullable(),
      });
      const data = schema.parse(req.body);
      const { weekdays, ...rest } = data;
      const updatePayload: any = { ...rest };
      if (weekdays !== undefined) {
        updatePayload.weekdays = weekdays && weekdays.length > 0 ? JSON.stringify(weekdays) : null;
      }
      const habit = await storage.updateHabit(paramId(req), userId, updatePayload);
      if (!habit) return res.status(404).json({ message: "Compromisso não encontrado" });
      res.json(habit);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/habits/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteHabit(paramId(req), getUserId(req));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/habits/:id/check", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const date = (req.body.date as string) || new Date().toISOString().split("T")[0];
      const log = await storage.checkHabit(paramId(req), userId, date);
      if (log.completed) {
        const habit = (await storage.getHabits(userId)).find(h => h.id === paramId(req));
        if (habit) {
          saveEventToMemory(userId, `Compromisso "${habit.name}" registrado — streak atual: ${habit.streak} dias`).catch(() => {});
          adjustDisciplinePoints(userId, DISCIPLINE_POINTS.HABIT_CHECK, `⚡ Compromisso "${habit.name}" feito — +${DISCIPLINE_POINTS.HABIT_CHECK} pts`).catch(() => {});
        }
      }
      res.json(log);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/habits/:id/cancel-today", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const habitId = paramId(req);
      const schema = z.object({
        date: z.string(),
        type: z.enum(["holiday", "medical", "other"]),
        reason: z.string().optional(),
      });
      const { date, type, reason } = schema.parse(req.body);

      const habits = await storage.getHabits(userId);
      const habit = habits.find(h => h.id === habitId);
      if (!habit) return res.status(404).json({ message: "Hábito não encontrado" });

      const cancellation = await storage.createScheduleCancellation({ userId, habitId, entityType: "habit", date, reason, type });

      let delta = 0;
      let disciplineMsg = "";
      if (type === "holiday") {
        delta = 0;
        disciplineMsg = `🏖️ Feriado — "${habit.name}" sem penalidade`;
      } else if (type === "medical") {
        delta = -1;
        disciplineMsg = `🏥 Atestado — "${habit.name}" justificativa aceita (${delta} pt)`;
      } else {
        delta = -3;
        disciplineMsg = `❌ Falta em "${habit.name}" sem justificativa (${delta} pts)`;
      }

      if (delta !== 0) {
        await adjustDisciplinePoints(userId, delta, disciplineMsg);
      }

      res.status(201).json({ cancellation, disciplineMsg });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/schedule/:id/postpone", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ newDateTime: z.string() });
      const { newDateTime } = schema.parse(req.body);

      const newStart = new Date(newDateTime);
      const item = await storage.updateScheduleItem(paramId(req), userId, { startTime: newStart, status: "pending" });
      if (!item) return res.status(404).json({ message: "Compromisso não encontrado" });

      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/habits/:id/logs", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getHabitLogs(paramId(req), getUserId(req)));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/chat/messages", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      res.json(await storage.getChatMessages(getUserId(req), limit));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/chat/messages", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteChatMessages(getUserId(req));
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  function buildActionSummary(type: string, data: any): string {
    const priorityLabel: Record<string, string> = { high: "alta", medium: "média", low: "baixa" };
    switch (type) {
      case "expense":
        return `💸 Gasto: R$${Number(data.amount).toFixed(2)} em "${data.description}"${data.categoryName ? ` (${data.categoryName})` : ""}${data.date && data.date !== new Date().toISOString().split("T")[0] ? ` — ${new Date(data.date).toLocaleDateString("pt-BR")}` : ""}`;
      case "income":
        return `💰 Receita: R$${Number(data.amount).toFixed(2)} de "${data.description}"${data.categoryName ? ` (${data.categoryName})` : ""}`;
      case "task":
        return `📋 Tarefa: "${data.title}", prioridade ${priorityLabel[data.priority] || "média"}${data.dueDate ? `, vence ${new Date(data.dueDate).toLocaleDateString("pt-BR")}` : ""}${data.category ? `, categoria: ${data.category}` : ""}`;
      case "schedule":
        return `📅 Agendamento: "${data.title}", ${data.startTime ? new Date(data.startTime).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}${data.endTime ? ` até ${new Date(data.endTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}`;
      case "habit":
        return `⚡ Compromisso: "${data.name}", ${data.frequency === "weekly" ? "semanal" : "diário"}`;
      default:
        return "Ação detectada";
    }
  }

  app.post("/api/chat", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { message } = req.body;
      if (!message) return res.status(400).json({ message: "Mensagem vazia" });

      await storage.createChatMessage({ userId, role: "user", content: message });

      const pendingBill = pendingChatBills.get(userId);
      if (pendingBill && Date.now() < pendingBill.expiresAt) {
        const answer = message.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const ext = pendingBill.extracted;
        const name1 = (ext.issuer || "").toLowerCase();
        const name2 = (ext.recipient || "").toLowerCase();
        let chosenName: string | null = null;
        let chosenCnpj: string | null = null;
        let billType: "income" | "expense" = "expense";

        const answerDigits = answer.replace(/[^0-9]/g, "");
        const normCnpj = (c: string) => (c || "").replace(/[^0-9]/g, "");
        const cnpj1 = normCnpj(ext.issuerCnpj);
        const cnpj2 = normCnpj(ext.recipientCnpj);

        if (answer === "1" || (name1.length > 5 && answer.includes(name1.substring(0, 8))) || (answerDigits.length >= 11 && answerDigits === cnpj1)) {
          chosenName = ext.issuer; chosenCnpj = ext.issuerCnpj;
          billType = "income";
        } else if (answer === "2" || (name2.length > 5 && answer.includes(name2.substring(0, 8))) || (answerDigits.length >= 11 && answerDigits === cnpj2)) {
          chosenName = ext.recipient; chosenCnpj = ext.recipientCnpj;
          billType = "expense";
        }

        if (chosenName && chosenCnpj) {
          pendingChatBills.delete(userId);
          await saveUserIdentityEntity(userId, chosenName, chosenCnpj);

          const notesParts: string[] = [];
          if (ext.description) notesParts.push(`Descrição: ${ext.description}`);
          if (ext.issuer) notesParts.push(`Emissor: ${ext.issuer}${ext.issuerCnpj ? ` (${ext.issuerCnpj})` : ""}`);
          if (ext.recipient) notesParts.push(`Destinatário: ${ext.recipient}${ext.recipientCnpj ? ` (${ext.recipientCnpj})` : ""}`);
          if (ext.paymentInfo) notesParts.push(`Pagamento: ${ext.paymentInfo}`);
          const composedNotes = notesParts.length > 0 ? notesParts.join("\n") : null;

          const bill = await storage.createBill({
            userId,
            title: ext.title || "Conta importada",
            amount: Number(ext.amount) || 0,
            type: billType,
            dueDay: Number(ext.dueDay) || new Date().getDate(),
            categoryName: ext.categoryName || "outros",
            recurrenceType: "this_month",
            active: true,
            paidMonths: "[]",
            notes: composedNotes,
          });
          const typeLabel = billType === "income" ? "A receber" : "A pagar";
          const reply = `Entendi! Salvei que você é *${chosenName}*. Nas próximas notas com esse CNPJ, vou saber automaticamente.\n\n📋 *Conta registrada!*\n*${bill.title}*\n${typeLabel}: R$ ${Number(bill.amount).toFixed(2)}\n📅 Vence dia ${bill.dueDay}\n\nVeja em Contas no app.`;
          await storage.createChatMessage({ userId, role: "assistant", content: reply });
          return res.json({ response: reply });
        }
      } else if (pendingBill) {
        pendingChatBills.delete(userId);
      }

      try {
        const intentResult = await detectIntentAndProcess(message, userId);

        if (intentResult.intent === "bill") {
          // Create bill directly — no confirmation needed
          const d = intentResult.data;
          const billType = d.type === "income" ? "income" : "expense";
          const newBill = await storage.createBill({
            userId,
            title: (d.title || "Conta fixa").trim(),
            amount: Number(d.amount) || 0,
            type: billType,
            dueDay: Number(d.dueDay) || 5,
            categoryName: d.categoryName || null,
            recurrenceType: ["permanent", "three_months", "this_month"].includes(d.recurrenceType) ? d.recurrenceType : "permanent",
            active: true,
            paidMonths: "[]",
            notes: null,
          });
          const typeLabel = billType === "income" ? "💰 A receber" : "💸 A pagar";
          const recLabel: Record<string, string> = { permanent: "todo mês, permanente", three_months: "próximos 3 meses", this_month: "só este mês" };
          const reply = `📋 *Conta fixa cadastrada!*\n*${newBill.title}*\n${typeLabel}: R$ ${Number(newBill.amount).toFixed(2)}\n📅 Vence dia ${newBill.dueDay}${newBill.categoryName ? `\n🏷 ${newBill.categoryName}` : ""}\n🔁 Recorrência: ${recLabel[newBill.recurrenceType as string] || "permanente"}\n\nAparece em *Finanças → Contas* no app.`;
          await storage.createChatMessage({ userId, role: "user", content: message });
          await storage.createChatMessage({ userId, role: "assistant", content: reply });
          return res.json({ response: reply });
        }

        if (intentResult.intent !== "chat" && intentResult.intent !== "unknown") {
          const summary = buildActionSummary(intentResult.intent, intentResult.data);
          const confirmationMsg = `${summary} — confirma?`;
          await storage.createChatMessage({ userId, role: "assistant", content: confirmationMsg });
          return res.json({
            response: confirmationMsg,
            pendingAction: { type: intentResult.intent, data: intentResult.data },
          });
        }
      } catch (intentErr) {
        // Intent detection failed — fall through to normal chat
      }

      const rawResponse = await chatWithContext(message, userId);

      // Parse [AXIS_ACTION] blocks — schedule creation triggered by AI
      const actionMatch = rawResponse.match(/\[AXIS_ACTION\]([\s\S]*?)\[\/AXIS_ACTION\]/);
      const cleanResponse = rawResponse.replace(/\[AXIS_ACTION\][\s\S]*?\[\/AXIS_ACTION\]/g, "").trim();

      let scheduledCreated = false;

      if (actionMatch) {
        try {
          const actionRaw = actionMatch[1].trim();
          console.log("[chat] AXIS_ACTION raw:", actionRaw);
          const action = JSON.parse(actionRaw);
          if (action.type === "create_schedule" && action.title && action.time) {
            const days: number[] = Array.isArray(action.days) && action.days.length > 0
              ? action.days
              : (typeof action.day === "number" ? [action.day] : []);
            if (days.length === 0) {
              console.warn("[chat] AXIS_ACTION missing days/day field, skipping to fallback");
            } else {
              const [h, m] = (action.time as string).split(":").map(Number);
              const durationMs = (action.durationMinutes || 60) * 60 * 1000;
              const weeks = Math.min(action.weeks || 8, 52);
              const now = new Date();
              const created: any[] = [];

              for (let w = 0; w < weeks; w++) {
                for (const dow of days) {
                  const dt = new Date(now);
                  const dayDiff = ((dow - dt.getDay()) + 7) % 7 || 7;
                  dt.setDate(dt.getDate() + dayDiff + w * 7);
                  dt.setHours(h, m, 0, 0);
                  const end = new Date(dt.getTime() + durationMs);
                  created.push(
                    await storage.createScheduleItem({
                      userId,
                      title: action.title,
                      description: null,
                      startTime: dt,
                      endTime: end,
                      suggestedByAi: true,
                    })
                  );
                }
              }

              if (created.length > 0) {
                scheduledCreated = true;
                console.log(`[chat] Created ${created.length} schedule items for "${action.title}"`);
                saveEventToMemory(userId, `AXIS criou ${created.length} compromisso(s) "${action.title}" no calendário via chat assistido.`).catch(() => {});
              }
            }
          } else {
            console.warn("[chat] AXIS_ACTION parsed but missing required fields:", JSON.stringify(action));
          }
        } catch (actionErr: any) {
          console.error("[chat] Failed to parse/execute AXIS_ACTION:", actionErr.message, "raw:", actionMatch[1]?.trim());
        }
      }

      if (!scheduledCreated && /(?:criei|agendei|marquei|adicionei).*(?:compromisso|evento|agenda)/i.test(cleanResponse)) {
        try {
          const recentMsgs = await storage.getChatMessages(userId);
          const last10 = recentMsgs.slice(-10).map(m => `${m.role}: ${m.content}`).join("\n");
          const conversationContext = `${last10}\nassistant: ${cleanResponse}`;

          const openai = getOpenAIClient();
          const extractRes = await openai.chat.completions.create({
            model: "gpt-5-mini",
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: `Extraia os dados do compromisso mencionado nesta conversa. Hoje é ${new Date().toISOString().split("T")[0]}.

Responda em JSON:
{
  "title": "título do compromisso",
  "days": [4],
  "time": "20:30",
  "durationMinutes": 60,
  "weeks": 8,
  "recurring": true
}

"days" = array de dias da semana (0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sáb).
Se não for recorrente, defina "recurring": false e "weeks": 1.
Se algum dado não foi mencionado, use valores razoáveis.`
              },
              { role: "user", content: conversationContext }
            ],
          });

          const extracted = JSON.parse(extractRes.choices[0]?.message?.content || "{}");
          if (extracted.title && extracted.time) {
            const days: number[] = Array.isArray(extracted.days) ? extracted.days : [4];
            const [h, m] = (extracted.time as string).split(":").map(Number);
            const durationMs = (extracted.durationMinutes || 60) * 60 * 1000;
            const weeks = Math.min(extracted.weeks || 8, 52);
            const now = new Date();
            const created: any[] = [];

            for (let w = 0; w < weeks; w++) {
              for (const dow of days) {
                const dt = new Date(now);
                const dayDiff = ((dow - dt.getDay()) + 7) % 7 || 7;
                dt.setDate(dt.getDate() + dayDiff + w * 7);
                dt.setHours(h, m, 0, 0);
                const end = new Date(dt.getTime() + durationMs);
                created.push(
                  await storage.createScheduleItem({
                    userId,
                    title: extracted.title,
                    description: null,
                    startTime: dt,
                    endTime: end,
                    suggestedByAi: true,
                  })
                );
              }
            }

            console.log(`[chat] Fallback: created ${created.length} schedule items for "${extracted.title}"`);
            saveEventToMemory(userId, `AXIS criou ${created.length} compromisso(s) "${extracted.title}" no calendário via fallback.`).catch(() => {});
            scheduledCreated = true;
          }
        } catch (fallbackErr: any) {
          console.error("[chat] Fallback schedule creation failed:", fallbackErr.message);
        }
      }

      await storage.createChatMessage({ userId, role: "assistant", content: cleanResponse });
      extractMemoryFromChat(userId, message, cleanResponse).catch(() => {});

      res.json({ response: cleanResponse, scheduledItems: scheduledCreated ? true : undefined });
    } catch (error: any) {
      console.error("Error in chat:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/confirm-action", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { type, data } = req.body;
      if (!type || !data) return res.status(400).json({ message: "Dados inválidos" });

      let summary = "";
      switch (type) {
        case "expense":
        case "income": {
          if (data.creditCardId && data.installments && data.installments > 1) {
            const card = await storage.getCreditCard(data.creditCardId, userId);
            if (card) {
              const groupId = crypto.randomUUID();
              const baseDate = data.date ? new Date(data.date) : new Date();
              const installAmt = Math.round((data.amount / data.installments) * 100) / 100;
              const purchaseDay = baseDate.getDate();
              const afterClosing = purchaseDay >= card.closingDay;
              const txList = Array.from({ length: data.installments }, (_: unknown, i: number) => {
                const offset = afterClosing ? i + 1 : i;
                return {
                  userId,
                  amount: installAmt,
                  description: `${data.description} (${i + 1}/${data.installments})`,
                  categoryName: data.categoryName || null,
                  type: "expense" as const,
                  date: new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1),
                  source: "chat" as string,
                  establishment: data.establishment || null,
                  location: null,
                  creditCardId: data.creditCardId,
                  installmentInfo: JSON.stringify({ current: i + 1, total: data.installments, groupId }),
                };
              });
              await storage.createManyTransactions(txList);
              summary = `Pronto! ${data.installments}x de R$${installAmt.toFixed(2)} no ${card.name} registrado.`;
              saveEventToMemory(userId, `Chat confirmado: parcelado ${data.installments}x R$${installAmt} "${data.description}" no ${card.name}`).catch(() => {});
              break;
            }
          }
          await storage.createTransaction({
            userId,
            amount: data.amount,
            description: data.description,
            categoryName: data.categoryName || null,
            type,
            date: data.date ? new Date(data.date) : new Date(),
            source: "chat",
            establishment: data.establishment || null,
            location: null,
            creditCardId: data.creditCardId || null,
            installmentInfo: null,
          });
          const label = type === "expense" ? "gasto" : "receita";
          const cardSuffix = data.creditCardId ? ` no cartão` : "";
          summary = `Pronto! ${label} de R$${Number(data.amount).toFixed(2)} registrado${cardSuffix}.`;
          saveEventToMemory(userId, `Chat confirmado: ${label} R$${data.amount} "${data.description}"`).catch(() => {});
          break;
        }
        case "task": {
          const task = await storage.createPersonalTask({
            userId,
            title: data.title,
            description: data.description || null,
            priority: data.priority || "medium",
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            category: data.category || null,
          });
          summary = `Pronto! Tarefa "${task.title}" criada.`;
          saveEventToMemory(userId, `Chat confirmado: tarefa criada "${task.title}"`).catch(() => {});
          break;
        }
        case "schedule": {
          const item = await storage.createScheduleItem({
            userId,
            title: data.title,
            description: data.description || null,
            startTime: new Date(data.startTime),
            endTime: data.endTime ? new Date(data.endTime) : null,
            suggestedByAi: true,
          });
          summary = `Pronto! "${item.title}" agendado.`;
          saveEventToMemory(userId, `Chat confirmado: compromisso "${item.title}"`).catch(() => {});
          break;
        }
        case "habit": {
          const habit = await storage.createHabit({
            userId,
            name: data.name,
            frequency: data.frequency || "daily",
          });
          summary = `Pronto! Compromisso "${habit.name}" criado.`;
          saveEventToMemory(userId, `Chat confirmado: compromisso "${habit.name}"`).catch(() => {});
          break;
        }
        default:
          return res.status(400).json({ message: "Tipo de ação desconhecido" });
      }

      await storage.createChatMessage({ userId, role: "assistant", content: summary });
      res.json({ response: summary, actionExecuted: type });
    } catch (error: any) {
      console.error("Error confirming action:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/chat/cancel-action", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const cancelMsg = "Ok, cancelado. Quer ajustar algo?";
      await storage.createChatMessage({ userId, role: "assistant", content: cancelMsg });
      res.json({ response: cancelMsg });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  function isBillActiveThisMonthServer(bill: any): boolean {
    if (!bill.active) return false;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const created = new Date(bill.createdAt);
    const createdY = created.getFullYear();
    const createdM = created.getMonth();
    if (y < createdY || (y === createdY && m < createdM)) return false;
    if (bill.recurrenceType === "permanent") return true;
    if (bill.recurrenceType === "this_month") return y === createdY && m === createdM;
    if (bill.recurrenceType === "three_months") {
      const endDate = new Date(createdY, createdM + 3, 1);
      return new Date(y, m, 1) <= endDate;
    }
    if (bill.recurrenceType === "custom" && bill.recurrenceEndDate) {
      return new Date(y, m, 1) <= new Date(bill.recurrenceEndDate);
    }
    return false;
  }


  async function processRecurringIncomes(userId: string): Promise<void> {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const incomes = await storage.getRecurringIncomes(userId);
    for (const income of incomes) {
      if (!income.active) continue;
      if (income.lastPostedMonth === currentMonth) continue;
      if (currentDay < income.dayOfMonth) continue;
      await storage.createTransaction({
        userId,
        amount: income.amount,
        description: income.name,
        categoryName: income.categoryName || "trabalho",
        type: "income",
        source: "auto",
        date: now,
      });
      await storage.updateRecurringIncome(income.id, userId, { lastPostedMonth: currentMonth });
    }
  }

  app.get("/api/recurring-incomes", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const items = await storage.getRecurringIncomes(userId);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar rendas" });
    }
  });

  app.post("/api/recurring-incomes", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { insertRecurringIncomeSchema } = await import("@shared/schema");
      const data = insertRecurringIncomeSchema.parse({ ...req.body, userId });
      const item = await storage.createRecurringIncome(data);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.patch("/api/recurring-incomes/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const item = await storage.updateRecurringIncome(paramId(req), userId, req.body);
      if (!item) return res.status(404).json({ message: "Não encontrado" });
      res.json(item);
    } catch (err: any) {
      res.status(400).json({ message: err.message });
    }
  });

  app.delete("/api/recurring-incomes/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteRecurringIncome(paramId(req), userId);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ message: "Erro ao deletar renda" });
    }
  });

  app.get("/api/discipline/history", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const raw = await storage.getDisciplineHistory(userId, 20);
      const entries = raw.map(e => ({
        ...e,
        reasons: (() => { try { return JSON.parse(e.reasons); } catch { return []; } })(),
      }));
      res.json(entries);
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar histórico" });
    }
  });

  app.get("/api/dashboard", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      const activeModules = user?.activeModules || [];

      const result: any = { activeModules, theme: user?.theme };

      if (activeModules.includes("finance") || activeModules.length === 0) {
        const [monthTx, allTx, profile, userCards] = await Promise.all([
          storage.getTransactions(userId, { startDate: startOfMonth, endDate: endOfDay }),
          storage.getTransactions(userId, { endDate: endOfDay }),
          storage.getUserProfile(userId),
          storage.getCreditCards(userId),
        ]);
        const totalExpenses = monthTx.filter(t => t.type === "expense" && !t.creditCardId).reduce((s, t) => s + Number(t.amount), 0);
        const totalIncome = monthTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
        const allExpenses = allTx.filter(t => t.type === "expense" && !t.creditCardId).reduce((s, t) => s + Number(t.amount), 0);
        const allIncome = allTx.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
        const initialBalance = profile?.initialBalance ?? 0;
        const cardSummary = await Promise.all(userCards.filter(c => c.active).map(async (card) => {
          const cardTxMonth = monthTx.filter(t => t.creditCardId === card.id && t.type === "expense");
          const usedThisMonth = cardTxMonth.reduce((s, t) => s + Number(t.amount), 0);
          return { id: card.id, name: card.name, bank: card.bank, limit: card.limit, usedThisMonth, color: card.color };
        }));
        result.finance = { totalExpenses, totalIncome, balance: initialBalance + allIncome - allExpenses, initialBalance, transactionCount: allTx.length, cardSummary };
        result.goals = await storage.getFinancialGoals(userId);
      }

      if (activeModules.includes("schedule") || activeModules.length === 0) {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        result.schedule = await storage.getScheduleItems(userId, { startDate: todayStart, endDate: todayEnd });
      }

      if (activeModules.includes("tasks") || activeModules.length === 0) {
        const allTasks = await storage.getPersonalTasks(userId);
        result.tasks = { pending: allTasks.filter(t => t.status === "pending").length, total: allTasks.length, urgent: allTasks.filter(t => t.status === "pending" && t.priority === "high").slice(0, 3) };
      }

      if (activeModules.includes("habits") || activeModules.length === 0) {
        result.habits = await storage.getHabits(userId);
      }

      // Fire-and-forget: process recurring incomes + income-type bills + alerts
      autoCloseInvoices(userId).catch(() => {});
      processRecurringIncomes(userId).catch(() => {});
      updateLastLogin(userId).catch(() => {});
      checkAndSendBillAlerts(userId).catch(() => {});
      checkAndSendOverdueTaskAlerts(userId).catch(() => {});
      checkAndSendGoalDeadlineAlerts(userId).catch(() => {});
      checkAndSendLowDisciplineAlert(userId).catch(() => {});

      penalizeOverdueTasks(userId).catch(() => {});
      penalizeMissedHabits(userId).catch(() => {});
      analyzeSpendingForDiscipline(userId).catch(() => {});
      const profile = await storage.getUserProfile(userId);
      result.disciplineScore = profile?.disciplineScore || 5;
      result.disciplinePoints = profile?.disciplinePoints ?? 0;
      result.userName = user?.firstName || "";

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/onboarding", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { profile: profileData, activeModules, theme, aiPersonality } = req.body;

      if (profileData) {
        await storage.upsertUserProfile(userId, profileData);
      }

      const updateData: any = { onboardingCompleted: true, updatedAt: new Date() };
      if (activeModules) updateData.activeModules = activeModules;
      if (theme) updateData.theme = theme;
      if (aiPersonality) updateData.aiPersonality = aiPersonality;
      if (profileData?.firstName) updateData.firstName = profileData.firstName;

      await db.update(users).set(updateData).where(eq(users.id, userId));

      let diagnosis = null;
      if (profileData) {
        const [diagnosisResult, deepResult] = await Promise.allSettled([
          generateOnboardingDiagnosis(profileData),
          deepAnalyzeOnboarding(profileData),
        ]);

        if (diagnosisResult.status === "fulfilled") {
          diagnosis = diagnosisResult.value;
          await storage.upsertUserContext(userId, "ai_diagnosis", diagnosis);
        } else {
          console.error("Error generating diagnosis:", diagnosisResult.reason);
        }

        if (deepResult.status === "fulfilled") {
          const deep = deepResult.value;

          const memoryOps: Promise<any>[] = [];

          if (deep.mainChallengeAnalysis) {
            memoryOps.push(storage.upsertUserContext(userId, "desafio_principal", deep.mainChallengeAnalysis));
          }
          if (deep.goalsBreakdown) {
            memoryOps.push(storage.upsertUserContext(userId, "metas_extraidas", deep.goalsBreakdown));
          }
          if (deep.userPersonalityInsight) {
            memoryOps.push(storage.upsertUserContext(userId, "insight_personalidade", deep.userPersonalityInsight));
          }
          if (deep.keyMemoryNotes && deep.keyMemoryNotes.length > 0) {
            memoryOps.push(storage.upsertUserContext(userId, "notas", deep.keyMemoryNotes.join(" | ")));
          }
          if (deep.financialGoalAmount && deep.financialGoalAmount > 0) {
            memoryOps.push(
              storage.createFinancialGoal({
                userId,
                title: deep.financialGoalTitle || "Meta financeira",
                targetAmount: deep.financialGoalAmount,
                deadline: null,
              })
            );
          }
          if (deep.suggestedFirstTask) {
            memoryOps.push(
              storage.createPersonalTask({
                userId,
                title: deep.suggestedFirstTask,
                description: "Sugerido pelo AXIS com base no seu perfil.",
                priority: "high",
                status: "pending",
                dueDate: null,
                category: null,
              })
            );
          }
          if (deep.suggestedFirstHabit) {
            memoryOps.push(
              storage.createHabit({
                userId,
                name: deep.suggestedFirstHabit,
                frequency: "daily",
              })
            );
          }

          await Promise.allSettled(memoryOps);
        } else {
          console.error("Error in deep analysis:", deepResult.reason);
        }
      }

      res.json({ success: true, diagnosis });
    } catch (error: any) {
      console.error("Error in onboarding:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/onboarding/setup", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        currentIncome: z.number().positive().optional().nullable(),
        fixedExpenses: z.string().optional().nullable(),
        routine: z.string().optional().nullable(),
        firstName: z.string().optional().nullable(),
      });
      const data = schema.parse(req.body);

      let expensesCreated = 0;
      let scheduleCreated = 0;
      const ops: Promise<any>[] = [];

      if (data.currentIncome && data.currentIncome > 0) {
        ops.push(storage.upsertUserContext(userId, "renda_atual", String(data.currentIncome)));
        ops.push(storage.upsertUserContext(userId, "renda_mensal_ref", `Renda mensal de referência: R$${data.currentIncome}`));
      }

      if (data.fixedExpenses && data.fixedExpenses.trim()) {
        ops.push(storage.upsertUserContext(userId, "gastos_fixos_raw", data.fixedExpenses));
        const parsed = await parseFixedExpenses(data.fixedExpenses);
        if (parsed.length > 0) {
          const total = parsed.reduce((s, i) => s + i.amount, 0);
          ops.push(storage.upsertUserContext(userId, "gastos_fixos_total", `Total de gastos fixos mensais: R$${total} (${parsed.map(i => `${i.description} R$${i.amount}`).join(", ")})`));
          for (const item of parsed) {
            ops.push(
              storage.createBill({
                userId,
                title: item.description,
                amount: item.amount,
                type: "expense",
                dueDay: 5,
                recurrenceType: "permanent",
                categoryName: item.category,
                notes: null,
                active: true,
                paidMonths: "[]",
              })
            );
            expensesCreated++;
          }
        }
      }

      if (data.routine && data.routine.trim()) {
        ops.push(storage.upsertUserContext(userId, "rotina_usuario", data.routine));
        const parsedRoutine = await parseRoutineToSchedule(data.routine);
        const today = new Date();
        for (const item of parsedRoutine) {
          let occurrences = 0;
          for (let dayOffset = 0; dayOffset < 30 && occurrences < 4; dayOffset++) {
            const d = new Date(today);
            d.setDate(today.getDate() + dayOffset);
            if (item.dayOfWeek.includes(d.getDay())) {
              const startTime = new Date(d);
              startTime.setHours(item.startHour, item.startMinute, 0, 0);
              const endTime = new Date(startTime.getTime() + item.durationMinutes * 60 * 1000);
              ops.push(
                storage.createScheduleItem({
                  userId,
                  title: item.title,
                  description: "Rotina cadastrada pelo AXIS",
                  startTime,
                  endTime,
                  suggestedByAi: true,
                })
              );
              scheduleCreated++;
              occurrences++;
            }
          }
        }
      }

      await Promise.allSettled(ops);

      const memorySummary = [
        data.currentIncome ? `renda R$${data.currentIncome}` : null,
        expensesCreated > 0 ? `${expensesCreated} gastos fixos cadastrados` : null,
        scheduleCreated > 0 ? `${scheduleCreated} itens de agenda criados da rotina` : null,
      ].filter(Boolean).join(", ");

      if (memorySummary) {
        saveEventToMemory(userId, `Setup pós-onboarding concluído: ${memorySummary}`).catch(() => {});
      }

      await storage.upsertUserContext(userId, "setup_completed", "true");

      res.json({ success: true, expensesCreated, scheduleCreated });
    } catch (error: any) {
      console.error("Error in onboarding setup:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/onboarding/setup/status", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const [context, recurringIncomes] = await Promise.all([
        storage.getUserContext(userId),
        storage.getRecurringIncomes(userId),
      ]);
      const incomeContext = context.find(c => c.key === "renda_atual");
      const hasIncome = recurringIncomes.length > 0 || (incomeContext && parseFloat(incomeContext.value) > 0);
      const completed = hasIncome === true;
      res.json({ completed });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ==================== REPORTS ====================

  app.get("/api/reports/finance", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const now = new Date();

      // Parse optional filter params
      const { startDate: startParam, endDate: endParam } = req.query as { startDate?: string; endDate?: string };

      let periodStart: Date;
      let periodEnd: Date;

      if (startParam && endParam) {
        periodStart = new Date(startParam);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd = new Date(endParam);
        periodEnd.setHours(23, 59, 59, 999);
      } else {
        periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      }

      // Previous period: same duration immediately before periodStart
      const periodMs = periodEnd.getTime() - periodStart.getTime();
      const prevPeriodEnd = new Date(periodStart.getTime() - 1);
      prevPeriodEnd.setHours(23, 59, 59, 999);
      const prevPeriodStart = new Date(prevPeriodEnd.getTime() - periodMs);
      prevPeriodStart.setHours(0, 0, 0, 0);

      // 6 months ago for trend chart
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      // Fetch from earliest needed date
      const fetchFrom = prevPeriodStart < sixMonthsAgo ? prevPeriodStart : sixMonthsAgo;

      const [allTx, goals] = await Promise.all([
        storage.getTransactions(userId, { startDate: fetchFrom }),
        storage.getFinancialGoals(userId),
      ]);

      // Accumulators for 6-month chart
      const monthlyMap: Record<string, { income: number; expenses: number }> = {};

      // Selected period accumulators
      let selIncome = 0;
      let selExpenses = 0;
      const selCatMap: Record<string, { amount: number; count: number }> = {};
      const selDailyMap: Record<string, number> = {}; // ISO date key → expenses

      // Previous period accumulators
      let prevIncome = 0;
      let prevExpenses = 0;

      // Selected period detail maps (for payment, establishment, hour)
      const establishmentMap: Record<string, { amount: number; count: number }> = {};
      const hourMap: Record<number, { amount: number; count: number }> = {};
      const paymentMap: Record<string, { amount: number; count: number }> = {};

      for (const tx of allTx) {
        const d = new Date(tx.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0 };
        const amt = Number(tx.amount);
        const inPeriod = d >= periodStart && d <= periodEnd;
        const inPrev = d >= prevPeriodStart && d <= prevPeriodEnd;

        if (tx.type === "income") {
          monthlyMap[key].income += amt;
          if (inPeriod) selIncome += amt;
          if (inPrev) prevIncome += amt;
        } else {
          monthlyMap[key].expenses += amt;
          if (inPeriod) {
            selExpenses += amt;
            const cat = tx.categoryName || "Sem categoria";
            if (!selCatMap[cat]) selCatMap[cat] = { amount: 0, count: 0 };
            selCatMap[cat].amount += amt;
            selCatMap[cat].count++;
            const dayKey = d.toISOString().slice(0, 10);
            selDailyMap[dayKey] = (selDailyMap[dayKey] || 0) + amt;
            // Establishment — limpa prefixo [bill:uuid] de transações de contas fixas
            const rawDesc = (tx.description || "").replace(/^\[bill:[^\]]+\]\s*/, "").trim();
            const place = tx.establishment || rawDesc || "Não identificado";
            if (!establishmentMap[place]) establishmentMap[place] = { amount: 0, count: 0 };
            establishmentMap[place].amount += amt;
            establishmentMap[place].count++;
            // Hour — só transações com horário real (dateOnly = false)
            if (!tx.dateOnly) {
              const hour = d.getHours();
              if (!hourMap[hour]) hourMap[hour] = { amount: 0, count: 0 };
              hourMap[hour].amount += amt;
              hourMap[hour].count++;
            }
            // Payment method
            const pm = tx.paymentMethod || "Não informado";
            if (!paymentMap[pm]) paymentMap[pm] = { amount: 0, count: 0 };
            paymentMap[pm].amount += amt;
            paymentMap[pm].count++;
          }
          if (inPrev) prevExpenses += amt;
        }
      }

      // 6-month trend chart
      const monthly = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
        const m = monthlyMap[key] || { income: 0, expenses: 0 };
        monthly.push({ month: label, income: m.income, expenses: m.expenses, balance: m.income - m.expenses });
      }

      // Build daily/weekly chart for selected period
      const rangeDays = Math.ceil(periodMs / (1000 * 60 * 60 * 24)) + 1;
      const groupByWeek = rangeDays > 45;
      const dailyThisMonth: { day: string | number; expenses: number }[] = [];

      if (groupByWeek) {
        // Group by ISO week
        const weekMap: Record<string, number> = {};
        for (const [isoDate, amt] of Object.entries(selDailyMap)) {
          const d = new Date(isoDate);
          const week = getISOWeekLabel(d);
          weekMap[week] = (weekMap[week] || 0) + amt;
        }
        // Fill all weeks in range
        let cur = new Date(periodStart);
        cur.setDate(cur.getDate() - cur.getDay() + 1); // Monday
        while (cur <= periodEnd) {
          const label = getISOWeekLabel(cur);
          if (!dailyThisMonth.find(x => x.day === label)) {
            dailyThisMonth.push({ day: label, expenses: Number((weekMap[label] || 0).toFixed(2)) });
          }
          cur.setDate(cur.getDate() + 7);
        }
      } else {
        // Day by day
        const cur = new Date(periodStart);
        while (cur <= periodEnd) {
          const isoDate = cur.toISOString().slice(0, 10);
          dailyThisMonth.push({ day: cur.getDate(), expenses: Number((selDailyMap[isoDate] || 0).toFixed(2)) });
          cur.setDate(cur.getDate() + 1);
        }
      }

      // Period label for frontend
      const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "2-digit" });
      const isSingleMonth = periodStart.getMonth() === periodEnd.getMonth() && periodStart.getFullYear() === periodEnd.getFullYear()
        && periodStart.getDate() === 1 && periodEnd.getDate() === new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0).getDate();
      const periodLabel = isSingleMonth
        ? periodStart.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
        : `${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`;

      // Selected period categories
      const byCategory = Object.entries(selCatMap)
        .map(([name, d]) => ({ name, amount: d.amount, count: d.count, pct: selExpenses > 0 ? Math.round((d.amount / selExpenses) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);

      // Current month by category (alias for compatibility)
      const currentMonthByCategory = Object.entries(selCatMap)
        .map(([name, d]) => ({ name, amount: d.amount, count: d.count, pct: selExpenses > 0 ? Math.round((d.amount / selExpenses) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);

      // Period-over-period trends
      const expenseTrend = prevExpenses > 0 ? Math.round(((selExpenses - prevExpenses) / prevExpenses) * 100) : null;
      const incomeTrend = prevIncome > 0 ? Math.round(((selIncome - prevIncome) / prevIncome) * 100) : null;

      const selBalance = selIncome - selExpenses;
      const selSavingsRate = selIncome > 0 ? Math.round((selBalance / selIncome) * 100) : 0;
      const topCategory = byCategory[0]?.name || "N/A";

      // Payment method breakdown
      const PM_LABELS: Record<string, string> = { debit: "Débito", credit: "Crédito", pix: "Pix", cash: "Dinheiro", other: "Outro" };
      const byPaymentMethod = Object.entries(paymentMap)
        .map(([key, d]) => ({ key, label: PM_LABELS[key] || key, amount: Number(d.amount.toFixed(2)), count: d.count, pct: selExpenses > 0 ? Math.round((d.amount / selExpenses) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount);

      // Top establishments (selected period)
      const byEstablishment = Object.entries(establishmentMap)
        .map(([name, d]) => ({ name, amount: Number(d.amount.toFixed(2)), count: d.count, pct: selExpenses > 0 ? Math.round((d.amount / selExpenses) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);

      // Spending by hour → group into time periods
      const timePeriods = [
        { label: "Madrugada", emoji: "🌙", range: [0, 5], amount: 0, count: 0 },
        { label: "Manhã", emoji: "🌅", range: [6, 11], amount: 0, count: 0 },
        { label: "Tarde", emoji: "☀️", range: [12, 17], amount: 0, count: 0 },
        { label: "Noite", emoji: "🌆", range: [18, 23], amount: 0, count: 0 },
      ];
      for (const [h, d] of Object.entries(hourMap)) {
        const hour = Number(h);
        for (const period of timePeriods) {
          if (hour >= period.range[0] && hour <= period.range[1]) {
            period.amount += d.amount;
            period.count += d.count;
          }
        }
      }
      // Hour chart (0-23 buckets, labeled)
      const byHour = Array.from({ length: 24 }, (_, h) => ({
        hour: `${String(h).padStart(2, "0")}h`,
        amount: Number((hourMap[h]?.amount || 0).toFixed(2)),
        count: hourMap[h]?.count || 0,
      }));
      const peakHour = byHour.reduce((best, h) => h.amount > best.amount ? h : best, byHour[0]);

      const byTimePeriod = timePeriods.map(p => ({
        label: p.label,
        emoji: p.emoji,
        amount: Number(p.amount.toFixed(2)),
        count: p.count,
        pct: selExpenses > 0 ? Math.round((p.amount / selExpenses) * 100) : 0,
      }));

      const recentTransactions = [...allTx]
        .filter(t => { const d = new Date(t.date); return d >= periodStart && d <= periodEnd; })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30);

      const selTxCount = allTx.filter(t => { const d = new Date(t.date); return d >= periodStart && d <= periodEnd; }).length;

      const periodMonths = Math.max(1, Math.round(periodMs / (1000 * 60 * 60 * 24 * 30)));
      const avgMonthlyExpense = Math.round(selExpenses / periodMonths);

      res.json({
        summary: { totalIncome: selIncome, totalExpenses: selExpenses, balance: selBalance, savingsRate: selSavingsRate, topCategory, transactionCount: selTxCount, avgMonthlyExpense },
        currentMonth: { name: periodLabel, income: selIncome, expenses: selExpenses, balance: selBalance, savingsRate: selSavingsRate, transactionCount: selTxCount, expenseTrend, incomeTrend, topCategory: currentMonthByCategory[0]?.name || "N/A" },
        periodLabel,
        monthly,
        byCategory,
        currentMonthByCategory,
        dailyThisMonth,
        groupByWeek,
        byPaymentMethod,
        byEstablishment,
        byHour,
        byTimePeriod,
        peakHour: peakHour?.hour || "N/A",
        recentTransactions,
        goals,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/tasks", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tasks = await storage.getPersonalTasks(userId);
      const now = new Date();

      const total = tasks.length;
      const completed = tasks.filter(t => t.status === "completed").length;
      const pending = tasks.filter(t => t.status === "pending").length;
      const overdue = tasks.filter(t => t.status === "pending" && t.dueDate && new Date(t.dueDate) < now).length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      const byPriority = {
        high: { total: tasks.filter(t => t.priority === "high").length, completed: tasks.filter(t => t.priority === "high" && t.status === "completed").length },
        medium: { total: tasks.filter(t => t.priority === "medium").length, completed: tasks.filter(t => t.priority === "medium" && t.status === "completed").length },
        low: { total: tasks.filter(t => t.priority === "low").length, completed: tasks.filter(t => t.priority === "low" && t.status === "completed").length },
      };

      const catMap: Record<string, { count: number; completed: number }> = {};
      for (const task of tasks) {
        const cat = task.category || "Geral";
        if (!catMap[cat]) catMap[cat] = { count: 0, completed: 0 };
        catMap[cat].count++;
        if (task.status === "completed") catMap[cat].completed++;
      }
      const byCategory = Object.entries(catMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.count - a.count).slice(0, 6);
      const urgentPending = tasks.filter(t => t.priority === "high" && t.status === "pending").slice(0, 5);

      res.json({ summary: { total, completed, pending, overdue, completionRate }, byPriority, byCategory, urgentPending });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/habits", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const allHabits = await storage.getHabits(userId);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const globalDayMap: Record<number, number> = {};
      const habitsWithStats = await Promise.all(
        allHabits.map(async (habit) => {
          const logs = await storage.getHabitLogs(habit.id, userId);
          const recentLogs = logs.filter(l => new Date(l.date) >= thirtyDaysAgo);
          const totalCheckins = recentLogs.length;
          const expectedDays = habit.frequency === "daily" ? 30 : 4;
          const completionRate = expectedDays > 0 ? Math.min(100, Math.round((totalCheckins / expectedDays) * 100)) : 0;
          for (const log of recentLogs) {
            const day = new Date(log.date).getDay();
            globalDayMap[day] = (globalDayMap[day] || 0) + 1;
          }
          return { id: habit.id, name: habit.name, streak: habit.streak || 0, frequency: habit.frequency, totalCheckins, completionRate };
        })
      );

      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const weeklyConsistency = dayNames.map((day, i) => ({ day, completions: globalDayMap[i] || 0 }));

      const sorted = [...habitsWithStats].sort((a, b) => b.streak - a.streak);
      const avgStreak = allHabits.length > 0 ? Math.round(allHabits.reduce((s, h) => s + (h.streak || 0), 0) / allHabits.length) : 0;
      const bestHabit = sorted[0];
      const totalCheckinsMonth = habitsWithStats.reduce((s, h) => s + h.totalCheckins, 0);

      res.json({
        summary: { totalHabits: allHabits.length, avgStreak, bestStreak: bestHabit?.streak || 0, bestHabit: bestHabit?.name || "N/A", totalCheckinsMonth },
        habits: sorted,
        weeklyConsistency,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/reports/schedule", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const allItems = await storage.getScheduleItems(userId);
      const now = new Date();

      const total = allItems.length;
      const completed = allItems.filter(i => i.status === "completed").length;
      const pending = allItems.filter(i => i.status === "pending").length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const aiSuggested = allItems.filter(i => i.suggestedByAi).length;
      const manuallyAdded = total - aiSuggested;

      const withDuration = allItems.filter(i => i.endTime);
      const avgDurationMinutes = withDuration.length > 0
        ? Math.round(withDuration.reduce((s, i) => s + (new Date(i.endTime!).getTime() - new Date(i.startTime).getTime()) / 60000, 0) / withDuration.length)
        : 0;

      const dayMap: Record<number, { count: number; completed: number }> = {};
      for (const item of allItems) {
        const day = new Date(item.startTime).getDay();
        if (!dayMap[day]) dayMap[day] = { count: 0, completed: 0 };
        dayMap[day].count++;
        if (item.status === "completed") dayMap[day].completed++;
      }
      const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
      const byDayOfWeek = dayNames.map((day, i) => ({ day, count: dayMap[i]?.count || 0, completed: dayMap[i]?.completed || 0, pending: (dayMap[i]?.count || 0) - (dayMap[i]?.completed || 0) }));

      const upcoming = allItems.filter(i => new Date(i.startTime) > now && i.status === "pending").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).slice(0, 5);
      const overdue = allItems.filter(i => new Date(i.startTime) < now && i.status === "pending").sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()).slice(0, 5);

      res.json({ summary: { total, completed, pending, completionRate, aiSuggested, manuallyAdded, avgDurationMinutes }, byDayOfWeek, upcoming, overdue });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/bills", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const result = await storage.getBills(userId);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/bills", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        title: z.string().min(1),
        amount: z.number().positive(),
        type: z.enum(["expense", "income"]),
        dueDay: z.number().int().min(1).max(31).default(1),
        categoryName: z.string().optional(),
        recurrenceType: z.enum(["permanent", "this_month", "three_months", "custom"]).default("permanent"),
        recurrenceEndDate: z.string().optional().transform(v => v ? new Date(v) : undefined),
        notes: z.string().optional(),
      });
      const data = schema.parse(req.body);
      const bill = await storage.createBill({ ...data, userId, active: true, paidMonths: "[]" });
      res.json(bill);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/bills/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        title: z.string().optional(),
        amount: z.number().positive().optional(),
        type: z.enum(["expense", "income"]).optional(),
        dueDay: z.number().int().min(1).max(31).optional(),
        categoryName: z.string().optional().nullable(),
        recurrenceType: z.enum(["permanent", "this_month", "three_months", "custom"]).optional(),
        recurrenceEndDate: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
        active: z.boolean().optional(),
        paidMonths: z.string().optional(),
        notes: z.string().optional().nullable(),
      });
      const data = schema.parse(req.body);

      // Fetch current bill to compare paidMonths before updating
      const existingBills = await storage.getBills(userId);
      const existingBill = existingBills.find(b => b.id === req.params.id);

      const bill = await storage.updateBill(req.params.id, userId, data as any);
      if (!bill) return res.status(404).json({ message: "Conta não encontrada" });

      // If paidMonths changed, create or remove transaction accordingly
      if (data.paidMonths !== undefined && existingBill) {
        const oldMonths: string[] = (() => { try { return JSON.parse(existingBill.paidMonths || "[]"); } catch { return []; } })();
        const newMonths: string[] = (() => { try { return JSON.parse(data.paidMonths || "[]"); } catch { return []; } })();

        const added = newMonths.filter(m => !oldMonths.includes(m));
        const removed = oldMonths.filter(m => !newMonths.includes(m));

        if (added.length > 0) {
          // Marked as paid — create a transaction
          await storage.createTransaction({
            userId,
            amount: bill.amount,
            description: `[bill:${bill.id}] ${bill.title}`,
            type: bill.type as "expense" | "income",
            source: "bill_payment",
            categoryName: bill.categoryName || null,
            date: new Date(),
          });

          // Discipline: streak-based points for on-time payment
          const today = new Date().getDate();
          const onTime = today <= bill.dueDay;
          const newStreak = onTime ? ((bill as any).billStreak ?? 0) + 1 : 0;
          await storage.updateBill(bill.id, userId, { billStreak: newStreak } as any);
          const pts = onTime ? Math.min(newStreak + 1, 5) : DISCIPLINE_POINTS.BILL_PAID_LATE;
          const streakLabel = newStreak === 1 ? "1 mês" : `${newStreak} meses`;
          const disciplineReason = onTime
            ? `💳 "${bill.title}" paga em dia — sequência de ${streakLabel} (+${pts} pts)`
            : `⚠️ "${bill.title}" paga com atraso — sequência zerada (${pts} pts)`;
          await adjustDisciplinePoints(userId, pts, disciplineReason);

        } else if (removed.length > 0) {
          // Unmarked — delete the linked transaction and revert streak
          await storage.deleteTransactionsByBillId(userId, bill.id);
          const revertedStreak = Math.max(0, ((bill as any).billStreak ?? 1) - 1);
          await storage.updateBill(bill.id, userId, { billStreak: revertedStreak } as any);
        }
      }

      res.json(bill);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/bills/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteBill(req.params.id, userId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/user/settings", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ theme: z.enum(["slim", "slim-indigo", "slim-rose", "slim-amber", "high", "high-purple", "high-gold", "high-coral"]).optional(), aiPersonality: z.string().optional(), activeModules: z.array(z.string()).optional() });
      const data = schema.parse(req.body);
      await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  // ── ADMIN CHECK ─────────────────────────────────────────────────────────
  app.get("/api/auth/is-admin", isAuthenticated, async (req, res) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({ isAdmin: await isAdminUser(req) });
  });

  // ── WHATSAPP ROUTES ─────────────────────────────────────────────────────
  app.get("/api/whatsapp/status", isAuthenticated, async (req, res) => {
    const admin = await isAdminUser(req);
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    res.json({
      status: whatsappManager.getStatus(),
      qrCode: admin ? whatsappManager.getQrCode() : undefined,
      phone: whatsappManager.getConnectedPhone(),
    });
  });

  app.post("/api/whatsapp/connect", isAuthenticated, async (req, res) => {
    try {
      const admin = await isAdminUser(req);
      if (!admin) return res.status(403).json({ message: "Apenas o administrador pode conectar o WhatsApp" });
      const currentStatus = whatsappManager.getStatus();
      if (currentStatus === "connected") {
        return res.json({ status: "connected", phone: whatsappManager.getConnectedPhone() });
      }
      console.log(`[whatsapp] connect requested — current status: ${currentStatus}`);
      try { whatsappManager.resetRetryCount(); } catch (_e) { /* ignore if method missing */ }
      whatsappManager.initialize().catch(err => {
        console.log(`[whatsapp] init error: ${err?.message || err}`);
      });
      await new Promise(r => setTimeout(r, 2500));
      const newStatus = whatsappManager.getStatus();
      const qr = whatsappManager.getQrCode();
      console.log(`[whatsapp] connect result — status: ${newStatus}, hasQR: ${!!qr}`);
      res.json({ status: newStatus, qrCode: qr });
    } catch (error: any) {
      console.error(`[whatsapp] connect handler error:`, error);
      res.status(500).json({ message: error?.message || "Erro interno" });
    }
  });

  app.post("/api/whatsapp/disconnect", isAuthenticated, async (req, res) => {
    try {
      if (!(await isAdminUser(req))) return res.status(403).json({ message: "Apenas o administrador pode desconectar o WhatsApp" });
      await whatsappManager.disconnect();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/whatsapp/reset", isAuthenticated, async (req, res) => {
    try {
      if (!(await isAdminUser(req))) return res.status(403).json({ message: "Apenas o administrador pode resetar o WhatsApp" });
      await whatsappManager.disconnect();
      setTimeout(() => {
        whatsappManager.initialize().catch(err => console.error("WhatsApp reset error:", err));
      }, 800);
      res.json({ status: "initializing" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/user/whatsapp-phone", isAuthenticated, async (req, res) => {
    const userId = getUserId(req);
    const { phone } = req.body;
    const cleaned = (phone || "").replace(/[^0-9]/g, "");
    if (cleaned) {
      const existing = await storage.getUserProfileByPhone(cleaned);
      if (existing && existing.userId !== userId) {
        const prevPhone = (existing as any).whatsappPhone as string | null;
        await storage.clearWhatsappLink(existing.userId);
        if (prevPhone) whatsappManager.unlinkPhone(prevPhone);
        log(`WhatsApp: número ${cleaned} transferido de userId=${existing.userId} para userId=${userId}`, "whatsapp");
      }
      await storage.upsertUserProfile(userId, { whatsappPhone: cleaned } as any);
      if (whatsappManager.getStatus() === "connected") {
        whatsappManager.resolveAndSaveJid(userId, cleaned).catch(() => {});
      }
    } else {
      const existingProfile = await storage.getUserProfile(userId);
      const oldPhone = (existingProfile as any)?.whatsappPhone as string | null;
      await storage.clearWhatsappLink(userId);
      if (oldPhone) whatsappManager.unlinkPhone(oldPhone);
      log(`WhatsApp: número desvinculado para userId=${userId} (phone=${oldPhone ?? "none"})`, "whatsapp");
    }
    res.json({ success: true, phone: cleaned });
  });

  // ── AXIS BUSINESS ─────────────────────────────────────────────────────

  app.post("/api/business/organizations", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({
        name: z.string().min(1),
        tradeName: z.string().optional(),
        cnpj: z.string().optional(),
        segment: z.string().optional(),
        closingDay: z.number().int().min(1).max(28).optional(),
        jobTitle: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Nome da empresa é obrigatório" });
      const { jobTitle, ...orgData } = parsed.data;
      const org = await storage.createOrganization({ ...orgData, adminUserId: userId });
      await storage.addOrganizationMember({ organizationId: org.id, userId, role: "admin", jobTitle });
      res.json(org);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/business/organizations", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const orgs = await storage.getUserOrganizations(userId);
      res.json(orgs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/business/organizations/:orgId", isAuthenticated, async (req, res) => {
    try {
      const { orgId } = req.params;
      const schema = z.object({
        name: z.string().min(1).optional(),
        tradeName: z.string().optional(),
        segment: z.string().optional(),
        closingDay: z.number().int().min(1).max(28).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });
      const org = await storage.updateOrganization(orgId, parsed.data);
      res.json(org);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/business/organizations/:orgId/members", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const org = await storage.getOrganizationById(orgId);
      if (!org) return res.status(404).json({ message: "Empresa não encontrada" });
      if (org.adminUserId !== userId) return res.status(403).json({ message: "Apenas o admin pode convidar membros" });
      const { email } = req.body;
      if (!email) return res.status(400).json({ message: "E-mail obrigatório" });
      const [invitedUser] = await db.select().from(users).where(eq(users.email, email));
      if (!invitedUser) return res.status(404).json({ message: "Usuário com esse e-mail não encontrado no AXIS" });
      const existing = (await storage.getOrganizationMembers(orgId)).find(m => m.userId === invitedUser.id);
      if (existing) return res.status(409).json({ message: "Colaborador já faz parte da empresa" });
      const member = await storage.addOrganizationMember({ organizationId: orgId, userId: invitedUser.id, role: "member" });
      res.json(member);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/business/organizations/:orgId/members", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const members = await storage.getOrganizationMembers(orgId);
      res.json(members);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/business/organizations/:orgId/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId, memberId } = req.params;
      const org = await storage.getOrganizationById(orgId);
      if (!org) return res.status(404).json({ message: "Empresa não encontrada" });
      if (org.adminUserId !== userId) return res.status(403).json({ message: "Apenas o admin pode remover membros" });
      const members = await storage.getOrganizationMembers(orgId);
      const target = members.find(m => m.id === memberId);
      if (!target) return res.status(404).json({ message: "Membro não encontrado" });
      if (target.userId === org.adminUserId) return res.status(400).json({ message: "Não é possível remover o administrador principal" });
      await storage.deleteOrganizationMember(orgId, memberId);
      res.json({ message: "Membro removido" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/business/organizations/:orgId/members/:memberId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId, memberId } = req.params;
      const { role } = req.body;
      if (!role || !["admin", "member"].includes(role)) return res.status(400).json({ message: "Role inválido" });
      const org = await storage.getOrganizationById(orgId);
      if (!org) return res.status(404).json({ message: "Empresa não encontrada" });
      if (org.adminUserId !== userId) return res.status(403).json({ message: "Apenas o admin pode alterar permissões" });
      const updated = await storage.updateMemberRole(orgId, memberId, role);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/business/organizations/:orgId/collaborators", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const { firstName, lastName, email, password, jobTitle } = req.body;
      if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ message: "Nome, email e senha são obrigatórios" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Senha deve ter pelo menos 6 caracteres" });
      }
      const org = await storage.getOrganizationById(orgId);
      if (!org) return res.status(404).json({ message: "Empresa não encontrada" });
      if (org.adminUserId !== userId) return res.status(403).json({ message: "Apenas o admin pode adicionar colaboradores" });
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await storage.createCollaboratorAccount(orgId, { firstName, lastName, email, hashedPassword, jobTitle });
      res.json({ userId: result.userId, email: result.email });
    } catch (err: any) {
      res.status(err.message.includes("já está cadastrado") ? 409 : 500).json({ message: err.message });
    }
  });

  app.get("/api/business/organizations/:orgId/expenses/export-excel", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const org = await storage.getOrganizationById(orgId);
      const filters: any = {};
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.status) filters.status = req.query.status as string;
      const expenses = await storage.getBusinessExpenses(orgId, filters);
      const buffer = await generateExpenseExcel(expenses, org?.name ?? "Empresa", {
        start: req.query.startDate ? new Date(req.query.startDate as string).toLocaleDateString("pt-BR") : undefined,
        end: req.query.endDate ? new Date(req.query.endDate as string).toLocaleDateString("pt-BR") : undefined,
      });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="despesas-${org?.name ?? orgId}.xlsx"`);
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/business/organizations/:orgId/expenses", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const filters: any = {};
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.status) filters.status = req.query.status as string;
      const expenses = await storage.getBusinessExpenses(orgId, filters);
      res.json(expenses);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/business/organizations/:orgId/expenses", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const schema = z.object({
        amount: z.number().positive(),
        description: z.string().min(1),
        categoryName: z.string().optional(),
        establishment: z.string().optional(),
        paymentMethod: z.string().optional(),
        notes: z.string().optional(),
        receiptImageBase64: z.string().optional(),
        receiptItems: z.string().optional(),
        source: z.string().optional(),
        date: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });

      let receiptImageUrl: string | undefined;
      let receiptImageBase64: string | undefined = parsed.data.receiptImageBase64;

      if (receiptImageBase64 && isStorageConfigured) {
        const uploaded = await uploadBase64Image(receiptImageBase64, "receipts");
        if (uploaded) {
          receiptImageUrl = uploaded;
          receiptImageBase64 = undefined;
        }
      }

      const expense = await storage.createBusinessExpense({
        ...parsed.data,
        receiptImageBase64,
        receiptImageUrl,
        organizationId: orgId,
        userId,
        date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
        source: parsed.data.source ?? "manual",
      });

      const org = await storage.getOrganizationById(orgId);
      if (org && org.adminUserId !== userId) {
        const [submitter] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId));
        const submitterName = submitter ? `${submitter.firstName ?? ""} ${submitter.lastName ?? ""}`.trim() : undefined;
        whatsappManager.notifyAdminNewExpense(orgId, expense, submitterName).catch(() => {});
      }

      res.json(expense);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/business/organizations/:orgId/expenses/:expenseId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId, expenseId } = req.params;
      const org = await storage.getOrganizationById(orgId);
      if (!org) return res.status(404).json({ message: "Empresa não encontrada" });
      if (org.adminUserId !== userId) return res.status(403).json({ message: "Apenas o admin pode aprovar/rejeitar/pagar despesas" });
      const { status, rejectionComment } = req.body;
      if (!["approved", "rejected", "pending_review", "paid"].includes(status)) return res.status(400).json({ message: "Status inválido" });
      const updated = await storage.updateBusinessExpenseStatus(expenseId, orgId, status, rejectionComment);
      if (!updated) return res.status(404).json({ message: "Despesa não encontrada" });

      if (["approved", "rejected", "paid"].includes(status)) {
        whatsappManager.notifyCollaboratorExpenseStatus(updated, status, rejectionComment).catch(() => {});
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/business/organizations/:orgId/expenses/:expenseId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId, expenseId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const { amount, description, categoryName, establishment, date, notes, paymentMethod } = req.body;
      const updated = await storage.updateBusinessExpense(expenseId, orgId, userId, {
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(description !== undefined && { description }),
        ...(categoryName !== undefined && { categoryName }),
        ...(establishment !== undefined && { establishment }),
        ...(date !== undefined && { date: new Date(date) }),
        ...(notes !== undefined && { notes }),
        ...(paymentMethod !== undefined && { paymentMethod }),
      });
      if (!updated) return res.status(404).json({ message: "Despesa não encontrada ou sem permissão" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // ── BILLS (Contas a Pagar) ─────────────────────────────────────────────

  app.get("/api/business/organizations/:orgId/bills", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const bills = await storage.getBusinessBills(orgId);
      res.json(bills);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/business/organizations/:orgId/bills", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const schema = z.object({
        description: z.string().min(1),
        amount: z.number().positive(),
        dueDate: z.string().transform(v => new Date(v)),
        supplier: z.string().optional(),
        categoryName: z.string().optional(),
        paymentMethod: z.string().optional(),
        costCenter: z.string().optional(),
        notes: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      const bill = await storage.createBusinessBill({ ...parsed.data, organizationId: orgId });
      res.status(201).json(bill);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/business/organizations/:orgId/bills/:billId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId, billId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const schema = z.object({
        description: z.string().optional(),
        amount: z.number().optional(),
        dueDate: z.string().transform(v => new Date(v)).optional(),
        status: z.enum(["pending", "paid", "overdue"]).optional(),
        supplier: z.string().optional(),
        categoryName: z.string().optional(),
        paymentMethod: z.string().optional(),
        costCenter: z.string().optional(),
        notes: z.string().optional(),
        paidAt: z.string().transform(v => new Date(v)).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });
      const updated = await storage.updateBusinessBill(billId, orgId, parsed.data);
      if (!updated) return res.status(404).json({ message: "Conta não encontrada" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/business/organizations/:orgId/bills/:billId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId, billId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      await storage.deleteBusinessBill(billId, orgId);
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/business/organizations/:orgId/bills/batch-pay", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const { ids } = z.object({ ids: z.array(z.string()) }).parse(req.body);
      await storage.batchPayBusinessBills(ids, orgId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── RECEIVABLES (Contas a Receber) ─────────────────────────────────────

  app.get("/api/business/organizations/:orgId/receivables", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const receivables = await storage.getBusinessReceivables(orgId);
      res.json(receivables);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/business/organizations/:orgId/receivables", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const schema = z.object({
        description: z.string().min(1),
        amount: z.number().positive(),
        dueDate: z.string().transform(v => new Date(v)),
        client: z.string().optional(),
        paymentMethod: z.string().optional(),
        costCenter: z.string().optional(),
        notes: z.string().optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
      const rec = await storage.createBusinessReceivable({ ...parsed.data, organizationId: orgId });
      res.status(201).json(rec);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/business/organizations/:orgId/receivables/:receivableId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId, receivableId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const schema = z.object({
        description: z.string().optional(),
        amount: z.number().optional(),
        dueDate: z.string().transform(v => new Date(v)).optional(),
        status: z.enum(["pending", "received", "overdue"]).optional(),
        client: z.string().optional(),
        paymentMethod: z.string().optional(),
        costCenter: z.string().optional(),
        notes: z.string().optional(),
        receivedAt: z.string().transform(v => new Date(v)).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Dados inválidos" });
      const updated = await storage.updateBusinessReceivable(receivableId, orgId, parsed.data);
      if (!updated) return res.status(404).json({ message: "Recebível não encontrado" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/business/organizations/:orgId/receivables/:receivableId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId, receivableId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      await storage.deleteBusinessReceivable(receivableId, orgId);
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/business/organizations/:orgId/cards", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const cards = await storage.getBusinessCorporateCards(orgId);
      res.json(cards);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/business/organizations/:orgId/cards", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const card = await storage.createBusinessCorporateCard({ ...req.body, organizationId: orgId });
      res.status(201).json(card);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/business/organizations/:orgId/cards/:cardId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId, cardId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      const card = await storage.updateBusinessCorporateCard(cardId, orgId, req.body);
      if (!card) return res.status(404).json({ message: "Cartão não encontrado" });
      res.json(card);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/business/organizations/:orgId/cards/:cardId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { orgId, cardId } = req.params;
      const userOrgs = await storage.getUserOrganizations(userId);
      if (!userOrgs.find(o => o.id === orgId)) return res.status(403).json({ message: "Acesso negado" });
      await storage.deleteBusinessCorporateCard(cardId, orgId);
      res.status(204).send();
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  return httpServer;
}
