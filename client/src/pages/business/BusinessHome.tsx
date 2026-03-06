import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Users, Plus, Mail, ReceiptText, Clock, ChevronRight, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

const BLUE = "#2563EB";
const BLUE_LIGHT = "#3B82F6";

function StatCard({ icon, label, value, sub, color = BLUE_LIGHT }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs mt-1" style={{ color: `${color}99` }}>{sub}</p>}
      </div>
    </div>
  );
}

function CreateOrgDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: { name: string; cnpj?: string }) => apiRequest("POST", "/api/business/organizations", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations"] });
      toast({ title: "Empresa criada com sucesso!" });
      setOpen(false);
      setName("");
      setCnpj("");
      onCreated();
    },
    onError: () => toast({ title: "Erro ao criar empresa", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="border-0 text-sm font-semibold" style={{ background: BLUE, color: "white" }} data-testid="button-create-org">
          <Plus className="w-4 h-4 mr-1.5" />
          Criar empresa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova empresa</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div>
            <Label htmlFor="org-name">Nome da empresa *</Label>
            <Input id="org-name" placeholder="Ex: Acme Corp" value={name} onChange={e => setName(e.target.value)} className="mt-1.5" data-testid="input-org-name" />
          </div>
          <div>
            <Label htmlFor="org-cnpj">CNPJ (opcional)</Label>
            <Input id="org-cnpj" placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(e.target.value)} className="mt-1.5" data-testid="input-org-cnpj" />
          </div>
          <Button
            onClick={() => createMutation.mutate({ name, cnpj: cnpj || undefined })}
            disabled={!name.trim() || createMutation.isPending}
            className="border-0"
            style={{ background: BLUE, color: "white" }}
            data-testid="button-submit-create-org"
          >
            {createMutation.isPending ? "Criando..." : "Criar empresa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InviteMemberDialog({ orgId, orgName }: { orgId: string; orgName: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const inviteMutation = useMutation({
    mutationFn: (data: { email: string }) => apiRequest("POST", `/api/business/organizations/${orgId}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "members"] });
      toast({ title: "Colaborador convidado!" });
      setOpen(false);
      setEmail("");
    },
    onError: (err: any) => toast({ title: err?.message ?? "Erro ao convidar colaborador", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-xs" data-testid="button-invite-member">
          <Mail className="w-3.5 h-3.5 mr-1.5" />
          Convidar colaborador
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Convidar para {orgName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div>
            <Label htmlFor="member-email">E-mail do colaborador</Label>
            <Input id="member-email" type="email" placeholder="joao@empresa.com" value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5" data-testid="input-member-email" />
          </div>
          <Button
            onClick={() => inviteMutation.mutate({ email })}
            disabled={!email.trim() || inviteMutation.isPending}
            className="border-0"
            style={{ background: BLUE, color: "white" }}
            data-testid="button-submit-invite"
          >
            {inviteMutation.isPending ? "Convidando..." : "Convidar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BusinessHome() {
  const { user } = useAuth();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: orgs, isLoading: orgsLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations"],
  });

  const activeOrg = selectedOrgId
    ? orgs?.find(o => o.id === selectedOrgId)
    : orgs?.[0];

  const { data: members, isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "members"],
    enabled: !!activeOrg?.id,
  });

  const { data: expenses } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "expenses"],
    enabled: !!activeOrg?.id,
  });

  const thisMonth = new Date();
  const monthExpenses = expenses?.filter(e => {
    const d = new Date(e.date ?? e.createdAt);
    return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear();
  });
  const totalMonth = monthExpenses?.filter(e => e.status !== "rejected").reduce((s: number, e: any) => s + e.amount, 0) ?? 0;
  const pendingCount = expenses?.filter(e => e.status === "pending_review").length ?? 0;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Minha Empresa</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie sua empresa e colaboradores</p>
        </div>
        <CreateOrgDialog onCreated={() => {}} />
      </div>

      {orgsLoading && (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      )}

      {!orgsLoading && (!orgs || orgs.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${BLUE}12`, border: `1px solid ${BLUE}20` }}>
            <Building2 className="w-7 h-7" style={{ color: BLUE_LIGHT }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Nenhuma empresa ainda</h3>
            <p className="text-sm text-muted-foreground mt-1">Crie sua empresa para começar a gerenciar despesas da equipe</p>
          </div>
          <CreateOrgDialog onCreated={() => {}} />
        </div>
      )}

      {!orgsLoading && orgs && orgs.length > 0 && (
        <div className="flex flex-col gap-6">
          {orgs.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {orgs.map((org: any) => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrgId(org.id)}
                  className="px-4 py-1.5 rounded-full text-sm font-medium transition-all border"
                  style={{
                    background: activeOrg?.id === org.id ? BLUE : "transparent",
                    color: activeOrg?.id === org.id ? "white" : "rgba(255,255,255,0.5)",
                    borderColor: activeOrg?.id === org.id ? BLUE : "rgba(255,255,255,0.12)",
                  }}
                  data-testid={`button-select-org-${org.id}`}
                >
                  {org.name}
                </button>
              ))}
            </div>
          )}

          {activeOrg && (
            <>
              <div className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ background: `${BLUE}0D`, border: `1px solid ${BLUE}25` }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: BLUE }}>
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground" data-testid="text-org-name">{activeOrg.name}</h2>
                    {activeOrg.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {activeOrg.cnpj}</p>}
                    <Badge className="mt-1 text-[10px]" style={{ background: `${BLUE}20`, color: BLUE_LIGHT, border: `1px solid ${BLUE}35` }}>
                      {activeOrg.adminUserId === user?.id ? "Administrador" : "Colaborador"}
                    </Badge>
                  </div>
                </div>
                <InviteMemberDialog orgId={activeOrg.id} orgName={activeOrg.name} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard icon={<ReceiptText className="w-5 h-5" />} label="Total aprovado este mês" value={`R$ ${totalMonth.toFixed(2).replace(".", ",")}`} color={BLUE_LIGHT} />
                <StatCard icon={<Clock className="w-5 h-5" />} label="Despesas pendentes" value={pendingCount} sub={pendingCount > 0 ? "Aguardando aprovação" : "Tudo em dia"} color={pendingCount > 0 ? "#F59E0B" : "#10B981"} />
                <StatCard icon={<Users className="w-5 h-5" />} label="Colaboradores" value={(members?.length ?? 0)} sub="na equipe" color={BLUE_LIGHT} />
              </div>

              <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4" style={{ color: BLUE_LIGHT }} />
                    Colaboradores
                  </h3>
                </div>
                {membersLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                  </div>
                ) : !members || members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum colaborador ainda. Convide alguém!</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }} data-testid={`row-member-${m.id}`}>
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: BLUE }}>
                          {(m.userName || m.userEmail || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{m.userName || m.userEmail}</p>
                          {m.userName && <p className="text-xs text-muted-foreground truncate">{m.userEmail}</p>}
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">{m.role === "admin" ? "Admin" : "Colaborador"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Link href="/business/app/expenses">
                <div className="rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all hover:border-blue-500/30" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }} data-testid="link-view-expenses">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${BLUE}15`, border: `1px solid ${BLUE}25` }}>
                      <ReceiptText className="w-5 h-5" style={{ color: BLUE_LIGHT }} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Ver todas as despesas</p>
                      <p className="text-xs text-muted-foreground">Filtros, aprovações e exportação</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
