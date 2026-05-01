import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { organizations } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "./integrations/sendgrid";

type Lang = "en" | "pt";

const APP_URL =
  process.env.APP_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN ? "https://" + process.env.RAILWAY_PUBLIC_DOMAIN : null) ||
  "https://myaxis.com.br";

function fmtAmt(amount: number, currency: string, lang: Lang): string {
  const locale = lang === "en" ? "en-US" : "pt-BR";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function fmtPct(pct: number): string {
  return `${pct > 0 ? "+" : ""}${pct}%`;
}

function monthName(month: number, lang: Lang): string {
  const date = new Date(2024, month, 1);
  return date.toLocaleString(lang === "en" ? "en-US" : "pt-BR", { month: "long" });
}

function baseTemplate(content: string, lang: Lang = "pt"): string {
  const footerText =
    lang === "en"
      ? "You received this email because you have monthly reports enabled in AXIS.<br/>To disable, open the app &rarr; Settings &rarr; Notifications."
      : "Você recebeu este email porque tem relatórios mensais ativados no AXIS.<br/>Para desativar, abra o app &rarr; Configurações &rarr; Notificações.";
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
    .wrapper { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #0d0d12; border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 36px 32px; }
    .logo { font-size: 22px; font-weight: 800; color: #00E6FF; letter-spacing: -0.5px; margin-bottom: 28px; }
    .logo span { color: rgba(255,255,255,0.35); font-weight: 400; font-size: 13px; margin-left: 6px; vertical-align: middle; }
    h1 { color: #ffffff; font-size: 20px; font-weight: 700; margin: 0 0 4px; line-height: 1.3; }
    h2 { color: #ffffff; font-size: 14px; font-weight: 700; margin: 0 0 12px; letter-spacing: 0.3px; }
    p { color: rgba(255,255,255,0.55); font-size: 14px; line-height: 1.7; margin: 0 0 16px; }
    .highlight { color: #00E6FF; font-weight: 600; }
    .highlight-red { color: #FF6B6B; font-weight: 600; }
    .highlight-green { color: #4ECDC4; font-weight: 600; }
    .highlight-orange { color: #FFB347; font-weight: 600; }
    .cta { display: block; margin-top: 28px; background: #00E6FF; color: #060608; text-decoration: none; border-radius: 12px; padding: 14px 24px; font-size: 15px; font-weight: 700; text-align: center; }
    .divider { border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 24px 0; }
    .footer { color: rgba(255,255,255,0.2); font-size: 11px; text-align: center; margin-top: 20px; line-height: 1.6; }
    .badge { display: inline-block; border-radius: 6px; padding: 3px 10px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
    .badge-info { background: rgba(0,230,255,0.1); border: 1px solid rgba(0,230,255,0.2); color: #00E6FF; }
    .badge-purple { background: rgba(167,139,250,0.15); border: 1px solid rgba(167,139,250,0.25); color: #A78BFA; }
    .section-title { font-size: 11px; font-weight: 700; letter-spacing: 0.9px; text-transform: uppercase; color: rgba(255,255,255,0.3); margin: 0 0 10px; }
    .stat-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .stat-box { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 12px; padding: 14px 12px; text-align: center; }
    .stat-box .val { font-size: 18px; font-weight: 800; color: #fff; }
    .stat-box .lbl { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
    .stat-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .stat-row:last-child { border-bottom: none; }
    .stat-label { color: rgba(255,255,255,0.55); font-size: 13px; }
    .stat-value { font-size: 13px; font-weight: 600; color: #fff; }
    .bar-bg { background: rgba(255,255,255,0.08); border-radius: 4px; height: 6px; flex: 1; margin: 0 12px; }
    .bar-fill { height: 6px; border-radius: 4px; background: #00E6FF; }
    .cat-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .cat-row:last-child { border-bottom: none; }
    .cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .cat-name { color: rgba(255,255,255,0.7); font-size: 13px; flex: 1; }
    .cat-amt { color: #fff; font-size: 13px; font-weight: 600; }
    .cat-pct { color: rgba(255,255,255,0.3); font-size: 11px; margin-left: 6px; }
    .pill { display: inline-block; background: rgba(0,230,255,0.1); border: 1px solid rgba(0,230,255,0.15); color: #00E6FF; border-radius: 8px; padding: 3px 10px; font-size: 12px; font-weight: 600; }
    .pill-green { background: rgba(78,205,196,0.1); border-color: rgba(78,205,196,0.2); color: #4ECDC4; }
    .pill-red { background: rgba(255,107,107,0.1); border-color: rgba(255,107,107,0.2); color: #FF6B6B; }
    .pill-orange { background: rgba(255,179,71,0.1); border-color: rgba(255,179,71,0.2); color: #FFB347; }
    .habit-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .habit-row:last-child { border-bottom: none; }
    .habit-emoji { font-size: 18px; width: 24px; flex-shrink: 0; }
    .habit-name { color: rgba(255,255,255,0.7); font-size: 13px; flex: 1; }
    .habit-streak { color: #FFB347; font-size: 12px; font-weight: 600; }
    .goal-row { padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .goal-row:last-child { border-bottom: none; }
    .goal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .goal-title { color: rgba(255,255,255,0.8); font-size: 13px; font-weight: 600; }
    .goal-pct { color: #00E6FF; font-size: 12px; font-weight: 700; }
    .progress-bg { background: rgba(255,255,255,0.08); border-radius: 4px; height: 6px; }
    .progress-fill { height: 6px; border-radius: 4px; background: linear-gradient(90deg, #00E6FF, #A78BFA); }
    .score-big { display: inline-flex; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: 50%; font-size: 24px; font-weight: 900; border: 3px solid; }
    .section-block { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 16px 18px; margin-bottom: 16px; }
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

const CAT_COLORS = ["#00E6FF", "#A78BFA", "#4ECDC4", "#FFB347", "#FF6B6B", "#F472B6"];

interface PersonalReportData {
  income: number;
  expenses: number;
  prevIncome: number;
  prevExpenses: number;
  savingsRate: number;
  balance: number;
  topCategories: { name: string; amount: number; pct: number }[];
  topEstablishments: { name: string; amount: number }[];
  cardStats: { name: string; used: number; limit: number; pct: number }[];
  activeGoals: { title: string; emoji: string; current: number; target: number; pct: number }[];
  habitStats: { name: string; emoji: string; streak: number; completedDays: number }[];
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  disciplineScore: number;
  upcomingBills: { title: string; amount: number; dueDay: number }[];
  currency: string;
  userName: string;
}

async function buildPersonalReportData(userId: string, month: number, year: number): Promise<PersonalReportData | null> {
  const profile = await storage.getUserProfile(userId);
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return null;

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevStart = new Date(prevYear, prevMonth, 1);
  const prevEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);

  const [txThis, txPrev, goals, habits, tasks, bills, creditCards] = await Promise.all([
    storage.getTransactions(userId, { startDate: start, endDate: end }),
    storage.getTransactions(userId, { startDate: prevStart, endDate: prevEnd }),
    storage.getFinancialGoals(userId),
    storage.getHabits(userId),
    storage.getPersonalTasks(userId),
    storage.getBills(userId),
    storage.getCreditCards(userId),
  ]);

  const income = txThis.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = txThis.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const prevIncome = txPrev.filter(t => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const prevExpenses = txPrev.filter(t => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = income - expenses;
  const savingsRate = income > 0 ? Math.round((income - expenses) / income * 100) : 0;

  const catMap: Record<string, number> = {};
  for (const t of txThis.filter(tx => tx.type === "expense")) {
    const cat = t.categoryName || (t.type === "expense" ? "Others" : "Other");
    catMap[cat] = (catMap[cat] || 0) + Number(t.amount);
  }
  const topCategories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, amount]) => ({ name, amount, pct: expenses > 0 ? Math.round((amount / expenses) * 100) : 0 }));

  const estMap: Record<string, number> = {};
  for (const t of txThis.filter(tx => tx.type === "expense" && tx.establishment)) {
    estMap[t.establishment!] = (estMap[t.establishment!] || 0) + Number(t.amount);
  }
  const topEstablishments = Object.entries(estMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => ({ name, amount }));

  const cardStats = creditCards
    .filter(c => c.active)
    .map(c => {
      const used = txThis
        .filter(t => t.creditCardId === c.id && t.type === "expense")
        .reduce((s, t) => s + Number(t.amount), 0);
      const limit = Number(c.limit) || 0;
      return { name: c.name, used, limit, pct: limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0 };
    });

  const activeGoals = goals
    .filter(g => g.status === "active")
    .slice(0, 4)
    .map(g => {
      const cur = Number(g.currentAmount) || 0;
      const tgt = Number(g.targetAmount) || 0;
      return {
        title: g.title,
        emoji: g.emoji || "🎯",
        current: cur,
        target: tgt,
        pct: tgt > 0 ? Math.min(100, Math.round((cur / tgt) * 100)) : 0,
      };
    });

  const habitStats = await Promise.all(
    habits.slice(0, 6).map(async h => {
      const logs = await storage.getHabitLogs(h.id, userId);
      const done = logs.filter(l => {
        const d = new Date(l.date);
        return d >= start && d <= end && l.completed;
      }).length;
      return { name: h.name, emoji: h.emoji || "⚡", streak: h.streak || 0, completedDays: done };
    })
  );

  // Scope tasks to those with a dueDate in the report month; fallback to createdAt for undated tasks
  const now = new Date();
  const monthTasks = tasks.filter(t => {
    if (t.dueDate) {
      const d = new Date(t.dueDate);
      return d >= start && d <= end;
    }
    if (t.createdAt) {
      const d = new Date(t.createdAt);
      return d >= start && d <= end;
    }
    return false;
  });
  const completedTasks = monthTasks.filter(t => t.status === "completed").length;
  const pendingTasks = monthTasks.filter(t => t.status === "pending").length;
  const overdueTasks = monthTasks.filter(t => t.status === "pending" && t.dueDate && new Date(t.dueDate) < now).length;

  const upcomingBills = bills
    .filter(b => b.active && b.type === "expense")
    .map(b => ({ title: b.title, amount: Number(b.amount), dueDay: b.dueDay }))
    .sort((a, b) => a.dueDay - b.dueDay)
    .slice(0, 6);

  const disciplineScore = Number(profile?.disciplineScore ?? 5);
  const currency = profile?.currency || "BRL";
  const userName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "user";

  return {
    income, expenses, prevIncome, prevExpenses, savingsRate, balance,
    topCategories, topEstablishments, cardStats, activeGoals, habitStats,
    completedTasks, pendingTasks, overdueTasks, disciplineScore,
    upcomingBills, currency, userName,
  };
}

function buildPersonalHtml(data: PersonalReportData, month: number, year: number, lang: Lang): string {
  const c = data.currency;
  const fmt = (v: number) => fmtAmt(v, c, lang);
  const mn = monthName(month, lang);
  const firstName = data.userName.split(" ")[0];

  const incomeChange = data.prevIncome > 0
    ? Math.round(((data.income - data.prevIncome) / data.prevIncome) * 100)
    : 0;
  const expChange = data.prevExpenses > 0
    ? Math.round(((data.expenses - data.prevExpenses) / data.prevExpenses) * 100)
    : 0;

  const scoreColor = data.disciplineScore >= 7 ? "#4ECDC4" : data.disciplineScore >= 4 ? "#FFB347" : "#FF6B6B";

  const isEn = lang === "en";

  const title = isEn ? `Your ${mn} ${year} Report` : `Seu Relatório de ${mn} de ${year}`;
  const subtitle = isEn
    ? `Here's a full picture of your personal finances and productivity for ${mn}.`
    : `Aqui está um panorama completo das suas finanças pessoais e produtividade em ${mn}.`;

  const summaryLabel = isEn ? "FINANCIAL SUMMARY" : "RESUMO FINANCEIRO";
  const incomeLabel = isEn ? "Income" : "Receita";
  const expensesLabel = isEn ? "Expenses" : "Gastos";
  const balanceLabel = isEn ? "Balance" : "Saldo";
  const savingsLabel = isEn ? "Savings rate" : "Taxa de poupança";
  const catLabel = isEn ? "TOP EXPENSE CATEGORIES" : "TOP CATEGORIAS DE GASTOS";
  const estLabel = isEn ? "TOP MERCHANTS" : "ONDE VOCÊ MAIS GASTOU";
  const cardsLabel = isEn ? "CREDIT CARDS" : "CARTÕES DE CRÉDITO";
  const goalsLabel = isEn ? "FINANCIAL GOALS" : "OBJETIVOS FINANCEIROS";
  const habitsLabel = isEn ? "HABITS" : "HÁBITOS";
  const tasksLabel = isEn ? "TASKS" : "TAREFAS";
  const billsLabel = isEn ? "FIXED BILLS (NEXT MONTH)" : "CONTAS FIXAS (PRÓXIMO MÊS)";
  const disciplineLabel = isEn ? "DISCIPLINE SCORE" : "SCORE DE DISCIPLINA";
  const ctaLabel = isEn ? "Open AXIS →" : "Abrir o AXIS →";
  const dayLabel = isEn ? "day" : "dia";

  let html = `
    <div class="badge badge-info">📊 ${isEn ? "Monthly Report" : "Relatório Mensal"} · ${mn} ${year}</div>
    <h1>${isEn ? `Hey, ${firstName}!` : `Olá, ${firstName}!`}</h1>
    <p>${subtitle}</p>

    <hr class="divider"/>

    <p class="section-title">${summaryLabel}</p>
    <div class="stat-grid">
      <div class="stat-box">
        <div class="val highlight-green">${fmt(data.income)}</div>
        <div class="lbl">${incomeLabel}</div>
      </div>
      <div class="stat-box">
        <div class="val highlight-red">${fmt(data.expenses)}</div>
        <div class="lbl">${expensesLabel}</div>
      </div>
      <div class="stat-box">
        <div class="val" style="color:${data.balance >= 0 ? "#4ECDC4" : "#FF6B6B"}">${fmt(data.balance)}</div>
        <div class="lbl">${balanceLabel}</div>
      </div>
    </div>

    <div class="section-block">
      <div class="stat-row">
        <span class="stat-label">${incomeLabel} vs ${isEn ? "prev. month" : "mês anterior"}</span>
        <span class="stat-value ${incomeChange >= 0 ? "highlight-green" : "highlight-red"}">${fmtPct(incomeChange)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">${expensesLabel} vs ${isEn ? "prev. month" : "mês anterior"}</span>
        <span class="stat-value ${expChange <= 0 ? "highlight-green" : "highlight-red"}">${fmtPct(expChange)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">${savingsLabel}</span>
        <span class="stat-value ${data.savingsRate >= 20 ? "highlight-green" : data.savingsRate >= 0 ? "" : "highlight-red"}">${data.savingsRate}%</span>
      </div>
    </div>
  `;

  if (data.topCategories.length > 0) {
    html += `<p class="section-title">${catLabel}</p>
    <div class="section-block" style="padding-bottom:8px;">`;
    data.topCategories.forEach((cat, i) => {
      html += `
      <div class="cat-row">
        <div class="cat-dot" style="background:${CAT_COLORS[i % CAT_COLORS.length]}"></div>
        <span class="cat-name">${cat.name}</span>
        <span class="cat-amt">${fmt(cat.amount)}</span>
        <span class="cat-pct">${cat.pct}%</span>
      </div>`;
    });
    html += `</div>`;
  }

  if (data.topEstablishments.length > 0) {
    html += `<p class="section-title">${estLabel}</p>
    <div class="section-block" style="padding-bottom:8px;">`;
    data.topEstablishments.forEach((est, i) => {
      html += `
      <div class="cat-row">
        <div class="cat-dot" style="background:${CAT_COLORS[i % CAT_COLORS.length]}"></div>
        <span class="cat-name">${est.name}</span>
        <span class="cat-amt">${fmt(est.amount)}</span>
      </div>`;
    });
    html += `</div>`;
  }

  if (data.cardStats.length > 0) {
    html += `<p class="section-title">${cardsLabel}</p>
    <div class="section-block">`;
    data.cardStats.forEach(card => {
      const barColor = card.pct >= 80 ? "#FF6B6B" : card.pct >= 60 ? "#FFB347" : "#00E6FF";
      html += `
      <div style="margin-bottom:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
          <span style="color:rgba(255,255,255,0.7);font-size:13px;">${card.name}</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.45);">${fmt(card.used)} / ${fmt(card.limit)}</span>
        </div>
        <div class="progress-bg"><div class="progress-fill" style="width:${card.pct}%;background:${barColor};"></div></div>
      </div>`;
    });
    html += `</div>`;
  }

  if (data.activeGoals.length > 0) {
    html += `<p class="section-title">${goalsLabel}</p>
    <div class="section-block" style="padding-bottom:4px;">`;
    data.activeGoals.forEach(g => {
      html += `
      <div class="goal-row">
        <div class="goal-header">
          <span class="goal-title">${g.emoji} ${g.title}</span>
          <span class="goal-pct">${g.pct}%</span>
        </div>
        <div class="progress-bg"><div class="progress-fill" style="width:${g.pct}%;"></div></div>
        <p style="font-size:11px;color:rgba(255,255,255,0.3);margin:4px 0 0;">${fmt(g.current)} / ${fmt(g.target)}</p>
      </div>`;
    });
    html += `</div>`;
  }

  if (data.habitStats.length > 0) {
    html += `<p class="section-title">${habitsLabel}</p>
    <div class="section-block" style="padding-bottom:4px;">`;
    data.habitStats.forEach(h => {
      html += `
      <div class="habit-row">
        <span class="habit-emoji">${h.emoji}</span>
        <span class="habit-name">${h.name}</span>
        <span class="habit-streak">🔥 ${h.streak}</span>
        <span style="font-size:11px;color:rgba(255,255,255,0.3);margin-left:10px;">${h.completedDays} ${dayLabel}${lang === "en" && h.completedDays !== 1 ? "s" : ""}</span>
      </div>`;
    });
    html += `</div>`;
  }

  html += `<p class="section-title">${tasksLabel}</p>
  <div class="section-block">
    <div class="stat-row">
      <span class="stat-label">${isEn ? "Completed" : "Concluídas"}</span>
      <span class="stat-value highlight-green">${data.completedTasks}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">${isEn ? "Pending" : "Pendentes"}</span>
      <span class="stat-value">${data.pendingTasks}</span>
    </div>`;
  if (data.overdueTasks > 0) {
    html += `
    <div class="stat-row">
      <span class="stat-label">${isEn ? "Overdue" : "Atrasadas"}</span>
      <span class="stat-value highlight-red">${data.overdueTasks}</span>
    </div>`;
  }
  html += `</div>`;

  html += `<p class="section-title">${disciplineLabel}</p>
  <div class="section-block" style="text-align:center;">
    <div class="score-big" style="border-color:${scoreColor};color:${scoreColor};margin:0 auto 8px;">${data.disciplineScore}</div>
    <p style="font-size:12px;color:rgba(255,255,255,0.3);margin:0;">${isEn ? "out of 10" : "de 10"}</p>
  </div>`;

  if (data.upcomingBills.length > 0) {
    html += `<p class="section-title">${billsLabel}</p>
    <div class="section-block" style="padding-bottom:4px;">`;
    data.upcomingBills.forEach(b => {
      html += `
      <div class="stat-row">
        <span class="stat-label">${b.title} <span style="color:rgba(255,255,255,0.25);font-size:11px;">(${isEn ? "day" : "dia"} ${b.dueDay})</span></span>
        <span class="stat-value">${fmt(b.amount)}</span>
      </div>`;
    });
    html += `</div>`;
  }

  html += `<hr class="divider"/>
  <a href="${APP_URL}" class="cta">${ctaLabel}</a>`;

  return baseTemplate(html, lang);
}

export async function sendPersonalMonthlyReport(userId: string, month: number, year: number): Promise<"sent" | "failed" | "skipped"> {
  const profile = await storage.getUserProfile(userId);
  if (!profile) return "skipped";
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.email) return "skipped";

  const lang: Lang = profile.language === "en" ? "en" : "pt";
  const mn = monthName(month, lang);

  let data: PersonalReportData | null;
  try {
    data = await buildPersonalReportData(userId, month, year);
  } catch (err: any) {
    console.error(`[monthly-reports] Failed to build personal data for ${userId}: ${err?.message}`);
    return "failed";
  }
  if (!data) return "skipped";

  const subject = lang === "en"
    ? `📊 Your ${mn} ${year} Personal Report — AXIS`
    : `📊 Seu Relatório Pessoal de ${mn} de ${year} — AXIS`;

  try {
    const html = buildPersonalHtml(data, month, year, lang);
    await sendEmail({ to: user.email, subject, html });
    return "sent";
  } catch (err: any) {
    console.error(`[monthly-reports] Personal email failed for ${user.email}: ${err?.message}`);
    return "failed";
  }
}

interface BusinessReportData {
  orgName: string;
  totalExpenses: number;
  approvedExpenses: number;
  pendingExpenses: number;
  rejectedExpenses: number;
  expenseCount: number;
  prevApprovedExpenses: number;
  prevReceivedAmount: number;
  topCategories: { name: string; amount: number; pct: number }[];
  topCollaborators: { name: string; amount: number; count: number }[];
  totalReceivables: number;
  receivedAmount: number;
  pendingReceivable: number;
  overdueReceivable: number;
  receivableCount: number;
  billsPaid: number;
  billsPaidCount: number;
  billsPending: number;
  billsPendingCount: number;
  billsOverdue: number;
  billsOverdueCount: number;
  projectedBalance: number;
  netResult: number;
  currency: string;
  adminName: string;
}

async function buildBusinessReportData(orgId: string, adminUserId: string, month: number, year: number): Promise<BusinessReportData | null> {
  const org = await storage.getOrganizationById(orgId);
  if (!org) return null;

  const profile = await storage.getUserProfile(adminUserId);
  const [adminUser] = await db.select().from(users).where(eq(users.id, adminUserId));
  if (!adminUser) return null;

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevStart = new Date(prevYear, prevMonth, 1);
  const prevEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);
  const now = new Date();

  const [expenses, prevExpenses, receivables, bills] = await Promise.all([
    storage.getBusinessExpenses(orgId, { startDate: start, endDate: end }),
    storage.getBusinessExpenses(orgId, { startDate: prevStart, endDate: prevEnd }),
    storage.getBusinessReceivables(orgId),
    storage.getBusinessBills(orgId),
  ]);

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const approvedExpenses = expenses.filter(e => e.status === "approved").reduce((s, e) => s + Number(e.amount), 0);
  const pendingExpenses = expenses.filter(e => e.status === "pending_review").reduce((s, e) => s + Number(e.amount), 0);
  const rejectedExpenses = expenses.filter(e => e.status === "rejected").reduce((s, e) => s + Number(e.amount), 0);
  const prevApprovedExpenses = prevExpenses.filter(e => e.status === "approved").reduce((s, e) => s + Number(e.amount), 0);

  const catMap: Record<string, number> = {};
  for (const e of expenses.filter(ex => ex.status !== "rejected")) {
    const cat = e.categoryName || "Others";
    catMap[cat] = (catMap[cat] || 0) + Number(e.amount);
  }
  const topCategories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, amount]) => ({
      name, amount,
      pct: approvedExpenses + pendingExpenses > 0
        ? Math.round((amount / (approvedExpenses + pendingExpenses)) * 100) : 0,
    }));

  const collaboratorMap: Record<string, { name: string; amount: number; count: number }> = {};
  for (const e of expenses.filter(ex => ex.status !== "rejected" && ex.userId)) {
    const uid = e.userId!;
    const name = e.userName || e.userEmail || uid;
    if (!collaboratorMap[uid]) collaboratorMap[uid] = { name, amount: 0, count: 0 };
    collaboratorMap[uid].amount += Number(e.amount);
    collaboratorMap[uid].count += 1;
  }
  const topCollaborators = Object.values(collaboratorMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const monthReceivables = receivables.filter(r => {
    if (!r.dueDate) return false;
    const d = new Date(r.dueDate);
    return d >= start && d <= end;
  });
  const totalReceivables = monthReceivables.reduce((s, r) => s + Number(r.amount), 0);
  const receivedAmount = monthReceivables.filter(r => r.status === "received").reduce((s, r) => s + Number(r.amount), 0);
  const pendingReceivable = monthReceivables
    .filter(r => r.status !== "received" && new Date(r.dueDate!) >= now)
    .reduce((s, r) => s + Number(r.amount), 0);
  const overdueReceivable = monthReceivables
    .filter(r => r.status !== "received" && new Date(r.dueDate!) < now)
    .reduce((s, r) => s + Number(r.amount), 0);

  const prevMonthReceivables = receivables.filter(r => {
    if (!r.dueDate) return false;
    const d = new Date(r.dueDate);
    return d >= prevStart && d <= prevEnd;
  });
  const prevReceivedAmount = prevMonthReceivables.filter(r => r.status === "received").reduce((s, r) => s + Number(r.amount), 0);

  const monthBills = bills.filter(b => {
    if (!b.dueDate) return false;
    const d = new Date(b.dueDate);
    return d >= start && d <= end;
  });
  const billsPaid = monthBills.filter(b => b.status === "paid").reduce((s, b) => s + Number(b.amount), 0);
  const billsPaidCount = monthBills.filter(b => b.status === "paid").length;
  const billsPending = monthBills.filter(b => b.status !== "paid" && new Date(b.dueDate) >= now).reduce((s, b) => s + Number(b.amount), 0);
  const billsPendingCount = monthBills.filter(b => b.status !== "paid" && new Date(b.dueDate) >= now).length;
  const billsOverdue = monthBills.filter(b => b.status !== "paid" && new Date(b.dueDate) < now).reduce((s, b) => s + Number(b.amount), 0);
  const billsOverdueCount = monthBills.filter(b => b.status !== "paid" && new Date(b.dueDate) < now).length;

  const netResult = receivedAmount - approvedExpenses;
  const projectedBalance = (receivedAmount + pendingReceivable) - (approvedExpenses + pendingExpenses + billsPending + billsOverdue);

  const currency = profile?.currency || "BRL";
  const adminName = [adminUser.firstName, adminUser.lastName].filter(Boolean).join(" ") || "admin";

  return {
    orgName: org.name,
    totalExpenses, approvedExpenses, pendingExpenses, rejectedExpenses,
    expenseCount: expenses.length,
    prevApprovedExpenses, prevReceivedAmount,
    topCategories, topCollaborators,
    totalReceivables, receivedAmount, pendingReceivable, overdueReceivable,
    receivableCount: monthReceivables.length,
    billsPaid, billsPaidCount,
    billsPending, billsPendingCount,
    billsOverdue, billsOverdueCount,
    projectedBalance,
    netResult,
    currency, adminName,
  };
}

function buildBusinessHtml(data: BusinessReportData, month: number, year: number, lang: Lang): string {
  const c = data.currency;
  const fmt = (v: number) => fmtAmt(v, c, lang);
  const mn = monthName(month, lang);
  const prevMn = monthName(month === 0 ? 11 : month - 1, lang);
  const firstName = data.adminName.split(" ")[0];
  const isEn = lang === "en";

  const netColor = data.netResult >= 0 ? "#4ECDC4" : "#FF6B6B";
  const projColor = data.projectedBalance >= 0 ? "#4ECDC4" : "#FF6B6B";

  const expChange = data.prevApprovedExpenses > 0
    ? Math.round(((data.approvedExpenses - data.prevApprovedExpenses) / data.prevApprovedExpenses) * 100)
    : 0;
  const revChange = data.prevReceivedAmount > 0
    ? Math.round(((data.receivedAmount - data.prevReceivedAmount) / data.prevReceivedAmount) * 100)
    : 0;

  let html = `
    <div class="badge badge-purple">🏢 ${isEn ? "Business Report" : "Relatório Empresarial"} · ${mn} ${year}</div>
    <h1>${isEn ? `Hey, ${firstName}!` : `Olá, ${firstName}!`}</h1>
    <p>${isEn
      ? `Here's the financial summary for <strong style="color:#A78BFA">${data.orgName}</strong> in ${mn} ${year}.`
      : `Aqui está o resumo financeiro de <strong style="color:#A78BFA">${data.orgName}</strong> em ${mn} de ${year}.`
    }</p>

    <hr class="divider"/>

    <p class="section-title">${isEn ? "FINANCIAL RESULT" : "RESULTADO FINANCEIRO"}</p>
    <div class="stat-grid">
      <div class="stat-box">
        <div class="val highlight-green">${fmt(data.receivedAmount)}</div>
        <div class="lbl">${isEn ? "Received" : "Recebido"}</div>
      </div>
      <div class="stat-box">
        <div class="val highlight-red">${fmt(data.approvedExpenses)}</div>
        <div class="lbl">${isEn ? "Approved exp." : "Despesas aprov."}</div>
      </div>
      <div class="stat-box">
        <div class="val" style="color:${netColor}">${fmt(data.netResult)}</div>
        <div class="lbl">${isEn ? "Net result" : "Resultado líq."}</div>
      </div>
    </div>

    <div class="section-block">
      <div class="stat-row">
        <span class="stat-label">${isEn ? "Revenue vs" : "Receita vs"} ${prevMn}</span>
        <span class="stat-value ${revChange >= 0 ? "highlight-green" : "highlight-red"}">${fmtPct(revChange)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">${isEn ? "Expenses vs" : "Despesas vs"} ${prevMn}</span>
        <span class="stat-value ${expChange <= 0 ? "highlight-green" : "highlight-red"}">${fmtPct(expChange)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">${isEn ? "Projected balance" : "Saldo projetado"}</span>
        <span class="stat-value" style="color:${projColor}">${fmt(data.projectedBalance)}</span>
      </div>
    </div>

    <p class="section-title">${isEn ? "EXPENSES BREAKDOWN" : "DESPESAS DETALHADAS"}</p>
    <div class="section-block">
      <div class="stat-row">
        <span class="stat-label">${isEn ? "Total submitted" : "Total enviado"}</span>
        <span class="stat-value">${fmt(data.totalExpenses)} <span style="font-size:11px;color:rgba(255,255,255,0.3);">(${data.expenseCount})</span></span>
      </div>
      <div class="stat-row">
        <span class="stat-label">${isEn ? "Approved" : "Aprovadas"}</span>
        <span class="stat-value highlight-green">${fmt(data.approvedExpenses)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">${isEn ? "Pending review" : "Aguardando aprovação"}</span>
        <span class="stat-value highlight-orange">${fmt(data.pendingExpenses)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">${isEn ? "Rejected" : "Rejeitadas"}</span>
        <span class="stat-value highlight-red">${fmt(data.rejectedExpenses)}</span>
      </div>
    </div>
  `;

  if (data.topCategories.length > 0) {
    html += `<p class="section-title">${isEn ? "TOP EXPENSE CATEGORIES" : "CATEGORIAS DE DESPESAS"}</p>
    <div class="section-block" style="padding-bottom:8px;">`;
    data.topCategories.forEach((cat, i) => {
      html += `
      <div class="cat-row">
        <div class="cat-dot" style="background:${CAT_COLORS[i % CAT_COLORS.length]}"></div>
        <span class="cat-name">${cat.name}</span>
        <span class="cat-amt">${fmt(cat.amount)}</span>
        <span class="cat-pct">${cat.pct}%</span>
      </div>`;
    });
    html += `</div>`;
  }

  if (data.topCollaborators.length > 0) {
    html += `<p class="section-title">${isEn ? "TOP COLLABORATORS BY SPEND" : "TOP COLABORADORES POR GASTO"}</p>
    <div class="section-block" style="padding-bottom:8px;">`;
    data.topCollaborators.forEach((col, i) => {
      html += `
      <div class="cat-row">
        <div class="cat-dot" style="background:${CAT_COLORS[i % CAT_COLORS.length]}"></div>
        <span class="cat-name">${col.name}</span>
        <span class="cat-amt">${fmt(col.amount)}</span>
        <span class="cat-pct">${col.count} ${isEn ? "exp." : "desp."}</span>
      </div>`;
    });
    html += `</div>`;
  }

  html += `<p class="section-title">${isEn ? "RECEIVABLES" : "CONTAS A RECEBER"}</p>
  <div class="section-block">
    <div class="stat-row">
      <span class="stat-label">${isEn ? "Expected this month" : "Previsto no mês"}</span>
      <span class="stat-value">${fmt(data.totalReceivables)} <span style="font-size:11px;color:rgba(255,255,255,0.3);">(${data.receivableCount})</span></span>
    </div>
    <div class="stat-row">
      <span class="stat-label">${isEn ? "Received" : "Recebido"}</span>
      <span class="stat-value highlight-green">${fmt(data.receivedAmount)}</span>
    </div>
    <div class="stat-row">
      <span class="stat-label">${isEn ? "Pending (not yet due)" : "Pendente (ainda no prazo)"}</span>
      <span class="stat-value highlight-orange">${fmt(data.pendingReceivable)}</span>
    </div>
    ${data.overdueReceivable > 0 ? `
    <div class="stat-row">
      <span class="stat-label">${isEn ? "Overdue" : "Em atraso"}</span>
      <span class="stat-value highlight-red">${fmt(data.overdueReceivable)}</span>
    </div>` : ""}
  </div>`;

  if (data.billsPaidCount + data.billsPendingCount + data.billsOverdueCount > 0) {
    html += `<p class="section-title">${isEn ? "ACCOUNTS PAYABLE (THIS MONTH)" : "CONTAS A PAGAR (ESTE MÊS)"}</p>
    <div class="section-block">
      <div class="stat-row">
        <span class="stat-label">${isEn ? "Paid" : "Pagas"}</span>
        <span class="stat-value highlight-green">${fmt(data.billsPaid)} <span style="font-size:11px;color:rgba(255,255,255,0.3);">(${data.billsPaidCount})</span></span>
      </div>
      <div class="stat-row">
        <span class="stat-label">${isEn ? "Pending (not yet due)" : "Pendente (ainda no prazo)"}</span>
        <span class="stat-value highlight-orange">${fmt(data.billsPending)} <span style="font-size:11px;color:rgba(255,255,255,0.3);">(${data.billsPendingCount})</span></span>
      </div>
      ${data.billsOverdueCount > 0 ? `
      <div class="stat-row">
        <span class="stat-label">${isEn ? "Overdue" : "Em atraso"}</span>
        <span class="stat-value highlight-red">${fmt(data.billsOverdue)} <span style="font-size:11px;color:rgba(255,255,255,0.3);">(${data.billsOverdueCount})</span></span>
      </div>` : ""}
    </div>`;
  }

  html += `<hr class="divider"/>
  <a href="${APP_URL}/business" class="cta" style="background:#A78BFA;color:#060608;">${isEn ? "Open Business Dashboard →" : "Abrir Painel Empresarial →"}</a>`;

  return baseTemplate(html, lang);
}

export async function sendBusinessMonthlyReport(
  orgId: string,
  adminUserId: string,
  month: number,
  year: number,
): Promise<"sent" | "failed" | "skipped"> {
  const profile = await storage.getUserProfile(adminUserId);
  if (!profile) return "skipped";
  const [adminUser] = await db.select().from(users).where(eq(users.id, adminUserId));
  if (!adminUser?.email) return "skipped";

  const lang: Lang = profile.language === "en" ? "en" : "pt";
  const mn = monthName(month, lang);

  let data: BusinessReportData | null;
  try {
    data = await buildBusinessReportData(orgId, adminUserId, month, year);
  } catch (err: any) {
    console.error(`[monthly-reports] Failed to build business data for org ${orgId}: ${err?.message}`);
    return "failed";
  }
  if (!data) return "skipped";

  const subject = lang === "en"
    ? `📊 ${data.orgName} — ${mn} ${year} Business Report — AXIS`
    : `📊 ${data.orgName} — Relatório Empresarial de ${mn} de ${year} — AXIS`;

  try {
    const html = buildBusinessHtml(data, month, year, lang);
    await sendEmail({ to: adminUser.email, subject, html });
    return "sent";
  } catch (err: any) {
    console.error(`[monthly-reports] Business email failed for ${adminUser.email}: ${err?.message}`);
    return "failed";
  }
}
