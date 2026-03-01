import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runPeriodicAlertsForAll } from "./alerts";
import { whatsappManager } from "./whatsapp";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

import { log } from "./log";
export { log };

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const required = ["DATABASE_URL", "SESSION_SECRET"];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`[AXIS] ERRO: variáveis obrigatórias ausentes: ${missing.join(", ")}`);
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
  const optional: Record<string, string> = {
    OPENAI_API_KEY: "IA/chat/transcrição desativados",
    SENDGRID_API_KEY: "alertas por email desativados",
    APP_URL: `usando fallback: ${process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : "http://localhost:5000"}`,
  };
  for (const [key, hint] of Object.entries(optional)) {
    if (!process.env[key] && !process.env[`AI_INTEGRATIONS_${key}`]) {
      log(`⚠ ${key} não definida — ${hint}`, "config");
    }
  }

  const { seedDatabase } = await import("./seed");
  await seedDatabase().catch(err => console.error("Seed error:", err));

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      setTimeout(() => {
        runPeriodicAlertsForAll().catch(() => {});
      }, 30_000);

      if (process.env.NODE_ENV === "production") {
        whatsappManager.hasSessionAsync().then(has => {
          if (has) whatsappManager.initialize().catch(() => {});
        });
      }

      setInterval(() => {
        runPeriodicAlertsForAll().catch(() => {});
      }, 6 * 60 * 60 * 1000);
    },
  );
})();
