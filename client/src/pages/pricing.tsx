import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
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

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="h-4 w-4 text-green-400 mx-auto" />;
  if (value === false) return <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />;
  return <span className="text-sm text-foreground/80">{value}</span>;
}

export default function PricingPage() {
  const { t } = useTranslation();
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

  const ul = t("pricing.unlimited");
  const pm30 = t("pricing.perMo30");
  const pm10m = t("pricing.perMo10msgs");
  const pm10 = t("pricing.perMo10");
  const pm3 = t("pricing.perMo3");

  const PLANS = [
    {
      id: "starter",
      name: "Starter",
      price: t("pricing.forever") === "forever" ? "Free" : "Grátis",
      priceDetail: t("pricing.forever"),
      trialNote: null as string | null,
      description: t("pricing.starterDesc"),
      icon: Star,
      iconColor: "text-muted-foreground",
      highlight: false,
      badge: null as string | null,
      planKey: "starter",
    },
    {
      id: "personal_ai",
      name: "Personal AI",
      price: "$9",
      priceDetail: t("pricing.perMonth"),
      trialNote: t("pricing.trial7"),
      description: t("pricing.personalDesc"),
      icon: Zap,
      iconColor: "text-yellow-400",
      highlight: true,
      badge: t("pricing.mostPopular"),
      planKey: "personal_ai",
    },
    {
      id: "team",
      name: "Team",
      price: "$29",
      priceDetail: t("pricing.perMonth"),
      trialNote: null as string | null,
      description: t("pricing.teamDesc"),
      icon: Users,
      iconColor: "text-purple-400",
      highlight: false,
      badge: t("pricing.businessBadge"),
      planKey: "team",
    },
  ];

  const FEATURE_GROUPS = [
    {
      label: t("pricing.g1"),
      icon: CreditCard,
      rows: [
        { label: t("pricing.g1r1"), starter: "200", personal: ul, team: ul },
        { label: t("pricing.g1r2"), starter: "1", personal: ul, team: ul },
        { label: t("pricing.g1r3"), starter: "2", personal: ul, team: ul },
        { label: t("pricing.g1r4"), starter: true, personal: true, team: true },
        { label: t("pricing.g1r5"), starter: true, personal: true, team: true },
      ],
    },
    {
      label: t("pricing.g2"),
      icon: Zap,
      rows: [
        { label: t("pricing.g2r1"), starter: pm30, personal: ul, team: ul },
        { label: t("pricing.g2r2"), starter: pm10m, personal: ul, team: ul },
        { label: t("pricing.g2r3"), starter: false, personal: true, team: true },
        { label: t("pricing.g2r4"), starter: pm10, personal: ul, team: ul },
        { label: t("pricing.g2r5"), starter: pm3, personal: ul, team: ul },
      ],
    },
    {
      label: t("pricing.g3"),
      icon: MessageCircle,
      rows: [
        { label: t("pricing.g3r1"), starter: true, personal: true, team: true },
        { label: t("pricing.g3r2"), starter: pm10, personal: ul, team: ul },
        { label: t("pricing.g3r3"), starter: pm3, personal: ul, team: ul },
        { label: t("pricing.g3r4"), starter: false, personal: true, team: true },
      ],
    },
    {
      label: t("pricing.g4"),
      icon: Repeat,
      rows: [
        { label: t("pricing.g4r1"), starter: "5", personal: ul, team: ul },
        { label: t("pricing.g4r2"), starter: true, personal: true, team: true },
        { label: t("pricing.g4r3"), starter: true, personal: true, team: true },
        { label: t("pricing.g4r4"), starter: true, personal: true, team: true },
      ],
    },
    {
      label: t("pricing.g5"),
      icon: Building2,
      rows: [
        { label: t("pricing.g5r1"), starter: false, personal: false, team: true },
        { label: t("pricing.g5r2"), starter: false, personal: false, team: true },
        { label: t("pricing.g5r3"), starter: false, personal: false, team: true },
        { label: t("pricing.g5r4"), starter: false, personal: false, team: true },
        { label: t("pricing.g5r5"), starter: false, personal: false, team: true },
        { label: t("pricing.g5r6"), starter: false, personal: false, team: true },
      ],
    },
  ];

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
      else toast({ title: t("pricing.checkoutError"), variant: "destructive" });
    },
    onError: (err: any) => {
      toast({ title: t("pricing.checkoutErrorDesc"), description: err?.message, variant: "destructive" });
    },
  });

  function handleUpgrade(planKey: string) {
    if (!user) { setLocation("/auth"); return; }
    if (planKey === "starter" || planKey === currentPlan) return;
    const priceId = getPriceId(planKey);
    if (!priceId) {
      toast({ title: t("pricing.planNotAvailable"), description: t("pricing.contactSupport"), variant: "destructive" });
      return;
    }
    checkoutMutation.mutate(priceId);
  }

  const isLoading = checkoutMutation.isPending;

  return (
    <div className="min-h-screen py-12 px-4" data-testid="page-pricing">
      <title>{t("pricing.pageTitle")}</title>

      <div className="max-w-5xl mx-auto">

        {/* Back link */}
        {user && (
          <Link
            href="/settings?tab=billing"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
            data-testid="link-back-settings"
          >
            <ArrowLeft className="h-4 w-4" /> {t("pricing.backSettings")}
          </Link>
        )}

        {/* ── Hero ── */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-5"
            style={{ background: `${ACCENT}0.1)`, border: `1px solid ${ACCENT}0.25)`, color: `${ACCENT}1)` }}>
            <Shield className="h-3.5 w-3.5" />
            {t("pricing.trustBadge")}
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">{t("pricing.heroTitle")}</h1>
          <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
            {t("pricing.heroSub")}
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

                <div className="flex items-center gap-2 mb-4 mt-1">
                  <Icon className={`h-5 w-5 ${plan.iconColor}`} />
                  <h2 className="text-base font-semibold">{plan.name}</h2>
                </div>

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

                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.id === "starter" && (
                    <>
                      <FeatureItem icon={CreditCard}>{t("pricing.starterFeatures.f1")}</FeatureItem>
                      <FeatureItem icon={Camera}>{t("pricing.starterFeatures.f2")}</FeatureItem>
                      <FeatureItem icon={MessageCircle}>{t("pricing.starterFeatures.f3")}</FeatureItem>
                      <FeatureItem icon={Target}>{t("pricing.starterFeatures.f4")}</FeatureItem>
                      <FeatureItem icon={Repeat}>{t("pricing.starterFeatures.f5")}</FeatureItem>
                      <FeatureItem icon={FileText} muted>{t("pricing.starterFeatures.f6no")}</FeatureItem>
                      <FeatureItem icon={Building2} muted>{t("pricing.starterFeatures.f7no")}</FeatureItem>
                    </>
                  )}
                  {plan.id === "personal_ai" && (
                    <>
                      <FeatureItem icon={CreditCard} highlight>{t("pricing.personalFeatures.f1")}</FeatureItem>
                      <FeatureItem icon={Mic} highlight>{t("pricing.personalFeatures.f2")}</FeatureItem>
                      <FeatureItem icon={Camera} highlight>{t("pricing.personalFeatures.f3")}</FeatureItem>
                      <FeatureItem icon={MessageCircle} highlight>{t("pricing.personalFeatures.f4")}</FeatureItem>
                      <FeatureItem icon={Target} highlight>{t("pricing.personalFeatures.f5")}</FeatureItem>
                      <FeatureItem icon={Repeat} highlight>{t("pricing.personalFeatures.f6")}</FeatureItem>
                      <FeatureItem icon={FileText} highlight>{t("pricing.personalFeatures.f7")}</FeatureItem>
                    </>
                  )}
                  {plan.id === "team" && (
                    <>
                      <FeatureItem icon={Zap} highlight>{t("pricing.teamFeatures.f1")}</FeatureItem>
                      <FeatureItem icon={Building2} highlight>{t("pricing.teamFeatures.f2")}</FeatureItem>
                      <FeatureItem icon={Users} highlight>{t("pricing.teamFeatures.f3")}</FeatureItem>
                      <FeatureItem icon={FileText} highlight>{t("pricing.teamFeatures.f4")}</FeatureItem>
                      <FeatureItem icon={HeadphonesIcon} highlight>{t("pricing.teamFeatures.f5")}</FeatureItem>
                    </>
                  )}
                </ul>

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
                  {isCurrent
                    ? t("pricing.ctaCurrentPlan")
                    : plan.id === "personal_ai"
                      ? t("pricing.ctaPersonal")
                      : plan.id === "team"
                        ? t("pricing.ctaTeam")
                        : t("pricing.ctaCurrentPlan")}
                </Button>
              </div>
            );
          })}
        </div>

        {/* ── Feature comparison table ── */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-center mb-8 text-foreground/80">
            {t("pricing.comparisonTitle")}
          </h2>

          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="grid grid-cols-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="p-4">Feature</div>
              <div className="p-4 text-center">Starter</div>
              <div className="p-4 text-center" style={{ color: `${ACCENT}1)` }}>Personal AI</div>
              <div className="p-4 text-center text-purple-400">Team</div>
            </div>

            {FEATURE_GROUPS.map((group, gi) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.label}>
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

                  {group.rows.map((row) => (
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

        {/* ── Trust signals ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Shield, title: t("pricing.trustSecureTitle"), desc: t("pricing.trustSecureDesc") },
            { icon: X, title: t("pricing.trustCancelTitle"), desc: t("pricing.trustCancelDesc") },
            { icon: Zap, title: t("pricing.trustInstantTitle"), desc: t("pricing.trustInstantDesc") },
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

        <p className="text-center text-xs text-muted-foreground">{t("pricing.footerNote")}</p>
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
