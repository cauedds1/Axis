import { db } from "./db";
import { aiUsageLogs, whatsappLogs, auditLogs } from "@shared/schema";
import { log } from "./log";

export async function logAiUsage(userId: string | null | undefined, callType: string, tokensUsed?: number | null) {
  try {
    await db.insert(aiUsageLogs).values({ userId: userId ?? null, callType, tokensUsed: tokensUsed ?? null });
  } catch (err: any) {
    log(`logAiUsage error: ${err?.message}`, "admin");
  }
}

export async function logWhatsappMessage(senderPhone: string | null, messageType: string, result: string | null, userId?: string | null) {
  try {
    await db.insert(whatsappLogs).values({ senderPhone, messageType, result: result?.slice(0, 500) ?? null, userId: userId ?? null });
  } catch (err: any) {
    log(`logWhatsappMessage error: ${err?.message}`, "admin");
  }
}

export async function logAudit(
  actorId: string | null,
  actorEmail: string | null,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata?: Record<string, any>
) {
  try {
    await db.insert(auditLogs).values({ actorId, actorEmail, action, targetType, targetId, metadata: metadata ?? null });
  } catch (err: any) {
    log(`logAudit error: ${err?.message}`, "admin");
  }
}
