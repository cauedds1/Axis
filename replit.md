# AXIS - Assistente de Vida Pessoal

## Overview
Multi-tenant SaaS personal life assistant with voice and text input. Organizes finances (expenses + income + goals via voice/text/PDF/receipt photo), smart agenda (calendar with AI suggestions + approval flow), tasks, habits (streaks + discipline score), and a chatbot with full context access and long-term memory.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + wouter routing + TanStack Query + Framer Motion
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon) via Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (transcription, intent detection, receipt/PDF analysis, contextual chat)
- **Auth**: Native email/password (bcrypt + express-session)
- **Themes**: Two dark themes — Slim (achromatic minimalist) and High (electric cyan accent with vivid palette)

## Key Features
- Dual input: every voice input has text equivalent (mic + text field always visible)
- AI intent detection: "gastei 45 no almoço" → expense R$45, alimentação
- Receipt photo upload: AI extracts items, establishment, total → preview before confirming
- PDF smart import: AI classifies document type (extrato vs conta/NFS-e/boleto) → extratos geram transações, contas/notas fiscais geram bills com campos editáveis
- Identity recognition: when a bill/NFS-e has two entities (issuer + recipient), system asks "quem é você?" via WhatsApp/chat/UI, saves the answer to `user_context` (key: `identity_entities`), and auto-determines bill type (A Pagar/A Receber) for future invoices with the same CNPJ
- Smart agenda: AI suggests time slots, user approves/rejects/edits
- Habits with streaks and daily check-in
- Discipline score visible on sidebar and dashboard
- Contextual chatbot with access to all user data (finances, tasks, schedule, habits)
- Welcome screen after registration (before onboarding): shows modules, next steps, CTA
- Conversational onboarding: 4 layers (basics → current state → ambition → AI personality)
- Module selection: user picks which modules to activate
- Theme selection with live preview
- Reports page (`/reports`) with 4 tabs (Finance, Tasks, Habits, Schedule), recharts charts (AreaChart, PieChart, BarChart), MetricCards, theme-aware design
- Bills management (`/finance` → "Contas" tab): cadastro de contas a pagar/receber com recorrência (Permanente/Este mês/3 meses/Personalizado), marcar como pago por mês, cards de resumo (Total a Pagar, Total a Receber, Saldo Previsto, Vencidas, Próximos 7 Dias, Pago este Mês), filtros por tipo e status

## Design Principles
- Two themes: Slim (deep black, zero distractions) and High (dark + electric cyan)
- No AI visual clichés (no purple gradients, no glassmorphism, no sparkle emoji)
- Progressive disclosure: dashboard = 30-second view, max 3 clicks to any feature
- Portuguese (pt-BR) interface
- Responsive mobile/desktop

## Project Structure
```
client/src/
  pages/          - Landing, AuthPage, Onboarding, Dashboard, Finance, Agenda, Tasks, Chat, Settings
  components/     - AppSidebar, CaptureButton, ThemeProvider, ThemeToggle
  hooks/          - use-auth, use-toast
  lib/            - Query client, offline-audio
server/
  routes.ts       - All API endpoints
  storage.ts      - Database operations (IStorage interface)
  ai.ts           - OpenAI integration (transcription, intent, receipt, PDF, chat)
  log.ts          - Centralized log() function (avoids circular dependency with index.ts)
  whatsapp.ts     - WhatsApp bot (Baileys) with PostgreSQL session persistence
  seed.ts         - Seed data (currently empty)
shared/
  schema.ts       - Drizzle schema + Zod validators + types
  models/auth.ts  - Users and sessions tables
  models/chat.ts  - Chat messages and user context tables
```

## Database Tables
- `users` - Auth + preferences (activeModules, theme, aiPersonality, onboardingCompleted)
- `sessions` - Express session store
- `transactions` - Financial transactions (amount, description, category, type, source, establishment, receiptItems JSON)
- `categories` - User-defined categories
- `financial_goals` - Savings/investment goals with progress tracking
- `schedule_items` - Calendar items with AI suggestion flag and approval status
- `personal_tasks` - Tasks with priority, status, due date, justification (text), justificationScore (1-5 from AI)
- `habits` - Habit tracking with streak count
- `habit_logs` - Daily habit completion logs
- `chat_messages` - Chat history (user + assistant messages)
- `user_context` - Long-term memory for AI (key-value pairs)
- `user_profile` - Onboarding data (age, profession, goals, discipline score, lastLoginAt, emailAlerts JSON prefs, lastSpendingAnalysis timestamp)
- `bills` - Bills with dueDay, recurrenceType, paidMonths (JSON), active flag
- `recurring_incomes` - Auto-posted monthly incomes (name, amount, dayOfMonth, lastPostedMonth)
- `discipline_score_history` - Point events for discipline tracking
  - Triggers: task completion (+3/+4/+6), habit check (+2), overdue task (-4 net of justification credit), spending analysis (-2/-4/-6 weekly)
  - Spending analysis: AI evaluates last 30d transactions vs declared income weekly; penalizes fast food/bar/entertainment excess
  - Overdue task justification: 48h grace window → user submits justification → AI judges (1-5 score) → net penalty = -4 + credit (0/+1/+2/+3)
- `email_alert_log` - Tracks sent email alerts (alertType, referenceId, sentAt) to prevent duplicates

## Railway Migration
- **WhatsApp auth**: sessão persistida no PostgreSQL via `usePostgresAuthState()` (tabela `whatsapp_auth`); fallback para filesystem local quando `DATABASE_URL` ausente
- **SendGrid**: prioriza `SENDGRID_API_KEY` + `SENDGRID_FROM_EMAIL` env vars; fallback para conector Replit
- **Vite plugins**: plugins Replit (`cartographer`, `dev-banner`, `runtime-error-modal`) carregados condicionalmente com try/catch — build funciona sem eles
- **APP_URL**: `APP_URL || RAILWAY_PUBLIC_DOMAIN || "https://axis.replit.app"`
- **Env vars obrigatórias**: `DATABASE_URL`, `SESSION_SECRET`
- **Env vars opcionais**: `OPENAI_API_KEY`, `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `APP_URL`, `ADMIN_EMAIL`
- **Admin control**: apenas a conta com email = `ADMIN_EMAIL` pode conectar/desconectar/resetar o WhatsApp Bot; `isAdminUser()` helper em `server/routes.ts`; endpoint `GET /api/auth/is-admin`; frontend esconde botões de controle para não-admins
- **Build/Start**: `npm run build` (Vite + esbuild → `dist/`) → `npm run start` (`drizzle-kit push --force && node dist/index.cjs`)

## Email Alert System
- **SendGrid** — prioriza `SENDGRID_API_KEY` env var, fallback para Replit Connectors — `server/integrations/sendgrid.ts`
- Templates: bill due soon (warns 1–3 days before dueDay), offline reminder (7+ days without login)
- `server/alerts.ts`: `updateLastLogin`, `checkAndSendBillAlerts`, `checkAndSendOfflineAlerts`
- Bill alerts fire on every dashboard load (fire-and-forget); offline check runs every 6h via `setInterval` in `server/index.ts`
- Anti-duplicate: checks `email_alert_log` before sending (25-day window for bills, 7-day for offline)
- User preferences stored in `userProfile.emailAlerts` JSON; UI toggles in setup-sheet "Alertas" tab

## API Endpoints
- `POST /api/input/process` - Universal input (voice or text) → AI detects intent → auto-routes
- `POST /api/finance/photo` - Upload receipt photo → AI extracts data
- `POST /api/finance/photo/confirm` - Confirm receipt data → create transactions
- `POST /api/finance/pdf` - Upload bank statement → AI parses transactions
- `POST /api/finance/pdf/confirm` - Confirm parsed transactions OR create bill (docType: "bill")
- `GET/POST/DELETE /api/transactions` - Transaction CRUD
- `GET/POST/DELETE /api/categories` - Category CRUD
- `GET/POST/PATCH/DELETE /api/goals` - Financial goals
- `GET/POST/PATCH/DELETE /api/schedule` - Schedule items
- `GET/POST/PATCH/DELETE /api/tasks` - Personal tasks
- `GET/POST/PATCH/DELETE /api/habits` - Habits
- `POST /api/habits/:id/check` - Toggle daily habit check
- `GET /api/habits/:id/logs` - Habit completion history
- `GET /api/chat/messages` - Chat history
- `POST /api/chat` - Send message to AI chatbot
- `GET /api/dashboard` - Consolidated dashboard data
- `POST /api/onboarding` - Save onboarding profile + generate AI diagnosis
- `GET /api/user/profile` - User profile and settings
- `PATCH /api/user/settings` - Update theme, personality, modules
- `GET/PATCH /api/user/notifications` - Email alert preferences
- `GET/POST/PATCH/DELETE /api/recurring-incomes` - Auto-posted incomes
- `GET/POST/PATCH/DELETE /api/bills` - Bills management
- `GET /api/user/identity` - Get stored identity entities (CNPJs the user identified as theirs)
