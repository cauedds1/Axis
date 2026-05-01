import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { LimitReachedError } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface UpgradeModalState {
  open: boolean;
  reason: string;
  plan: string;
  current?: number;
  limit?: number;
  upgradeUrl: string;
}

const PLAN_DISPLAY: Record<string, string> = {
  starter: "Starter",
  personal_ai: "Personal AI",
  team: "Team",
};

function useLang(): "en" | "pt" {
  const profile = queryClient.getQueryData<any>(["/api/user/profile"]);
  return (profile?.profile?.language ?? profile?.language ?? "en") as "en" | "pt";
}

const T = {
  en: {
    title: "Plan limit reached",
    current_usage: "Current usage",
    current_plan: "Current plan:",
    dismiss: "Not now",
    see_plans: "See plans",
  },
  pt: {
    title: "Limite do plano atingido",
    current_usage: "Uso atual",
    current_plan: "Plano atual:",
    dismiss: "Agora não",
    see_plans: "Ver planos",
  },
} as const;

export function UpgradeModal() {
  const [, setLocation] = useLocation();
  const lang = useLang();
  const t = T[lang];

  const [state, setState] = useState<UpgradeModalState>({
    open: false,
    reason: "",
    plan: "starter",
    upgradeUrl: "/pricing",
  });

  useEffect(() => {
    function handleLimitReached(e: Event) {
      const err = (e as CustomEvent<LimitReachedError>).detail;
      setState({
        open: true,
        reason: err.reason,
        plan: err.plan,
        current: err.current,
        limit: err.limit,
        upgradeUrl: err.upgradeUrl || "/pricing",
      });
    }

    window.addEventListener("axis:limit-reached", handleLimitReached);
    return () => window.removeEventListener("axis:limit-reached", handleLimitReached);
  }, []);

  function handleUpgrade() {
    setState(s => ({ ...s, open: false }));
    const url = state.upgradeUrl;
    setTimeout(() => setLocation(url), 120);
  }

  function handleClose() {
    setState(s => ({ ...s, open: false }));
  }

  const planDisplay = PLAN_DISPLAY[state.plan] ?? state.plan;

  return (
    <Dialog open={state.open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-sm" data-testid="modal-upgrade">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "rgba(122,158,138,0.15)", border: "1px solid rgba(122,158,138,0.3)" }}>
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-base">{t.title}</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {state.reason}
          </DialogDescription>
        </DialogHeader>

        {state.current !== undefined && state.limit !== undefined && (
          <div className="rounded-lg p-3 text-sm" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>{t.current_usage}</span>
              <span className="font-medium text-red-400">{state.current} / {state.limit}</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full bg-red-500" style={{ width: "100%" }} />
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {t.current_plan} <span className="font-medium text-foreground">{planDisplay}</span>
        </p>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleClose} data-testid="button-upgrade-modal-cancel">
            {t.dismiss}
          </Button>
          <Button size="sm" className="flex-1" onClick={handleUpgrade} data-testid="button-upgrade-modal-upgrade">
            <Zap className="h-3.5 w-3.5 mr-1.5" />
            {t.see_plans}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
