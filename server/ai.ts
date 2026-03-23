import OpenAI from "openai";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse: (buffer: Buffer) => Promise<{ text: string }> = require("pdf-parse");
import { storage } from "./storage";
import { db } from "./db";
import { users, creditCards } from "@shared/schema";
import { eq } from "drizzle-orm";

const CURRENCY_SYMBOLS: Record<string, string> = {
  BRL: "R$", USD: "$", EUR: "€", GBP: "£", JPY: "¥",
  CAD: "C$", AUD: "A$", CHF: "Fr", MXN: "MX$", ARS: "$",
  COP: "$", CLP: "$", PEN: "S/", UYU: "$", SGD: "S$",
  INR: "₹", CNY: "¥", ZAR: "R", AED: "AED",
};
function getCurrencySymbol(code: string | null | undefined): string {
  return CURRENCY_SYMBOLS[code ?? "BRL"] ?? "R$";
}

let _openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined;
  if (!_openaiClient) {
    _openaiClient = new OpenAI({ apiKey, baseURL });
  }
  return _openaiClient;
}

// ── CATEGORIA: REGRAS COMPARTILHADAS ────────────────────────────────────────
// Usadas em detectIntentAndProcess, processReceiptPhoto e processPDFExtract
const CATEGORY_RULES = `
CATEGORIAS DISPONÍVEIS E REGRAS DE INFERÊNCIA (seja EXTREMAMENTE preciso):

combustível → postos de gasolina, abastecimento, gasolina, etanol, diesel, GNV.
  Palavras-chave no nome do estabelecimento: "posto", "COMB", "combustível", "petróleo", "shell", "ipiranga", "BR distribuidora", "raízen".
  REGRA: se foi em posto de gasolina ou o nome contém "COMB" → SEMPRE "combustível", NUNCA "transporte".

mercado → supermercados, hipermercados, atacadistas, compras de rancho/mês.
  Estabelecimentos: "supermercado", "mercado", "hipermercado", "atacado", "atacadão", "assaí", "carrefour", "extra", "walmart", "bistek", "zaffari", "nacional", "condor", "grupo pão de açúcar".
  REGRA: analise o CONJUNTO da compra — se a nota tem vários tipos de item (limpeza + alimentos + higiene) → "mercado". Não classifique "mercado" como "alimentação".
  REGRA: se o ticket tem apenas snacks/guloseimas como único conteúdo (energético, chocolate, salgadinho) sem outros itens essenciais → "alimentação" mesmo em supermercado.

alimentação → restaurantes, lanchonetes, fast food, delivery, padaria, café, açaí, bar de comida, iFood, Rappi, UberEats.
  REGRA: diferente de "lazer" — alimentação é para comer/beber cotidiano. Bar com bebida alcoólica como foco → "lazer".

lazer → bar, pub, balada, boate, festa, show, cinema, teatro, streaming (Netflix, Spotify, Disney+, Prime), jogos, parque.
  Estabelecimentos com "bar", "pub", "night", "club", "lounge", "grill" (como social) → lazer.
  REGRA: restaurante sofisticado/rodízio/churrascaria em final de semana pode ser lazer; entregou de comida diária → alimentação.

farmácia → farmácia, drogaria, perfumaria, produtos de higiene pessoal.
  REGRA: se a compra foi em farmácia mas os itens são só snacks/besteiras → "alimentação". Se tem medicamentos, higiene, cosméticos → "farmácia".

saúde → médico, dentista, clínica, hospital, exame, plano de saúde, academia, personal trainer, suplemento, vitamina.

moradia → aluguel, condomínio, água, luz, gás, internet, TV a cabo, telefone residencial, reforma, móveis, decoração.

transporte → Uber, 99, táxi, ônibus, metrô, trem, estacionamento, pedágio, oficina mecânica, manutenção do veículo, IPVA, seguro auto.
  ATENÇÃO: combustível NÃO é "transporte" — use a categoria "combustível".

vestuário → loja de roupas, calçados, acessórios, moda, tênis, bolsa.

educação → curso, escola, faculdade, material escolar, livro, apostila, plataforma de ensino.

trabalho → salário, freelance, renda de serviço prestado, comissão, bônus.

transferência → Pix, TED, DOC, transferência bancária entre pessoas físicas/jurídicas (sem categoria óbvia de uso).

REGRA DE CATEGORIA PERSONALIZADA — MUITO IMPORTANTE:
Se a transação não se encaixar em nenhuma categoria acima, CRIE um nome de categoria descritivo e específico.
NUNCA use "outros" enquanto houver qualquer pista sobre o tipo do gasto.
Exemplos de categorias personalizadas aceitáveis: "pet shop", "eletrônicos", "papelaria", "brinquedos", "construção", "joalheria", "tabacaria", "serviços cartoriais", "taxas bancárias", "seguros", "doações", "impostos", "games", "beleza", "estética", "viagem", "hospedagem", "flores", "presentes", "assinatura".
"outros" é PROIBIDO a menos que a descrição seja completamente ilegível e sem qualquer contexto identificável.

EXEMPLOS CRÍTICOS:
- "RC SFP COM DE COMB LTDA" → combustível (COMB = combustível)
- "Posto Japonês" → combustível
- "Shell" / "Ipiranga" → combustível
- "Assaí Atacadista" → mercado
- "Carrefour" com compra variada → mercado
- "Mercadinho" / "Minimercado" → mercado
- "iFood" / "Rappi" → alimentação
- "McDonald's" / "Subway" → alimentação
- "Farmácia Vantre" → farmácia (se comprou medicamento/higiene)
- "Uber" / "99" → transporte (não confundir com combustível)
- "Netflix" / "Spotify" → lazer
- "ENDUTEX HOTEIS" / "Airbnb" → lazer (ou moradia se for longa estadia)
- "Carole Winebar" → lazer (wine bar = bebida/social)
- "Academia" / "SmartFit" → saúde
- "Cobasi" / "Petz" → pet shop
- "Leroy Merlin" / "Telhanorte" → construção
- "Kalunga" / "Staples" → papelaria
- "Steam" / "PlayStation Store" → games
- "Ri Happy" / "Imaginarium" → brinquedos
- "Seguro Bradesco Auto" → seguros
- "DETRAN" / "IPVA" → impostos
`;

export interface IntentResult {
  intent: "expense" | "income" | "bill" | "task" | "schedule" | "habit" | "chat" | "unknown" | "edit_last" | "savings_deposit";
  data: any;
  rawText: string;
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
  const baseMime = (mimeType || "audio/ogg").split(";")[0].trim().toLowerCase();
  const mimeToExt: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
  };
  const ext = mimeToExt[baseMime] || "ogg";
  const file = new File([audioBuffer], `audio.${ext}`, { type: baseMime });
  const openai = getOpenAIClient();
  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "pt",
  });
  return transcription.text;
}

export async function detectIntentAndProcess(
  text: string,
  userId: string,
  lastTxContext?: { id: string; description: string; amount: number; categoryName: string; establishment: string | null; type: string }
): Promise<IntentResult> {
  const todayDate = new Date().toISOString().split("T")[0];
  const openai = getOpenAIClient();

  const userProfile = await storage.getUserProfile(userId).catch(() => null);
  const detectCur = getCurrencySymbol(userProfile?.currency ?? undefined);

  let userCards: any[] = [];
  let creditCardsContext = "";
  try {
    userCards = await db.select().from(creditCards).where(eq(creditCards.userId, userId));
    if (userCards.length > 0) {
      creditCardsContext = `
CARTÕES DE CRÉDITO DO USUÁRIO:
${userCards.map((c: any) => `- id: "${c.id}", nome: "${c.name}", banco: "${c.bank}", fechamento: dia ${c.closingDay}, vencimento: dia ${c.dueDay}
  (o usuário pode mencionar este cartão como: "${c.name.toLowerCase()}", "${c.bank.toLowerCase()}", ou abreviações/partes desses nomes)`).join("\n")}

REGRAS PARA CARTÃO DE CRÉDITO:
- Combine o que o usuário disse com o NOME ou BANCO de cada cartão acima — não com o id
- O id correto do cartão identificado deve ir em "creditCardId"
- Exemplos de correspondência:
  • usuário diz "mercado pago" → procure cartão com banco "Mercado Pago" → use o id desse cartão
  • usuário diz "cartão mp" → procure cartão com nome "Cartão MP" → use o id desse cartão
  • usuário diz "nubank" → procure cartão com banco ou nome contendo "Nubank"
  • usuário diz "cartão 1" → procure cartão com nome "Cartão 1"
- Se mencionar parcelamento (ex: "3x", "parcelado em 6 vezes", "12 parcelas"), inclua "installments" com o número de parcelas
- Se o usuário mencionar só "cartão" sem especificar qual, e há apenas 1 cartão cadastrado, use esse cartão
- Se não conseguir identificar qual cartão, omita creditCardId
`;
    }
  } catch (cardErr: any) {
    console.error(`[ai] Erro ao buscar cartões para userId=${userId}: ${cardErr?.message}`);
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Você é o AXIS, um assistente de vida pessoal inteligente. Analise o texto do usuário e detecte a intenção.

DATA DE HOJE: ${todayDate}
${lastTxContext ? `
ÚLTIMA TRANSAÇÃO REGISTRADA (pode ser relevante para correções):
- Descrição: ${lastTxContext.description}
- Valor: ${detectCur} ${lastTxContext.amount.toFixed(2)}
- Categoria: ${lastTxContext.categoryName}
- Estabelecimento: ${lastTxContext.establishment || "não informado"}
- Tipo: ${lastTxContext.type === "expense" ? "gasto" : "receita"}
` : ""}
INTENÇÕES POSSÍVEIS:
1. "expense" — O usuário registrou um GASTO ÚNICO/PONTUAL. Palavras: "gastei", "paguei", "comprei", "custou", etc.
2. "income" — O usuário registrou uma RECEITA PONTUAL. Palavras: "recebi", "ganhei", "entrou", "salário", etc.
3. "bill" — O usuário quer cadastrar uma CONTA FIXA/RECORRENTE (gasto ou receita que se repete). Palavras: "gasto fixo", "conta fixa", "mensalidade", "todo mês pago", "pago todo mês", "parcela de X meses", "minha fatura de", "conta de luz todo mês", "tenho um custo fixo de", "renda fixa todo mês", "recebo todo mês", etc.
4. "task" — O usuário quer criar uma TAREFA. Palavras: "preciso", "tenho que", "não esquecer", "lembrar de", etc.
5. "schedule" — O usuário quer AGENDAR algo. Palavras: "marcar", "agendar", "reunião dia", "compromisso", etc.
6. "habit" — O usuário quer criar um HÁBITO. Palavras: "quero começar a", "hábito de", "todo dia", etc.
7. "chat" — Qualquer outra coisa que não se encaixa acima — uma pergunta, reflexão, ou conversa.
8. "edit_last" — O usuário está CORRIGINDO ou AJUSTANDO a última transação registrada. Use SOMENTE quando existir uma "ÚLTIMA TRANSAÇÃO REGISTRADA" no contexto acima E a mensagem for claramente uma correção, não uma nova transação. Indicadores: menciona um valor diferente sem contexto de nova compra ("foi 50", "era 30 reais", "na verdade foi"), corrige o tipo ("era uma notinha de posto", "foi abastecimento"), corrige o estabelecimento/descrição ("era na padaria", "foi no mercado"), usa palavras como "editar", "corrigir", "muda", "altera", "na verdade", "não foi", "era". Mensagens curtas como "foi 50 reais" ou "era combustível" sem contexto de nova compra → "edit_last".
9. "savings_deposit" — O usuário guardou/depositou dinheiro em uma reserva, caixinha ou meta de economia. Palavras: "guardei", "coloquei na caixinha", "joguei na reserva", "depositei na reserva", "botei de lado", "separei", "poupi", "economizei X para", "coloquei na reserva". Exemplos: "guardei 200 na caixinha viagem", "botei 500 na reserva do carro", "coloquei 100 na caixinha emergência". REGRA: se for claramente uma ação de guardar/depositar em reserva própria (não pagar conta/boleto), use "savings_deposit".

RESPONDA EM JSON:

Para expense/income:
{
  "intent": "expense" ou "income",
  "amount": número (valor em reais),
  "description": "descrição curta do gasto/receita",
  "categoryName": "categoria precisa — veja regras abaixo",
  "establishment": "nome do estabelecimento se mencionado, senão null",
  "date": "${todayDate}" (ou data mencionada no formato YYYY-MM-DD),
  "creditCardId": "id do cartão se mencionado, senão omitir",
  "installments": número de parcelas se mencionado (mínimo 1), senão omitir
}

Para bill (conta fixa):
{
  "intent": "bill",
  "title": "nome da conta (ex: Aluguel, Netflix, Conta de Luz)",
  "amount": número (valor em reais),
  "type": "expense" (se é gasto fixo) ou "income" (se é receita fixa),
  "categoryName": "categoria",
  "dueDay": número (dia do mês que vence/recebe, padrão 5 se não mencionado),
  "recurrenceType": "permanent" (para sempre, padrão) ou "three_months" (3 meses) ou "this_month" (só este mês)
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

Para edit_last (inclua APENAS os campos que o usuário quer alterar):
{
  "intent": "edit_last",
  "amount": número (novo valor, se mencionado),
  "description": "nova descrição" (se mencionada),
  "categoryName": "nova categoria" (se mencionada),
  "establishment": "novo estabelecimento" (se mencionado),
  "date": "YYYY-MM-DD" (nova data, se mencionada),
  "type": "expense" ou "income" (se mudou o tipo)
}

Para savings_deposit:
{
  "intent": "savings_deposit",
  "amount": número (valor em reais),
  "goalName": "nome da reserva/caixinha mencionada, ou null se não mencionada"
}

${CATEGORY_RULES}
${creditCardsContext}
REGRAS GERAIS:
- Se o valor não for mencionado explicitamente em um gasto, retorne intent "chat" e pergunte
- Interprete datas relativas: "amanhã", "sexta", "semana que vem", etc.
- "Abasteci o carro" → expense, categoryName: "combustível"
- "Gastei 19 reais com açaí" → expense, categoryName: "alimentação"
- "Fui no mercado" → expense, categoryName: "mercado"
- "Recebi 5000 de salário" → income, categoryName: "trabalho"
- "Tenho gasto fixo de aluguel 1500" → bill, type: "expense", title: "Aluguel", recurrenceType: "permanent"
- "Minha mensalidade da academia é 80 reais" → bill, type: "expense", title: "Academia"
- "Todo mês recebo 200 de aluguel" → bill, type: "income", title: "Aluguel recebido"
- "Preciso ligar pro dentista" → task
- "Reunião com João terça às 14h" → schedule

REGRA CRÍTICA — bill vs expense:
- "bill" SOMENTE quando é claramente RECORRENTE/FIXO (todo mês, mensalidade, fixo, parcela recorrente)
- Pagamento pontual → "expense" mesmo que seja uma conta (ex: "paguei a conta de luz" → expense)
- "bill" SEM VALOR → retorne "chat" e pergunte o valor

REGRA CRÍTICA — habit/schedule SEM DETALHES → retorne "chat":
- "schedule": retorne SOMENTE quando há data/hora ESPECÍFICA (ex: "reunião amanhã às 14h"). Se o horário for vago ou ausente → retorne "chat".
- "habit": retorne SOMENTE para hábitos simples sem horário (ex: "quero beber mais água"). Se a pessoa quer começar uma ATIVIDADE RECORRENTE e o horário/dia não está claro → retorne "chat" para que o assistente possa perguntar.
- EXEMPLOS de "chat": "preciso começar a praticar inglês", "quero me exercitar", "vou começar a meditar", "quero aprender violão" — todos faltam horário/dia específicos.`
      },
      { role: "user", content: text }
    ],
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || '{"intent":"chat","message":""}');

  if (parsed.creditCardId && userCards.length > 0) {
    const exactMatch = userCards.find((c: any) => c.id === parsed.creditCardId);
    if (!exactMatch) {
      const needle = String(parsed.creditCardId).toLowerCase();
      const fuzzy = userCards.find((c: any) =>
        c.name.toLowerCase().includes(needle) ||
        c.bank.toLowerCase().includes(needle) ||
        needle.includes(c.name.toLowerCase()) ||
        needle.includes(c.bank.toLowerCase())
      );
      if (fuzzy) {
        parsed.creditCardId = fuzzy.id;
      } else {
        delete parsed.creditCardId;
      }
    }
  }

  // Fallback: if GPT didn't identify a card, scan the original text for card name/bank mentions
  // Only activate when user explicitly used a card-related keyword to avoid false positives
  if (!parsed.creditCardId && userCards.length > 0 && ["expense", "income"].includes(parsed.intent)) {
    const cardKeywords = ["cartão", "cartao", "crédito", "credito", "fatura", "card"];
    const lowerText = text.toLowerCase();
    const userMentionedCard = cardKeywords.some(k => lowerText.includes(k));
    if (userMentionedCard) {
      const matched = userCards.find((c: any) => {
        const nameLower = c.name.toLowerCase();
        const bankLower = c.bank.toLowerCase();
        // Full name/bank match
        if (lowerText.includes(nameLower) || lowerText.includes(bankLower)) return true;
        // Word-by-word match (each meaningful word ≥4 chars from name or bank)
        const nameWords = nameLower.split(/\s+/).filter((w: string) => w.length >= 4);
        const bankWords = bankLower.split(/\s+/).filter((w: string) => w.length >= 4);
        return [...nameWords, ...bankWords].some((w: string) => lowerText.includes(w));
      });
      if (matched) parsed.creditCardId = matched.id;
      // If user said "cartão" and there's only one card, default to it
      else if (userCards.length === 1) parsed.creditCardId = userCards[0].id;
    }
  }

  return { intent: parsed.intent, data: parsed, rawText: text };
}

function buildReceiptSystemPrompt(todayDate: string, userNameRule: string, multipleMode: boolean): string {
  const receiptSchema = `{
  "imageType": "receipt" | "pix_sent" | "pix_received" | "unknown",
  "transactionType": "expense" (se receipt ou pix_sent) | "income" (se pix_received),
  "senderName": "nome COMPLETO de quem ENVIOU o dinheiro (pagador)",
  "receiverName": "nome COMPLETO de quem RECEBEU o dinheiro (destinatário)",
  "establishment": "nome do estabelecimento (para receipts) ou nome da outra parte na transação Pix",
  "description": "descrição curta e clara do que foi pago/recebido",
  "location": "endereço/cidade se visível, ou null",
  "date": "YYYY-MM-DD (data da transação, não de hoje)",
  "time": "HH:MM (horário da transação no formato 24h — ex: '10h23' → '10:23', ou null se não visível)",
  "items": [{ "description": "item", "amount": número }],
  "totalAmount": número (valor total da transação),
  "categoryName": "categoria precisa — veja regras abaixo",
  "paymentMethod": "Pix" | "cartão" | "dinheiro" | "boleto" | null
}`;

  const singleInstructions = `EXTRAIA o seguinte JSON com os dados do comprovante:
${receiptSchema}`;

  const multipleInstructions = `Esta imagem pode conter UM ou MÚLTIPLOS comprovantes/notas fiscais diferentes.

REGRAS CRÍTICAS:
- Identifique CADA comprovante separado visível na imagem (notas fiscais, comprovantes de Pix, cupons, etc.)
- Cada papel/comprovante diferente = um item separado no array
- Não agrupe comprovantes distintos em um só

RETORNE um JSON com:
{
  "count": <número de comprovantes identificados>,
  "receipts": [
    ${receiptSchema},
    ...
  ]
}`;

  const pixTips = `DICAS PARA IDENTIFICAR PIX (quando não há nome do usuário disponível):
- "Pix enviado", "Você enviou", "Transferência realizada", "Pagamento realizado", "Debitado" → pix_sent
- "Pix recebido", "Você recebeu", "Transferência recebida", "Creditado" → pix_received`;

  return `Você é o AXIS, um assistente financeiro. Analise esta imagem e extraia dados de comprovantes financeiros — pode ser nota fiscal física, cupom fiscal ou comprovante digital (Pix, TED, DOC, transferência bancária, boleto pago).

DATA DE HOJE: ${todayDate}
${userNameRule}

TIPOS DE COMPROVANTE:
- "receipt": nota fiscal, cupom fiscal, ticket de compra
- "pix_sent": comprovante de Pix ENVIADO pelo usuário
- "pix_received": comprovante de Pix RECEBIDO pelo usuário
- "unknown": não é possível identificar

${pixTips}

${multipleMode ? multipleInstructions : singleInstructions}

${CATEGORY_RULES}

REGRAS ADICIONAIS:
- Analise SEMPRE o nome do estabelecimento, localização e TODOS os itens listados antes de escolher a categoria.
- Para Pix: categoryName = "transferência" a menos que o nome do destinatário indique claramente o uso (ex: "iFood" → alimentação, posto → combustível)
- senderName = nome de quem PAGOU, receiverName = nome de quem RECEBEU (sempre, independente do tipo)
- Para receipt: establishment = nome do estabelecimento/loja
- Sempre extraia o horário se estiver visível
- Se não conseguir ler algo, coloque null. Nunca invente dados.
- Se a imagem não for financeira, retorne ${multipleMode ? '{ "count": 0, "receipts": [] }' : "totalAmount: null"}`;
}

export async function processMultipleReceipts(imageBase64: string, userId: string, userName?: string): Promise<{ count: number; receipts: any[] }> {
  const openai = getOpenAIClient();
  const todayDate = new Date().toISOString().split("T")[0];

  const userNameRule = userName
    ? `\nNOME DO USUÁRIO DONO DESTA CONTA: "${userName}"
REGRA CRÍTICA DE DIREÇÃO DO PIX:
- Compare o NOME COMPLETO (nome E sobrenome) do usuário com os campos do comprovante.
- Se o campo "Quem recebeu", "Destinatário", "Para" ou "Recebedor" contiver o nome E o sobrenome do usuário → classifique como "pix_received" (transactionType: "income"), independente do que diz o cabeçalho.
- Se o campo "Quem pagou", "Remetente", "De" ou "Pagador" contiver o nome E o sobrenome do usuário → classifique como "pix_sent" (transactionType: "expense").
- Apenas nome OU apenas sobrenome sozinhos NÃO são suficientes para identificar — exija os dois.
- O cabeçalho "Pix enviado" pode estar na perspectiva de quem ENVIOU o comprovante (não do dono da conta).`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: buildReceiptSystemPrompt(todayDate, userNameRule, true),
      },
      {
        role: "user",
        content: [{ type: "image_url", image_url: { url: imageBase64 } }],
      },
    ],
  });

  const parsed = JSON.parse(response.choices[0]?.message?.content || '{"count":0,"receipts":[]}');
  const receipts: any[] = Array.isArray(parsed.receipts) ? parsed.receipts : [];
  return { count: receipts.length, receipts };
}

export async function processReceiptPhoto(imageBase64: string, userId: string, userName?: string): Promise<any> {
  const result = await processMultipleReceipts(imageBase64, userId, userName);
  return result.receipts[0] ?? {};
}

function chunkStatementText(text: string, maxChunkSize = 8000): string[] {
  if (text.length <= maxChunkSize) return [text];

  const datePattern = /\n(?=\d{2} [A-Z]{3} \d{4})/g;
  const splitPoints: number[] = [0];
  let match: RegExpExecArray | null;
  while ((match = datePattern.exec(text)) !== null) {
    splitPoints.push(match.index);
  }
  splitPoints.push(text.length);

  const chunks: string[] = [];
  let chunkStart = 0;

  for (let i = 1; i < splitPoints.length; i++) {
    const segmentEnd = splitPoints[i];
    if (segmentEnd - chunkStart >= maxChunkSize || i === splitPoints.length - 1) {
      chunks.push(text.slice(chunkStart, segmentEnd).trim());
      chunkStart = segmentEnd;
    }
  }

  if (chunkStart < text.length) {
    const remaining = text.slice(chunkStart).trim();
    if (remaining.length > 0) chunks.push(remaining);
  }

  return chunks.filter(c => c.length > 10);
}

async function extractChunkTransactions(openai: OpenAI, chunk: string): Promise<any[]> {
  const systemPrompt = `Você é o AXIS, assistente financeiro brasileiro. Extraia TODAS as transações financeiras do trecho de extrato bancário abaixo e retorne um JSON com o seguinte formato:

{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "descrição da transação",
      "amount": número positivo,
      "type": "expense" ou "income",
      "categoryName": "categoria — NUNCA use 'outros' se houver pista",
      "establishment": "nome do estabelecimento/empresa ou null",
      "paymentMethod": "pix" | "crédito" | "débito" | "dinheiro" | "boleto" | "transferência" | null
    }
  ]
}

REGRAS:
- Débitos/saídas/compras = "expense"; créditos/entradas/transferências recebidas = "income"
- Inclua TODAS as transações do trecho, sem omitir nenhuma
- NÃO inclua linhas de totais ou saldos (ex: "Total de entradas", "Saldo final")
- Se a data estiver no formato "DD MMM YYYY" (ex: "01 DEZ 2025"), converta para YYYY-MM-DD
- Nunca invente dados; se não houver transações no trecho, retorne {"transactions": []}

${CATEGORY_RULES}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: chunk }
      ],
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content || '{"transactions":[]}');
    return Array.isArray(parsed.transactions) ? parsed.transactions : [];
  } catch {
    return [];
  }
}

export async function processPDFExtract(pdfInput: Buffer | string, userId: string): Promise<any> {
  const openai = getOpenAIClient();

  let pdfText: string;
  if (Buffer.isBuffer(pdfInput)) {
    try {
      const parsed = await pdfParse(pdfInput);
      pdfText = parsed.text?.trim() || "";
    } catch {
      pdfText = pdfInput.toString("latin1");
    }
  } else {
    pdfText = pdfInput;
  }

  if (!pdfText || pdfText.length < 20) {
    return { docType: "statement", transactions: [] };
  }

  const previewText = pdfText.slice(0, 2000);
  const classifyResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    max_tokens: 1024,
    messages: [
      {
        role: "system",
        content: `Analise o início do documento e classifique o tipo. Retorne JSON:

Se for extrato bancário com múltiplas transações:
{"docType":"statement","bankName":"nome do banco ou null","period":"período ou null"}

Se for conta/boleto/NFS-e/nota fiscal (documento de cobrança único):
{"docType":"bill","title":"nome","description":"desc","amount":0,"type":"expense","dueDate":"YYYY-MM-DD","dueDay":1,"categoryName":"cat","issuer":"emissor","issuerCnpj":"cnpj ou null","recipient":"dest","recipientCnpj":"cnpj ou null","paymentInfo":"dados pagamento"}

REGRAS:
- NFS-e, boleto, fatura de serviço único → "bill"
- Extrato com lista de movimentações → "statement"
- Nunca invente dados`
      },
      { role: "user", content: previewText }
    ],
  });

  const classified = JSON.parse(classifyResponse.choices[0]?.message?.content || '{"docType":"statement"}');
  if (!classified.docType) classified.docType = "statement";

  if (classified.docType === "bill") {
    return classified;
  }

  const chunks = chunkStatementText(pdfText, 8000);

  const chunkResults = await Promise.all(chunks.map(chunk => extractChunkTransactions(openai, chunk)));

  const seen = new Set<string>();
  const allTransactions: any[] = [];
  for (const txns of chunkResults) {
    for (const t of txns) {
      const key = `${t.date}|${t.amount}|${(t.description || "").slice(0, 30).toLowerCase()}|${t.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        allTransactions.push(t);
      }
    }
  }

  return {
    docType: "statement",
    bankName: classified.bankName || null,
    period: classified.period || null,
    transactions: allTransactions,
  };
}

export async function chatWithContext(message: string, userId: string, executedActionContext?: string): Promise<string> {
  const openai = getOpenAIClient();

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const sevenDaysAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [profile, context, allTransactions, allTimeTx, tasks, habitsData, schedule, goals, billsData, userRows, userCards] = await Promise.all([
    storage.getUserProfile(userId),
    storage.getUserContext(userId),
    storage.getTransactions(userId, { startDate: threeMonthsAgo }),
    storage.getTransactions(userId, { endDate: new Date() }),
    storage.getPersonalTasks(userId),
    storage.getHabits(userId),
    storage.getScheduleItems(userId, { startDate: new Date(), endDate: sevenDaysAhead }),
    storage.getFinancialGoals(userId),
    storage.getBills(userId),
    db.select({ firstName: users.firstName }).from(users).where(eq(users.id, userId)),
    storage.getCreditCards(userId),
  ]);

  const chatHistory = await storage.getChatMessages(userId, 20);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ─── FINANCIALS ─────────────────────────────────────────────────────────────
  const currentMonthTx = allTransactions.filter(t => new Date(t.date) >= curMonthStart);
  // Exclude credit card transactions from expenses — same logic as the dashboard
  const totalExpenses = currentMonthTx.filter(t => t.type === "expense" && !t.creditCardId).reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = currentMonthTx.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  // Real bank balance: initialBalance + all-time income - all-time non-credit expenses (mirrors dashboard)
  const allTimeIncome = allTimeTx.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const allTimeExpenses = allTimeTx.filter(t => t.type === "expense" && !t.creditCardId).reduce((sum, t) => sum + t.amount, 0);
  const balance = (profile?.initialBalance ?? 0) + allTimeIncome - allTimeExpenses;
  const cur = getCurrencySymbol(profile?.currency ?? undefined);
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;
  const spendingPct = totalIncome > 0 ? Math.round((totalExpenses / totalIncome) * 100) : 0;

  const expensesByCategory: Record<string, number> = {};
  currentMonthTx.filter(t => t.type === "expense" && !t.creditCardId).forEach(t => {
    const cat = t.categoryName || "outros";
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount;
  });
  const top3Categories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, val]) => `${cat}: ${cur}${val.toFixed(0)}`);

  const monthlyHistory: Record<string, { income: number; expenses: number }> = {};
  allTransactions.forEach(t => {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyHistory[key]) monthlyHistory[key] = { income: 0, expenses: 0 };
    if (t.type === "income") monthlyHistory[key].income += t.amount;
    else if (!t.creditCardId) monthlyHistory[key].expenses += t.amount;
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
      : c.key.startsWith("rotina_") ? "rotina"
      : keyMap[c.key] || "outros";
    memoryMap[cat].push(`${c.key}: ${c.value}`);
  });

  // ─── ALERTS ─────────────────────────────────────────────────────────────────
  const alerts: string[] = [];
  if (balance < 0) alerts.push(`⚠️ SALDO NEGATIVO: ${cur}${Math.abs(balance).toFixed(2)} no vermelho`);
  else if (spendingPct >= 90 && totalIncome > 0) alerts.push(`⚠️ Gastou ${spendingPct}% da renda este mês — sobrou apenas ${cur}${balance.toFixed(0)}`);
  overdueTasks.forEach(t => alerts.push(`⚠️ Tarefa atrasada: "${t.title}" (${formatTaskDue(t.dueDate)})`));
  billsOverdue.forEach(b => alerts.push(`⚠️ Conta atrasada: "${b.title}" ${cur}${b.amount.toFixed(0)} — deveria ter pago dia ${b.dueDay}`));
  billsDueSoon.forEach(b => {
    const daysLeft = Math.floor((new Date(now.getFullYear(), now.getMonth(), b.dueDay).getTime() - now.getTime()) / 86400000);
    alerts.push(`📅 Conta vence em ${daysLeft}d: "${b.title}" ${cur}${b.amount.toFixed(0)}`);
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
Receitas: ${cur}${totalIncome.toFixed(2)}  |  Gastos: ${cur}${totalExpenses.toFixed(2)}  |  Saldo: ${cur}${balance.toFixed(2)}
Comprometimento da renda: ${spendingPct}%  |  Taxa de poupança: ${savingsRate.toFixed(1)}%
Top gastos: ${top3Categories.length ? top3Categories.join(" · ") : "sem gastos registrados"}
${goals.length > 0 ? `\nMETAS:\n${goals.map(g => `  ${g.title}: ${cur}${g.currentAmount}/${g.targetAmount} (${Math.round((g.currentAmount / g.targetAmount) * 100)}%)`).join("\n")}` : ""}
Histórico: ${Object.entries(monthlyHistory).sort().slice(-3).map(([m, v]) => `${m}: +${cur}${v.income.toFixed(0)}/-${cur}${v.expenses.toFixed(0)}`).join(" | ") || "sem histórico"}
Últimas transações: ${recentTx.slice(0, 5).map(t => `${t.description} ${cur}${t.amount.toFixed(0)} (${t.type === "expense" ? "↓" : "↑"} ${new Date(t.date).toLocaleDateString("pt-BR")})`).join(" | ") || "nenhuma"}

═══ CONTAS RECORRENTES ═══
${activeBills.length === 0 ? "Nenhuma conta recorrente cadastrada." :
`Total fixo: ${cur}${totalBillsFixed.toFixed(2)}  |  A pagar ainda: ${cur}${totalBillsUnpaid.toFixed(2)}  |  Pagas: ${paidBills.length}/${activeBills.filter(b => b.type === "expense").length}
Pendentes: ${unpaidBills.length === 0 ? "nenhuma" : unpaidBills.map(b => `"${b.title}" ${cur}${b.amount.toFixed(0)} (dia ${b.dueDay})${billsOverdue.includes(b) ? " ⚠️ATRASADA" : billsDueSoon.includes(b) ? " 📅VENCE EM BREVE" : ""}`).join(", ")}
Pagas este mês: ${paidBills.length === 0 ? "nenhuma" : paidBills.map(b => `"${b.title}" ✓`).join(", ")}`}

═══ CARTÕES DE CRÉDITO ═══
${userCards.length === 0 ? "Nenhum cartão cadastrado." :
userCards.map(c => {
  const used = allTransactions.filter(t => t.creditCardId === c.id && new Date(t.date) >= curMonthStart).reduce((s, t) => s + t.amount, 0);
  const avail = c.limit - used;
  const pct = Math.round((used / Math.max(c.limit, 1)) * 100);
  return `  ${c.name} (${c.bank}): limite ${cur}${c.limit.toFixed(0)}, usado ${cur}${used.toFixed(0)} (${pct}%), disponível ${cur}${avail.toFixed(0)} — fecha dia ${c.closingDay}, vence dia ${c.dueDay} — id: ${c.id}`;
}).join("\n")}

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

PASSO 0 — MAPEAR TODOS OS HORÁRIOS BLOQUEADOS (OBRIGATÓRIO, FAÇA MENTALMENTE ANTES DE QUALQUER SUGESTÃO):
Antes de sugerir qualquer horário, você DEVE identificar e bloquear todos os períodos ocupados com base em:
  1. A seção "AGENDA — PRÓXIMOS 7 DIAS" acima (compromissos já cadastrados)
  2. A seção "MEMÓRIA E CONTEXTO" acima (rotina salva de conversas anteriores)
  3. O que ${userName} acabou de dizer na mensagem ATUAL — leia com atenção cada intervalo e atividade mencionados

REGRAS DE INTERPRETAÇÃO DE HORÁRIOS (CRÍTICAS — violação é erro grave):
  ▸ "trabalho das X às Y" → cada minuto entre X e Y está BLOQUEADO em todos os dias de trabalho mencionados. "das 8:00 às 18:00" = tarde OCUPADA, não livre.
  ▸ "trabalho seg a sex das 8:00 às 18:00" → segunda a sexta, das 8h às 18h, tudo bloqueado. Horário livre: apenas após 18h nesses dias.
  ▸ "tenho futebol na quarta e sexta" → quarta e sexta têm futebol. NUNCA sugerir outra atividade nesses dias/horários. NUNCA propor mover o futebol para outro dia.
  ▸ Qualquer atividade que ${userName} mencionar como já existente em dias/horários específicos é um COMPROMISSO FIXO E IMÓVEL. Organize a rotina EM TORNO desses compromissos — jamais tente alterá-los.
  ▸ "horário livre" significa SOMENTE os blocos que NÃO estão cobertos por nenhum dos itens acima.

EXPRESSÕES DE DIAS — TABELA DE REFERÊNCIA (use SEMPRE que o usuário mencionar dias):
  "todo dia" / "todos os dias" / "diariamente" / "cada dia"         → [0,1,2,3,4,5,6]
  "dias úteis" / "dias de semana" / "durante a semana"              → [1,2,3,4,5]
  "seg a sex" / "segunda a sexta" / "de segunda a sexta"            → [1,2,3,4,5]
  "seg a qui" / "segunda a quinta" / "de segunda a quinta"          → [1,2,3,4]
  "seg a sáb" / "segunda a sábado" / "de segunda a sábado"          → [1,2,3,4,5,6]
  "fim de semana" / "final de semana" / "sáb e dom" / "sábado e domingo" → [0,6]
  "seg e qua" / "segunda e quarta"                                  → [1,3]
  "ter e qui" / "terça e quinta"                                    → [2,4]
  "seg, qua e sex" / "segunda, quarta e sexta"                      → [1,3,5]
  Dias individuais: dom=0, seg=1, ter=2, qua=3, qui=4, sex=5, sáb=6
  ⚠ Nunca interprete "seg a sex" como apenas [1,5] (segunda E sexta) — é um INTERVALO completo [1,2,3,4,5].

EXEMPLOS DE ERROS PROIBIDOS:
  ❌ Dizer "você tem as tardes livres" quando o trabalho vai até 18h — as tardes estão OCUPADAS.
  ❌ Sugerir academia na quarta ou sexta à noite quando o usuário já tem futebol nesses dias.
  ❌ Propor mover o futebol para sábado quando o usuário disse que joga às quartas e sextas.
  ❌ Chamar de "livre" qualquer período dentro do horário de trabalho.
  ❌ Interpretar "seg a sex" como [1,5] em vez de [1,2,3,4,5].

PASSO 1 — VERIFICAR A AGENDA: Combine os horários da seção "AGENDA — PRÓXIMOS 7 DIAS" com o mapa de bloqueios que você construiu no Passo 0. Somente o que sobrar é efetivamente livre.

INTELIGÊNCIA DE FREQUÊNCIA POR TIPO DE ATIVIDADE:
Antes de perguntar "quantas vezes por semana?", identifique o tipo de atividade e use esse conhecimento para dar uma sugestão realista, não uma pergunta genérica. Categorias e ancora típica:

  📚 Estudo EAD / cursinho / aula online / faculdade à distância / revisão de conteúdo
     → Frequência típica: diária ou quase diária (5-7x/semana). Abordagem: "Para EAD funcionar de verdade, estudo diário costuma fazer diferença — você pensou em quantos dias por semana?"

  💪 Academia / musculação / crossfit / funcional / pilates
     → Frequência típica: 3-5x/semana. Abordagem: "Academia costuma funcionar bem 3 a 5 dias por semana — você tem algum número em mente?"

  🏃 Corrida / caminhada / ciclismo / natação / esporte aeróbico
     → Frequência típica: 3-5x/semana. Abordagem: "Corrida/caminhada costuma funcionar bem 3 a 5 vezes por semana — o que você pensou?"

  🧘 Meditação / yoga / alongamento / respiração / mindfulness
     → Frequência típica: diária (7x/semana). Abordagem: "Meditação funciona melhor quando é diária — você toparia criar todo dia?"

  🎵 Violão / guitarra / piano / instrumento musical / prática musical
     → Frequência típica: diária ou quase diária (5-7x/semana). Abordagem: "Instrumento musical precisa de prática diária pra fixar — você consegue fazer todo dia ou prefere 5 dias?"

  🗣 Inglês / espanhol / idioma / língua estrangeira / curso de idiomas
     → Frequência típica: 3-5x/semana. Abordagem: "Idioma costuma evoluir bem com 3 a 5 sessões por semana — quantas você consegue encaixar?"

  📖 Leitura / journaling / diário / escrita criativa
     → Frequência típica: diária (7x/semana). Abordagem: "Leitura diária é o que mais funciona — você topa criar todo dia, mesmo que seja pouco tempo?"

  🎯 Para qualquer outra atividade não listada acima: pergunte normalmente — "Quantas vezes por semana você pensou em fazer isso?"

PASSO 2 — PERGUNTAR NATURALMENTE (1 pergunta por vez, de forma conversacional):
  a) Se não souber a frequência: use a âncora de frequência da INTELIGÊNCIA DE FREQUÊNCIA acima, se aplicável. Senão: "Quantas vezes por semana você pensou em fazer isso?"
  b) Se não souber o dia: "Quais dias funcionariam melhor pra você?" (sugira apenas dias onde há espaço real, sem conflitos; use a TABELA DE REFERÊNCIA para interpretar a resposta)
  c) Se não souber o horário: "Que horas pensou?" (sugira horários dentro das janelas realmente livres — nunca dentro do horário de trabalho ou de outras atividades fixas)
  d) Se não souber a duração: "Quanto tempo por sessão? 30min, 1 hora?"

PASSO 3 — PROPOR: Quando tiver as informações e depois de validar que o horário sugerido não conflita com nenhum bloqueio do Passo 0, proponha de forma natural: "Que tal criar no seu calendário todo dia X às Y por Z minutos?"

PASSO 4 — CRIAR: Quando ${userName} confirmar (responder "sim", "pode", "ótimo", "perfeito", etc.), inclua NO FINAL da sua resposta, INVISÍVEL para o usuário, este bloco exato:

[AXIS_ACTION]
{"type":"create_schedule","title":"TITULO_REAL","days":[DIAS_REAIS],"time":"HH:MM","durationMinutes":MINUTOS_REAIS,"weeks":8}
[/AXIS_ACTION]

Onde:
- "title": nome real da atividade combinada (ex: "Inglês", "Corrida", "Meditação")
- "days": array SOMENTE com os dias REAIS combinados com ${userName} em número (0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sáb). Exemplos: segunda+quarta → [1,3], só sexta → [5], seg a sex → [1,2,3,4,5]
- "time": horário REAL no formato "HH:MM" (ex: "19:00")
- "durationMinutes": duração REAL em minutos combinada com ${userName}
- "weeks": quantas semanas criar (padrão 8 = 2 meses)

ERROS PROIBIDOS no bloco [AXIS_ACTION]:
  ❌ NUNCA use os valores do template como padrão — substitua TODOS os placeholders pelos valores reais combinados com ${userName}.
  ❌ NUNCA emita dias=[0,1,2,3,4,5,6] (todos os dias) a menos que ${userName} tenha confirmado explicitamente que quer a atividade todos os dias da semana.
  ❌ NUNCA inclua o bloco [AXIS_ACTION] se ${userName} não tiver confirmado explicitamente nesta mesma conversa.

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
    model: "gpt-4o-mini",
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

PRIORIDADE MÁXIMA — extraia sempre que aparecer:
- Horário de trabalho: ex. "trabalho seg a sex das 8:00 às 18:00, sáb das 8:00 às 12:00" → grave como rotina com dias e horários exatos
- Atividades fixas com dias específicos: ex. "tenho futebol às quartas e sextas", "faço academia toda terça e quinta" → grave como compromisso fixo, incluindo os dias da semana
- Qualquer combinação de dia + horário + atividade recorrente mencionada como já existente

NÃO extraia: saudações, perguntas genéricas, conteúdo que já está nos dados de perfil, informações óbvias.

RETORNE JSON:
{
  "facts": [
    { "key": "rotina_trabalho", "value": "trabalha seg-sex 8h-18h, sáb 8h-12h" },
    { "key": "rotina_futebol", "value": "futebol fixo toda quarta e sexta à noite" },
    { "key": "plano_${monthKey}", "value": "descrição concisa do fato" },
    { "key": "fato_${dateKey}_01", "value": "outro fato relevante" }
  ]
}

Retorne { "facts": [] } se não há nada novo para memorizar.
Use chaves descritivas: rotina_trabalho, rotina_ATIVIDADE, fato_YYYY-MM-DD_NN, plano_YYYY-MM, preferencia_topico.
Máximo de 5 fatos por conversa (aumente para 5 quando houver informações de rotina/horário importantes).`
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
    model: "gpt-4o-mini",
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

// ── IDENTITY: reconhecimento de CNPJ/CPF do usuário ─────────────────────────
function normalizeCnpj(raw: string): string {
  return (raw || "").replace(/[^0-9]/g, "");
}

export interface IdentityEntity {
  name: string;
  cnpj: string;
}

export async function getUserIdentityEntities(userId: string): Promise<IdentityEntity[]> {
  const ctx = await storage.getUserContext(userId);
  const entry = ctx.find(c => c.key === "identity_entities");
  if (!entry) return [];
  try { return JSON.parse(entry.value); } catch { return []; }
}

export async function saveUserIdentityEntity(userId: string, name: string, cnpj: string): Promise<void> {
  const entities = await getUserIdentityEntities(userId);
  const norm = normalizeCnpj(cnpj);
  if (entities.some(e => normalizeCnpj(e.cnpj) === norm)) return;
  entities.push({ name, cnpj });
  await storage.upsertUserContext(userId, "identity_entities", JSON.stringify(entities));
}

export async function matchBillIdentity(userId: string, extracted: any): Promise<{ type: "income" | "expense"; matchedAs: "issuer" | "recipient" } | null> {
  const entities = await getUserIdentityEntities(userId);
  if (entities.length === 0) return null;
  const issuerNorm = normalizeCnpj(extracted.issuerCnpj);
  const recipientNorm = normalizeCnpj(extracted.recipientCnpj);
  for (const ent of entities) {
    const entNorm = normalizeCnpj(ent.cnpj);
    if (!entNorm) continue;
    if (issuerNorm && issuerNorm === entNorm) return { type: "income", matchedAs: "issuer" };
    if (recipientNorm && recipientNorm === entNorm) return { type: "expense", matchedAs: "recipient" };
  }
  return null;
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

export interface SpendingAnalysisResult {
  penalty: number;
  verdict: string;
  badCategories: string[];
  badPercentage: number;
  message: string;
}

// Categorias essenciais — nunca penalizadas independente do valor
const ESSENTIAL_CATEGORIES = new Set([
  "mercado", "combustível", "moradia", "saúde", "farmácia", "educação", "trabalho", "transferência",
]);

export async function analyzeSpendingDiscipline(
  transactions: { title: string; amount: number; category?: string | null; type: string }[],
  monthlyIncome: number,
  cardContext?: { name: string; limit: number; used: number; utilizationPct: number; topCategories: string }[],
  bankBalance?: number,
  currencySymbol: string = "R$"
): Promise<SpendingAnalysisResult> {
  const cs = currencySymbol;
  const openai = getOpenAIClient();
  const expenses = transactions.filter(t => t.type === "expense");
  const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);

  if (expenses.length === 0 || monthlyIncome <= 0) {
    return { penalty: 0, verdict: "neutro", badCategories: [], badPercentage: 0, message: "Sem dados suficientes para análise." };
  }

  // Agrupar por categoria com contagem, total e lista de itens
  const byCategory: Record<string, { count: number; total: number; items: string[] }> = {};
  for (const t of expenses) {
    const cat = (t.category || "outros").toLowerCase().trim();
    if (!byCategory[cat]) byCategory[cat] = { count: 0, total: 0, items: [] };
    byCategory[cat].count++;
    byCategory[cat].total += t.amount;
    byCategory[cat].items.push(t.title);
  }

  const savingsPct = totalExpenses < monthlyIncome
    ? Math.round(((monthlyIncome - totalExpenses) / monthlyIncome) * 100)
    : 0;
  const spendingPct = Math.round((totalExpenses / monthlyIncome) * 100);

  // Montar bloco estruturado por categoria para o prompt
  const categorySummary = Object.entries(byCategory)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([cat, data]) => {
      const pct = ((data.total / monthlyIncome) * 100).toFixed(1);
      const isEssential = ESSENTIAL_CATEGORIES.has(cat);
      const preview = data.items.slice(0, 4).join(", ") + (data.items.length > 4 ? ` ... (+${data.items.length - 4} itens)` : "");
      return `  • ${cat}${isEssential ? " [ESSENCIAL]" : ""}: ${data.count}x | ${cs} ${data.total.toFixed(2)} | ${pct}% renda | ex: ${preview}`;
    })
    .join("\n");

  const cardSection = (cardContext && cardContext.length > 0)
    ? `\n══ CARTÕES DE CRÉDITO ══\n${cardContext.map(c => {
        const risk = c.utilizationPct >= 90 ? "🔴 CRÍTICO" : c.utilizationPct >= 70 ? "🟠 ALTO" : c.utilizationPct >= 50 ? "🟡 MÉDIO" : "🟢 OK";
        return `  • ${c.name}: ${cs}${c.used.toFixed(2)} / ${cs}${c.limit.toFixed(2)} (${c.utilizationPct.toFixed(0)}% do limite) — ${risk}\n    Categorias no cartão: ${c.topCategories}`;
      }).join("\n")}`
    : "";

  const balanceSection = (bankBalance !== undefined && monthlyIncome > 0)
    ? `\nSaldo bancário atual: ${cs} ${bankBalance.toFixed(2)} (${((bankBalance / monthlyIncome) * 100).toFixed(0)}% da renda mensal)${bankBalance < 0 ? " — ⚠️ SALDO NEGATIVO" : bankBalance < monthlyIncome * 0.3 ? " — saldo muito baixo" : ""}`
    : "";

  const prompt = `Você é um coach de disciplina financeira. Avalie com EXTREMA PRECISÃO os gastos do usuário dos últimos 30 dias e determine o impacto real na disciplina.

══ CONTEXTO FINANCEIRO ══
Renda mensal: ${cs} ${monthlyIncome.toFixed(2)}
Total gasto: ${cs} ${totalExpenses.toFixed(2)} (${spendingPct}% da renda)
Taxa de poupança: ${savingsPct}% da renda${totalExpenses > monthlyIncome ? "\n⚠️ ATENÇÃO: gastou MAIS do que ganha este mês" : ""}${balanceSection}${cardSection}

══ GASTOS POR CATEGORIA ══
${categorySummary}

══ REGRAS DE ANÁLISE ══

CATEGORIAS ESSENCIAIS (marcadas [ESSENCIAL]) — NUNCA penalize, não importa o valor. São gastos necessários à vida.

CATEGORIAS DISCRICIONÁRIAS — avalie padrão e frequência:

alimentação:
- Delivery (iFood/Rappi/UberEats): >8 pedidos no mês OU >20% da renda = problemático. 1-3 pedidos = normal.
- Restaurante/lanchonete frequente: avaliar proporção. Comer fora todo dia = excessivo.
- Padaria/café esporádico = normal.

lazer:
- Bar/balada/festa frequente OU >15% da renda = leve/moderado.
- Streaming básico (1-2 serviços) = normal.
- Múltiplos streamings + lazer físico constante = preocupante.

vestuário:
- 1-2 compras/mês = normal. Compras repetitivas por impulso OU >15% da renda = problemático.

outros/sem categoria:
- Avaliar pelo padrão (frequência e valores).

MONITORAMENTO DE CARTÃO DE CRÉDITO:
- Cartão ≥ 80% de utilização = comportamento preocupante; ≥ 90% = crítico
- Cartão acima de 70% + categorias de lazer/vestuário predominantes no cartão = penalize mais
- Múltiplos cartões acima de 70% simultaneamente = padrão grave de dependência de crédito
- SALDO BANCÁRIO CRUZADO com cartão:
  • Cartão alto (≥70%) + saldo bancário OK (≥80% da renda) = apenas leve advertência
  • Cartão alto (≥70%) + saldo baixo (<50% da renda) = moderado — risco real
  • Cartão alto (≥80%) + saldo baixo (<30% da renda) = grave — descontrole financeiro
  • Saldo negativo + qualquer uso de cartão = sempre grave
- Se não há dados de cartão, ignore esta seção

ANÁLISE DE PADRÃO:
- Não penalize por UMA compra isolada de qualquer categoria discricionária.
- Penalize pelo PADRÃO: muitas compras repetidas, frequência excessiva, valor desproporcional à renda.
- Se os gastos discricionários são baixos mas a poupança é alta → "ótimo" ou "bom".
- Se gastou mais do que ganha → sempre pelo menos "leve", provavelmente "moderado" ou "grave".

══ VEREDITO (baseado nos gastos discricionários problemáticos como % da renda) ══
- "ótimo": padrão exemplar — gastos discricionários < 5% renda OU poupou >30%
- "bom": controle razoável — gastos problemáticos 5-12% renda
- "neutro": aceitável mas pode melhorar — 12-20% em supérfluos
- "leve": excesso leve — 20-30% em supérfluos OU padrão de impulso pontual
- "moderado": padrão preocupante — 30-40% em supérfluos OU gastou quase toda a renda
- "grave": descontrolado — >40% em supérfluos OU gastou mais do que ganha

Retorne APENAS este JSON (sem markdown):
{
  "badCategories": ["lista das categorias/padrões problemáticos — seja específico, ex: 'delivery excessivo (12x)', 'lazer alto (R$680)'. Vazio se não houver problema real"],
  "badAmount": <soma em R$ gasto nas categorias/itens problemáticos, como número>,
  "verdict": "ótimo" | "bom" | "neutro" | "leve" | "moderado" | "grave",
  "message": "<frase direta em pt-BR sobre o padrão real observado, máx 90 chars>"
}`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 400,
    });
    const raw = resp.choices[0].message.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    const badAmount = parsed.badAmount ?? 0;
    const badPct = monthlyIncome > 0 ? (badAmount / monthlyIncome) * 100 : 0;
    const verdict = parsed.verdict ?? "neutro";

    let penalty = 0;
    if (verdict === "ótimo")       penalty = +4;
    else if (verdict === "bom")    penalty = +2;
    else if (verdict === "neutro") penalty = 0;
    else if (verdict === "leve")   penalty = -2;
    else if (verdict === "moderado") penalty = -4;
    else if (verdict === "grave")    penalty = -6;

    return {
      penalty,
      verdict,
      badCategories: parsed.badCategories ?? [],
      badPercentage: Math.round(badPct),
      message: parsed.message ?? "",
    };
  } catch {
    return { penalty: 0, verdict: "neutro", badCategories: [], badPercentage: 0, message: "" };
  }
}

export interface JustificationResult {
  score: number;
  creditPoints: number;
  verdict: string;
  feedback: string;
}

export async function judgeJustification(
  taskTitle: string,
  daysLate: number,
  justification: string
): Promise<JustificationResult> {
  const openai = getOpenAIClient();

  const prompt = `Você é um coach rigoroso e justo de produtividade pessoal. Julgue a justificativa dada pelo usuário pelo atraso em uma tarefa.

Tarefa: "${taskTitle}"
Dias de atraso: ${daysLate}
Justificativa do usuário: "${justification}"

Retorne um JSON com:
{
  "score": <1 a 5, sendo 1=péssima/preguiça, 3=aceitável, 5=excelente/força maior>,
  "verdict": "péssima" | "fraca" | "aceitável" | "boa" | "excelente",
  "feedback": "<frase curta e direta em pt-BR com o julgamento, máx 80 chars>"
}

Critérios:
- Score 5: doença grave, emergência familiar, desastre natural, hospitalização
- Score 4: problema de saúde leve mas real, problema técnico sério
- Score 3: sobrecarga de trabalho comprovável, esquecimento com boa fé
- Score 2: procrastinação com desculpa fraca, "falta de tempo" sem justificativa
- Score 1: sem justificativa real, preguiça evidente, "não tive vontade"

Retorne APENAS o JSON, sem markdown.`;

  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 200,
    });
    const raw = resp.choices[0].message.content?.trim() ?? "{}";
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());

    const score = Math.min(5, Math.max(1, parsed.score ?? 1));
    let creditPoints = 0;
    if (score >= 5) creditPoints = 3;
    else if (score >= 4) creditPoints = 2;
    else if (score >= 3) creditPoints = 1;

    return {
      score,
      creditPoints,
      verdict: parsed.verdict ?? "fraca",
      feedback: parsed.feedback ?? "",
    };
  } catch {
    return { score: 1, creditPoints: 0, verdict: "fraca", feedback: "Não foi possível avaliar." };
  }
}
