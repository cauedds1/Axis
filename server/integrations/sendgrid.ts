// Email integration — Resend (migrated from SendGrid)
// Replit connector: connection:conn_resend_01KQJ0VCRQCYRTW2BM235TNDPX
import { Resend } from "resend";

type Lang = "en" | "pt";

async function getResendClient(): Promise<{ client: Resend; fromEmail: string }> {
  // 1. Direct env var (Railway / production)
  if (process.env.RESEND_API_KEY) {
    return {
      client: new Resend(process.env.RESEND_API_KEY),
      fromEmail: process.env.RESEND_FROM_EMAIL || process.env.SENDGRID_FROM_EMAIL || "noreply@myaxis.com.br",
    };
  }

  // 2. Replit connector (dev environment)
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (hostname && xReplitToken) {
    const data = await fetch(
      "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
      {
        headers: {
          Accept: "application/json",
          "X-Replit-Token": xReplitToken,
        },
      }
    ).then((res) => res.json()).then((d) => d.items?.[0]);

    if (data?.settings?.api_key) {
      return {
        client: new Resend(data.settings.api_key),
        fromEmail: data.settings.from_email || "noreply@myaxis.com.br",
      };
    }
  }

  throw new Error(
    "Resend not configured: set RESEND_API_KEY + RESEND_FROM_EMAIL or use the Replit connector"
  );
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
}) {
  const { client, fromEmail } = await getResendClient();
  const fromName = options.fromName || "AXIS";
  await client.emails.send({
    to: options.to,
    from: `${fromName} <${fromEmail}>`,
    subject: options.subject,
    html: options.html,
  });
}

const APP_URL = process.env.APP_URL
  || (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : null)
  || "https://myaxis.com.br";

function fmtCurrency(amount: number, lang: Lang): string {
  return lang === "en"
    ? amount.toLocaleString("en-US", { style: "currency", currency: "BRL" })
    : amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(date: Date, lang: Lang): string {
  return lang === "en"
    ? date.toLocaleDateString("en-US", { day: "2-digit", month: "long", year: "numeric" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function baseTemplate(content: string, lang: Lang = "pt"): string {
  const footerText = lang === "en"
    ? "You received this email because you have alerts enabled in AXIS.<br/>To disable, open the app &rarr; Profile &rarr; Alerts."
    : "Você recebeu este email porque tem alertas ativados no AXIS.<br/>Para desativar, abra o app &rarr; Perfil &rarr; Alertas.";
  const logoTagline = lang === "en" ? "life assistant" : "assistente de vida";
  const htmlLang = lang === "en" ? "en" : "pt-BR";

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AXIS</title>
  <style>
    body { margin: 0; padding: 0; background: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .wrapper { max-width: 520px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #0d0d12; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 36px 32px; }
    .logo { font-size: 22px; font-weight: 800; color: #00E6FF; letter-spacing: -0.5px; margin-bottom: 28px; }
    .logo span { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 13px; margin-left: 6px; vertical-align: middle; }
    h1 { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 8px; line-height: 1.3; }
    p { color: rgba(255,255,255,0.55); font-size: 14px; line-height: 1.7; margin: 0 0 16px; }
    .highlight { color: #00E6FF; font-weight: 600; }
    .highlight-red { color: #FF6B6B; font-weight: 600; }
    .highlight-orange { color: #FFB347; font-weight: 600; }
    .value-pill { display: inline-block; background: rgba(0,230,255,0.1); border: 1px solid rgba(0,230,255,0.2); color: #00E6FF; border-radius: 8px; padding: 4px 12px; font-size: 13px; font-weight: 600; margin: 4px 0; }
    .cta { display: block; margin-top: 28px; background: #00E6FF; color: #060608; text-decoration: none; border-radius: 12px; padding: 14px 24px; font-size: 15px; font-weight: 700; text-align: center; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 24px 0; }
    .footer { color: rgba(255,255,255,0.2); font-size: 11px; text-align: center; margin-top: 20px; line-height: 1.6; }
    .badge-warning { display: inline-block; background: rgba(255,179,71,0.15); border: 1px solid rgba(255,179,71,0.25); color: #FFB347; border-radius: 6px; padding: 3px 10px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .badge-info { display: inline-block; background: rgba(0,230,255,0.1); border: 1px solid rgba(0,230,255,0.2); color: #00E6FF; border-radius: 6px; padding: 3px 10px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .badge-danger { display: inline-block; background: rgba(255,107,107,0.15); border: 1px solid rgba(255,107,107,0.25); color: #FF6B6B; border-radius: 6px; padding: 3px 10px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .badge-purple { display: inline-block; background: rgba(167,139,250,0.15); border: 1px solid rgba(167,139,250,0.25); color: #A78BFA; border-radius: 6px; padding: 3px 10px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .task-row { display: flex; align-items: flex-start; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .task-row:last-child { border-bottom: none; }
    .task-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
    .task-dot-high { background: #FF6B6B; }
    .task-dot-medium { background: #FFB347; }
    .task-dot-low { background: rgba(255,255,255,0.3); }
    .task-title { color: #fff; font-size: 14px; font-weight: 500; }
    .task-sub { color: rgba(255,255,255,0.35); font-size: 12px; }
    .stat-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: rgba(255,255,255,0.45); font-size: 13px; }
    .stat-value { font-size: 14px; font-weight: 600; color: #fff; }
    .progress-bar-bg { background: rgba(255,255,255,0.08); border-radius: 6px; height: 8px; width: 100%; margin: 8px 0; }
    .progress-bar-fill { height: 8px; border-radius: 6px; background: #00E6FF; }
    .score-circle { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; font-size: 22px; font-weight: 800; border: 3px solid #FF6B6B; color: #FF6B6B; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="logo">AXIS <span>${logoTagline}</span></div>
      ${content}
    </div>
    <div class="footer">
      ${footerText}
    </div>
  </div>
</body>
</html>`;
}

export async function sendBillDueSoonEmail(
  userEmail: string,
  userName: string,
  billTitle: string,
  amount: number,
  daysLeft: number,
  lang: Lang = "pt",
): Promise<void> {
  const firstName = userName.split(" ")[0];
  const amountFormatted = fmtCurrency(amount, lang);

  let daysText: string;
  let daysHtml: string;
  let badge: string;
  let greeting: string;
  let body: string;
  let footer: string;
  let ctaLabel: string;
  let subject: string;

  if (lang === "en") {
    daysText = daysLeft === 0 ? "due today" : daysLeft === 1 ? "due tomorrow" : `due in ${daysLeft} days`;
    daysHtml = daysLeft === 0 ? "due <strong>today</strong>" : daysLeft === 1 ? "due <strong>tomorrow</strong>" : `due in <strong>${daysLeft} days</strong>`;
    badge = "⚠ Upcoming Bill";
    greeting = `Hey, ${firstName}!`;
    body = "One of your bills is almost due. Don't let it slip:";
    footer = "Stay on top of your finances — open AXIS to mark it as paid or check upcoming due dates.";
    ctaLabel = "Open AXIS &rarr;";
    subject = `⚠ ${billTitle} ${daysText} — AXIS`;
  } else {
    daysText = daysLeft === 0 ? "vence hoje" : daysLeft === 1 ? "vence amanhã" : `vence em ${daysLeft} dias`;
    daysHtml = daysLeft === 0 ? "vence <strong>hoje</strong>" : daysLeft === 1 ? "vence <strong>amanhã</strong>" : `vence em <strong>${daysLeft} dias</strong>`;
    badge = "⚠ Conta vencendo";
    greeting = `Ei, ${firstName}!`;
    body = "Uma das suas contas está quase no prazo. Não deixa passar:";
    footer = "Fique em dia com suas finanças — abra o AXIS para marcar como pago ou ver seus outros vencimentos.";
    ctaLabel = "Abrir AXIS &rarr;";
    subject = `⚠ ${billTitle} ${daysText} — AXIS`;
  }

  const html = baseTemplate(`
    <div class="badge-warning">${badge}</div>
    <h1>${greeting}</h1>
    <p>${body}</p>
    <p style="margin: 20px 0;">
      <strong style="color:#fff; font-size:16px;">${billTitle}</strong><br/>
      <span class="value-pill">${amountFormatted}</span><br/>
      <span style="color:rgba(255,255,255,0.45); font-size:13px;">${daysHtml}</span>
    </p>
    <hr class="divider"/>
    <p>${footer}</p>
    <a href="${APP_URL}" class="cta">${ctaLabel}</a>
  `, lang);

  await sendEmail({ to: userEmail, subject, html });
}

export async function sendOfflineReminderEmail(
  userEmail: string,
  userName: string,
  daysOffline: number,
  lang: Lang = "pt",
): Promise<void> {
  const firstName = userName.split(" ")[0];
  let html: string;
  let subject: string;

  if (lang === "en") {
    const dayWord = daysOffline === 1 ? "day" : "days";
    subject = `💤 You've been offline for ${daysOffline} ${dayWord} — AXIS`;
    html = baseTemplate(`
      <div class="badge-info">💤 We miss you!</div>
      <h1>We've missed you, ${firstName}!</h1>
      <p>It's been <span class="highlight">${daysOffline} ${dayWord}</span> since you last opened AXIS.</p>
      <p>Your finances, tasks, and habits have kept going. Take a quick look to make sure everything is on track.</p>
      <hr class="divider"/>
      <p style="font-size:13px; color:rgba(255,255,255,0.35);">Just a few minutes a day makes a real difference to your discipline score. 🎯</p>
      <a href="${APP_URL}" class="cta">Back to AXIS &rarr;</a>
    `, lang);
  } else {
    const dayWord = daysOffline === 1 ? "dia" : "dias";
    subject = `💤 Faz ${daysOffline} ${dayWord} que você não abre o AXIS`;
    html = baseTemplate(`
      <div class="badge-info">💤 Você sumiu!</div>
      <h1>Saudades, ${firstName}!</h1>
      <p>Faz <span class="highlight">${daysOffline} ${dayWord}</span> que você não abre o AXIS.</p>
      <p>Enquanto isso, suas finanças, tarefas e hábitos continuaram rolando. Que tal dar uma conferida rápida para não perder o controle?</p>
      <hr class="divider"/>
      <p style="font-size:13px; color:rgba(255,255,255,0.35);">Uns minutinhos por dia já fazem diferença na sua disciplina. 🎯</p>
      <a href="${APP_URL}" class="cta">Voltar ao AXIS &rarr;</a>
    `, lang);
  }

  await sendEmail({ to: userEmail, subject, html });
}

export async function sendOverdueTaskEmail(
  userEmail: string,
  userName: string,
  tasks: { title: string; priority: string; daysOverdue: number }[],
  lang: Lang = "pt",
): Promise<void> {
  const firstName = userName.split(" ")[0];
  const count = tasks.length;

  const taskRows = tasks.slice(0, 5).map(t => {
    const dotClass = t.priority === "high" ? "task-dot-high" : t.priority === "medium" ? "task-dot-medium" : "task-dot-low";
    const overdueText = lang === "en"
      ? (t.daysOverdue === 1 ? "1 day overdue" : `${t.daysOverdue} days overdue`)
      : (t.daysOverdue === 1 ? "1 dia atrasada" : `${t.daysOverdue} dias atrasada`);
    return `
      <div class="task-row">
        <div class="task-dot ${dotClass}"></div>
        <div>
          <div class="task-title">${t.title}</div>
          <div class="task-sub">${overdueText}</div>
        </div>
      </div>`;
  }).join("");

  let extraText = "";
  let subject: string;
  let html: string;

  if (lang === "en") {
    if (count > 5) extraText = `<p style="font-size:12px; color:rgba(255,255,255,0.3); margin-top:8px;">+ ${count - 5} more task${count - 5 > 1 ? "s" : ""} not shown</p>`;
    subject = `📋 You have ${count} overdue task${count > 1 ? "s" : ""} — AXIS`;
    html = baseTemplate(`
      <div class="badge-danger">📋 Overdue Tasks</div>
      <h1>Hey, ${firstName}!</h1>
      <p>You have <span class="highlight-red">${count} overdue task${count > 1 ? "s" : ""}</span> waiting for you:</p>
      <div style="margin: 16px 0;">
        ${taskRows}
      </div>
      ${extraText}
      <hr class="divider"/>
      <p>Completing tasks boosts your discipline score. Don't let them pile up! 💪</p>
      <a href="${APP_URL}" class="cta">View tasks &rarr;</a>
    `, lang);
  } else {
    if (count > 5) extraText = `<p style="font-size:12px; color:rgba(255,255,255,0.3); margin-top:8px;">+ ${count - 5} tarefa${count - 5 > 1 ? "s" : ""} não exibida${count - 5 > 1 ? "s" : ""}</p>`;
    subject = `📋 Você tem ${count} tarefa${count > 1 ? "s" : ""} atrasada${count > 1 ? "s" : ""} — AXIS`;
    html = baseTemplate(`
      <div class="badge-danger">📋 Tarefas atrasadas</div>
      <h1>Ei, ${firstName}!</h1>
      <p>Você tem <span class="highlight-red">${count} tarefa${count > 1 ? "s" : ""} atrasada${count > 1 ? "s" : ""}</span> esperando por você:</p>
      <div style="margin: 16px 0;">
        ${taskRows}
      </div>
      ${extraText}
      <hr class="divider"/>
      <p>Concluir tarefas aumenta seu score de disciplina. Não deixa acumular! 💪</p>
      <a href="${APP_URL}" class="cta">Ver tarefas &rarr;</a>
    `, lang);
  }

  await sendEmail({ to: userEmail, subject, html });
}

export async function sendWeeklySummaryEmail(
  userEmail: string,
  userName: string,
  summary: {
    pendingTasks: number;
    upcomingBills: { title: string; amount: number; dueDay: number }[];
    disciplineScore: number;
    habitsChecked: number;
    totalHabits: number;
  },
  lang: Lang = "pt",
): Promise<void> {
  const firstName = userName.split(" ")[0];
  const scoreColor = summary.disciplineScore <= 3 ? "#FF6B6B" : summary.disciplineScore <= 6 ? "#4A90E2" : "#4ECDC4";
  const habitPct = summary.totalHabits > 0 ? Math.round((summary.habitsChecked / summary.totalHabits) * 100) : 0;

  let html: string;
  let subject: string;

  if (lang === "en") {
    const billRows = summary.upcomingBills.slice(0, 4).map(b => {
      const amt = fmtCurrency(b.amount, "en");
      return `
        <div class="stat-row">
          <span class="stat-label">${b.title} (day ${b.dueDay})</span>
          <span class="stat-value" style="color:#FFB347;">${amt}</span>
        </div>`;
    }).join("") || `<p style="color:rgba(255,255,255,0.3); font-size:13px;">No bills due in the next 7 days ✓</p>`;

    subject = `📊 Your weekly summary — AXIS`;
    html = baseTemplate(`
      <div class="badge-purple">📊 Weekly Summary</div>
      <h1>Good start to the week, ${firstName}!</h1>
      <p>Here's a quick snapshot of your AXIS to help you start the week organized.</p>
      <hr class="divider"/>

      <p style="font-size:12px; color:rgba(255,255,255,0.3); font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px;">Tasks</p>
      <div class="stat-row">
        <span class="stat-label">Pending</span>
        <span class="stat-value" style="color:${summary.pendingTasks > 0 ? "#FFB347" : "#4ECDC4"};">${summary.pendingTasks} task${summary.pendingTasks !== 1 ? "s" : ""}</span>
      </div>
      <hr class="divider"/>

      <p style="font-size:12px; color:rgba(255,255,255,0.3); font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px;">Bills due in the next 7 days</p>
      ${billRows}
      <hr class="divider"/>

      <p style="font-size:12px; color:rgba(255,255,255,0.3); font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px;">Habits this week</p>
      <div class="stat-row">
        <span class="stat-label">${summary.habitsChecked} of ${summary.totalHabits} completed</span>
        <span class="stat-value" style="color:${habitPct >= 70 ? "#4ECDC4" : "#FFB347"};">${habitPct}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width:${habitPct}%; background:${habitPct >= 70 ? "#4ECDC4" : "#FFB347"};"></div>
      </div>
      <hr class="divider"/>

      <p style="font-size:12px; color:rgba(255,255,255,0.3); font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:12px;">Discipline Score</p>
      <div style="text-align:center; padding: 8px 0 16px;">
        <div class="score-circle" style="border-color:${scoreColor}; color:${scoreColor};">${summary.disciplineScore}</div>
        <p style="margin-top:8px; font-size:12px; color:rgba(255,255,255,0.3);">out of 10</p>
      </div>
      <a href="${APP_URL}" class="cta">Open AXIS &rarr;</a>
    `, lang);
  } else {
    const billRows = summary.upcomingBills.slice(0, 4).map(b => {
      const amt = fmtCurrency(b.amount, "pt");
      return `
        <div class="stat-row">
          <span class="stat-label">${b.title} (dia ${b.dueDay})</span>
          <span class="stat-value" style="color:#FFB347;">${amt}</span>
        </div>`;
    }).join("") || `<p style="color:rgba(255,255,255,0.3); font-size:13px;">Nenhuma conta nos próximos 7 dias ✓</p>`;

    subject = `📊 Seu resumo semanal — AXIS`;
    html = baseTemplate(`
      <div class="badge-purple">📊 Resumo da semana</div>
      <h1>Bom início de semana, ${firstName}!</h1>
      <p>Aqui está um resumo rápido do seu AXIS para você começar a semana organizado.</p>
      <hr class="divider"/>

      <p style="font-size:12px; color:rgba(255,255,255,0.3); font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px;">Tarefas</p>
      <div class="stat-row">
        <span class="stat-label">Pendentes</span>
        <span class="stat-value" style="color:${summary.pendingTasks > 0 ? "#FFB347" : "#4ECDC4"};">${summary.pendingTasks} tarefa${summary.pendingTasks !== 1 ? "s" : ""}</span>
      </div>
      <hr class="divider"/>

      <p style="font-size:12px; color:rgba(255,255,255,0.3); font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px;">Contas nos próximos 7 dias</p>
      ${billRows}
      <hr class="divider"/>

      <p style="font-size:12px; color:rgba(255,255,255,0.3); font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px;">Hábitos esta semana</p>
      <div class="stat-row">
        <span class="stat-label">${summary.habitsChecked} de ${summary.totalHabits} completados</span>
        <span class="stat-value" style="color:${habitPct >= 70 ? "#4ECDC4" : "#FFB347"};">${habitPct}%</span>
      </div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width:${habitPct}%; background:${habitPct >= 70 ? "#4ECDC4" : "#FFB347"};"></div>
      </div>
      <hr class="divider"/>

      <p style="font-size:12px; color:rgba(255,255,255,0.3); font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:12px;">Score de disciplina</p>
      <div style="text-align:center; padding: 8px 0 16px;">
        <div class="score-circle" style="border-color:${scoreColor}; color:${scoreColor};">${summary.disciplineScore}</div>
        <p style="margin-top:8px; font-size:12px; color:rgba(255,255,255,0.3);">de 10 pontos</p>
      </div>
      <a href="${APP_URL}" class="cta">Abrir AXIS &rarr;</a>
    `, lang);
  }

  await sendEmail({ to: userEmail, subject, html });
}

export async function sendGoalDeadlineEmail(
  userEmail: string,
  userName: string,
  goalTitle: string,
  targetAmount: number,
  currentAmount: number,
  daysLeft: number,
  lang: Lang = "pt",
): Promise<void> {
  const firstName = userName.split(" ")[0];
  const target = fmtCurrency(targetAmount, lang);
  const current = fmtCurrency(currentAmount, lang);
  const missing = fmtCurrency(targetAmount - currentAmount, lang);
  const pct = Math.min(100, Math.round((currentAmount / targetAmount) * 100));

  let html: string;
  let subject: string;

  if (lang === "en") {
    const daysText = daysLeft === 0 ? "due today" : daysLeft === 1 ? "due tomorrow" : `due in ${daysLeft} days`;
    subject = `🎯 Your goal "${goalTitle}" is ${daysText} — AXIS`;
    html = baseTemplate(`
      <div class="badge-warning">🎯 Goal Deadline Approaching</div>
      <h1>Hey, ${firstName}!</h1>
      <p>Your goal <strong style="color:#fff;">${goalTitle}</strong> is ${daysText} and hasn't been reached yet.</p>

      <div style="margin: 20px 0;">
        <div class="stat-row">
          <span class="stat-label">Target</span>
          <span class="stat-value">${target}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Saved so far</span>
          <span class="stat-value" style="color:#4ECDC4;">${current}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Still needed</span>
          <span class="stat-value" style="color:#FFB347;">${missing}</span>
        </div>
      </div>

      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width:${pct}%; background:#4ECDC4;"></div>
      </div>
      <p style="font-size:12px; color:rgba(255,255,255,0.3); margin-top:4px;">${pct}% complete</p>

      <hr class="divider"/>
      <p>There's still time to give a final push. Open AXIS to update your goal's progress.</p>
      <a href="${APP_URL}" class="cta">View goals &rarr;</a>
    `, lang);
  } else {
    const daysText = daysLeft === 0 ? "vence hoje" : daysLeft === 1 ? "vence amanhã" : `vence em ${daysLeft} dias`;
    subject = `🎯 Sua meta "${goalTitle}" ${daysText} — AXIS`;
    html = baseTemplate(`
      <div class="badge-warning">🎯 Meta próxima do prazo</div>
      <h1>Ei, ${firstName}!</h1>
      <p>Sua meta <strong style="color:#fff;">${goalTitle}</strong> ${daysText} e ainda não foi atingida.</p>

      <div style="margin: 20px 0;">
        <div class="stat-row">
          <span class="stat-label">Meta</span>
          <span class="stat-value">${target}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Acumulado</span>
          <span class="stat-value" style="color:#4ECDC4;">${current}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Faltam</span>
          <span class="stat-value" style="color:#FFB347;">${missing}</span>
        </div>
      </div>

      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width:${pct}%; background:#4ECDC4;"></div>
      </div>
      <p style="font-size:12px; color:rgba(255,255,255,0.3); margin-top:4px;">${pct}% concluído</p>

      <hr class="divider"/>
      <p>Ainda dá tempo de dar uma forcinha final. Abra o AXIS para atualizar o progresso da sua meta.</p>
      <a href="${APP_URL}" class="cta">Ver metas &rarr;</a>
    `, lang);
  }

  await sendEmail({ to: userEmail, subject, html });
}

export async function sendLowDisciplineEmail(
  userEmail: string,
  userName: string,
  score: number,
  lang: Lang = "pt",
): Promise<void> {
  const firstName = userName.split(" ")[0];
  let html: string;
  let subject: string;

  if (lang === "en") {
    subject = `⚡ Your discipline score dropped to ${score} — AXIS`;
    html = baseTemplate(`
      <div class="badge-danger">⚡ Discipline Dropping</div>
      <h1>Hey, ${firstName}!</h1>
      <p>Your discipline score is at <span class="highlight-red">${score}/10</span>. Don't let it fall further!</p>

      <div style="text-align:center; padding: 16px 0 20px;">
        <div class="score-circle">${score}</div>
        <p style="margin-top:8px; font-size:12px; color:rgba(255,255,255,0.3);">Current score</p>
      </div>

      <p style="font-size:13px; color:rgba(255,255,255,0.45);">What raises your score:</p>
      <div style="margin: 8px 0 16px;">
        <div class="task-row">
          <div class="task-dot" style="background:#4ECDC4;"></div>
          <div class="task-title" style="font-size:13px;">Complete tasks (+4 to +6 pts each)</div>
        </div>
        <div class="task-row">
          <div class="task-dot" style="background:#4ECDC4;"></div>
          <div class="task-title" style="font-size:13px;">Check in daily habits (+2 pts each)</div>
        </div>
        <div class="task-row">
          <div class="task-dot" style="background:#FF6B6B;"></div>
          <div class="task-title" style="font-size:13px;">Overdue tasks penalize you (-4 pts)</div>
        </div>
      </div>

      <hr class="divider"/>
      <a href="${APP_URL}" class="cta">Recover discipline &rarr;</a>
    `, lang);
  } else {
    subject = `⚡ Seu score de disciplina caiu para ${score} — AXIS`;
    html = baseTemplate(`
      <div class="badge-danger">⚡ Disciplina em queda</div>
      <h1>Ei, ${firstName}!</h1>
      <p>Seu score de disciplina está em <span class="highlight-red">${score}/10</span>. Não deixa cair mais!</p>

      <div style="text-align:center; padding: 16px 0 20px;">
        <div class="score-circle">${score}</div>
        <p style="margin-top:8px; font-size:12px; color:rgba(255,255,255,0.3);">Score atual</p>
      </div>

      <p style="font-size:13px; color:rgba(255,255,255,0.45);">O que aumenta seu score:</p>
      <div style="margin: 8px 0 16px;">
        <div class="task-row">
          <div class="task-dot" style="background:#4ECDC4;"></div>
          <div class="task-title" style="font-size:13px;">Completar tarefas (+4 a +6 pontos cada)</div>
        </div>
        <div class="task-row">
          <div class="task-dot" style="background:#4ECDC4;"></div>
          <div class="task-title" style="font-size:13px;">Marcar hábitos do dia (+2 pontos cada)</div>
        </div>
        <div class="task-row">
          <div class="task-dot" style="background:#FF6B6B;"></div>
          <div class="task-title" style="font-size:13px;">Tarefas atrasadas penalizam (-4 pontos)</div>
        </div>
      </div>

      <hr class="divider"/>
      <a href="${APP_URL}" class="cta">Recuperar disciplina &rarr;</a>
    `, lang);
  }

  await sendEmail({ to: userEmail, subject, html });
}

export async function sendWelcomeEmail(
  userEmail: string,
  firstName: string,
  lang: Lang = "pt",
): Promise<void> {
  let html: string;
  let subject: string;

  if (lang === "en") {
    subject = `Welcome to AXIS, ${firstName}! Your account is ready`;
    html = baseTemplate(`
      <div class="badge-info">🎉 Account created</div>
      <h1>Welcome to AXIS, ${firstName}!</h1>
      <p>Your account has been created successfully. You now have access to a complete assistant to organize your finances, tasks, schedule, and habits — all in one place.</p>

      <hr class="divider"/>

      <p style="font-size:12px; color:rgba(255,255,255,0.3); font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px;">What you can do in AXIS</p>
      <div style="margin: 0 0 20px;">
        <div class="task-row">
          <div class="task-dot" style="background:#00E6FF;"></div>
          <div class="task-title" style="font-size:13px;">Log expenses by voice, photo, or receipt</div>
        </div>
        <div class="task-row">
          <div class="task-dot" style="background:#A78BFA;"></div>
          <div class="task-title" style="font-size:13px;">Track bills, goals, and savings</div>
        </div>
        <div class="task-row">
          <div class="task-dot" style="background:#4ECDC4;"></div>
          <div class="task-title" style="font-size:13px;">Manage tasks, schedule, and daily habits</div>
        </div>
        <div class="task-row">
          <div class="task-dot" style="background:#FFB347;"></div>
          <div class="task-title" style="font-size:13px;">Receive alerts and weekly summaries by email</div>
        </div>
      </div>

      <hr class="divider"/>

      <p style="font-size:13px; color:rgba(255,255,255,0.4);">This email was sent to <strong style="color:rgba(255,255,255,0.6);">${userEmail}</strong> because an AXIS account was created with this address. If that wasn't you, please contact support.</p>
      <a href="${APP_URL}" class="cta">Start using AXIS &rarr;</a>
    `, lang);
  } else {
    subject = `Bem-vindo ao AXIS, ${firstName}! Sua conta está pronta`;
    html = baseTemplate(`
      <div class="badge-info">🎉 Conta criada</div>
      <h1>Bem-vindo ao AXIS, ${firstName}!</h1>
      <p>Sua conta foi criada com sucesso. Agora você tem acesso a um assistente completo para organizar suas finanças, tarefas, agenda e hábitos — tudo em um só lugar.</p>

      <hr class="divider"/>

      <p style="font-size:12px; color:rgba(255,255,255,0.3); font-weight:600; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px;">O que você pode fazer no AXIS</p>
      <div style="margin: 0 0 20px;">
        <div class="task-row">
          <div class="task-dot" style="background:#00E6FF;"></div>
          <div class="task-title" style="font-size:13px;">Registrar despesas por voz, foto ou WhatsApp</div>
        </div>
        <div class="task-row">
          <div class="task-dot" style="background:#A78BFA;"></div>
          <div class="task-title" style="font-size:13px;">Controlar contas, metas e reservas financeiras</div>
        </div>
        <div class="task-row">
          <div class="task-dot" style="background:#4ECDC4;"></div>
          <div class="task-title" style="font-size:13px;">Gerenciar tarefas, agenda e hábitos diários</div>
        </div>
        <div class="task-row">
          <div class="task-dot" style="background:#FFB347;"></div>
          <div class="task-title" style="font-size:13px;">Receber alertas e resumos semanais por email</div>
        </div>
      </div>

      <hr class="divider"/>

      <p style="font-size:13px; color:rgba(255,255,255,0.4);">Este email foi enviado para <strong style="color:rgba(255,255,255,0.6);">${userEmail}</strong> pois uma conta AXIS foi criada com este endereço. Se não foi você, entre em contato com o suporte.</p>
      <a href="${APP_URL}" class="cta">Começar a usar o AXIS →</a>
    `, lang);
  }

  await sendEmail({ to: userEmail, subject, html });
}

export async function sendPasswordResetCodeEmail(
  userEmail: string,
  userName: string,
  code: string,
  lang: Lang = "pt",
): Promise<void> {
  const firstName = userName.split(" ")[0];
  let html: string;
  let subject: string;

  if (lang === "en") {
    subject = `🔐 ${code} is your AXIS password reset code`;
    html = baseTemplate(`
      <div class="badge-info">🔐 Password Reset</div>
      <h1>Hey, ${firstName}!</h1>
      <p>You requested a password reset for your AXIS account. Use the code below to continue:</p>

      <div style="text-align:center; margin: 28px 0;">
        <div style="display:inline-block; background: rgba(0,230,255,0.08); border: 1.5px solid rgba(0,230,255,0.25); border-radius: 16px; padding: 20px 40px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #00E6FF; font-family: monospace;">${code}</span>
        </div>
        <p style="margin-top: 12px; font-size: 12px; color: rgba(255,255,255,0.3);">This code expires in <strong style="color:rgba(255,255,255,0.5);">15 minutes</strong></p>
      </div>

      <hr class="divider"/>
      <p style="font-size:13px; color:rgba(255,255,255,0.35);">If you didn't request this reset, ignore this email — your password remains unchanged.</p>
    `, lang);
  } else {
    subject = `🔐 ${code} é seu código de redefinição de senha — AXIS`;
    html = baseTemplate(`
      <div class="badge-info">🔐 Redefinição de senha</div>
      <h1>Ei, ${firstName}!</h1>
      <p>Você solicitou a redefinição da sua senha no AXIS. Use o código abaixo para continuar:</p>

      <div style="text-align:center; margin: 28px 0;">
        <div style="display:inline-block; background: rgba(0,230,255,0.08); border: 1.5px solid rgba(0,230,255,0.25); border-radius: 16px; padding: 20px 40px;">
          <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #00E6FF; font-family: monospace;">${code}</span>
        </div>
        <p style="margin-top: 12px; font-size: 12px; color: rgba(255,255,255,0.3);">Este código expira em <strong style="color:rgba(255,255,255,0.5);">15 minutos</strong></p>
      </div>

      <hr class="divider"/>
      <p style="font-size:13px; color:rgba(255,255,255,0.35);">Se você não solicitou essa redefinição, ignore este email — sua senha permanece a mesma.</p>
    `, lang);
  }

  await sendEmail({ to: userEmail, subject, html });
}

export async function sendReimbursementCollaboratorEmail(opts: {
  collaboratorEmail: string;
  collaboratorName: string;
  managerName: string;
  orgName: string;
  amount: number;
  description: string;
  paidAt: Date;
  lang?: Lang;
}): Promise<void> {
  const { collaboratorEmail, collaboratorName, managerName, orgName, amount, description, paidAt, lang = "pt" } = opts;
  const amountFmt = fmtCurrency(amount, lang);
  const dateFmt = fmtDate(paidAt, lang);
  const firstName = collaboratorName.split(" ")[0];

  let html: string;
  let subject: string;

  if (lang === "en") {
    subject = `✅ Reimbursement of ${amountFmt} processed — ${orgName}`;
    html = baseTemplate(`
      <div class="badge-info">✅ Reimbursement Processed</div>
      <h1>Your reimbursement has been sent</h1>
      <p>Hi, <strong style="color:#fff;">${firstName}</strong>.</p>
      <p>Your reimbursement for the expense below has been processed by <strong style="color:#fff;">${managerName}</strong> on behalf of <strong style="color:#fff;">${orgName}</strong>.</p>

      <hr class="divider"/>

      <div style="margin: 20px 0;">
        <div class="stat-row">
          <span class="stat-label">Description</span>
          <span class="stat-value" style="font-size:13px;">${description}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Amount</span>
          <span class="stat-value highlight">${amountFmt}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Payment date</span>
          <span class="stat-value" style="font-size:13px;">${dateFmt}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Company</span>
          <span class="stat-value" style="font-size:13px;">${orgName}</span>
        </div>
      </div>

      <hr class="divider"/>

      <p style="font-size:13px; color:rgba(255,255,255,0.4);">If you have questions about this reimbursement, contact your manager or open AXIS to check the full history.</p>
      <a href="${APP_URL}" class="cta">Open AXIS &rarr;</a>
    `, lang);
  } else {
    subject = `✅ Reembolso de ${amountFmt} processado — ${orgName}`;
    html = baseTemplate(`
      <div class="badge-info">✅ Reembolso processado</div>
      <h1>Seu reembolso foi enviado</h1>
      <p>Olá, <strong style="color:#fff;">${firstName}</strong>.</p>
      <p>Informamos que o seu reembolso referente à despesa abaixo foi processado por <strong style="color:#fff;">${managerName}</strong> em nome de <strong style="color:#fff;">${orgName}</strong>.</p>

      <hr class="divider"/>

      <div style="margin: 20px 0;">
        <div class="stat-row">
          <span class="stat-label">Descrição</span>
          <span class="stat-value" style="font-size:13px;">${description}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Valor</span>
          <span class="stat-value highlight">${amountFmt}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Data de pagamento</span>
          <span class="stat-value" style="font-size:13px;">${dateFmt}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Empresa</span>
          <span class="stat-value" style="font-size:13px;">${orgName}</span>
        </div>
      </div>

      <hr class="divider"/>

      <p style="font-size:13px; color:rgba(255,255,255,0.4);">Caso tenha dúvidas sobre este reembolso, entre em contato com o seu gestor ou acesse o AXIS para verificar o histórico completo.</p>
      <a href="${APP_URL}" class="cta">Acessar AXIS →</a>
    `, lang);
  }

  await sendEmail({ to: collaboratorEmail, subject, html });
}

export async function sendReimbursementManagerEmail(opts: {
  managerEmail: string;
  managerName: string;
  collaboratorName: string;
  orgName: string;
  amount: number;
  description: string;
  paidAt: Date;
  lang?: Lang;
}): Promise<void> {
  const { managerEmail, managerName, collaboratorName, orgName, amount, description, paidAt, lang = "pt" } = opts;
  const amountFmt = fmtCurrency(amount, lang);
  const dateFmt = fmtDate(paidAt, lang);
  const firstName = managerName.split(" ")[0];

  let html: string;
  let subject: string;

  if (lang === "en") {
    subject = `📋 Reimbursement of ${amountFmt} to ${collaboratorName} registered — ${orgName}`;
    html = baseTemplate(`
      <div class="badge-purple">📋 Reimbursement Confirmed</div>
      <h1>Reimbursement recorded successfully</h1>
      <p>Hi, <strong style="color:#fff;">${firstName}</strong>.</p>
      <p>This is a confirmation that the reimbursement below has been marked as sent within <strong style="color:#fff;">${orgName}</strong>. The collaborator has been notified automatically.</p>

      <hr class="divider"/>

      <div style="margin: 20px 0;">
        <div class="stat-row">
          <span class="stat-label">Collaborator</span>
          <span class="stat-value" style="font-size:13px;">${collaboratorName}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Description</span>
          <span class="stat-value" style="font-size:13px;">${description}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Amount reimbursed</span>
          <span class="stat-value highlight">${amountFmt}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Date recorded</span>
          <span class="stat-value" style="font-size:13px;">${dateFmt}</span>
        </div>
      </div>

      <hr class="divider"/>

      <p style="font-size:13px; color:rgba(255,255,255,0.4);">Keep this email as a record. You can view all reimbursements in the AXIS Business panel.</p>
      <a href="${APP_URL}/business" class="cta">Open Business panel &rarr;</a>
    `, lang);
  } else {
    subject = `📋 Reembolso de ${amountFmt} para ${collaboratorName} registrado — ${orgName}`;
    html = baseTemplate(`
      <div class="badge-purple">📋 Reembolso confirmado</div>
      <h1>Reembolso registrado com sucesso</h1>
      <p>Olá, <strong style="color:#fff;">${firstName}</strong>.</p>
      <p>Este é um comprovante de que o reembolso abaixo foi marcado como enviado em <strong style="color:#fff;">${orgName}</strong>. O colaborador foi notificado automaticamente.</p>

      <hr class="divider"/>

      <div style="margin: 20px 0;">
        <div class="stat-row">
          <span class="stat-label">Colaborador</span>
          <span class="stat-value" style="font-size:13px;">${collaboratorName}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Descrição</span>
          <span class="stat-value" style="font-size:13px;">${description}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Valor reembolsado</span>
          <span class="stat-value highlight">${amountFmt}</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">Data de registro</span>
          <span class="stat-value" style="font-size:13px;">${dateFmt}</span>
        </div>
      </div>

      <hr class="divider"/>

      <p style="font-size:13px; color:rgba(255,255,255,0.4);">Guarde este email como comprovante. Você pode consultar todos os reembolsos no painel do AXIS Business.</p>
      <a href="${APP_URL}/business" class="cta">Acessar painel Business →</a>
    `, lang);
  }

  await sendEmail({ to: managerEmail, subject, html });
}
