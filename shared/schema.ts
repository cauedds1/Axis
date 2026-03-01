import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, real, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";
export * from "./models/chat";

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  color: text("color"),
  type: text("type").notNull().default("expense"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  categoryId: varchar("category_id"),
  categoryName: text("category_name"),
  type: text("type").notNull().default("expense"),
  date: timestamp("date").defaultNow(),
  source: text("source").notNull().default("manual"),
  establishment: text("establishment"),
  location: text("location"),
  paymentMethod: text("payment_method"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const financialGoals = pgTable("financial_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  targetAmount: real("target_amount").notNull(),
  currentAmount: real("current_amount").notNull().default(0),
  deadline: timestamp("deadline"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const scheduleItems = pgTable("schedule_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("pending"),
  suggestedByAi: boolean("suggested_by_ai").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const personalTasks = pgTable("personal_tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("medium"),
  dueDate: timestamp("due_date"),
  category: text("category"),
  disciplinePenalized: boolean("discipline_penalized").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const habits = pgTable("habits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  frequency: text("frequency").notNull().default("daily"),
  streak: integer("streak").notNull().default(0),
  lastChecked: date("last_checked"),
  emoji: text("emoji").default("⚡"),
  targetTime: text("target_time"),
  description: text("description"),
  weekdays: text("weekdays"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const habitLogs = pgTable("habit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  habitId: varchar("habit_id").notNull(),
  userId: varchar("user_id").notNull(),
  date: date("date").notNull(),
  completed: boolean("completed").notNull().default(true),
});

export const userProfile = pgTable("user_profile", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  age: integer("age"),
  profession: text("profession"),
  workType: text("work_type"),
  city: text("city"),
  disciplineScore: integer("discipline_score").default(5),
  disciplinePoints: integer("discipline_points").default(0),
  mainProblem: text("main_problem"),
  feelingStatus: text("feeling_status"),
  oneYearGoal: text("one_year_goal"),
  incomeGoal: text("income_goal"),
  focusArea: text("focus_area"),
  timeAvailable: text("time_available"),
  aiDiagnosis: text("ai_diagnosis"),
  lastLoginAt: timestamp("last_login_at"),
  emailAlerts: text("email_alerts").default('{"billDueSoon":true,"offlineReminder":true}'),
  whatsappPhone: text("whatsapp_phone"),
  whatsappJid: text("whatsapp_jid"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailAlertLog = pgTable("email_alert_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  alertType: text("alert_type").notNull(),
  referenceId: text("reference_id"),
  sentAt: timestamp("sent_at").defaultNow(),
});

export const bills = pgTable("bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  amount: real("amount").notNull(),
  type: text("type").notNull().default("expense"),
  dueDay: integer("due_day").notNull().default(1),
  categoryName: text("category_name"),
  recurrenceType: text("recurrence_type").notNull().default("permanent"),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  active: boolean("active").notNull().default(true),
  paidMonths: text("paid_months").notNull().default("[]"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}));

export const habitsRelations = relations(habits, ({ many }) => ({
  logs: many(habitLogs),
}));

export const habitLogsRelations = relations(habitLogs, ({ one }) => ({
  habit: one(habits, { fields: [habitLogs.habitId], references: [habits.id] }),
}));

export const recurringIncomes = pgTable("recurring_incomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  dayOfMonth: integer("day_of_month").notNull(),
  active: boolean("active").notNull().default(true),
  lastPostedMonth: text("last_posted_month"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const disciplineScoreHistory = pgTable("discipline_score_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  score: integer("score").notNull(),
  previousScore: integer("previous_score").notNull(),
  delta: integer("delta").notNull(),
  reasons: text("reasons").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBillSchema = createInsertSchema(bills).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertFinancialGoalSchema = createInsertSchema(financialGoals).omit({ id: true, createdAt: true });
export const insertScheduleItemSchema = createInsertSchema(scheduleItems).omit({ id: true, createdAt: true });
export const insertPersonalTaskSchema = createInsertSchema(personalTasks).omit({ id: true, createdAt: true });
export const insertHabitSchema = createInsertSchema(habits).omit({ id: true, createdAt: true });
export const insertHabitLogSchema = createInsertSchema(habitLogs).omit({ id: true });
export const insertUserProfileSchema = createInsertSchema(userProfile).omit({ id: true, createdAt: true });

export type Bill = typeof bills.$inferSelect;
export type InsertBill = z.infer<typeof insertBillSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type FinancialGoal = typeof financialGoals.$inferSelect;
export type InsertFinancialGoal = z.infer<typeof insertFinancialGoalSchema>;
export type ScheduleItem = typeof scheduleItems.$inferSelect;
export type InsertScheduleItem = z.infer<typeof insertScheduleItemSchema>;
export type PersonalTask = typeof personalTasks.$inferSelect;
export type InsertPersonalTask = z.infer<typeof insertPersonalTaskSchema>;
export type Habit = typeof habits.$inferSelect;
export type InsertHabit = z.infer<typeof insertHabitSchema>;
export type HabitLog = typeof habitLogs.$inferSelect;
export type InsertHabitLog = z.infer<typeof insertHabitLogSchema>;
export type UserProfile = typeof userProfile.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export const insertDisciplineHistorySchema = createInsertSchema(disciplineScoreHistory).omit({ id: true, createdAt: true });
export type DisciplineHistory = typeof disciplineScoreHistory.$inferSelect;
export type InsertDisciplineHistory = z.infer<typeof insertDisciplineHistorySchema>;

export const insertRecurringIncomeSchema = createInsertSchema(recurringIncomes).omit({ id: true, createdAt: true });
export type RecurringIncome = typeof recurringIncomes.$inferSelect;
export type InsertRecurringIncome = z.infer<typeof insertRecurringIncomeSchema>;

export const insertEmailAlertLogSchema = createInsertSchema(emailAlertLog).omit({ id: true, sentAt: true });
export type EmailAlertLog = typeof emailAlertLog.$inferSelect;
export type InsertEmailAlertLog = z.infer<typeof insertEmailAlertLogSchema>;
