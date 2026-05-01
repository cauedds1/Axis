import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tk = params.get("token") || "";
    setToken(tk);
  }, []);

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/auth/reset-password", { token, newPassword }).then((r) => r.json()),
    onSuccess: () => {
      setDone(true);
      toast({ title: t("axisAuth.forgotSubDone") });
    },
    onError: (err: any) => {
      toast({
        title: t("common.error", "Error"),
        description: err?.message || t("resetPage.invalidLink", "Invalid or expired link."),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({
        title: t("resetPage.tooShort", "Password too short"),
        description: t("axisAuth.forgotNewPwPh"),
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirm) {
      toast({ title: t("resetPage.mismatch", "Passwords don't match"), variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1a1d2e] border border-white/10 rounded-2xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="w-10 h-10 text-indigo-400" />
          <h1 className="text-xl font-semibold text-white">{t("axisAuth.forgotTitle")}</h1>
        </div>

        {!token && (
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {t("resetPage.invalidToken", "Invalid link — token missing.")}
          </div>
        )}

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-green-400 text-sm">{t("axisAuth.forgotDoneMsg")}</p>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              {t("axisAuth.forgotGoToLogin")}
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">{t("axisAuth.forgotNewPwLabel")}</Label>
              <Input
                data-testid="input-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("axisAuth.forgotNewPwPh")}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">{t("axisAuth.forgotConfirmLabel")}</Label>
              <Input
                data-testid="input-confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={t("axisAuth.forgotConfirmPh")}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
              />
            </div>
            <Button
              data-testid="button-reset-submit"
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
              disabled={mutation.isPending || !token}
            >
              {mutation.isPending ? t("axisAuth.forgotSaving") : t("axisAuth.forgotResetBtn")}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
