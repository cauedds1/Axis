export function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); } catch { return "—"; }
}

export function fmtDateTime(s: string | null | undefined) {
  if (!s) return "—";
  try { return new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

export function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export function userName(row: { first_name?: string; firstName?: string; last_name?: string; lastName?: string; email?: string }) {
  const fn = row.first_name ?? row.firstName ?? "";
  const ln = row.last_name ?? row.lastName ?? "";
  return (fn + " " + ln).trim() || row.email?.split("@")[0] || "—";
}

export function adminFetch(url: string) {
  return fetch(url, { credentials: "include" }).then(async r => {
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  });
}

export const PLAN_OPTIONS = ["starter", "personal_ai", "team"] as const;

const PLAN_LABELS: Record<string, string> = {
  personal_ai: "Personal AI",
  team: "Team Plan",
  starter: "Starter (Free)",
  trial: "Trial",
  free: "Free",
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  personal: "Personal",
  personal_ai: "Personal AI",
  business: "Business",
  collaborator: "Collaborator",
};

export function formatPlan(plan: string | undefined | null): string {
  if (!plan) return "—";
  return PLAN_LABELS[plan] ?? plan;
}

export function formatAccountType(type: string | undefined | null): string {
  if (!type) return "—";
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}
export const PIE_COLORS = ["#7a9e8a", "#6b8fa0", "#a07a9e", "#9ea07a", "#7a8ea0", "#a09a7a"];
export const CHART_PERIODS = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "All", months: 999 },
];
export const ALERT_TYPES = ["bill_due", "goal_deadline", "low_discipline", "overdue_task"];
export const AI_CALL_TYPES = ["chat", "intent_detection", "audio_transcription", "receipt_analysis", "pdf_extract", "onboarding_diagnosis"];
export const AUDIT_ACTION_TYPES = ["org.impersonate", "impersonate_stop", "user.delete", "user.deactivate", "user.reactivate", "user.reset_password", "user.update_plan", "system.maintenance_on", "system.maintenance_off", "system.seed_demo", "system.reset_demo"];
