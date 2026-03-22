import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, real, date, index } from "drizzle-orm/pg-core";
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

export const creditCards = pgTable("credit_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  bank: text("bank").notNull(),
  limit: real("limit").notNull(),
  closingDay: integer("closing_day").notNull(),
  dueDay: integer("due_day").notNull(),
  color: text("color").default("#7C3AED"),
  active: boolean("active").notNull().default(true),
  limitHistory: text("limit_history"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditCardInvoices = pgTable("credit_card_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  creditCardId: varchar("credit_card_id").notNull(),
  monthKey: text("month_key").notNull(),
  total: real("total").notNull().default(0),
  status: text("status").notNull().default("open"),
  billId: text("bill_id"),
  closedAt: timestamp("closed_at"),
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
  receiptItems: text("receipt_items"),
  dateOnly: boolean("date_only").default(false).notNull(),
  creditCardId: varchar("credit_card_id"),
  installmentInfo: text("installment_info"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const financialGoals = pgTable("financial_goals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: text("title").notNull(),
  emoji: text("emoji"),
  description: text("description"),
  targetAmount: real("target_amount"),
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
  justification: text("justification"),
  justificationScore: integer("justification_score"),
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
  endTime: text("end_time"),
  description: text("description"),
  weekdays: text("weekdays"),
  lastPenalizedDate: date("last_penalized_date"),
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
  initialBalance: real("initial_balance").default(0),
  lastSpendingAnalysis: timestamp("last_spending_analysis"),
  currency: varchar("currency").default("BRL"),
  currencySetAt: timestamp("currency_set_at"),
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
  billStreak: integer("bill_streak").notNull().default(0),
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

export const whatsappAuth = pgTable("whatsapp_auth", {
  key: varchar("key").primaryKey(),
  data: text("data").notNull(),
});

export const recurringIncomes = pgTable("recurring_incomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  amount: real("amount").notNull(),
  dayOfMonth: integer("day_of_month").notNull(),
  active: boolean("active").notNull().default(true),
  lastPostedMonth: text("last_posted_month"),
  categoryName: text("category_name"),
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

export const insertCreditCardSchema = createInsertSchema(creditCards).omit({ id: true, createdAt: true });
export const insertCreditCardInvoiceSchema = createInsertSchema(creditCardInvoices).omit({ id: true, createdAt: true });
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

export type CreditCard = typeof creditCards.$inferSelect;
export type InsertCreditCard = z.infer<typeof insertCreditCardSchema>;
export type CreditCardInvoice = typeof creditCardInvoices.$inferSelect;
export type InsertCreditCardInvoice = z.infer<typeof insertCreditCardInvoiceSchema>;

export const scheduleItemCancellations = pgTable("schedule_item_cancellations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  entityType: text("entity_type").notNull().default("schedule"),
  scheduleItemId: varchar("schedule_item_id"),
  habitId: varchar("habit_id"),
  date: text("date").notNull(),
  reason: text("reason"),
  type: text("type").notNull().default("other"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ScheduleItemCancellation = typeof scheduleItemCancellations.$inferSelect;

export const organizations = pgTable("organizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  tradeName: text("trade_name"),
  cnpj: text("cnpj"),
  country: text("country"),
  segment: text("segment"),
  closingDay: integer("closing_day"),
  adminUserId: varchar("admin_user_id").notNull(),
  spendingLimits: text("spending_limits"),
  logoUrl: text("logo_url"),
  logoBase64: text("logo_base64"),
  primaryColor: text("primary_color"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("member"),
  jobTitle: text("job_title"),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const businessExpenses = pgTable("business_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  userId: varchar("user_id").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  categoryName: text("category_name"),
  date: timestamp("date").defaultNow(),
  establishment: text("establishment"),
  receiptImageBase64: text("receipt_image_base64"),
  receiptImageUrl: text("receipt_image_url"),
  receiptItems: text("receipt_items"),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("pending_review"),
  rejectionComment: text("rejection_comment"),
  paidAt: timestamp("paid_at"),
  notes: text("notes"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  index("idx_biz_exp_org").on(t.organizationId),
  index("idx_biz_exp_user").on(t.userId),
  index("idx_biz_exp_status").on(t.status),
  index("idx_biz_exp_date").on(t.date),
]);

export const businessBills = pgTable("business_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("pending"),
  supplier: text("supplier"),
  categoryName: text("category_name"),
  paymentMethod: text("payment_method"),
  costCenter: text("cost_center"),
  receiptImageUrl: text("receipt_image_url"),
  notes: text("notes"),
  source: text("source").notNull().default("manual"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const businessReceivables = pgTable("business_receivables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("pending"),
  client: text("client"),
  paymentMethod: text("payment_method"),
  costCenter: text("cost_center"),
  notes: text("notes"),
  receivedAt: timestamp("received_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const businessCorporateCards = pgTable("business_corporate_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  name: text("name").notNull(),
  last4: varchar("last4", { length: 4 }).notNull(),
  brand: text("brand").notNull().default("Visa"),
  limitAmount: real("limit_amount").notNull().default(0),
  currentBalance: real("current_balance").notNull().default(0),
  holder: text("holder").notNull(),
  closingDay: integer("closing_day").notNull().default(1),
  color: text("color"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reportShares = pgTable("report_shares", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orgId: varchar("org_id").notNull(),
  userId: varchar("user_id").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const insertReportShareSchema = createInsertSchema(reportShares).omit({ id: true, createdAt: true });
export type ReportShare = typeof reportShares.$inferSelect;
export type InsertReportShare = z.infer<typeof insertReportShareSchema>;

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true });
export const insertOrganizationMemberSchema = createInsertSchema(organizationMembers).omit({ id: true, joinedAt: true });
export const insertBusinessExpenseSchema = createInsertSchema(businessExpenses).omit({ id: true, createdAt: true });
export const insertBusinessBillSchema = createInsertSchema(businessBills).omit({ id: true, createdAt: true });
export const insertBusinessReceivableSchema = createInsertSchema(businessReceivables).omit({ id: true, createdAt: true });
export const insertBusinessCorporateCardSchema = createInsertSchema(businessCorporateCards).omit({ id: true, createdAt: true });

export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type OrganizationMember = typeof organizationMembers.$inferSelect;
export type InsertOrganizationMember = z.infer<typeof insertOrganizationMemberSchema>;
export type BusinessExpense = typeof businessExpenses.$inferSelect;
export type InsertBusinessExpense = z.infer<typeof insertBusinessExpenseSchema>;
export type BusinessBill = typeof businessBills.$inferSelect;
export type InsertBusinessBill = z.infer<typeof insertBusinessBillSchema>;
export type BusinessReceivable = typeof businessReceivables.$inferSelect;
export type InsertBusinessReceivable = z.infer<typeof insertBusinessReceivableSchema>;
export type BusinessCorporateCard = typeof businessCorporateCards.$inferSelect;
export type InsertBusinessCorporateCard = z.infer<typeof insertBusinessCorporateCardSchema>;
