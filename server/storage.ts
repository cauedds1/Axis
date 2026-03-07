import {
  categories, transactions, financialGoals, scheduleItems, personalTasks, habits, habitLogs, userProfile, bills, disciplineScoreHistory, recurringIncomes, emailAlertLog, creditCards, creditCardInvoices, scheduleItemCancellations,
  organizations, organizationMembers, businessExpenses, businessBills, businessReceivables, businessCorporateCards,
  type Bill, type InsertBill,
  type Category, type InsertCategory,
  type Transaction, type InsertTransaction,
  type FinancialGoal, type InsertFinancialGoal,
  type ScheduleItem, type InsertScheduleItem,
  type PersonalTask, type InsertPersonalTask,
  type Habit, type InsertHabit,
  type HabitLog, type InsertHabitLog,
  type UserProfile, type InsertUserProfile,
  type DisciplineHistory, type InsertDisciplineHistory,
  type RecurringIncome, type InsertRecurringIncome,
  type EmailAlertLog, type InsertEmailAlertLog,
  type CreditCard, type InsertCreditCard,
  type CreditCardInvoice, type InsertCreditCardInvoice,
  type ScheduleItemCancellation,
  type Organization, type InsertOrganization,
  type OrganizationMember, type InsertOrganizationMember,
  type BusinessExpense, type InsertBusinessExpense,
  type BusinessBill, type InsertBusinessBill,
  type BusinessReceivable, type InsertBusinessReceivable,
  type BusinessCorporateCard, type InsertBusinessCorporateCard,
  reportShares,
  type ReportShare, type InsertReportShare,
} from "@shared/schema";
import { chatMessages, userContext, type ChatMessage, type InsertChatMessage, type UserContextEntry, type InsertUserContext } from "@shared/models/chat";
import { users, sessions } from "@shared/models/auth";
import { db } from "./db";
import { eq, and, desc, gte, lte, sql, or, like } from "drizzle-orm";

export interface IStorage {
  getBills(userId: string): Promise<Bill[]>;
  createBill(data: InsertBill): Promise<Bill>;
  updateBill(id: string, userId: string, data: Partial<Bill>): Promise<Bill | undefined>;
  deleteBill(id: string, userId: string): Promise<void>;

  getCategories(userId: string): Promise<Category[]>;
  createCategory(data: InsertCategory): Promise<Category>;
  deleteCategory(id: string, userId: string): Promise<void>;

  getTransactions(userId: string, filters?: { startDate?: Date; endDate?: Date; type?: string; categoryId?: string }): Promise<Transaction[]>;
  getTransaction(id: string, userId: string): Promise<Transaction | undefined>;
  createTransaction(data: InsertTransaction): Promise<Transaction>;
  createManyTransactions(data: InsertTransaction[]): Promise<Transaction[]>;
  updateTransaction(id: string, userId: string, fields: {
    amount?: number;
    description?: string;
    categoryName?: string;
    establishment?: string | null;
    date?: Date;
    type?: "expense" | "income";
    paymentMethod?: string | null;
    creditCardId?: string | null;
  }): Promise<Transaction>;
  deleteTransaction(id: string, userId: string): Promise<void>;
  deleteTransactionsByBillId(userId: string, billId: string): Promise<void>;

  getFinancialGoals(userId: string): Promise<FinancialGoal[]>;
  createFinancialGoal(data: InsertFinancialGoal): Promise<FinancialGoal>;
  updateFinancialGoal(id: string, userId: string, data: Partial<FinancialGoal>): Promise<FinancialGoal | undefined>;
  deleteFinancialGoal(id: string, userId: string): Promise<void>;

  getScheduleItems(userId: string, filters?: { startDate?: Date; endDate?: Date; status?: string }): Promise<ScheduleItem[]>;
  createScheduleItem(data: InsertScheduleItem): Promise<ScheduleItem>;
  updateScheduleItem(id: string, userId: string, data: Partial<ScheduleItem>): Promise<ScheduleItem | undefined>;
  deleteScheduleItem(id: string, userId: string): Promise<void>;

  getPersonalTasks(userId: string): Promise<PersonalTask[]>;
  createPersonalTask(data: InsertPersonalTask): Promise<PersonalTask>;
  updatePersonalTask(id: string, userId: string, data: Partial<PersonalTask>): Promise<PersonalTask | undefined>;
  deletePersonalTask(id: string, userId: string): Promise<void>;

  getHabits(userId: string): Promise<Habit[]>;
  createHabit(data: InsertHabit): Promise<Habit>;
  updateHabit(id: string, userId: string, data: Partial<Habit>): Promise<Habit | undefined>;
  deleteHabit(id: string, userId: string): Promise<void>;
  checkHabit(habitId: string, userId: string, date: string): Promise<HabitLog>;
  getHabitLogs(habitId: string, userId: string): Promise<HabitLog[]>;

  getChatMessages(userId: string, limit?: number): Promise<ChatMessage[]>;
  createChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  deleteChatMessages(userId: string): Promise<void>;

  getUserContext(userId: string): Promise<UserContextEntry[]>;
  upsertUserContext(userId: string, key: string, value: string): Promise<UserContextEntry>;

  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile>;

  createDisciplineHistory(data: InsertDisciplineHistory): Promise<DisciplineHistory>;
  getDisciplineHistory(userId: string, limit?: number): Promise<DisciplineHistory[]>;
  getLatestDisciplineHistory(userId: string): Promise<DisciplineHistory | undefined>;

  getRecurringIncomes(userId: string): Promise<RecurringIncome[]>;
  createRecurringIncome(data: InsertRecurringIncome): Promise<RecurringIncome>;
  updateRecurringIncome(id: string, userId: string, data: Partial<RecurringIncome>): Promise<RecurringIncome | undefined>;
  deleteRecurringIncome(id: string, userId: string): Promise<void>;

  createEmailAlertLog(data: InsertEmailAlertLog): Promise<EmailAlertLog>;
  getRecentAlerts(userId: string, alertType: string, referenceId: string | null, sinceDate: Date): Promise<EmailAlertLog[]>;
  getAllProfiles(): Promise<UserProfile[]>;
  getUserProfileByPhone(phone: string): Promise<(UserProfile & { userId: string }) | undefined>;
  clearWhatsappLink(userId: string): Promise<void>;

  getCreditCards(userId: string): Promise<CreditCard[]>;
  getCreditCard(id: string, userId: string): Promise<CreditCard | undefined>;
  createCreditCard(data: InsertCreditCard): Promise<CreditCard>;
  updateCreditCard(id: string, userId: string, data: Partial<CreditCard>): Promise<CreditCard | undefined>;
  deleteCreditCard(id: string, userId: string): Promise<void>;

  getInvoices(userId: string, creditCardId?: string): Promise<CreditCardInvoice[]>;
  getInvoiceByMonth(creditCardId: string, monthKey: string): Promise<CreditCardInvoice | undefined>;
  createInvoice(data: InsertCreditCardInvoice): Promise<CreditCardInvoice>;
  updateInvoice(id: string, data: Partial<CreditCardInvoice>): Promise<CreditCardInvoice | undefined>;

  getScheduleCancellations(userId: string, startDate: string, endDate: string): Promise<ScheduleItemCancellation[]>;
  createScheduleCancellation(data: { userId: string; entityType?: string; scheduleItemId?: string; habitId?: string; date: string; reason?: string; type: string }): Promise<ScheduleItemCancellation>;
  deleteScheduleCancellation(id: string, userId: string): Promise<void>;

  deleteUserAccount(userId: string): Promise<void>;
  resetUserData(userId: string): Promise<void>;

  createOrganization(data: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization>;
  getOrganizationById(id: string): Promise<Organization | undefined>;
  getOrganizationsByUserId(userId: string): Promise<Organization[]>;
  addOrganizationMember(data: InsertOrganizationMember): Promise<OrganizationMember>;
  getOrganizationMembers(orgId: string): Promise<(OrganizationMember & { userEmail?: string; userName?: string })[]>;
  deleteOrganizationMember(orgId: string, memberId: string): Promise<void>;
  updateMemberRole(orgId: string, memberId: string, role: string): Promise<OrganizationMember>;
  getUserOrganizations(userId: string): Promise<Organization[]>;
  createCollaboratorAccount(orgId: string, data: { firstName: string; lastName: string; email: string; hashedPassword: string; jobTitle?: string }): Promise<{ userId: string; email: string }>;
  createBusinessExpense(data: InsertBusinessExpense): Promise<BusinessExpense>;
  getBusinessExpenses(orgId: string, filters?: { startDate?: Date; endDate?: Date; userId?: string; status?: string }): Promise<(BusinessExpense & { userEmail?: string; userName?: string })[]>;
  updateBusinessExpenseStatus(id: string, orgId: string, status: string, rejectionComment?: string): Promise<BusinessExpense | undefined>;
  updateBusinessExpense(id: string, orgId: string, userId: string, data: Partial<{ amount: number; description: string; categoryName: string; establishment: string; date: Date; notes: string; paymentMethod: string }>): Promise<BusinessExpense | undefined>;
  createBusinessBill(data: InsertBusinessBill): Promise<BusinessBill>;
  getBusinessBills(orgId: string): Promise<BusinessBill[]>;
  updateBusinessBill(id: string, orgId: string, data: Partial<InsertBusinessBill>): Promise<BusinessBill | undefined>;
  deleteBusinessBill(id: string, orgId: string): Promise<void>;
  batchPayBusinessBills(ids: string[], orgId: string): Promise<void>;
  createBusinessReceivable(data: InsertBusinessReceivable): Promise<BusinessReceivable>;
  getBusinessReceivables(orgId: string): Promise<BusinessReceivable[]>;
  updateBusinessReceivable(id: string, orgId: string, data: Partial<InsertBusinessReceivable>): Promise<BusinessReceivable | undefined>;
  deleteBusinessReceivable(id: string, orgId: string): Promise<void>;
  getBusinessCorporateCards(orgId: string): Promise<BusinessCorporateCard[]>;
  createBusinessCorporateCard(data: InsertBusinessCorporateCard): Promise<BusinessCorporateCard>;
  updateBusinessCorporateCard(id: string, orgId: string, data: Partial<InsertBusinessCorporateCard>): Promise<BusinessCorporateCard | undefined>;
  deleteBusinessCorporateCard(id: string, orgId: string): Promise<void>;
  createReportShare(data: InsertReportShare): Promise<ReportShare>;
  getReportShare(token: string): Promise<ReportShare | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getBills(userId: string): Promise<Bill[]> {
    return db.select().from(bills).where(eq(bills.userId, userId)).orderBy(bills.dueDay);
  }

  async createBill(data: InsertBill): Promise<Bill> {
    const [bill] = await db.insert(bills).values(data).returning();
    return bill;
  }

  async updateBill(id: string, userId: string, data: Partial<Bill>): Promise<Bill | undefined> {
    const [bill] = await db.update(bills).set(data)
      .where(and(eq(bills.id, id), eq(bills.userId, userId))).returning();
    return bill;
  }

  async deleteBill(id: string, userId: string): Promise<void> {
    await db.delete(bills).where(and(eq(bills.id, id), eq(bills.userId, userId)));
  }

  async getCategories(userId: string): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.userId, userId)).orderBy(categories.name);
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(data).returning();
    return category;
  }

  async deleteCategory(id: string, userId: string): Promise<void> {
    await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, userId)));
  }

  async getTransactions(userId: string, filters?: { startDate?: Date; endDate?: Date; type?: string; categoryId?: string; creditCardId?: string }): Promise<Transaction[]> {
    const conditions = [eq(transactions.userId, userId)];
    if (filters?.startDate) conditions.push(gte(transactions.date, filters.startDate));
    if (filters?.endDate) conditions.push(lte(transactions.date, filters.endDate));
    if (filters?.type) conditions.push(eq(transactions.type, filters.type));
    if (filters?.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId));
    if (filters?.creditCardId) conditions.push(eq(transactions.creditCardId, filters.creditCardId));
    return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.date));
  }

  async getTransaction(id: string, userId: string): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    return tx;
  }

  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(data).returning();
    return tx;
  }

  async createManyTransactions(data: InsertTransaction[]): Promise<Transaction[]> {
    if (data.length === 0) return [];
    return db.insert(transactions).values(data).returning();
  }

  async updateTransaction(id: string, userId: string, fields: {
    amount?: number;
    description?: string;
    categoryName?: string;
    establishment?: string | null;
    date?: Date;
    type?: "expense" | "income";
    paymentMethod?: string | null;
    creditCardId?: string | null;
  }): Promise<Transaction> {
    const [updated] = await db.update(transactions)
      .set(fields)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    return updated;
  }

  async deleteTransaction(id: string, userId: string): Promise<void> {
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  async deleteTransactionsByBillId(userId: string, billId: string): Promise<void> {
    await db.delete(transactions).where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.source, "bill_payment"),
        like(transactions.description, `[bill:${billId}]%`)
      )
    );
  }

  async getFinancialGoals(userId: string): Promise<FinancialGoal[]> {
    return db.select().from(financialGoals).where(eq(financialGoals.userId, userId)).orderBy(desc(financialGoals.createdAt));
  }

  async createFinancialGoal(data: InsertFinancialGoal): Promise<FinancialGoal> {
    const [goal] = await db.insert(financialGoals).values(data).returning();
    return goal;
  }

  async updateFinancialGoal(id: string, userId: string, data: Partial<FinancialGoal>): Promise<FinancialGoal | undefined> {
    const [goal] = await db.update(financialGoals).set(data)
      .where(and(eq(financialGoals.id, id), eq(financialGoals.userId, userId))).returning();
    return goal;
  }

  async deleteFinancialGoal(id: string, userId: string): Promise<void> {
    await db.delete(financialGoals).where(and(eq(financialGoals.id, id), eq(financialGoals.userId, userId)));
  }

  async getScheduleItems(userId: string, filters?: { startDate?: Date; endDate?: Date; status?: string }): Promise<ScheduleItem[]> {
    const conditions = [eq(scheduleItems.userId, userId)];
    if (filters?.startDate) conditions.push(gte(scheduleItems.startTime, filters.startDate));
    if (filters?.endDate) conditions.push(lte(scheduleItems.startTime, filters.endDate));
    if (filters?.status) conditions.push(eq(scheduleItems.status, filters.status));
    return db.select().from(scheduleItems).where(and(...conditions)).orderBy(scheduleItems.startTime);
  }

  async createScheduleItem(data: InsertScheduleItem): Promise<ScheduleItem> {
    const [item] = await db.insert(scheduleItems).values(data).returning();
    return item;
  }

  async updateScheduleItem(id: string, userId: string, data: Partial<ScheduleItem>): Promise<ScheduleItem | undefined> {
    const [item] = await db.update(scheduleItems).set(data)
      .where(and(eq(scheduleItems.id, id), eq(scheduleItems.userId, userId))).returning();
    return item;
  }

  async deleteScheduleItem(id: string, userId: string): Promise<void> {
    await db.delete(scheduleItems).where(and(eq(scheduleItems.id, id), eq(scheduleItems.userId, userId)));
  }

  async getPersonalTasks(userId: string): Promise<PersonalTask[]> {
    return db.select().from(personalTasks).where(eq(personalTasks.userId, userId)).orderBy(desc(personalTasks.createdAt));
  }

  async createPersonalTask(data: InsertPersonalTask): Promise<PersonalTask> {
    const [task] = await db.insert(personalTasks).values(data).returning();
    return task;
  }

  async updatePersonalTask(id: string, userId: string, data: Partial<PersonalTask>): Promise<PersonalTask | undefined> {
    const [task] = await db.update(personalTasks).set(data)
      .where(and(eq(personalTasks.id, id), eq(personalTasks.userId, userId))).returning();
    return task;
  }

  async deletePersonalTask(id: string, userId: string): Promise<void> {
    await db.delete(personalTasks).where(and(eq(personalTasks.id, id), eq(personalTasks.userId, userId)));
  }

  async getHabits(userId: string): Promise<Habit[]> {
    return db.select().from(habits).where(eq(habits.userId, userId)).orderBy(habits.name);
  }

  async createHabit(data: InsertHabit): Promise<Habit> {
    const [habit] = await db.insert(habits).values(data).returning();
    return habit;
  }

  async updateHabit(id: string, userId: string, data: Partial<Habit>): Promise<Habit | undefined> {
    const [habit] = await db.update(habits).set(data)
      .where(and(eq(habits.id, id), eq(habits.userId, userId))).returning();
    return habit;
  }

  async deleteHabit(id: string, userId: string): Promise<void> {
    await db.delete(habitLogs).where(and(eq(habitLogs.habitId, id), eq(habitLogs.userId, userId)));
    await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, userId)));
  }

  async checkHabit(habitId: string, userId: string, date: string): Promise<HabitLog> {
    const existing = await db.select().from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.userId, userId), eq(habitLogs.date, date)));
    if (existing.length > 0) {
      const [updated] = await db.update(habitLogs).set({ completed: !existing[0].completed })
        .where(eq(habitLogs.id, existing[0].id)).returning();
      return updated;
    }
    const [log] = await db.insert(habitLogs).values({ habitId, userId, date, completed: true }).returning();

    const today = new Date().toISOString().split("T")[0];
    if (date === today) {
      const [habit] = await db.select().from(habits).where(eq(habits.id, habitId));
      if (habit) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        const newStreak = habit.lastChecked === yesterdayStr ? habit.streak + 1 : 1;
        await db.update(habits).set({ streak: newStreak, lastChecked: today }).where(eq(habits.id, habitId));
      }
    }
    return log;
  }

  async getHabitLogs(habitId: string, userId: string): Promise<HabitLog[]> {
    return db.select().from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.userId, userId)))
      .orderBy(desc(habitLogs.date));
  }

  async getChatMessages(userId: string, limit = 50): Promise<ChatMessage[]> {
    const msgs = await db.select().from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
    return msgs.reverse();
  }

  async createChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [msg] = await db.insert(chatMessages).values(data).returning();
    return msg;
  }

  async deleteChatMessages(userId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
  }

  async getUserContext(userId: string): Promise<UserContextEntry[]> {
    return db.select().from(userContext).where(eq(userContext.userId, userId));
  }

  async upsertUserContext(userId: string, key: string, value: string): Promise<UserContextEntry> {
    const existing = await db.select().from(userContext)
      .where(and(eq(userContext.userId, userId), eq(userContext.key, key)));
    if (existing.length > 0) {
      const [updated] = await db.update(userContext).set({ value })
        .where(eq(userContext.id, existing[0].id)).returning();
      return updated;
    }
    const [created] = await db.insert(userContext).values({ userId, key, value }).returning();
    return created;
  }

  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfile).where(eq(userProfile.userId, userId));
    return profile;
  }

  async upsertUserProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
    const existing = await this.getUserProfile(userId);
    if (existing) {
      const [updated] = await db.update(userProfile).set(data)
        .where(eq(userProfile.userId, userId)).returning();
      return updated;
    }
    const [created] = await db.insert(userProfile).values({ userId, ...data }).returning();
    return created;
  }

  async getRecurringIncomes(userId: string): Promise<RecurringIncome[]> {
    return db.select().from(recurringIncomes)
      .where(eq(recurringIncomes.userId, userId))
      .orderBy(recurringIncomes.dayOfMonth);
  }

  async createRecurringIncome(data: InsertRecurringIncome): Promise<RecurringIncome> {
    const [entry] = await db.insert(recurringIncomes).values(data).returning();
    return entry;
  }

  async updateRecurringIncome(id: string, userId: string, data: Partial<RecurringIncome>): Promise<RecurringIncome | undefined> {
    const [entry] = await db.update(recurringIncomes).set(data)
      .where(and(eq(recurringIncomes.id, id), eq(recurringIncomes.userId, userId))).returning();
    return entry;
  }

  async deleteRecurringIncome(id: string, userId: string): Promise<void> {
    await db.delete(recurringIncomes)
      .where(and(eq(recurringIncomes.id, id), eq(recurringIncomes.userId, userId)));
  }

  async createDisciplineHistory(data: InsertDisciplineHistory): Promise<DisciplineHistory> {
    const [entry] = await db.insert(disciplineScoreHistory).values(data).returning();
    return entry;
  }

  async getDisciplineHistory(userId: string, limit = 20): Promise<DisciplineHistory[]> {
    return db.select().from(disciplineScoreHistory)
      .where(eq(disciplineScoreHistory.userId, userId))
      .orderBy(desc(disciplineScoreHistory.createdAt))
      .limit(limit);
  }

  async getLatestDisciplineHistory(userId: string): Promise<DisciplineHistory | undefined> {
    const [entry] = await db.select().from(disciplineScoreHistory)
      .where(eq(disciplineScoreHistory.userId, userId))
      .orderBy(desc(disciplineScoreHistory.createdAt))
      .limit(1);
    return entry;
  }

  async createEmailAlertLog(data: InsertEmailAlertLog): Promise<EmailAlertLog> {
    const [entry] = await db.insert(emailAlertLog).values(data).returning();
    return entry;
  }

  async getRecentAlerts(userId: string, alertType: string, referenceId: string | null, sinceDate: Date): Promise<EmailAlertLog[]> {
    const conditions = [
      eq(emailAlertLog.userId, userId),
      eq(emailAlertLog.alertType, alertType),
      gte(emailAlertLog.sentAt, sinceDate),
    ];
    if (referenceId !== null) {
      conditions.push(eq(emailAlertLog.referenceId, referenceId));
    }
    return db.select().from(emailAlertLog).where(and(...conditions));
  }

  async getAllProfiles(): Promise<UserProfile[]> {
    return db.select().from(userProfile);
  }

  async getUserProfileByPhone(phone: string): Promise<(UserProfile & { userId: string }) | undefined> {
    const variants = new Set<string>([phone]);
    if (phone.startsWith("55") && phone.length === 13) variants.add(phone.slice(2));
    if (phone.startsWith("55") && phone.length === 12) variants.add(phone.slice(2));
    if (!phone.startsWith("55") && (phone.length === 11 || phone.length === 10)) variants.add("55" + phone);
    const phoneConditions = [...variants].map(v => eq(userProfile.whatsappPhone, v));
    const [profile] = await db.select().from(userProfile).where(or(...phoneConditions, eq(userProfile.whatsappJid, phone)));
    return profile as (UserProfile & { userId: string }) | undefined;
  }

  async getUserProfileByJid(jid: string): Promise<(UserProfile & { userId: string }) | undefined> {
    const [profile] = await db.select().from(userProfile).where(eq(userProfile.whatsappJid, jid));
    return profile as (UserProfile & { userId: string }) | undefined;
  }

  async clearWhatsappLink(userId: string): Promise<void> {
    await db.update(userProfile)
      .set({ whatsappPhone: sql`NULL`, whatsappJid: sql`NULL` })
      .where(eq(userProfile.userId, userId));
  }

  async getScheduleCancellations(userId: string, startDate: string, endDate: string): Promise<ScheduleItemCancellation[]> {
    return db.select().from(scheduleItemCancellations)
      .where(and(
        eq(scheduleItemCancellations.userId, userId),
        gte(scheduleItemCancellations.date, startDate),
        lte(scheduleItemCancellations.date, endDate)
      ))
      .orderBy(scheduleItemCancellations.date);
  }

  async createScheduleCancellation(data: { userId: string; entityType?: string; scheduleItemId?: string; habitId?: string; date: string; reason?: string; type: string }): Promise<ScheduleItemCancellation> {
    const [rec] = await db.insert(scheduleItemCancellations).values({ ...data, entityType: data.entityType ?? "schedule" }).returning();
    return rec;
  }

  async deleteScheduleCancellation(id: string, userId: string): Promise<void> {
    await db.delete(scheduleItemCancellations)
      .where(and(eq(scheduleItemCancellations.id, id), eq(scheduleItemCancellations.userId, userId)));
  }

  async resetUserData(userId: string): Promise<void> {
    await db.delete(bills).where(eq(bills.userId, userId));
    await db.delete(habitLogs).where(eq(habitLogs.userId, userId));
    await db.delete(habits).where(eq(habits.userId, userId));
    await db.delete(personalTasks).where(eq(personalTasks.userId, userId));
    await db.delete(scheduleItemCancellations).where(eq(scheduleItemCancellations.userId, userId));
    await db.delete(scheduleItems).where(eq(scheduleItems.userId, userId));
    await db.delete(creditCardInvoices).where(eq(creditCardInvoices.userId, userId));
    await db.delete(creditCards).where(eq(creditCards.userId, userId));
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(financialGoals).where(eq(financialGoals.userId, userId));
    await db.delete(categories).where(eq(categories.userId, userId));
    await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
    await db.delete(userContext).where(eq(userContext.userId, userId));
    await db.delete(recurringIncomes).where(eq(recurringIncomes.userId, userId));
    await db.delete(disciplineScoreHistory).where(eq(disciplineScoreHistory.userId, userId));
    await db.delete(emailAlertLog).where(eq(emailAlertLog.userId, userId));
    await db.delete(userProfile).where(eq(userProfile.userId, userId));
  }

  async getCreditCards(userId: string): Promise<CreditCard[]> {
    return db.select().from(creditCards).where(eq(creditCards.userId, userId)).orderBy(creditCards.name);
  }

  async getCreditCard(id: string, userId: string): Promise<CreditCard | undefined> {
    const [card] = await db.select().from(creditCards).where(and(eq(creditCards.id, id), eq(creditCards.userId, userId)));
    return card;
  }

  async createCreditCard(data: InsertCreditCard): Promise<CreditCard> {
    const [card] = await db.insert(creditCards).values(data).returning();
    return card;
  }

  async updateCreditCard(id: string, userId: string, data: Partial<CreditCard>): Promise<CreditCard | undefined> {
    const [card] = await db.update(creditCards).set(data)
      .where(and(eq(creditCards.id, id), eq(creditCards.userId, userId))).returning();
    return card;
  }

  async deleteCreditCard(id: string, userId: string): Promise<void> {
    await db.delete(creditCards).where(and(eq(creditCards.id, id), eq(creditCards.userId, userId)));
  }

  async getInvoices(userId: string, creditCardId?: string): Promise<CreditCardInvoice[]> {
    const conditions = [eq(creditCardInvoices.userId, userId)];
    if (creditCardId) conditions.push(eq(creditCardInvoices.creditCardId, creditCardId));
    return db.select().from(creditCardInvoices).where(and(...conditions)).orderBy(desc(creditCardInvoices.monthKey));
  }

  async getInvoiceByMonth(creditCardId: string, monthKey: string): Promise<CreditCardInvoice | undefined> {
    const [invoice] = await db.select().from(creditCardInvoices)
      .where(and(eq(creditCardInvoices.creditCardId, creditCardId), eq(creditCardInvoices.monthKey, monthKey)));
    return invoice;
  }

  async createInvoice(data: InsertCreditCardInvoice): Promise<CreditCardInvoice> {
    const [invoice] = await db.insert(creditCardInvoices).values(data).returning();
    return invoice;
  }

  async updateInvoice(id: string, data: Partial<CreditCardInvoice>): Promise<CreditCardInvoice | undefined> {
    const [invoice] = await db.update(creditCardInvoices).set(data)
      .where(eq(creditCardInvoices.id, id)).returning();
    return invoice;
  }

  async deleteUserAccount(userId: string): Promise<void> {
    await db.delete(bills).where(eq(bills.userId, userId));
    await db.delete(habitLogs).where(eq(habitLogs.userId, userId));
    await db.delete(habits).where(eq(habits.userId, userId));
    await db.delete(personalTasks).where(eq(personalTasks.userId, userId));
    await db.delete(scheduleItems).where(eq(scheduleItems.userId, userId));
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(financialGoals).where(eq(financialGoals.userId, userId));
    await db.delete(categories).where(eq(categories.userId, userId));
    await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
    await db.delete(userContext).where(eq(userContext.userId, userId));
    await db.delete(userProfile).where(eq(userProfile.userId, userId));
    await db.delete(sessions).where(sql`(sess->>'passport')::jsonb->>'user' = ${userId}`);
    await db.delete(users).where(eq(users.id, userId));
  }

  async createOrganization(data: InsertOrganization): Promise<Organization> {
    const [org] = await db.insert(organizations).values(data).returning();
    return org;
  }

  async updateOrganization(id: string, data: Partial<InsertOrganization>): Promise<Organization> {
    const [org] = await db.update(organizations).set(data).where(eq(organizations.id, id)).returning();
    return org;
  }

  async getOrganizationById(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org;
  }

  async getOrganizationsByUserId(userId: string): Promise<Organization[]> {
    return db.select().from(organizations).where(eq(organizations.adminUserId, userId));
  }

  async addOrganizationMember(data: InsertOrganizationMember): Promise<OrganizationMember> {
    const [member] = await db.insert(organizationMembers).values(data).returning();
    return member;
  }

  async getOrganizationMembers(orgId: string): Promise<(OrganizationMember & { userEmail?: string; userName?: string })[]> {
    const members = await db.select().from(organizationMembers).where(eq(organizationMembers.organizationId, orgId));
    const enriched = await Promise.all(members.map(async (m) => {
      const [user] = await db.select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, m.userId));
      return { ...m, userEmail: user?.email ?? undefined, userName: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : undefined };
    }));
    return enriched;
  }

  async deleteOrganizationMember(orgId: string, memberId: string): Promise<void> {
    await db.delete(organizationMembers).where(
      and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, orgId))
    );
  }

  async updateMemberRole(orgId: string, memberId: string, role: string): Promise<OrganizationMember> {
    const [updated] = await db.update(organizationMembers)
      .set({ role })
      .where(and(eq(organizationMembers.id, memberId), eq(organizationMembers.organizationId, orgId)))
      .returning();
    return updated;
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const memberRows = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, userId));
    const orgIds = memberRows.map(m => m.organizationId);
    const adminOrgs = await db.select().from(organizations).where(eq(organizations.adminUserId, userId));
    if (orgIds.length === 0) return adminOrgs;
    const memberOrgs = await db.select().from(organizations).where(
      sql`${organizations.id} = ANY(ARRAY[${sql.join(orgIds.map(id => sql`${id}`), sql`, `)}]::text[])`
    );
    const allOrgs = [...adminOrgs, ...memberOrgs];
    const seen = new Set<string>();
    return allOrgs.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true; });
  }

  async createCollaboratorAccount(orgId: string, data: { firstName: string; lastName: string; email: string; hashedPassword: string; jobTitle?: string }): Promise<{ userId: string; email: string }> {
    const [existing] = await db.select().from(users).where(eq(users.email, data.email));
    if (existing) throw new Error("Este email já está cadastrado");
    const [user] = await db.insert(users).values({
      email: data.email,
      password: data.hashedPassword,
      firstName: data.firstName,
      lastName: data.lastName,
      accountType: "collaborator",
    }).returning();
    await this.addOrganizationMember({ organizationId: orgId, userId: user.id, role: "member", jobTitle: data.jobTitle });
    return { userId: user.id, email: user.email };
  }

  async createBusinessExpense(data: InsertBusinessExpense): Promise<BusinessExpense> {
    const [expense] = await db.insert(businessExpenses).values(data).returning();
    return expense;
  }

  async getBusinessExpenses(orgId: string, filters?: { startDate?: Date; endDate?: Date; userId?: string; status?: string }): Promise<(BusinessExpense & { userEmail?: string; userName?: string })[]> {
    const conditions = [eq(businessExpenses.organizationId, orgId)];
    if (filters?.startDate) conditions.push(gte(businessExpenses.date, filters.startDate));
    if (filters?.endDate) conditions.push(lte(businessExpenses.date, filters.endDate));
    if (filters?.userId) conditions.push(eq(businessExpenses.userId, filters.userId));
    if (filters?.status) conditions.push(eq(businessExpenses.status, filters.status));
    const expenses = await db.select().from(businessExpenses).where(and(...conditions)).orderBy(desc(businessExpenses.date));
    const enriched = await Promise.all(expenses.map(async (e) => {
      const [user] = await db.select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, e.userId));
      return { ...e, userEmail: user?.email ?? undefined, userName: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : undefined };
    }));
    return enriched;
  }

  async updateBusinessExpenseStatus(id: string, orgId: string, status: string, rejectionComment?: string): Promise<BusinessExpense | undefined> {
    const updates: Record<string, any> = { status };
    if (status === "rejected") {
      updates.rejectionComment = rejectionComment ?? null;
    } else if (status === "paid") {
      updates.paidAt = new Date();
    } else {
      updates.rejectionComment = null;
    }
    const [expense] = await db.update(businessExpenses).set(updates)
      .where(and(eq(businessExpenses.id, id), eq(businessExpenses.organizationId, orgId))).returning();
    return expense;
  }

  async updateBusinessExpense(id: string, orgId: string, userId: string, data: Partial<{ amount: number; description: string; categoryName: string; establishment: string; date: Date; notes: string; paymentMethod: string }>): Promise<BusinessExpense | undefined> {
    const [expense] = await db.update(businessExpenses)
      .set({ ...data, status: "pending_review", rejectionComment: null })
      .where(and(
        eq(businessExpenses.id, id),
        eq(businessExpenses.organizationId, orgId),
        eq(businessExpenses.userId, userId),
      )).returning();
    return expense;
  }

  async createBusinessBill(data: InsertBusinessBill): Promise<BusinessBill> {
    const [bill] = await db.insert(businessBills).values(data).returning();
    return bill;
  }

  async getBusinessBills(orgId: string): Promise<BusinessBill[]> {
    return db.select().from(businessBills)
      .where(eq(businessBills.organizationId, orgId))
      .orderBy(businessBills.dueDate);
  }

  async updateBusinessBill(id: string, orgId: string, data: Partial<InsertBusinessBill>): Promise<BusinessBill | undefined> {
    const [bill] = await db.update(businessBills).set(data)
      .where(and(eq(businessBills.id, id), eq(businessBills.organizationId, orgId))).returning();
    return bill;
  }

  async deleteBusinessBill(id: string, orgId: string): Promise<void> {
    await db.delete(businessBills)
      .where(and(eq(businessBills.id, id), eq(businessBills.organizationId, orgId)));
  }

  async batchPayBusinessBills(ids: string[], orgId: string): Promise<void> {
    const now = new Date();
    for (const id of ids) {
      await db.update(businessBills)
        .set({ status: "paid", paidAt: now })
        .where(and(eq(businessBills.id, id), eq(businessBills.organizationId, orgId)));
    }
  }

  async createBusinessReceivable(data: InsertBusinessReceivable): Promise<BusinessReceivable> {
    const [rec] = await db.insert(businessReceivables).values(data).returning();
    return rec;
  }

  async getBusinessReceivables(orgId: string): Promise<BusinessReceivable[]> {
    return db.select().from(businessReceivables)
      .where(eq(businessReceivables.organizationId, orgId))
      .orderBy(businessReceivables.dueDate);
  }

  async updateBusinessReceivable(id: string, orgId: string, data: Partial<InsertBusinessReceivable>): Promise<BusinessReceivable | undefined> {
    const [rec] = await db.update(businessReceivables).set(data)
      .where(and(eq(businessReceivables.id, id), eq(businessReceivables.organizationId, orgId))).returning();
    return rec;
  }

  async deleteBusinessReceivable(id: string, orgId: string): Promise<void> {
    await db.delete(businessReceivables)
      .where(and(eq(businessReceivables.id, id), eq(businessReceivables.organizationId, orgId)));
  }

  async getBusinessCorporateCards(orgId: string): Promise<BusinessCorporateCard[]> {
    return db.select().from(businessCorporateCards)
      .where(eq(businessCorporateCards.organizationId, orgId))
      .orderBy(businessCorporateCards.createdAt);
  }

  async createBusinessCorporateCard(data: InsertBusinessCorporateCard): Promise<BusinessCorporateCard> {
    const [card] = await db.insert(businessCorporateCards).values(data).returning();
    return card;
  }

  async updateBusinessCorporateCard(id: string, orgId: string, data: Partial<InsertBusinessCorporateCard>): Promise<BusinessCorporateCard | undefined> {
    const [card] = await db.update(businessCorporateCards).set(data)
      .where(and(eq(businessCorporateCards.id, id), eq(businessCorporateCards.organizationId, orgId))).returning();
    return card;
  }

  async deleteBusinessCorporateCard(id: string, orgId: string): Promise<void> {
    await db.delete(businessCorporateCards)
      .where(and(eq(businessCorporateCards.id, id), eq(businessCorporateCards.organizationId, orgId)));
  }

  async createReportShare(data: InsertReportShare): Promise<ReportShare> {
    const [share] = await db.insert(reportShares).values(data).returning();
    return share;
  }

  async getReportShare(token: string): Promise<ReportShare | undefined> {
    const [share] = await db.select().from(reportShares).where(eq(reportShares.id, token));
    return share;
  }
}

export const storage = new DatabaseStorage();
