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
      if (!profile) profile = await storage.getUserProfileByPhone(senderPhone);

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
    await this.sendMessage(jid, "🔍 Lendo nota fiscal...");

    const buffer = await downloadMediaMessage(
      msg,
      "buffer",
      {},
      { logger: { level: "silent", trace: () => {}, debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, fatal: () => {}, child: () => ({}) } as any, reuploadRequest: this.sock.updateMediaMessage }
    ) as Buffer;

    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mimetype};base64,${base64}`;

    const receipt = await processReceiptPhoto(dataUrl, userId);

    if (!receipt || !receipt.totalAmount) {
      await this.sendMessage(jid, "😕 Não consegui ler a nota fiscal. Tente uma foto mais nítida e bem iluminada.");
      return;
    }

    const amount = Number(receipt.totalAmount);
    const categoryName = receipt.categoryName || "outros";
    const establishment = receipt.establishment || null;
    const date = receipt.date || new Date().toISOString().split("T")[0];

    await storage.createTransaction({
      userId,
      type: "expense",
      amount: String(amount),
      categoryName,
      description: establishment ? `${establishment}` : "Nota fiscal",
      date,
      paymentMethod: receipt.paymentMethod || null,
      establishment: establishment,
    });

    let reply = `✅ *Nota fiscal registrada!*\n`;
    if (establishment) reply += `🏪 ${establishment}\n`;
    reply += `💰 R$ ${amount.toFixed(2)} em *${categoryName}*`;
    if (receipt.items && receipt.items.length > 1) {
      reply += `\n📋 ${receipt.items.length} itens`;
    }
    if (receipt.paymentMethod) reply += `\n💳 ${receipt.paymentMethod}`;

    await this.sendMessage(jid, reply);
    log(`WhatsApp receipt processed — R$ ${amount} at ${establishment}`, "whatsapp");
  }

  private async buildReply(result: IntentResult, userId: string): Promise<string> {
    const { intent, data } = result;

    switch (intent) {
      case "expense":
        return `✅ Gasto de R$ ${Number(data.amount).toFixed(2)} em *${data.categoryName || "outros"}* registrado!`;
      case "income":
        return `✅ Receita de R$ ${Number(data.amount).toFixed(2)} registrada!`;
      case "task": {
        const p = data.priority === "high" ? "alta" : data.priority === "medium" ? "média" : "baixa";
        return `✅ Tarefa *${data.title}* criada com prioridade ${p}!`;
      }
      case "schedule": {
        const dt = data.startTime ? new Date(data.startTime).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
        return `✅ Compromisso *${data.title}* agendado${dt ? ` para ${dt}` : ""}!`;
      }
      case "habit":
        return `✅ Hábito *${data.name}* criado!`;
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
