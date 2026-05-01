import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, Wifi, WifiOff, QrCode, MessageCircle, Check, RefreshCw, UserCog, ExternalLink, Trash2, TriangleAlert, Palette, LayoutGrid, Smartphone, Lock, CreditCard, Zap, Users, Star } from "lucide-react";
import { SUPPORTED_CURRENCIES, getCurrencyName } from "@/lib/currencies";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ThemeSelector } from "@/components/theme-toggle";
import { useTheme, type AxisTheme, getModulePalette } from "@/components/theme-provider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SetupSheet } from "@/components/setup-sheet";

function formatBotPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length === 13) return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.startsWith("55") && d.length === 12) return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
}

type SettingsTab = "aparencia" | "modulos" | "cadastro" | "whatsapp" | "billing" | "conta";

function getTabs(t: (k: string) => string): { id: SettingsTab; label: string; Icon: any }[] {
  return [
    { id: "aparencia",  label: t("axisSettings.tabAppearance"), Icon: Palette },
    { id: "modulos",   label: t("axisSettings.tabModules"),    Icon: LayoutGrid },
    { id: "cadastro",  label: t("axisSettings.tabProfile"),    Icon: UserCog },
    { id: "whatsapp",  label: "WhatsApp",                      Icon: Smartphone },
    { id: "billing",   label: "Assinatura",                    Icon: CreditCard },
    { id: "conta",     label: t("axisSettings.tabAccount"),    Icon: TriangleAlert },
  ];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{children}</p>;
}

function Block({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{
        background: danger ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${danger ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"}`,
      }}
    >
      {children}
    </div>
  );
}

function CurrencyPicker({ profile }: { profile: any }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string>("");
  const [search, setSearch] = useState("");

  const isLocked = !!profile?.currencySetAt;
  const currentCode = profile?.currency || "BRL";
  const currentName = getCurrencyName(currentCode);

  const filtered = SUPPORTED_CURRENCIES.filter(
    c => c.code.toLowerCase().includes(search.toLowerCase()) || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const currencyMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await apiRequest("PATCH", "/api/user/currency", { currency: code });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({ title: t("axisSettings.currencySaved") });
    },
    onError: () => toast({ title: t("axisSettings.currencyError"), variant: "destructive" }),
  });

  if (isLocked) {
    return (
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}
        data-testid="currency-locked-display"
      >
        <Lock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">{currentCode}</p>
          <p className="text-xs text-muted-foreground">{currentName}</p>
        </div>
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{t("axisSettings.currencyLocked")}</span>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="currency-picker">
      <Select value={selected || currentCode} onValueChange={setSelected}>
        <SelectTrigger data-testid="select-currency">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <div className="px-2 py-1.5 sticky top-0 bg-popover border-b border-border">
            <input
              placeholder={t("axisSettings.currencySearch")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              data-testid="input-currency-search"
            />
          </div>
          {filtered.map(c => (
            <SelectItem key={c.code} value={c.code}>
              <span className="font-mono text-xs mr-2 text-muted-foreground">{c.symbol}</span>
              {c.code} — {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        className="w-full"
        onClick={() => currencyMutation.mutate(selected || currentCode)}
        disabled={currencyMutation.isPending}
        data-testid="button-save-currency"
      >
        {currencyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
        {t("axisSettings.currencySave")}
      </Button>
    </div>
  );
}

function WhatsAppTab() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const MP = getModulePalette(theme as any);
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [phoneSaved, setPhoneSaved] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const { data: profile } = useQuery<any>({ queryKey: ["/api/user/profile"] });
  useEffect(() => {
    const saved = profile?.profile?.whatsappPhone;
    if (saved && !phone) setPhone(saved);
  }, [profile]);

  const { data: status, refetch } = useQuery<{ status: string; qrCode?: string; phone?: string }>({
    queryKey: ["/api/whatsapp/status"],
    refetchInterval: (data: any) => (data?.status === "qr_pending" ? 3000 : false),
  });

  const connectMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/connect"),
    onSuccess: () => setTimeout(() => refetch(), 1500),
    onError: () => toast({ title: t("axisSettings.waConnectError"), variant: "destructive" }),
  });
  const unlinkMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/user/whatsapp-phone", { phone: "" }),
    onSuccess: () => {
      setPhone("");
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({ title: t("axisSettings.waUnlinked") });
    },
    onError: () => toast({ title: t("axisSettings.waUnlinkError"), variant: "destructive" }),
  });
  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/reset"),
    onSuccess: () => { toast({ title: t("axisSettings.waGeneratingQR") }); setTimeout(() => refetch(), 1200); },
    onError: () => toast({ title: t("axisSettings.waQRError"), variant: "destructive" }),
  });
  const phoneMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/user/whatsapp-phone", { phone }),
    onSuccess: () => {
      setPhoneSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/status"] });
      toast({ title: t("axisSettings.waLinked") });
      setTimeout(() => setPhoneSaved(false), 2500);
    },
    onError: () => toast({ title: t("axisSettings.waSaveError"), variant: "destructive" }),
  });

  const wStatus = status?.status || "disconnected";
  const botPhoneDigits = (status?.phone || "").replace(/\D/g, "");
  const statusMap: Record<string, { label: string; color: string; Icon: any }> = {
    disconnected: { label: t("axisSettings.waDisconnected"), color: MP.negative, Icon: WifiOff },
    qr_pending:   { label: t("axisSettings.waQRPending"),    color: MP.agenda,   Icon: QrCode },
    connected:    { label: t("axisSettings.waConnected"),    color: MP.positive,  Icon: Wifi },
  };
  const { label, color, Icon } = statusMap[wStatus] ?? statusMap.disconnected;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("axisSettings.waDesc")}
      </p>

      {/* Status */}
      <Block>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" style={{ color }} />
            <div>
              <p className="text-sm font-semibold">{label}</p>
              {wStatus === "connected" && status?.phone && (
                <p className="text-[11px] font-medium" style={{ color: MP.positive }}>
                  {t("axisSettings.waBotConnectedAt", { phone: formatBotPhone(status.phone) })}
                </p>
              )}
            </div>
          </div>
          {wStatus === "connected" ? (
            <div className="flex items-center gap-2">
              {botPhoneDigits && (
                <a
                  href={`https://wa.me/${botPhoneDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                  style={{ color: MP.positive, borderColor: `${MP.positive}4D`, background: `${MP.positive}14` }}
                  data-testid="button-whatsapp-open-chat"
                >
                  <ExternalLink className="h-3 w-3" /> {t("axisSettings.waOpenChat")}
                </a>
              )}
              <button
                onClick={() => setConfirmDisconnect(true)}
                disabled={unlinkMutation.isPending}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                style={{ color: MP.negative, borderColor: `${MP.negative}4D`, background: `${MP.negative}14` }}
                data-testid="button-whatsapp-disconnect"
              >
                {unlinkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("axisSettings.waDisconnectBtn")}
              </button>
            </div>
          ) : wStatus === "disconnected" ? (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ color: MP.positive, borderColor: `${MP.positive}4D`, background: `${MP.positive}14` }}
              data-testid="button-whatsapp-connect"
            >
              {connectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : t("axisSettings.waConnectBtn")}
            </button>
          ) : null}
        </div>
      </Block>

      {/* QR pending */}
      {wStatus === "qr_pending" && status?.qrCode && (
        <Block>
          <p className="text-xs text-muted-foreground text-center">{t("axisSettings.waScanQR")}</p>
          <div className="flex justify-center">
            <img src={status.qrCode} alt="QR Code WhatsApp" className="w-48 h-48 rounded-xl" data-testid="img-whatsapp-qr" />
          </div>
          <div className="flex items-center gap-3 justify-center">
            <p className="text-[10px] text-muted-foreground">{t("axisSettings.waQRExpires")}</p>
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
              style={{ color: MP.agenda, borderColor: `${MP.agenda}4D`, background: `${MP.agenda}14` }}
              data-testid="button-whatsapp-new-qr"
            >
              {resetMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              {t("axisSettings.waNewQR")}
            </button>
          </div>
        </Block>
      )}
      {wStatus === "qr_pending" && !status?.qrCode && (
        <Block>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{t("axisSettings.waGeneratingQRLabel")}</span>
            </div>
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
              style={{ color: MP.agenda, borderColor: `${MP.agenda}4D`, background: `${MP.agenda}14` }}
              data-testid="button-whatsapp-new-qr-fallback"
            >
              <RefreshCw className="h-3 w-3" /> {t("axisSettings.waRetry")}
            </button>
          </div>
        </Block>
      )}

      {/* Phone number */}
      <Block>
        <SectionLabel>{t("axisSettings.waYourNumber")}</SectionLabel>
        <p className="text-xs text-muted-foreground">{t("axisSettings.waYourNumberDesc")}</p>
        {wStatus === "connected" && !profile?.profile?.whatsappPhone && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", color: "#eab308" }}
            data-testid="alert-whatsapp-no-phone"
          >
            <span>⚠ {t("axisSettings.waNoNumber")}</span>
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+55 11 99999-9999"
            className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
            data-testid="input-whatsapp-phone"
          />
          <button
            onClick={() => phoneMutation.mutate()}
            disabled={phoneMutation.isPending || !phone.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-border transition-all disabled:opacity-40"
            style={phoneSaved ? { color: MP.positive, borderColor: `${MP.positive}4D`, background: `${MP.positive}14` } : {}}
            data-testid="button-save-whatsapp-phone"
          >
            {phoneMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : phoneSaved ? <Check className="h-4 w-4" /> : t("axisSettings.save")}
          </button>
        </div>
      </Block>

      {/* Examples */}
      <Block>
        <SectionLabel>{t("axisSettings.waExamples")}</SectionLabel>
        <div className="space-y-1.5">
          {(t("axisSettings.waExamplesList", { returnObjects: true }) as string[]).map((ex: string) => (
            <div key={ex} className="flex items-start gap-2">
              <MessageCircle className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-xs text-muted-foreground italic">"{ex}"</span>
            </div>
          ))}
        </div>
      </Block>

      <AlertDialog open={confirmDisconnect} onOpenChange={setConfirmDisconnect}>
        <AlertDialogContent data-testid="dialog-confirm-whatsapp-disconnect">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("axisSettings.waUnlinkTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("axisSettings.waUnlinkDialogDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-whatsapp-disconnect">{t("axisSettings.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setConfirmDisconnect(false); unlinkMutation.mutate(); }}
              data-testid="button-confirm-whatsapp-disconnect"
            >
              {t("axisSettings.waUnlinkBtn")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const TABS = getTabs(t);
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "billing") return "billing";
    return "aparencia";
  });
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("billing") === "success") {
      toast({ title: "Assinatura ativada com sucesso!", description: "Bem-vindo ao AXIS Premium." });
      window.history.replaceState({}, "", "/settings?tab=billing");
      setActiveTab("billing");
    }
  }, []);

  const { data: userData } = useQuery<any>({ queryKey: ["/api/user/profile"] });

  const { data: billingUsage, isLoading: isLoadingUsage } = useQuery<any>({
    queryKey: ["/api/billing/usage"],
    enabled: activeTab === "billing",
    refetchOnWindowFocus: true,
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal");
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.url) window.location.href = data.url;
    },
    onError: (err: any) => toast({ title: "Erro ao abrir portal de cobrança", description: err?.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/user/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: t("axisSettings.saved") });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/user/reset-data"),
    onSuccess: () => {
      queryClient.clear();
      toast({ title: t("axisSettings.resetSuccess"), description: t("axisSettings.resetSuccessDesc") });
    },
    onError: () => toast({ title: t("axisSettings.resetError"), variant: "destructive" }),
  });

  const handleThemeChange = (thm: AxisTheme) => {
    setTheme(thm);
    updateMutation.mutate({ theme: thm });
  };

  const handlePersonalityChange = (p: string) => {
    updateMutation.mutate({ aiPersonality: p });
  };

  const moduleList = ["finance", "schedule", "tasks", "habits"];
  const moduleLabels: Record<string, string> = {
    finance: t("axisSettings.moduleFinance"),
    schedule: t("axisSettings.moduleSchedule"),
    tasks: t("axisSettings.moduleTasks"),
    habits: t("axisSettings.moduleHabits"),
  };
  const moduleDescs: Record<string, string> = {
    finance: t("axisSettings.moduleFinanceDesc"),
    schedule: t("axisSettings.moduleScheduleDesc"),
    tasks: t("axisSettings.moduleTasksDesc"),
    habits: t("axisSettings.moduleHabitsDesc"),
  };
  const currentModules: string[] = userData?.user?.activeModules || [];

  const toggleModule = (mod: string) => {
    const updated = currentModules.includes(mod)
      ? currentModules.filter(m => m !== mod)
      : [...currentModules, mod];
    updateMutation.mutate({ activeModules: updated });
  };

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] overflow-hidden" data-testid="page-settings">
      <title>{t("axisSettings.pageTitle")}</title>

      {/* Desktop Sidebar */}
      <div
        className="hidden md:flex w-48 flex-shrink-0 border-r border-border flex-col py-4 px-2 gap-1"
        style={{ background: "rgba(255,255,255,0.01)" }}
      >
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">{t("axisSettings.sectionLabel")}</p>
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          const isDanger = id === "conta";
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
              style={{
                background: active
                  ? isDanger ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.07)"
                  : "transparent",
                color: active
                  ? isDanger ? "rgb(239,68,68)" : "hsl(var(--foreground))"
                  : isDanger ? "rgba(239,68,68,0.7)" : "hsl(var(--muted-foreground))",
              }}
              data-testid={`tab-settings-${id}`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Mobile Tab Bar */}
      <div className="flex md:hidden overflow-x-auto border-b border-border flex-shrink-0" style={{ background: "rgba(255,255,255,0.01)" }}>
        {TABS.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          const isDanger = id === "conta";
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="flex flex-col items-center gap-1 px-4 py-3 text-[10px] font-semibold flex-shrink-0 transition-colors border-b-2"
              style={{
                borderBottomColor: active ? (isDanger ? "rgb(239,68,68)" : "hsl(var(--primary))") : "transparent",
                color: active
                  ? isDanger ? "rgb(239,68,68)" : "hsl(var(--foreground))"
                  : isDanger ? "rgba(239,68,68,0.6)" : "hsl(var(--muted-foreground))",
              }}
              data-testid={`tab-settings-${id}`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-xl">

          {/* ── Aparência ── */}
          {activeTab === "aparencia" && (
            <div className="space-y-6" data-testid="tab-content-aparencia">
              <h2 className="text-base font-semibold">{t("axisSettings.tabAppearance")}</h2>

              <div>
                <SectionLabel>{t("axisSettings.visualTheme")}</SectionLabel>
                <ThemeSelector value={theme} onChange={handleThemeChange} />
              </div>

              <div>
                <SectionLabel>{t("axisSettings.language")}</SectionLabel>
                <p className="text-xs text-muted-foreground mb-3">{t("axisSettings.languageDesc")}</p>
                <Select
                  value={i18n.language}
                  onValueChange={(lng) => {
                    i18n.changeLanguage(lng);
                    toast({ title: t("axisSettings.languageChanged") });
                  }}
                >
                  <SelectTrigger data-testid="select-language"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">🇧🇷 {t("axisSettings.langPtBR")}</SelectItem>
                    <SelectItem value="en">🇺🇸 {t("axisSettings.langEn")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <SectionLabel>{t("axisSettings.currency")}</SectionLabel>
                <p className="text-xs text-muted-foreground mb-3">{t("axisSettings.currencyDesc")}</p>
                <CurrencyPicker profile={userData?.profile} />
              </div>

              <div>
                <SectionLabel>{t("axisSettings.aiPersonality")}</SectionLabel>
                <p className="text-xs text-muted-foreground mb-3">{t("axisSettings.aiPersonalityDesc")}</p>
                <Select value={userData?.user?.aiPersonality || "calm"} onValueChange={handlePersonalityChange}>
                  <SelectTrigger data-testid="select-personality"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calm">🌊 {t("axisSettings.pCalm")}</SelectItem>
                    <SelectItem value="direct">⚡ {t("axisSettings.pDirect")}</SelectItem>
                    <SelectItem value="motivator">🚀 {t("axisSettings.pMotivator")}</SelectItem>
                    <SelectItem value="strict">🎯 {t("axisSettings.pStrict")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── Módulos ── */}
          {activeTab === "modulos" && (
            <div className="space-y-4" data-testid="tab-content-modulos">
              <h2 className="text-base font-semibold">{t("axisSettings.activeModules")}</h2>
              <p className="text-sm text-muted-foreground">{t("axisSettings.activeModulesDesc")}</p>
              <div className="space-y-2">
                {moduleList.map((mod) => {
                  const active = currentModules.includes(mod);
                  return (
                    <button
                      key={mod}
                      onClick={() => toggleModule(mod)}
                      className="w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center justify-between"
                      style={{
                        borderColor: active ? "hsl(var(--primary) / 0.5)" : "hsl(var(--border))",
                        background: active ? "hsl(var(--primary) / 0.08)" : "transparent",
                      }}
                      data-testid={`button-toggle-module-${mod}`}
                    >
                      <div>
                        <p className="text-sm font-medium">{moduleLabels[mod]}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{moduleDescs[mod]}</p>
                      </div>
                      <div
                        className="w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all"
                        style={{
                          borderColor: active ? "hsl(var(--primary))" : "hsl(var(--border))",
                          background: active ? "hsl(var(--primary))" : "transparent",
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Cadastro ── */}
          {activeTab === "cadastro" && (
            <div className="space-y-4" data-testid="tab-content-cadastro">
              <h2 className="text-base font-semibold">{t("axisSettings.editProfile")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("axisSettings.editProfileDesc")}
              </p>
              <Block>
                <div className="flex items-center gap-3 mb-2">
                  <UserCog className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t("axisSettings.configureProfile")}</p>
                    <p className="text-xs text-muted-foreground">{t("axisSettings.configureProfileDesc")}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowSetupModal(true)}
                  data-testid="button-open-edit-profile"
                >
                  {t("axisSettings.openProfile")}
                </Button>
              </Block>
            </div>
          )}

          {/* ── WhatsApp ── */}
          {activeTab === "whatsapp" && (
            <div data-testid="tab-content-whatsapp">
              <h2 className="text-base font-semibold mb-4">{t("axisSettings.whatsappBot")}</h2>
              <WhatsAppTab />
            </div>
          )}

          {/* ── Billing ── */}
          {activeTab === "billing" && (
            <div className="space-y-6" data-testid="tab-content-billing">
              <div>
                <h2 className="text-base font-semibold">Assinatura</h2>
                <p className="text-sm text-muted-foreground mt-1">Gerencie seu plano e uso mensal.</p>
              </div>

              {isLoadingUsage ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : billingUsage ? (
                <>
                  {/* Plan badge */}
                  <Block>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {billingUsage.plan === "team" ? <Users className="h-5 w-5 text-purple-400" /> : billingUsage.plan === "personal_ai" ? <Zap className="h-5 w-5 text-yellow-400" /> : <Star className="h-5 w-5 text-muted-foreground" />}
                        <div>
                          <p className="text-sm font-semibold">{billingUsage.planDisplayName}</p>
                          {billingUsage.trialEndsAt && new Date(billingUsage.trialEndsAt) > new Date() && (
                            <p className="text-xs text-yellow-500">Trial termina em {new Date(billingUsage.trialEndsAt).toLocaleDateString("pt-BR")}</p>
                          )}
                          {billingUsage.plan === "starter" && (
                            <p className="text-xs text-muted-foreground">Plano gratuito com limites mensais</p>
                          )}
                        </div>
                      </div>
                      {billingUsage.plan === "starter" ? (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => window.location.href = "/pricing"} data-testid="button-upgrade-plan">
                          Fazer upgrade
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending} data-testid="button-manage-billing">
                          {portalMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                          Gerenciar
                        </Button>
                      )}
                    </div>
                  </Block>

                  {/* Usage meters */}
                  <div>
                    <SectionLabel>Uso este mês — {billingUsage.month}</SectionLabel>
                    <div className="space-y-3">
                      {[
                        { label: "Transações", value: billingUsage.usage.transactions },
                        { label: "Capturas AI", value: billingUsage.usage.aiCaptures },
                        { label: "Fotos WhatsApp", value: billingUsage.usage.whatsappPhotos },
                        { label: "PDFs WhatsApp", value: billingUsage.usage.whatsappPdfs },
                        { label: "Msgs do chat", value: billingUsage.usage.chatMessages },
                      ].map(({ label, value }) => {
                        const pct = value.limit ? Math.min(100, (value.current / value.limit) * 100) : 0;
                        const isUnlimited = value.limit === null;
                        const isAtLimit = !isUnlimited && value.current >= value.limit;
                        return (
                          <div key={label} data-testid={`usage-meter-${label.toLowerCase().replace(/\s/g, '-')}`}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">{label}</span>
                              <span className={isAtLimit ? "text-red-400 font-semibold" : "text-foreground"}>
                                {isUnlimited ? `${value.current} / ∞` : `${value.current} / ${value.limit}`}
                              </span>
                            </div>
                            {!isUnlimited && (
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    background: isAtLimit ? "rgb(239,68,68)" : pct > 70 ? "rgb(234,179,8)" : "hsl(var(--primary))",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Binary features */}
                      <div className="flex items-center justify-between py-1" data-testid="usage-meter-voice">
                        <span className="text-xs text-muted-foreground">Transcrição de voz</span>
                        <span className={`text-xs font-medium ${billingUsage.usage.voice.allowed ? "text-green-400" : "text-muted-foreground"}`}>
                          {billingUsage.usage.voice.allowed ? "✓ Disponível" : "× Não incluído"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1" data-testid="usage-meter-business">
                        <span className="text-xs text-muted-foreground">Versão Business</span>
                        <span className={`text-xs font-medium ${billingUsage.usage.business.allowed ? "text-green-400" : "text-muted-foreground"}`}>
                          {billingUsage.usage.business.allowed ? "✓ Disponível" : "× Não incluído"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {billingUsage.plan === "starter" && (
                    <Block>
                      <p className="text-sm font-medium mb-1">Quer mais recursos?</p>
                      <p className="text-xs text-muted-foreground mb-3">O plano Personal AI desbloqueia uso ilimitado de IA, transcrição de voz e muito mais a partir de R$9/mês.</p>
                      <Button className="w-full" size="sm" onClick={() => window.location.href = "/pricing"} data-testid="button-see-plans">
                        Ver planos
                      </Button>
                    </Block>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Não foi possível carregar as informações de billing.</p>
              )}
            </div>
          )}

          {/* ── Conta ── */}
          {activeTab === "conta" && (
            <div className="space-y-4" data-testid="tab-content-conta">
              <h2 className="text-base font-semibold">{t("axisSettings.tabAccount")}</h2>

              <Block danger>
                <div className="flex items-center gap-2 mb-1">
                  <TriangleAlert className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">{t("axisSettings.dangerZone")}</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("axisSettings.resetDesc")}
                </p>
                <Button
                  variant="destructive"
                  className="w-full mt-1"
                  onClick={() => setShowResetConfirm(true)}
                  data-testid="button-reset-account"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> {t("axisSettings.resetAccount")}
                </Button>
              </Block>
            </div>
          )}

        </div>
      </div>

      {/* Dialogs */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent data-testid="dialog-reset-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("axisSettings.resetConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("axisSettings.resetConfirmDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reset-cancel">{t("axisSettings.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-reset-confirm"
            >
              {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {t("axisSettings.resetConfirmButton")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SetupSheet open={showSetupModal} onClose={() => setShowSetupModal(false)} />
    </div>
  );
}
