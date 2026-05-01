import "./express-augment";
import { type Express, type Request, type Response, type NextFunction } from "express";
import { db } from "./db";
import { log } from "./log";
import { logAudit } from "./adminLogger";
import { sendEmail } from "./integrations/sendgrid";
import {
  users, sessions,
} from "@shared/models/auth";
import {
  transactions, habits, habitLogs, personalTasks, userProfile, organizations,
  organizationMembers, businessExpenses, emailAlertLog, auditLogs, aiUsageLogs,
  whatsappLogs, systemConfig, categories,
} from "@shared/schema";
import {
  eq, desc, asc, sql, and, gte, lte, like, or, count, sum, inArray, isNotNull,
} from "drizzle-orm";
import rateLimit from "express-rate-limit";
import { whatsappManager } from "./whatsapp";

// ─── Re-export for convenience ────────────────────────────────────────────────
export { logAiUsage, logWhatsappMessage } from "./adminLogger";

// ─── Admin guard middleware ────────────────────────────────────────────────────
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return res.status(403).json({ message: "ADMIN_EMAIL not configured" });
    const userId = req.session?.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user || user.email !== adminEmail) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    req.adminUser = user;
    next();
  } catch (err: any) {
    log(`requireAdmin error: ${err?.message}`, "admin");
    res.status(500).json({ message: "Erro interno" });
  }
}

/** Boolean helper — safe to call from any route. Does NOT set req.adminUser. */
export async function isAdminRequest(req: Request): Promise<boolean> {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) return false;
    const userId = (req as any).session?.userId;
    if (!userId) return false;
    const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    return user?.email === adminEmail;
  } catch {
    return false;
  }
}

// ─── Pagination helper ────────────────────────────────────────────────────────
function getPagination(req: Request) {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  const search = (req.query.search as string) || "";
  return { page, limit, offset, search };
}

// ─── Period helper ────────────────────────────────────────────────────────────
function getPeriodBounds(monthsBack = 1): { current: { start: Date; end: Date }; previous: { start: Date; end: Date } } {
  const now = new Date();
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const prevStart = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const prevEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  return { current: { start: currentStart, end: currentEnd }, previous: { start: prevStart, end: prevEnd } };
}

export function registerAdminRoutes(app: Express) {

  // ─── Rate limiting setup ──────────────────────────────────────────────────
  const globalLimiter = rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false, skip: () => false });
  const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false });
  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api", globalLimiter);

  // ─── GET /api/admin/stats ─────────────────────────────────────────────────
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const period = getPeriodBounds();
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const prev30d = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

      const [totalUsers] = await db.select({ count: count() }).from(users);
      const [personalUsers] = await db.select({ count: count() }).from(users).where(eq(users.accountType, "personal"));
      const [businessUsers] = await db.select({ count: count() }).from(users).where(eq(users.accountType, "business"));
      const [collaborators] = await db.select({ count: count() }).from(users).where(eq(users.accountType, "collaborator"));

      const [currentMonthUsers] = await db.select({ count: count() }).from(users).where(gte(users.createdAt, period.current.start));
      const [prevMonthUsers] = await db.select({ count: count() }).from(users).where(and(gte(users.createdAt, period.previous.start), lte(users.createdAt, period.previous.end)));

      const [totalTransactions] = await db.select({ count: count() }).from(transactions);
      const [currentMonthTx] = await db.select({ count: count() }).from(transactions).where(gte(transactions.createdAt, period.current.start));
      const [prevMonthTx] = await db.select({ count: count() }).from(transactions).where(and(gte(transactions.createdAt, period.previous.start), lte(transactions.createdAt, period.previous.end)));

      const [totalOrgs] = await db.select({ count: count() }).from(organizations);
      const [currentMonthOrgs] = await db.select({ count: count() }).from(organizations).where(gte(organizations.createdAt, period.current.start));
      const [prevMonthOrgs] = await db.select({ count: count() }).from(organizations).where(and(gte(organizations.createdAt, period.previous.start), lte(organizations.createdAt, period.previous.end)));

      // Active users 7d/30d: any activity across transactions, habits, or tasks
      const active7dResult = await db.execute(sql`
        SELECT COUNT(DISTINCT user_id)::int as c FROM (
          SELECT user_id FROM transactions WHERE created_at >= ${last7d}
          UNION SELECT user_id FROM habits WHERE created_at >= ${last7d}
          UNION SELECT user_id FROM personal_tasks WHERE created_at >= ${last7d}
        ) a
      `);
      const active30dResult = await db.execute(sql`
        SELECT COUNT(DISTINCT user_id)::int as c FROM (
          SELECT user_id FROM transactions WHERE created_at >= ${last30d}
          UNION SELECT user_id FROM habits WHERE created_at >= ${last30d}
          UNION SELECT user_id FROM personal_tasks WHERE created_at >= ${last30d}
        ) a
      `);
      const prevActive30dResult = await db.execute(sql`
        SELECT COUNT(DISTINCT user_id)::int as c FROM (
          SELECT user_id FROM transactions WHERE created_at >= ${prev30d} AND created_at < ${last30d}
          UNION SELECT user_id FROM habits WHERE created_at >= ${prev30d} AND created_at < ${last30d}
          UNION SELECT user_id FROM personal_tasks WHERE created_at >= ${prev30d} AND created_at < ${last30d}
        ) a
      `);

      // Daily signups last 30 days
      const dailySignups = await db.execute(sql`
        SELECT DATE(created_at) as day, COUNT(*)::int as count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `);

      // Top 5 active users by total activity (transactions + habits + tasks)
      const topUsers = await db.execute(sql`
        SELECT u.id, u.email, u.first_name, u.last_name, u.account_type, u.plan,
               (COUNT(DISTINCT t.id) + COUNT(DISTINCT h.id) + COUNT(DISTINCT pt.id))::int as activity_count,
               COUNT(DISTINCT t.id)::int as tx_count
        FROM users u
        LEFT JOIN transactions t ON t.user_id = u.id
        LEFT JOIN habits h ON h.user_id = u.id
        LEFT JOIN personal_tasks pt ON pt.user_id = u.id
        GROUP BY u.id
        ORDER BY activity_count DESC
        LIMIT 5
      `);

      // AI / WhatsApp / Email counts (30d)
      const [aiCalls30d] = await db.select({ count: count() }).from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, last30d));
      const [whatsappMessages30d] = await db.select({ count: count() }).from(whatsappLogs).where(gte(whatsappLogs.createdAt, last30d));
      const [emailAlerts30d] = await db.select({ count: count() }).from(emailAlertLog).where(gte(emailAlertLog.sentAt, last30d));

      // Today's signups
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const [newUsersToday] = await db.select({ count: count() }).from(users).where(gte(users.createdAt, todayStart));

      res.json({
        users: {
          total: totalUsers.count,
          personal: personalUsers.count,
          business: businessUsers.count,
          collaborators: collaborators.count,
          currentMonth: currentMonthUsers.count,
          prevMonth: prevMonthUsers.count,
          newToday: newUsersToday.count,
        },
        activeUsers: {
          last7d: (active7dResult.rows[0] as any)?.c ?? 0,
          last30d: (active30dResult.rows[0] as any)?.c ?? 0,
          prevLast30d: (prevActive30dResult.rows[0] as any)?.c ?? 0,
        },
        transactions: {
          total: totalTransactions.count,
          currentMonth: currentMonthTx.count,
          prevMonth: prevMonthTx.count,
        },
        organizations: {
          total: totalOrgs.count,
          currentMonth: currentMonthOrgs.count,
          prevMonth: prevMonthOrgs.count,
        },
        aiCalls30d: aiCalls30d.count,
        whatsappMessages30d: whatsappMessages30d.count,
        emailAlerts30d: emailAlerts30d.count,
        dailySignups: dailySignups.rows,
        topUsers: topUsers.rows,
      });
    } catch (err: any) {
      log(`admin stats error: ${err?.message}`, "admin");
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/users ─────────────────────────────────────────────────
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { page, limit, offset, search } = getPagination(req);
      const planFilter = req.query.plan as string;
      const typeFilter = req.query.accountType as string;

      // Whitelist sort columns to prevent SQL injection
      const ALLOWED_SORT_USER = ["created_at", "email", "first_name", "plan", "account_type"];
      const ALLOWED_SORT_PROFILE = ["last_login_at"];
      const rawSort = req.query.sortBy as string;
      const sortDir = req.query.sortDir === "asc" ? sql`ASC` : sql`DESC`;
      const isProfileSort = ALLOWED_SORT_PROFILE.includes(rawSort);
      const sortCol = isProfileSort ? rawSort : (ALLOWED_SORT_USER.includes(rawSort) ? rawSort : "created_at");

      const rows = await db.execute(sql`
        SELECT u.id, u.email, u.first_name, u.last_name, u.account_type, u.plan,
               u.stripe_subscription_id, u.stripe_customer_id, u.trial_ends_at, u.created_at,
               u.deactivated_at,
               up.last_login_at,
               COUNT(DISTINCT t.id)::int as transaction_count,
               COUNT(DISTINCT h.id)::int as habit_count,
               COUNT(DISTINCT pt.id)::int as task_count,
               COALESCE(up.discipline_score, 5) as discipline_score
        FROM users u
        LEFT JOIN transactions t ON t.user_id = u.id
        LEFT JOIN habits h ON h.user_id = u.id
        LEFT JOIN personal_tasks pt ON pt.user_id = u.id
        LEFT JOIN user_profile up ON up.user_id = u.id
        WHERE (${search} = '' OR u.email ILIKE ${'%' + search + '%'} OR u.first_name ILIKE ${'%' + search + '%'} OR u.last_name ILIKE ${'%' + search + '%'})
          AND (${planFilter || ''} = '' OR u.plan = ${planFilter || ''})
          AND (${typeFilter || ''} = '' OR u.account_type = ${typeFilter || ''})
        GROUP BY u.id, up.discipline_score, up.last_login_at
        ORDER BY ${isProfileSort ? sql`up.${sql.raw(sortCol)}` : sql`u.${sql.raw(sortCol)}`} ${sortDir}
        LIMIT ${limit} OFFSET ${offset}
      `);

      const totalCountResult = await db.execute(sql`
        SELECT COUNT(*)::int as count FROM users
        WHERE (${search} = '' OR email ILIKE ${'%' + search + '%'} OR first_name ILIKE ${'%' + search + '%'} OR last_name ILIKE ${'%' + search + '%'})
          AND (${planFilter || ''} = '' OR plan = ${planFilter || ''})
          AND (${typeFilter || ''} = '' OR account_type = ${typeFilter || ''})
      `);

      res.json({ users: rows.rows, total: (totalCountResult.rows[0] as any)?.count ?? 0, page, limit });
    } catch (err: any) {
      log(`admin users error: ${err?.message}`, "admin");
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/users/:id ─────────────────────────────────────────────
  app.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

      const [profile] = await db.select().from(userProfile).where(eq(userProfile.userId, user.id));
      const txCount = await db.select({ count: count() }).from(transactions).where(eq(transactions.userId, user.id));
      const habitCount = await db.select({ count: count() }).from(habits).where(eq(habits.userId, user.id));
      const taskCount = await db.select({ count: count() }).from(personalTasks).where(eq(personalTasks.userId, user.id));
      const recentTx = await db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(10);
      const auditHistory = await db.select().from(auditLogs).where(eq(auditLogs.targetId, user.id)).orderBy(desc(auditLogs.createdAt)).limit(20);

      res.json({ user: { ...user, password: undefined }, profile, stats: { transactions: txCount[0]?.count, habits: habitCount[0]?.count, tasks: taskCount[0]?.count }, recentTransactions: recentTx, auditHistory });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── POST /api/admin/users/:id/deactivate ─────────────────────────────────
  app.post("/api/admin/users/:id/deactivate", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const [targetUser] = await db.select().from(users).where(eq(users.id, req.params.id));
      if (!targetUser) return res.status(404).json({ message: "Usuário não encontrado" });
      // Set deactivatedAt to mark account as deactivated
      await db.update(users).set({ deactivatedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, req.params.id));
      // Invalidate all sessions for this user
      await db.execute(sql`DELETE FROM sessions WHERE sess->>'userId' = ${req.params.id}`);
      await logAudit(actor.id, actor.email, "user.deactivate", "user", req.params.id, { email: targetUser.email });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── POST /api/admin/users/:id/reactivate ─────────────────────────────────
  app.post("/api/admin/users/:id/reactivate", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const [targetUser] = await db.select().from(users).where(eq(users.id, req.params.id));
      if (!targetUser) return res.status(404).json({ message: "Usuário não encontrado" });
      await db.update(users).set({ deactivatedAt: null, updatedAt: new Date() }).where(eq(users.id, req.params.id));
      await logAudit(actor.id, actor.email, "user.reactivate", "user", req.params.id, { email: targetUser.email });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── POST /api/admin/users/:id/reset-password ─────────────────────────────
  app.post("/api/admin/users/:id/reset-password", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const [targetUser] = await db.select().from(users).where(eq(users.id, req.params.id));
      if (!targetUser) return res.status(404).json({ message: "Usuário não encontrado" });

      // Generate a secure random reset token (hex string)
      const crypto = await import("crypto");
      const rawToken = crypto.randomBytes(32).toString("hex");
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store raw token — it is single-use and time-limited
      await db.update(users).set({
        passwordResetToken: rawToken,
        passwordResetExpiry: expiry,
        updatedAt: new Date(),
      }).where(eq(users.id, req.params.id));

      const appUrl = process.env.APP_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
      const resetLink = `${appUrl}/reset-password?token=${rawToken}`;

      try {
        await sendEmail({
          to: targetUser.email!,
          subject: "AXIS — Redefinição de Senha / Password Reset",
          html: `
            <p>O administrador solicitou a redefinição da sua senha AXIS.</p>
            <p><a href="${resetLink}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Redefinir Senha</a></p>
            <p>O link expira em 24 horas. Se não solicitou, ignore este e-mail.</p>
            <hr/>
            <p>An administrator initiated a password reset for your AXIS account.</p>
            <p><a href="${resetLink}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a></p>
            <p>This link expires in 24 hours. If you did not request this, please ignore this email.</p>
          `,
        });
      } catch (emailErr: any) {
        log(`reset-password email failed: ${emailErr?.message}`, "admin");
      }

      await logAudit(actor.id, actor.email, "user.reset_password", "user", req.params.id, { email: targetUser.email });
      res.json({ success: true, message: `Password reset link sent to ${targetUser.email}` });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── DELETE /api/admin/users/:id ─────────────────────────────────────────
  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      await logAudit(actor.id, actor.email, "user.delete", "user", req.params.id, { email: user.email });
      // Cascade delete - remove all user data
      await db.delete(transactions).where(eq(transactions.userId, req.params.id));
      await db.delete(habits).where(eq(habits.userId, req.params.id));
      await db.delete(habitLogs).where(eq(habitLogs.userId, req.params.id));
      await db.delete(personalTasks).where(eq(personalTasks.userId, req.params.id));
      await db.delete(userProfile).where(eq(userProfile.userId, req.params.id));
      await db.delete(emailAlertLog).where(eq(emailAlertLog.userId, req.params.id));
      await db.execute(sql`DELETE FROM sessions WHERE sess->>'userId' = ${req.params.id}`);
      await db.delete(users).where(eq(users.id, req.params.id));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── PATCH /api/admin/users/:id/plan ─────────────────────────────────────
  app.patch("/api/admin/users/:id/plan", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const { plan, reason } = req.body;
      if (!["starter", "personal_ai", "team"].includes(plan)) return res.status(400).json({ message: "Plano inválido" });
      const [user] = await db.select().from(users).where(eq(users.id, req.params.id));
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      const oldPlan = user.plan;
      await db.update(users).set({ plan }).where(eq(users.id, req.params.id));
      await logAudit(actor.id, actor.email, "user.plan_override", "user", req.params.id, { oldPlan, newPlan: plan, reason });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/organizations ─────────────────────────────────────────
  app.get("/api/admin/organizations", requireAdmin, async (req, res) => {
    try {
      const { page, limit, offset, search } = getPagination(req);
      const period = getPeriodBounds();

      const orgs = await db.execute(sql`
        SELECT o.id, o.name, o.cnpj, o.created_at,
               u.email as owner_email, u.first_name as owner_first_name, u.last_name as owner_last_name,
               COUNT(DISTINCT om.id)::int as member_count,
               COALESCE(SUM(CASE WHEN be.created_at >= ${period.current.start} THEN be.amount ELSE 0 END), 0)::real as current_month_expenses,
               COALESCE(SUM(CASE WHEN be.created_at >= ${period.previous.start} AND be.created_at <= ${period.previous.end} THEN be.amount ELSE 0 END), 0)::real as prev_month_expenses,
               COALESCE(SUM(be.amount), 0)::real as total_expenses
        FROM organizations o
        LEFT JOIN users u ON u.id = o.admin_user_id
        LEFT JOIN organization_members om ON om.organization_id = o.id
        LEFT JOIN business_expenses be ON be.organization_id = o.id
        WHERE (${search} = '' OR o.name ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'})
        GROUP BY o.id, u.email, u.first_name, u.last_name
        ORDER BY o.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const totalCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM organizations`);

      res.json({ organizations: orgs.rows, total: (totalCountResult.rows[0] as any)?.count ?? 0, page, limit });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/organizations/:id ─────────────────────────────────────
  app.get("/api/admin/organizations/:id", requireAdmin, async (req, res) => {
    try {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, req.params.id));
      if (!org) return res.status(404).json({ message: "Organização não encontrada" });

      const members = await db.execute(sql`
        SELECT om.*, u.email, u.first_name, u.last_name, u.account_type
        FROM organization_members om
        LEFT JOIN users u ON u.id = om.user_id
        WHERE om.organization_id = ${req.params.id}
      `);

      const categoryBreakdown = await db.execute(sql`
        SELECT category_name, SUM(amount)::real as total, COUNT(*)::int as count
        FROM business_expenses
        WHERE organization_id = ${req.params.id}
        GROUP BY category_name
        ORDER BY total DESC
        LIMIT 10
      `);

      const [pendingCount] = await db.select({ count: count() }).from(businessExpenses).where(and(eq(businessExpenses.organizationId, req.params.id), eq(businessExpenses.status, "pending_review")));

      res.json({ org, members: members.rows, categoryBreakdown: categoryBreakdown.rows, pendingApprovals: pendingCount.count });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── POST /api/admin/organizations/:id/impersonate ────────────────────────
  // Read-only preview of the org owner's context.
  // Does NOT replace userId in session — sets viewingUserId for read-only access.
  // All POST/PUT/PATCH/DELETE routes (except /api/admin/*) are blocked while viewing.
  app.post("/api/admin/organizations/:id/impersonate", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const [org] = await db.select().from(organizations).where(eq(organizations.id, req.params.id));
      if (!org) return res.status(404).json({ message: "Organização não encontrada" });

      // Find org owner
      const [ownerMember] = await db.select().from(organizationMembers)
        .where(and(eq(organizationMembers.organizationId, req.params.id), eq(organizationMembers.role, "owner")));
      if (!ownerMember) return res.status(404).json({ message: "Proprietário não encontrado" });

      // Set read-only viewing context — admin userId unchanged
      req.session.viewingUserId = ownerMember.userId;
      req.session.viewingOrgId = req.params.id;

      await logAudit(actor.id, actor.email, "org.impersonate", "organization", req.params.id, { orgName: org.name, targetUserId: ownerMember.userId });
      res.json({ success: true, orgName: org.name, viewingUserId: ownerMember.userId });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── POST /api/admin/impersonate/stop ─────────────────────────────────────
  // Clears the read-only viewing context
  app.post("/api/admin/impersonate/stop", requireAdmin, async (req, res) => {
    try {
      delete req.session.viewingUserId;
      delete req.session.viewingOrgId;
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/finance/overview ──────────────────────────────────────
  app.get("/api/admin/finance/overview", requireAdmin, async (req, res) => {
    try {
      const monthlyVolume = await db.execute(sql`
        SELECT
          TO_CHAR(date, 'YYYY-MM') as month,
          SUM(CASE WHEN u.account_type = 'personal' THEN t.amount ELSE 0 END)::real as personal_volume,
          SUM(CASE WHEN u.account_type IN ('business','collaborator') THEN t.amount ELSE 0 END)::real as business_volume,
          SUM(t.amount)::real as total_volume,
          COUNT(*)::int as count
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        WHERE t.date >= NOW() - INTERVAL '12 months' AND t.type = 'expense'
        GROUP BY TO_CHAR(date, 'YYYY-MM')
        ORDER BY month ASC
      `);

      const topCategories = await db.execute(sql`
        SELECT category_name, SUM(amount)::real as total, COUNT(*)::int as count
        FROM transactions
        WHERE type = 'expense' AND category_name IS NOT NULL
        GROUP BY category_name
        ORDER BY total DESC
        LIMIT 10
      `);

      const avgPersonalResult = await db.execute(sql`
        SELECT AVG(user_total)::real as avg FROM (
          SELECT user_id, SUM(amount) as user_total FROM transactions
          WHERE type = 'expense'
          GROUP BY user_id
        ) sub
      `);

      const currencies = await db.execute(sql`
        SELECT COALESCE(up.currency, 'BRL') as currency, COUNT(DISTINCT u.id)::int as count
        FROM users u
        LEFT JOIN user_profile up ON up.user_id = u.id
        GROUP BY COALESCE(up.currency, 'BRL')
        ORDER BY count DESC
      `);

      const period = getPeriodBounds();
      const currentVolResult = await db.execute(sql`SELECT COALESCE(SUM(amount),0)::real as vol FROM transactions WHERE type='expense' AND date >= ${period.current.start}`);
      const prevVolResult = await db.execute(sql`SELECT COALESCE(SUM(amount),0)::real as vol FROM transactions WHERE type='expense' AND date >= ${period.previous.start} AND date <= ${period.previous.end}`);

      res.json({
        monthlyVolume: monthlyVolume.rows,
        topCategories: topCategories.rows,
        avgSpendPerUser: (avgPersonalResult.rows[0] as any)?.avg ?? 0,
        currencies: currencies.rows,
        currentMonthVolume: (currentVolResult.rows[0] as any)?.vol ?? 0,
        prevMonthVolume: (prevVolResult.rows[0] as any)?.vol ?? 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/finance/transactions ──────────────────────────────────
  app.get("/api/admin/finance/transactions", requireAdmin, async (req, res) => {
    try {
      const { page, limit, offset, search } = getPagination(req);
      const typeFilter = req.query.type as string;
      const categoryFilter = req.query.category as string;
      const dateFrom = req.query.dateFrom as string;
      const dateTo = req.query.dateTo as string;

      const rows = await db.execute(sql`
        SELECT t.*, u.email as user_email, u.first_name, u.last_name
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        WHERE (${search} = '' OR t.description ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'})
          AND (${typeFilter || ''} = '' OR t.type = ${typeFilter || ''})
          AND (${categoryFilter || ''} = '' OR t.category_name = ${categoryFilter || ''})
          AND (${dateFrom || ''} = '' OR t.date >= ${dateFrom ? new Date(dateFrom) : new Date(0)})
          AND (${dateTo || ''} = '' OR t.date <= ${dateTo ? new Date(dateTo) : new Date()})
        ORDER BY t.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const totalCountResult = await db.execute(sql`
        SELECT COUNT(*)::int as count
        FROM transactions t
        LEFT JOIN users u ON u.id = t.user_id
        WHERE (${search} = '' OR t.description ILIKE ${'%' + search + '%'} OR u.email ILIKE ${'%' + search + '%'})
          AND (${typeFilter || ''} = '' OR t.type = ${typeFilter || ''})
          AND (${categoryFilter || ''} = '' OR t.category_name = ${categoryFilter || ''})
          AND (${dateFrom || ''} = '' OR t.date >= ${dateFrom ? new Date(dateFrom) : new Date(0)})
          AND (${dateTo || ''} = '' OR t.date <= ${dateTo ? new Date(dateTo) : new Date()})
      `);

      res.json({ transactions: rows.rows, total: (totalCountResult.rows[0] as any)?.count ?? 0, page, limit });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/billing/overview ──────────────────────────────────────
  app.get("/api/admin/billing/overview", requireAdmin, async (req, res) => {
    try {
      const planCounts = await db.execute(sql`
        SELECT plan, account_type, COUNT(*)::int as count
        FROM users
        GROUP BY plan, account_type
        ORDER BY plan
      `);

      const [trialUsers] = await db.select({ count: count() }).from(users).where(isNotNull(users.trialEndsAt));
      const [payingPersonalAI] = await db.select({ count: count() }).from(users).where(eq(users.plan, "personal_ai"));
      const [payingTeam] = await db.select({ count: count() }).from(users).where(eq(users.plan, "team"));
      const [starterCount] = await db.select({ count: count() }).from(users).where(eq(users.plan, "starter"));

      const mrr = (payingPersonalAI.count * 9) + (payingTeam.count * 29);

      const period = getPeriodBounds();
      const [newSubscribersThisMonth] = await db.select({ count: count() }).from(users).where(
        and(isNotNull(users.stripeSubscriptionId), gte(users.createdAt, period.current.start))
      );
      const [newSubscribersPrevMonth] = await db.select({ count: count() }).from(users).where(
        and(isNotNull(users.stripeSubscriptionId), gte(users.createdAt, period.previous.start), lte(users.createdAt, period.previous.end))
      );

      res.json({
        planCounts: planCounts.rows,
        mrr,
        payingUsers: payingPersonalAI.count + payingTeam.count,
        personalAICount: payingPersonalAI.count,
        teamCount: payingTeam.count,
        starterCount: starterCount.count,
        trialUsers: trialUsers.count,
        newSubscribersThisMonth: newSubscribersThisMonth.count,
        newSubscribersPrevMonth: newSubscribersPrevMonth.count,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/billing/subscriptions ─────────────────────────────────
  app.get("/api/admin/billing/subscriptions", requireAdmin, async (req, res) => {
    try {
      const { page, limit, offset, search } = getPagination(req);

      const rows = await db.execute(sql`
        SELECT id, email, first_name, last_name, plan, account_type,
               stripe_customer_id, stripe_subscription_id, trial_ends_at, created_at
        FROM users
        WHERE stripe_subscription_id IS NOT NULL
          AND (${search} = '' OR email ILIKE ${'%' + search + '%'})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const totalCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM users WHERE stripe_subscription_id IS NOT NULL`);

      res.json({ subscriptions: rows.rows, total: (totalCountResult.rows[0] as any)?.count ?? 0, page, limit });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── WhatsApp Config endpoints ────────────────────────────────────────────
  app.get("/api/admin/whatsapp/config", requireAdmin, async (req, res) => {
    try {
      const [botNumber] = await db.select().from(systemConfig).where(eq(systemConfig.key, "whatsapp_bot_number"));
      const [displayName] = await db.select().from(systemConfig).where(eq(systemConfig.key, "whatsapp_display_name"));
      const connectedPhone = whatsappManager.getConnectedPhone();
      const status = whatsappManager.getStatus();

      res.json({
        configuredNumber: botNumber?.value ?? process.env.WHATSAPP_BOT_NUMBER ?? null,
        displayName: displayName?.value ?? "AXIS Assistente",
        connectedPhone,
        status,
        isNumberMatch: botNumber?.value ? botNumber.value === connectedPhone : null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  app.post("/api/admin/whatsapp/config", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const { botNumber, displayName } = req.body;

      if (botNumber !== undefined) {
        await db.insert(systemConfig).values({ key: "whatsapp_bot_number", value: botNumber, updatedAt: new Date() }).onConflictDoUpdate({ target: systemConfig.key, set: { value: botNumber, updatedAt: new Date() } });
      }
      if (displayName !== undefined) {
        await db.insert(systemConfig).values({ key: "whatsapp_display_name", value: displayName, updatedAt: new Date() }).onConflictDoUpdate({ target: systemConfig.key, set: { value: displayName, updatedAt: new Date() } });
      }

      await logAudit(actor.id, actor.email, "admin.whatsapp_config", "system", null, { botNumber, displayName });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/whatsapp/logs ─────────────────────────────────────────
  app.get("/api/admin/whatsapp/logs", requireAdmin, async (req, res) => {
    try {
      const { limit, offset } = getPagination(req);
      const logs = await db.select().from(whatsappLogs).orderBy(desc(whatsappLogs.createdAt)).limit(limit).offset(offset);
      const [total] = await db.select({ count: count() }).from(whatsappLogs);
      res.json({ logs, total: total.count });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/email-logs ────────────────────────────────────────────
  app.get("/api/admin/email-logs", requireAdmin, async (req, res) => {
    try {
      const { page, limit, offset, search } = getPagination(req);
      const alertTypeFilter = req.query.alertType as string;

      const rows = await db.execute(sql`
        SELECT eal.*, u.email as user_email, u.first_name, u.last_name
        FROM email_alert_log eal
        LEFT JOIN users u ON u.id = eal.user_id
        WHERE (${alertTypeFilter || ''} = '' OR eal.alert_type = ${alertTypeFilter || ''})
          AND (${search} = '' OR u.email ILIKE ${'%' + search + '%'} OR eal.recipient ILIKE ${'%' + search + '%'})
        ORDER BY eal.sent_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const totalCountResult = await db.execute(sql`
        SELECT COUNT(*)::int as count
        FROM email_alert_log eal
        LEFT JOIN users u ON u.id = eal.user_id
        WHERE (${alertTypeFilter || ''} = '' OR eal.alert_type = ${alertTypeFilter || ''})
          AND (${search} = '' OR u.email ILIKE ${'%' + search + '%'} OR eal.recipient ILIKE ${'%' + search + '%'})
      `);

      const period = getPeriodBounds();
      const [currentMonth] = await db.select({ count: count() }).from(emailAlertLog).where(gte(emailAlertLog.sentAt, period.current.start));
      const [prevMonth] = await db.select({ count: count() }).from(emailAlertLog).where(and(gte(emailAlertLog.sentAt, period.previous.start), lte(emailAlertLog.sentAt, period.previous.end)));

      const typeCounts = await db.execute(sql`SELECT alert_type, COUNT(*)::int as count FROM email_alert_log GROUP BY alert_type ORDER BY count DESC`);

      res.json({
        logs: rows.rows,
        total: (totalCountResult.rows[0] as any)?.count ?? 0,
        page,
        limit,
        currentMonth: currentMonth.count,
        prevMonth: prevMonth.count,
        typeCounts: typeCounts.rows,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/ai/overview ───────────────────────────────────────────
  app.get("/api/admin/ai/overview", requireAdmin, async (req, res) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const period = getPeriodBounds();

      const [totalToday] = await db.select({ count: count() }).from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, todayStart));
      const [totalYesterday] = await db.select({ count: count() }).from(aiUsageLogs).where(and(gte(aiUsageLogs.createdAt, yesterdayStart), lte(aiUsageLogs.createdAt, todayStart)));
      const [totalThisMonth] = await db.select({ count: count() }).from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, period.current.start));
      const [totalPrevMonth] = await db.select({ count: count() }).from(aiUsageLogs).where(and(gte(aiUsageLogs.createdAt, period.previous.start), lte(aiUsageLogs.createdAt, period.previous.end)));

      const breakdown = await db.execute(sql`
        SELECT call_type, COUNT(*)::int as count, COALESCE(SUM(tokens_used),0)::int as total_tokens
        FROM ai_usage_logs
        GROUP BY call_type
        ORDER BY count DESC
      `);

      const recentCalls = await db.execute(sql`
        SELECT al.*, u.email as user_email
        FROM ai_usage_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 50
      `);

      res.json({
        today: totalToday.count,
        yesterday: totalYesterday.count,
        thisMonth: totalThisMonth.count,
        prevMonth: totalPrevMonth.count,
        breakdown: breakdown.rows,
        recentCalls: recentCalls.rows,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/ai/status ─────────────────────────────────────────────
  app.get("/api/admin/ai/status", requireAdmin, async (req, res) => {
    try {
      const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      let valid = false;
      if (apiKey) {
        try {
          const resp = await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
          valid = resp.ok;
        } catch { valid = false; }
      }
      res.json({ set: !!apiKey, valid });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/ai/logs ───────────────────────────────────────────────
  app.get("/api/admin/ai/logs", requireAdmin, async (req, res) => {
    try {
      const { page, limit, offset, search } = getPagination(req);
      const callTypeFilter = req.query.callType as string;

      const rows = await db.execute(sql`
        SELECT al.*, u.email as user_email
        FROM ai_usage_logs al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE (${callTypeFilter || ''} = '' OR al.call_type = ${callTypeFilter || ''})
          AND (${search} = '' OR u.email ILIKE ${'%' + search + '%'} OR al.call_type ILIKE ${'%' + search + '%'})
        ORDER BY al.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const totalCountResult = await db.execute(sql`
        SELECT COUNT(*)::int as count
        FROM ai_usage_logs al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE (${callTypeFilter || ''} = '' OR al.call_type = ${callTypeFilter || ''})
          AND (${search} = '' OR u.email ILIKE ${'%' + search + '%'} OR al.call_type ILIKE ${'%' + search + '%'})
      `);

      res.json({ logs: rows.rows, total: (totalCountResult.rows[0] as any)?.count ?? 0, page, limit });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/system/config ─────────────────────────────────────────
  app.get("/api/admin/system/config", requireAdmin, async (req, res) => {
    const envStatus = (key: string) => !!process.env[key];
    const maskEmail = (email: string | undefined) => email ? email.replace(/(.{2}).+(@.+)/, '$1***$2') : null;

    const [maintenanceRow] = await db.select().from(systemConfig).where(eq(systemConfig.key, "maintenance_mode"));
    const allConfigs = await db.select().from(systemConfig).orderBy(asc(systemConfig.key));

    res.json({
      envVars: [
        { key: "APP_URL", set: envStatus("APP_URL"), value: process.env.APP_URL || null },
        { key: "ADMIN_EMAIL", set: envStatus("ADMIN_EMAIL"), value: maskEmail(process.env.ADMIN_EMAIL) },
        { key: "OPENAI_API_KEY", set: envStatus("AI_INTEGRATIONS_OPENAI_API_KEY") || envStatus("OPENAI_API_KEY") },
        { key: "STRIPE_SECRET_KEY", set: envStatus("STRIPE_SECRET_KEY") },
        { key: "STRIPE_WEBHOOK_SECRET", set: envStatus("STRIPE_WEBHOOK_SECRET") },
        { key: "SENDGRID_API_KEY", set: envStatus("SENDGRID_API_KEY") || envStatus("SENDGRID_INTEGRATIONS_SENDGRID_API_KEY") },
        { key: "DATABASE_URL", set: envStatus("DATABASE_URL") },
        { key: "SESSION_SECRET", set: envStatus("SESSION_SECRET") },
      ],
      configs: allConfigs,
      maintenanceMode: maintenanceRow?.value === "true",
    });
  });

  // ─── POST /api/admin/system/config ────────────────────────────────────────
  app.post("/api/admin/system/config", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const { key, value } = req.body;
      if (!key || typeof key !== "string") return res.status(400).json({ message: "key é obrigatório" });
      await db.insert(systemConfig).values({ key, value: String(value ?? ""), updatedAt: new Date() })
        .onConflictDoUpdate({ target: systemConfig.key, set: { value: String(value ?? ""), updatedAt: new Date() } });
      await logAudit(actor.id, actor.email, "admin.config_update", "system", null, { key, value });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── DELETE /api/admin/system/config/:key ─────────────────────────────────
  app.delete("/api/admin/system/config/:key", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      await db.delete(systemConfig).where(eq(systemConfig.key, req.params.key));
      await logAudit(actor.id, actor.email, "admin.config_delete", "system", null, { key: req.params.key });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/system/health ─────────────────────────────────────────
  app.get("/api/admin/system/health", requireAdmin, async (req, res) => {
    try {
      let dbConnected = false;
      try {
        await db.execute(sql`SELECT 1`);
        dbConnected = true;
      } catch { dbConnected = false; }

      const mem = process.memoryUsage();
      res.json({
        dbConnected,
        uptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
        memory: { rss: Math.round(mem.rss / 1024 / 1024), heapUsed: Math.round(mem.heapUsed / 1024 / 1024), heapTotal: Math.round(mem.heapTotal / 1024 / 1024) },
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── POST /api/admin/system/maintenance ───────────────────────────────────
  app.post("/api/admin/system/maintenance", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const { enabled } = req.body;
      await db.insert(systemConfig).values({ key: "maintenance_mode", value: String(!!enabled), updatedAt: new Date() }).onConflictDoUpdate({ target: systemConfig.key, set: { value: String(!!enabled), updatedAt: new Date() } });
      await logAudit(actor.id, actor.email, "admin.maintenance_toggle", "system", null, { enabled });
      res.json({ success: true, maintenanceMode: !!enabled });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/audit-logs ────────────────────────────────────────────
  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const { page, limit, offset } = getPagination(req);
      const actionFilter = req.query.action as string;
      const actorFilter = req.query.actor as string;

      const rows = await db.execute(sql`
        SELECT * FROM audit_logs
        WHERE (${actionFilter || ''} = '' OR action = ${actionFilter || ''})
          AND (${actorFilter || ''} = '' OR actor_email ILIKE ${'%' + actorFilter + '%'})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const totalCountResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM audit_logs`);

      res.json({ logs: rows.rows, total: (totalCountResult.rows[0] as any)?.count ?? 0, page, limit });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── POST /api/admin/demo/seed ────────────────────────────────────────────
  app.post("/api/admin/demo/seed", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const demoEmail = "demo@axis.app";
      const demoPassword = "demo1234";

      // Check if demo user already exists
      const [existing] = await db.select().from(users).where(eq(users.email, demoEmail));
      if (existing) {
        return res.status(409).json({ message: "Demo user already exists. Use /reset to recreate." });
      }

      const bcrypt = await import("bcryptjs");
      const hashed = await bcrypt.hash(demoPassword, 10);

      const [demoUser] = await db.insert(users).values({
        email: demoEmail,
        firstName: "Demo",
        lastName: "User",
        password: hashed,
        accountType: "personal",
        plan: "personal_ai",
        onboardingCompleted: true,
      }).returning();

      // Seed 90 days of transactions
      const categories = ["alimentação", "mercado", "transporte", "lazer", "moradia", "saúde", "educação", "combustível"];
      const descriptions = {
        alimentação: ["iFood", "McDonald's", "Restaurante", "Padaria", "Café"],
        mercado: ["Supermercado", "Atacadão", "Carrefour"],
        transporte: ["Uber", "99", "Ônibus"],
        lazer: ["Netflix", "Cinema", "Bar"],
        moradia: ["Aluguel", "Conta de Luz", "Internet"],
        saúde: ["Farmácia", "Médico", "Academia"],
        educação: ["Curso Online", "Livros", "Escola"],
        combustível: ["Posto Shell", "Posto Ipiranga"],
      };

      const txValues: any[] = [];
      const now = new Date();
      for (let i = 0; i < 90; i++) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const numTx = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < numTx; j++) {
          const cat = categories[Math.floor(Math.random() * categories.length)] as keyof typeof descriptions;
          const desc = descriptions[cat][Math.floor(Math.random() * descriptions[cat].length)];
          txValues.push({ userId: demoUser.id, amount: Math.floor(Math.random() * 200 + 10), description: desc, categoryName: cat, type: "expense", date, source: "manual" });
        }
        // Occasional income
        if (i % 30 === 0) {
          txValues.push({ userId: demoUser.id, amount: 5000, description: "Salário", categoryName: "trabalho", type: "income", date, source: "manual" });
        }
      }
      await db.insert(transactions).values(txValues);

      await logAudit(actor.id, actor.email, "admin.demo_seed", "system", demoUser.id);
      res.json({ success: true, credentials: { email: demoEmail, password: demoPassword } });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── POST /api/admin/demo/reset ───────────────────────────────────────────
  app.post("/api/admin/demo/reset", requireAdmin, async (req, res) => {
    try {
      const actor = req.adminUser;
      const [demoUser] = await db.select().from(users).where(eq(users.email, "demo@axis.app"));
      if (demoUser) {
        await db.delete(transactions).where(eq(transactions.userId, demoUser.id));
        await db.delete(habits).where(eq(habits.userId, demoUser.id));
        await db.delete(personalTasks).where(eq(personalTasks.userId, demoUser.id));
        await db.delete(userProfile).where(eq(userProfile.userId, demoUser.id));
        await db.delete(users).where(eq(users.id, demoUser.id));
      }
      await logAudit(actor.id, actor.email, "admin.demo_reset", "system", null);
      res.json({ success: true, message: "Demo user deleted. Seed again to recreate." });
    } catch (err: any) {
      res.status(500).json({ message: err?.message });
    }
  });

  // ─── GET /api/admin/rate-limits/status ────────────────────────────────────
  app.get("/api/admin/rate-limits/status", requireAdmin, async (req, res) => {
    res.json({
      global: { windowMs: 60_000, max: 300, description: "Global API" },
      auth: { windowMs: 900_000, max: 20, description: "Auth endpoints (login/register)" },
      whatsapp: { windowMs: 60_000, max: 20, description: "WhatsApp bot inbound (per phone)" },
      ai: { windowMs: 60_000, max: 30, description: "AI endpoints (per user)" },
    });
  });

  log("Admin routes registered", "admin");
}

// ─── Read-Only Viewing Mode Middleware ───────────────────────────────────────────
// Blocks all mutating requests when the admin is in read-only impersonation mode.
// Register this AFTER maintenanceMiddleware but BEFORE all other routes in routes.ts.
export function viewingModeMiddleware(req: Request, res: Response, next: NextFunction) {
  const viewingUserId = req.session?.viewingUserId;
  if (
    viewingUserId &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(req.method) &&
    !req.path.startsWith("/api/admin")
  ) {
    return res.status(403).json({ message: "Operação bloqueada: você está em modo de visualização somente leitura." });
  }
  next();
}

// ─── Maintenance Mode Middleware ───────────────────────────────────────────────
// Returns 503 for all non-admin, non-static API routes when maintenance is on.
// Register this BEFORE all other routes in routes.ts.
export async function maintenanceMiddleware(req: Request, res: Response, next: NextFunction) {
  // Skip admin routes, auth routes, and static assets
  if (
    req.path.startsWith("/api/admin") ||
    req.path.startsWith("/api/auth") ||
    req.path.startsWith("/assets") ||
    !req.path.startsWith("/api/")
  ) {
    return next();
  }

  try {
    const [row] = await db.select().from(systemConfig).where(eq(systemConfig.key, "maintenance_mode"));
    if (row?.value === "true") {
      // Allow admin users through even in maintenance mode
      const adminEmail = process.env.ADMIN_EMAIL;
      const userId = req.session?.userId;
      if (adminEmail && userId) {
        const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
        if (user?.email === adminEmail) return next();
      }
      return res.status(503).json({ message: "O sistema está em manutenção. Tente novamente em breve.", maintenanceMode: true });
    }
  } catch {
    // If DB check fails, allow through to not block normal operation
  }
  next();
}
