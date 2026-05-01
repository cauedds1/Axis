import express, { type Request, Response, NextFunction } from "express";
import helmet from "helmet";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runPeriodicAlertsForAll } from "./alerts";
import { whatsappManager, whatsappPersonalManager, whatsappBusinessManager, getWhatsAppMode } from "./whatsapp";

const app = express();
const httpServer = createServer(app);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ─── STRIPE WEBHOOK — must be registered BEFORE express.json() ───────────────
// Stripe requires the raw Buffer body to validate the signature.
// Registering after express.json() would parse the body and break validation.
app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      console.error('STRIPE WEBHOOK: Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      const { WebhookHandlers } = await import('./webhookHandlers');
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      console.error('Stripe webhook error:', err.message);
      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);
// ─────────────────────────────────────────────────────────────────────────────

app.use(
  express.json({
    limit: "5mb",
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
    RESEND_API_KEY: "alertas por email desativados",
    STRIPE_SECRET_KEY: "pagamentos desativados",
    STRIPE_WEBHOOK_SECRET: "webhooks Stripe desativados",
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
    const isServerError = status >= 500;
    const message = (isServerError && process.env.NODE_ENV === "production")
      ? "Internal Server Error"
      : (err.message || "Internal Server Error");

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
        getWhatsAppMode().then(waMode => {
          if (waMode === "dual") {
            whatsappPersonalManager.hasSessionAsync().then(has => {
              if (has) whatsappPersonalManager.initialize().catch(() => {});
            });
            whatsappBusinessManager.hasSessionAsync().then(has => {
              if (has) whatsappBusinessManager.initialize().catch(() => {});
            });
          } else {
            whatsappManager.hasSessionAsync().then(has => {
              if (has) whatsappManager.initialize().catch(() => {});
            });
          }
        });
      }

      setInterval(() => {
        runPeriodicAlertsForAll().catch(() => {});
      }, 6 * 60 * 60 * 1000);
    },
  );
})();
