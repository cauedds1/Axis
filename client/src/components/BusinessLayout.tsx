import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { BusinessSidebar } from "@/components/business-sidebar";
import { Switch, Route } from "wouter";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import BusinessHome from "@/pages/business/BusinessHome";
import BusinessExpenses from "@/pages/business/BusinessExpenses";
import BusinessCollaborators from "@/pages/business/BusinessCollaborators";
import BusinessReports from "@/pages/business/BusinessReports";
import BusinessSettingsPage from "@/pages/business/BusinessSettingsPage";
import CollaboratorHome from "@/pages/business/CollaboratorHome";
import CollaboratorReimbursements from "@/pages/business/CollaboratorReimbursements";
import CollaboratorProfile from "@/pages/business/CollaboratorProfile";
import CollaboratorReport from "@/pages/business/CollaboratorReport";

function SidebarMobileClose() {
  const { setOpenMobile } = useSidebar();
  const [location] = useLocation();
  useEffect(() => { setOpenMobile(false); }, [location, setOpenMobile]);
  return null;
}

export function BusinessLayout() {
  const { user } = useAuth();
  const isCollaborator = user?.accountType === "collaborator";

  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <SidebarMobileClose />
      <div className="flex h-screen w-full">
        <BusinessSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-4 p-2 sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-sm">
            <SidebarTrigger data-testid="button-business-sidebar-toggle" />
          </header>
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/business/app">
                {isCollaborator ? <CollaboratorHome /> : <BusinessHome />}
              </Route>
              <Route path="/business/app/expenses" component={BusinessExpenses} />
              <Route path="/business/app/colaboradores" component={BusinessCollaborators} />
              <Route path="/business/app/reports" component={BusinessReports} />
              <Route path="/business/app/config" component={BusinessSettingsPage} />
              <Route path="/business/app/relatorio" component={CollaboratorReport} />
              <Route path="/business/app/reembolsos" component={CollaboratorReimbursements} />
              <Route path="/business/app/perfil" component={CollaboratorProfile} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
