import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Building2, TrendingUp, CreditCard,
  MessageSquare, Mail, Brain, Settings,
  ChevronLeft, ChevronRight, Shield, LogOut, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

import { DashboardSection } from "./sections/DashboardSection";
import { UsersSection } from "./sections/UsersSection";
import { OrgsSection } from "./sections/OrgsSection";
import { FinanceSection } from "./sections/FinanceSection";
import { BillingSection } from "./sections/BillingSection";
import { WhatsAppSection } from "./sections/WhatsAppSection";
import { EmailLogsSection } from "./sections/EmailLogsSection";
import { AISection } from "./sections/AISection";
import { SystemSection } from "./sections/SystemSection";

const NAV_ITEMS = [
  { key: "dashboard", icon: LayoutDashboard },
  { key: "users", icon: Users },
  { key: "organizations", icon: Building2 },
  { key: "finance", icon: TrendingUp },
  { key: "billing", icon: CreditCard },
  { key: "whatsapp", icon: MessageSquare },
  { key: "email", icon: Mail },
  { key: "ai", icon: Brain },
  { key: "system", icon: Settings },
] as const;

type Section = typeof NAV_ITEMS[number]["key"];

interface ImpersonateStatus {
  active: boolean;
  orgId?: string;
  orgName?: string;
  viewingUserId?: string;
}

function ImpersonationBanner() {
  const { t } = useTranslation("axisAdmin");
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const { data } = useQuery<ImpersonateStatus>({
    queryKey: ["/api/admin/impersonate/status"],
    refetchInterval: 10000,
  });

  const stopImpersonate = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/impersonate/stop"),
    onSuccess: () => {
      toast({ title: t("orgs.impersonateStopped") });
      qc.invalidateQueries({ queryKey: ["/api/admin/impersonate/status"] });
      navigate("/admin");
    },
    onError: (err: Error) => toast({ variant: "destructive", title: err?.message ?? "Error" }),
  });

  if (!data?.active) return null;

  return (
    <div className="bg-yellow-500/15 border-b border-yellow-500/30 px-4 py-2 flex items-center gap-3"
      data-testid="impersonation-banner">
      <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
      <span className="text-sm text-yellow-300 font-medium flex-1">
        {t("orgs.viewingAs")} <span className="font-bold">{data.orgName}</span>
      </span>
      <Button
        data-testid="button-stop-impersonation"
        size="sm"
        variant="outline"
        className="text-yellow-400 border-yellow-400/40 hover:bg-yellow-400/10 text-xs"
        onClick={() => stopImpersonate.mutate()}
        disabled={stopImpersonate.isPending}
      >
        {t("orgs.stopImpersonate")}
      </Button>
    </div>
  );
}

export default function AdminPanel() {
  const { t, i18n } = useTranslation("axisAdmin");
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { data: accessCheck, isLoading: checkLoading, isError } = useQuery<{ isAdmin: boolean }>({
    queryKey: ["/api/auth/is-admin"],
    retry: false,
  });

  const shouldRedirect = !checkLoading && (isError || !accessCheck?.isAdmin);

  useEffect(() => {
    if (shouldRedirect) setLocation("/");
  }, [shouldRedirect, setLocation]);

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "pt-BR" ? "en" : "pt-BR");
  };

  if (checkLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 animate-pulse" />
          {t("common.loading")}
        </div>
      </div>
    );
  }

  if (shouldRedirect) return null;

  const renderSection = () => {
    switch (section) {
      case "dashboard": return <DashboardSection />;
      case "users": return <UsersSection />;
      case "organizations": return <OrgsSection />;
      case "finance": return <FinanceSection />;
      case "billing": return <BillingSection />;
      case "whatsapp": return <WhatsAppSection />;
      case "email": return <EmailLogsSection />;
      case "ai": return <AISection />;
      case "system": return <SystemSection />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="admin-panel">
      <ImpersonationBanner />
      <div className="flex flex-1 min-h-0">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="shrink-0 bg-card border-r border-border flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  <span className="font-bold text-sm tracking-tight">{t("title")}</span>
                </div>
              </div>
              <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {NAV_ITEMS.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    data-testid={`nav-${key}`}
                    onClick={() => setSection(key)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left
                      ${section === key
                        ? "bg-accent text-foreground font-medium"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                      }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t(`nav.${key}` as Parameters<typeof t>[0])}
                  </button>
                ))}
              </nav>
              <div className="p-3 border-t border-border space-y-1">
                <Button data-testid="button-toggle-lang" variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={toggleLang}>
                  {i18n.language === "pt-BR" ? "🇧🇷 PT-BR" : "🇺🇸 EN"}
                </Button>
                <Button data-testid="button-go-app" variant="ghost" size="sm" className="w-full justify-start text-xs text-muted-foreground" onClick={() => setLocation("/")}>
                  <LogOut className="h-3.5 w-3.5 mr-2" />
                  Back to App
                </Button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="border-b border-border bg-card/50 px-4 py-3 flex items-center gap-3 shrink-0">
            <Button data-testid="button-toggle-sidebar" variant="ghost" size="sm" onClick={() => setSidebarOpen(v => !v)}>
              {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span className="font-medium text-foreground">{t(`nav.${section}` as Parameters<typeof t>[0])}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-muted-foreground">Live</span>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={section}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {renderSection()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
}
