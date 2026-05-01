# AXIS — Pacote de Listagem no Flippa
> Documento completo pronto para publicação. Criado em: Maio 2026.

---

## ⚠️ Instruções para o Vendedor

Antes de publicar, você precisará:
1. Capturar **screenshots** do painel admin (`/admin`) com métricas reais
2. Capturar o **dashboard do Stripe** mostrando receita e assinantes
3. Gravar um **vídeo-demo** de 2–5 min mostrando o fluxo completo (opcional, mas aumenta conversão em ~40%)
4. Definir se a venda inclui o **domínio customizado** (se houver) e ajustar o preço pedido de acordo
5. Criar conta no Flippa em [flippa.com](https://flippa.com) e iniciar o processo em "Sell > SaaS"

---

## SEÇÃO 1 — LISTAGEM FLIPPA

### Título *(máx. 70 caracteres)*

```
AXIS — AI Life & Business Organizer | Stripe + WhatsApp + OpenAI
```
*(63 caracteres)*

---

### Tagline / Subtítulo *(máx. 160 caracteres)*

```
Full-stack SaaS with personal finance, habits, tasks, AI chat, and a multi-tenant corporate expense module. Built on React + Node + PostgreSQL.
```

---

### Categoria Flippa

`Software & SaaS > Productivity Tools`

---

### Descrição Completa

**Copie e cole diretamente no campo "Business Description" do Flippa:**

---

#### 🌟 What is AXIS?

AXIS is a production-ready, AI-powered SaaS platform with two integrated products in one codebase:

**AXIS Personal** — a life organizer that helps users manage finances, tasks, habits, agenda, and goals through voice or text commands. The AI understands natural language ("I spent R$35 on lunch"), categorizes the expense automatically, and updates the dashboard in real time.

**AXIS Business** — a corporate expense management system with multi-tenant organization support. Teams submit expenses via WhatsApp photos, admins approve or reject, and finance managers export detailed reports.

Both products share the same infrastructure and are deployed from a single repository — a rare combination that lowers operational costs and makes the platform uniquely defensible.

---

#### 🏗️ Why Buy Now?

- **Fully functional MVP** — both Personal and Business modules are live and working, not mockups
- **Subscription billing ready** — Stripe is already integrated with webhooks, plan limits, and checkout flows
- **AI moat** — OpenAI is deeply integrated (voice transcription, intent detection, receipt OCR, contextual chat)
- **WhatsApp integration** — via Baileys, enabling expense submission by photo or audio directly from WhatsApp
- **Admin panel** — full super-admin dashboard at `/admin` with user management, revenue metrics, AI usage logs, billing overview, and audit trail
- **Bilingual** — English and Portuguese (pt-BR), with i18n infrastructure ready to add new languages
- **Email verification + password reset** — full auth lifecycle already built
- **No technical debt trap** — clean TypeScript throughout (React frontend, Express backend, Drizzle ORM), well-organized file structure

---

#### 💰 Monetization Model

| Plan | Price | Features |
|------|-------|----------|
| **Starter** | Free | 200 transactions/mo, 30 AI captures, 10 WhatsApp photos, 10 chat messages |
| **Personal AI** | $9/month | Unlimited everything + voice transcription (7-day free trial) |
| **Team** | $29/month | All Personal AI features + AXIS Business module access |

Revenue is captured through Stripe subscriptions. Plan limits are enforced server-side, with a global upgrade modal triggered automatically when users hit limits. The freemium model is already designed to convert: Starter users hit limits within the first month of active use.

---

#### 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TailwindCSS, shadcn/ui, Framer Motion, Recharts |
| **Backend** | Node.js, Express 5, TypeScript |
| **Database** | PostgreSQL (via Drizzle ORM) |
| **AI** | OpenAI GPT-4o (chat, intent detection, receipt analysis, voice) |
| **Payments** | Stripe (subscriptions, webhooks, checkout) |
| **Email** | SendGrid / Resend |
| **WhatsApp** | Baileys (open-source WhatsApp Web API) |
| **Auth** | bcrypt + express-session |
| **Hosting** | Replit (easily migrated to any Node.js host) |
| **File Storage** | S3-compatible (Cloudflare R2 recommended) |

---

#### 📦 What's Included in the Sale

- ✅ Complete source code (frontend + backend, ~60+ organized files)
- ✅ PostgreSQL database schema (Drizzle migrations)
- ✅ All API integrations pre-configured (OpenAI, Stripe, SendGrid, WhatsApp)
- ✅ Super admin panel with full metrics dashboard
- ✅ Bilingual i18n system (EN + PT-BR)
- ✅ Landing pages for both AXIS Personal and AXIS Business
- ✅ Email templates (verification codes, password reset, monthly reports, bill alerts)
- ✅ Stripe product seeder script (ready to populate your Stripe account)
- ✅ Documentation in `replit.md` covering architecture and setup
- ✅ 30-day post-sale support (email, async) — *negotiable*

---

#### 📈 Growth Opportunities

1. **Expand to other languages** — the i18n system is built; adding Spanish, French, or German is days of work
2. **Mobile app** — the REST API is already built; a React Native or Flutter frontend is the logical next step
3. **WhatsApp Bot monetization** — the WhatsApp integration is powerful and underutilized; it can become a standalone product
4. **B2B focus** — the Business module is a complete corporate expense product; a dedicated B2B GTM could unlock much higher ACVs ($99–$299/month per org)
5. **White-label** — the theming system (8 palettes, per-org logos) is designed for white-labeling
6. **Vertical SaaS** — the platform is generic enough to be repositioned for specific verticals (freelancers, small accounting firms, real estate agents)

---

#### 🔧 Transition & Handoff

The buyer receives full repository access on Day 1. A complete handoff is achievable in under 2 weeks:

- **Week 1**: Repository transfer, environment variable handoff (OpenAI, Stripe, SendGrid, database), DNS/domain transfer, walkthrough call
- **Week 2**: Seller available for questions; buyer deploys to their own hosting environment

No proprietary infrastructure or vendor lock-in. The entire stack runs on standard Node.js and PostgreSQL, deployable to Render, Railway, Fly.io, AWS, or any other provider.

---

## SEÇÃO 2 — ASKING PRICE (CÁLCULO JUSTIFICADO)

### Cenário A — Asset Sale (Sem Receita Recorrente Significativa)

Use este cenário se o MRR atual for < $500/mês.

**Fundamentos para precificação de asset sales no Flippa:**

| Fator | Avaliação para o AXIS |
|-------|----------------------|
| Complexidade do produto | Alta — dois produtos integrados (Personal + Business) |
| Qualidade do código | Alta — TypeScript, Drizzle ORM, arquitetura limpa |
| Profundidade das integrações | Alta — OpenAI, Stripe, WhatsApp, SendGrid |
| Infraestrutura de auth completa | Sim (email verification, password reset, session) |
| Painel admin funcional | Sim (métricas, gestão de usuários, audit logs) |
| Billing infrastructure | Sim (Stripe + planos + limites + webhooks) |
| Horas estimadas de desenvolvimento | 800–1.200 horas |
| Custo de replicação (dev agency) | $60k–$120k (a $75–$100/hora) |

**Asking Price recomendado (Asset Sale):** `$18,000 – $32,000`

> **Dica de negociação:** Comece em $32k. Um comprador técnico vai reconhecer que reconstruir isso do zero custaria $60k+. Um comprador não-técnico pagará pelo produto já funcionando. O piso razoável é $18k.

---

### Cenário B — Múltiplo de MRR (Com Receita Recorrente)

Use este cenário se o MRR atual for ≥ $500/mês.

**Fórmula:**
```
Asking Price = MRR × 36 a 60  (múltiplo de 3× a 5× ARR)
```

| MRR Atual | ARR | 3× ARR | 4× ARR | 5× ARR |
|-----------|-----|--------|--------|--------|
| $500 | $6,000 | $18,000 | $24,000 | $30,000 |
| $1,000 | $12,000 | $36,000 | $48,000 | $60,000 |
| $2,000 | $24,000 | $72,000 | $96,000 | $120,000 |
| $5,000 | $60,000 | $180,000 | $240,000 | $300,000 |

**Referência de múltiplos no Flippa (2024–2025):**
- SaaS pré-revenue / early-stage: 12–24× MRR
- SaaS com tração comprovada (6+ meses de crescimento): 30–48× MRR
- SaaS com churn baixo e MRR estável: 48–60× MRR

> **Nota para o vendedor:** Se o seu MRR atual é baixo (ex: $154), **não use o múltiplo de MRR** — o resultado seria muito baixo para o valor real do ativo. Use o Cenário A (Asset Sale) e mencione o MRR como "tração inicial".

---

## SEÇÃO 3 — SELL SHEET (UMA PÁGINA)

*Compartilhe este resumo com potenciais compradores antes do NDA.*

---

```
╔══════════════════════════════════════════════════════════════╗
║                          A X I S                             ║
║          AI Life & Business Organizer SaaS                   ║
╚══════════════════════════════════════════════════════════════╝

THE PROBLEM
Most people juggle 4–6 apps to manage their finances, tasks,
schedule, and habits. Businesses waste hours chasing expense
receipts from employees by email.

THE SOLUTION
AXIS is one platform, two products:
• AXIS Personal — AI organizer via voice or text
• AXIS Business — corporate expense management via WhatsApp

THE PRODUCT (LIVE TODAY)
• Finance: income, expenses, goals, credit cards, bills
• Agenda: AI-suggested scheduling
• Habits: streaks, discipline score
• AI Chat: contextual assistant with memory of all user data
• Business: org management, expense approval, reports, reimbursements

MONETIZATION
  Starter        FREE    → freemium acquisition
  Personal AI    $9/mo   → core revenue driver (7-day trial)
  Team           $29/mo  → B2B / corporate tier

TECH STACK
  React + Vite + TypeScript | Express + Node.js
  PostgreSQL + Drizzle ORM  | OpenAI GPT-4o
  Stripe | WhatsApp (Baileys) | SendGrid

INFRASTRUCTURE
  ✓ Stripe billing + webhooks + checkout fully built
  ✓ Super admin panel with revenue + user metrics
  ✓ Email verification + password reset
  ✓ Bilingual: English + Portuguese
  ✓ WhatsApp bot integration
  ✓ S3-compatible file storage

GROWTH VECTORS
  → Mobile app (API already built)
  → B2B white-label for accounting firms / HR platforms
  → WhatsApp Bot as standalone SaaS
  → Geographic expansion via i18n system

ASKING PRICE
  Asset Sale:   $18,000 – $32,000
  With MRR:     36–60× monthly recurring revenue

HANDOFF
  < 2 weeks. Full source code + all integrations + 30-day support.

INTERESTED?
  Contact via Flippa DM or [your contact here]
  NDA available on request.
```

---

## SEÇÃO 4 — DATA ROOM CHECKLIST

*Prepare estes documentos antes de aceitar ofertas sérias.*

### 📊 Métricas e Tração
- [ ] Screenshot do painel admin `/admin` → Dashboard (usuários totais, novos este mês, pagantes)
- [ ] Screenshot do painel admin `/admin` → Billing & Stripe (MRR, contagem de planos)
- [ ] Screenshot do painel admin `/admin` → Revenue (gráfico MRR histórico, ARR)
- [ ] Export ou screenshot do Stripe Dashboard → MRR, número de assinantes ativos, histórico de pagamentos
- [ ] Lista de planos ativos no Stripe (produtos e preços configurados)
- [ ] Screenshot do gráfico de crescimento de usuários (últimos 3–6 meses se disponível)

### 💻 Código e Repositório
- [ ] Acesso ao repositório Git (GitHub, GitLab, ou zip do código-fonte)
- [ ] Histórico de commits mostrando atividade de desenvolvimento (evidência de esforço real)
- [ ] Screenshot do repositório com estrutura de pastas visível
- [ ] Arquivo `replit.md` ou README com instruções de setup
- [ ] Evidência de que o app está rodando (URL pública funcionando)

### 🔌 Integrações e Contas
- [ ] Lista de todas as variáveis de ambiente necessárias (sem revelar os valores ainda)
- [ ] Confirmação de que as contas são transferíveis:
  - [ ] Conta OpenAI (chave de API transferível)
  - [ ] Conta Stripe (conta pode ser transferida ou chaves exportadas)
  - [ ] Conta SendGrid / Resend (transferível)
  - [ ] Conta de hospedagem Replit / outro (transferível)
  - [ ] Domínio customizado (se houver) — registrador e status DNS
- [ ] Screenshot da configuração de webhooks do Stripe

### 🗄️ Banco de Dados
- [ ] Schema do banco de dados (arquivo `shared/schema.ts` — já incluído no código)
- [ ] Confirmação do número de registros de usuários na tabela `users`
- [ ] Confirmação de que não há dados sensíveis de terceiros no banco que impeçam a venda

### 📧 Comunicação e Suporte
- [ ] Modelo de contrato de suporte pós-venda (30 dias async recomendado)
- [ ] Documento de handoff detalhando cada variável de ambiente e onde obtê-la

---

## SEÇÃO 5 — FAQ DO COMPRADOR

**P1: Preciso saber programar para operar o AXIS?**

R: Para operar no dia a dia (gerenciar usuários, ver métricas, processar suporte), não. O painel admin em `/admin` cobre a maior parte. Para fazer mudanças no produto (novas features, ajustes de UI), você precisará de um desenvolvedor React/Node.js ou poderá contratar freelancers — a stack (React + Express + TypeScript) tem um pool enorme de desenvolvedores disponíveis globalmente a custos razoáveis.

---

**P2: Qual é o custo mensal de infraestrutura para operar o AXIS?**

R: Estimativa de custo mínimo para operar:

| Serviço | Custo Estimado/mês |
|---------|-------------------|
| Hospedagem (Replit Hacker / Railway / Render) | $7–$25 |
| PostgreSQL (Neon / Railway / Supabase) | $0–$25 |
| OpenAI (uso variável) | $10–$100+ dependendo do volume |
| SendGrid / Resend | $0–$20 (tier gratuito generoso) |
| Stripe | 2,9% + $0,30 por transação (sem mensalidade) |
| **Total estimado** | **~$20–$150/mês** |

Com MRR de $500+, a operação já é lucrativa em custos.

---

**P3: As integrações (OpenAI, Stripe, WhatsApp) são transferíveis?**

R: Sim, todas elas. O AXIS usa chaves de API padrão para OpenAI e SendGrid — o comprador cria suas próprias contas e substitui as chaves no ambiente. O Stripe permite transferência de conta ou criação de nova conta com migração de assinantes (processo padrão do Stripe). A integração WhatsApp usa Baileys (open-source), sem contrato com o WhatsApp Business API pago.

---

**P4: Há usuários pagantes ativos hoje?**

R: Os dados atuais de MRR estarão visíveis no Data Room antes do fechamento. O vendedor fornecerá screenshots do Stripe e do painel admin. Qualquer oferta vinculante pode ser condicionada à verificação dessas métricas.

---

**P5: Qual é o custo e prazo de transição? Precisarei de ajuda do vendedor?**

R: O handoff completo é estimado em menos de 2 semanas:
- **Semana 1**: Transferência do repositório, variáveis de ambiente, configuração de hosting, chamada de walkthrough (~2 horas)
- **Semana 2**: Suporte async por email para dúvidas

O vendedor oferece 30 dias de suporte pós-venda por email (resposta em até 24h em dias úteis). Extensões de suporte são negociáveis.

---

**P6: O produto pode ser white-labeled ou rebranded?**

R: Sim. O sistema de temas do AXIS suporta paletas customizadas, logos por organização, e cores primárias configuráveis. Um rebranding completo (novo nome, nova logo, novas cores) pode ser feito por um desenvolvedor em 1–2 dias. A infraestrutura multi-tenant do módulo Business já suporta logos por organização.

---

**P7: O AXIS é escalável? Qual é o gargalo de escala atual?**

R: A arquitetura (Node.js stateless + PostgreSQL) escala horizontalmente sem alterações significativas. O gargalo mais provável em escala é o PostgreSQL, que pode ser resolvido com read replicas ou migração para PlanetScale/Neon com connection pooling — ambos são upgrades padrão de mercado. A integração WhatsApp via Baileys tem limites de sessão por número de telefone e precisaria de arquitetura de múltiplos números para suportar >1.000 usuários simultâneos ativos no WhatsApp.

---

**P8: Existe um roadmap de produto?**

R: O vendedor pode compartilhar uma lista de features planejadas e bugs conhecidos durante o due diligence. As oportunidades de crescimento mais imediatas são: (1) app mobile usando a API já existente, (2) plano B2B dedicado para empresas a $99–$299/org/mês, e (3) expansão de idiomas via o sistema i18n já construído.

---

**P9: O que acontece com os usuários existentes após a venda?**

R: Os usuários continuam usando o produto normalmente — não há interrupção de serviço. A transição é transparente para o usuário final. As assinaturas Stripe continuam sendo cobradas. O comprador assume a responsabilidade pelo suporte a partir da data de fechamento.

---

**P10: Há alguma questão legal ou de compliance que devo saber?**

R: O AXIS coleta dados de usuários (email, transações financeiras, hábitos). O vendedor recomenda que o comprador: (1) revise a Política de Privacidade existente e adeque à sua jurisdição, (2) verifique requisitos de LGPD (Brasil) ou GDPR (Europa) dependendo do mercado-alvo, (3) consulte um advogado para o contrato de compra e venda do negócio digital. A assessoria jurídica está fora do escopo desta listagem.

---

*Documento gerado automaticamente com base no código-fonte e arquitetura do AXIS — Maio 2026.*
*Para questões sobre a listagem, entre em contato via Flippa DM.*
