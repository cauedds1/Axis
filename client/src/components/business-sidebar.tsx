import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuItem, SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, LogOut, AlertCircle, BarChart3,
  ReceiptText, Users, Settings, Layers, Zap, Banknote, UserCircle, FileText,
} from "lucide-react";
import {
  useBusinessTheme, getBusinessPrimaryHex, getBusinessModulePalette, isCorporateTheme,
} from "@/components/theme-provider";

function PendingBar({ count, primaryHex }: { count: number; primaryHex: string }) {
  const { t } = useTranslation();
  const hasItems = count > 0;
  const color = hasItems ? "#F59E0B" : primaryHex;
  return (
    <div className="mt-3 px-1">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <AlertCircle className="h-3 w-3" style={{ color }} />
          <span className="text-[11px] text-muted-foreground font-medium">{t("axisBiz.sidebar.approvals")}</span>
        </div>
        <span className="text-[11px] font-bold" style={{ color }}>
          {count} {t("axisBiz.sidebar.pending", { count })}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: hasItems ? `${Math.min((count / 10) * 100, 100)}%` : "5%",
            background: hasItems
              ? "linear-gradient(90deg, #F59E0B, #F59E0B99)"
              : `linear-gradient(90deg, ${primaryHex}, ${primaryHex}99)`,
            boxShadow: hasItems ? "0 0 8px rgba(245,158,11,0.6)" : `0 0 8px ${primaryHex}60`,
          }}
        />
      </div>
    </div>
  );
}

function UserAvatar({ name, email, primaryHex }: { name?: string; email?: string; primaryHex: string }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : (email?.[0] ?? "U").toUpperCase();
  return (
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: `${primaryHex}14`, border: `1px solid ${primaryHex}20`, color: primaryHex }}
    >
      {initials}
    </div>
  );
}

export function BusinessSidebar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { businessTheme } = useBusinessTheme();
  const primaryHex = getBusinessPrimaryHex(businessTheme);
  const palette = getBusinessModulePalette(businessTheme);
  const isCorporate = isCorporateTheme(businessTheme);

  const { data: orgs } = useQuery<any[]>({ queryKey: ["/api/business/organizations"] });
  const activeOrgId = orgs?.[0]?.id;
  const { data: expenses } = useQuery<any[]>({
    queryKey: ["/api/business/organizations", activeOrgId, "expenses"],
    enabled: !!activeOrgId,
  });
  const pendingCount = expenses?.filter((e: any) => e.status === "pending_review").length ?? 0;

  const isCollaborator = user?.accountType === "collaborator";

  const adminMainNav = [
    { href: "/business/app",               icon: LayoutDashboard, label: t("axisBiz.sidebar.nav.dashboard"),     color: palette.dashboard },
    { href: "/business/app/expenses",      icon: ReceiptText,     label: t("axisBiz.sidebar.nav.expenses"),      color: palette.expenses },
    { href: "/business/app/colaboradores", icon: Users,           label: t("axisBiz.sidebar.nav.collaborators"), color: palette.colaboradores },
  ];

  const adminManagementNav = [
    { href: "/business/app/reports", icon: BarChart3, label: t("axisBiz.sidebar.nav.reports"),  color: palette.reports },
    { href: "/business/app/config",  icon: Settings,  label: t("axisBiz.sidebar.nav.settings"), color: palette.config },
  ];

  const collabMainNav = [
    { href: "/business/app",          icon: LayoutDashboard, label: t("axisBiz.sidebar.nav.dashboard"), color: palette.dashboard },
    { href: "/business/app/expenses", icon: ReceiptText,     label: t("axisBiz.sidebar.nav.expenses"),  color: palette.expenses },
  ];

  const collabPersonalNav = [
    { href: "/business/app/relatorio",  icon: FileText,   label: t("axisBiz.sidebar.nav.report"),         color: palette.reports },
    { href: "/business/app/reembolsos", icon: Banknote,   label: t("axisBiz.sidebar.nav.reimbursements"), color: palette.expenses },
    { href: "/business/app/perfil",     icon: UserCircle, label: t("axisBiz.sidebar.nav.profile"),        color: palette.colaboradores },
  ];

  const mainNav = isCollaborator ? collabMainNav : adminMainNav;
  const managementNav = isCollaborator ? collabPersonalNav : adminManagementNav;
  const managementLabel = isCollaborator ? t("axisBiz.sidebar.personal") : t("axisBiz.sidebar.management");

  function NavItem({ item }: { item: typeof mainNav[0] }) {
    const isActive = location === item.href;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild isActive={isActive}
          data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          className="h-10 gap-3 rounded-xl transition-all duration-200"
        >
          <Link href={item.href} className="flex items-center gap-3">
            <item.icon
              className="h-4 w-4 flex-shrink-0"
              style={{ color: isActive ? item.color : "hsl(var(--muted-foreground))" }}
            />
            <span className="text-sm font-medium transition-colors duration-200" style={isActive ? { color: item.color } : {}}>
              {item.label}
            </span>
            {isActive && (
              <div className="ml-auto w-1 h-3.5 rounded-full" style={{ background: item.color, opacity: 0.7 }} />
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Sidebar data-testid="sidebar-business">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/business/app" data-testid="link-business-sidebar-logo" className="flex items-center gap-2.5 group">
          <img src="/logo-business.png" alt="AXIS Business" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-none">
              <span style={{ color: "hsl(var(--foreground))" }}>AXIS</span>{" "}
              <span style={{ color: primaryHex }}>Business</span>
            </h1>
            <span className="text-[10px] text-muted-foreground font-medium tracking-wide mt-0.5 block">
              {t("axisBiz.sidebar.expenseControl")}
            </span>
          </div>
        </Link>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isCorporate
              ? <Layers className="h-3 w-3" style={{ color: primaryHex, opacity: 0.7 }} />
              : <Zap className="h-3 w-3" style={{ color: primaryHex }} />
            }
            <span className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: primaryHex, opacity: isCorporate ? 0.7 : 1 }}>
              {isCorporate ? t("axisBiz.themeSelector.corporate") : t("axisBiz.themeSelector.executive")}
            </span>
          </div>
        </div>

        <PendingBar count={pendingCount} primaryHex={primaryHex} />
      </SidebarHeader>

      <SidebarContent className="p-2 pt-2">
        <SidebarMenu>
          {mainNav.map((item) => <NavItem key={item.href} item={item} />)}
        </SidebarMenu>

        <div className="mx-3 my-1 h-px bg-sidebar-border/60" />

        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 px-3 pt-3 pb-1.5">
          {managementLabel}
        </p>
        <SidebarMenu>
          {managementNav.map((item) => <NavItem key={item.href} item={item} />)}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 mb-3">
          <UserAvatar name={user?.firstName} email={user?.email} primaryHex={primaryHex} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user?.email}
            </p>
            {user?.firstName && (
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] py-2 px-3 rounded-lg transition-colors hover:bg-red-500/10"
          style={{ color: "#f87171" }}
          data-testid="button-business-logout"
        >
          <LogOut className="h-3.5 w-3.5" />
          {t("axisBiz.sidebar.logout")}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
