import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { z } from "zod";
import multer from "multer";
import { transcribeAudio, detectIntentAndProcess, processReceiptPhoto, processPDFExtract, chatWithContext, generateOnboardingDiagnosis, deepAnalyzeOnboarding, parseFixedExpenses, parseRoutineToSchedule, saveEventToMemory, extractMemoryFromChat } from "./ai";
import { updateLastLogin, checkAndSendBillAlerts, checkAndSendOverdueTaskAlerts, checkAndSendGoalDeadlineAlerts, checkAndSendLowDisciplineAlert } from "./alerts";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { whatsappManager } from "./whatsapp";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

function getUserId(req: any): string {
  return req.session?.userId;
}

function paramId(req: any): string {
  return req.params.id as string;
}

// ── DISCIPLINE POINT VALUES ────────────────────────────────────────────
// Positive actions
const DISCIPLINE_POINTS = {
  TASK_HIGH:    6,   // tarefa alta prioridade concluída
  TASK_MEDIUM:  4,   // tarefa média prioridade concluída
  TASK_LOW:     3,   // tarefa baixa prioridade concluída
  HABIT_CHECK:  2,   // hábito diário marcado como feito
  TASK_OVERDUE: -4,  // tarefa em atraso detectada
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
      await storage.updatePersonalTask(task.id, userId, { disciplinePenalized: true });
      await adjustDisciplinePoints(userId, DISCIPLINE_POINTS.TASK_OVERDUE, `❌ Tarefa "${task.title}" em atraso — ${DISCIPLINE_POINTS.TASK_OVERDUE} pts`);
    }
  } catch {
    // silently fail
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

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
      const result = await processReceiptPhoto(base64, userId);
      res.json(result);
    } catch (error: any) {
      console.error("Error processing photo:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/finance/photo/confirm", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { items, establishment, date, categoryName, location } = req.body;
      const created = await storage.createManyTransactions(
        (items || []).map((item: any) => ({
          userId,
          amount: item.amount,
          description: item.description,
          categoryName: categoryName || null,
          type: "expense" as const,
          date: date ? new Date(date) : new Date(),
          source: "photo",
          establishment: establishment || null,
          location: location || null,
        }))
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
      const pdfText = req.file.buffer.toString("utf-8");
      const result = await processPDFExtract(pdfText, userId);
      res.json(result);
    } catch (error: any) {
      console.error("Error processing PDF:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/finance/pdf/confirm", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
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
          establishment: null,
          location: null,
        }))
      );
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/transactions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const filters: any = {};
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      if (req.query.type) filters.type = req.query.type as string;
      if (req.query.categoryId) filters.categoryId = req.query.categoryId as string;
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
      });
      const data = schema.parse(req.body);
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
      });
      saveEventToMemory(userId, `Nova transação registrada: ${data.type === "expense" ? "gasto" : "receita"} de R$${data.amount.toFixed(2)} em ${data.categoryName || "sem categoria"} — "${data.description}"`).catch(() => {});
      res.status(201).json(tx);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
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
      const schema = z.object({ title: z.string().min(1), targetAmount: z.number().positive(), deadline: z.string().optional().nullable() });
      const data = schema.parse(req.body);
      const goal = await storage.createFinancialGoal({ userId, title: data.title, targetAmount: data.targetAmount, deadline: data.deadline ? new Date(data.deadline) : null });
      saveEventToMemory(userId, `Nova meta financeira criada: "${data.title}" — alvo R$${data.targetAmount}`).catch(() => {});
      res.status(201).json(goal);
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/goals/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const schema = z.object({ title: z.string().optional(), targetAmount: z.number().optional(), currentAmount: z.number().optional(), status: z.string().optional() });
      const data = schema.parse(req.body);
      const goal = await storage.updateFinancialGoal(paramId(req), userId, data);
      if (!goal) return res.status(404).json({ message: "Meta não encontrada" });
      if (data.currentAmount !== undefined) {
        saveEventToMemory(userId, `Progresso na meta "${goal.title}": R$${data.currentAmount}/${goal.targetAmount}`).catch(() => {});
      }
      res.json(goal);
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
      const habit = (await storage.getHabits(userId)).find(h => h.id === paramId(req));
      if (habit) {
        saveEventToMemory(userId, `Compromisso "${habit.name}" registrado — streak atual: ${habit.streak} dias`).catch(() => {});
        adjustDisciplinePoints(userId, DISCIPLINE_POINTS.HABIT_CHECK, `⚡ Compromisso "${habit.name}" feito — +${DISCIPLINE_POINTS.HABIT_CHECK} pts`).catch(() => {});
      }
      res.json(log);
    } catch (error: any) {
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

      try {
        const intentResult = await detectIntentAndProcess(message, userId);

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

      if (actionMatch) {
        try {
          const action = JSON.parse(actionMatch[1].trim());
          if (action.type === "create_schedule" && action.title && Array.isArray(action.days) && action.time) {
            const [h, m] = (action.time as string).split(":").map(Number);
            const durationMs = (action.durationMinutes || 60) * 60 * 1000;
            const weeks = Math.min(action.weeks || 8, 52);
            const now = new Date();
            const created: any[] = [];

            for (let w = 0; w < weeks; w++) {
              for (const dow of action.days as number[]) {
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

            saveEventToMemory(userId, `AXIS criou ${created.length} compromisso(s) "${action.title}" no calendário via chat assistido.`).catch(() => {});
          }
        } catch {
          // Silently ignore malformed action blocks
        }
      }

      await storage.createChatMessage({ userId, role: "assistant", content: cleanResponse });
      extractMemoryFromChat(userId, message, cleanResponse).catch(() => {});

      res.json({ response: cleanResponse, scheduledItems: actionMatch ? true : undefined });
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
          });
          const label = type === "expense" ? "gasto" : "receita";
          summary = `Pronto! ${label} de R$${Number(data.amount).toFixed(2)} registrado.`;
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

  async function processBillsAsIncome(userId: string): Promise<void> {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const bills = await storage.getBills(userId);
    for (const bill of bills) {
      if (bill.type !== "income") continue;
      if (currentDay < bill.dueDay) continue;
      if (!isBillActiveThisMonthServer(bill)) continue;
      const paidMonths: string[] = (() => { try { return JSON.parse(bill.paidMonths || "[]"); } catch { return []; } })();
      if (paidMonths.includes(currentMonth)) continue;
      await storage.createTransaction({
        userId,
        amount: bill.amount,
        description: bill.title,
        type: "income",
        source: "auto",
        date: now,
      });
      const newPaidMonths = JSON.stringify([...paidMonths, currentMonth]);
      await storage.updateBill(bill.id, userId, { paidMonths: newPaidMonths });
    }
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
        const transactions = await storage.getTransactions(userId, { startDate: startOfMonth, endDate: endOfDay });
        const totalExpenses = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
        const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
        const profile = await storage.getUserProfile(userId);
        const initialBalance = profile?.initialBalance ?? 0;
        result.finance = { totalExpenses, totalIncome, balance: initialBalance + totalIncome - totalExpenses, initialBalance, transactionCount: transactions.length };
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
      processRecurringIncomes(userId).catch(() => {});
      processBillsAsIncome(userId).catch(() => {});
      updateLastLogin(userId).catch(() => {});
      checkAndSendBillAlerts(userId).catch(() => {});
      checkAndSendOverdueTaskAlerts(userId).catch(() => {});
      checkAndSendGoalDeadlineAlerts(userId).catch(() => {});
      checkAndSendLowDisciplineAlert(userId).catch(() => {});

      penalizeOverdueTasks(userId).catch(() => {});
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
              storage.createTransaction({
                userId,
                description: item.description,
                amount: item.amount,
                type: "expense",
                categoryName: item.category,
                categoryId: null,
                date: new Date(),
                source: "manual",
                establishment: null,
                location: null,
                paymentMethod: null,
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
      const context = await storage.getUserContext(userId);
      const completed = context.some(c => c.key === "setup_completed" && c.value === "true");
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

      // Current month boundaries
      const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const curMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      // Previous month boundaries
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      // 6 months ago for trend chart
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [allTx, goals] = await Promise.all([
        storage.getTransactions(userId, { startDate: sixMonthsAgo }),
        storage.getFinancialGoals(userId),
      ]);

      // Accumulators
      let totalIncome = 0;
      let totalExpenses = 0;
      const monthlyMap: Record<string, { income: number; expenses: number }> = {};
      const categoryMap: Record<string, { amount: number; count: number }> = {};

      // Current month accumulators
      let curIncome = 0;
      let curExpenses = 0;
      const curCatMap: Record<string, { amount: number; count: number }> = {};
      const dailyMap: Record<number, number> = {}; // day → expenses

      // Previous month accumulators
      let prevIncome = 0;
      let prevExpenses = 0;

      // Establishment, hour & payment method maps (all 6 months, expenses only)
      const establishmentMap: Record<string, { amount: number; count: number }> = {};
      const hourMap: Record<number, { amount: number; count: number }> = {}; // 0-23
      const paymentMap: Record<string, { amount: number; count: number }> = {};

      for (const tx of allTx) {
        const d = new Date(tx.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expenses: 0 };
        const amt = Number(tx.amount);
        const isCurMonth = d >= curMonthStart && d <= curMonthEnd;
        const isPrevMonth = d >= prevMonthStart && d <= prevMonthEnd;

        if (tx.type === "income") {
          monthlyMap[key].income += amt;
          totalIncome += amt;
          if (isCurMonth) curIncome += amt;
          if (isPrevMonth) prevIncome += amt;
        } else {
          monthlyMap[key].expenses += amt;
          totalExpenses += amt;
          if (isCurMonth) {
            curExpenses += amt;
            const cat = tx.categoryName || "Sem categoria";
            if (!curCatMap[cat]) curCatMap[cat] = { amount: 0, count: 0 };
            curCatMap[cat].amount += amt;
            curCatMap[cat].count++;
            const day = d.getDate();
            dailyMap[day] = (dailyMap[day] || 0) + amt;
          }
          if (isPrevMonth) prevExpenses += amt;
          // 6-month global categories
          const cat = tx.categoryName || "Sem categoria";
          if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 };
          categoryMap[cat].amount += amt;
          categoryMap[cat].count++;
          // Establishment tracking
          const place = tx.establishment || tx.description || "Não identificado";
          if (!establishmentMap[place]) establishmentMap[place] = { amount: 0, count: 0 };
          establishmentMap[place].amount += amt;
          establishmentMap[place].count++;
          // Hour tracking
          const hour = d.getHours();
          if (!hourMap[hour]) hourMap[hour] = { amount: 0, count: 0 };
          hourMap[hour].amount += amt;
          hourMap[hour].count++;
          // Payment method tracking
          const pm = tx.paymentMethod || "Não informado";
          if (!paymentMap[pm]) paymentMap[pm] = { amount: 0, count: 0 };
          paymentMap[pm].amount += amt;
          paymentMap[pm].count++;
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

      // Global 6-month category breakdown
      const byCategory = Object.entries(categoryMap)
        .map(([name, d]) => ({ name, amount: d.amount, count: d.count, pct: totalExpenses > 0 ? Math.round((d.amount / totalExpenses) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);

      // Current month by category
      const currentMonthByCategory = Object.entries(curCatMap)
        .map(([name, d]) => ({ name, amount: d.amount, count: d.count, pct: curExpenses > 0 ? Math.round((d.amount / curExpenses) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);

      // Daily spending this month (full array for the chart)
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const dailyThisMonth = Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        expenses: Number((dailyMap[i + 1] || 0).toFixed(2)),
      }));

      // Month-over-month trends (positive = expenses went UP = bad, negative = went DOWN = good)
      const expenseTrend = prevExpenses > 0 ? Math.round(((curExpenses - prevExpenses) / prevExpenses) * 100) : null;
      const incomeTrend = prevIncome > 0 ? Math.round(((curIncome - prevIncome) / prevIncome) * 100) : null;

      const curBalance = curIncome - curExpenses;
      const curSavingsRate = curIncome > 0 ? Math.round((curBalance / curIncome) * 100) : 0;
      const balance = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : 0;
      const avgMonthlyExpense = Math.round(totalExpenses / 6);
      const topCategory = byCategory[0]?.name || "N/A";
      const curMonthName = now.toLocaleDateString("pt-BR", { month: "long" });

      // Payment method breakdown
      const PM_LABELS: Record<string, string> = { debit: "Débito", credit: "Crédito", pix: "Pix", cash: "Dinheiro", other: "Outro" };
      const byPaymentMethod = Object.entries(paymentMap)
        .map(([key, d]) => ({ key, label: PM_LABELS[key] || key, amount: Number(d.amount.toFixed(2)), count: d.count, pct: totalExpenses > 0 ? Math.round((d.amount / totalExpenses) * 100) : 0 }))
        .sort((a, b) => b.amount - a.amount);

      // Top establishments (all 6 months)
      const byEstablishment = Object.entries(establishmentMap)
        .map(([name, d]) => ({ name, amount: Number(d.amount.toFixed(2)), count: d.count, pct: totalExpenses > 0 ? Math.round((d.amount / totalExpenses) * 100) : 0 }))
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
        pct: totalExpenses > 0 ? Math.round((p.amount / totalExpenses) * 100) : 0,
      }));

      const recentTransactions = [...allTx]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 30);

      res.json({
        summary: { totalIncome, totalExpenses, balance, savingsRate, avgMonthlyExpense, transactionCount: allTx.length, topCategory },
        currentMonth: { name: curMonthName, income: curIncome, expenses: curExpenses, balance: curBalance, savingsRate: curSavingsRate, transactionCount: allTx.filter(t => { const d = new Date(t.date); return d >= curMonthStart && d <= curMonthEnd; }).length, expenseTrend, incomeTrend, topCategory: currentMonthByCategory[0]?.name || "N/A" },
        monthly,
        byCategory,
        currentMonthByCategory,
        dailyThisMonth,
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
      const bill = await storage.updateBill(req.params.id, userId, data as any);
      if (!bill) return res.status(404).json({ message: "Conta não encontrada" });
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
      const schema = z.object({ theme: z.string().optional(), aiPersonality: z.string().optional(), activeModules: z.array(z.string()).optional() });
      const data = schema.parse(req.body);
      await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (error: any) {
      if (error instanceof z.ZodError) return res.status(400).json({ message: error.errors });
      res.status(500).json({ message: error.message });
    }
  });

  // ── WHATSAPP ROUTES ─────────────────────────────────────────────────────
  app.get("/api/whatsapp/status", isAuthenticated, (_req, res) => {
    res.json({
      status: whatsappManager.getStatus(),
      qrCode: whatsappManager.getQrCode(),
      phone: whatsappManager.getConnectedPhone(),
    });
  });

  app.post("/api/whatsapp/connect", isAuthenticated, async (_req, res) => {
    try {
      if (whatsappManager.getStatus() === "connected") {
        return res.json({ status: "connected", phone: whatsappManager.getConnectedPhone() });
      }
      whatsappManager.initialize().catch(err => console.error("WhatsApp init error:", err));
      res.json({ status: "initializing" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/whatsapp/disconnect", isAuthenticated, async (_req, res) => {
    try {
      await whatsappManager.disconnect();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/whatsapp/reset", isAuthenticated, async (_req, res) => {
    try {
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
    await storage.upsertUserProfile(userId, { whatsappPhone: cleaned || null } as any);
    res.json({ success: true, phone: cleaned });
  });

  return httpServer;
}
