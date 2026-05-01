import { Component } from "react";
import { Switch, Route } from "wouter";
import { useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

class AuthErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error("AuthErrorBoundary caught:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen" style={{ background: "#060608" }}>
          <div className="text-center space-y-4 px-6 max-w-sm w-full">
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Algo deu errado. Tente recarregar a página.</p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              style={{ background: "#7A9E8A", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, cursor: "pointer" }}
            >
              Recarregar
            </button>
            {this.state.error && (
              <details style={{ textAlign: "left", marginTop: 12 }}>
                <summary style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", cursor: "pointer" }}>Ver detalhes do erro</summary>
                <code style={{ display: "block", marginTop: 8, fontSize: 10, color: "#FF6B6B", whiteSpace: "pre-wrap", wordBreak: "break-all", padding: 10, background: "rgba(255,107,107,0.06)", borderRadius: 8, border: "1px solid rgba(255,107,107,0.15)", maxHeight: 180, overflow: "auto" }}>
                  {this.state.error.message}{"\n\n"}{this.state.error.stack?.slice(0, 600)}
                </code>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import Landing from "@/pages/landing";
import PublicReport from "@/pages/PublicReport";
import AuthPage from "@/pages/auth-page";
import Welcome from "@/pages/welcome";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Finance from "@/pages/finance";
import Agenda from "@/pages/agenda";
import Tasks from "@/pages/tasks";
import Chat from "@/pages/chat";
import SettingsPage from "@/pages/settings";
import PricingPage from "@/pages/pricing";
import NotFound from "@/pages/not-found";
import PrivacyPolicy from "@/pages/privacy-policy";
import Reports from "@/pages/reports";
import BusinessLanding from "@/pages/business-landing";
import BusinessAuthPage from "@/pages/business-auth-page";
import { BusinessLayout } from "@/components/BusinessLayout";
import BusinessWelcome from "@/pages/business/BusinessWelcome";
import { BusinessThemeProvider } from "@/components/theme-provider";
import { UpgradeModal } from "@/components/upgrade-modal";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function SidebarMobileClose() {
  const { setOpenMobile } = useSidebar();
  const [location] = useLocation();

  useEffect(() => {
    setOpenMobile(false);
  }, [location, setOpenMobile]);

  return null;
}

function AuthenticatedLayout() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  const { data: profileData } = useQuery<any>({
    queryKey: ["/api/user/profile"],
    enabled: user?.accountType !== "business" && user?.accountType !== "collaborator",
  });

  const onboardingCompleted =
    profileData?.user?.onboardingCompleted === true || user?.onboardingCompleted === true
      ? true
      : (profileData?.user?.onboardingCompleted ?? user?.onboardingCompleted);

  const gatedPaths = ["/onboarding", "/welcome"];

  useEffect(() => {
    if (location.startsWith("/business")) return;
    if (onboardingCompleted === false && !gatedPaths.includes(location)) {
      setLocation("/welcome");
    }
    if (onboardingCompleted === true && gatedPaths.includes(location)) {
      setLocation("/");
    }
  }, [onboardingCompleted, location, setLocation]);

  if (location.startsWith("/business")) return null;
  if (user?.accountType === "business" || user?.accountType === "collaborator") return null;

  if (onboardingCompleted === false) {
    if (location === "/onboarding") return <Onboarding />;
    return <Welcome />;
  }

  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <SidebarMobileClose />
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-4 p-2 sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border/50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/reports" component={Reports} />
              <Route path="/finance" component={Finance} />
              <Route path="/agenda" component={Agenda} />
              <Route path="/tasks" component={Tasks} />
              <Route path="/chat" component={Chat} />
              <Route path="/settings" component={SettingsPage} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/privacy" component={PrivacyPolicy} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      if (location.startsWith("/business/app")) {
        setLocation("/business/auth");
      } else {
        const publicPaths = ["/", "/auth", "/business/auth", "/privacy", "/business", "/pricing"];
        if (!publicPaths.includes(location) && !location.startsWith("/r/")) {
          setLocation("/");
        }
      }
    }
    if (!isLoading && user) {
      if ((user.accountType === "business" || user.accountType === "collaborator") && !location.startsWith("/business") && !location.startsWith("/r/")) {
        setLocation("/business/app");
      }
      if (user.accountType === "personal" && location.startsWith("/business/app")) {
        setLocation("/pricing");
      }
    }
  }, [user, isLoading, location, setLocation]);

  return (
    <>
      <ScrollToTop />
      {renderContent()}
    </>
  );

  function renderContent() {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <AnimatePresence mode="wait">
        <Switch>
          <Route path="/auth">
            {() => (
              <ThemeProvider>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                >
                  <AuthPage />
                </motion.div>
              </ThemeProvider>
            )}
          </Route>
          <Route path="/pricing" component={PricingPage} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/business/auth">
            {() => (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <BusinessAuthPage />
              </motion.div>
            )}
          </Route>
          <Route path="/r/:token" component={PublicReport} />
          <Route path="/business" component={BusinessLanding} />
          <Route path="/">
            {() => (
              <ThemeProvider>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Landing />
                </motion.div>
              </ThemeProvider>
            )}
          </Route>
        </Switch>
      </AnimatePresence>
    );
  }

  return (
    <AuthErrorBoundary>
      <Switch>
        <Route path="/r/:token" component={PublicReport} />
        <Route path="/business/welcome">
          {() => <BusinessThemeProvider><BusinessWelcome /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/financas">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/expenses">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/bills">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/receivables">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/colaboradores">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/cashflow">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/reports">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/config">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/reembolsos">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/perfil">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/relatorio/view">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app/relatorio">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route path="/business/app">
          {() => <BusinessThemeProvider><BusinessLayout /></BusinessThemeProvider>}
        </Route>
        <Route component={PersonalAppWrapper} />
      </Switch>
    </AuthErrorBoundary>
  );
  }
}

function PersonalAppWrapper() {
  return (
    <ThemeProvider>
      <AuthenticatedLayout />
    </ThemeProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <UpgradeModal />
        <AppRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
