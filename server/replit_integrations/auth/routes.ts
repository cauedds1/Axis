import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";
import { sendPasswordResetCodeEmail, sendWelcomeEmail } from "../../integrations/sendgrid";
import { storage } from "../../storage";

function detectLang(req: any): "en" | "pt" {
  const accept = (req.headers?.["accept-language"] || "").toLowerCase();
  return accept.startsWith("en") ? "en" : "pt";
}

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
});

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.session.userId;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      if ((user as any).deactivatedAt) {
        req.session.destroy(() => {});
        return res.status(403).json({ message: "Conta desativada. Entre em contato com o suporte." });
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ─── GET /api/auth/is-admin ──────────────────────────────────────────────────
  // Returns {isAdmin: true} if the logged-in user matches ADMIN_EMAIL; 403 otherwise.
  app.get("/api/auth/is-admin", async (req: any, res) => {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) return res.status(403).json({ isAdmin: false, reason: "ADMIN_EMAIL not configured" });
      const userId = req.session?.userId;
      if (!userId) return res.status(401).json({ isAdmin: false, reason: "Not authenticated" });
      const user = await authStorage.getUser(userId);
      if (!user || user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
        return res.status(403).json({ isAdmin: false });
      }
      res.json({ isAdmin: true, email: user.email });
    } catch (err: any) {
      res.status(500).json({ isAdmin: false, reason: err?.message });
    }
  });

  // ─── PERSONAL AUTH ───────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);

      const existing = await authStorage.getUserByEmail(data.email);
      if (existing) {
        return res.status(409).json({ message: "Este email já está cadastrado" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await authStorage.upsertUser({
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        accountType: "personal",
      });

      (req.session as any).userId = user.id;
      sendWelcomeEmail(user.email!, data.firstName, detectLang(req)).catch(() => {});
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Register error:", error);
      res.status(500).json({ message: "Erro ao criar conta" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      const user = await authStorage.getUserByEmail(data.email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      if (user.accountType === "business") {
        return res.status(401).json({ message: "Esta conta pertence ao AXIS Business. Acesse pelo portal Business." });
      }

      if ((user as any).deactivatedAt) {
        return res.status(403).json({ message: "Conta desativada. Entre em contato com o suporte." });
      }

      const valid = await bcrypt.compare(data.password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      (req.session as any).userId = user.id;
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro ao entrar" });
    }
  });

  // ─── BUSINESS AUTH ───────────────────────────────────────────────────────────

  app.post("/api/business/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);

      const existing = await authStorage.getUserByEmail(data.email);
      if (existing) {
        if (existing.accountType === "personal") {
          return res.status(409).json({ message: "Este email já está cadastrado no AXIS Pessoal. Use outro email." });
        }
        return res.status(409).json({ message: "Este email já está cadastrado" });
      }

      const hashedPassword = await bcrypt.hash(data.password, 10);
      const user = await authStorage.upsertUser({
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        accountType: "business",
      });

      (req.session as any).userId = user.id;
      sendWelcomeEmail(user.email!, data.firstName, detectLang(req)).catch(() => {});
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Business register error:", error);
      res.status(500).json({ message: "Erro ao criar conta business" });
    }
  });

  app.post("/api/business/auth/login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      const user = await authStorage.getUserByEmail(data.email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      if (user.accountType === "personal" || user.accountType === "collaborator") {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      const valid = await bcrypt.compare(data.password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      (req.session as any).userId = user.id;
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Business login error:", error);
      res.status(500).json({ message: "Erro ao entrar" });
    }
  });

  // ─── COLLABORATOR AUTH ────────────────────────────────────────────────────────

  app.post("/api/business/auth/collaborator-login", async (req, res) => {
    try {
      const data = loginSchema.parse(req.body);

      const user = await authStorage.getUserByEmail(data.email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      if (user.accountType !== "collaborator") {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      const valid = await bcrypt.compare(data.password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Email ou senha incorretos" });
      }

      (req.session as any).userId = user.id;
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      console.error("Collaborator login error:", error);
      res.status(500).json({ message: "Erro ao entrar" });
    }
  });

  // ─── CHANGE PASSWORD ─────────────────────────────────────────────────────────

  app.post("/api/auth/change-password", async (req, res) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) return res.status(401).json({ error: "Não autenticado" });

      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Informe a senha atual e a nova senha" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres" });
      }

      const user = await authStorage.getUser(userId);
      if (!user || !user.password) return res.status(404).json({ error: "Usuário não encontrado" });

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return res.status(401).json({ error: "Senha atual incorreta" });

      const hashed = await bcrypt.hash(newPassword, 10);
      await authStorage.updateUser(userId, { password: hashed });

      res.json({ success: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Erro ao alterar senha" });
    }
  });

  // ─── FORGOT PASSWORD (send 6-digit code by email) ────────────────────────────

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Email obrigatório" });
      }

      const user = await authStorage.getUserByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.json({ success: true });
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const hashed = await bcrypt.hash(code, 10);
      const expiry = new Date(Date.now() + 15 * 60 * 1000);

      await authStorage.updateUser(user.id, {
        passwordResetToken: hashed,
        passwordResetExpiry: expiry,
      });

      const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "user";
      const _resetProfile = await storage.getUserProfile(user.id).catch(() => null);
      const _resetLang = (_resetProfile?.language === "en" ? "en" : "pt") as "en" | "pt";
      await sendPasswordResetCodeEmail(user.email!, name, code, _resetLang);

      res.json({ success: true });
    } catch (err: any) {
      console.error("Forgot password error:", err);
      res.status(500).json({ error: "Erro ao enviar código" });
    }
  });

  // ─── RESET WITH CODE ──────────────────────────────────────────────────────────

  app.post("/api/auth/reset-with-code", async (req, res) => {
    try {
      const { email, code, newPassword } = req.body;
      if (!email || !code || !newPassword) {
        return res.status(400).json({ error: "Campos obrigatórios ausentes" });
      }
      if (typeof newPassword !== "string" || newPassword.length < 8) {
        return res.status(400).json({ error: "A nova senha deve ter pelo menos 8 caracteres" });
      }

      const user = await authStorage.getUserByEmail(email.trim().toLowerCase());
      if (!user || !user.passwordResetToken || !user.passwordResetExpiry) {
        return res.status(400).json({ error: "Código inválido ou expirado" });
      }

      if (new Date() > new Date(user.passwordResetExpiry)) {
        return res.status(400).json({ error: "Código expirado. Solicite um novo." });
      }

      const valid = await bcrypt.compare(String(code).trim(), user.passwordResetToken);
      if (!valid) {
        return res.status(400).json({ error: "Código incorreto" });
      }

      const hashed = await bcrypt.hash(newPassword, 10);
      await authStorage.updateUser(user.id, {
        password: hashed,
        passwordResetToken: null,
        passwordResetExpiry: null,
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Reset with code error:", err);
      res.status(500).json({ error: "Erro ao redefinir senha" });
    }
  });

  // ─── LOGOUT (shared) ─────────────────────────────────────────────────────────

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erro ao sair" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });
}
