import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useBusinessTheme, type BusinessTheme, getBusinessPrimaryHex, isCorporateTheme } from "@/components/theme-provider";
import { BusinessThemeSelector } from "@/components/business-theme-selector";
import { Palette, Building2, User, Loader2, Check, Tag, Plus, Trash2, Upload, X, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Tab = "aparencia" | "empresa" | "conta" | "categorias";

const TABS: { id: Tab; label: string; Icon: any }[] = [
  { id: "aparencia",   label: "Aparência",  Icon: Palette },
  { id: "empresa",     label: "Empresa",    Icon: Building2 },
  { id: "conta",       label: "Conta",      Icon: User },
  { id: "categorias",  label: "Categorias", Icon: Tag },
];

const SEGMENTS = [
  "Tecnologia e Software","Consultoria e Serviços","Varejo e Comércio",
  "Logística e Transporte","Construção e Engenharia","Saúde e Bem-estar",
  "Educação","Indústria e Manufatura","Agronegócio","Marketing e Publicidade",
  "Alimentação e Hospitalidade","Outro",
];

const DEFAULT_CATEGORIES = [
  { name: "Alimentação",    icon: "🍽️" },
  { name: "Transporte",     icon: "🚗" },
  { name: "Hospedagem",     icon: "🏨" },
  { name: "Combustível",    icon: "⛽" },
  { name: "Estacionamento", icon: "🅿️" },
  { name: "Entretenimento", icon: "🎭" },
  { name: "Material",       icon: "📦" },
  { name: "Outros",         icon: "📋" },
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

  const [spendingLimits, setSpendingLimits] = useState<Record<string, string>>({});
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [limitsLoaded, setLimitsLoaded] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#3B82F6");
  const logoInputRef = useRef<HTMLInputElement>(null);

  if (org && !orgLoaded) {
    setCompanyName(org.name ?? "");
    setTradeName(org.tradeName ?? "");
    setSegment(org.segment ?? "");
    setClosingDay(String(org.closingDay ?? 5));
    setPrimaryColor(org.primaryColor ?? "#3B82F6");
    setLogoPreview(org.logoUrl ?? org.logoBase64 ?? null);
    setOrgLoaded(true);
  }

  useEffect(() => {
    if (org && !limitsLoaded) {
      try {
        const parsed = org.spendingLimits ? JSON.parse(org.spendingLimits) : {};
        const stringified: Record<string, string> = {};
        Object.entries(parsed).forEach(([k, v]) => { stringified[k] = String(v); });
        setSpendingLimits(stringified);
      } catch {}
      const stored = localStorage.getItem(`custom-categories-${org.id}`);
      if (stored) { try { setCustomCategories(JSON.parse(stored)); } catch {} }
      setLimitsLoaded(true);
    }
  }, [org, limitsLoaded]);

  const [themeSaved, setThemeSaved] = useState(false);

  const orgMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", `/api/business/organizations/${org?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations"] });
      toast({ title: "Dados da empresa atualizados" });
    },
  });

  const limitsMutation = useMutation({
    mutationFn: (limits: Record<string, number>) =>
      apiRequest("PATCH", `/api/business/organizations/${org?.id}`, {
        spendingLimits: JSON.stringify(limits),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations"] });
      toast({ title: "Limites de gastos salvos!" });
    },
  });

  const handleThemeChange = (t: BusinessTheme) => {
    setBusinessTheme(t);
    setThemeSaved(true);
    setTimeout(() => setThemeSaved(false), 2000);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Imagem muito grande", description: "O logo deve ter menos de 2MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const b64 = ev.target?.result as string;
      setLogoBase64(b64);
      setLogoPreview(b64);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoBase64(null);
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = "";
    orgMutation.mutate({ logoUrl: null, logoBase64: null } as any);
  };

  const handleOrgSave = (e: React.FormEvent) => {
    e.preventDefault();
    orgMutation.mutate({
      name: companyName,
      tradeName: tradeName || undefined,
      segment: segment || undefined,
      closingDay: closingDay ? parseInt(closingDay) : undefined,
      primaryColor: primaryColor || undefined,
      logoBase64: logoBase64 || undefined,
    });
  };

  const handleSaveLimits = () => {
    const parsed: Record<string, number> = {};
    Object.entries(spendingLimits).forEach(([k, v]) => {
      const num = parseFloat(v.replace(",", "."));
      if (!isNaN(num) && num > 0) parsed[k] = num;
    });
    limitsMutation.mutate(parsed);
  };

  const handleAddCustomCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed || customCategories.includes(trimmed)) return;
    const updated = [...customCategories, trimmed];
    setCustomCategories(updated);
    if (org?.id) localStorage.setItem(`custom-categories-${org.id}`, JSON.stringify(updated));
    setNewCategory("");
  };

  const handleRemoveCustomCategory = (cat: string) => {
    const updated = customCategories.filter(c => c !== cat);
    setCustomCategories(updated);
    if (org?.id) localStorage.setItem(`custom-categories-${org.id}`, JSON.stringify(updated));
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Configurações</h1>
        <p className="text-sm text-muted-foreground">Personalize sua experiência no AXIS Business</p>
      </div>

      <div className="flex gap-1 mb-8 p-1 rounded-xl flex-wrap" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-medium transition-all duration-200 min-w-[80px]"
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
                {isExecutive ? <span className="text-sm">⚡</span> : <span className="text-sm">◾</span>}
              </div>
              <div>
                <p className="text-sm font-semibold">Modo {isExecutive ? "Executive" : "Corporate"} ativo</p>
                <p className="text-xs text-muted-foreground">
                  {isExecutive ? "Vibrante, com animações e glow. Alto impacto visual." : "Minimalista, sem animações. Foco e clareza profissional."}
                </p>
              </div>
              {themeSaved && <Check className="h-4 w-4 text-emerald-500 ml-auto" />}
            </div>
            <BusinessThemeSelector value={businessTheme} onChange={handleThemeChange} />
          </div>

          <div className="rounded-2xl p-5 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Prévia do tema</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Total do mês", value: "R$ 18.340,00", color: primaryHex },
                { label: "Aprovadas", value: "R$ 12.890,00", color: "#34D399" },
                { label: "Aprovações pendentes", value: "7 itens", color: "#F59E0B" },
                { label: "Rejeitadas", value: "3 itens", color: "#F87171" },
              ].map((card) => (
                <div key={card.label} className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
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

          <div className="rounded-2xl p-5 space-y-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Identidade Visual</p>

            <div>
              <label className={labelClass}>Logo da empresa</label>
              <p className="text-xs text-muted-foreground mb-3">Aparece nos relatórios compartilhados. PNG, JPG ou WebP — máx. 2MB.</p>
              <div className="flex items-start gap-4">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.04)", border: "2px dashed rgba(255,255,255,0.12)" }}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleLogoChange}
                    data-testid="input-logo-file"
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                    style={{ background: primaryHex + "18", color: primaryHex, border: `1px solid ${primaryHex}30` }}
                    data-testid="button-upload-logo"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {logoPreview ? "Trocar logo" : "Enviar logo"}
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all text-muted-foreground hover:text-red-400"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                      data-testid="button-remove-logo"
                    >
                      <X className="w-3.5 h-3.5" />
                      Remover logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className={labelClass}>Cor principal da marca</label>
              <p className="text-xs text-muted-foreground mb-3">Usada nos relatórios públicos para representar a identidade visual da empresa.</p>
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 flex-shrink-0 cursor-pointer" style={{ background: primaryColor }}>
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    data-testid="input-primary-color"
                  />
                </div>
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setPrimaryColor(v);
                  }}
                  placeholder="#3B82F6"
                  className={inputClass + " font-mono flex-1"}
                  style={{ maxWidth: 140 }}
                  data-testid="input-primary-color-hex"
                />
                <div className="flex gap-2 flex-wrap">
                  {["#3B82F6","#6366F1","#8B5CF6","#EC4899","#F59E0B","#10B981","#06B6D4","#EF4444"].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPrimaryColor(c)}
                      className="w-6 h-6 rounded-lg transition-all hover:scale-110"
                      style={{ background: c, border: primaryColor === c ? "2px solid white" : "2px solid transparent" }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados da empresa</p>
            <div>
              <label className={labelClass}>Razão Social <span style={{ color: primaryHex }}>*</span></label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Empresa Ltda." required className={inputClass} data-testid="input-company-name" />
            </div>
            <div>
              <label className={labelClass}>Nome Fantasia</label>
              <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Como a empresa é conhecida" className={inputClass} data-testid="input-trade-name" />
            </div>
            <div>
              <label className={labelClass}>Segmento</label>
              <select value={segment} onChange={(e) => setSegment(e.target.value)} className={inputClass} style={{ appearance: "none" }} data-testid="select-segment">
                <option value="">Selecione o segmento</option>
                {SEGMENTS.map((s) => <option key={s} value={s} style={{ background: "#1a1a1f" }}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Dia de Fechamento Mensal</label>
              <select value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className={inputClass} style={{ appearance: "none" }} data-testid="select-closing-day">
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
              <div><label className={labelClass}>Nome</label><input value={user?.firstName ?? ""} readOnly className={inputClass + " opacity-60 cursor-not-allowed"} /></div>
              <div><label className={labelClass}>Sobrenome</label><input value={user?.lastName ?? ""} readOnly className={inputClass + " opacity-60 cursor-not-allowed"} /></div>
            </div>
            <div><label className={labelClass}>E-mail</label><input value={user?.email ?? ""} readOnly className={inputClass + " opacity-60 cursor-not-allowed"} /></div>
            <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ background: primaryHex + "0d", border: `1px solid ${primaryHex}20` }}>
              <span className="text-xs" style={{ color: primaryHex }}>ℹ</span>
              <p className="text-xs" style={{ color: primaryHex + "cc" }}>Para alterar nome, e-mail ou senha, entre em contato com o suporte.</p>
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

      {activeTab === "categorias" && (
        <div className="space-y-6">
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Limites de gasto por categoria</p>
            <p className="text-xs text-muted-foreground mb-4">Defina um valor máximo em R$ por despesa. Itens acima do limite serão marcados com um aviso.</p>
            <div className="flex flex-col gap-3">
              {DEFAULT_CATEGORIES.map(({ name, icon }) => (
                <div key={name} className="flex items-center gap-3" data-testid={`row-category-limit-${name}`}>
                  <span className="text-lg w-7 text-center">{icon}</span>
                  <span className="text-sm text-foreground flex-1">{name}</span>
                  <Badge className="text-[9px] py-0" style={{ background: "rgba(255,255,255,0.05)", color: "hsl(var(--muted-foreground))", border: "1px solid rgba(255,255,255,0.08)" }}>Padrão</Badge>
                  <div className="flex items-center gap-1 w-32">
                    <span className="text-xs text-muted-foreground">R$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Sem limite"
                      value={spendingLimits[name] ?? ""}
                      onChange={e => setSpendingLimits(prev => ({ ...prev, [name]: e.target.value }))}
                      className="w-full px-2 py-1.5 rounded-lg text-xs bg-white/[0.04] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 transition-all text-right"
                      style={{ focusRingColor: primaryHex }}
                      data-testid={`input-limit-${name}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handleSaveLimits}
              disabled={limitsMutation.isPending || !org}
              className="mt-5 w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all text-white"
              style={{ background: `linear-gradient(135deg, ${primaryHex}, ${primaryHex}cc)` }}
              data-testid="button-save-limits"
            >
              {limitsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4" />Salvar limites</>}
            </button>
          </div>

          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Categorias personalizadas</p>
            <p className="text-xs text-muted-foreground mb-4">Categorias adicionais para a sua empresa (salvas localmente).</p>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="Ex: Marketing, Jurídico..."
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddCustomCategory()}
                className="text-xs h-9"
                data-testid="input-new-category"
              />
              <button
                onClick={handleAddCustomCategory}
                disabled={!newCategory.trim()}
                className="px-3 py-2 rounded-xl text-xs font-medium text-white disabled:opacity-40 flex-shrink-0"
                style={{ background: primaryHex }}
                data-testid="button-add-category"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {customCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 text-center py-3">Nenhuma categoria personalizada ainda.</p>
              ) : customCategories.map(cat => (
                <div key={cat} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }} data-testid={`row-custom-category-${cat}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{cat}</span>
                    <Badge className="text-[9px] py-0" style={{ background: `${primaryHex}12`, color: primaryHex, border: `1px solid ${primaryHex}20` }}>Personalizada</Badge>
                  </div>
                  <button onClick={() => handleRemoveCustomCategory(cat)} className="text-muted-foreground hover:text-red-400 transition-colors" data-testid={`button-remove-category-${cat}`}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
