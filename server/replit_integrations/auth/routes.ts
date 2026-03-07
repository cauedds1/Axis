import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";

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
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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

      if (user.accountType === "personal") {
        return res.status(401).json({ message: "Esta conta pertence ao AXIS Pessoal. Acesse pelo portal pessoal." });
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
