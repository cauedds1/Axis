import { db } from './db';
import { users, usageCounters } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export type LimitType =
  | 'transaction'
  | 'ai_capture'
  | 'whatsapp_photo'
  | 'whatsapp_pdf'
  | 'chat_message'
  | 'credit_card'
  | 'financial_goal'
  | 'habit'
  | 'voice'
  | 'business';

export interface LimitResult {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number | null;
  plan?: string;
  upgradeUrl?: string;
}

export const PLAN_LIMITS = {
  starter: {
    transaction: 200,
    ai_capture: 30,
    whatsapp_photo: 10,
    whatsapp_pdf: 3,
    chat_message: 10,
    credit_card: 1,
    financial_goal: 2,
    habit: 5,
    voice: false,
    business: false,
  },
  personal_ai: {
    transaction: Infinity,
    ai_capture: Infinity,
    whatsapp_photo: Infinity,
    whatsapp_pdf: Infinity,
    chat_message: Infinity,
    credit_card: Infinity,
    financial_goal: Infinity,
    habit: Infinity,
    voice: true,
    business: false,
  },
  team: {
    transaction: Infinity,
    ai_capture: Infinity,
    whatsapp_photo: Infinity,
    whatsapp_pdf: Infinity,
    chat_message: Infinity,
    credit_card: Infinity,
    financial_goal: Infinity,
    habit: Infinity,
    voice: true,
    business: true,
  },
} as const;

export const LIMIT_LABELS: Record<LimitType, string> = {
  transaction: 'monthly transactions',
  ai_capture: 'AI captures per month',
  whatsapp_photo: 'WhatsApp receipt scans per month',
  whatsapp_pdf: 'WhatsApp PDF reads per month',
  chat_message: 'AXIS chat messages per month',
  credit_card: 'credit cards',
  financial_goal: 'financial goals',
  habit: 'habits',
  voice: 'voice transcription',
  business: 'Business version access',
};

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function getOrCreateCounter(userId: string, month: string) {
  const [existing] = await db
    .select()
    .from(usageCounters)
    .where(and(eq(usageCounters.userId, userId), eq(usageCounters.month, month)));

  if (existing) return existing;

  const [created] = await db
    .insert(usageCounters)
    .values({ userId, month })
    .onConflictDoNothing()
    .returning();

  if (created) return created;

  const [refetch] = await db
    .select()
    .from(usageCounters)
    .where(and(eq(usageCounters.userId, userId), eq(usageCounters.month, month)));

  return refetch;
}

export async function checkLimit(userId: string, limitType: LimitType, count = 1): Promise<LimitResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return { allowed: false, reason: 'User not found' };

  const plan = (user.plan || 'starter') as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
  const limitValue = limits[limitType];

  if (limitType === 'voice' || limitType === 'business') {
    const allowed = limitValue === true;
    return {
      allowed,
      plan,
      reason: allowed ? undefined : `${LIMIT_LABELS[limitType]} is not available on the ${getPlanDisplayName(plan)} plan`,
      upgradeUrl: allowed ? undefined : '/pricing',
    };
  }

  const numericLimit = limitValue as number;
  if (numericLimit === Infinity) return { allowed: true, plan };

  const month = getCurrentMonth();
  const counter = await getOrCreateCounter(userId, month);
  if (!counter) return { allowed: true, plan };

  const counterField: Record<string, keyof typeof counter> = {
    transaction: 'transactions',
    ai_capture: 'aiCaptures',
    whatsapp_photo: 'whatsappPhotos',
    whatsapp_pdf: 'whatsappPdfs',
    chat_message: 'chatMessages',
  };

  const field = counterField[limitType];
  const current = field ? (counter[field] as number) : 0;

  if (current + count > numericLimit) {
    return {
      allowed: false,
      current,
      limit: numericLimit,
      plan,
      reason: `You've reached the limit of ${numericLimit} ${LIMIT_LABELS[limitType]} on the ${getPlanDisplayName(plan)} plan`,
      upgradeUrl: '/pricing',
    };
  }

  return { allowed: true, current, limit: numericLimit, plan };
}

export async function incrementCounter(userId: string, limitType: LimitType, count = 1): Promise<void> {
  const month = getCurrentMonth();
  const counter = await getOrCreateCounter(userId, month);
  if (!counter) return;

  const fieldMap: Record<string, Partial<typeof usageCounters.$inferInsert>> = {
    transaction: { transactions: (counter.transactions || 0) + count },
    ai_capture: { aiCaptures: (counter.aiCaptures || 0) + count },
    whatsapp_photo: { whatsappPhotos: (counter.whatsappPhotos || 0) + count },
    whatsapp_pdf: { whatsappPdfs: (counter.whatsappPdfs || 0) + count },
    chat_message: { chatMessages: (counter.chatMessages || 0) + count },
  };

  const updates = fieldMap[limitType];
  if (!updates) return;

  await db
    .update(usageCounters)
    .set(updates)
    .where(and(eq(usageCounters.userId, userId), eq(usageCounters.month, month)));
}

export async function checkCountLimits(userId: string, limitType: 'credit_card' | 'financial_goal' | 'habit', currentCount: number): Promise<LimitResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return { allowed: false, reason: 'User not found' };

  const plan = (user.plan || 'starter') as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
  const numericLimit = limits[limitType] as number;

  if (numericLimit === Infinity) return { allowed: true, plan };

  if (currentCount >= numericLimit) {
    return {
      allowed: false,
      current: currentCount,
      limit: numericLimit,
      plan,
      reason: `You've reached the limit of ${numericLimit} ${LIMIT_LABELS[limitType]} on the ${getPlanDisplayName(plan)} plan`,
      upgradeUrl: '/pricing',
    };
  }

  return { allowed: true, current: currentCount, limit: numericLimit, plan };
}

export async function getUserUsage(userId: string) {
  const month = getCurrentMonth();
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const plan = (user?.plan || 'starter') as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;

  const counter = await getOrCreateCounter(userId, month);

  return {
    plan,
    planDisplayName: getPlanDisplayName(plan),
    trialEndsAt: user?.trialEndsAt ?? null,
    month,
    usage: {
      transactions: { current: counter?.transactions ?? 0, limit: limits.transaction === Infinity ? null : limits.transaction },
      aiCaptures: { current: counter?.aiCaptures ?? 0, limit: limits.ai_capture === Infinity ? null : limits.ai_capture },
      whatsappPhotos: { current: counter?.whatsappPhotos ?? 0, limit: limits.whatsapp_photo === Infinity ? null : limits.whatsapp_photo },
      whatsappPdfs: { current: counter?.whatsappPdfs ?? 0, limit: limits.whatsapp_pdf === Infinity ? null : limits.whatsapp_pdf },
      chatMessages: { current: counter?.chatMessages ?? 0, limit: limits.chat_message === Infinity ? null : limits.chat_message },
      voice: { allowed: limits.voice as boolean },
      business: { allowed: limits.business as boolean },
    },
  };
}

export function getPlanDisplayName(plan: string): string {
  const names: Record<string, string> = {
    starter: 'Starter',
    personal_ai: 'Personal AI',
    team: 'Team',
  };
  return names[plan] ?? plan;
}
