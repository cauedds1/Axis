import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Wifi, WifiOff, QrCode, MessageCircle, Check, RefreshCw, UserCog, ExternalLink, Trash2, TriangleAlert, Palette, LayoutGrid, Smartphone } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ThemeSelector } from "@/components/theme-toggle";
import { useTheme } from "@/components/theme-provider";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SetupSheet } from "@/components/setup-sheet";

function formatBotPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("55") && d.length === 13) return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.startsWith("55") && d.length === 12) return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  return `+${d}`;
}

type SettingsTab = "aparencia" | "modulos" | "cadastro" | "whatsapp" | "conta";

const TABS: { id: SettingsTab; label: string; Icon: any }[] = [
  { id: "aparencia",  label: "Aparência",  Icon: Palette },
  { id: "modulos",   label: "Módulos",    Icon: LayoutGrid },
  { id: "cadastro",  label: "Cadastro",   Icon: UserCog },
  { id: "whatsapp",  label: "WhatsApp",   Icon: Smartphone },
  { id: "conta",     label: "Conta",      Icon: TriangleAlert },
];

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

function WhatsAppTab() {
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
    onError: () => toast({ title: "Erro ao conectar WhatsApp", variant: "destructive" }),
  });
  const unlinkMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/user/whatsapp-phone", { phone: "" }),
    onSuccess: () => {
      setPhone("");
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({ title: "Número desvinculado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao desvincular número", variant: "destructive" }),
  });
  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/whatsapp/reset"),
    onSuccess: () => { toast({ title: "Gerando novo QR code..." }); setTimeout(() => refetch(), 1200); },
    onError: () => toast({ title: "Erro ao gerar QR", variant: "destructive" }),
  });
  const phoneMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", "/api/user/whatsapp-phone", { phone }),
    onSuccess: () => {
      setPhoneSaved(true);
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({ title: "Número vinculado com sucesso!" });
      setTimeout(() => setPhoneSaved(false), 2500);
    },
    onError: () => toast({ title: "Erro ao salvar número", variant: "destructive" }),
  });

  const wStatus = status?.status || "disconnected";
  const botPhoneDigits = (status?.phone || "").replace(/\D/g, "");
  const statusMap: Record<string, { label: string; color: string; Icon: any }> = {
    disconnected: { label: "Desconectado", color: "#FF1744", Icon: WifiOff },
    qr_pending:   { label: "Aguardando QR", color: "#FFA000", Icon: QrCode },
    connected:    { label: "Conectado",     color: "#00E5C8", Icon: Wifi },
  };
  const { label, color, Icon } = statusMap[wStatus] ?? statusMap.disconnected;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Envie mensagens ou fotos de nota fiscal pelo WhatsApp e o AXIS processa automaticamente — gastos, tarefas, hábitos e compromissos.
      </p>

      {/* Status */}
      <Block>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon className="h-5 w-5" style={{ color }} />
            <div>
              <p className="text-sm font-semibold">{label}</p>
              {wStatus === "connected" && status?.phone && (
                <p className="text-[11px] font-medium" style={{ color: "#00E5C8" }}>
                  Bot conectado em {formatBotPhone(status.phone)}
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
                  style={{ color: "#00E5C8", borderColor: "rgba(0,229,200,0.3)", background: "rgba(0,229,200,0.08)" }}
                  data-testid="button-whatsapp-open-chat"
                >
                  <ExternalLink className="h-3 w-3" /> Abrir chat
                </a>
              )}
              <button
                onClick={() => setConfirmDisconnect(true)}
                disabled={unlinkMutation.isPending}
                className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
                style={{ color: "#FF1744", borderColor: "rgba(255,23,68,0.3)", background: "rgba(255,23,68,0.08)" }}
                data-testid="button-whatsapp-disconnect"
              >
                {unlinkMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Desconectar"}
              </button>
            </div>
          ) : wStatus === "disconnected" ? (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
              style={{ color: "#00E5C8", borderColor: "rgba(0,229,200,0.3)", background: "rgba(0,229,200,0.08)" }}
              data-testid="button-whatsapp-connect"
            >
              {connectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Conectar"}
            </button>
          ) : null}
        </div>
      </Block>

      {/* QR pending */}
      {wStatus === "qr_pending" && status?.qrCode && (
        <Block>
          <p className="text-xs text-muted-foreground text-center">Abra o WhatsApp → Aparelhos conectados → Escanear QR</p>
          <div className="flex justify-center">
            <img src={status.qrCode} alt="QR Code WhatsApp" className="w-48 h-48 rounded-xl" data-testid="img-whatsapp-qr" />
          </div>
          <div className="flex items-center gap-3 justify-center">
            <p className="text-[10px] text-muted-foreground">QR expira em 60s</p>
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
              style={{ color: "#FFA000", borderColor: "rgba(255,160,0,0.3)", background: "rgba(255,160,0,0.08)" }}
              data-testid="button-whatsapp-new-qr"
            >
              {resetMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Gerar novo QR
            </button>
          </div>
        </Block>
      )}
      {wStatus === "qr_pending" && !status?.qrCode && (
        <Block>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Gerando QR code...</span>
            </div>
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
              style={{ color: "#FFA000", borderColor: "rgba(255,160,0,0.3)", background: "rgba(255,160,0,0.08)" }}
              data-testid="button-whatsapp-new-qr-fallback"
            >
              <RefreshCw className="h-3 w-3" /> Tentar novamente
            </button>
          </div>
        </Block>
      )}

      {/* Phone number */}
      <Block>
        <SectionLabel>Seu número de WhatsApp</SectionLabel>
        <p className="text-xs text-muted-foreground">Vincule seu número para que o bot reconheça suas mensagens.</p>
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
            style={phoneSaved ? { color: "#00E5C8", borderColor: "rgba(0,229,200,0.3)", background: "rgba(0,229,200,0.08)" } : {}}
            data-testid="button-save-whatsapp-phone"
          >
            {phoneMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : phoneSaved ? <Check className="h-4 w-4" /> : "Salvar"}
          </button>
        </div>
      </Block>

      {/* Examples */}
      <Block>
        <SectionLabel>Exemplos de mensagens</SectionLabel>
        <div className="space-y-1.5">
          {[
            "gastei 50 no almoço",
            "criar tarefa reunião de equipe sexta",
            "hábito academia todo dia às 7h",
            "agendar consulta médica segunda 10h",
            "[foto de nota fiscal] → registra automaticamente",
          ].map(ex => (
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
            <AlertDialogTitle>Desvincular número?</AlertDialogTitle>
            <AlertDialogDescription>
              Seu número de WhatsApp será removido e o bot não reconhecerá mais suas mensagens. Você poderá vincular novamente quando quiser.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-whatsapp-disconnect">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { setConfirmDisconnect(false); unlinkMutation.mutate(); }}
              data-testid="button-confirm-whatsapp-disconnect"
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("aparencia");
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const { data: userData } = useQuery<any>({ queryKey: ["/api/user/profile"] });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", "/api/user/settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Configurações salvas" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/user/reset-data"),
    onSuccess: () => {
      queryClient.clear();
      toast({ title: "Conta zerada com sucesso", description: "Todos os seus dados foram apagados." });
    },
    onError: () => toast({ title: "Erro ao zerar conta", variant: "destructive" }),
  });

  const handleThemeChange = (t: "slim" | "high") => {
    setTheme(t);
    updateMutation.mutate({ theme: t });
  };

  const handlePersonalityChange = (p: string) => {
    updateMutation.mutate({ aiPersonality: p });
  };

  const moduleList = ["finance", "schedule", "tasks", "habits"];
  const moduleLabels: Record<string, string> = { finance: "Finanças", schedule: "Agenda", tasks: "Tarefas", habits: "Compromissos" };
  const moduleDescs: Record<string, string> = {
    finance: "Gastos, receitas e reservas",
    schedule: "Compromissos e calendário",
    tasks: "To-do list inteligente",
    habits: "Streaks e disciplina",
  };
  const currentModules: string[] = userData?.user?.activeModules || [];

  const toggleModule = (mod: string) => {
    const updated = currentModules.includes(mod)
      ? currentModules.filter(m => m !== mod)
      : [...currentModules, mod];
    updateMutation.mutate({ activeModules: updated });
  };

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden" data-testid="page-settings">
      <title>AXIS - Configurações</title>

      {/* Sidebar */}
      <div
        className="w-48 flex-shrink-0 border-r border-border flex flex-col py-4 px-2 gap-1"
        style={{ background: "rgba(255,255,255,0.01)" }}
      >
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">Configurações</p>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-xl">

          {/* ── Aparência ── */}
          {activeTab === "aparencia" && (
            <div className="space-y-6" data-testid="tab-content-aparencia">
              <h2 className="text-base font-semibold">Aparência</h2>

              <div>
                <SectionLabel>Tema visual</SectionLabel>
                <ThemeSelector value={theme} onChange={handleThemeChange} />
              </div>

              <div>
                <SectionLabel>Personalidade da IA</SectionLabel>
                <p className="text-xs text-muted-foreground mb-3">Define o tom de todas as respostas e sugestões do assistente.</p>
                <Select value={userData?.user?.aiPersonality || "calm"} onValueChange={handlePersonalityChange}>
                  <SelectTrigger data-testid="select-personality"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="calm">🌊 Calmo — tranquilo e paciente</SelectItem>
                    <SelectItem value="direct">⚡ Direto — sem rodeios</SelectItem>
                    <SelectItem value="motivator">🚀 Motivador — sempre incentivando</SelectItem>
                    <SelectItem value="strict">🎯 Rigoroso — cobra resultados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* ── Módulos ── */}
          {activeTab === "modulos" && (
            <div className="space-y-4" data-testid="tab-content-modulos">
              <h2 className="text-base font-semibold">Módulos ativos</h2>
              <p className="text-sm text-muted-foreground">Ative apenas os módulos que você usa — eles aparecem na navegação lateral.</p>
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
              <h2 className="text-base font-semibold">Editar cadastro</h2>
              <p className="text-sm text-muted-foreground">
                Atualize sua renda, gastos fixos, rotina e preferências de alerta. Qualquer mudança é aplicada automaticamente no sistema.
              </p>
              <Block>
                <div className="flex items-center gap-3 mb-2">
                  <UserCog className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Configurar perfil</p>
                    <p className="text-xs text-muted-foreground">Renda, gastos fixos, hábitos, alertas e WhatsApp</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowSetupModal(true)}
                  data-testid="button-open-edit-profile"
                >
                  Abrir cadastro
                </Button>
              </Block>
            </div>
          )}

          {/* ── WhatsApp ── */}
          {activeTab === "whatsapp" && (
            <div data-testid="tab-content-whatsapp">
              <h2 className="text-base font-semibold mb-4">WhatsApp Bot</h2>
              <WhatsAppTab />
            </div>
          )}

          {/* ── Conta ── */}
          {activeTab === "conta" && (
            <div className="space-y-4" data-testid="tab-content-conta">
              <h2 className="text-base font-semibold">Conta</h2>

              <Block danger>
                <div className="flex items-center gap-2 mb-1">
                  <TriangleAlert className="h-4 w-4 text-destructive" />
                  <p className="text-sm font-semibold text-destructive">Zona de perigo</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Apaga todas as transações, contas, hábitos, tarefas, metas, agenda e memória da IA. Sua conta de acesso é mantida, mas você começa do zero.
                </p>
                <Button
                  variant="destructive"
                  className="w-full mt-1"
                  onClick={() => setShowResetConfirm(true)}
                  data-testid="button-reset-account"
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Zerar a conta
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
            <AlertDialogTitle>Zerar a conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é <strong>irreversível</strong>. Todos os seus dados serão apagados permanentemente:<br /><br />
              • Transações e extratos<br />
              • Contas e cobranças<br />
              • Hábitos e tarefas<br />
              • Agenda e metas<br />
              • Memória e contexto da IA<br /><br />
              Sua conta de login será mantida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-reset-cancel">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-reset-confirm"
            >
              {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Sim, apagar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SetupSheet open={showSetupModal} onClose={() => setShowSetupModal(false)} />
    </div>
  );
}
