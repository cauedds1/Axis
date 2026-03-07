import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBusinessTheme, type BusinessTheme, getBusinessPrimaryHex, isCorporateTheme } from "@/components/theme-provider";
import { BusinessThemeSelector } from "@/components/business-theme-selector";
import { Palette, Building2, User, Loader2, Check } from "lucide-react";

type Tab = "aparencia" | "empresa" | "conta";

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: "aparencia", label: "Aparência",  Icon: Palette },
  { id: "empresa",   label: "Empresa",    Icon: Building2 },
  { id: "conta",     label: "Conta",      Icon: User },
];

const SEGMENTS = [
  "Tecnologia e Software","Consultoria e Serviços","Varejo e Comércio",
  "Logística e Transporte","Construção e Engenharia","Saúde e Bem-estar",
  "Educação","Indústria e Manufatura","Agronegócio","Marketing e Publicidade",
  "Alimentação e Hospitalidade","Outro",
];

const inputClass = "w-full px-3 py-2.5 rounded-xl text-sm bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all";
const labelClass = "block text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wide";

export default function BusinessSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("aparencia");
  const { user } = useAuth();
  const { toast } = useToast();
  const { businessTheme, setBusinessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);
  const isExecutive = !isCorporateTheme(businessTheme);

  const { data: orgs } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const org = orgs?.[0];

  const [companyName, setCompanyName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [segment, setSegment] = useState("");
  const [closingDay, setClosingDay] = useState("5");
  const [orgLoaded, setOrgLoaded] = useState(false);

  if (org && !orgLoaded) {
    setCompanyName(org.name ?? "");
    setTradeName(org.tradeName ?? "");
    setSegment(org.segment ?? "");
    setClosingDay(String(org.closingDay ?? 5));
    setOrgLoaded(true);
  }

  const themeMutation = useMutation({
    mutationFn: (theme: string) => apiRequest("PATCH", "/api/user/settings", { theme }),
    onSuccess: () => toast({ title: "Tema salvo" }),
  });

  const orgMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("PATCH", `/api/business/organizations/${org?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations"] });
      toast({ title: "Dados da empresa atualizados" });
    },
  });

  const handleThemeChange = (t: BusinessTheme) => {
    setBusinessTheme(t);
    themeMutation.mutate(t);
  };

  const handleOrgSave = (e: React.FormEvent) => {
    e.preventDefault();
    orgMutation.mutate({
      name: companyName,
      tradeName: tradeName || undefined,
      segment: segment || undefined,
      closingDay: closingDay ? parseInt(closingDay) : undefined,
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize sua experiência no AXIS Business</p>
      </div>

      <div className="flex gap-1 mb-8 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: isActive ? primaryHex + "18" : "transparent",
                color: isActive ? primaryHex : "hsl(var(--muted-foreground))",
                border: isActive ? `1px solid ${primaryHex}25` : "1px solid transparent",
              }}
              data-testid={`tab-${id}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      {activeTab === "aparencia" && (
        <div className="space-y-6">
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: primaryHex + "18", border: `1px solid ${primaryHex}25` }}>
                {isExecutive ? (
                  <span className="text-sm">⚡</span>
                ) : (
                  <span className="text-sm">◾</span>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  Modo {isExecutive ? "Executive" : "Corporate"} ativo
                </p>
                <p className="text-xs text-muted-foreground">
                  {isExecutive
                    ? "Vibrante, com animações e glow. Alto impacto visual."
                    : "Minimalista, sem animações. Foco e clareza profissional."}
                </p>
              </div>
              {themeMutation.isPending && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />
              )}
              {themeMutation.isSuccess && !themeMutation.isPending && (
                <Check className="h-4 w-4 text-emerald-500 ml-auto" />
              )}
            </div>

            <BusinessThemeSelector value={businessTheme} onChange={handleThemeChange} />
          </div>

          <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Prévia do tema</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Receita do mês", value: "R$ 42.800,00", color: "#34D399" },
                { label: "Despesas aprovadas", value: "R$ 18.340,00", color: primaryHex },
                { label: "Aprovações pendentes", value: "7 itens", color: "#F59E0B" },
                { label: "Fluxo previsto", value: "+ R$ 24.460,00", color: "#34D399" },
              ].map((card) => (
                <div
                  key={card.label}
                  className="rounded-xl p-3"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
                  <p className="text-sm font-bold" style={{ color: card.color }}>{card.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "empresa" && (
        <form onSubmit={handleOrgSave} className="space-y-5">
          <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da empresa</p>
            <div>
              <label className={labelClass}>Razão Social <span style={{ color: primaryHex }}>*</span></label>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Empresa Ltda."
                required
                className={inputClass}
                data-testid="input-company-name"
              />
            </div>
            <div>
              <label className={labelClass}>Nome Fantasia</label>
              <input
                value={tradeName}
                onChange={(e) => setTradeName(e.target.value)}
                placeholder="Como a empresa é conhecida"
                className={inputClass}
                data-testid="input-trade-name"
              />
            </div>
            <div>
              <label className={labelClass}>Segmento</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className={inputClass}
                style={{ appearance: "none" }}
                data-testid="select-segment"
              >
                <option value="">Selecione o segmento</option>
                {SEGMENTS.map((s) => (
                  <option key={s} value={s} style={{ background: "#1a1a1f" }}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Dia de Fechamento Mensal</label>
              <select
                value={closingDay}
                onChange={(e) => setClosingDay(e.target.value)}
                className={inputClass}
                style={{ appearance: "none" }}
                data-testid="select-closing-day"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d} style={{ background: "#1a1a1f" }}>Dia {d}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1.5">O AXIS enviará relatórios automáticos neste dia todo mês.</p>
            </div>
          </div>
          <button
            type="submit"
            disabled={orgMutation.isPending || !org}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all text-white"
            style={{ background: `linear-gradient(135deg, ${primaryHex}, ${primaryHex}cc)`, boxShadow: `0 4px 20px ${primaryHex}30` }}
            data-testid="button-save-company"
          >
            {orgMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Salvar alterações</>}
          </button>
        </form>
      )}

      {activeTab === "conta" && (
        <div className="space-y-5">
          <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informações pessoais</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Nome</label>
                <input value={user?.firstName ?? ""} readOnly className={inputClass + " opacity-60 cursor-not-allowed"} />
              </div>
              <div>
                <label className={labelClass}>Sobrenome</label>
                <input value={user?.lastName ?? ""} readOnly className={inputClass + " opacity-60 cursor-not-allowed"} />
              </div>
            </div>
            <div>
              <label className={labelClass}>E-mail</label>
              <input value={user?.email ?? ""} readOnly className={inputClass + " opacity-60 cursor-not-allowed"} />
            </div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: primaryHex + "0d", border: `1px solid ${primaryHex}20` }}>
              <span className="text-xs" style={{ color: primaryHex }}>ℹ</span>
              <p className="text-xs" style={{ color: primaryHex + "cc" }}>
                Para alterar nome, e-mail ou senha, entre em contato com o suporte.
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tipo de conta</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: primaryHex + "18", border: `1px solid ${primaryHex}25` }}>
                <Building2 className="h-4 w-4" style={{ color: primaryHex }} />
              </div>
              <div>
                <p className="text-sm font-medium">AXIS Business</p>
                <p className="text-xs text-muted-foreground">Conta corporativa · {org?.name ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
