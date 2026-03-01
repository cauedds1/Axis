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
import { detectIntentAndProcess, chatWithContext, processMultipleReceipts, transcribeAudio, processPDFExtract, matchBillIdentity, saveUserIdentityEntity } from "./ai";
import type { IntentResult } from "./ai";
import { log } from "./log";
import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import { users, whatsappAuth } from "@shared/schema";
import { eq } from "drizzle-orm";

export type WhatsAppStatus = "disconnected" | "qr_pending" | "connected";

function normalizeCnpjLocal(raw: string): string {
  return (raw || "").replace(/[^0-9]/g, "");
}

const SESSION_DIR = path.join(process.cwd(), ".whatsapp-session");

async function usePostgresAuthState() {
  const readData = async (key: string): Promise<any> => {
    const [row] = await db.select().from(whatsappAuth).where(eq(whatsappAuth.key, key));
    if (!row) return null;
    return JSON.parse(row.data, BufferJSON.reviver);
  };

  const writeData = async (key: string, data: any): Promise<void> => {
    const serialized = JSON.stringify(data, BufferJSON.replacer);
    await db
      .insert(whatsappAuth)
      .values({ key, data: serialized })
      .onConflictDoUpdate({ target: whatsappAuth.key, set: { data: serialized } });
  };

  const removeData = async (key: string): Promise<void> => {
    await db.delete(whatsappAuth).where(eq(whatsappAuth.key, key));
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
      await db.delete(whatsappAuth);
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

class WhatsAppManager {
  private sock: any = null;
  private status: WhatsAppStatus = "disconnected";
  private qrCode: string | null = null;
  private connectedPhone: string | null = null;
  private retryCount = 0;
  private lidCache: Map<string, string> = new Map();
  private pendingDuplicates: Map<string, PendingDuplicate> = new Map();
  private pendingBillIdentity: Map<string, PendingBillIdentity> = new Map();
  private pgAuthClearAll: (() => Promise<void>) | null = null;

  getStatus(): WhatsAppStatus { return this.status; }
  getQrCode(): string | null { return this.qrCode; }
  resetRetryCount(): void { this.retryCount = 0; }
  getConnectedPhone(): string | null { return this.connectedPhone; }

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
      log("WhatsApp: usando PostgreSQL para persistir sessão", "whatsapp");
      const pgAuth = await usePostgresAuthState();
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

        const cmdRaw = text.trim().toLowerCase();
        if (cmdRaw.startsWith("vincular")) {
          const phonePart = cmdRaw.replace("vincular", "").replace(/[^0-9]/g, "").trim();
          const matchProfiles = await storage.getAllProfiles();
          const variants = phonePart ? [phonePart, "55" + phonePart] : [];
          const target = matchProfiles.find(p => {
            const ph: string = (p as any).whatsappPhone ?? "";
            return ph && (ph === phonePart || variants.includes(ph));
          });
          if (target) {
            await storage.upsertUserProfile(target.userId, { whatsappJid: jid } as any);
            log(`WhatsApp: JID ${jid} vinculado ao userId=${target.userId}`, "whatsapp");
            await this.sendMessage(jid, "✅ WhatsApp vinculado ao AXIS! Pode enviar mensagens normalmente.");
          } else {
            await this.sendMessage(jid, "❌ Número não encontrado. Verifique se cadastrou seu número em Configurações → WhatsApp.\n\nTente: *vincular 48999186712*");
          }
          return;
        }

        await this.sendMessage(jid, "❌ Este número não está vinculado ao AXIS.\n\nPara vincular, envie:\n*vincular [seu-numero]*\n\nEx: *vincular 48999186712*");
        return;
      }

      log(`WhatsApp: usuário encontrado — userId=${profile.userId}`, "whatsapp");

      // Check for pending duplicate confirmation
      const pending = this.pendingDuplicates.get(jid);
      if (pending && !imageMsg) {
        if (Date.now() > pending.expiresAt) {
          this.pendingDuplicates.delete(jid);
        } else {
          const answer = text.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          if (answer === "sim" || answer === "s" || answer === "yes" || answer.startsWith("sim ") || answer === "cadastrar") {
            this.pendingDuplicates.delete(jid);
            await storage.createTransaction(pending.transactionData);
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

      const result = await detectIntentAndProcess(text, profile.userId);
      log(`WhatsApp: intent=${result.intent} para userId=${profile.userId}`, "whatsapp");
      const reply = await this.buildReply(result, profile.userId);
      await this.sendMessage(jid, reply);
      log(`WhatsApp: resposta enviada para ${senderPhone}`, "whatsapp");
    } catch (err: any) {
      log(`WhatsApp: erro ao processar mensagem de ${senderPhone} — ${err.message}`, "whatsapp");
      await this.sendMessage(jid, "❌ Erro ao processar. Tente novamente.");
    }
  }

  private async handleReceiptImage(
    msg: proto.IWebMessageInfo,
    jid: string,
    userId: string,
    mimetype: string
  ): Promise<void> {
    await this.sendMessage(jid, "🔍 Analisando comprovante...");

    let buffer: Buffer;
    try {
      buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        { logger: { level: "silent", trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) } as any, reuploadRequest: this.sock.updateMediaMessage }
      ) as Buffer;
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
    } catch {}

    let multiResult: { count: number; receipts: any[] };
    try {
      multiResult = await processMultipleReceipts(dataUrl, userId, userName);
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

      await storage.createTransaction(transactionData);
      await this.sendMessage(jid, `✅ *Comprovante registrado!*\n${replyLine}`);
      log(`WhatsApp image processed — ${transactionType} R$ ${amount}`, "whatsapp");
      return;
    }

    // Multiple receipts: save all, build consolidated summary
    const lines: string[] = [];
    let savedCount = 0;
    for (const receipt of validReceipts) {
      const { transactionData, amount, transactionType, replyLine } = buildTxData(receipt);
      try {
        await storage.createTransaction(transactionData);
        lines.push(replyLine);
        savedCount++;
        log(`WhatsApp multi-receipt: saved ${transactionType} R$ ${amount}`, "whatsapp");
      } catch (err: any) {
        log(`WhatsApp multi-receipt: erro ao salvar — ${err.message}`, "whatsapp");
      }
    }

    if (savedCount === 0) {
      await this.sendMessage(jid, "😕 Não consegui salvar os comprovantes. Tente novamente.");
      return;
    }

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
      buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        { logger: { level: "silent", trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) } as any, reuploadRequest: this.sock.updateMediaMessage }
      ) as Buffer;
    } catch (dlErr: any) {
      log(`WhatsApp: falha ao baixar áudio — ${dlErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui baixar o áudio. Tente enviar novamente.");
      return;
    }

    let transcription: string;
    try {
      transcription = await transcribeAudio(buffer, mimetype);
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
    log(`WhatsApp: intent=${result.intent} (áudio) para userId=${userId}`, "whatsapp");
    const reply = await this.buildReply(result, userId);
    await this.sendMessage(jid, reply);
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

    await this.sendMessage(jid, "📄 Analisando extrato...");

    let buffer: Buffer;
    try {
      buffer = await downloadMediaMessage(
        msg,
        "buffer",
        {},
        { logger: { level: "silent", trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) } as any, reuploadRequest: this.sock.updateMediaMessage }
      ) as Buffer;
    } catch (dlErr: any) {
      log(`WhatsApp: falha ao baixar documento — ${dlErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui baixar o arquivo. Tente enviar novamente.");
      return;
    }

    let extracted: any;
    try {
      extracted = await processPDFExtract(buffer, userId);
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
      establishment: null,
      paymentMethod: null,
    }));

    const skipped = txns.length - toCreate.length;

    if (toCreate.length > 0) {
      await storage.createManyTransactions(toCreate);
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

  private async buildReply(result: IntentResult, userId: string): Promise<string> {
    const { intent, data } = result;

    switch (intent) {
      case "expense":
      case "income": {
        const amount = Number(data.amount);
        const categoryName = data.categoryName || "outros";
        await storage.createTransaction({
          userId,
          type: intent,
          amount: amount as any,
          description: data.description || categoryName,
          categoryName,
          establishment: data.establishment || null,
          date: data.date ? new Date(data.date) : new Date(),
          source: "whatsapp",
          paymentMethod: null,
        });
        if (intent === "income") {
          return `✅ Receita de R$ ${amount.toFixed(2)} em *${categoryName}* registrada!`;
        }
        return `✅ Gasto de R$ ${amount.toFixed(2)} em *${categoryName}* registrado!`;
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
    if (fs.existsSync(SESSION_DIR) && fs.readdirSync(SESSION_DIR).length > 0) {
      return true;
    }
    if (process.env.DATABASE_URL) {
      try {
        const [row] = await db.select().from(whatsappAuth).where(eq(whatsappAuth.key, "creds"));
        return !!row;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export const whatsappManager = new WhatsAppManager();
