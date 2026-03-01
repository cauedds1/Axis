import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Settings as SettingsIcon, Loader2, Wifi, WifiOff, QrCode, MessageCircle, Check, RefreshCw, UserCog, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  if (d.startsWith("55") && d.length === 13) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.startsWith("55") && d.length === 12) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  return `+${d}`;
}

function WhatsAppSection() {
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
    <>
      <Card className="border-border" data-testid="card-whatsapp-settings">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageCircle className="h-4 w-4" /> WhatsApp Bot
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Envie mensagens ou fotos de nota fiscal pelo WhatsApp e o AXIS processa automaticamente — gastos, tarefas, hábitos e compromissos.
        </p>

        <div className="flex items-center justify-between rounded-xl p-4 border border-border bg-card">
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

        {wStatus === "qr_pending" && status?.qrCode && (
          <div className="rounded-xl p-4 border border-amber-500/20 bg-amber-500/5 flex flex-col items-center gap-3">
            <p className="text-xs text-muted-foreground text-center">
              Abra o WhatsApp → Aparelhos conectados → Escanear QR
            </p>
            <img
              src={status.qrCode}
              alt="QR Code WhatsApp"
              className="w-48 h-48 rounded-xl"
              data-testid="img-whatsapp-qr"
            />
            <div className="flex items-center gap-3 w-full justify-center">
              <p className="text-[10px] text-muted-foreground">QR expira em 60s</p>
              <button
                onClick={() => resetMutation.mutate()}
                disabled={resetMutation.isPending}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40"
                style={{ color: "#FFA000", borderColor: "rgba(255,160,0,0.3)", background: "rgba(255,160,0,0.08)" }}
                data-testid="button-whatsapp-new-qr"
              >
                {resetMutation.isPending
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RefreshCw className="h-3 w-3" />}
                Gerar novo QR
              </button>
            </div>
          </div>
        )}

        {wStatus === "qr_pending" && !status?.qrCode && (
          <div className="flex flex-col items-center gap-3 py-3">
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
              <RefreshCw className="h-3 w-3" />
              Tentar novamente
            </button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium">Seu número de WhatsApp</p>
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
        </div>

        <div className="rounded-xl p-4 border border-border bg-card space-y-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">Exemplos de mensagens</p>
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
      </CardContent>
    </Card>

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
    </>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const [showSetupModal, setShowSetupModal] = useState(false);

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

  const handleThemeChange = (t: "slim" | "high") => {
    setTheme(t);
    updateMutation.mutate({ theme: t });
  };

  const handlePersonalityChange = (p: string) => {
    updateMutation.mutate({ aiPersonality: p });
  };

  const moduleList = ["finance", "schedule", "tasks", "habits"];
  const moduleLabels: Record<string, string> = { finance: "Finanças", schedule: "Agenda", tasks: "Tarefas", habits: "Compromissos" };
  const currentModules: string[] = userData?.user?.activeModules || [];

  const toggleModule = (mod: string) => {
    const updated = currentModules.includes(mod) ? currentModules.filter(m => m !== mod) : [...currentModules, mod];
    updateMutation.mutate({ activeModules: updated });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <title>AXIS - Configurações</title>

      <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-settings-title">
        <SettingsIcon className="h-5 w-5" /> Configurações
      </h1>

      <Card className="border-border" data-testid="card-theme-settings">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Tema visual</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSelector value={theme} onChange={handleThemeChange} />
        </CardContent>
      </Card>

      <Card className="border-border" data-testid="card-personality-settings">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Personalidade da IA</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={userData?.user?.aiPersonality || "calm"} onValueChange={handlePersonalityChange}>
            <SelectTrigger data-testid="select-personality"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="calm">Calmo</SelectItem>
              <SelectItem value="direct">Direto</SelectItem>
              <SelectItem value="motivator">Motivador</SelectItem>
              <SelectItem value="strict">Rigoroso</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-border" data-testid="card-modules-settings">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Módulos ativos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {moduleList.map((mod) => {
            const active = currentModules.includes(mod);
            return (
              <button
                key={mod}
                onClick={() => toggleModule(mod)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${active ? "border-primary bg-primary/10" : "border-border"}`}
                data-testid={`button-toggle-module-${mod}`}
              >
                <span className="text-sm font-medium">{moduleLabels[mod]}</span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border" data-testid="card-edit-profile-settings">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <UserCog className="h-4 w-4" /> Editar cadastro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Atualize sua renda, gastos fixos, rotina e preferências de alerta. Qualquer mudança é aplicada automaticamente no sistema.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowSetupModal(true)}
            data-testid="button-open-edit-profile"
          >
            Abrir cadastro
          </Button>
        </CardContent>
      </Card>

      <WhatsAppSection />

      <SetupSheet open={showSetupModal} onClose={() => setShowSetupModal(false)} />
    </div>
  );
}
