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
import {
  Building2, Users, Plus, Mail, ReceiptText, Clock,
  ArrowRight, TrendingUp, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

const PRIMARY = "#2563EB";
const PRIMARY_LIGHT = "#3B82F6";
const INDIGO = "#6366F1";
const AMBER = "#F59E0B";
const EMERALD = "#10B981";

function ModuleCard({
  children,
  color,
  href,
  testId,
  delay = 0,
}: {
  children: ReactNode;
  color: string;
  href?: string;
  testId?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-2xl border bg-card overflow-hidden group transition-all duration-200"
      style={{ borderColor: `${color}18` }}
      data-testid={testId}
    >
      <div
        className="h-[3px] w-full"
        style={{ background: color, opacity: 0.7 }}
      />
      <div className="p-5">
        {children}
        {href && (
          <Link href={href}>
            <button
              className="mt-4 flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: "hsl(var(--muted-foreground))" }}
            >
              Ver detalhes <ArrowRight className="h-3 w-3" />
            </button>
          </Link>
        )}
      </div>
    </motion.div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="h-8 w-32 rounded bg-muted" />
      <div className="h-2 w-full rounded bg-muted" />
      <div className="h-2 w-3/4 rounded bg-muted" />
    </div>
  );
}

function CreateOrgDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: (data: { name: string; cnpj?: string }) =>
      apiRequest("POST", "/api/business/organizations", data),
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
        <Button
          className="border-0 text-sm font-semibold"
          style={{ background: PRIMARY, color: "white" }}
          data-testid="button-create-org"
        >
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
            <Input
              id="org-name"
              placeholder="Ex: Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
              data-testid="input-org-name"
            />
          </div>
          <div>
            <Label htmlFor="org-cnpj">CNPJ (opcional)</Label>
            <Input
              id="org-cnpj"
              placeholder="00.000.000/0000-00"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="mt-1.5"
              data-testid="input-org-cnpj"
            />
          </div>
          <Button
            onClick={() => createMutation.mutate({ name, cnpj: cnpj || undefined })}
            disabled={!name.trim() || createMutation.isPending}
            className="border-0"
            style={{ background: PRIMARY, color: "white" }}
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
    mutationFn: (data: { email: string }) =>
      apiRequest("POST", `/api/business/organizations/${orgId}/members`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", orgId, "members"] });
      toast({ title: "Colaborador convidado!" });
      setOpen(false);
      setEmail("");
    },
    onError: (err: any) =>
      toast({ title: err?.message ?? "Erro ao convidar colaborador", variant: "destructive" }),
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
            <Input
              id="member-email"
              type="email"
              placeholder="joao@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
              data-testid="input-member-email"
            />
          </div>
          <Button
            onClick={() => inviteMutation.mutate({ email })}
            disabled={!email.trim() || inviteMutation.isPending}
            className="border-0"
            style={{ background: PRIMARY, color: "white" }}
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

  const activeOrg = selectedOrgId ? orgs?.find((o) => o.id === selectedOrgId) : orgs?.[0];

  const { data: members, isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "members"],
    enabled: !!activeOrg?.id,
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "expenses"],
    enabled: !!activeOrg?.id,
  });

  const thisMonth = new Date();
  const monthExpenses = expenses?.filter((e) => {
    const d = new Date(e.date ?? e.createdAt);
    return d.getMonth() === thisMonth.getMonth() && d.getFullYear() === thisMonth.getFullYear();
  });
  const totalMonth = monthExpenses
    ?.filter((e) => e.status !== "rejected")
    .reduce((s: number, e: any) => s + e.amount, 0) ?? 0;
  const approvedMonth = monthExpenses
    ?.filter((e) => e.status === "approved")
    .reduce((s: number, e: any) => s + e.amount, 0) ?? 0;
  const pendingCount = expenses?.filter((e) => e.status === "pending_review").length ?? 0;
  const pendingTotal = expenses
    ?.filter((e) => e.status === "pending_review")
    .reduce((s: number, e: any) => s + e.amount, 0) ?? 0;

  const isLoading = orgsLoading || expensesLoading || membersLoading;

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="h-7 w-48 rounded bg-muted animate-pulse mb-1" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!orgs || orgs.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bom dia, {user?.firstName ?? "gestor"}. Configure sua empresa para começar.
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center gap-5 rounded-2xl border border-dashed"
          style={{ borderColor: `${PRIMARY}25` }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: `${PRIMARY}12`, border: `1px solid ${PRIMARY}20` }}
          >
            <Building2 className="w-7 h-7" style={{ color: PRIMARY_LIGHT }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Nenhuma empresa ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              Crie sua empresa para começar a gerenciar as despesas da equipe
            </p>
          </div>
          <CreateOrgDialog onCreated={() => {}} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bom dia, {user?.firstName ?? "gestor"}. Aqui está o resumo da sua empresa.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {orgs.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {orgs.map((org: any) => (
                <button
                  key={org.id}
                  onClick={() => setSelectedOrgId(org.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                  style={{
                    background: activeOrg?.id === org.id ? PRIMARY : "transparent",
                    color: activeOrg?.id === org.id ? "white" : "hsl(var(--muted-foreground))",
                    borderColor: activeOrg?.id === org.id ? PRIMARY : "hsl(var(--border))",
                  }}
                  data-testid={`button-select-org-${org.id}`}
                >
                  {org.name}
                </button>
              ))}
            </div>
          )}
          <CreateOrgDialog onCreated={() => {}} />
        </div>
      </div>

      {activeOrg && (
        <>
          <div
            className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
            style={{ background: `${PRIMARY}0A`, border: `1px solid ${PRIMARY}20` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: PRIMARY }}
              >
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground" data-testid="text-org-name">
                  {activeOrg.name}
                </h2>
                {activeOrg.cnpj && (
                  <p className="text-xs text-muted-foreground">CNPJ: {activeOrg.cnpj}</p>
                )}
              </div>
              <Badge
                className="ml-1 text-[10px]"
                style={{
                  background: `${PRIMARY}20`,
                  color: PRIMARY_LIGHT,
                  border: `1px solid ${PRIMARY}35`,
                }}
              >
                {activeOrg.adminUserId === user?.id ? "Administrador" : "Colaborador"}
              </Badge>
            </div>
            <InviteMemberDialog orgId={activeOrg.id} orgName={activeOrg.name} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <ModuleCard color={PRIMARY_LIGHT} testId="card-expenses-month" delay={0} href="/business/app/expenses">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Despesas do mês
                  </p>
                  <p className="text-3xl font-bold text-foreground">
                    R$ {totalMonth.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                  </p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${PRIMARY_LIGHT}14`, border: `1px solid ${PRIMARY_LIGHT}22` }}
                >
                  <ReceiptText className="w-4 h-4" style={{ color: PRIMARY_LIGHT }} />
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs" style={{ color: EMERALD }}>
                <TrendingUp className="w-3 h-3" />
                <span>R$ {approvedMonth.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")} aprovados</span>
              </div>
            </ModuleCard>

            <ModuleCard
              color={pendingCount > 0 ? AMBER : EMERALD}
              testId="card-pending-approvals"
              delay={0.05}
              href="/business/app/expenses"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Aprovações pendentes
                  </p>
                  <p className="text-3xl font-bold text-foreground">{pendingCount}</p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: `${pendingCount > 0 ? AMBER : EMERALD}14`,
                    border: `1px solid ${pendingCount > 0 ? AMBER : EMERALD}22`,
                  }}
                >
                  {pendingCount > 0 ? (
                    <AlertCircle className="w-4 h-4" style={{ color: AMBER }} />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" style={{ color: EMERALD }} />
                  )}
                </div>
              </div>
              <p className="text-xs" style={{ color: pendingCount > 0 ? AMBER : EMERALD }}>
                {pendingCount > 0
                  ? `R$ ${pendingTotal.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".")} aguardando revisão`
                  : "Tudo em dia"}
              </p>
            </ModuleCard>

            <ModuleCard color={INDIGO} testId="card-collaborators" delay={0.1}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Colaboradores
                  </p>
                  <p className="text-3xl font-bold text-foreground">{members?.length ?? 0}</p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${INDIGO}14`, border: `1px solid ${INDIGO}22` }}
                >
                  <Users className="w-4 h-4" style={{ color: INDIGO }} />
                </div>
              </div>
              {membersLoading ? (
                <div className="space-y-1.5">
                  <div className="h-2 w-full rounded bg-muted animate-pulse" />
                  <div className="h-2 w-3/4 rounded bg-muted animate-pulse" />
                </div>
              ) : members && members.length > 0 ? (
                <div className="flex -space-x-2">
                  {members.slice(0, 5).map((m: any, i: number) => (
                    <div
                      key={m.id}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-card flex-shrink-0"
                      style={{ background: [PRIMARY, INDIGO, EMERALD, AMBER, "#EC4899"][i % 5], zIndex: 5 - i }}
                      title={m.userName || m.userEmail}
                    >
                      {(m.userName || m.userEmail || "?")[0].toUpperCase()}
                    </div>
                  ))}
                  {(members.length ?? 0) > 5 && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-card flex-shrink-0"
                      style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}
                    >
                      +{(members.length ?? 0) - 5}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum colaborador ainda</p>
              )}
            </ModuleCard>

            <ModuleCard color={EMERALD} testId="card-quick-actions" delay={0.15}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Ações rápidas
                  </p>
                  <p className="text-sm font-semibold text-foreground">Gerencie sua equipe</p>
                </div>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${EMERALD}14`, border: `1px solid ${EMERALD}22` }}
                >
                  <Clock className="w-4 h-4" style={{ color: EMERALD }} />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Link href="/business/app/expenses">
                  <button
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                    style={{ background: `${PRIMARY}10`, color: PRIMARY_LIGHT, border: `1px solid ${PRIMARY}20` }}
                    data-testid="button-quick-expenses"
                  >
                    <span className="flex items-center gap-2">
                      <ReceiptText className="w-3.5 h-3.5" />
                      Ver despesas
                    </span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </Link>
                <InviteMemberDialog orgId={activeOrg.id} orgName={activeOrg.name} />
              </div>
            </ModuleCard>
          </div>
        </>
      )}
    </div>
  );
}
