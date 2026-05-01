import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  proto,
  type AuthenticationCreds,
  type SignalDataTypeMap,
  initAuthCreds,
  BufferJSON,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as qrcode from "qrcode";
import { storage } from "./storage";
import { uploadBase64Image, isStorageConfigured } from "./lib/file-storage";
import { detectIntentAndProcess, chatWithContext, processMultipleReceipts, transcribeAudio, processPDFExtract, matchBillIdentity, saveUserIdentityEntity } from "./ai";
import type { IntentResult } from "./ai";
import { log } from "./log";
import { logWhatsappMessage, logAiUsage } from "./adminLogger";
import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import { users, whatsappAuth, transactions, systemConfig } from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { checkLimit, incrementCounter } from "./planLimits";

export type WhatsAppStatus = "disconnected" | "qr_pending" | "connected";

function normalizeCnpjLocal(raw: string): string {
  return (raw || "").replace(/[^0-9]/g, "");
}

function downloadWithTimeout(
  msg: proto.IWebMessageInfo,
  sock: ReturnType<typeof makeWASocket>,
  timeoutMs = 30_000
): Promise<Buffer> {
  const download = downloadMediaMessage(
    msg,
    "buffer",
    {},
    { logger: { level: "silent", trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) } as any, reuploadRequest: sock.updateMediaMessage }
  ) as Promise<Buffer>;
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("download timeout after 30s")), timeoutMs)
  );
  return Promise.race([download, timeout]);
}

const SESSION_DIR = path.join(process.cwd(), ".whatsapp-session");

async function usePostgresAuthState(keyPrefix: string = "") {
  const pk = (k: string) => keyPrefix ? `${keyPrefix}:${k}` : k;

  const readData = async (key: string): Promise<any> => {
    const [row] = await db.select().from(whatsappAuth).where(eq(whatsappAuth.key, pk(key)));
    if (!row) return null;
    return JSON.parse(row.data, BufferJSON.reviver);
  };

  const writeData = async (key: string, data: any): Promise<void> => {
    const fullKey = pk(key);
    const serialized = JSON.stringify(data, BufferJSON.replacer);
    await db
      .insert(whatsappAuth)
      .values({ key: fullKey, data: serialized })
      .onConflictDoUpdate({ target: whatsappAuth.key, set: { data: serialized } });
  };

  const removeData = async (key: string): Promise<void> => {
    await db.delete(whatsappAuth).where(eq(whatsappAuth.key, pk(key)));
  };

  const creds: AuthenticationCreds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const data: { [id: string]: SignalDataTypeMap[T] } = {};
          for (const id of ids) {
            const value = await readData(`${type}-${id}`);
            if (value) {
              if (type === "app-state-sync-key" && value.keyData) {
                data[id] = proto.Message.AppStateSyncKeyData.fromObject(value) as any;
              } else {
                data[id] = value;
              }
            }
          }
          return data;
        },
        set: async (data: any) => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              tasks.push(value ? writeData(key, value) : removeData(key));
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData("creds", creds),
    clearAll: async () => {
      if (keyPrefix) {
        await db.execute(sql`DELETE FROM whatsapp_auth WHERE key LIKE ${keyPrefix + ":%"}`);
      } else {
        await db.execute(sql`DELETE FROM whatsapp_auth WHERE key NOT LIKE '%:%'`);
      }
    },
  };
}

interface PendingDuplicate {
  transactionData: any;
  replyText: string;
  expiresAt: number;
}

interface PendingBillIdentity {
  extracted: any;
  userId: string;
  option1: { name: string; cnpj: string };
  option2: { name: string; cnpj: string };
  expiresAt: number;
}

interface PendingSavingsDeposit {
  amount: number;
  originalGoalName: string | null;
  goals: Array<{ id: string; title: string }>;
  awaitingNewGoalName: boolean;
  expiresAt: number;
}

class WhatsAppManager {
  private instanceName: string;
  private sock: any = null;
  private status: WhatsAppStatus = "disconnected";
  private qrCode: string | null = null;
  private connectedPhone: string | null = null;
  private retryCount = 0;
  private lidCache: Map<string, string> = new Map();

  constructor(instanceName: string = "default") {
    this.instanceName = instanceName;
  }
  private pendingDuplicates: Map<string, PendingDuplicate> = new Map();
  private pendingBillIdentity: Map<string, PendingBillIdentity> = new Map();
  private pendingSavingsDeposit: Map<string, PendingSavingsDeposit> = new Map();
  private pendingBusinessChoice: Map<string, { transactionData: any; dataUrl: string; replyLine: string; orgs: { id: string; name: string }[]; expiresAt: number }> = new Map();
  private pgAuthClearAll: (() => Promise<void>) | null = null;
  private lastRegisteredTx: Map<string, {
    id: string;
    description: string;
    amount: number;
    categoryName: string;
    establishment: string | null;
    type: string;
    expiresAt: number;
  }> = new Map();

  getStatus(): WhatsAppStatus { return this.status; }
  getQrCode(): string | null { return this.qrCode; }
  resetRetryCount(): void { this.retryCount = 0; }
  getConnectedPhone(): string | null { return this.connectedPhone; }
  getInstanceName(): string { return this.instanceName; }

  unlinkPhone(phone: string): void {
    const normalized = phone.startsWith("55") ? phone : "55" + phone;
    for (const [jid, storedPhone] of this.lidCache.entries()) {
      if (storedPhone === phone || storedPhone === normalized || storedPhone === normalized.slice(2)) {
        this.lidCache.delete(jid);
        log(`WhatsApp: JID removido do cache para phone=${phone}`, "whatsapp");
      }
    }
  }

  async resolveJidToStoredPhone(jid: string): Promise<string> {
    if (!jid.includes("@lid")) {
      return jid.replace("@s.whatsapp.net", "").replace(/[^0-9]/g, "");
    }
    const cached = this.lidCache.get(jid);
    if (cached) return cached;
    await this.buildLidCache();
    return this.lidCache.get(jid) ?? jid.replace(/[^0-9]/g, "");
  }

  async buildLidCache(): Promise<void> {
    if (!this.sock) return;
    try {
      const profiles = await storage.getAllProfiles();
      for (const profile of profiles) {
        const raw = (profile as any).whatsappPhone as string | null;
        if (!raw) continue;
        const phone = raw.startsWith("55") ? raw : "55" + raw;
        try {
          const results: any[] = await this.sock.onWhatsApp(phone);
          if (results && results.length > 0) {
            const resolvedJid: string = results[0].jid ?? "";
            if (resolvedJid) {
              this.lidCache.set(resolvedJid, raw);
              log(`WhatsApp LID cache — ${phone} → ${resolvedJid}`, "whatsapp");
            }
          }
        } catch (e: any) {
          log(`WhatsApp LID resolve failed for ${phone}: ${e.message}`, "whatsapp");
        }
      }
    } catch (e: any) {
      log(`WhatsApp buildLidCache error: ${e.message}`, "whatsapp");
    }
  }

  async resolveAndSaveJid(userId: string, phone: string): Promise<void> {
    if (!this.sock) return;
    const normalized = phone.startsWith("55") ? phone : "55" + phone;
    try {
      const results: any[] = await this.sock.onWhatsApp(normalized);
      if (results && results.length > 0) {
        const jid: string = results[0].jid ?? "";
        if (jid) {
          await storage.upsertUserProfile(userId, { whatsappJid: jid } as any);
          this.lidCache.set(jid, phone);
          log(`WhatsApp: JID auto-resolvido para userId=${userId} → ${jid}`, "whatsapp");
        }
      }
    } catch (e: any) {
      log(`WhatsApp: falha ao auto-resolver JID para ${normalized} — ${e.message}`, "whatsapp");
    }
  }

  async initialize(): Promise<void> {
    if (this.status === "connected") return;
    log(`WhatsApp initialize() called — retryCount: ${this.retryCount}`, "whatsapp");

    let state: any;
    let saveCreds: () => Promise<void>;

    const usePostgres = !!process.env.DATABASE_URL;

    if (usePostgres) {
      log(`WhatsApp [${this.instanceName}]: usando PostgreSQL para persistir sessão`, "whatsapp");
      const keyPrefix = this.instanceName === "default" ? "" : this.instanceName;
      const pgAuth = await usePostgresAuthState(keyPrefix);
      state = pgAuth.state;
      saveCreds = pgAuth.saveCreds;
      this.pgAuthClearAll = pgAuth.clearAll;
    } else {
      log("WhatsApp: usando filesystem local para sessão", "whatsapp");
      if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
      }
      const fileAuth = await useMultiFileAuthState(SESSION_DIR);
      state = fileAuth.state;
      saveCreds = fileAuth.saveCreds;
    }
    const { version } = await fetchLatestBaileysVersion();

    const baileysLogger = {
      level: "warn",
      trace: () => {}, debug: () => {}, info: () => {},
      warn: (obj: any, msg?: string) => log(`[baileys warn] ${msg ?? JSON.stringify(obj)}`, "whatsapp"),
      error: (obj: any, msg?: string) => log(`[baileys error] ${msg ?? JSON.stringify(obj)}`, "whatsapp"),
      fatal: (obj: any, msg?: string) => log(`[baileys fatal] ${msg ?? JSON.stringify(obj)}`, "whatsapp"),
      child: () => baileysLogger,
    };

    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger as any),
      },
      printQRInTerminal: false,
      logger: baileysLogger as any,
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      keepAliveIntervalMs: 10_000,
      getMessage: async () => undefined,
    });

    this.sock.ev.on("connection.update", async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.status = "qr_pending";
        this.qrCode = await qrcode.toDataURL(qr);
        log("WhatsApp QR code generated", "whatsapp");
      }

      if (connection === "close") {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;
        log(`WhatsApp disconnected — reason: ${reason}`, "whatsapp");
        this.status = "disconnected";
        this.qrCode = null;
        this.connectedPhone = null;

        if (shouldReconnect && this.retryCount < 5) {
          this.retryCount++;
          setTimeout(() => this.initialize(), 3000 * this.retryCount);
        } else if (!shouldReconnect) {
          this.clearSession();
        }
      }

      if (connection === "open") {
        this.status = "connected";
        this.qrCode = null;
        this.retryCount = 0;
        this.connectedPhone = this.sock?.user?.id?.split(":")[0] || null;
        log(`WhatsApp connected — ${this.connectedPhone}`, "whatsapp");
        setTimeout(() => this.buildLidCache(), 3000);
      }
    });

    this.sock.ev.on("creds.update", saveCreds);

    this.sock.ev.on("contacts.upsert", (contacts: any[]) => {
      for (const c of contacts) {
        const lid: string | undefined = c.lid;
        const phoneJid: string | undefined = c.id;
        if (lid && phoneJid && phoneJid.includes("@s.whatsapp.net")) {
          const phone = phoneJid.replace("@s.whatsapp.net", "").replace(/[^0-9]/g, "");
          this.lidCache.set(lid, phone);
          log(`WhatsApp contact sync — LID ${lid} → ${phone}`, "whatsapp");
        }
      }
    });

    this.sock.ev.on("contacts.update", (updates: any[]) => {
      for (const c of updates) {
        const lid: string | undefined = c.lid;
        const phoneJid: string | undefined = c.id;
        if (lid && phoneJid && phoneJid.includes("@s.whatsapp.net")) {
          const phone = phoneJid.replace("@s.whatsapp.net", "").replace(/[^0-9]/g, "");
          this.lidCache.set(lid, phone);
        }
      }
    });

    this.sock.ev.on("messages.upsert", async ({ messages, type }: any) => {
      log(`WhatsApp raw event type=${type} msgs=${messages.length}`, "whatsapp");
      if (type !== "notify" && type !== "append") return;
      for (const msg of messages) {
        if (msg.key.fromMe) continue;
        const jid = msg.key.remoteJid ?? "";
        if (jid.endsWith("@g.us") || jid === "status@broadcast") continue;
        await this.handleIncomingMessage(msg);
      }
    });
  }

  private async handleIncomingMessage(msg: proto.IWebMessageInfo): Promise<void> {
    const jid = msg.key.remoteJid;
    if (!jid) return;

    const senderPhone = await this.resolveJidToStoredPhone(jid);

    const imageMsg =
      msg.message?.imageMessage ||
      msg.message?.ephemeralMessage?.message?.imageMessage ||
      msg.message?.viewOnceMessage?.message?.imageMessage ||
      msg.message?.viewOnceMessageV2?.message?.imageMessage ||
      null;

    const audioMsg =
      msg.message?.audioMessage ||
      msg.message?.ephemeralMessage?.message?.audioMessage ||
      null;

    const docMsg =
      msg.message?.documentMessage ||
      msg.message?.ephemeralMessage?.message?.documentMessage ||
      msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
      null;

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.ephemeralMessage?.message?.conversation ||
      (imageMsg?.caption ?? "");

    if (!text.trim() && !imageMsg && !audioMsg && !docMsg) return;

    try {
      const msgType = imageMsg ? " [imagem]" : audioMsg ? " [áudio]" : docMsg ? " [documento]" : ` — "${text.substring(0, 60)}"`;
      log(`WhatsApp: mensagem recebida de ${senderPhone}${msgType}`, "whatsapp");

      let profile = await storage.getUserProfileByJid(jid);
      if (!profile) {
        profile = await storage.getUserProfileByPhone(senderPhone);
        if (profile) {
          storage.upsertUserProfile(profile.userId, { whatsappJid: jid } as any).catch(() => {});
          log(`WhatsApp: JID ${jid} auto-salvo para userId=${profile.userId}`, "whatsapp");
        }
      }

      if (!profile) {
        log(`WhatsApp: JID não vinculado — ${jid}`, "whatsapp");

        const cmdRaw = text.trim().toLowerCase().replace(/\s+/g, " ");

        const isAP = cmdRaw.startsWith("vincular ap") || cmdRaw.startsWith("vincularap");
        const isAB = cmdRaw.startsWith("vincular ab") || cmdRaw.startsWith("vincularab");

        if (isAP || isAB) {
          const phonePart = cmdRaw.replace(/^vincular\s*a[pb]\s*/i, "").replace(/[^0-9]/g, "").trim();
          const matchProfiles = await storage.getAllProfiles();
          const variants = phonePart ? [phonePart, "55" + phonePart] : [];
          const target = matchProfiles.find(p => {
            const ph: string = (p as any).whatsappPhone ?? "";
            return ph && (ph === phonePart || variants.includes(ph));
          });

          if (!target) {
            const prefix = isAP ? "AP" : "AB";
            await this.sendMessage(jid, `❌ Número não encontrado. Certifique-se de cadastrar seu número em Configurações antes de vincular.\n\nTente: *vincular ${prefix} 48999186712*`);
            return;
          }

          if (isAP) {
            await storage.upsertUserProfile(target.userId, { whatsappJid: jid } as any);
            log(`WhatsApp: JID ${jid} vinculado (Pessoal) ao userId=${target.userId}`, "whatsapp");
            await this.sendMessage(jid, "✅ WhatsApp vinculado ao *AXIS Pessoal*! Pode enviar comprovantes e mensagens normalmente.");
          } else {
            const [userRow] = await db.select({ accountType: users.accountType }).from(users).where(eq(users.id, target.userId));
            const orgs = await storage.getUserOrganizations(target.userId);
            const hasBusiness = userRow?.accountType === "collaborator" || orgs.length > 0;
            if (!hasBusiness) {
              await this.sendMessage(jid, "❌ Este número não possui uma conta Business no AXIS.\n\nPara vincular o AXIS Pessoal, use:\n*vincular AP [seu-numero]*");
              return;
            }
            await storage.upsertUserProfile(target.userId, { whatsappJid: jid } as any);
            log(`WhatsApp: JID ${jid} vinculado (Business) ao userId=${target.userId}`, "whatsapp");
            await this.sendMessage(jid, "✅ WhatsApp vinculado ao *AXIS Business*! Envie uma *foto do recibo* para registrar uma despesa corporativa.");
          }
          return;
        }

        if (cmdRaw.startsWith("vincular")) {
          await this.sendMessage(jid, "❌ Este número não está vinculado ao AXIS.\n\nPara vincular o *AXIS Pessoal*, envie:\n*vincular AP [seu-numero]*\n\nPara vincular o *AXIS Business*, envie:\n*vincular AB [seu-numero]*\n\nEx: *vincular AP 48999186712*");
          return;
        }

        await this.sendMessage(jid, "❌ Este número não está vinculado ao AXIS.\n\nPara vincular o *AXIS Pessoal*, envie:\n*vincular AP [seu-numero]*\n\nPara vincular o *AXIS Business*, envie:\n*vincular AB [seu-numero]*\n\nEx: *vincular AP 48999186712*");
        return;
      }

      log(`WhatsApp: usuário encontrado — userId=${profile.userId}`, "whatsapp");

      // Route collaborator accounts directly to business expense flow
      const [userRow] = await db.select({ accountType: users.accountType }).from(users).where(eq(users.id, profile.userId));
      if (userRow?.accountType === "collaborator") {
        await this.handleCollaboratorMessage(msg, jid, profile.userId, imageMsg, text);
        return;
      }

      // In dual mode, pendingBusinessChoice is never used (context is pre-determined)
      if (this.instanceName !== "default") {
        this.pendingBusinessChoice.delete(jid);
      }

      // Check for pending business expense choice (pessoal vs corporativo)
      const pendingBusiness = this.instanceName === "default" ? this.pendingBusinessChoice.get(jid) : undefined;
      if (pendingBusiness && !imageMsg) {
        if (Date.now() > pendingBusiness.expiresAt) {
          this.pendingBusinessChoice.delete(jid);
        } else {
          const answer = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (answer === "pessoal" || answer === "p") {
            this.pendingBusinessChoice.delete(jid);
            const savedTx = await this.limitedCreateTx(jid, profile.userId, pendingBusiness.transactionData);
            if (savedTx === null) return;
            if (savedTx?.id) {
              this.lastRegisteredTx.set(jid, { id: savedTx.id, description: pendingBusiness.transactionData.description || "", amount: Number(pendingBusiness.transactionData.amount), categoryName: pendingBusiness.transactionData.categoryName || "outros", establishment: pendingBusiness.transactionData.establishment || null, type: pendingBusiness.transactionData.type, expiresAt: Date.now() + 30 * 60 * 1000 });
            }
            await this.sendMessage(jid, `✅ *Registrado como gasto pessoal!*\n${pendingBusiness.replyLine}`);
          } else {
            const matched = pendingBusiness.orgs.find(o => answer.includes(o.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) || o.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(answer));
            if (matched) {
              this.pendingBusinessChoice.delete(jid);
              let receiptImageUrl: string | undefined;
              let receiptImageBase64: string | undefined = pendingBusiness.dataUrl;
              if (isStorageConfigured) {
                const uploaded = await uploadBase64Image(pendingBusiness.dataUrl, "receipts");
                if (uploaded) {
                  receiptImageUrl = uploaded;
                  receiptImageBase64 = undefined;
                }
              }
              await storage.createBusinessExpense({ organizationId: matched.id, userId: profile.userId, amount: pendingBusiness.transactionData.amount, description: pendingBusiness.transactionData.description, categoryName: pendingBusiness.transactionData.categoryName, establishment: pendingBusiness.transactionData.establishment, paymentMethod: pendingBusiness.transactionData.paymentMethod, receiptItems: pendingBusiness.transactionData.receiptItems ?? null, receiptImageBase64, receiptImageUrl, date: pendingBusiness.transactionData.date, source: "whatsapp", status: "pending_review" } as any);
              await this.sendMessage(jid, `✅ *Despesa corporativa registrada!*\n${pendingBusiness.replyLine}\n\n📋 Salvo em *${matched.name}* — aguardando aprovação do gestor.`);
            } else {
              const orgNames = pendingBusiness.orgs.map(o => `*${o.name}*`).join(", ");
              await this.sendMessage(jid, `⚠️ Não entendi. Responda *pessoal* ou o nome da empresa (${orgNames}).`);
            }
          }
          return;
        }
      }

      // Check for pending duplicate confirmation
      const pending = this.pendingDuplicates.get(jid);
      if (pending && !imageMsg) {
        if (Date.now() > pending.expiresAt) {
          this.pendingDuplicates.delete(jid);
        } else {
          const answer = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (answer === "sim" || answer === "s" || answer === "yes" || answer.startsWith("sim ") || answer === "cadastrar") {
            this.pendingDuplicates.delete(jid);
            const confirmedTx = await this.limitedCreateTx(jid, profile.userId, pending.transactionData);
            if (confirmedTx === null) return;
            if (confirmedTx?.id) {
              this.lastRegisteredTx.set(jid, {
                id: confirmedTx.id,
                description: pending.transactionData.description || "",
                amount: Number(pending.transactionData.amount),
                categoryName: pending.transactionData.categoryName || "outros",
                establishment: pending.transactionData.establishment || null,
                type: pending.transactionData.type,
                expiresAt: Date.now() + 30 * 60 * 1000,
              });
            }
            await this.sendMessage(jid, `✅ Cadastrado!\n${pending.replyText}`);
          } else if (answer === "nao" || answer === "n" || answer === "no" || answer.startsWith("nao ") || answer === "cancelar") {
            this.pendingDuplicates.delete(jid);
            await this.sendMessage(jid, "🚫 Ok, transação não cadastrada.");
          } else {
            await this.sendMessage(jid, `⚠️ Responda *sim* para cadastrar ou *não* para cancelar.\n${pending.replyText}`);
          }
          return;
        }
      }

      const pendingIdentity = this.pendingBillIdentity.get(jid);
      if (pendingIdentity && !imageMsg) {
        if (Date.now() > pendingIdentity.expiresAt) {
          this.pendingBillIdentity.delete(jid);
        } else {
          const answer = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          let chosen: { name: string; cnpj: string } | null = null;
          let billType: "income" | "expense" = "expense";

          const name1 = pendingIdentity.option1.name.toLowerCase();
          const name2 = pendingIdentity.option2.name.toLowerCase();
          const cnpj1 = normalizeCnpjLocal(pendingIdentity.option1.cnpj);
          const cnpj2 = normalizeCnpjLocal(pendingIdentity.option2.cnpj);
          const answerDigits = answer.replace(/[^0-9]/g, "");

          if (answer === "1" || (name1.length > 5 && answer.includes(name1.substring(0, 8))) || (answerDigits.length >= 11 && answerDigits === cnpj1)) {
            chosen = pendingIdentity.option1;
          } else if (answer === "2" || (name2.length > 5 && answer.includes(name2.substring(0, 8))) || (answerDigits.length >= 11 && answerDigits === cnpj2)) {
            chosen = pendingIdentity.option2;
          }

          if (chosen) {
            const issuerCnpjNorm = normalizeCnpjLocal(pendingIdentity.extracted.issuerCnpj);
            billType = normalizeCnpjLocal(chosen.cnpj) === issuerCnpjNorm ? "income" : "expense";
          }

          if (chosen) {
            this.pendingBillIdentity.delete(jid);
            await saveUserIdentityEntity(pendingIdentity.userId, chosen.name, chosen.cnpj);
            await this.createBillFromExtracted(jid, pendingIdentity.userId, pendingIdentity.extracted, billType);
            log(`WhatsApp: identidade salva — ${chosen.name} (${chosen.cnpj}) para userId=${pendingIdentity.userId}`, "whatsapp");
          } else {
            await this.sendMessage(jid, `⚠️ Responda *1* ou *2* para identificar quem é você.\n\n1️⃣ ${pendingIdentity.option1.name}\n2️⃣ ${pendingIdentity.option2.name}`);
          }
          return;
        }
      }

      // Check for pending savings deposit
      const pendingSavings = this.pendingSavingsDeposit.get(jid);
      if (pendingSavings && !imageMsg) {
        if (Date.now() > pendingSavings.expiresAt) {
          this.pendingSavingsDeposit.delete(jid);
        } else {
          const answer = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

          if (pendingSavings.awaitingNewGoalName) {
            const goalTitle = text.trim();
            const newGoal = await storage.createFinancialGoal({
              userId: profile.userId,
              title: goalTitle,
              emoji: "💰",
              currentAmount: 0 as any,
            });
            this.pendingSavingsDeposit.delete(jid);
            await this.depositIntoGoal(jid, profile.userId, newGoal.id, newGoal.title, pendingSavings.amount);
          } else {
            const goals = pendingSavings.goals;
            const createNewIdx = goals.length + 1;
            const chosenNum = parseInt(answer);

            if (!isNaN(chosenNum) && chosenNum >= 1 && chosenNum <= goals.length) {
              const goal = goals[chosenNum - 1];
              this.pendingSavingsDeposit.delete(jid);
              await this.depositIntoGoal(jid, profile.userId, goal.id, goal.title, pendingSavings.amount);
            } else if (chosenNum === createNewIdx || answer.includes("criar") || answer.includes("nova") || answer.includes("novo") || answer.includes("new")) {
              if (pendingSavings.originalGoalName) {
                const newGoal = await storage.createFinancialGoal({
                  userId: profile.userId,
                  title: pendingSavings.originalGoalName,
                  emoji: "💰",
                  currentAmount: 0 as any,
                });
                this.pendingSavingsDeposit.delete(jid);
                await this.depositIntoGoal(jid, profile.userId, newGoal.id, newGoal.title, pendingSavings.amount);
              } else {
                this.pendingSavingsDeposit.set(jid, { ...pendingSavings, awaitingNewGoalName: true, expiresAt: Date.now() + 10 * 60 * 1000 });
                await this.sendMessage(jid, "📝 Qual será o nome da nova reserva?");
              }
            } else {
              const lines = goals.map((g, i) => `${i + 1}️⃣ ${g.title}`).join("\n");
              const fmtAmt = pendingSavings.amount.toFixed(2).replace(".", ",");
              await this.sendMessage(jid, `⚠️ Opção inválida. Responda com o número da reserva:\n\n${lines}\n➕ ${createNewIdx} - Criar nova reserva "${pendingSavings.originalGoalName || "..."}" com R$ ${fmtAmt}`);
            }
          }
          return;
        }
      }

      if (imageMsg) {
        await this.handleReceiptImage(msg, jid, profile.userId, imageMsg.mimetype || "image/jpeg");
        return;
      }

      if (audioMsg) {
        await this.handleAudioMessage(msg, jid, profile.userId, audioMsg.mimetype || "audio/ogg; codecs=opus");
        return;
      }

      if (docMsg) {
        await this.handleDocumentPDF(msg, jid, profile.userId, docMsg.fileName || "documento");
        return;
      }

      const lastTxEntry = this.lastRegisteredTx.get(jid);
      if (lastTxEntry && Date.now() > lastTxEntry.expiresAt) {
        this.lastRegisteredTx.delete(jid);
      }
      const lastTxContext = this.lastRegisteredTx.get(jid);

      const result = await detectIntentAndProcess(text, profile.userId, lastTxContext);
      logAiUsage(profile.userId, "intent_detection").catch(() => {});
      log(`WhatsApp: intent=${result.intent} para userId=${profile.userId}`, "whatsapp");
      logWhatsappMessage(senderPhone, "text", result.intent, profile.userId).catch(() => {});

      if (result.intent === "edit_last") {
        if (!lastTxContext) {
          await this.sendMessage(jid, "Não encontrei uma transação recente para editar. Cadastre um gasto ou receita primeiro.");
          return;
        }
        const changes = result.data;
        const updateFields: Record<string, any> = {};
        if (changes.amount != null) updateFields.amount = Number(changes.amount);
        if (changes.description != null) updateFields.description = changes.description;
        if (changes.categoryName != null) updateFields.categoryName = changes.categoryName;
        if ("establishment" in changes) updateFields.establishment = changes.establishment;
        if (changes.date != null) updateFields.date = new Date(changes.date);
        if (changes.type != null) updateFields.type = changes.type;

        if (Object.keys(updateFields).length === 0) {
          await this.sendMessage(jid, "Não entendi o que você quer alterar. Pode descrever melhor?");
          return;
        }

        await storage.updateTransaction(lastTxContext.id, profile.userId, updateFields);

        const finalAmount = updateFields.amount ?? lastTxContext.amount;
        const finalCategory = updateFields.categoryName ?? lastTxContext.categoryName;
        const finalDesc = updateFields.description ?? lastTxContext.description;
        const finalType = updateFields.type ?? lastTxContext.type;

        this.lastRegisteredTx.set(jid, {
          ...lastTxContext,
          description: finalDesc,
          amount: Number(finalAmount),
          categoryName: finalCategory,
          type: finalType,
          establishment: "establishment" in updateFields ? updateFields.establishment : lastTxContext.establishment,
          expiresAt: Date.now() + 30 * 60 * 1000,
        });

        const typeIcon = finalType === "income" ? "📥" : "💸";
        await this.sendMessage(jid, `✅ *Transação atualizada!*\n${typeIcon} ${finalDesc} — R$ ${Number(finalAmount).toFixed(2).replace(".", ",")} em *${finalCategory}*`);
        log(`WhatsApp: transação editada id=${lastTxContext.id} para userId=${profile.userId}`, "whatsapp");
        return;
      }

      if (result.intent === "savings_deposit") {
        await this.handleSavingsDeposit(jid, profile.userId, Number(result.data.amount), result.data.goalName || null);
        return;
      }

      const reply = await this.buildReply(result, profile.userId, jid);
      if (reply) {
        await this.sendMessage(jid, reply);
        log(`WhatsApp: resposta enviada para ${senderPhone}`, "whatsapp");
      }
    } catch (err: any) {
      log(`WhatsApp: erro ao processar mensagem de ${senderPhone} — ${err.message}`, "whatsapp");
      await this.sendMessage(jid, "❌ Erro ao processar. Tente novamente.");
    }
  }

  // ─── COLLABORATOR MESSAGE HANDLER ───────────────────────────────────────────

  private async handleCollaboratorMessage(
    msg: proto.IWebMessageInfo,
    jid: string,
    userId: string,
    imageMsg: any,
    text: string
  ): Promise<void> {
    if (!imageMsg) {
      const cmdRaw = text.trim().toLowerCase().replace(/\s+/g, " ");
      if (cmdRaw.startsWith("vincular")) {
        await this.sendMessage(jid, "✅ Seu número já está vinculado ao *AXIS Business*!\n\nEnvie uma *foto do recibo* para registrar uma despesa corporativa.");
        return;
      }
      await this.sendMessage(jid, "📎 Envie uma *foto do recibo* para registrar uma despesa corporativa.\n\nAssim que receber a imagem, vou criar a despesa automaticamente e notificar o gestor.");
      return;
    }

    const orgs = await storage.getUserOrganizations(userId);
    if (orgs.length === 0) {
      await this.sendMessage(jid, "⚠️ Você não está associado a nenhuma empresa. Entre em contato com o administrador.");
      return;
    }
    const org = orgs[0];

    await this.sendMessage(jid, "🔍 Analisando comprovante...");

    let buffer: Buffer;
    try {
      buffer = await downloadWithTimeout(msg, this.sock);
    } catch (dlErr: any) {
      log(`WhatsApp: falha ao baixar mídia (colaborador) — ${dlErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui baixar a imagem. Tente enviar novamente.");
      return;
    }

    const mimetype = imageMsg.mimetype || "image/jpeg";
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimetype};base64,${base64}`;

    let userName: string | undefined;
    try {
      const [u] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId));
      if (u) userName = [u.firstName, u.lastName].filter(Boolean).join(" ");
    } catch {}

    let multiResult: { count: number; receipts: any[] };
    try {
      multiResult = await processMultipleReceipts(dataUrl, userId, userName);
      logAiUsage(userId, "receipt_analysis").catch(() => {});
      logWhatsappMessage(jid.split("@")[0], "image_receipt", "collaborator_receipt", userId).catch(() => {});
    } catch (aiErr: any) {
      log(`WhatsApp: falha na análise IA (colaborador) — ${aiErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui analisar a imagem. Tente uma foto mais nítida.");
      return;
    }

    const validReceipts = multiResult.receipts.filter(r => r.totalAmount);
    if (validReceipts.length === 0) {
      await this.sendMessage(jid, "😕 Não consegui identificar um valor nessa imagem. Tente uma foto mais nítida.");
      return;
    }

    let receiptImageUrl: string | undefined;
    let receiptImageBase64: string | undefined = dataUrl;
    if (isStorageConfigured) {
      const uploaded = await uploadBase64Image(dataUrl, "receipts");
      if (uploaded) { receiptImageUrl = uploaded; receiptImageBase64 = undefined; }
    }

    const createdExpenses: Array<{ expense: any; amount: number; categoryName: string; establishment: string | null; description: string; date: Date; receiptItemsList: any[] | null }> = [];

    for (const receipt of validReceipts) {
      const amount = Number(receipt.totalAmount);
      const categoryName = receipt.categoryName || "Outros";
      const description = receipt.description || receipt.establishment || "Despesa corporativa";
      const establishment = receipt.establishment || null;
      const paymentMethod = receipt.paymentMethod || null;
      const receiptItemsList = receipt.items && receipt.items.length > 1 ? receipt.items : null;
      const receiptItemsJson = receiptItemsList ? JSON.stringify(receiptItemsList.map((i: any) => ({ description: String(i.description || ""), amount: Number(i.amount || 0) }))) : null;

      let date = new Date();
      if (receipt.date) {
        try { date = new Date(receipt.date); } catch {}
      }

      const expense = await storage.createBusinessExpense({
        organizationId: org.id,
        userId,
        amount: amount as any,
        description,
        categoryName,
        establishment,
        paymentMethod,
        receiptItems: receiptItemsJson,
        receiptImageBase64,
        receiptImageUrl,
        date,
        source: "whatsapp",
        status: "pending_review",
      } as any);

      createdExpenses.push({ expense, amount, categoryName, establishment, description, date, receiptItemsList });
      await this.notifyAdminNewExpense(org.id, expense, userName);
    }

    let replyMsg: string;
    if (createdExpenses.length === 1) {
      const { amount, categoryName, establishment, description, date, receiptItemsList } = createdExpenses[0];
      const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      let replyLine = `💸 ${establishment || description} — R$ ${amount.toFixed(2).replace(".", ",")} em *${categoryName}* 📅 ${dateStr}`;
      if (receiptItemsList) replyLine += ` 📋 ${receiptItemsList.length} itens`;
      replyMsg = `✅ *Despesa corporativa registrada!*\n${replyLine}\n\n📋 Salvo em *${org.name}* — aguardando aprovação do gestor.`;
    } else {
      const lines = createdExpenses.map(({ amount, categoryName, establishment, description }, i) =>
        `${i + 1}. ${establishment || description} — R$ ${amount.toFixed(2).replace(".", ",")} em *${categoryName}*`
      ).join("\n");
      const totalAmount = createdExpenses.reduce((s, { amount }) => s + amount, 0);
      replyMsg = `✅ *${createdExpenses.length} despesas registradas!*\n${lines}\n\n💰 Total: R$ ${totalAmount.toFixed(2).replace(".", ",")}\n\n📋 Salvo em *${org.name}* — aguardando aprovação do gestor.`;
    }

    await this.sendMessage(jid, replyMsg);
    log(`WhatsApp: ${createdExpenses.length} despesa(s) corporativa(s) criada(s) via colaborador userId=${userId} orgId=${org.id}`, "whatsapp");
  }

  // ─── NOTIFICATION HELPERS ────────────────────────────────────────────────────

  public async notifyAdminNewExpense(orgId: string, expense: any, collaboratorName?: string): Promise<void> {
    try {
      const org = await storage.getOrganizationById(orgId);
      if (!org) return;
      const adminProfile = await storage.getUserProfile(org.adminUserId);
      if (!adminProfile?.whatsappJid) return;
      const amount = Number(expense.amount);
      const desc = expense.establishment || expense.description || "Despesa";
      const name = collaboratorName || "Colaborador";
      const msg =
        `🧾 *Nova despesa corporativa*\n` +
        `👤 ${name} enviou uma despesa\n` +
        `💰 R$ ${amount.toFixed(2).replace(".", ",")} — ${desc}\n` +
        `📂 Categoria: ${expense.categoryName || "—"}\n` +
        `📋 Status: Aguardando aprovação`;
      await this.sendMessage(adminProfile.whatsappJid, msg);
      log(`WhatsApp: admin ${org.adminUserId} notificado sobre nova despesa`, "whatsapp");
    } catch (err: any) {
      log(`WhatsApp: erro ao notificar admin — ${err.message}`, "whatsapp");
    }
  }

  public async notifyCollaboratorExpenseStatus(expense: any, newStatus: string, rejectionComment?: string): Promise<void> {
    try {
      const collaboratorProfile = await storage.getUserProfile(expense.userId);
      if (!collaboratorProfile?.whatsappJid) return;
      const amount = Number(expense.amount);
      const desc = expense.establishment || expense.description || "Despesa";
      let msg: string;
      if (newStatus === "approved") {
        msg = `✅ *Despesa aprovada!*\n💰 R$ ${amount.toFixed(2).replace(".", ",")} — ${desc}\n📋 Aguardando pagamento pelo gestor.`;
      } else if (newStatus === "rejected") {
        const reason = rejectionComment || "Sem motivo informado";
        msg = `❌ *Despesa rejeitada*\n💰 R$ ${amount.toFixed(2).replace(".", ",")} — ${desc}\n💬 Motivo: ${reason}\n\n📎 Envie uma nova foto com as correções para reenviar.`;
      } else if (newStatus === "paid") {
        msg = `💸 *Reembolso realizado!*\n💰 R$ ${amount.toFixed(2).replace(".", ",")} — ${desc}\n✅ O valor foi marcado como pago pelo gestor.`;
      } else {
        return;
      }
      await this.sendMessage(collaboratorProfile.whatsappJid, msg);
      log(`WhatsApp: colaborador ${expense.userId} notificado — status: ${newStatus}`, "whatsapp");
    } catch (err: any) {
      log(`WhatsApp: erro ao notificar colaborador — ${err.message}`, "whatsapp");
    }
  }

  // ─── RECEIPT IMAGE HANDLER ───────────────────────────────────────────────────

  private async handleReceiptImage(
    msg: proto.IWebMessageInfo,
    jid: string,
    userId: string,
    mimetype: string
  ): Promise<void> {
    // ── Plan limit check ──────────────────────────────────────────────────────
    try {
      const { checkLimit, incrementCounter } = await import("./planLimits");
      const photoLimit = await checkLimit(userId, 'whatsapp_photo');
      if (!photoLimit.allowed) {
        await this.sendMessage(jid, `⛔ *Limite atingido* — ${photoLimit.reason}.\n\n👉 Faça upgrade em: https://axis.app/pricing`);
        return;
      }
      incrementCounter(userId, 'whatsapp_photo').catch(() => {});
    } catch (limitErr: any) {
      log(`WhatsApp: erro ao checar limite de foto — ${limitErr?.message}`, "whatsapp");
    }
    // ─────────────────────────────────────────────────────────────────────────
    await this.sendMessage(jid, "🔍 Analisando comprovante...");

    let buffer: Buffer;
    try {
      buffer = await downloadWithTimeout(msg, this.sock);
    } catch (dlErr: any) {
      log(`WhatsApp: falha ao baixar mídia — ${dlErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui baixar a imagem. Tente enviar novamente.");
      return;
    }

    log(`WhatsApp: imagem baixada — ${buffer.length} bytes, tipo ${mimetype}`, "whatsapp");

    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimetype};base64,${base64}`;

    // Fetch user's full name so the AI can detect who is the sender/receiver
    let userName: string | undefined;
    try {
      const [userRow] = await db.select({ firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId));
      if (userRow) {
        userName = [userRow.firstName, userRow.lastName].filter(Boolean).join(" ");
      }
    } catch (nameErr: any) {
      log(`WhatsApp: erro ao buscar nome do usuário — ${nameErr?.message}`, "whatsapp");
    }

    let multiResult: { count: number; receipts: any[] };
    try {
      multiResult = await processMultipleReceipts(dataUrl, userId, userName);
      logAiUsage(userId, "receipt_analysis").catch(() => {});
      logWhatsappMessage(jid.split("@")[0], "image_receipt", "personal_receipt", userId).catch(() => {});
    } catch (aiErr: any) {
      log(`WhatsApp: falha na análise de imagem pela IA — ${aiErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui analisar a imagem. Tente descrever o gasto em texto, por exemplo: *gastei 50 reais no almoço*");
      return;
    }

    const validReceipts = multiResult.receipts.filter(r => r.totalAmount);
    if (validReceipts.length === 0) {
      await this.sendMessage(jid, "😕 Não consegui identificar um valor nessa imagem. Tente uma foto mais nítida ou descreva o gasto em texto.");
      return;
    }

    // Helper: normalize name for comparison
    const normName = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, "").trim();

    const userNorm = userName ? normName(userName) : "";
    const userParts = userNorm.split(/\s+/).filter(w => w.length > 2);
    const firstName = userParts[0] ?? "";
    const lastName = userParts[userParts.length - 1] ?? "";
    const nameMatchesIn = (target: string) =>
      firstName.length > 0 && lastName.length > 0 && firstName !== lastName &&
      target.includes(firstName) && target.includes(lastName);

    // Helper: build tx data from a single receipt object
    const buildTxData = (receipt: any) => {
      // Correct Pix direction if user name is known
      if (userName && (receipt.imageType === "pix_sent" || receipt.imageType === "pix_received")) {
        const receiverNorm = receipt.receiverName ? normName(receipt.receiverName) : "";
        const senderNorm = receipt.senderName ? normName(receipt.senderName) : "";
        if (nameMatchesIn(receiverNorm) && receipt.imageType === "pix_sent") {
          receipt.imageType = "pix_received";
          receipt.transactionType = "income";
        } else if (nameMatchesIn(senderNorm) && receipt.imageType === "pix_received") {
          receipt.imageType = "pix_sent";
          receipt.transactionType = "expense";
        }
      }

      const amount = Number(receipt.totalAmount);
      const transactionType: "expense" | "income" = receipt.transactionType === "income" ? "income" : "expense";
      const categoryName = receipt.categoryName || "outros";
      const imageType = receipt.imageType ?? "receipt";

      let date = new Date();
      if (receipt.date) {
        const [y, m, d] = receipt.date.split("-").map(Number);
        if (receipt.time) {
          const [h, min] = receipt.time.split(":").map(Number);
          date = new Date(y, m - 1, d, h, min, 0, 0);
        } else {
          date = new Date(y, m - 1, d);
        }
      }

      const senderName: string | null = receipt.senderName || null;
      const receiverName: string | null = receipt.receiverName || null;
      const establishment: string | null = receipt.establishment || senderName || receiverName || null;

      let description: string;
      if (imageType === "pix_received") {
        description = senderName ? `Pix de ${senderName}` : "Pix recebido";
      } else if (imageType === "pix_sent") {
        description = receiverName ? `Pix para ${receiverName}` : "Pix enviado";
      } else {
        description = receipt.establishment || receipt.description || "Comprovante";
      }

      const receiptItemsList = receipt.items && receipt.items.length > 1 ? receipt.items : null;

      const transactionData = {
        userId,
        type: transactionType,
        amount: amount as any,
        categoryName,
        description,
        date,
        paymentMethod: receipt.paymentMethod || null,
        establishment,
        location: receipt.location || null,
        source: "whatsapp",
        receiptItems: receiptItemsList ? JSON.stringify(receiptItemsList.map((i: any) => ({ description: String(i.description || ""), amount: Number(i.amount || 0) }))) : null,
      };

      const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeStr = receipt.time ? ` às ${receipt.time}` : "";

      let replyLine: string;
      if (imageType === "pix_received") {
        replyLine = `📥 Pix recebido${senderName ? ` de *${senderName}*` : ""} — R$ ${amount.toFixed(2).replace(".", ",")} (${categoryName}) 📅 ${dateStr}${timeStr}`;
      } else if (imageType === "pix_sent") {
        replyLine = `📤 Pix enviado${receiverName ? ` p/ *${receiverName}*` : ""} — R$ ${amount.toFixed(2).replace(".", ",")} (${categoryName}) 📅 ${dateStr}${timeStr}`;
      } else {
        replyLine = `💸 ${establishment || description} — R$ ${amount.toFixed(2).replace(".", ",")} em *${categoryName}* 📅 ${dateStr}${timeStr}`;
        if (receipt.items && receipt.items.length > 1) replyLine += ` 📋 ${receipt.items.length} itens`;
      }

      return { transactionData, amount, transactionType, description, establishment, date, replyLine };
    };

    // Check if user belongs to any organization — if so, route based on instance context
    const userOrgs = await storage.getUserOrganizations(userId);

    // In BUSINESS instance: always route receipt directly to business (first org)
    if (this.instanceName === "business" && userOrgs.length > 0 && validReceipts.length === 1) {
      const { transactionData, replyLine } = buildTxData(validReceipts[0]);
      const org = userOrgs[0];
      let receiptImageUrl: string | undefined;
      let receiptImageBase64: string | undefined = dataUrl;
      if (isStorageConfigured) {
        const uploaded = await uploadBase64Image(dataUrl, "receipts");
        if (uploaded) { receiptImageUrl = uploaded; receiptImageBase64 = undefined; }
      }
      await storage.createBusinessExpense({
        organizationId: org.id, userId, amount: transactionData.amount,
        description: transactionData.description, categoryName: transactionData.categoryName,
        establishment: transactionData.establishment, paymentMethod: transactionData.paymentMethod,
        receiptItems: transactionData.receiptItems ?? null, receiptImageBase64, receiptImageUrl,
        date: transactionData.date, source: "whatsapp", status: "pending_review",
      } as any);
      await this.sendMessage(jid, `✅ *Despesa corporativa registrada!*\n${replyLine}\n\n📋 Salvo em *${org.name}* — aguardando aprovação do gestor.`);
      return;
    }

    // In PERSONAL instance: skip org check entirely (route as personal regardless)
    // In DEFAULT mode: ask user if they have an org
    if (this.instanceName === "default" && userOrgs.length > 0 && validReceipts.length === 1) {
      const { transactionData, replyLine } = buildTxData(validReceipts[0]);
      const orgNames = userOrgs.map(o => `*${o.name}*`).join(", ");
      this.pendingBusinessChoice.set(jid, {
        transactionData,
        dataUrl,
        replyLine,
        orgs: userOrgs.map(o => ({ id: o.id, name: o.name })),
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      await this.sendMessage(jid,
        `✅ Comprovante identificado:\n${replyLine}\n\n` +
        `🏢 Essa despesa é *pessoal* ou corporativa?\n` +
        `Responda: *pessoal* ou o nome da empresa (${orgNames})`
      );
      return;
    }

    // Single receipt: keep existing duplicate-detection + pendingDuplicates flow
    if (validReceipts.length === 1) {
      const { transactionData, amount, transactionType, description, establishment, date, replyLine } = buildTxData(validReceipts[0]);

      const windowStart = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(date.getTime() + 7 * 24 * 60 * 60 * 1000);
      const recent = await storage.getTransactions(userId, { startDate: windowStart, endDate: windowEnd });

      const isDuplicate = recent.some(tx => {
        if (Math.abs(Number(tx.amount) - amount) > 0.01) return false;
        if (tx.type !== transactionType) return false;
        const txDate = new Date(tx.date);
        const diffMs = Math.abs(txDate.getTime() - date.getTime());
        const withinTwoHours = diffMs < 2 * 60 * 60 * 1000;
        const sameDay = txDate.toDateString() === date.toDateString();
        if (!withinTwoHours && !sameDay) return false;
        const descMatch = tx.description?.toLowerCase() === description.toLowerCase();
        const estMatch = establishment && tx.establishment?.toLowerCase() === establishment.toLowerCase();
        return descMatch || estMatch;
      });

      if (isDuplicate) {
        log(`WhatsApp: transação duplicada detectada — R$ ${amount} "${description}"`, "whatsapp");
        this.pendingDuplicates.set(jid, {
          transactionData,
          replyText: replyLine,
          expiresAt: Date.now() + 5 * 60 * 1000,
        });
        await this.sendMessage(jid,
          `⚠️ *Transação já cadastrada!*\n${replyLine}\n\n` +
          `Essa transação parece já ter sido registrada. Deseja cadastrar novamente?\n` +
          `Responda *sim* para cadastrar ou *não* para cancelar.`
        );
        return;
      }

      const savedImageTx = await this.limitedCreateTx(jid, userId, transactionData);
      if (savedImageTx === null) return;
      if (savedImageTx?.id) {
        this.lastRegisteredTx.set(jid, {
          id: savedImageTx.id,
          description: transactionData.description || establishment || "",
          amount,
          categoryName: transactionData.categoryName || "outros",
          establishment: establishment || null,
          type: transactionType,
          expiresAt: Date.now() + 30 * 60 * 1000,
        });
      }
      await this.sendMessage(jid, `✅ *Comprovante registrado!*\n${replyLine}`);
      log(`WhatsApp image processed — ${transactionType} R$ ${amount}`, "whatsapp");
      return;
    }

    // Multiple receipts: save all, build consolidated summary
    const lines: string[] = [];
    let savedCount = 0;
    let limitHit = false;
    for (const receipt of validReceipts) {
      const { transactionData, amount, transactionType, replyLine } = buildTxData(receipt);
      try {
        const saved = await this.limitedCreateTx(jid, userId, transactionData);
        if (saved === null) { limitHit = true; break; }
        lines.push(replyLine);
        savedCount++;
        log(`WhatsApp multi-receipt: saved ${transactionType} R$ ${amount}`, "whatsapp");
      } catch (err: any) {
        log(`WhatsApp multi-receipt: erro ao salvar — ${err.message}`, "whatsapp");
      }
    }

    if (savedCount === 0 && !limitHit) {
      await this.sendMessage(jid, "😕 Não consegui salvar os comprovantes. Tente novamente.");
      return;
    }
    if (limitHit && savedCount === 0) return;

    const header = savedCount === 1
      ? `✅ *1 comprovante registrado!*`
      : `✅ *${savedCount} comprovantes registrados!*`;
    await this.sendMessage(jid, `${header}\n\n${lines.join("\n\n")}`);
    log(`WhatsApp: ${savedCount} comprovantes processados da imagem`, "whatsapp");
  }

  private async handleAudioMessage(
    msg: proto.IWebMessageInfo,
    jid: string,
    userId: string,
    mimetype: string
  ): Promise<void> {
    await this.sendMessage(jid, "🎙️ Transcrevendo áudio...");

    let buffer: Buffer;
    try {
      buffer = await downloadWithTimeout(msg, this.sock);
    } catch (dlErr: any) {
      log(`WhatsApp: falha ao baixar áudio — ${dlErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui baixar o áudio. Tente enviar novamente.");
      return;
    }

    let transcription: string;
    try {
      transcription = await transcribeAudio(buffer, mimetype);
      logAiUsage(userId, "audio_transcription").catch(() => {});
    } catch (tErr: any) {
      log(`WhatsApp: falha na transcrição — ${tErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui entender o áudio. Tente falar com mais clareza ou envie uma mensagem de texto.");
      return;
    }

    if (!transcription?.trim()) {
      await this.sendMessage(jid, "😕 Não consegui entender o áudio. Tente enviar uma mensagem de texto.");
      return;
    }

    log(`WhatsApp: áudio transcrito — "${transcription.substring(0, 80)}"`, "whatsapp");
    await this.sendMessage(jid, `🎙️ Entendi: _${transcription}_`);

    const result = await detectIntentAndProcess(transcription, userId);
    logAiUsage(userId, "intent_detection").catch(() => {});
    log(`WhatsApp: intent=${result.intent} (áudio) para userId=${userId}`, "whatsapp");
    logWhatsappMessage(jid.split("@")[0], "audio", result.intent, userId).catch(() => {});
    const reply = await this.buildReply(result, userId, jid);
    if (reply) await this.sendMessage(jid, reply);
  }

  private async handleDocumentPDF(
    msg: proto.IWebMessageInfo,
    jid: string,
    userId: string,
    fileName: string
  ): Promise<void> {
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    const supported = ["pdf", "txt", "csv"].includes(ext);

    if (!supported) {
      await this.sendMessage(jid, `📄 Arquivo *${fileName}* não suportado.\n\nEnvie extratos nos formatos: PDF, TXT ou CSV.`);
      return;
    }

    // ── Plan limit check ──────────────────────────────────────────────────────
    try {
      const { checkLimit, incrementCounter } = await import("./planLimits");
      const pdfLimit = await checkLimit(userId, 'whatsapp_pdf');
      if (!pdfLimit.allowed) {
        await this.sendMessage(jid, `⛔ *Limite atingido* — ${pdfLimit.reason}.\n\n👉 Faça upgrade em: https://axis.app/pricing`);
        return;
      }
      incrementCounter(userId, 'whatsapp_pdf').catch(() => {});
    } catch (limitErr: any) {
      log(`WhatsApp: erro ao checar limite de PDF — ${limitErr?.message}`, "whatsapp");
    }
    // ─────────────────────────────────────────────────────────────────────────

    await this.sendMessage(jid, "📄 Analisando extrato... Isso pode levar alguns segundos para arquivos com muitas páginas.");

    let buffer: Buffer;
    try {
      buffer = await downloadWithTimeout(msg, this.sock);
    } catch (dlErr: any) {
      log(`WhatsApp: falha ao baixar documento — ${dlErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui baixar o arquivo. Tente enviar novamente.");
      return;
    }

    let extracted: any;
    try {
      extracted = await processPDFExtract(buffer, userId);
      logAiUsage(userId, "pdf_analysis").catch(() => {});
      logWhatsappMessage(jid.split("@")[0], "document_pdf", extracted?.docType ?? "unknown", userId).catch(() => {});
    } catch (aiErr: any) {
      log(`WhatsApp: falha ao processar PDF — ${aiErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui interpretar o extrato. Verifique se o arquivo contém transações legíveis.");
      return;
    }

    if (extracted?.docType === "bill") {
      const hasBothEntities = extracted.issuerCnpj && extracted.recipientCnpj;

      if (hasBothEntities) {
        const identityMatch = await matchBillIdentity(userId, extracted);
        if (identityMatch) {
          await this.createBillFromExtracted(jid, userId, extracted, identityMatch.type);
        } else {
          this.pendingBillIdentity.set(jid, {
            extracted,
            userId,
            option1: { name: extracted.issuer || "Emissor", cnpj: extracted.issuerCnpj },
            option2: { name: extracted.recipient || "Destinatário", cnpj: extracted.recipientCnpj },
            expiresAt: Date.now() + 5 * 60 * 1000,
          });
          await this.sendMessage(jid, `🔍 *Quem é você nessa nota?*\n\n1️⃣ ${extracted.issuer || "Emissor"} (${extracted.issuerCnpj})\n2️⃣ ${extracted.recipient || "Destinatário"} (${extracted.recipientCnpj})\n\nResponda *1* ou *2*`);
          log(`WhatsApp PDF bill: aguardando identidade (userId=${userId})`, "whatsapp");
        }
      } else {
        const billType = extracted.type === "income" ? "income" : "expense";
        await this.createBillFromExtracted(jid, userId, extracted, billType);
      }
      return;
    }

    const txns: any[] = extracted?.transactions ?? [];
    if (txns.length === 0) {
      await this.sendMessage(jid, "🤔 Nenhuma transação encontrada no arquivo. Verifique se o extrato está no formato correto.");
      return;
    }

    // Deduplicate against existing transactions
    const dates = txns.filter((t: any) => t.date).map((t: any) => new Date(t.date));
    const minDate = dates.length > 0 ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))) : new Date();
    const maxDate = dates.length > 0 ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))) : new Date();
    minDate.setDate(minDate.getDate() - 1);
    maxDate.setDate(maxDate.getDate() + 1);
    const existingTxns = await storage.getTransactions(userId, { startDate: minDate, endDate: maxDate });

    const toCreate = txns.filter((t: any) => {
      const tDate = t.date ? t.date.substring(0, 10) : null;
      const tAmount = Number(t.amount);
      const tDesc = (t.description || "").toLowerCase().trim();
      return !existingTxns.some((e: any) => {
        const eDate = e.date ? new Date(e.date).toISOString().substring(0, 10) : null;
        const eAmount = Number(e.amount);
        const eDesc = (e.description || "").toLowerCase().trim();
        if (Math.abs(eAmount - tAmount) > 0.01 || e.type !== t.type) return false;
        if (tDate && eDate && tDate !== eDate) return false;
        const tShort = tDesc.substring(0, 15);
        const eShort = eDesc.substring(0, 15);
        return tShort.length > 3 && eShort.length > 3 && (tDesc.includes(eShort) || eDesc.includes(tShort));
      });
    }).map((t: any) => ({
      userId,
      amount: Number(t.amount),
      description: t.description || "Sem descrição",
      categoryName: t.categoryName || "outros",
      type: (t.type === "income" ? "income" : "expense") as "expense" | "income",
      date: t.date ? new Date(t.date) : new Date(),
      source: "pdf" as const,
      establishment: t.establishment || null,
      paymentMethod: t.paymentMethod || null,
    }));

    const skipped = txns.length - toCreate.length;

    if (toCreate.length > 0) {
      const pdfCreated = await this.limitedCreateManyTx(jid, userId, toCreate);
      if (!pdfCreated) return;
    }

    const totalExpense = toCreate.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
    const totalIncome = toCreate.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
    const period = extracted.period ? `\n📅 Período: ${extracted.period}` : "";
    const bank = extracted.bankName ? `\n🏦 Banco: ${extracted.bankName}` : "";

    let summary: string;
    if (toCreate.length === 0 && skipped > 0) {
      summary = `✅ Extrato analisado!${bank}${period}\n\nTodas as ${skipped} transações já estavam cadastradas — nada novo para importar.`;
    } else {
      summary =
        `📊 *Extrato analisado!*${bank}${period}\n\n` +
        `✅ ${toCreate.length} importadas${skipped > 0 ? `  ⏭️ ${skipped} já cadastradas` : ""}\n\n` +
        `💰 Receitas: R$ ${totalIncome.toFixed(2)}\n` +
        `💸 Gastos: R$ ${totalExpense.toFixed(2)}\n\n` +
        `_Disponíveis no AXIS._`;
    }

    await this.sendMessage(jid, summary);
    log(`WhatsApp PDF: ${toCreate.length} importadas, ${skipped} duplicadas (userId=${userId})`, "whatsapp");
  }

  private async buildCardWarning(card: any, userId: string): Promise<string> {
    try {
      const limit = Number(card.limit);
      if (!limit || limit <= 0) return "";
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const cardTx = await db.select().from(transactions)
        .where(and(
          eq(transactions.userId, userId),
          eq(transactions.creditCardId, card.id),
          eq(transactions.type, "expense"),
          gte(transactions.date, startOfMonth)
        ));
      const used = cardTx.reduce((s: number, t: any) => s + Number(t.amount), 0);
      const pct = (used / limit) * 100;
      if (pct < 50) return "";
      const allTx = await db.select().from(transactions).where(eq(transactions.userId, userId));
      const allExpenses = allTx.filter((t: any) => t.type === "expense" && !t.creditCardId).reduce((s: number, t: any) => s + Number(t.amount), 0);
      const allIncome = allTx.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + Number(t.amount), 0);
      const profile = await storage.getUserProfile(userId);
      const bankBalance = (profile?.initialBalance ?? 0) + allIncome - allExpenses;
      const recurringIncomes = await storage.getRecurringIncomes(userId);
      const monthlyIncome = recurringIncomes.reduce((s: number, r: any) => {
        const amt = Number(r.amount);
        if (r.frequency === "weekly") return s + amt * 4.33;
        if (r.frequency === "biweekly") return s + amt * 2;
        return s + amt;
      }, 0);
      const balanceRatio = monthlyIncome > 0 ? bankBalance / monthlyIncome : 1;

      if (pct >= 90) {
        if (balanceRatio < 0.3) {
          return `\n\n🚨 *Alerta AXIS:* Cartão *${card.name}* em ${pct.toFixed(0)}% do limite e saldo no banco está crítico (R$${bankBalance.toFixed(0)}). Risco de descontrole financeiro.`;
        }
        return `\n\n⚠️ *AXIS:* Cartão *${card.name}* em ${pct.toFixed(0)}% do limite — próximo do teto. Avalie pausar os gastos.`;
      }
      if (pct >= 70) {
        if (balanceRatio < 0.5) {
          return `\n\n⚠️ *AXIS:* Cartão *${card.name}* em ${pct.toFixed(0)}% do limite e saldo no banco está baixo. Cuidado com novos gastos no crédito.`;
        }
        return `\n\n💳 *AXIS:* Cartão *${card.name}* já está em ${pct.toFixed(0)}% do limite este mês.`;
      }
      if (pct >= 50) {
        return `\n\n💳 *AXIS:* Cartão *${card.name}* atingiu ${pct.toFixed(0)}% do limite este mês.`;
      }
      return "";
    } catch {
      return "";
    }
  }

  private async depositIntoGoal(jid: string, userId: string, goalId: string, goalTitle: string, amount: number): Promise<void> {
    const allGoals = await storage.getFinancialGoals(userId);
    const goal = allGoals.find(g => g.id === goalId);
    const currentAmount = goal ? (Number(goal.currentAmount) || 0) : 0;
    const newAmount = currentAmount + amount;
    await storage.updateFinancialGoal(goalId, userId, { currentAmount: newAmount as any });
    const goalTx = await this.limitedCreateTx(jid, userId, {
      userId,
      type: "expense",
      amount: amount as any,
      description: `Depósito em ${goalTitle}`,
      categoryName: "reserva",
      date: new Date(),
      source: "whatsapp",
      paymentMethod: null,
      establishment: null,
    });
    if (goalTx === null) return;
    const fmtAmt = amount.toFixed(2).replace(".", ",");
    const fmtTotal = newAmount.toFixed(2).replace(".", ",");
    await this.sendMessage(jid, `✅ *R$ ${fmtAmt} guardado em ${goalTitle}!*\n💰 Total na reserva: R$ ${fmtTotal}`);
    log(`WhatsApp: depósito de R$ ${amount} em goal="${goalTitle}" userId=${userId}`, "whatsapp");
  }

  private async limitedCreateTx(jid: string, userId: string, data: Parameters<typeof storage.createTransaction>[0]): Promise<Awaited<ReturnType<typeof storage.createTransaction>> | null> {
    const limitResult = await checkLimit(userId, 'transaction');
    if (!limitResult.allowed) {
      await this.sendMessage(jid,
        `⚠️ *Limite de transações atingido!*\n\nVocê já registrou *${limitResult.current}* de *${limitResult.limit}* transações este mês no plano atual.\n\n💡 Faça upgrade para o AXIS Personal AI e tenha transações ilimitadas:\nhttps://axisapp.com/pricing`
      );
      return null;
    }
    const tx = await storage.createTransaction(data);
    incrementCounter(userId, 'transaction').catch(() => {});
    return tx;
  }

  private async limitedCreateManyTx(jid: string, userId: string, dataArray: Parameters<typeof storage.createManyTransactions>[0]): Promise<boolean> {
    if (dataArray.length === 0) return true;
    const limitResult = await checkLimit(userId, 'transaction', dataArray.length);
    if (!limitResult.allowed) {
      await this.sendMessage(jid,
        `⚠️ *Limite de transações atingido!*\n\nVocê já registrou *${limitResult.current}* de *${limitResult.limit}* transações este mês no plano atual.\n\n💡 Faça upgrade para o AXIS Personal AI e tenha transações ilimitadas:\nhttps://axisapp.com/pricing`
      );
      return false;
    }
    await storage.createManyTransactions(dataArray);
    incrementCounter(userId, 'transaction', dataArray.length).catch(() => {});
    return true;
  }

  private async handleSavingsDeposit(jid: string, userId: string, amount: number, goalName: string | null): Promise<void> {
    if (!amount || isNaN(amount) || amount <= 0) {
      await this.sendMessage(jid, "Não entendi o valor. Qual é o valor que você quer guardar?");
      return;
    }

    const allGoals = await storage.getFinancialGoals(userId);
    const activeGoals = allGoals.filter(g => g.status === "active" || !g.status);

    // Try fuzzy match if goalName was provided
    if (goalName) {
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const target = norm(goalName);
      const matched = activeGoals.find(g => {
        const t = norm(g.title);
        return t === target || t.includes(target) || target.includes(t);
      });
      if (matched) {
        await this.depositIntoGoal(jid, userId, matched.id, matched.title, amount);
        return;
      }
    }

    const fmtAmt = amount.toFixed(2).replace(".", ",");

    // No match or no goalName — show menu
    if (activeGoals.length === 0) {
      // No existing goals — ask to create new one
      if (goalName) {
        const newGoal = await storage.createFinancialGoal({
          userId,
          title: goalName,
          emoji: "💰",
          currentAmount: 0 as any,
        });
        await this.depositIntoGoal(jid, userId, newGoal.id, newGoal.title, amount);
      } else {
        this.pendingSavingsDeposit.set(jid, {
          amount,
          originalGoalName: null,
          goals: [],
          awaitingNewGoalName: true,
          expiresAt: Date.now() + 10 * 60 * 1000,
        });
        await this.sendMessage(jid, `📝 Você ainda não tem reservas. Qual será o nome da reserva onde guardar R$ ${fmtAmt}?`);
      }
      return;
    }

    const lines = activeGoals.map((g, i) => `${i + 1}️⃣ ${g.title}`).join("\n");
    const createIdx = activeGoals.length + 1;
    const notFoundMsg = goalName ? `🔍 Reserva *"${goalName}"* não encontrada.\n\n` : "";
    const menu = `${notFoundMsg}Em qual reserva deseja guardar *R$ ${fmtAmt}*?\n\n${lines}\n➕ ${createIdx} - Criar nova reserva${goalName ? ` "${goalName}"` : ""}`;

    this.pendingSavingsDeposit.set(jid, {
      amount,
      originalGoalName: goalName,
      goals: activeGoals.map(g => ({ id: g.id, title: g.title })),
      awaitingNewGoalName: false,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    await this.sendMessage(jid, menu);
  }

  private async buildReply(result: IntentResult, userId: string, jid: string): Promise<string> {
    const { intent, data } = result;

    switch (intent) {
      case "expense":
      case "income": {
        const amount = Number(data.amount);
        const categoryName = data.categoryName || "outros";
        if (data.creditCardId && data.installments && data.installments > 1) {
          const card = await storage.getCreditCard(data.creditCardId, userId);
          if (card) {
            const groupId = crypto.randomUUID();
            const baseDate = data.date ? new Date(data.date) : new Date();
            const installAmt = Math.round((amount / data.installments) * 100) / 100;
            const afterClosing = baseDate.getDate() >= card.closingDay;
            const txList = Array.from({ length: data.installments }, (_: unknown, i: number) => {
              const offset = afterClosing ? i + 1 : i;
              return {
                userId,
                amount: installAmt as any,
                description: `${data.description || categoryName} (${i + 1}/${data.installments})`,
                categoryName,
                type: "expense" as const,
                date: new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1),
                source: "whatsapp",
                establishment: data.establishment || null,
                location: null,
                creditCardId: data.creditCardId,
                installmentInfo: JSON.stringify({ current: i + 1, total: data.installments, groupId }),
              };
            });
            const installCreated = await this.limitedCreateManyTx(jid, userId, txList);
            if (!installCreated) return "";
            const warning = await this.buildCardWarning(card, userId);
            return `✅ ${data.installments}x de R$ ${installAmt.toFixed(2)} no *${card.name}* registrado!${warning}`;
          }
        }
        log(`WhatsApp buildReply: intent=${intent} amount=${amount} creditCardId=${data.creditCardId || "none"} userId=${userId}`, "whatsapp");
        const singleCard = data.creditCardId ? await storage.getCreditCard(data.creditCardId, userId) : null;
        log(`WhatsApp buildReply: singleCard=${singleCard ? singleCard.name + " id=" + singleCard.id : "null"}`, "whatsapp");
        let savedTx: Awaited<ReturnType<typeof storage.createTransaction>> | null = null;
        try {
          savedTx = await this.limitedCreateTx(jid, userId, {
            userId,
            type: intent,
            amount: amount as any,
            description: data.description || categoryName,
            categoryName,
            establishment: data.establishment || null,
            date: data.date ? new Date(data.date) : new Date(),
            source: "whatsapp",
            paymentMethod: null,
            creditCardId: singleCard ? singleCard.id : null,
          });
          if (savedTx === null) return "";
          log(`WhatsApp buildReply: transação salva id=${savedTx?.id} creditCardId=${savedTx?.creditCardId}`, "whatsapp");
        } catch (txErr: any) {
          log(`WhatsApp buildReply: ERRO ao salvar transação — ${txErr?.message} — stack: ${txErr?.stack}`, "whatsapp");
          throw txErr;
        }
        if (savedTx?.id) {
          this.lastRegisteredTx.set(jid, {
            id: savedTx.id,
            description: data.description || categoryName,
            amount,
            categoryName,
            establishment: data.establishment || null,
            type: intent,
            expiresAt: Date.now() + 30 * 60 * 1000,
          });
        }
        if (intent === "income") {
          return `✅ Receita de R$ ${amount.toFixed(2)} em *${categoryName}* registrada!`;
        }
        const cardSuffix = singleCard ? ` no *${singleCard.name}*` : "";
        const cardWarning = singleCard ? await this.buildCardWarning(singleCard, userId) : "";
        return `✅ Gasto de R$ ${amount.toFixed(2)} em *${categoryName}* registrado${cardSuffix}!${cardWarning}`;
      }

      case "task": {
        const priority = data.priority || "medium";
        await storage.createPersonalTask({
          userId,
          title: data.title,
          description: data.description || null,
          status: "pending",
          priority,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          category: data.category || null,
        });
        const p = priority === "high" ? "alta" : priority === "medium" ? "média" : "baixa";
        return `✅ Tarefa *${data.title}* criada com prioridade ${p}!`;
      }

      case "schedule": {
        const startTime = data.startTime ? new Date(data.startTime) : new Date();
        await storage.createScheduleItem({
          userId,
          title: data.title,
          description: data.description || null,
          startTime,
          endTime: data.endTime ? new Date(data.endTime) : null,
          status: "pending",
        });
        const dt = startTime.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
        return `✅ Compromisso *${data.title}* agendado para ${dt}!`;
      }

      case "habit": {
        await storage.createHabit({
          userId,
          name: data.name,
          frequency: data.frequency || "daily",
          emoji: "⚡",
        });
        return `✅ Hábito *${data.name}* criado!`;
      }

      case "chat": {
        const chatReply = await chatWithContext(result.rawText, userId).catch(() => null);
        logAiUsage(userId, "chat").catch(() => {});
        return chatReply || "💬 Mensagem recebida!";
      }

      default:
        return "🤔 Não entendi. Tente:\n• *gastei 50 no almoço*\n• *criar tarefa reunião*\n• *hábito academia todo dia*\n• *agendar consulta sexta 10h*";
    }
  }

  private async createBillFromExtracted(jid: string, userId: string, extracted: any, billType: "income" | "expense"): Promise<void> {
    const title = extracted.title || "Conta importada";
    const amount = Number(extracted.amount) || 0;
    const dueDay = Number(extracted.dueDay) || new Date().getDate();
    const categoryName = extracted.categoryName || "outros";

    const notesParts: string[] = [];
    if (extracted.description) notesParts.push(`Descrição: ${extracted.description}`);
    if (extracted.issuer) notesParts.push(`Emissor: ${extracted.issuer}${extracted.issuerCnpj ? ` (${extracted.issuerCnpj})` : ""}`);
    if (extracted.recipient) notesParts.push(`Destinatário: ${extracted.recipient}${extracted.recipientCnpj ? ` (${extracted.recipientCnpj})` : ""}`);
    if (extracted.paymentInfo) notesParts.push(`Pagamento: ${extracted.paymentInfo}`);
    const notes = notesParts.length > 0 ? notesParts.join("\n") : null;

    await storage.createBill({
      userId, title, amount, type: billType, dueDay, categoryName,
      recurrenceType: "this_month", active: true, paidMonths: "[]", notes,
    });

    const amountStr = amount.toFixed(2).replace(".", ",");
    const typeLabel = billType === "income" ? "💰 A receber" : "💸 A pagar";
    const lines: string[] = [
      `📋 Conta registrada!\n`,
      `*${title}*`,
      `${typeLabel}: R$ ${amountStr}`,
      `📅 Vence dia ${dueDay}`,
    ];
    if (extracted.description) lines.push(`\n📄 ${extracted.description}`);
    if (extracted.issuer) lines.push(`🏢 Emissor: ${extracted.issuer}${extracted.issuerCnpj ? ` (${extracted.issuerCnpj})` : ""}`);
    if (extracted.recipient) lines.push(`👤 Destinatário: ${extracted.recipient}${extracted.recipientCnpj ? ` (${extracted.recipientCnpj})` : ""}`);
    if (extracted.paymentInfo) lines.push(`💳 ${extracted.paymentInfo}`);
    lines.push(`\nVeja em Contas no app.`);

    await this.sendMessage(jid, lines.join("\n"));
    log(`WhatsApp PDF bill: "${title}" R$ ${amount} (${billType}) criada (userId=${userId})`, "whatsapp");
  }

  private async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.sock || this.status !== "connected") return;
    await this.sock.sendMessage(jid, { text });
  }

  async disconnect(): Promise<void> {
    if (this.sock) {
      await this.sock.logout().catch(() => {});
      this.sock = null;
    }
    this.status = "disconnected";
    this.qrCode = null;
    this.connectedPhone = null;
    this.clearSession();
    log("WhatsApp disconnected by user", "whatsapp");
  }

  private clearSession(): void {
    if (this.pgAuthClearAll) {
      this.pgAuthClearAll().catch(e => log(`WhatsApp: erro ao limpar sessão PG — ${e.message}`, "whatsapp"));
    }
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
  }

  hasSession(): boolean {
    if (fs.existsSync(SESSION_DIR) && fs.readdirSync(SESSION_DIR).length > 0) {
      return true;
    }
    return false;
  }

  async hasSessionAsync(): Promise<boolean> {
    if (this.instanceName === "default" && fs.existsSync(SESSION_DIR) && fs.readdirSync(SESSION_DIR).length > 0) {
      return true;
    }
    if (process.env.DATABASE_URL) {
      try {
        const credsKey = this.instanceName === "default" ? "creds" : `${this.instanceName}:creds`;
        const [row] = await db.select().from(whatsappAuth).where(eq(whatsappAuth.key, credsKey));
        return !!row;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const whatsappManager = new WhatsAppManager("default");

export const whatsappPersonalManager = new WhatsAppManager("personal");
export const whatsappBusinessManager = new WhatsAppManager("business");

export const whatsappManagers: Record<string, WhatsAppManager> = {
  default: whatsappManager,
  personal: whatsappPersonalManager,
  business: whatsappBusinessManager,
};

export async function getWhatsAppMode(): Promise<"single" | "dual"> {
  try {
    const [row] = await db.select().from(systemConfig).where(eq(systemConfig.key, "whatsapp_mode"));
    return (row?.value === "dual") ? "dual" : "single";
  } catch {
    return "single";
  }
}

export function getWhatsAppManager(instance?: string): WhatsAppManager {
  if (instance === "personal") return whatsappPersonalManager;
  if (instance === "business") return whatsappBusinessManager;
  return whatsappManager;
}
