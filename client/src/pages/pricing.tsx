import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  Check, Zap, Users, Star, Loader2, ArrowLeft, X,
  Mic, Camera, MessageCircle, CreditCard, Target,
  Repeat, FileText, Building2, HeadphonesIcon, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const ACCENT = "rgba(122,158,138,";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Grátis",
    priceDetail: "para sempre",
    description: "Experimente o AXIS com recursos essenciais, sem cartão de crédito.",
    icon: Star,
    iconColor: "text-muted-foreground",
    highlight: false,
    badge: null,
    cta: "Plano atual",
    planKey: "starter",
  },
  {
    id: "personal_ai",
    name: "Personal AI",
    price: "R$9",
    priceDetail: "/mês",
    trialNote: "7 dias grátis",
    description: "IA sem limites para transformar sua vida financeira e pessoal.",
    icon: Zap,
    iconColor: "text-yellow-400",
    highlight: true,
    badge: "Mais popular",
    cta: "Começar grátis por 7 dias",
    planKey: "personal_ai",
  },
  {
    id: "team",
    name: "Team",
    price: "R$29",
    priceDetail: "/mês",
    trialNote: null,
    description: "Tudo do Personal AI mais a versão Business completa para equipes.",
    icon: Users,
    iconColor: "text-purple-400",
    highlight: false,
    badge: "Business",
    cta: "Assinar Team",
    planKey: "team",
  },
];

const FEATURE_GROUPS = [
  {
    label: "Transações & Finanças",
    icon: CreditCard,
    rows: [
      { label: "Transações por mês", starter: "200", personal: "Ilimitadas", team: "Ilimitadas" },
      { label: "Cartões de crédito", starter: "1", personal: "Ilimitados", team: "Ilimitados" },
      { label: "Metas financeiras", starter: "2", personal: "Ilimitadas", team: "Ilimitadas" },
      { label: "Contas recorrentes", starter: true, personal: true, team: true },
      { label: "Receitas recorrentes", starter: true, personal: true, team: true },
    ],
  },
  {
    label: "Inteligência Artificial",
    icon: Zap,
    rows: [
      { label: "Capturas com IA", starter: "30/mês", personal: "Ilimitadas", team: "Ilimitadas" },
      { label: "Chat com AXIS AI", starter: "10 msgs/mês", personal: "Ilimitado", team: "Ilimitado" },
      { label: "Transcrição de voz", starter: false, personal: true, team: true },
      { label: "Análise de comprovantes (foto)", starter: "10/mês", personal: "Ilimitada", team: "Ilimitada" },
      { label: "Importação de extratos (PDF)", starter: "3/mês", personal: "Ilimitada", team: "Ilimitada" },
    ],
  },
  {
    label: "WhatsApp",
    icon: MessageCircle,
    rows: [
      { label: "Comandos por texto", starter: true, personal: true, team: true },
      { label: "Envio de fotos de comprovante", starter: "10/mês", personal: "Ilimitado", team: "Ilimitado" },
      { label: "Envio de extratos PDF", starter: "3/mês", personal: "Ilimitado", team: "Ilimitado" },
      { label: "Gravação de áudio", starter: false, personal: true, team: true },
    ],
  },
  {
    label: "Hábitos & Produtividade",
    icon: Repeat,
    rows: [
      { label: "Hábitos ativos", starter: "5", personal: "Ilimitados", team: "Ilimitados" },
      { label: "Tarefas pessoais", starter: true, personal: true, team: true },
      { label: "Agenda & compromissos", starter: true, personal: true, team: true },
      { label: "Score de disciplina", starter: true, personal: true, team: true },
    ],
  },
  {
    label: "Business & Equipes",
    icon: Building2,
    rows: [
      { label: "Versão Business", starter: false, personal: false, team: true },
      { label: "Múltiplos colaboradores", starter: false, personal: false, team: true },
      { label: "Gestão de despesas corporativas", starter: false, personal: false, team: true },
      { label: "Relatórios de equipe", starter: false, personal: false, team: true },
      { label: "Exportação de dados", starter: false, personal: false, team: true },
      { label: "Suporte prioritário", starter: false, personal: false, team: true },
    ],
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="h-4 w-4 text-green-400 mx-auto" />;
  if (value === false) return <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />;
  return <span className="text-sm text-foreground/80">{value}</span>;
}

export default function PricingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: usageData } = useQuery<any>({
    queryKey: ["/api/billing/usage"],
    enabled: !!user,
  });

  const currentPlan = usageData?.plan || "starter";

  const { data: productsData } = useQuery<any>({
    queryKey: ["/api/billing/products"],
  });

  function getPriceId(planKey: string): string | null {
    if (!productsData?.data) return null;
    const rows: any[] = productsData.data;
    const row = rows.find(r => {
      const meta = r.product_metadata || r.price_metadata || {};
      return meta?.plan === planKey;
    });
    return row?.price_id ?? null;
  }

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const res = await apiRequest("POST", "/api/billing/checkout", { priceId });
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
      else toast({ title: "Erro ao redirecionar para checkout", variant: "destructive" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao iniciar checkout", description: err?.message, variant: "destructive" });
    },
  });

  function handleUpgrade(planKey: string) {
    if (!user) { setLocation("/auth"); return; }
    if (planKey === "starter" || planKey === currentPlan) return;
    const priceId = getPriceId(planKey);
    if (!priceId) {
      toast({ title: "Plano ainda não disponível", description: "Entre em contato com o suporte.", variant: "destructive" });
      return;
    }
    checkoutMutation.mutate(priceId);
  }

  const isLoading = checkoutMutation.isPending;

  return (
    <div className="min-h-screen py-12 px-4" data-testid="page-pricing">
      <title>Planos e preços — AXIS</title>

      <div className="max-w-5xl mx-auto">

        {/* Back link */}
        {user && (
          <Link
            href="/settings?tab=billing"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
            data-testid="link-back-settings"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar para configurações
          </Link>
        )}

        {/* ── Hero ── */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-5"
            style={{ background: `${ACCENT}0.1)`, border: `1px solid ${ACCENT}0.25)`, color: `${ACCENT}1)` }}>
            <Shield className="h-3.5 w-3.5" />
            Sem compromisso · Cancele quando quiser
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Seu copiloto financeiro pessoal
          </h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
            Comece grátis e desbloqueie tudo com IA quando estiver pronto. Cada plano inclui o app completo de finanças e vida.
          </p>
        </div>

        {/* ── Plan cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.id;

            return (
              <div
                key={plan.id}
                className="rounded-2xl p-6 flex flex-col relative"
                style={{
                  background: plan.highlight
                    ? `linear-gradient(145deg, ${ACCENT}0.12) 0%, ${ACCENT}0.04) 100%)`
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${plan.highlight ? `${ACCENT}0.35)` : "rgba(255,255,255,0.07)"}`,
                  boxShadow: plan.highlight ? `0 0 48px ${ACCENT}0.07)` : "none",
                }}
                data-testid={`card-plan-${plan.id}`}
              >
                {/* Badge */}
                {plan.badge && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap"
                    style={
                      plan.highlight
                        ? { background: `${ACCENT}1)`, color: "#0a0a0a" }
                        : { background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "rgb(192,132,252)" }
                    }
                  >
                    {plan.badge}
                  </div>
                )}

                {/* Plan name & icon */}
                <div className="flex items-center gap-2 mb-4 mt-1">
                  <Icon className={`h-5 w-5 ${plan.iconColor}`} />
                  <h2 className="text-base font-semibold">{plan.name}</h2>
                </div>

                {/* Price */}
                <div className="mb-1">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className="text-sm text-muted-foreground ml-1.5">{plan.priceDetail}</span>
                </div>
                {plan.trialNote && (
                  <p className="text-xs font-medium mb-4" style={{ color: `${ACCENT}1)` }}>
                    ✦ {plan.trialNote}
                  </p>
                )}
                {!plan.trialNote && <div className="mb-4" />}

                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{plan.description}</p>

                {/* Key highlights per plan */}
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.id === "starter" && (
                    <>
                      <FeatureItem icon={CreditCard}>200 transações por mês</FeatureItem>
                      <FeatureItem icon={Camera}>30 capturas com IA</FeatureItem>
                      <FeatureItem icon={MessageCircle}>Chat AI com 10 msgs/mês</FeatureItem>
                      <FeatureItem icon={Target}>2 metas financeiras</FeatureItem>
                      <FeatureItem icon={Repeat}>5 hábitos ativos</FeatureItem>
                      <FeatureItem icon={FileText} muted>Sem transcrição de voz</FeatureItem>
                      <FeatureItem icon={Building2} muted>Sem versão Business</FeatureItem>
                    </>
                  )}
                  {plan.id === "personal_ai" && (
                    <>
                      <FeatureItem icon={CreditCard} highlight>Transações ilimitadas</FeatureItem>
                      <FeatureItem icon={Mic} highlight>Transcrição de voz</FeatureItem>
                      <FeatureItem icon={Camera} highlight>Capturas AI ilimitadas</FeatureItem>
                      <FeatureItem icon={MessageCircle} highlight>Chat AI ilimitado</FeatureItem>
                      <FeatureItem icon={Target} highlight>Metas ilimitadas</FeatureItem>
                      <FeatureItem icon={Repeat} highlight>Hábitos ilimitados</FeatureItem>
                      <FeatureItem icon={FileText} highlight>WhatsApp foto & PDF ilimitados</FeatureItem>
                    </>
                  )}
                  {plan.id === "team" && (
                    <>
                      <FeatureItem icon={Zap} highlight>Tudo do Personal AI</FeatureItem>
                      <FeatureItem icon={Building2} highlight>Versão Business completa</FeatureItem>
                      <FeatureItem icon={Users} highlight>Múltiplos colaboradores</FeatureItem>
                      <FeatureItem icon={FileText} highlight>Relatórios de equipe</FeatureItem>
                      <FeatureItem icon={HeadphonesIcon} highlight>Suporte prioritário</FeatureItem>
                    </>
                  )}
                </ul>

                {/* CTA */}
                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : isCurrent ? "secondary" : "outline"}
                  disabled={isCurrent || isLoading}
                  onClick={() => handleUpgrade(plan.id)}
                  data-testid={`button-plan-cta-${plan.id}`}
                  style={
                    plan.highlight && !isCurrent
                      ? { background: `${ACCENT}1)`, color: "#0a0a0a", border: "none" }
                      : {}
                  }
                >
                  {isLoading && checkoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {isCurrent ? "✓ Plano atual" : plan.cta}
                </Button>
              </div>
            );
          })}
        </div>

        {/* ── Feature comparison table ── */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-center mb-8 text-foreground/80">
            Comparação completa de recursos
          </h2>

          {/* Table header */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Column headers */}
            <div className="grid grid-cols-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="p-4">Recurso</div>
              <div className="p-4 text-center">Starter</div>
              <div className="p-4 text-center" style={{ color: `${ACCENT}1)` }}>Personal AI</div>
              <div className="p-4 text-center text-purple-400">Team</div>
            </div>

            {/* Feature groups */}
            {FEATURE_GROUPS.map((group, gi) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.label}>
                  {/* Group header */}
                  <div
                    className="grid grid-cols-4 items-center py-2.5 px-4"
                    style={{
                      background: "rgba(255,255,255,0.025)",
                      borderTop: gi > 0 ? "1px solid rgba(255,255,255,0.07)" : undefined,
                    }}
                  >
                    <div className="col-span-4 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <GroupIcon className="h-3.5 w-3.5" />
                      {group.label}
                    </div>
                  </div>

                  {/* Rows */}
                  {group.rows.map((row, ri) => (
                    <div
                      key={row.label}
                      className="grid grid-cols-4 items-center py-3 px-4 text-sm transition-colors hover:bg-white/[0.015]"
                      style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                    >
                      <div className="text-foreground/75">{row.label}</div>
                      <div className="text-center"><CellValue value={row.starter} /></div>
                      <div className="text-center"><CellValue value={row.personal} /></div>
                      <div className="text-center"><CellValue value={row.team} /></div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── FAQ / Trust ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Shield, title: "Pagamento seguro", desc: "Processado pelo Stripe com criptografia de ponta a ponta." },
            { icon: X, title: "Cancele quando quiser", desc: "Sem multa e sem burocracia. Você controla sua assinatura." },
            { icon: Zap, title: "Ativação instantânea", desc: "Seu plano é liberado imediatamente após o pagamento." },
          ].map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.title} className="flex items-start gap-3 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="mt-0.5 p-1.5 rounded-lg" style={{ background: `${ACCENT}0.1)` }}>
                  <ItemIcon className="h-4 w-4" style={{ color: `${ACCENT}1)` }} />
                </div>
                <div>
                  <p className="text-sm font-medium mb-0.5">{item.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Dúvidas? Fale com a gente pelo WhatsApp ou pelo chat do app.
        </p>
      </div>
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  children,
  highlight,
  muted,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <li className={`flex items-center gap-2.5 text-sm ${muted ? "opacity-35" : ""}`}>
      <span
        className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center"
        style={
          highlight
            ? { background: "rgba(122,158,138,0.15)" }
            : muted
              ? { background: "rgba(255,255,255,0.04)" }
              : { background: "rgba(255,255,255,0.06)" }
        }
      >
        {muted
          ? <X className="h-3 w-3 text-muted-foreground" />
          : <Icon className="h-3 w-3" style={highlight ? { color: "rgba(122,158,138,1)" } : { color: "rgba(255,255,255,0.6)" }} />
        }
      </span>
      <span className={highlight ? "text-foreground/90" : "text-foreground/70"}>{children}</span>
    </li>
  );
}
