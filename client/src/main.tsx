import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((reg) => reg.update());
  });
  caches.keys().then((names) => {
    names.forEach((name) => {
      if (name !== 'voicecrm-v3') caches.delete(name);
    });
  });
}

function hideSplash() {
  const splash = document.getElementById("splash-screen");
  if (splash) {
    splash.style.opacity = "0";
    splash.style.pointerEvents = "none";
    setTimeout(() => splash.remove(), 400);
  }
}

const splashStart = Date.now();
const MIN_SPLASH_MS = 2200;

createRoot(document.getElementById("root")!).render(<App />);
requestAnimationFrame(() => {
  const elapsed = Date.now() - splashStart;
  const remaining = Math.max(0, MIN_SPLASH_MS - elapsed);
  setTimeout(hideSplash, remaining);
});
