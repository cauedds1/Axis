import OpenAI from "openai";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;
  return new OpenAI({ apiKey, baseURL });
}

export interface IntentResult {
  intent: "expense" | "income" | "task" | "schedule" | "habit" | "chat" | "unknown";
  data: any;
  rawText: string;
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const file = new File([audioBuffer], "audio.webm", { type: mimeType || "audio/webm" });
  const openai = getOpenAIClient();
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    language: "pt",
  });
  return transcription.text;
}

export async function detectIntentAndProcess(text: string, userId: string): Promise<IntentResult> {
  const todayDate = new Date().toISOString().split("T")[0];
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você é o AXIS, um assistente de vida pessoal inteligente. Analise o texto do usuário e detecte a intenção.

DATA DE HOJE: ${todayDate}

INTENÇÕES POSSÍVEIS:
1. "expense" — O usuário registrou um GASTO. Palavras: "gastei", "paguei", "comprei", "custou", etc.
2. "income" — O usuário registrou uma RECEITA. Palavras: "recebi", "ganhei", "entrou", "salário", etc.
3. "task" — O usuário quer criar uma TAREFA. Palavras: "preciso", "tenho que", "não esquecer", "lembrar de", etc.
4. "schedule" — O usuário quer AGENDAR algo. Palavras: "marcar", "agendar", "reunião dia", "compromisso", etc.
5. "habit" — O usuário quer criar um HÁBITO. Palavras: "quero começar a", "hábito de", "todo dia", etc.
6. "chat" — Qualquer outra coisa que não se encaixa acima — uma pergunta, reflexão, ou conversa.

RESPONDA EM JSON:

Para expense/income:
{
  "intent": "expense" ou "income",
  "amount": número (valor em reais),
  "description": "descrição curta do gasto/receita",
  "categoryName": "nome da categoria inferida (alimentação, transporte, lazer, saúde, moradia, educação, trabalho, outros)",
  "establishment": "nome do estabelecimento se mencionado, senão null",
  "date": "${todayDate}" (ou data mencionada no formato YYYY-MM-DD)
}

Para task:
{
  "intent": "task",
  "title": "título claro e acionável da tarefa",
  "description": "detalhes extras se houver",
  "priority": "high|medium|low",
  "dueDate": "YYYY-MM-DD ou null",
  "category": "categoria se inferível"
}

Para schedule:
{
  "intent": "schedule",
  "title": "título do compromisso",
  "description": "detalhes",
  "startTime": "YYYY-MM-DDTHH:mm:ss",
  "endTime": "YYYY-MM-DDTHH:mm:ss ou null"
}

Para habit:
{
  "intent": "habit",
  "name": "nome do hábito",
  "frequency": "daily|weekly"
}

Para chat:
{
  "intent": "chat",
  "message": "a mensagem original do usuário"
}

REGRAS:
- Infira a categoria de gastos inteligentemente (açaí → alimentação, uber → transporte, cinema → lazer)
- Se o valor não for mencionado explicitamente em um gasto, retorne intent "chat" e pergunte
- Interprete datas relativas: "amanhã", "sexta", "semana que vem", etc.
- "Gastei 19 reais com açaí" → expense, amount: 19, categoryName: "alimentação"
- "Recebi 5000 de salário" → income, amount: 5000, categoryName: "trabalho"
- "Preciso ligar pro dentista" → task
- "Reunião com João terça às 14h" → schedule

REGRA CRÍTICA — habit/schedule SEM DETALHES → retorne "chat":
- "schedule": retorne SOMENTE quando há data/hora ESPECÍFICA (ex: "reunião amanhã às 14h"). Se o horário for vago ou ausente → retorne "chat".
- "habit": retorne SOMENTE para hábitos simples sem horário (ex: "quero beber mais água"). Se a pessoa quer começar uma ATIVIDADE RECORRENTE e o horário/dia não está claro → retorne "chat" para que o assistente possa perguntar.
- EXEMPLOS de "chat": "preciso começar a praticar inglês", "quero me exercitar", "vou começar a meditar", "quero aprender violão" — todos faltam horário/dia específicos.`
      },
      { role: "user", content: text }
    ],
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || '{"intent":"chat","message":""}');
  return { intent: parsed.intent, data: parsed, rawText: text };
}

export async function processReceiptPhoto(imageBase64: string, userId: string): Promise<any> {
  const openai = getOpenAIClient();
  const todayDate = new Date().toISOString().split("T")[0];

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você é o AXIS, um assistente financeiro. Analise esta foto de nota fiscal/cupom fiscal e extraia TODAS as informações.

DATA DE HOJE: ${todayDate}

EXTRAIA:
{
  "establishment": "nome do estabelecimento",
  "location": "endereço/cidade se visível",
  "date": "YYYY-MM-DD (da nota, não de hoje)",
  "items": [
    { "description": "item", "amount": número }
  ],
  "totalAmount": número total,
  "categoryName": "categoria inferida (alimentação, farmácia, mercado, transporte, etc.)",
  "paymentMethod": "forma de pagamento se visível"
}

Se não conseguir ler algo, coloque null. Nunca invente dados.`
      },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageBase64 } }
        ]
      }
    ],
  });

  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

export async function processPDFExtract(pdfText: string, userId: string): Promise<any> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você é o AXIS, um assistente financeiro. Analise este extrato bancário e extraia TODAS as transações.

EXTRAIA:
{
  "bankName": "nome do banco se identificável",
  "period": "período do extrato se identificável",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descrição da transação",
      "amount": número (positivo),
      "type": "expense" ou "income",
      "categoryName": "categoria inferida (alimentação, transporte, lazer, saúde, moradia, educação, trabalho, transferência, outros)"
    }
  ]
}

REGRAS:
- Débitos são "expense", créditos são "income"
- Infira categorias inteligentemente baseado na descrição
- PIX, TED, DOC para terceiros → "transferência"
- Salário, freelance → "trabalho"
- iFood, restaurantes → "alimentação"
- Uber, 99, combustível → "transporte"
- Netflix, Spotify, cinema → "lazer"
- Farmácia, consulta → "saúde"
- Aluguel, condomínio, luz, água → "moradia"
- Nunca invente transações que não estão no extrato`
      },
      { role: "user", content: pdfText }
    ],
  });

  return JSON.parse(response.choices[0]?.message?.content || '{"transactions":[]}');
}

export async function chatWithContext(message: string, userId: string, executedActionContext?: string): Promise<string> {
  const openai = getOpenAIClient();

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const sevenDaysAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [profile, context, allTransactions, tasks, habitsData, schedule, goals, billsData, userRows] = await Promise.all([
    storage.getUserProfile(userId),
    storage.getUserContext(userId),
    storage.getTransactions(userId, { startDate: threeMonthsAgo }),
    storage.getPersonalTasks(userId),
    storage.getHabits(userId),
    storage.getScheduleItems(userId, { startDate: new Date(), endDate: sevenDaysAhead }),
    storage.getFinancialGoals(userId),
    storage.getBills(userId),
    db.select({ firstName: users.firstName }).from(users).where(eq(users.id, userId)),
  ]);

  const chatHistory = await storage.getChatMessages(userId, 20);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ─── FINANCIALS ─────────────────────────────────────────────────────────────
  const currentMonthTx = allTransactions.filter(t => new Date(t.date) >= curMonthStart);
  const totalExpenses = currentMonthTx.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = currentMonthTx.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const balance = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;
  const spendingPct = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;

  const expensesByCategory: Record<string, number> = {};
  currentMonthTx.filter(t => t.type === "expense").forEach(t => {
    const cat = t.categoryName || "outros";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount;
  });
  const top3Categories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, val]) => `${cat}: R$${val.toFixed(0)}`);

  const monthlyHistory: Record<string, { income: number; expenses: number }> = {};
  allTransactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyHistory[key]) monthlyHistory[key] = { income: 0, expenses: 0 };
    if (t.type === "income") monthlyHistory[key].income += t.amount;
    else monthlyHistory[key].expenses += t.amount;
  });

  const recentTx = allTransactions.slice(-10).reverse();

  // ─── TASKS ──────────────────────────────────────────────────────────────────
  const pendingTasks = tasks.filter(t => t.status === "pending");
  const doneTasks = tasks.filter(t => t.status !== "pending").length;
  const overdueTasks = pendingTasks.filter(t => t.dueDate && new Date(t.dueDate) < now);

  function formatTaskDue(dueDate: Date | string | null | undefined): string {
    if (!dueDate) return "";
    const d = new Date(dueDate);
    const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `ATRASADA há ${Math.abs(diffDays)}d`;
    if (diffDays === 0) return "vence HOJE";
    if (diffDays === 1) return "vence amanhã";
    return `vence ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
  }

  // ─── HABITS ─────────────────────────────────────────────────────────────────
  function streakMilestone(streak: number): string {
    if (streak >= 30) return " 🏆 30+ dias!";
    if (streak >= 21) return " 🔥 21 dias!";
    if (streak >= 14) return " ⭐ 14 dias!";
    if (streak >= 7) return " ✨ 7 dias!";
    return "";
  }

  // ─── SCHEDULE ───────────────────────────────────────────────────────────────
  const scheduleByDay: Record<string, string[]> = {};
  schedule.forEach(s => {
    const d = new Date(s.startTime);
    const key = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
    if (!scheduleByDay[key]) scheduleByDay[key] = [];
    scheduleByDay[key].push(`${s.title} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`);
  });

  // ─── BILLS ──────────────────────────────────────────────────────────────────
  function billMonthKey(d = now): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  function billPaidMonths(bill: any): string[] {
    try { return JSON.parse(bill.paidMonths || "[]"); } catch { return []; }
  }
  function billActiveThisMonth(bill: any): boolean {
    if (!bill.active) return false;
    const y = now.getFullYear(); const m = now.getMonth();
    if (bill.recurrenceType === "one_time") {
      const c = new Date(bill.createdAt);
      return c.getFullYear() === y && c.getMonth() === m;
    }
    if (bill.recurrenceType === "yearly") {
      return new Date(bill.createdAt).getMonth() === m;
    }
    if (bill.recurrenceEndDate && new Date(bill.recurrenceEndDate) < new Date(y, m, 1)) return false;
    return true;
  }

  const curMonthKey = billMonthKey();
  const activeBills = billsData.filter(billActiveThisMonth);
  const unpaidBills = activeBills.filter(b => b.type === "expense" && !billPaidMonths(b).includes(curMonthKey));
  const paidBills = activeBills.filter(b => b.type === "expense" && billPaidMonths(b).includes(curMonthKey));
  const totalBillsFixed = activeBills.filter(b => b.type === "expense").reduce((s, b) => s + b.amount, 0);
  const totalBillsUnpaid = unpaidBills.reduce((s, b) => s + b.amount, 0);
  const billsDueSoon = unpaidBills.filter(b => {
    const due = new Date(now.getFullYear(), now.getMonth(), b.dueDay);
    const diff = Math.floor((due.getTime() - now.getTime()) / 86400000);
    return diff >= 0 && diff <= 7;
  });
  const billsOverdue = unpaidBills.filter(b => {
    const due = new Date(now.getFullYear(), now.getMonth(), b.dueDay);
    return due < now;
  });

  // ─── MEMORY MAP ─────────────────────────────────────────────────────────────
  const memoryMap: Record<string, string[]> = {
    diagnóstico: [], desafio: [], metas: [], rotina: [],
    financeiro: [], personalidade: [], aprendizados: [], eventos: [], outros: [],
  };
  const keyMap: Record<string, string> = {
    ai_diagnosis: "diagnóstico", desafio_principal: "desafio", metas_extraidas: "metas",
    rotina_usuario: "rotina", renda_atual: "financeiro", renda_mensal_ref: "financeiro",
    gastos_fixos_raw: "financeiro", gastos_fixos_total: "financeiro",
    insight_personalidade: "personalidade", notas: "outros",
  };
  context.forEach(c => {
    const cat = c.key.startsWith("evento_") ? "eventos"
      : (c.key.startsWith("fato_") || c.key.startsWith("plano_") || c.key.startsWith("preferencia_")) ? "aprendizados"
      : keyMap[c.key] || "outros";
    memoryMap[cat].push(`${c.key}: ${c.value}`);
  });

  // ─── ALERTS ─────────────────────────────────────────────────────────────────
  const alerts: string[] = [];
  if (balance < 0) alerts.push(`⚠️ SALDO NEGATIVO: R$${Math.abs(balance).toFixed(2)} no vermelho`);
  else if (spendingPct >= 90 && totalIncome > 0) alerts.push(`⚠️ Gastou ${spendingPct}% da renda este mês — sobrou apenas R$${balance.toFixed(0)}`);
  overdueTasks.forEach(t => alerts.push(`⚠️ Tarefa atrasada: "${t.title}" (${formatTaskDue(t.dueDate)})`));
  billsOverdue.forEach(b => alerts.push(`⚠️ Conta atrasada: "${b.title}" R$${b.amount.toFixed(0)} — deveria ter pago dia ${b.dueDay}`));
  billsDueSoon.forEach(b => {
    const daysLeft = Math.floor((new Date(now.getFullYear(), now.getMonth(), b.dueDay).getTime() - now.getTime()) / 86400000);
    alerts.push(`📅 Conta vence em ${daysLeft}d: "${b.title}" R$${b.amount.toFixed(0)}`);
  });
  const dailyHabitsNotDone = habitsData.filter(h => h.frequency === "daily" && h.lastChecked !== todayStr);
  if (dailyHabitsNotDone.length > 0) {
    alerts.push(`💪 ${dailyHabitsNotDone.length} hábito(s) diário(s) ainda não marcado(s) hoje: ${dailyHabitsNotDone.map(h => (h as any).emoji || h.name.split(" ")[0]).join(", ")}`);
  }

  // ─── BUILD SYSTEM PROMPT ─────────────────────────────────────────────────────
  const userName = userRows[0]?.firstName || (profile as any)?.firstName || "você";

  const systemContext = `Você é o AXIS, o assistente de vida pessoal inteligente e empático de ${userName}. Você tem acesso completo e em tempo real a todos os dados dessa pessoa e a conhece profundamente.

DATA DE HOJE: ${now.toLocaleDateString("pt-BR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
${executedActionContext ? `\n✅ AÇÃO RECÉM-EXECUTADA PELO SISTEMA: ${executedActionContext}\n` : ""}${alerts.length > 0 ? `\n⚡ ALERTAS ATIVOS (${alerts.length}):\n${alerts.map(a => `  ${a}`).join("\n")}\n` : ""}
═══ PERFIL DE ${userName.toUpperCase()} ═══
${profile ? `Idade: ${profile.age || "?"}  |  Profissão: ${profile.profession || "?"}  |  Trabalho: ${profile.workType || "?"}  |  Cidade: ${profile.city || "?"}
Score de disciplina: ${profile.disciplineScore || "?"}/10 — ${
  !profile.disciplineScore ? "sem dados ainda" :
  profile.disciplineScore <= 3 ? "crítico — dias ou semanas sem atividade consistente" :
  profile.disciplineScore <= 5 ? "baixo — pouca consistência, vários dias perdidos" :
  profile.disciplineScore <= 7 ? "regular — progresso intermitente, há espaço para evoluir" :
  profile.disciplineScore <= 9 ? "sólido — hábitos e tarefas sendo mantidos" :
  "elite — consistência máxima, tudo em dia"
}
Maior desafio: ${profile.mainProblem || "não informado"}
Momento atual: ${profile.feelingStatus || "não informado"}
Área de foco: ${profile.focusArea || "não informada"}
Meta de 1 ano: ${profile.oneYearGoal || "não definida"}` : "Perfil não preenchido ainda."}

═══ FINANÇAS — ${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }).toUpperCase()} ═══
Receitas: R$${totalIncome.toFixed(2)}  |  Gastos: R$${totalExpenses.toFixed(2)}  |  Saldo: R$${balance.toFixed(2)}
Comprometimento da renda: ${spendingPct}%  |  Taxa de poupança: ${savingsRate.toFixed(1)}%
Top gastos: ${top3Categories.length ? top3Categories.join(" · ") : "sem gastos registrados"}
${goals.length > 0 ? `\nMETAS:\n${goals.map(g => `  ${g.title}: R$${g.currentAmount}/${g.targetAmount} (${Math.round((g.currentAmount / g.targetAmount) * 100)}%)`).join("\n")}` : ""}
Histórico: ${Object.entries(monthlyHistory).sort().slice(-3).map(([m, v]) => `${m}: +R$${v.income.toFixed(0)}/-R$${v.expenses.toFixed(0)}`).join(" | ") || "sem histórico"}
Últimas transações: ${recentTx.slice(0, 5).map(t => `${t.description} R$${t.amount.toFixed(0)} (${t.type === "expense" ? "↓" : "↑"} ${new Date(t.date).toLocaleDateString("pt-BR")})`).join(" | ") || "nenhuma"}

═══ CONTAS RECORRENTES ═══
${activeBills.length === 0 ? "Nenhuma conta recorrente cadastrada." :
`Total fixo: R$${totalBillsFixed.toFixed(2)}  |  A pagar ainda: R$${totalBillsUnpaid.toFixed(2)}  |  Pagas: ${paidBills.length}/${activeBills.filter(b => b.type === "expense").length}
Pendentes: ${unpaidBills.length === 0 ? "nenhuma" : unpaidBills.map(b => `"${b.title}" R$${b.amount.toFixed(0)} (dia ${b.dueDay})${billsOverdue.includes(b) ? " ⚠️ATRASADA" : billsDueSoon.includes(b) ? " 📅VENCE EM BREVE" : ""}`).join(", ")}
Pagas este mês: ${paidBills.length === 0 ? "nenhuma" : paidBills.map(b => `"${b.title}" ✓`).join(", ")}`}

═══ TAREFAS ═══
Pendentes: ${pendingTasks.length}  |  Concluídas: ${doneTasks}  |  Atrasadas: ${overdueTasks.length}
${pendingTasks.length === 0 ? "Nenhuma tarefa pendente." :
pendingTasks.map(t => {
  const due = formatTaskDue(t.dueDate);
  const late = overdueTasks.includes(t) ? " ⚠️" : "";
  return `  [${t.priority}]${late} "${t.title}"${due ? ` (${due})` : ""}${t.description ? ` — "${t.description}"` : ""}`;
}).join("\n")}

═══ AGENDA — PRÓXIMOS 7 DIAS ═══
${Object.keys(scheduleByDay).length === 0 ? "Nenhum compromisso programado." :
Object.entries(scheduleByDay).map(([day, items]) => `  ${day}: ${items.join(" | ")}`).join("\n")}

═══ HÁBITOS ═══
${habitsData.length === 0 ? "Nenhum hábito cadastrado." :
habitsData.map(h => {
  const emoji = (h as any).emoji || "⚡";
  const done = h.lastChecked === todayStr;
  const freq = h.frequency === "daily" ? "diário" : "semanal";
  const time = (h as any).targetTime ? ` · ${(h as any).targetTime}` : "";
  const status = done ? "✅" : (h.frequency === "daily" ? "❌" : "");
  return `  ${emoji} ${h.name} — ${h.streak} dias (${freq}${time}) ${status}${streakMilestone(h.streak)}`;
}).join("\n")}

═══ MEMÓRIA E CONTEXTO ═══
${memoryMap.diagnóstico.length ? `[Diagnóstico]\n${memoryMap.diagnóstico.map(m => `  ${m.split(": ").slice(1).join(": ")}`).join("\n")}\n` : ""}${memoryMap.desafio.length ? `[Desafio]\n${memoryMap.desafio.map(m => `  ${m.split(": ").slice(1).join(": ")}`).join("\n")}\n` : ""}${memoryMap.metas.length ? `[Metas]\n${memoryMap.metas.map(m => `  ${m.split(": ").slice(1).join(": ")}`).join("\n")}\n` : ""}${memoryMap.financeiro.length ? `[Financeiro]\n${memoryMap.financeiro.map(m => `  ${m}`).join("\n")}\n` : ""}${memoryMap.rotina.length ? `[Rotina]\n${memoryMap.rotina.map(m => `  ${m.split(": ").slice(1).join(": ")}`).join("\n")}\n` : ""}${memoryMap.personalidade.length ? `[Personalidade]\n${memoryMap.personalidade.map(m => `  ${m.split(": ").slice(1).join(": ")}`).join("\n")}\n` : ""}${memoryMap.aprendizados.length ? `[Aprendido em conversa]\n${memoryMap.aprendizados.slice(-8).map(m => `  ${m}`).join("\n")}\n` : ""}${memoryMap.eventos.length ? `[Eventos recentes]\n${memoryMap.eventos.slice(-5).map(m => `  ${m}`).join("\n")}\n` : ""}${memoryMap.outros.length ? `[Notas]\n${memoryMap.outros.map(m => `  ${m}`).join("\n")}` : ""}${!context.length ? "Nenhuma memória salva ainda." : ""}

═══ AGENDAMENTO ASSISTIDO ═══

Quando ${userName} mencionar que quer COMEÇAR uma nova atividade, praticar algo ou criar uma rotina (ex: "preciso praticar inglês", "quero me exercitar", "vou aprender violão", "quero meditar todo dia"), siga este protocolo OBRIGATÓRIO:

PASSO 1 — VERIFICAR A AGENDA: Você já tem os horários ocupados (seção "AGENDA — PRÓXIMOS 7 DIAS" acima). Use-os para sugerir horários livres.

PASSO 2 — PERGUNTAR NATURALMENTE (1 pergunta por vez, de forma conversacional):
  a) Se não souber a frequência: "Quantas vezes por semana você pensou em fazer isso?"
  b) Se não souber o dia: "Quais dias funcionariam melhor pra você?" (sugira dias baseado na agenda)
  c) Se não souber o horário: "Que horas pensou? De manhã, à tarde ou à noite?"
  d) Se não souber a duração: "Quanto tempo por sessão? 30min, 1 hora?"

PASSO 3 — PROPOR: Quando tiver as informações, proponha de forma natural: "Que tal criar no seu calendário todo dia X às Y por Z minutos?"

PASSO 4 — CRIAR: Quando ${userName} confirmar (responder "sim", "pode", "ótimo", "perfeito", etc.), inclua NO FINAL da sua resposta, INVISÍVEL para o usuário, este bloco exato:

[AXIS_ACTION]
{"type":"create_schedule","title":"TITULO_AQUI","days":[0,1,2,3,4,5,6],"time":"HH:MM","durationMinutes":60,"weeks":8}
[/AXIS_ACTION]

Onde:
- "title": nome da atividade (ex: "Inglês", "Corrida", "Meditação")
- "days": array com dias da semana em número (0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sáb)
- "time": horário no formato "HH:MM" (ex: "19:00")
- "durationMinutes": duração em minutos (padrão 60)
- "weeks": quantas semanas criar (padrão 8 = 2 meses)

IMPORTANTE: Inclua o bloco [AXIS_ACTION] SOMENTE após confirmação explícita. Durante as perguntas, NÃO inclua o bloco.

═══ REGRAS DE COMPORTAMENTO (OBRIGATÓRIAS) ═══

VOCÊ É: um amigo próximo e inteligente que já conhece o ${userName} de cor. Não um assistente. Não um robô.

PROIBIDO — violação dessas regras é uma falha grave:
❌ NUNCA use "usuário" — o nome é ${userName}.
❌ NUNCA faça listas numeradas: "1) ... 2) ... 3) ...". Isso parece manual.
❌ NUNCA faça listas com bullet points para respostas casuais.
❌ NUNCA diga "vejo que você tem X anos" ou "de acordo com seu perfil".
❌ NUNCA comece repetindo o que a pessoa disse ("Entendo que você quer...").
❌ NUNCA despeje vários tópicos de uma vez quando a conversa for casual.
❌ NUNCA dê uma lista de opções do que pode fazer — se quiser ajudar, sugira UMA coisa só.

COMO RESPONDER — tamanho por tipo de mensagem:
• Saudação simples ("oi", "olá", "e aí") → 1 frase curta, pergunta aberta. Exemplo: "Oi, ${userName}! No que posso te ajudar hoje?" ou "Oi! Que foi?" — varie, não use sempre a mesma.
• Conversa casual → 1-2 frases. Ponto final. Sem oferecer menu de opções.
• Pergunta sobre dados → responda com os números reais, direto, sem enrolação.
• Pedido de resumo/situação geral → parágrafo corrido, máximo 4 frases, sem listas.
• Ação executada → 1 frase natural de confirmação ("Feito.", "Anotado.", "Pronto!").

SOBRE OS DADOS:
- Use os dados como conhecimento natural, não como relatório lido em voz alta.
- Se houver alerta urgente e for momento natural para mencionar → 1 frase, integrada na conversa.
- Celebre streaks de hábito com 1 frase genuína quando o assunto vier.

IDIOMA E TOM:
- Português brasileiro, informal e direto. Sem bajulação, sem rodeios.${memoryMap.personalidade.length ? `\n- Adapte o tom ao perfil de personalidade registrado acima.` : ""}
- Use o nome "${userName}" com naturalidade — não em toda mensagem, mas quando soar bem.
${profile?.disciplineScore !== undefined && profile.disciplineScore <= 4
  ? `- DISCIPLINA BAIXA (${profile.disciplineScore}/10): seja motivador de forma sutil e genuína quando o assunto vier — sem cobrar, sem sermão. Uma frase que encoraje é suficiente.`
  : profile?.disciplineScore !== undefined && profile.disciplineScore >= 8
  ? `- DISCIPLINA ALTA (${profile.disciplineScore}/10): pode reconhecer o esforço do ${userName} de forma breve e natural quando relevante — sem exagerar.`
  : ""}`.replace(/\n$/, "");

  const messages: any[] = [{ role: "system", content: systemContext }];
  chatHistory.forEach(msg => {
    messages.push({ role: msg.role as "user" | "assistant", content: msg.content });
  });
  messages.push({ role: "user", content: message });

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages,
  });

  return response.choices[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";
}

export async function extractMemoryFromChat(userId: string, userMessage: string, aiResponse: string): Promise<void> {
  const openai = getOpenAIClient();
  try {
    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é um extrator de memória. Analise este trecho de conversa entre um usuário e o AXIS e extraia fatos relevantes e persistentes que o usuário revelou.

EXTRAIA APENAS informações que valem ser lembradas em conversas futuras:
- Mudanças de renda ou situação financeira
- Planos, metas ou projetos mencionados
- Preferências de comunicação ou comportamento
- Decisões importantes tomadas
- Problemas ou conquistas relatadas
- Informações pessoais relevantes (rotina, hábitos, família, trabalho)

NÃO extraia: saudações, perguntas genéricas, conteúdo que já está nos dados de perfil, informações óbvias.

RETORNE JSON:
{
  "facts": [
    { "key": "plano_${monthKey}", "value": "descrição concisa do fato" },
    { "key": "fato_${dateKey}_01", "value": "outro fato relevante" }
  ]
}

Retorne { "facts": [] } se não há nada novo para memorizar.
Use chaves descritivas: fato_YYYY-MM-DD_NN, plano_YYYY-MM, preferencia_topico.
Máximo de 3 fatos por conversa.`
        },
        {
          role: "user",
          content: `Usuário disse: "${userMessage}"\n\nAxis respondeu: "${aiResponse.substring(0, 300)}"`
        }
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return;
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.facts) || parsed.facts.length === 0) return;

    for (const fact of parsed.facts) {
      if (fact.key && fact.value && typeof fact.key === "string" && typeof fact.value === "string") {
        await storage.upsertUserContext(userId, fact.key, fact.value);
      }
    }
  } catch (e) {
    // fire-and-forget — never propagate
  }
}

export async function generateOnboardingDiagnosis(profileData: any): Promise<string> {
  const openai = getOpenAIClient();

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: `Você é o AXIS, um assistente de vida pessoal. Com base no perfil do usuário, gere um diagnóstico inicial com exatamente 3-4 frases cobrindo: (1) identificação do perfil do usuário e seu momento atual, (2) o maior desafio real com base no que foi descrito, (3) o primeiro passo concreto recomendado para essa pessoa especificamente. Seja direto, pessoal e útil — use o nome da pessoa se disponível.

Exemplo de formato: "Você é um profissional autônomo em fase de estruturação, buscando consistência num momento de transição. Sua maior dificuldade está na organização financeira — os gastos variáveis estão absorvendo renda sem deixar rastro. O primeiro passo é criar categorias claras de gastos e registrar tudo por 30 dias: só o que é medido pode ser melhorado."

Não use emojis. Sem listas. Texto corrido, profissional e humano.`
      },
      {
        role: "user",
        content: JSON.stringify(profileData)
      }
    ],
  });

  return response.choices[0]?.message?.content || "Bem-vindo ao AXIS. Vamos organizar sua vida juntos.";
}

export interface DeepAnalysis {
  mainChallengeAnalysis: string;
  goalsBreakdown: string;
  userPersonalityInsight: string;
  financialGoalAmount: number | null;
  financialGoalTitle: string | null;
  keyMemoryNotes: string[];
  suggestedFirstTask: string | null;
  suggestedFirstHabit: string | null;
}

export async function deepAnalyzeOnboarding(profileData: any): Promise<DeepAnalysis> {
  const openai = getOpenAIClient();

  const fallback: DeepAnalysis = {
    mainChallengeAnalysis: "",
    goalsBreakdown: "",
    userPersonalityInsight: "",
    financialGoalAmount: null,
    financialGoalTitle: null,
    keyMemoryNotes: [],
    suggestedFirstTask: null,
    suggestedFirstHabit: null,
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é o AXIS analisando o perfil de um novo usuário. Leia todas as respostas do formulário de onboarding e extraia insights estruturados em JSON.

Retorne EXATAMENTE este JSON (sem campos extras):
{
  "mainChallengeAnalysis": "análise aprofundada (2-3 frases) do maior problema real do usuário com base no que descreveu — vá além do óbvio",
  "goalsBreakdown": "metas específicas extraídas do texto livre, em linguagem clara e direta — inclua valores, prazos e conquistas mencionadas",
  "userPersonalityInsight": "insight sobre o estilo de comunicação ideal para esse usuário: tom, frequência, tipo de motivação que funciona para ele",
  "financialGoalAmount": número inteiro se o usuário mencionou uma meta financeira em reais (ex: 'guardar 15 mil' → 15000, 'ganhar 10k por mês' → 10000), ou null se não mencionou,
  "financialGoalTitle": "título curto e motivador para essa meta (ex: 'Reserva de emergência', 'Meta de renda mensal'), ou null se financialGoalAmount for null",
  "keyMemoryNotes": ["nota 1 curta que AXIS deve lembrar", "nota 2", "nota 3"],
  "suggestedFirstTask": "uma tarefa concreta e acionável baseada no maior problema — específica e realizável em 1 semana, ou null se não aplicável",
  "suggestedFirstHabit": "um hábito diário simples e relevante para as metas do usuário, ou null se não aplicável"
}

Regras:
- Seja específico e pessoal, não genérico
- Use o nome do usuário nas notas se disponível
- keyMemoryNotes deve ter entre 3 e 5 itens
- financialGoalAmount deve ser null se não há menção clara de valor monetário`
        },
        {
          role: "user",
          content: JSON.stringify(profileData)
        }
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content) as DeepAnalysis;
    return {
      mainChallengeAnalysis: parsed.mainChallengeAnalysis || "",
      goalsBreakdown: parsed.goalsBreakdown || "",
      userPersonalityInsight: parsed.userPersonalityInsight || "",
      financialGoalAmount: typeof parsed.financialGoalAmount === "number" && parsed.financialGoalAmount > 0
        ? parsed.financialGoalAmount
        : null,
      financialGoalTitle: parsed.financialGoalTitle || null,
      keyMemoryNotes: Array.isArray(parsed.keyMemoryNotes) ? parsed.keyMemoryNotes : [],
      suggestedFirstTask: parsed.suggestedFirstTask || null,
      suggestedFirstHabit: parsed.suggestedFirstHabit || null,
    };
  } catch (e) {
    console.error("deepAnalyzeOnboarding error:", e);
    return fallback;
  }
}

export async function parseFixedExpenses(text: string): Promise<{ description: string; amount: number; category: string }[]> {
  const openai = getOpenAIClient();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é um extrator de dados financeiros. Leia o texto do usuário e extraia todos os gastos fixos mencionados.

Retorne JSON:
{
  "items": [
    { "description": "nome do gasto", "amount": 1500, "category": "moradia" },
    ...
  ]
}

Categorias válidas: moradia, lazer, saúde, transporte, educação, assinatura, alimentação, outros
Regras:
- amount deve ser número inteiro positivo em reais
- Se o valor não for claro, estime razoavelmente ou omita o item
- Ignore itens sem valor mencionado ou impossíveis de inferir
- Se não houver nenhum item reconhecível, retorne { "items": [] }`
        },
        { role: "user", content: text }
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (e) {
    console.error("parseFixedExpenses error:", e);
    return [];
  }
}

export async function parseRoutineToSchedule(text: string): Promise<{ title: string; dayOfWeek: number[]; startHour: number; startMinute: number; durationMinutes: number }[]> {
  const openai = getOpenAIClient();
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é um extrator de rotina semanal. Leia o texto do usuário e extraia atividades recorrentes.

Retorne JSON:
{
  "items": [
    {
      "title": "Trabalho",
      "dayOfWeek": [1, 2, 3, 4, 5],
      "startHour": 9,
      "startMinute": 0,
      "durationMinutes": 540
    }
  ]
}

Regras:
- dayOfWeek: 0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado
- "seg-sex" = [1,2,3,4,5], "todo dia" = [0,1,2,3,4,5,6], "finais de semana" = [0,6]
- startHour e startMinute no formato 24h
- durationMinutes: duração total em minutos (ex: 9h às 18h = 540 min)
- Se o horário não for mencionado, use 9h como padrão e 60 minutos como duração
- Se não houver atividades reconhecíveis, retorne { "items": [] }`
        },
        { role: "user", content: text }
      ],
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return [];
    const parsed = JSON.parse(content);
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch (e) {
    console.error("parseRoutineToSchedule error:", e);
    return [];
  }
}

export async function saveEventToMemory(userId: string, summary: string): Promise<void> {
  try {
    const now = new Date();
    const key = `evento_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
    await storage.upsertUserContext(userId, key, summary);
  } catch (e) {
    // fire-and-forget — never propagate
  }
}
