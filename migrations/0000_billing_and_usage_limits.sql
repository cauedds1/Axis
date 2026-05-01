CREATE TABLE "bills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"amount" real NOT NULL,
	"type" text DEFAULT 'expense' NOT NULL,
	"due_day" integer DEFAULT 1 NOT NULL,
	"category_name" text,
	"recurrence_type" text DEFAULT 'permanent' NOT NULL,
	"recurrence_end_date" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"paid_months" text DEFAULT '[]' NOT NULL,
	"notes" text,
	"bill_streak" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_bills" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"description" text NOT NULL,
	"amount" real NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"supplier" text,
	"category_name" text,
	"payment_method" text,
	"cost_center" text,
	"receipt_image_url" text,
	"notes" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_corporate_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"name" text NOT NULL,
	"last4" varchar(4) NOT NULL,
	"brand" text DEFAULT 'Visa' NOT NULL,
	"limit_amount" real DEFAULT 0 NOT NULL,
	"current_balance" real DEFAULT 0 NOT NULL,
	"holder" text NOT NULL,
	"closing_day" integer DEFAULT 1 NOT NULL,
	"color" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" real NOT NULL,
	"description" text NOT NULL,
	"category_name" text,
	"date" timestamp DEFAULT now(),
	"establishment" text,
	"receipt_image_base64" text,
	"receipt_image_url" text,
	"receipt_items" text,
	"payment_method" text,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"rejection_comment" text,
	"paid_at" timestamp,
	"notes" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_receivables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"description" text NOT NULL,
	"amount" real NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"client" text,
	"payment_method" text,
	"cost_center" text,
	"notes" text,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"type" text DEFAULT 'expense' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_card_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"credit_card_id" varchar NOT NULL,
	"month_key" text NOT NULL,
	"total" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"bill_id" text,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"bank" text NOT NULL,
	"limit" real NOT NULL,
	"closing_day" integer NOT NULL,
	"due_day" integer NOT NULL,
	"color" text DEFAULT '#7C3AED',
	"active" boolean DEFAULT true NOT NULL,
	"limit_history" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "discipline_score_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"score" integer NOT NULL,
	"previous_score" integer NOT NULL,
	"delta" integer NOT NULL,
	"reasons" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_alert_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"alert_type" text NOT NULL,
	"reference_id" text,
	"sent_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"emoji" text,
	"description" text,
	"target_amount" real,
	"current_amount" real DEFAULT 0 NOT NULL,
	"deadline" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"date" date NOT NULL,
	"completed" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"streak" integer DEFAULT 0 NOT NULL,
	"last_checked" date,
	"emoji" text DEFAULT '⚡',
	"target_time" text,
	"end_time" text,
	"description" text,
	"weekdays" text,
	"last_penalized_date" date,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"job_title" text,
	"joined_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"trade_name" text,
	"cnpj" text,
	"country" text,
	"segment" text,
	"closing_day" integer,
	"admin_user_id" varchar NOT NULL,
	"spending_limits" text,
	"logo_url" text,
	"logo_base64" text,
	"primary_color" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "personal_tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"due_date" timestamp,
	"category" text,
	"discipline_penalized" boolean DEFAULT false NOT NULL,
	"justification" text,
	"justification_score" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recurring_incomes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"amount" real NOT NULL,
	"day_of_month" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_posted_month" text,
	"category_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_shares" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_item_cancellations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"entity_type" text DEFAULT 'schedule' NOT NULL,
	"schedule_item_id" varchar,
	"habit_id" varchar,
	"date" text NOT NULL,
	"reason" text,
	"type" text DEFAULT 'other' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "schedule_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"suggested_by_ai" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" real NOT NULL,
	"description" text NOT NULL,
	"category_id" varchar,
	"category_name" text,
	"type" text DEFAULT 'expense' NOT NULL,
	"date" timestamp DEFAULT now(),
	"source" text DEFAULT 'manual' NOT NULL,
	"establishment" text,
	"location" text,
	"payment_method" text,
	"receipt_items" text,
	"date_only" boolean DEFAULT false NOT NULL,
	"credit_card_id" varchar,
	"installment_info" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"age" integer,
	"profession" text,
	"work_type" text,
	"city" text,
	"discipline_score" integer DEFAULT 5,
	"discipline_points" integer DEFAULT 0,
	"main_problem" text,
	"feeling_status" text,
	"one_year_goal" text,
	"income_goal" text,
	"focus_area" text,
	"time_available" text,
	"ai_diagnosis" text,
	"last_login_at" timestamp,
	"email_alerts" text DEFAULT '{"billDueSoon":true,"offlineReminder":true}',
	"whatsapp_phone" text,
	"whatsapp_jid" text,
	"initial_balance" real DEFAULT 0,
	"last_spending_analysis" timestamp,
	"currency" varchar DEFAULT 'BRL',
	"currency_set_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_auth" (
	"key" varchar PRIMARY KEY NOT NULL,
	"data" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_counters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"month" varchar(7) NOT NULL,
	"transactions" integer DEFAULT 0 NOT NULL,
	"ai_captures" integer DEFAULT 0 NOT NULL,
	"whatsapp_photos" integer DEFAULT 0 NOT NULL,
	"whatsapp_pdfs" integer DEFAULT 0 NOT NULL,
	"chat_messages" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"password" varchar,
	"profile_image_url" varchar,
	"onboarding_completed" boolean DEFAULT false,
	"active_modules" text[] DEFAULT ARRAY[]::text[],
	"theme" text DEFAULT 'slim',
	"ai_personality" text DEFAULT 'calm',
	"account_type" text DEFAULT 'personal' NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"trial_ends_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_context" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_biz_exp_org" ON "business_expenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_biz_exp_user" ON "business_expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_biz_exp_status" ON "business_expenses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_biz_exp_date" ON "business_expenses" USING btree ("date");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_usage_user_month" ON "usage_counters" USING btree ("user_id","month");