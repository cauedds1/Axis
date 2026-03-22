import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Users, UserPlus, MoreVertical, ShieldCheck, UserMinus, Crown, UserCog, Eye, EyeOff, Copy, CheckCircle2 } from "lucide-react";
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  const [addCollabOpen, setAddCollabOpen] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newJobTitle, setNewJobTitle] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [addedCreds, setAddedCreds] = useState<{ email: string; password: string } | null>(null);
  const [copiedField, setCopiedField] = useState<"email" | "password" | null>(null);

  const { data: orgs, isLoading: orgsLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations"],
  });
  const activeOrg = orgs?.[0];

  const { data: members, isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "members"],
    enabled: !!activeOrg?.id,
  });

  const isAdmin = !!activeOrg?.isAdmin;

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
      toast({ title: t("axisBiz.collaborators.invited"), description: `${inviteEmail} ${t("axisBiz.collaborators.addedToCompany")}` });
      setInviteEmail("");
      setInviteOpen(false);
    },
    onError: (err: any) => {
      const msg = err?.message ?? t("axisBiz.collaborators.inviteError");
      toast({ title: msg, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      apiRequest("PATCH", `/api/business/organizations/${activeOrg!.id}/members/${memberId}`, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", activeOrg?.id, "members"] });
      toast({ title: t("axisBiz.collaborators.roleUpdated") });
    },
    onError: () => toast({ title: t("axisBiz.collaborators.roleUpdateError"), variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: ({ memberId }: { memberId: string }) =>
      apiRequest("DELETE", `/api/business/organizations/${activeOrg!.id}/members/${memberId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", activeOrg?.id, "members"] });
      toast({ title: t("axisBiz.collaborators.removed") });
    },
    onError: () => toast({ title: t("axisBiz.collaborators.removeError"), variant: "destructive" }),
  });

  const addCollaboratorMutation = useMutation({
    mutationFn: (data: { firstName: string; lastName: string; email: string; password: string; jobTitle?: string }) =>
      apiRequest("POST", `/api/business/organizations/${activeOrg!.id}/collaborators`, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/business/organizations", activeOrg?.id, "members"] });
      setAddedCreds({ email: vars.email, password: vars.password });
      setNewFirstName(""); setNewLastName(""); setNewEmail(""); setNewPassword(""); setNewJobTitle("");
    },
    onError: (err: any) => {
      toast({ title: err?.message ?? t("axisBiz.collaborators.createError"), variant: "destructive" });
    },
  });

  function copyToClipboard(text: string, field: "email" | "password") {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

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
      <p className="text-muted-foreground">{t("axisBiz.collaborators.noOrg")}</p>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("axisBiz.collaborators.title")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t("axisBiz.collaborators.memberCount", { count: members?.length ?? 0, org: activeOrg.name })}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Dialog open={addCollabOpen} onOpenChange={(open) => { setAddCollabOpen(open); if (!open) { setAddedCreds(null); } }}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2" data-testid="button-add-collaborator">
                    <UserCog className="w-4 h-4" />
                    {t("axisBiz.collaborators.addCollaborator")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserCog className="w-4 h-4" style={{ color: primaryHex }} />
                      {t("axisBiz.collaborators.addCollaborator")}
                    </DialogTitle>
                  </DialogHeader>
                  {addedCreds ? (
                    <div className="flex flex-col gap-4 pt-2">
                      <div className="flex flex-col items-center gap-3 py-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: `${primaryHex}20` }}>
                          <CheckCircle2 className="w-6 h-6" style={{ color: primaryHex }} />
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-sm">{t("axisBiz.collaborators.createdSuccess")}</p>
                          <p className="text-xs text-muted-foreground mt-1">{t("axisBiz.collaborators.shareCredentials")}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between rounded-lg px-3 py-2.5 gap-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">E-mail</p>
                            <p className="text-sm font-mono font-medium" data-testid="text-created-email">{addedCreds.email}</p>
                          </div>
                          <button onClick={() => copyToClipboard(addedCreds.email, "email")} className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/5 transition-colors" data-testid="button-copy-email">
                            {copiedField === "email" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </div>
                        <div className="flex items-center justify-between rounded-lg px-3 py-2.5 gap-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{t("axisBiz.collaborators.temporaryPassword")}</p>
                            <p className="text-sm font-mono font-medium" data-testid="text-created-password">{addedCreds.password}</p>
                          </div>
                          <button onClick={() => copyToClipboard(addedCreds.password, "password")} className="flex-shrink-0 p-1.5 rounded-md hover:bg-white/5 transition-colors" data-testid="button-copy-password">
                            {copiedField === "password" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>
                      <Button onClick={() => { setAddCollabOpen(false); setAddedCreds(null); }} style={{ background: primaryHex }} data-testid="button-close-credentials">
                        {t("axisBiz.collaborators.close")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 pt-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1.5">{t("axisBiz.collaborators.firstName")} *</label>
                          <Input placeholder={t("axisBiz.collaborators.firstNamePlaceholder")} value={newFirstName} onChange={e => setNewFirstName(e.target.value)} data-testid="input-collab-first-name" />
                        </div>
                        <div>
                          <label className="block text-xs text-muted-foreground mb-1.5">{t("axisBiz.collaborators.lastName")} *</label>
                          <Input placeholder={t("axisBiz.collaborators.lastNamePlaceholder")} value={newLastName} onChange={e => setNewLastName(e.target.value)} data-testid="input-collab-last-name" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">E-mail *</label>
                        <Input type="email" placeholder={t("axisBiz.collaborators.emailPlaceholder")} value={newEmail} onChange={e => setNewEmail(e.target.value)} data-testid="input-collab-email-create" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">{t("axisBiz.collaborators.temporaryPassword")} *</label>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} placeholder={t("axisBiz.collaborators.passwordPlaceholder")} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="pr-10" data-testid="input-collab-password-create" />
                          <button type="button" onClick={() => setShowPassword(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1.5">{t("axisBiz.collaborators.jobTitle")} <span className="text-muted-foreground/50">({t("axisBiz.collaborators.optional")})</span></label>
                        <Input placeholder={t("axisBiz.collaborators.jobTitlePlaceholder")} value={newJobTitle} onChange={e => setNewJobTitle(e.target.value)} data-testid="input-collab-job-title" />
                      </div>
                      <Button
                        onClick={() => {
                          if (!newFirstName || !newLastName || !newEmail || !newPassword) {
                            toast({ title: t("axisBiz.collaborators.fillRequired"), variant: "destructive" }); return;
                          }
                          addCollaboratorMutation.mutate({ firstName: newFirstName, lastName: newLastName, email: newEmail, password: newPassword, jobTitle: newJobTitle || undefined });
                        }}
                        disabled={addCollaboratorMutation.isPending}
                        style={{ background: primaryHex }}
                        data-testid="button-create-collaborator"
                      >
                        {addCollaboratorMutation.isPending ? t("axisBiz.collaborators.creating") : t("axisBiz.collaborators.createCollaborator")}
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>

              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-2" style={{ background: primaryHex }} data-testid="button-invite-collaborator">
                    <UserPlus className="w-4 h-4" />
                    {t("axisBiz.collaborators.invite")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="w-4 h-4" style={{ color: primaryHex }} />
                      {t("axisBiz.collaborators.inviteCollaborator")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4 pt-2">
                    <p className="text-sm text-muted-foreground">
                      {t("axisBiz.collaborators.inviteNote")}
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
                      {inviteMutation.isPending ? t("axisBiz.collaborators.inviting") : t("axisBiz.collaborators.sendInvite")}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
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
                        {t("axisBiz.collaborators.collaboratorRole")}
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
                    {t("axisBiz.collaborators.expensesThisMonth", { count: stats.count })}
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
                          {t("axisBiz.collaborators.makeAdmin")}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => updateRoleMutation.mutate({ memberId: member.id, role: "member" })}
                          data-testid={`menu-make-member-${member.id}`}
                        >
                          <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                          {t("axisBiz.collaborators.makeCollaborator")}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => removeMutation.mutate({ memberId: member.id })}
                        className="text-red-400 focus:text-red-400"
                        data-testid={`menu-remove-member-${member.id}`}
                      >
                        <UserMinus className="w-4 h-4 mr-2" />
                        {t("axisBiz.collaborators.remove")}
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
              <p className="text-sm text-muted-foreground">{t("axisBiz.collaborators.noCollaborators")}</p>
              {isAdmin && (
                <p className="text-xs text-muted-foreground/60">{t("axisBiz.collaborators.inviteHint")}</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
