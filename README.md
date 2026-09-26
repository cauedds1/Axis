# AXIS — Assistente de Vida Pessoal

**🔗 [myaxis.com.br](https://myaxis.com.br)**

O AXIS é um SaaS que organiza finanças, tarefas, agenda e hábitos a partir de comandos de voz ou texto em linguagem natural. Você escreve (ou fala) "gastei 35 reais no almoço" e a IA entende, categoriza e atualiza o painel na hora, pelo site ou pelo WhatsApp.

Além do módulo pessoal, o projeto inclui o **AXIS Business**, um sistema de gestão de despesas corporativas com várias organizações, aprovação de gastos e relatórios.

## Principais funcionalidades

- **Finanças pessoais:** receitas, despesas, metas, contas a pagar com recorrência, cartões de crédito com faturas e parcelamentos.
- **Entrada por voz e texto:** transcrição de áudio e detecção de intenção com IA.
- **Leitura de documentos:** extrai dados de fotos de recibos, comprovantes Pix, extratos e boletos em PDF.
- **Bot de WhatsApp:** registre gastos, envie fotos, áudios e PDFs direto pelo WhatsApp.
- **Agenda inteligente:** sugestões de horário feitas pela IA, com aprovação do usuário.
- **Tarefas e hábitos:** sequências (streaks) e pontuação de disciplina.
- **Chat com IA:** assistente com memória e acesso ao contexto do usuário.
- **Relatórios:** gráficos de finanças, tarefas, hábitos e agenda, com filtros por período e relatórios mensais por e-mail.
- **AXIS Business:** organizações, limites de gasto, papéis de membros, aprovação de despesas e exportação de relatórios.
- **Assinaturas:** planos com limites de uso e cobrança via Stripe.
- **Painel administrativo:** usuários, faturamento, uso de IA, logs do WhatsApp e trilha de auditoria.
- **Bilíngue:** português e inglês, com 8 paletas de tema.

## Tecnologias

| Camada | Stack |
|---|---|
| Frontend | React 18, Vite, TypeScript, TailwindCSS, shadcn/ui, wouter, TanStack Query, Framer Motion, Recharts |
| Backend | Node.js, Express 5, TypeScript, express-session, bcrypt |
| Banco de dados | PostgreSQL + Drizzle ORM |
| IA | OpenAI (chat, transcrição de áudio, leitura de imagens e PDFs) |
| Integrações | Stripe, Resend/SendGrid, WhatsApp (Baileys), armazenamento S3/Cloudflare R2 |

## Como rodar localmente

### Pré-requisitos

- Node.js 20 ou superior
- PostgreSQL 14 ou superior

### Passo a passo

```bash
# 1. Clone e instale as dependências
git clone https://github.com/cauedds1/Axis.git
cd Axis
npm install

# 2. Configure as variáveis de ambiente
cp .env.example .env
# edite o .env: no mínimo DATABASE_URL e SESSION_SECRET

# 3. Carregue as variáveis no terminal
set -a; source .env; set +a

# 4. Crie as tabelas no banco
npm run db:push

# 5. Inicie em modo de desenvolvimento
npm run dev
```

O app fica disponível em **http://localhost:5000**.

Só `DATABASE_URL` e `SESSION_SECRET` são obrigatórias. Sem as demais, o app sobe normalmente e apenas desativa o recurso correspondente: IA sem `OPENAI_API_KEY`, pagamentos sem `STRIPE_SECRET_KEY`, e-mails sem `RESEND_API_KEY`, e sem as variáveis `STORAGE_*` as imagens ficam salvas no banco.

### Build de produção

```bash
npm run build
npm start
```

## Estrutura

```
client/      # Frontend React
server/      # API Express, IA, WhatsApp, Stripe, e-mails
shared/      # Schema do banco (Drizzle) e tipos compartilhados
migrations/  # Migrações SQL
script/      # Script de build
scripts/     # Scripts auxiliares (seed do Stripe etc.)
```
