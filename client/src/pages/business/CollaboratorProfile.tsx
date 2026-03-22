import { useState, useEffect } from "react";
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
import { KeyRound, User, Building2, MessageCircle, CheckCircle2 } from "lucide-react";
import { useBusinessTheme, getBusinessPrimaryHex } from "@/components/theme-provider";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export default function CollaboratorProfile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [whatsappInput, setWhatsappInput] = useState("");
  const [whatsappSaved, setWhatsappSaved] = useState(false);

  const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, t("axisBiz.collabProfile.validation.currentPasswordRequired")),
    newPassword: z.string().min(6, t("axisBiz.collabProfile.validation.newPasswordMin")),
    confirmPassword: z.string().min(1, t("axisBiz.collabProfile.validation.currentPasswordRequired")),
  }).refine(d => d.newPassword === d.confirmPassword, {
    message: t("axisBiz.collabProfile.validation.passwordsMustMatch"),
    path: ["confirmPassword"],
  });

  type ChangePasswordData = z.infer<typeof changePasswordSchema>;

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

  const { data: profileData } = useQuery<{ profile: any; user: any }>({ queryKey: ["/api/user/profile"] });

  useEffect(() => {
    if (profileData?.profile?.whatsappPhone && !whatsappSaved) {
      setWhatsappInput(profileData.profile.whatsappPhone);
    }
  }, [profileData]);

  const saveWhatsappMutation = useMutation({
    mutationFn: async (phone: string) => {
      const res = await apiRequest("PATCH", "/api/user/whatsapp-phone", { phone });
      return res.json();
    },
    onSuccess: () => {
      setWhatsappSaved(true);
      toast({ title: t("axisBiz.collabProfile.toasts.whatsappSaved") });
    },
    onError: () => toast({ title: t("axisBiz.collabProfile.toasts.whatsappError"), variant: "destructive" }),
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
      toast({ title: t("axisBiz.collabProfile.toasts.passwordSaved") });
      form.reset();
      setShowPasswordForm(false);
    },
    onError: () => toast({ title: t("axisBiz.collabProfile.toasts.passwordError"), variant: "destructive" }),
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
          <h1 className="text-2xl font-bold text-foreground">{t("axisBiz.collabProfile.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("axisBiz.collabProfile.personalInfo")}</p>
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
                <p className="text-xs text-muted-foreground">{t("axisBiz.collabProfile.jobTitle")}</p>
              </div>
              <p className="text-sm font-medium text-foreground" data-testid="text-jobtitle">
                {myMember?.jobTitle || "—"}
              </p>
            </div>
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t("axisBiz.collabProfile.company")}</p>
              </div>
              <p className="text-sm font-medium text-foreground" data-testid="text-orgname">
                {activeOrg?.tradeName || activeOrg?.name || "—"}
              </p>
            </div>
          </div>
        </div>

        <div
          className="rounded-2xl p-6 mb-4"
          style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">{t("axisBiz.collabProfile.whatsappTitle")}</h2>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t("axisBiz.collabProfile.whatsappLinked")}</p>
              <p className="text-sm font-medium text-foreground" data-testid="text-whatsapp-phone">
                {profileData?.profile?.whatsappPhone || t("axisBiz.collabProfile.whatsappNotLinked")}
              </p>
            </div>

            <div className="flex gap-2 items-center">
              <Input
                type="tel"
                className="h-9 text-sm max-w-xs"
                placeholder="(11) 99999-9999"
                value={whatsappInput}
                onChange={e => { setWhatsappInput(e.target.value); setWhatsappSaved(false); }}
                data-testid="input-whatsapp-phone"
              />
              <Button
                size="sm"
                className="h-9 text-xs border-0 flex gap-1.5 items-center"
                style={{ background: primaryHex, color: "white" }}
                disabled={saveWhatsappMutation.isPending || !whatsappInput.trim()}
                onClick={() => saveWhatsappMutation.mutate(whatsappInput)}
                data-testid="button-save-whatsapp"
              >
                {saveWhatsappMutation.isPending
                  ? t("axisBiz.collabProfile.saving")
                  : whatsappSaved
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> {t("axisBiz.collabProfile.saved")}</>
                    : t("common.save")}
              </Button>
            </div>

            <div
              className="rounded-xl p-3 text-xs text-muted-foreground leading-relaxed"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {t("axisBiz.collabProfile.whatsappHint", { number: whatsappInput || t("axisBiz.collabProfile.whatsappHintPlaceholder") })}
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
              <h2 className="text-sm font-semibold text-foreground">{t("axisBiz.collabProfile.security")}</h2>
            </div>
            {!showPasswordForm && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => setShowPasswordForm(true)}
                data-testid="button-change-password"
              >
                {t("axisBiz.collabProfile.changePassword")}
              </Button>
            )}
          </div>

          {!showPasswordForm ? (
            <p className="text-xs text-muted-foreground">{t("axisBiz.collabProfile.changePasswordHint")}</p>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(d => changePasswordMutation.mutate(d))} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">{t("axisBiz.collabProfile.currentPassword")}</FormLabel>
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
                      <FormLabel className="text-xs">{t("axisBiz.collabProfile.newPassword")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          className="h-9 text-sm"
                          placeholder={t("axisBiz.collabProfile.newPasswordPlaceholder")}
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
                      <FormLabel className="text-xs">{t("axisBiz.collabProfile.confirmPassword")}</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          className="h-9 text-sm"
                          placeholder={t("axisBiz.collabProfile.confirmPasswordPlaceholder")}
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
                    {changePasswordMutation.isPending ? t("axisBiz.collabProfile.savingPassword") : t("axisBiz.collabProfile.savePassword")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-9"
                    onClick={() => { setShowPasswordForm(false); form.reset(); }}
                    data-testid="button-cancel-password"
                  >
                    {t("axisBiz.collabProfile.cancel")}
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
