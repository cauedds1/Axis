export type Lang = "pt" | "en";

type MsgFn = (v?: Record<string, any>) => string;
type Messages = Record<string, MsgFn>;

const pt: Messages = {
  // ── Link / vincular ─────────────────────────────────────────────────────────
  linkNotFound: (v) => `❌ Número não encontrado. Certifique-se de cadastrar seu número em Configurações antes de vincular.\n\nTente: *vincular ${v?.prefix} 48999186712*`,
  linkPersonalOk: () => "✅ WhatsApp vinculado ao *AXIS Pessoal*! Pode enviar comprovantes e mensagens normalmente.",
  linkBusinessNoAccount: () => "❌ Este número não possui uma conta Business no AXIS.\n\nPara vincular o AXIS Pessoal, use:\n*vincular AP [seu-numero]*",
  linkBusinessOk: () => "✅ WhatsApp vinculado ao *AXIS Business*! Envie uma *foto do recibo* para registrar uma despesa corporativa.",
  linkNotLinked: () => "❌ Este número não está vinculado ao AXIS.\n\nPara vincular o *AXIS Pessoal*, envie:\n*vincular AP [seu-numero]*\n\nPara vincular o *AXIS Business*, envie:\n*vincular AB [seu-numero]*\n\nEx: *vincular AP 48999186712*",

  // ── Language command ─────────────────────────────────────────────────────────
  languageChanged: () => "✅ Idioma alterado para *Português*!",
  languageAlreadySet: () => "ℹ️ Você já está usando o *Português*.",

  // ── Pending business choice ──────────────────────────────────────────────────
  pendingBusinessPersonalSaved: (v) => `✅ *Registrado como gasto pessoal!*\n${v?.replyLine}`,
  pendingBusinessCorporateSaved: (v) => `✅ *Despesa corporativa registrada!*\n${v?.replyLine}\n\n📋 Salvo em *${v?.orgName}* — aguardando aprovação do gestor.`,
  pendingBusinessInvalid: (v) => `⚠️ Não entendi. Responda *pessoal* ou o nome da empresa (${v?.orgNames}).`,

  // ── Pending duplicates ───────────────────────────────────────────────────────
  duplicateConfirmed: (v) => `✅ Cadastrado!\n${v?.replyText}`,
  duplicateCancelled: () => "🚫 Ok, transação não cadastrada.",
  duplicatePending: (v) => `⚠️ Responda *sim* para cadastrar ou *não* para cancelar.\n${v?.replyText}`,

  // ── Pending bill identity ────────────────────────────────────────────────────
  identityPrompt: (v) => `⚠️ Responda *1* ou *2* para identificar quem é você.\n\n1️⃣ ${v?.name1}\n2️⃣ ${v?.name2}`,

  // ── Pending savings ──────────────────────────────────────────────────────────
  savingsAwaitName: () => "📝 Qual será o nome da nova reserva?",
  savingsInvalidOption: (v) => `⚠️ Opção inválida. Responda com o número da reserva:\n\n${v?.lines}\n➕ ${v?.createIdx} - Criar nova reserva "${v?.goalName || "..."}" com R$ ${v?.amount}`,

  // ── Edit last ────────────────────────────────────────────────────────────────
  editNoTx: () => "Não encontrei uma transação recente para editar. Cadastre um gasto ou receita primeiro.",
  editNoFields: () => "Não entendi o que você quer alterar. Pode descrever melhor?",
  editDone: (v) => `✅ *Transação atualizada!*\n${v?.icon} ${v?.desc} — R$ ${v?.amount} em *${v?.category}*`,

  // ── General ──────────────────────────────────────────────────────────────────
  processingError: () => "❌ Erro ao processar. Tente novamente.",
  unknownIntent: () => "🤔 Não entendi. Tente:\n• *gastei 50 no almoço*\n• *criar tarefa reunião*\n• *hábito academia todo dia*\n• *agendar consulta sexta 10h*",

  // ── Collaborator ─────────────────────────────────────────────────────────────
  collabAlreadyLinked: () => "✅ Seu número já está vinculado ao *AXIS Business*!\n\nEnvie uma *foto do recibo* para registrar uma despesa corporativa.",
  collabSendReceipt: () => "📎 Envie uma *foto do recibo* para registrar uma despesa corporativa.\n\nAssim que receber a imagem, vou criar a despesa automaticamente e notificar o gestor.",
  collabNoOrg: () => "⚠️ Você não está associado a nenhuma empresa. Entre em contato com o administrador.",

  // ── Receipt / image ──────────────────────────────────────────────────────────
  receiptAnalyzing: () => "🔍 Analisando comprovante...",
  receiptDownloadError: () => "😕 Não consegui baixar a imagem. Tente enviar novamente.",
  receiptAnalysisError: () => "😕 Não consegui analisar a imagem. Tente uma foto mais nítida.",
  receiptNoValue: () => "😕 Não consegui identificar um valor nessa imagem. Tente uma foto mais nítida.",
  receiptNoValueText: () => "😕 Não consegui identificar um valor nessa imagem. Tente uma foto mais nítida ou descreva o gasto em texto.",
  receiptAnalysisErrorText: () => "😕 Não consegui analisar a imagem. Tente descrever o gasto em texto, por exemplo: *gastei 50 reais no almoço*",
  receiptSaved: (v) => `✅ *Comprovante registrado!*\n${v?.replyLine}`,
  receiptSaveError: () => "😕 Não consegui salvar os comprovantes. Tente novamente.",
  receiptBusinessSaved: (v) => `✅ *Despesa corporativa registrada!*\n${v?.replyLine}\n\n📋 Salvo em *${v?.orgName}* — aguardando aprovação do gestor.`,
  receiptAskBusiness: (v) => `✅ Comprovante identificado:\n${v?.replyLine}\n\n🏢 Essa despesa é *pessoal* ou corporativa?\nResponda: *pessoal* ou o nome da empresa (${v?.orgNames})`,
  receiptMultipleHeader: (v) => `✅ ${v?.count} comprovantes identificados:`,

  // ── Audio ────────────────────────────────────────────────────────────────────
  audioTranscribing: () => "🎙️ Transcrevendo áudio...",
  audioDownloadError: () => "😕 Não consegui baixar o áudio. Tente enviar novamente.",
  audioTranscribeError: () => "😕 Não consegui entender o áudio. Tente falar com mais clareza ou envie uma mensagem de texto.",
  audioTranscribeEmpty: () => "😕 Não consegui entender o áudio. Tente enviar uma mensagem de texto.",
  audioUnderstood: (v) => `🎙️ Entendi: _${v?.text}_`,

  // ── Document / PDF ───────────────────────────────────────────────────────────
  docUnsupported: (v) => `📄 Arquivo *${v?.name}* não suportado.\n\nEnvie extratos nos formatos: PDF, TXT ou CSV.`,
  docLimitReached: (v) => `⛔ *Limite atingido* — ${v?.reason}.\n\n👉 Faça upgrade em: https://axis.app/pricing`,
  docAnalyzing: () => "📄 Analisando extrato... Isso pode levar alguns segundos para arquivos com muitas páginas.",
  docDownloadError: () => "😕 Não consegui baixar o arquivo. Tente enviar novamente.",
  docParseError: () => "😕 Não consegui interpretar o extrato. Verifique se o arquivo contém transações legíveis.",
  docBillIdentityPrompt: (v) => `🔍 *Quem é você nessa nota?*\n\n1️⃣ ${v?.issuer} (${v?.issuerCnpj})\n2️⃣ ${v?.recipient} (${v?.recipientCnpj})\n\nResponda *1* ou *2*`,
  docNoTransactions: () => "🤔 Nenhuma transação encontrada no arquivo. Verifique se o extrato está no formato correto.",
  docAllDuplicates: (v) => `✅ Extrato analisado!${v?.bank}${v?.period}\n\nTodas as ${v?.count} transações já estavam cadastradas — nada novo para importar.`,
  docImported: (v) => `📊 *Extrato analisado!*${v?.bank}${v?.period}\n\n✅ ${v?.imported} importadas${v?.skipped > 0 ? `  ⏭️ ${v?.skipped} já cadastradas` : ""}\n\n💰 Receitas: R$ ${v?.income}\n💸 Gastos: R$ ${v?.expense}\n\n_Disponíveis no AXIS._`,

  // ── Bill (from PDF) ──────────────────────────────────────────────────────────
  billSaved: (v) => `📋 Conta registrada!\n\n*${v?.title}*\n${v?.typeLabel}: R$ ${v?.amount}\n📅 Vence dia ${v?.dueDay}${v?.extra}\n\nVeja em Contas no app.`,
  billTypePay: () => "💸 A pagar",
  billTypeReceive: () => "💰 A receber",

  // ── Transaction limit ─────────────────────────────────────────────────────────
  txLimitReached: (v) => `⚠️ *Limite de transações atingido!*\n\nVocê já registrou *${v?.current}* de *${v?.limit}* transações este mês no plano atual.\n\n💡 Faça upgrade para o AXIS Personal AI e tenha transações ilimitadas:\nhttps://axisapp.com/pricing`,

  // ── Card warning ──────────────────────────────────────────────────────────────
  cardWarning90CritBalance: (v) => `\n\n🚨 *Alerta AXIS:* Cartão *${v?.card}* em ${v?.pct}% do limite e saldo no banco está crítico (R$${v?.balance}). Risco de descontrole financeiro.`,
  cardWarning90: (v) => `\n\n⚠️ *AXIS:* Cartão *${v?.card}* em ${v?.pct}% do limite — próximo do teto. Avalie pausar os gastos.`,
  cardWarning70LowBalance: (v) => `\n\n⚠️ *AXIS:* Cartão *${v?.card}* em ${v?.pct}% do limite e saldo no banco está baixo. Cuidado com novos gastos no crédito.`,
  cardWarning70: (v) => `\n\n💳 *AXIS:* Cartão *${v?.card}* já está em ${v?.pct}% do limite este mês.`,
  cardWarning50: (v) => `\n\n💳 *AXIS:* Cartão *${v?.card}* atingiu ${v?.pct}% do limite este mês.`,

  // ── Savings ───────────────────────────────────────────────────────────────────
  savingsNoAmount: () => "Não entendi o valor. Qual é o valor que você quer guardar?",
  savingsNoGoals: (v) => `📝 Você ainda não tem reservas. Qual será o nome da reserva onde guardar R$ ${v?.amount}?`,
  savingsMenu: (v) => `${v?.notFound}Em qual reserva deseja guardar *R$ ${v?.amount}*?\n\n${v?.lines}\n➕ ${v?.createIdx} - Criar nova reserva${v?.goalName ? ` "${v?.goalName}"` : ""}`,
  savingsNotFound: (v) => `🔍 Reserva *"${v?.name}"* não encontrada.\n\n`,
  savingsDeposited: (v) => `✅ *R$ ${v?.amount} guardado em ${v?.goalTitle}!*\n💰 Total na reserva: R$ ${v?.total}`,

  // ── buildReply ─────────────────────────────────────────────────────────────────
  incomeRegistered: (v) => `✅ Receita de R$ ${v?.amount} em *${v?.category}* registrada!`,
  expenseRegistered: (v) => `✅ Gasto de R$ ${v?.amount} em *${v?.category}* registrado${v?.cardSuffix}!${v?.cardWarning}`,
  installmentsRegistered: (v) => `✅ ${v?.n}x de R$ ${v?.amount} no *${v?.card}* registrado!${v?.cardWarning}`,
  businessExpenseText: (v) => `✅ *Despesa corporativa registrada!*\n💸 R$ ${v?.amount} em *${v?.category}*\n\n📋 Salvo em *${v?.orgName}* — aguardando aprovação do gestor.`,
  taskCreated: (v) => `✅ Tarefa *${v?.title}* criada com prioridade ${v?.priority}!`,
  taskPriorityHigh: () => "alta",
  taskPriorityMedium: () => "média",
  taskPriorityLow: () => "baixa",
  scheduleCreated: (v) => `✅ Compromisso *${v?.title}* agendado para ${v?.dt}!`,
  habitCreated: (v) => `✅ Hábito *${v?.name}* criado!`,
  goalSavingCategory: () => "reserva",
  goalDepositDesc: (v) => `Depósito em ${v?.title}`,

  // ── Aliases used in whatsapp.ts (mapped key names) ───────────────────────────
  receiptSavedPersonal: (v) => `✅ *Registrado como gasto pessoal!*\n${v?.replyLine}`,
  receiptAskBusinessInvalid: (v) => `⚠️ Não entendi. Responda *pessoal* ou o nome da empresa (${v?.orgNames}).`,
  dupConfirmed: (v) => `✅ Cadastrado!\n${v?.replyText}`,
  dupCancelled: () => "🚫 Ok, transação não cadastrada.",
  dupInvalid: (v) => `⚠️ Responda *sim* para cadastrar ou *não* para cancelar.\n${v?.replyText}`,
  editLastNotFound: () => "Não encontrei uma transação recente para editar. Cadastre um gasto ou receita primeiro.",
  editLastUnknownField: () => "Não entendi o que você quer alterar. Pode descrever melhor?",
  editLastUpdated: (v) => `✅ *Transação atualizada!*\n${v?.icon} ${v?.desc} — R$ ${v?.amount} em *${v?.category}*`,
  savingsNewGoalName: () => "📝 Qual será o nome da nova reserva?",
  savingsInvalidAmount: () => "Não entendi o valor. Qual é o valor que você quer guardar?",
  goalDeposited: (v) => `✅ *R$ ${v?.amount} guardado em ${v?.title}!*\n💰 Total na reserva: R$ ${v?.total}`,
  bizExpenseSavedText: (v) => `✅ *Despesa corporativa registrada!*\n💸 R$ ${v?.amount} em *${v?.categoryName}*\n\n📋 Salvo em *${v?.orgName}* — aguardando aprovação do gestor.`,
  installmentsSaved: (v) => `✅ ${v?.n}x de R$ ${v?.installAmt} no *${v?.cardName}* registrado!`,
  incomeSaved: (v) => `✅ Receita de R$ ${v?.amount} em *${v?.categoryName}* registrada!`,
  expenseSaved: (v) => `✅ Gasto de R$ ${v?.amount} em *${v?.categoryName}* registrado${v?.cardSuffix}!`,
  chatFallback: () => "💬 Mensagem recebida!",
};

const en: Messages = {
  // ── Link / vincular ─────────────────────────────────────────────────────────
  linkNotFound: (v) => `❌ Number not found. Make sure to register your phone number in Settings before linking.\n\nTry: *link ${v?.prefix} 48999186712*`,
  linkPersonalOk: () => "✅ WhatsApp linked to *AXIS Personal*! You can now send receipts and messages normally.",
  linkBusinessNoAccount: () => "❌ This number doesn't have a Business account on AXIS.\n\nTo link AXIS Personal, use:\n*link AP [your-number]*",
  linkBusinessOk: () => "✅ WhatsApp linked to *AXIS Business*! Send a *photo of a receipt* to log a corporate expense.",
  linkNotLinked: () => "❌ This number is not linked to AXIS.\n\nTo link *AXIS Personal*, send:\n*link AP [your-number]*\n\nTo link *AXIS Business*, send:\n*link AB [your-number]*\n\nEx: *link AP 48999186712*",

  // ── Language command ─────────────────────────────────────────────────────────
  languageChanged: () => "✅ Language changed to *English*!",
  languageAlreadySet: () => "ℹ️ You're already using *English*.",

  // ── Pending business choice ──────────────────────────────────────────────────
  pendingBusinessPersonalSaved: (v) => `✅ *Saved as personal expense!*\n${v?.replyLine}`,
  pendingBusinessCorporateSaved: (v) => `✅ *Corporate expense registered!*\n${v?.replyLine}\n\n📋 Saved to *${v?.orgName}* — awaiting manager approval.`,
  pendingBusinessInvalid: (v) => `⚠️ I didn't understand. Reply *personal* or the company name (${v?.orgNames}).`,

  // ── Pending duplicates ───────────────────────────────────────────────────────
  duplicateConfirmed: (v) => `✅ Saved!\n${v?.replyText}`,
  duplicateCancelled: () => "🚫 Ok, transaction not saved.",
  duplicatePending: (v) => `⚠️ Reply *yes* to save or *no* to cancel.\n${v?.replyText}`,

  // ── Pending bill identity ────────────────────────────────────────────────────
  identityPrompt: (v) => `⚠️ Reply *1* or *2* to identify who you are.\n\n1️⃣ ${v?.name1}\n2️⃣ ${v?.name2}`,

  // ── Pending savings ──────────────────────────────────────────────────────────
  savingsAwaitName: () => "📝 What should the new savings goal be called?",
  savingsInvalidOption: (v) => `⚠️ Invalid option. Reply with the goal number:\n\n${v?.lines}\n➕ ${v?.createIdx} - Create new goal "${v?.goalName || "..."}" with R$ ${v?.amount}`,

  // ── Edit last ────────────────────────────────────────────────────────────────
  editNoTx: () => "I couldn't find a recent transaction to edit. Log an expense or income first.",
  editNoFields: () => "I didn't understand what you want to change. Can you be more specific?",
  editDone: (v) => `✅ *Transaction updated!*\n${v?.icon} ${v?.desc} — R$ ${v?.amount} in *${v?.category}*`,

  // ── General ──────────────────────────────────────────────────────────────────
  processingError: () => "❌ Error processing your message. Please try again.",
  unknownIntent: () => "🤔 I didn't understand. Try:\n• *spent 50 on lunch*\n• *create task meeting*\n• *habit gym every day*\n• *schedule appointment Friday 10am*",

  // ── Collaborator ─────────────────────────────────────────────────────────────
  collabAlreadyLinked: () => "✅ Your number is already linked to *AXIS Business*!\n\nSend a *photo of a receipt* to log a corporate expense.",
  collabSendReceipt: () => "📎 Send a *photo of a receipt* to log a corporate expense.\n\nOnce I receive the image, I'll create the expense automatically and notify the manager.",
  collabNoOrg: () => "⚠️ You are not associated with any company. Please contact the administrator.",

  // ── Receipt / image ──────────────────────────────────────────────────────────
  receiptAnalyzing: () => "🔍 Analyzing receipt...",
  receiptDownloadError: () => "😕 Couldn't download the image. Please try again.",
  receiptAnalysisError: () => "😕 Couldn't analyze the image. Try a clearer photo.",
  receiptNoValue: () => "😕 Couldn't identify a value in this image. Try a clearer photo.",
  receiptNoValueText: () => "😕 Couldn't identify a value in this image. Try a clearer photo or describe the expense in text.",
  receiptAnalysisErrorText: () => "😕 Couldn't analyze the image. Try describing the expense in text, e.g.: *spent 50 on lunch*",
  receiptSaved: (v) => `✅ *Receipt saved!*\n${v?.replyLine}`,
  receiptSaveError: () => "😕 Couldn't save the receipts. Please try again.",
  receiptBusinessSaved: (v) => `✅ *Corporate expense registered!*\n${v?.replyLine}\n\n📋 Saved to *${v?.orgName}* — awaiting manager approval.`,
  receiptAskBusiness: (v) => `✅ Receipt identified:\n${v?.replyLine}\n\n🏢 Is this expense *personal* or corporate?\nReply: *personal* or the company name (${v?.orgNames})`,
  receiptMultipleHeader: (v) => `✅ ${v?.count} receipts identified:`,

  // ── Audio ────────────────────────────────────────────────────────────────────
  audioTranscribing: () => "🎙️ Transcribing audio...",
  audioDownloadError: () => "😕 Couldn't download the audio. Please try again.",
  audioTranscribeError: () => "😕 Couldn't understand the audio. Try speaking more clearly or send a text message.",
  audioTranscribeEmpty: () => "😕 Couldn't understand the audio. Please send a text message instead.",
  audioUnderstood: (v) => `🎙️ I heard: _${v?.text}_`,

  // ── Document / PDF ───────────────────────────────────────────────────────────
  docUnsupported: (v) => `📄 File *${v?.name}* is not supported.\n\nPlease send statements in: PDF, TXT or CSV format.`,
  docLimitReached: (v) => `⛔ *Limit reached* — ${v?.reason}.\n\n👉 Upgrade at: https://axis.app/pricing`,
  docAnalyzing: () => "📄 Analyzing statement... This may take a few seconds for files with many pages.",
  docDownloadError: () => "😕 Couldn't download the file. Please try again.",
  docParseError: () => "😕 Couldn't interpret the statement. Make sure the file contains readable transactions.",
  docBillIdentityPrompt: (v) => `🔍 *Who are you in this document?*\n\n1️⃣ ${v?.issuer} (${v?.issuerCnpj})\n2️⃣ ${v?.recipient} (${v?.recipientCnpj})\n\nReply *1* or *2*`,
  docNoTransactions: () => "🤔 No transactions found in the file. Make sure the statement is in the correct format.",
  docAllDuplicates: (v) => `✅ Statement analyzed!${v?.bank}${v?.period}\n\nAll ${v?.count} transactions were already registered — nothing new to import.`,
  docImported: (v) => `📊 *Statement analyzed!*${v?.bank}${v?.period}\n\n✅ ${v?.imported} imported${v?.skipped > 0 ? `  ⏭️ ${v?.skipped} already registered` : ""}\n\n💰 Income: R$ ${v?.income}\n💸 Expenses: R$ ${v?.expense}\n\n_Available in AXIS._`,

  // ── Bill (from PDF) ──────────────────────────────────────────────────────────
  billSaved: (v) => `📋 Bill registered!\n\n*${v?.title}*\n${v?.typeLabel}: R$ ${v?.amount}\n📅 Due on day ${v?.dueDay}${v?.extra}\n\nView in Bills in the app.`,
  billTypePay: () => "💸 To pay",
  billTypeReceive: () => "💰 To receive",

  // ── Transaction limit ─────────────────────────────────────────────────────────
  txLimitReached: (v) => `⚠️ *Transaction limit reached!*\n\nYou have already logged *${v?.current}* of *${v?.limit}* transactions this month on your current plan.\n\n💡 Upgrade to AXIS Personal AI for unlimited transactions:\nhttps://axisapp.com/pricing`,

  // ── Card warning ──────────────────────────────────────────────────────────────
  cardWarning90CritBalance: (v) => `\n\n🚨 *AXIS Alert:* Card *${v?.card}* at ${v?.pct}% of the limit and bank balance is critical (R$${v?.balance}). Risk of financial overrun.`,
  cardWarning90: (v) => `\n\n⚠️ *AXIS:* Card *${v?.card}* at ${v?.pct}% of the limit — near the ceiling. Consider pausing spending.`,
  cardWarning70LowBalance: (v) => `\n\n⚠️ *AXIS:* Card *${v?.card}* at ${v?.pct}% of the limit and bank balance is low. Be careful with new credit charges.`,
  cardWarning70: (v) => `\n\n💳 *AXIS:* Card *${v?.card}* is already at ${v?.pct}% of the limit this month.`,
  cardWarning50: (v) => `\n\n💳 *AXIS:* Card *${v?.card}* has reached ${v?.pct}% of the limit this month.`,

  // ── Savings ───────────────────────────────────────────────────────────────────
  savingsNoAmount: () => "I didn't understand the amount. How much do you want to save?",
  savingsNoGoals: (v) => `📝 You don't have any savings goals yet. What should the goal be called to save R$ ${v?.amount}?`,
  savingsMenu: (v) => `${v?.notFound}Which goal do you want to save *R$ ${v?.amount}* to?\n\n${v?.lines}\n➕ ${v?.createIdx} - Create new goal${v?.goalName ? ` "${v?.goalName}"` : ""}`,
  savingsNotFound: (v) => `🔍 Goal *"${v?.name}"* not found.\n\n`,
  savingsDeposited: (v) => `✅ *R$ ${v?.amount} saved to ${v?.goalTitle}!*\n💰 Goal total: R$ ${v?.total}`,

  // ── buildReply ─────────────────────────────────────────────────────────────────
  incomeRegistered: (v) => `✅ Income of R$ ${v?.amount} in *${v?.category}* registered!`,
  expenseRegistered: (v) => `✅ Expense of R$ ${v?.amount} in *${v?.category}* registered${v?.cardSuffix}!${v?.cardWarning}`,
  installmentsRegistered: (v) => `✅ ${v?.n}x of R$ ${v?.amount} on *${v?.card}* registered!${v?.cardWarning}`,
  businessExpenseText: (v) => `✅ *Corporate expense registered!*\n💸 R$ ${v?.amount} in *${v?.category}*\n\n📋 Saved to *${v?.orgName}* — awaiting manager approval.`,
  taskCreated: (v) => `✅ Task *${v?.title}* created with ${v?.priority} priority!`,
  taskPriorityHigh: () => "high",
  taskPriorityMedium: () => "medium",
  taskPriorityLow: () => "low",
  scheduleCreated: (v) => `✅ Appointment *${v?.title}* scheduled for ${v?.dt}!`,
  habitCreated: (v) => `✅ Habit *${v?.name}* created!`,
  goalSavingCategory: () => "savings",
  goalDepositDesc: (v) => `Deposit to ${v?.title}`,

  // ── Aliases used in whatsapp.ts (mapped key names) ───────────────────────────
  receiptSavedPersonal: (v) => `✅ *Saved as personal expense!*\n${v?.replyLine}`,
  receiptAskBusinessInvalid: (v) => `⚠️ I didn't understand. Reply *personal* or the company name (${v?.orgNames}).`,
  dupConfirmed: (v) => `✅ Saved!\n${v?.replyText}`,
  dupCancelled: () => "🚫 Ok, transaction not saved.",
  dupInvalid: (v) => `⚠️ Reply *yes* to save or *no* to cancel.\n${v?.replyText}`,
  editLastNotFound: () => "I couldn't find a recent transaction to edit. Log an expense or income first.",
  editLastUnknownField: () => "I didn't understand what you want to change. Can you be more specific?",
  editLastUpdated: (v) => `✅ *Transaction updated!*\n${v?.icon} ${v?.desc} — R$ ${v?.amount} in *${v?.category}*`,
  savingsNewGoalName: () => "📝 What should the new savings goal be called?",
  savingsInvalidAmount: () => "I didn't understand the amount. How much do you want to save?",
  goalDeposited: (v) => `✅ *R$ ${v?.amount} saved to ${v?.title}!*\n💰 Goal total: R$ ${v?.total}`,
  bizExpenseSavedText: (v) => `✅ *Corporate expense registered!*\n💸 R$ ${v?.amount} in *${v?.categoryName}*\n\n📋 Saved to *${v?.orgName}* — awaiting manager approval.`,
  installmentsSaved: (v) => `✅ ${v?.n}x of R$ ${v?.installAmt} on *${v?.cardName}* registered!`,
  incomeSaved: (v) => `✅ Income of R$ ${v?.amount} in *${v?.categoryName}* registered!`,
  expenseSaved: (v) => `✅ Expense of R$ ${v?.amount} in *${v?.categoryName}* registered${v?.cardSuffix}!`,
  chatFallback: () => "💬 Message received!",
};

const msgs: Record<Lang, Messages> = { pt, en };

export function wt(key: string, lang: string | undefined, vars?: Record<string, any>): string {
  const l: Lang = lang === "en" ? "en" : "pt";
  const fn = msgs[l]?.[key] ?? msgs.pt[key];
  return fn?.(vars) ?? key;
}

export function langFromProfile(language?: string | null): Lang {
  return language === "en" ? "en" : "pt";
}
