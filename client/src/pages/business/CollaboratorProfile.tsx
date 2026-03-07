import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { KeyRound, User, Building2 } from "lucide-react";
import { useBusinessTheme, getBusinessPrimaryHex } from "@/components/theme-provider";
import { motion } from "framer-motion";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Informe a senha atual"),
  newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirme a nova senha"),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

type ChangePasswordData = z.infer<typeof changePasswordSchema>;

export default function CollaboratorProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const { data: orgs, isLoading: orgsLoading } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const activeOrg = orgs?.[0];

  const { data: members, isLoading: membersLoading } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrg?.id, "members"],
    enabled: !!activeOrg?.id,
  });

  const myMember = members?.find((m: any) => m.userId === user?.id);

  const form = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.error) {
        toast({ title: data.error, variant: "destructive" });
        return;
      }
      toast({ title: "Senha alterada com sucesso!" });
      form.reset();
      setShowPasswordForm(false);
    },
    onError: () => toast({ title: "Erro ao alterar senha", variant: "destructive" }),
  });

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase() || "?";

  const isLoading = orgsLoading || membersLoading;

  if (isLoading) return (
    <div className="p-6 max-w-2xl mx-auto flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
  );

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Perfil</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Suas informações pessoais</p>
        </div>

        <div
          className="rounded-2xl p-6 mb-4"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
              style={{ background: primaryHex }}
              data-testid="avatar-initials"
            >
              {initials}
            </div>
            <div>
              <p className="text-base font-semibold text-foreground" data-testid="text-fullname">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-sm text-muted-foreground" data-testid="text-email">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 mb-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Cargo</p>
              </div>
              <p className="text-sm font-medium text-foreground" data-testid="text-jobtitle">
                {myMember?.jobTitle || "—"}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Empresa</p>
              </div>
              <p className="text-sm font-medium text-foreground" data-testid="text-orgname">
                {activeOrg?.tradeName || activeOrg?.name || "—"}
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Segurança</h2>
            </div>
            {!showPasswordForm && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => setShowPasswordForm(true)}
                data-testid="button-change-password"
              >
                Alterar senha
              </Button>
            )}
          </div>

          {!showPasswordForm ? (
            <p className="text-xs text-muted-foreground">Clique em "Alterar senha" para definir uma nova senha de acesso.</p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => changePasswordMutation.mutate(d))} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Senha atual</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          className="h-9 text-sm"
                          placeholder="••••••••"
                          data-testid="input-current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Nova senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          className="h-9 text-sm"
                          placeholder="Mínimo 6 caracteres"
                          data-testid="input-new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Confirmar nova senha</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          className="h-9 text-sm"
                          placeholder="Repita a nova senha"
                          data-testid="input-confirm-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    className="text-xs h-9 border-0"
                    style={{ background: primaryHex, color: "white" }}
                    disabled={changePasswordMutation.isPending}
                    data-testid="button-submit-password"
                  >
                    {changePasswordMutation.isPending ? "Salvando..." : "Salvar senha"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-9"
                    onClick={() => { setShowPasswordForm(false); form.reset(); }}
                    data-testid="button-cancel-password"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
