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
  Building2, Users, Plus, ReceiptText,
  CheckCircle2, AlertCircle, XCircle, ArrowRight, TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useBusinessTheme, getBusinessPrimaryHex, getBusinessModulePalette } from "@/components/theme-provider";

const AMBER = "#F59E0B";
const EMERALD = "#10B981";
const RED = "#EF4444";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function statusBadge(status: string) {
  if (status === "approved") return <Badge className="text-[10px] font-semibold" style={{ background: "#10B98115", color: "#10B981", border: "1px solid #10B98130" }}>Aprovada</Badge>;
  if (status === "rejected") return <Badge className="text-[10px] font-semibold" style={{ background: "#EF444415", color: "#EF4444", border: "1px solid #EF444430" }}>Rejeitada</Badge>;
  return <Badge className="text-[10px] font-semibold" style={{ background: "#F59E0B15", color: "#F59E0B", border: "1px solid #F59E0B30" }}>Pendente</Badge>;
}

function MemberAvatar({ name, email, primaryHex }: { name?: string; email?: string; primaryHex: string }) {
  const initials = name
    ? name.split(" ").filter(Boolean).map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : (email?.[0] ?? "?").toUpperCase();
  return (
    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: `${primaryHex}18`, border: `1px solid ${primaryHex}25`, color: primaryHex }}>
      {initials}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 rounded bg-muted" />
      <div className="h-8 w-32 rounded bg-muted" />
      <div className="h-2 w-full rounded bg-muted" />
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
      setOpen(false); setName(""); setCnpj("");
      onCreated();
    },
    onError: () => toast({ title: "Erro ao criar empresa", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="border-0 text-sm font-semibold" data-testid="button-create-org">
          <Plus className="w-4 h-4 mr-1.5" />Criar empresa
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nova empresa</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 pt-2">
          <div>
            <Label htmlFor="org-name">Nome da empresa *</Label>
            <Input id="org-name" placeholder="Ex: Acme Corp" value={name} onChange={e => setName(e.target.value)} className="mt-1.5" data-testid="input-org-name" />
          </div>
          <div>
            <Label htmlFor="org-cnpj">CNPJ (opcional)</Label>
            <Input id="org-cnpj" placeholder="00.000.000/0000-00" value={cnpj} onChange={e => setCnpj(e.target.value)} className="mt-1.5" data-testid="input-org-cnpj" />
          </div>
          <Button onClick={() => createMutation.mutate({ name, cnpj: cnpj || undefined })} disabled={!name.trim() || createMutation.isPending} data-testid="button-submit-create-org">
            {createMutation.isPending ? "Criando..." : "Criar empresa"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BusinessHome() {
  const { user } = useAuth();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);
  const palette = getBusinessModulePalette(businessTheme);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const { data: orgs, isLoading: orgsLoading } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const activeOrg = selectedOrgId ? orgs?.find(o => o.id === selectedOrgId) : orgs?.[0];

  const { data: members } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "members"],
    enabled: !!activeOrg?.id,
  });

  const { data: expenses, isLoading: expLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "expenses"],
    enabled: !!activeOrg?.id,
  });

  const now = new Date();
  const monthExpenses = (expenses ?? []).filter(e => {
    const d = new Date(e.date ?? e.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const metrics = {
    total: monthExpenses.filter(e => e.status !== "rejected").reduce((s, e) => s + e.amount, 0),
    approved: monthExpenses.filter(e => e.status === "approved").reduce((s, e) => s + e.amount, 0),
    pendingCount: (expenses ?? []).filter(e => e.status === "pending_review").length,
    pendingTotal: (expenses ?? []).filter(e => e.status === "pending_review").reduce((s, e) => s + e.amount, 0),
    rejectedCount: monthExpenses.filter(e => e.status === "rejected").length,
  };

  const recentExpenses = [...(expenses ?? [])].sort((a, b) => new Date(b.date ?? b.createdAt).getTime() - new Date(a.date ?? a.createdAt).getTime()).slice(0, 5);

  const topCollaborators = Object.entries(
    monthExpenses.filter(e => e.status !== "rejected").reduce((acc: Record<string, { total: number; name: string; email: string }>, e) => {
      if (!acc[e.userId]) acc[e.userId] = { total: 0, name: e.userName || "", email: e.userEmail || "" };
      acc[e.userId].total += e.amount;
      return acc;
    }, {})
  ).sort((a, b) => b[1].total - a[1].total).slice(0, 3);

  const categoryBreakdown = Object.entries(
    monthExpenses.filter(e => e.status !== "rejected").reduce((acc: Record<string, number>, e) => {
      const cat = e.categoryName || "Outros";
      acc[cat] = (acc[cat] ?? 0) + e.amount;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const maxCat = categoryBreakdown[0]?.[1] ?? 1;
  const isLoading = orgsLoading || expLoading;

  if (isLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="h-7 w-48 rounded bg-muted animate-pulse mb-1" />
        <div className="h-4 w-64 rounded bg-muted animate-pulse mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">{[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
      </div>
    );
  }

  if (!orgs || orgs.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure sua empresa para começar.</p>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center gap-5 rounded-2xl border border-dashed"
          style={{ borderColor: `${primaryHex}25` }}
        >
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${primaryHex}12`, border: `1px solid ${primaryHex}20` }}>
            <Building2 className="w-7 h-7" style={{ color: primaryHex }} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Nenhuma empresa ainda</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">Crie sua empresa para começar a gerenciar as despesas da equipe</p>
          </div>
          <CreateOrgDialog onCreated={() => {}} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Olá, {user?.firstName ?? "gestor"}. Resumo de {format(now, "MMMM 'de' yyyy", { locale: ptBR })}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {orgs.length > 1 && orgs.map((org: any) => (
            <button
              key={org.id}
              onClick={() => setSelectedOrgId(org.id)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
              style={{
                background: activeOrg?.id === org.id ? primaryHex : "transparent",
                color: activeOrg?.id === org.id ? "white" : "hsl(var(--muted-foreground))",
                borderColor: activeOrg?.id === org.id ? primaryHex : "hsl(var(--border))",
              }}
            >{org.name}</button>
          ))}
          <CreateOrgDialog onCreated={() => {}} />
        </div>
      </div>

      {activeOrg && (
        <>
          <div className="rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6" style={{ background: `${primaryHex}0A`, border: `1px solid ${primaryHex}20` }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: primaryHex }}>
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground" data-testid="text-org-name">{activeOrg.name}</h2>
                <p className="text-xs text-muted-foreground">{members?.length ?? 0} colaborador{(members?.length ?? 0) !== 1 ? "es" : ""}</p>
              </div>
              <Badge className="ml-1 text-[10px]" style={{ background: `${primaryHex}20`, color: primaryHex, border: `1px solid ${primaryHex}35` }}>
                {activeOrg.isAdmin ? "Administrador" : "Colaborador"}
              </Badge>
            </div>
            <Link href="/business/app/colaboradores">
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="link-view-team">
                <Users className="w-3.5 h-3.5" />Ver equipe <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              {
                label: "Total do mês", value: formatBRL(metrics.total), color: primaryHex,
                sub: "despesas não rejeitadas", Icon: TrendingUp, testId: "card-total-month",
              },
              {
                label: "Aprovadas", value: formatBRL(metrics.approved), color: EMERALD,
                sub: "total aprovado", Icon: CheckCircle2, testId: "card-approved",
              },
              {
                label: "Aguardando aprovação",
                value: String(metrics.pendingCount),
                color: metrics.pendingCount > 0 ? AMBER : EMERALD,
                sub: metrics.pendingCount > 0 ? formatBRL(metrics.pendingTotal) : "Tudo em dia",
                Icon: metrics.pendingCount > 0 ? AlertCircle : CheckCircle2,
                testId: "card-pending",
                highlight: metrics.pendingCount > 0,
              },
              {
                label: "Rejeitadas", value: String(metrics.rejectedCount), color: RED,
                sub: "no mês atual", Icon: XCircle, testId: "card-rejected",
              },
            ].map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="rounded-2xl p-4 relative overflow-hidden"
                style={{
                  background: card.highlight ? `${AMBER}08` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${card.highlight ? `${AMBER}30` : "rgba(255,255,255,0.07)"}`,
                }}
                data-testid={card.testId}
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs text-muted-foreground leading-tight">{card.label}</p>
                  <card.Icon className="w-4 h-4 flex-shrink-0" style={{ color: card.color }} />
                </div>
                <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
                {card.sub && <p className="text-[10px] text-muted-foreground mt-1 truncate">{card.sub}</p>}
                {card.highlight && (
                  <Link href="/business/app/expenses">
                    <button className="mt-2 flex items-center gap-1 text-[10px] font-semibold transition-opacity hover:opacity-70" style={{ color: AMBER }}>
                      Ver pendentes <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  </Link>
                )}
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Últimas despesas</p>
                <Link href="/business/app/expenses">
                  <button className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1" data-testid="link-all-expenses">
                    Ver todas <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </Link>
              </div>
              {recentExpenses.length === 0 ? (
                <div className="flex flex-col items-center py-6 gap-2">
                  <ReceiptText className="w-7 h-7 text-muted-foreground opacity-30" />
                  <p className="text-xs text-muted-foreground">Nenhuma despesa registrada</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {recentExpenses.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-3" data-testid={`row-recent-expense-${e.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{e.establishment || e.description || "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{e.userName || e.userEmail || "—"} · {e.date ? format(new Date(e.date), "dd/MM", { locale: ptBR }) : "—"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-xs font-semibold text-foreground">{formatBRL(e.amount)}</p>
                        {statusBadge(e.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl p-5 flex-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Top colaboradores do mês</p>
                {topCollaborators.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Sem dados este mês</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {topCollaborators.map(([userId, data]) => (
                      <div key={userId} className="flex items-center gap-3" data-testid={`row-top-collab-${userId}`}>
                        <MemberAvatar name={data.name} email={data.email} primaryHex={palette.colaboradores} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{data.name || data.email}</p>
                        </div>
                        <p className="text-xs font-bold text-foreground flex-shrink-0">{formatBRL(data.total)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl p-5 flex-1" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Por categoria</p>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">Sem dados este mês</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {categoryBreakdown.map(([cat, total]) => (
                      <div key={cat} data-testid={`row-dashboard-cat-${cat}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-foreground">{cat}</span>
                          <span className="text-xs font-semibold text-foreground">{formatBRL(total)}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(total / maxCat) * 100}%`, background: primaryHex }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
