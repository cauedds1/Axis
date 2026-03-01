import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode";
import { storage } from "./storage";
import { detectIntentAndProcess, chatWithContext, processReceiptPhoto } from "./ai";
import type { IntentResult } from "./ai";
import { log } from "./index";
import * as fs from "fs";
import * as path from "path";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export type WhatsAppStatus = "disconnected" | "qr_pending" | "connected";

const SESSION_DIR = path.join(process.cwd(), ".whatsapp-session");

class WhatsAppManager {
  private sock: any = null;
  private status: WhatsAppStatus = "disconnected";
  private qrCode: string | null = null;
  private connectedPhone: string | null = null;
  private retryCount = 0;
  private lidCache: Map<string, string> = new Map();

  getStatus(): WhatsAppStatus { return this.status; }
  getQrCode(): string | null { return this.qrCode; }
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

    if (!fs.existsSync(SESSION_DIR)) {
      fs.mkdirSync(SESSION_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
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

    const text =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.ephemeralMessage?.message?.conversation ||
      (imageMsg?.caption ?? "");

    if (!text.trim() && !imageMsg) return;

    try {
      log(`WhatsApp: mensagem recebida de ${senderPhone}${imageMsg ? " [imagem]" : ` — "${text.substring(0, 60)}"`}`, "whatsapp");

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

      if (imageMsg) {
        await this.handleReceiptImage(msg, jid, profile.userId, imageMsg.mimetype || "image/jpeg");
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

    let receipt: any;
    try {
      receipt = await processReceiptPhoto(dataUrl, userId, userName);
    } catch (aiErr: any) {
      log(`WhatsApp: falha na análise de imagem pela IA — ${aiErr.message}`, "whatsapp");
      await this.sendMessage(jid, "😕 Não consegui analisar a imagem. Tente descrever o gasto em texto, por exemplo: *gastei 50 reais no almoço*");
      return;
    }

    if (!receipt || !receipt.totalAmount) {
      await this.sendMessage(jid, "😕 Não consegui identificar um valor nessa imagem. Tente uma foto mais nítida ou descreva o gasto em texto.");
      return;
    }

    // Safety net: cross-check receiver/sender name against user's name
    // Normalize a string: lowercase, remove accents, keep only letters
    const normName = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z\s]/g, "").trim();

    if (userName && (receipt.imageType === "pix_sent" || receipt.imageType === "pix_received")) {
      const userNorm = normName(userName);
      const userParts = userNorm.split(/\s+/).filter(w => w.length > 2);
      const firstName = userParts[0] ?? "";
      const lastName = userParts[userParts.length - 1] ?? "";
      const receiverNorm = receipt.receiverName ? normName(receipt.receiverName) : "";
      const senderNorm = receipt.senderName ? normName(receipt.senderName) : "";

      // Require BOTH first name AND last name to be present to avoid false positives
      const nameMatchesIn = (target: string) =>
        firstName.length > 0 && lastName.length > 0 && firstName !== lastName &&
        target.includes(firstName) && target.includes(lastName);

      // If receiverName matches user's name but AI said pix_sent → correct to pix_received
      const receiverIsUser = nameMatchesIn(receiverNorm);
      // If senderName matches user's name but AI said pix_received → correct to pix_sent
      const senderIsUser = nameMatchesIn(senderNorm);

      if (receiverIsUser && receipt.imageType === "pix_sent") {
        log(`WhatsApp: corrigindo classificação pix_sent→pix_received (receiverName="${receipt.receiverName}" bate com userName="${userName}")`, "whatsapp");
        receipt.imageType = "pix_received";
        receipt.transactionType = "income";
      } else if (senderIsUser && receipt.imageType === "pix_received") {
        log(`WhatsApp: corrigindo classificação pix_received→pix_sent (senderName="${receipt.senderName}" bate com userName="${userName}")`, "whatsapp");
        receipt.imageType = "pix_sent";
        receipt.transactionType = "expense";
      }
    }

    const amount = Number(receipt.totalAmount);
    const transactionType: "expense" | "income" = receipt.transactionType === "income" ? "income" : "expense";
    const categoryName = receipt.categoryName || "outros";
    const imageType = receipt.imageType ?? "receipt";

    // Build date + time combined
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

    // Build establishment and description based on transaction type
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

    await storage.createTransaction({
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
    });

    const isPix = imageType === "pix_sent" || imageType === "pix_received";
    const emoji = transactionType === "income" ? "📥" : "📤";

    // Format date/time for reply
    const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = receipt.time ? ` às ${receipt.time}` : "";

    let reply: string;
    if (imageType === "pix_received") {
      reply = `${emoji} *Pix recebido registrado!*\n`;
      if (senderName) reply += `👤 De: *${senderName}*\n`;
    } else if (imageType === "pix_sent") {
      reply = `📤 *Pix enviado registrado!*\n`;
      if (receiverName) reply += `👤 Para: *${receiverName}*\n`;
    } else {
      reply = `✅ *Comprovante registrado!*\n`;
      if (establishment) reply += `🏪 ${establishment}\n`;
    }
    reply += `💰 R$ ${amount.toFixed(2).replace(".", ",")} em *${categoryName}*`;
    reply += `\n📅 ${dateStr}${timeStr}`;
    if (receipt.paymentMethod) reply += `\n💳 ${receipt.paymentMethod}`;
    if (receipt.items && receipt.items.length > 1) reply += `\n📋 ${receipt.items.length} itens`;

    await this.sendMessage(jid, reply);
    log(`WhatsApp image processed — ${transactionType} R$ ${amount} (${imageType})`, "whatsapp");
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
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
  }

  hasSession(): boolean {
    return fs.existsSync(SESSION_DIR) && fs.readdirSync(SESSION_DIR).length > 0;
  }
}

export const whatsappManager = new WhatsAppManager();
