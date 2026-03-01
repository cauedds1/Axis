import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

async function loadReplitPlugins(): Promise<PluginOption[]> {
  if (process.env.NODE_ENV === "production" || !process.env.REPL_ID) return [];
  const plugins: PluginOption[] = [];
  try { const m = await import("@replit/vite-plugin-runtime-error-modal"); plugins.push(m.default()); } catch {}
  try { const m = await import("@replit/vite-plugin-cartographer"); plugins.push(m.cartographer()); } catch {}
  try { const m = await import("@replit/vite-plugin-dev-banner"); plugins.push(m.devBanner()); } catch {}
  return plugins;
}

export default defineConfig({
  plugins: [
    react(),
    ...await loadReplitPlugins(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
