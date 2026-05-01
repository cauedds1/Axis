-- Additive billing & usage-limits migration
-- Safe to run on existing databases: all statements use IF NOT EXISTS guards.
-- Adds plan/Stripe columns to users and creates the usage_counters table.

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "plan" text NOT NULL DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" varchar,
  ADD COLUMN IF NOT EXISTS "trial_ends_at" timestamp;

CREATE TABLE IF NOT EXISTS "usage_counters" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" varchar NOT NULL,
  "month" varchar(7) NOT NULL,
  "transactions" integer DEFAULT 0 NOT NULL,
  "ai_captures" integer DEFAULT 0 NOT NULL,
  "whatsapp_photos" integer DEFAULT 0 NOT NULL,
  "whatsapp_pdfs" integer DEFAULT 0 NOT NULL,
  "chat_messages" integer DEFAULT 0 NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_usage_user_month"
  ON "usage_counters" USING btree ("user_id", "month");
