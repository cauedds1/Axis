import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, UserPlus, MoreVertical, ShieldCheck, UserMinus, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { useBusinessTheme, getBusinessPrimaryHex } from "@/components/theme-provider";

function formatBRL(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function MemberAvatar({ name, email, primaryHex }: { name?: string; email?: string; primaryHex: string }) {
  const initials = name
    ? name.split(" ").filter(Boolean).map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : (email?.[0] ?? "?").toUpperCase();
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{ background: `${primaryHex}18`, border: `1px solid ${primaryHex}25`, color: primaryHex }}
      data-testid="avatar-member"
    >
      {initials}
    </div>
  );
}

export default function BusinessCollaborators() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: orgs, isLoading: orgsLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations"],
  });
  const activeOrg = orgs?.[0];
  const isAdmin = activeOrg?.adminUserId === user?.id;

  const { data: members, isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "members"],
    enabled: !!activeOrg?.id,
  });

  const { data: expenses } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "expenses"],
    enabled: !!activeOrg?.id,
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  function getMemberStats(userId: string) {
    const memberExpenses = (expenses ?? []).filter(
      (e: any) => e.userId === userId && new Date(e.date) >= monthStart
    );
    return {
      count: memberExpenses.length,
      total: memberExpenses.reduce((s: number, e: any) => s + e.amount, 0),
    };
  }

  const inviteMutation = useMutation({
    mutationFn: ({ email }: { email: string }) =>
      apiRequest("POST", `/api/business/organizations/${activeOrg!.id}/members`, { email }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", activeOrg?.id, "members"] });
      toast({ title: "Colaborador convidado!", description: `${inviteEmail} foi adicionado à empresa.` });
      setInviteEmail("");
      setInviteOpen(false);
    },
    onError: (err: any) => {
      const msg = err?.message ?? "Erro ao convidar colaborador";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      apiRequest("PATCH", `/api/business/organizations/${activeOrg!.id}/members/${memberId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", activeOrg?.id, "members"] });
      toast({ title: "Permissão atualizada!" });
    },
    onError: () => toast({ title: "Erro ao atualizar permissão", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: ({ memberId }: { memberId: string }) =>
      apiRequest("DELETE", `/api/business/organizations/${activeOrg!.id}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", activeOrg?.id, "members"] });
      toast({ title: "Colaborador removido." });
    },
    onError: () => toast({ title: "Erro ao remover colaborador", variant: "destructive" }),
  });

  if (orgsLoading || membersLoading) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-16 w-full rounded-2xl" />
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
    </div>
  );

  if (!activeOrg) return (
    <div className="p-6 max-w-3xl mx-auto flex flex-col items-center justify-center py-20 text-center gap-4">
      <Users className="w-12 h-12 text-muted-foreground opacity-40" />
      <p className="text-muted-foreground">Crie uma empresa primeiro.</p>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Colaboradores</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {members?.length ?? 0} {(members?.length ?? 0) === 1 ? "membro" : "membros"} em {activeOrg.name}
            </p>
          </div>
          {isAdmin && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2" style={{ background: primaryHex }} data-testid="button-invite-collaborator">
                  <UserPlus className="w-4 h-4" />
                  Convidar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4" style={{ color: primaryHex }} />
                    Convidar colaborador
                  </DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    O usuário precisa ter uma conta no AXIS com esse e-mail.
                  </p>
                  <Input
                    type="email"
                    placeholder="email@empresa.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && inviteEmail && inviteMutation.mutate({ email: inviteEmail })}
                    data-testid="input-invite-email"
                  />
                  <Button
                    onClick={() => inviteEmail && inviteMutation.mutate({ email: inviteEmail })}
                    disabled={!inviteEmail || inviteMutation.isPending}
                    style={{ background: primaryHex }}
                    data-testid="button-send-invite"
                  >
                    {inviteMutation.isPending ? "Convidando..." : "Enviar convite"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {(members ?? []).map((member: any, i: number) => {
            const stats = getMemberStats(member.userId);
            const isOwner = member.userId === activeOrg.adminUserId;
            const isSelf = member.userId === user?.id;
            const displayName = member.userName || member.userEmail;

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="flex items-center gap-4 p-4 rounded-2xl border transition-all"
                style={{ background: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.07)" }}
                data-testid={`row-member-${member.id}`}
              >
                <MemberAvatar name={member.userName} email={member.userEmail} primaryHex={primaryHex} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate" data-testid={`text-member-name-${member.id}`}>
                      {displayName}
                    </p>
                    {isOwner && (
                      <Badge className="text-[10px] gap-1 py-0" style={{ background: `${primaryHex}18`, color: primaryHex, border: `1px solid ${primaryHex}30` }}>
                        <Crown className="w-2.5 h-2.5" />
                        Admin
                      </Badge>
                    )}
                    {!isOwner && member.role === "admin" && (
                      <Badge className="text-[10px] gap-1 py-0" style={{ background: "#818CF818", color: "#818CF8", border: "1px solid #818CF830" }}>
                        <ShieldCheck className="w-2.5 h-2.5" />
                        Admin
                      </Badge>
                    )}
                    {!isOwner && member.role !== "admin" && (
                      <Badge className="text-[10px] py-0" style={{ background: "rgba(255,255,255,0.05)", color: "hsl(var(--muted-foreground))", border: "1px solid rgba(255,255,255,0.1)" }}>
                        Colaborador
                      </Badge>
                    )}
                  </div>
                  {member.userName && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{member.userEmail}</p>
                  )}
                </div>

                <div className="text-right flex-shrink-0 mr-2">
                  <p className="text-xs font-semibold text-foreground" data-testid={`text-member-total-${member.id}`}>
                    {formatBRL(stats.total)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {stats.count} despesa{stats.count !== 1 ? "s" : ""} este mês
                  </p>
                </div>

                {isAdmin && !isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                        data-testid={`button-member-menu-${member.id}`}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {member.role !== "admin" ? (
                        <DropdownMenuItem
                          onClick={() => updateRoleMutation.mutate({ memberId: member.id, role: "admin" })}
                          data-testid={`menu-make-admin-${member.id}`}
                        >
                          <ShieldCheck className="w-4 h-4 mr-2 text-indigo-400" />
                          Tornar Admin
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => updateRoleMutation.mutate({ memberId: member.id, role: "member" })}
                          data-testid={`menu-make-member-${member.id}`}
                        >
                          <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                          Tornar Colaborador
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => removeMutation.mutate({ memberId: member.id })}
                        className="text-red-400 focus:text-red-400"
                        data-testid={`menu-remove-member-${member.id}`}
                      >
                        <UserMinus className="w-4 h-4 mr-2" />
                        Remover
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </motion.div>
            );
          })}

          {(members ?? []).length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Users className="w-10 h-10 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">Nenhum colaborador ainda.</p>
              {isAdmin && (
                <p className="text-xs text-muted-foreground/60">Clique em "Convidar" para adicionar membros à equipe.</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
