import type { User } from "@shared/models/auth";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    viewingUserId?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: User;
    }
  }
}

export {};
