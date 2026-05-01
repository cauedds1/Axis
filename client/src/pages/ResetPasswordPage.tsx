import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, AlertTriangle } from "lucide-react";

export default function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token") || "";
    setToken(t);
  }, []);

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/auth/reset-password", { token, newPassword }).then((r) => r.json()),
    onSuccess: () => {
      setDone(true);
      toast({ title: "Senha redefinida com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err?.message || "Link inválido ou expirado.", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Senha muito curta", description: "Mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirm) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1a1d2e] border border-white/10 rounded-2xl p-8 space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <ShieldCheck className="w-10 h-10 text-indigo-400" />
          <h1 className="text-xl font-semibold text-white">Redefinir Senha</h1>
          <p className="text-sm text-white/50">Reset Password</p>
        </div>

        {!token && (
          <div className="flex items-center gap-2 text-amber-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            Link inválido — token ausente.
          </div>
        )}

        {done ? (
          <div className="space-y-4 text-center">
            <p className="text-green-400 text-sm">Senha atualizada! Faça login com sua nova senha.</p>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Ir para Login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">Nova Senha</Label>
              <Input
                data-testid="input-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">Confirmar Senha</Label>
              <Input
                data-testid="input-confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a senha"
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
              {mutation.isPending ? "Salvando..." : "Redefinir Senha"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
