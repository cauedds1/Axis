import { useAuth } from "@/hooks/use-auth";
import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Building2, ReceiptText, ArrowLeft, LogOut, Settings } from "lucide-react";

const BLUE = "#2563EB";
const BLUE_LIGHT = "#3B82F6";

const navItems = [
  { href: "/business/app", icon: Building2, label: "Minha Empresa" },
  { href: "/business/app/expenses", icon: ReceiptText, label: "Despesas" },
];

export function BusinessSidebar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();

  const initials = user
    ? `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"
    : "U";

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-border/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: BLUE }}>
            <Building2 className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold tracking-tight text-foreground">AXIS</span>
              <span className="text-sm font-bold tracking-tight" style={{ color: BLUE_LIGHT }}>Business</span>
            </div>
            <span className="text-[10px] text-muted-foreground truncate">Gestão corporativa</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = location === href;
            return (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton asChild isActive={isActive} data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                  <Link href={href}>
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200"
                      style={{
                        background: isActive ? `${BLUE}20` : "transparent",
                        border: isActive ? `1px solid ${BLUE}35` : "1px solid transparent",
                      }}
                    >
                      <Icon className="w-4 h-4" style={{ color: isActive ? BLUE_LIGHT : undefined }} />
                    </div>
                    <span className="text-sm font-medium" style={{ color: isActive ? BLUE_LIGHT : undefined }}>
                      {label}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>

        <div className="mt-4 pt-4 border-t border-border/30">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild data-testid="nav-back-personal">
                <Link href="/">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">AXIS Pessoal</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/40">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: BLUE }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate text-foreground">{user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings" className="flex-1">
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              data-testid="button-business-settings"
            >
              <Settings className="w-3.5 h-3.5" />
              Configurações
            </button>
          </Link>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            data-testid="button-business-logout"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
