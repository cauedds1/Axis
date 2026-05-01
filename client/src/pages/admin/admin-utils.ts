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
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function userName(row: { first_name?: string; firstName?: string; last_name?: string; lastName?: string; email?: string } | null | undefined) {
  if (!row) return "—";
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

type TFn = (key: string, opts?: Record<string, unknown>) => string;

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

export function formatPlan(plan: string | undefined | null, t?: TFn): string {
  if (!plan) return "—";
  if (t) return t(`billing.planName.${plan}`, { defaultValue: PLAN_LABELS[plan] ?? plan });
  return PLAN_LABELS[plan] ?? plan;
}

export function formatAccountType(type: string | undefined | null, t?: TFn): string {
  if (!type) return "—";
  if (t) return t(`users.accountTypeName.${type}`, { defaultValue: ACCOUNT_TYPE_LABELS[type] ?? type });
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  bill_due_soon: "Bill Due Soon",
  overdue_tasks: "Overdue Tasks",
  goal_deadline: "Goal Deadline",
  low_discipline: "Low Discipline",
  weekly_summary: "Weekly Summary",
  offline_reminder: "Offline Reminder",
  admin_test_email: "Test Email",
};

export function formatAlertType(type: string | undefined | null, t?: TFn): string {
  if (!type) return "—";
  if (t) return t(`email.alertTypeName.${type}`, { defaultValue: ALERT_TYPE_LABELS[type] ?? type });
  return ALERT_TYPE_LABELS[type] ?? type;
}

const AI_CALL_TYPE_LABELS: Record<string, string> = {
  chat: "Chat",
  intent_detection: "Intent Detection",
  audio_transcription: "Audio Transcription",
  receipt_analysis: "Receipt Analysis",
  pdf_extract: "PDF Extract",
  onboarding_diagnosis: "Onboarding Diagnosis",
};

export function formatAiCallType(type: string | undefined | null, t?: TFn): string {
  if (!type) return "—";
  if (t) return t(`ai.callTypeName.${type}`, { defaultValue: AI_CALL_TYPE_LABELS[type] ?? type });
  return AI_CALL_TYPE_LABELS[type] ?? type;
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "org.impersonate": "Impersonate Org",
  "impersonate": "Impersonate Org",
  "impersonate_stop": "Stop Impersonation",
  "user.delete": "Delete User",
  "delete_user": "Delete User",
  "user.deactivate": "Deactivate User",
  "deactivate_user": "Deactivate User",
  "user.reactivate": "Reactivate User",
  "reactivate_user": "Reactivate User",
  "user.reset_password": "Reset Password",
  "reset_password": "Reset Password",
  "user.update_plan": "Update Plan",
  "update_plan": "Update Plan",
  "system.maintenance_on": "Enable Maintenance",
  "maintenance_on": "Enable Maintenance",
  "system.maintenance_off": "Disable Maintenance",
  "maintenance_off": "Disable Maintenance",
  "system.seed_demo": "Seed Demo Data",
  "seed_demo": "Seed Demo Data",
  "system.reset_demo": "Reset Demo Data",
  "reset_demo": "Reset Demo Data",
};

export function formatAuditAction(action: string | undefined | null, t?: TFn): string {
  if (!action) return "—";
  if (t) return t(`audit.actionName.${action.replace(/\./g, "_")}`, { defaultValue: AUDIT_ACTION_LABELS[action] ?? action });
  return AUDIT_ACTION_LABELS[action] ?? action;
}

const WHATSAPP_TYPE_LABELS: Record<string, string> = {
  text: "Text Message",
  audio: "Audio Message",
  image_receipt: "Image Receipt",
  document_pdf: "PDF Document",
};

export function formatWhatsAppType(type: string | undefined | null, t?: TFn): string {
  if (!type) return "—";
  if (t) return t(`whatsapp.messageTypeName.${type}`, { defaultValue: WHATSAPP_TYPE_LABELS[type] ?? type });
  return WHATSAPP_TYPE_LABELS[type] ?? type;
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
