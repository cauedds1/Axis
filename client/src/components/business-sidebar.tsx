import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  ReceiptText,
  LogOut,
  AlertCircle,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
} from "lucide-react";

const PRIMARY = "#2563EB";
const PRIMARY_LIGHT = "#3B82F6";

function PendingBar({ count }: { count: number }) {
  const hasItems = count > 0;
  const color = hasItems ? "#F59E0B" : PRIMARY_LIGHT;

  return (
    <div className="mt-3 px-1">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" style={{ color }} />
          <span className="text-[11px] text-muted-foreground font-medium">Aprovações</span>
        </div>
        <span className="text-[11px] font-bold" style={{ color }}>
          {count} {count === 1 ? "pendente" : "pendentes"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: hasItems ? `${Math.min((count / 10) * 100, 100)}%` : "5%",
            background: hasItems
              ? "linear-gradient(90deg, #F59E0B, #F59E0B99)"
              : `linear-gradient(90deg, ${PRIMARY_LIGHT}, ${PRIMARY_LIGHT}99)`,
            boxShadow: hasItems ? "0 0 8px rgba(245,158,11,0.6)" : `0 0 8px ${PRIMARY_LIGHT}60`,
          }}
        />
      </div>
    </div>
  );
}

function UserAvatar({ name, email }: { name?: string; email?: string }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : (email?.[0] ?? "U").toUpperCase();

  return (
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{
        background: `${PRIMARY}14`,
        border: `1px solid ${PRIMARY}20`,
        color: PRIMARY_LIGHT,
      }}
    >
      {initials}
    </div>
  );
}

const mainNav = [
  { href: "/business/app", icon: LayoutDashboard, label: "Dashboard", color: PRIMARY_LIGHT },
  { href: "/business/app/expenses", icon: ReceiptText, label: "Despesas", color: "#6366F1" },
];

const financeNav = [
  { href: "/business/app/cashflow", icon: TrendingUp, label: "Fluxo de Caixa", color: "#0EA5E9" },
  { href: "/business/app/bills", icon: ArrowDownCircle, label: "Contas a Pagar", color: "#F87171" },
  { href: "/business/app/receivables", icon: ArrowUpCircle, label: "Contas a Receber", color: "#34D399" },
];

const managementNav = [
  { href: "/business/app/reports", icon: BarChart3, label: "Relatórios", color: "#A78BFA" },
];

function NavGroup({ label, items, location }: { label?: string; items: typeof mainNav; location: string }) {
  return (
    <div className="mb-1">
      {label && (
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-3 pt-3 pb-1.5">
          {label}
        </p>
      )}
      <SidebarMenu>
        {items.map((item) => {
          const isActive = location === item.href;
          return (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="h-10 gap-3 rounded-xl transition-all duration-200"
              >
                <Link href={item.href} className="flex items-center gap-3">
                  <item.icon
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: isActive ? item.color : "hsl(var(--muted-foreground))" }}
                  />
                  <span
                    className="text-sm font-medium transition-colors duration-200"
                    style={isActive ? { color: item.color } : {}}
                  >
                    {item.label}
                  </span>
                  {isActive && (
                    <div
                      className="ml-auto w-1 h-3.5 rounded-full"
                      style={{ background: item.color, opacity: 0.7 }}
                    />
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </div>
  );
}

export function BusinessSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const { data: orgs } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const activeOrgId = orgs?.[0]?.id;
  const { data: expenses } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrgId, "expenses"],
    enabled: !!activeOrgId,
  });
  const pendingCount = expenses?.filter((e: any) => e.status === "pending_review").length ?? 0;

  return (
    <Sidebar data-testid="sidebar-business">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/business/app" data-testid="link-business-sidebar-logo" className="flex items-center gap-2.5 group">
          <img src="/logo-business.png" alt="AXIS Business" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">
              <span style={{ color: "hsl(var(--foreground))" }}>AXIS</span>
              {" "}
              <span style={{ color: PRIMARY_LIGHT }}>Business</span>
            </h1>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide mt-0.5 block">
              Gestão corporativa
            </span>
          </div>
        </Link>
        <PendingBar count={pendingCount} />
      </SidebarHeader>

      <SidebarContent className="p-2 pt-2">
        <NavGroup items={mainNav} location={location} />
        <div className="mx-3 my-1 h-px bg-sidebar-border/60" />
        <NavGroup label="Financeiro" items={financeNav} location={location} />
        <div className="mx-3 my-1 h-px bg-sidebar-border/60" />
        <NavGroup label="Gestão" items={managementNav} location={location} />
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 mb-3">
          <UserAvatar name={user?.firstName} email={user?.email} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user?.email}
            </p>
            {user?.firstName && (
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => logout()}
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 px-3 rounded-lg transition-colors hover:bg-red-500/10"
            style={{ color: "#f87171" }}
            data-testid="button-business-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
