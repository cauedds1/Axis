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

import Landing from "@/pages/landing";
import AuthPage from "@/pages/auth-page";
import Welcome from "@/pages/welcome";
import Onboarding from "@/pages/onboarding";
import Dashboard from "@/pages/dashboard";
import Finance from "@/pages/finance";
import Agenda from "@/pages/agenda";
import Tasks from "@/pages/tasks";
import Chat from "@/pages/chat";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";
import PrivacyPolicy from "@/pages/privacy-policy";
import Reports from "@/pages/reports";

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
  });

  const onboardingCompleted = profileData?.user?.onboardingCompleted ?? user?.onboardingCompleted;

  const gatedPaths = ["/onboarding", "/welcome"];

  useEffect(() => {
    if (onboardingCompleted === false && !gatedPaths.includes(location)) {
      setLocation("/welcome");
    }
  }, [onboardingCompleted, location, setLocation]);

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
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <AuthPage />
              </motion.div>
            )}
          </Route>
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/">
            {() => (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Landing />
              </motion.div>
            )}
          </Route>
        </Switch>
      </AnimatePresence>
    );
  }

  return <AuthenticatedLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
