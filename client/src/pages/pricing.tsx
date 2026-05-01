import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Check, Zap, Users, Star, Loader2, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "Grátis",
    priceDetail: "para sempre",
    description: "Para experimentar o AXIS com recursos básicos.",
    icon: Star,
    iconColor: "text-muted-foreground",
    highlight: false,
    features: [
      "200 transações/mês",
      "30 capturas AI/mês",
      "10 fotos WhatsApp/mês",
      "3 PDFs WhatsApp/mês",
      "10 msgs de chat/mês",
      "1 cartão de crédito",
      "2 metas financeiras",
      "5 hábitos",
      "WhatsApp texto ilimitado",
    ],
    missing: ["Transcrição de voz", "Versão Business"],
    cta: "Plano atual",
    planKey: "starter",
  },
  {
    id: "personal_ai",
    name: "Personal AI",
    price: "R$9",
    priceDetail: "/mês · 7 dias grátis",
    description: "Para uso pessoal completo com IA sem limites.",
    icon: Zap,
    iconColor: "text-yellow-400",
    highlight: true,
    features: [
      "Transações ilimitadas",
      "Capturas AI ilimitadas",
      "Fotos WhatsApp ilimitadas",
      "PDFs WhatsApp ilimitados",
      "Chat ilimitado",
      "Cartões ilimitados",
      "Metas ilimitadas",
      "Hábitos ilimitados",
      "Transcrição de voz",
      "WhatsApp texto ilimitado",
    ],
    missing: ["Versão Business"],
    cta: "Começar trial de 7 dias",
    planKey: "personal_ai",
  },
  {
    id: "team",
    name: "Team",
    price: "R$29",
    priceDetail: "/mês",
    description: "Para empresas e equipes que precisam do AXIS Business.",
    icon: Users,
    iconColor: "text-purple-400",
    highlight: false,
    features: [
      "Tudo do Personal AI",
      "Versão Business completa",
      "Múltiplos colaboradores",
      "Relatórios de equipe",
      "Exportação de dados",
      "Suporte prioritário",
    ],
    missing: [],
    cta: "Assinar Team",
    planKey: "team",
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: usageData } = useQuery<any>({
    queryKey: ["/api/billing/usage"],
    enabled: !!user,
  });

  const currentPlan = usageData?.plan || "starter";

  const { data: productsData, isLoading: isLoadingProducts } = useQuery<any>({
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

  return (
    <div className="min-h-screen py-12 px-4" data-testid="page-pricing">
      <title>Planos e preços — AXIS</title>

      <div className="max-w-5xl mx-auto">
        {/* Back link */}
        {user && (
          <Link href="/settings?tab=billing" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors" data-testid="link-back-settings">
            <ArrowLeft className="h-4 w-4" /> Voltar para configurações
          </Link>
        )}

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight mb-3">Escolha seu plano</h1>
          <p className="text-muted-foreground text-base max-w-md mx-auto">
            Comece grátis e faça upgrade quando quiser. Sem compromisso.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = currentPlan === plan.id;
            const isLoading = checkoutMutation.isPending;

            return (
              <div
                key={plan.id}
                className="rounded-2xl p-6 flex flex-col relative"
                style={{
                  background: plan.highlight
                    ? "linear-gradient(135deg, rgba(122,158,138,0.15) 0%, rgba(122,158,138,0.05) 100%)"
                    : "rgba(255,255,255,0.02)",
                  border: `1px solid ${plan.highlight ? "rgba(122,158,138,0.4)" : "rgba(255,255,255,0.07)"}`,
                  boxShadow: plan.highlight ? "0 0 40px rgba(122,158,138,0.08)" : "none",
                }}
                data-testid={`card-plan-${plan.id}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                    Mais popular
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`h-5 w-5 ${plan.iconColor}`} />
                  <h2 className="text-base font-semibold">{plan.name}</h2>
                </div>

                <div className="mb-4">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground ml-1">{plan.priceDetail}</span>
                </div>

                <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.missing.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm opacity-40">
                      <X className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.highlight ? "default" : isCurrent ? "secondary" : "outline"}
                  disabled={isCurrent || isLoading}
                  onClick={() => handleUpgrade(plan.id)}
                  data-testid={`button-plan-cta-${plan.id}`}
                >
                  {isLoading && checkoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {isCurrent ? "Plano atual" : plan.cta}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          Pagamentos processados com segurança pelo Stripe. Cancele a qualquer momento.
        </p>
      </div>
    </div>
  );
}
