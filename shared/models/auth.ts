import { sql } from "drizzle-orm";
import { index, uniqueIndex, jsonb, pgTable, timestamp, varchar, boolean, text, integer } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  password: varchar("password"),
  profileImageUrl: varchar("profile_image_url"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  activeModules: text("active_modules").array().default(sql`ARRAY[]::text[]`),
  theme: text("theme").default("slim"),
  aiPersonality: text("ai_personality").default("calm"),
  accountType: text("account_type").notNull().default("personal"),
  plan: text("plan").notNull().default("starter"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  trialEndsAt: timestamp("trial_ends_at"),
  deactivatedAt: timestamp("deactivated_at"),
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const usageCounters = pgTable("usage_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  transactions: integer("transactions").notNull().default(0),
  aiCaptures: integer("ai_captures").notNull().default(0),
  whatsappPhotos: integer("whatsapp_photos").notNull().default(0),
  whatsappPdfs: integer("whatsapp_pdfs").notNull().default(0),
  chatMessages: integer("chat_messages").notNull().default(0),
},
(table) => [uniqueIndex("idx_usage_user_month").on(table.userId, table.month)]
);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type UsageCounter = typeof usageCounters.$inferSelect;
