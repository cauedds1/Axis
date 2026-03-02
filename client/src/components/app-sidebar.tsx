import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
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
import { Home, DollarSign, Calendar, CheckSquare, MessageCircle, LogOut, Settings, Flame, Zap, BarChart2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme, getPrimaryHex, getModulePalette } from "@/components/theme-provider";
import { DisciplinePanel } from "@/components/discipline-panel";

function ScoreBar({ score, isHigh, palette }: { score: number; isHigh: boolean; palette: { primary: string; positive: string; negative: string } }) {
  const pct = (score / 10) * 100;

  const color = score <= 4 ? palette.negative : score <= 7 ? palette.primary : palette.positive;

  return (
    <div className="mt-3 px-1">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Flame
            className={`h-3 w-3 ${isHigh ? "high-flame" : ""}`}
            style={{ color: isHigh ? palette.negative : palette.primary }}
          />
          <span className="text-[11px] text-muted-foreground font-medium">Disciplina</span>
        </div>
        <span
          className={`text-[11px] font-bold ${isHigh ? "high-score-text" : ""}`}
          style={{ color }}
          data-testid="text-discipline-score"
        >
          {score}/10
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}, ${color}99)`,
            boxShadow: `0 0 8px ${color}60`,
          }}
        />
      </div>
    </div>
  );
}

function NavIconHigh({ icon: Icon, color }: { icon: any; color: string }) {
  return (
    <div
      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200"
      style={{ background: `${color}14`, border: `1px solid ${color}22` }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color }} />
    </div>
  );
}

function NavIconSlim({ icon: Icon, color }: { icon: any; color: string }) {
  return <Icon className="h-4 w-4 flex-shrink-0" style={{ color }} />;
}

function UserAvatar({ name, email, isHigh, primaryHex }: { name?: string; email?: string; isHigh: boolean; primaryHex: string }) {
  const initials = name
    ? name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
    : (email?.[0] ?? "U").toUpperCase();

  return (
    <div
      className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{
        background: `${primaryHex}${isHigh ? "30" : "14"}`,
        border: `1px solid ${primaryHex}${isHigh ? "28" : "20"}`,
        color: primaryHex,
      }}
    >
      {initials}
    </div>
  );
}

export function AppSidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { theme } = useTheme();
  const isHigh = theme.startsWith("high");
  const P = getModulePalette(theme);
  const [showDiscipline, setShowDiscipline] = useState(false);

  const { data: dashData } = useQuery<any>({ queryKey: ["/api/dashboard"] });

  const activeModules: string[] = dashData?.activeModules || [];
  const disciplineScore  = dashData?.disciplineScore  || 5;
  const disciplinePoints = dashData?.disciplinePoints ?? 0;

  const navItems: Array<{ label: string; icon: any; path: string; active: boolean; color: string }> = [
    { label: "Início", icon: Home, path: "/", active: location === "/" || location === "/dashboard", color: P.início },
    { label: "Relatórios", icon: BarChart2, path: "/reports", active: location === "/reports", color: P.primary },
  ];

  if (activeModules.length === 0 || activeModules.includes("finance")) {
    navItems.push({ label: "Finanças", icon: DollarSign, path: "/finance", active: location === "/finance", color: P.finance });
  }
  if (activeModules.length === 0 || activeModules.includes("schedule")) {
    navItems.push({ label: "Agenda", icon: Calendar, path: "/agenda", active: location === "/agenda", color: P.agenda });
  }
  if (activeModules.length === 0 || activeModules.includes("tasks") || activeModules.includes("habits")) {
    navItems.push({ label: "Tarefas", icon: CheckSquare, path: "/tasks", active: location === "/tasks", color: P.tasks });
  }
  navItems.push({ label: "Chat", icon: MessageCircle, path: "/chat", active: location === "/chat", color: P.chat });

  return (
    <>
    <DisciplinePanel
      open={showDiscipline}
      onClose={() => setShowDiscipline(false)}
      score={disciplineScore}
      disciplinePoints={disciplinePoints}
    />
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" data-testid="link-sidebar-logo" className="flex items-center gap-2.5 group">
          <div className="relative">
            <img src="/logo.png" alt="AXIS" className="w-10 h-10 rounded-xl object-cover" />
            {isHigh && (
              <div
                className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ boxShadow: `0 0 14px ${P.primary}50` }}
              />
            )}
          </div>
          <div>
            <h1
              className="text-lg font-bold tracking-tight leading-none"
              style={
                isHigh
                  ? {
                      background: `linear-gradient(135deg, #fff 30%, ${P.primary})`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }
                  : { color: "hsl(var(--foreground))" }
              }
            >
              AXIS
            </h1>
            {isHigh ? (
              <div className="flex items-center gap-1 mt-0.5">
                <Zap className="h-2.5 w-2.5" style={{ color: P.primary }} />
                <span className="text-[10px] text-muted-foreground font-medium tracking-wide">HIGH MODE</span>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide mt-0.5 block">
                Focus Mode
              </span>
            )}
          </div>
        </Link>
        <div
          className="cursor-pointer hover:opacity-75 transition-opacity duration-200 rounded-lg"
          onClick={() => setShowDiscipline(true)}
          title="Ver histórico de disciplina"
          data-testid="button-open-discipline"
        >
          <ScoreBar score={disciplineScore} isHigh={isHigh} palette={P} />
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2 pt-3">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.path}>
              <SidebarMenuButton
                asChild
                isActive={item.active}
                data-testid={`link-nav-${item.label.toLowerCase()}`}
                className="h-10 gap-3 rounded-xl transition-all duration-200"
              >
                <Link href={item.path} className="flex items-center gap-3">
                  {isHigh ? (
                    <NavIconHigh
                      icon={item.icon}
                      color={item.active ? item.color : item.color + "70"}
                    />
                  ) : (
                    <NavIconSlim
                      icon={item.icon}
                      color={item.active ? item.color : "hsl(var(--muted-foreground))"}
                    />
                  )}
                  <span
                    className="text-sm font-medium transition-colors duration-200"
                    style={item.active ? { color: item.color } : {}}
                  >
                    {item.label}
                  </span>
                  {item.active && isHigh && (
                    <div
                      className="ml-auto w-1.5 h-1.5 rounded-full"
                      style={{ background: item.color, boxShadow: `0 0 6px ${item.color}` }}
                    />
                  )}
                  {item.active && !isHigh && (
                    <div
                      className="ml-auto w-1 h-3.5 rounded-full"
                      style={{ background: item.color, opacity: 0.7 }}
                    />
                  )}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5 mb-3">
          <UserAvatar name={user?.firstName} email={user?.email} isHigh={isHigh} primaryHex={P.primary} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {user?.firstName ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}` : user?.email}
            </p>
            {user?.firstName && (
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            )}
          </div>
          <ThemeToggle />
        </div>
        <div className="flex gap-2">
          <Link
            href="/settings"
            className="flex-1 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-sidebar-foreground transition-colors py-2 px-3 rounded-lg hover:bg-sidebar-accent"
            data-testid="link-settings"
          >
            <Settings className="h-3.5 w-3.5" />
            Config
          </Link>
          <button
            onClick={() => logout()}
            className="flex items-center justify-center gap-1.5 text-[11px] py-2 px-3 rounded-lg transition-colors hover:bg-red-500/10"
            style={{ color: "#f87171" }}
            data-testid="button-logout"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
    </>
  );
}
