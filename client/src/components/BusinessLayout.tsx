import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { BusinessSidebar } from "@/components/business-sidebar";
import { Switch, Route } from "wouter";
import { useLocation } from "wouter";
import { useEffect } from "react";
import BusinessHome from "@/pages/business/BusinessHome";
import BusinessExpenses from "@/pages/business/BusinessExpenses";
import BusinessBills from "@/pages/business/BusinessBills";
import BusinessReceivables from "@/pages/business/BusinessReceivables";
import BusinessCashflow from "@/pages/business/BusinessCashflow";
import BusinessReports from "@/pages/business/BusinessReports";
import BusinessFinancePage from "@/pages/business/BusinessFinancePage";
import BusinessSettingsPage from "@/pages/business/BusinessSettingsPage";

function SidebarMobileClose() {
  const { setOpenMobile } = useSidebar();
  const [location] = useLocation();
  useEffect(() => { setOpenMobile(false); }, [location, setOpenMobile]);
  return null;
}

export function BusinessLayout() {
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
              <Route path="/business/app" component={BusinessHome} />
              <Route path="/business/app/financas" component={BusinessFinancePage} />
              <Route path="/business/app/expenses" component={BusinessExpenses} />
              <Route path="/business/app/bills" component={BusinessBills} />
              <Route path="/business/app/receivables" component={BusinessReceivables} />
              <Route path="/business/app/cashflow" component={BusinessCashflow} />
              <Route path="/business/app/reports" component={BusinessReports} />
              <Route path="/business/app/config" component={BusinessSettingsPage} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
