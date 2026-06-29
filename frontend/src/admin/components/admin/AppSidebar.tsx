import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Wallet,
  BarChart3,
  Settings,
  ShieldAlert,
  CalendarCheck,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDemoRequests } from "@/api/platform";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/admin/contexts/AuthContext";

const BASE = "/platform-control-panel";
const PLATFORM_NAME = "School Ledger";

const navGroups = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: BASE, icon: LayoutDashboard }],
  },
  {
    label: "Management",
    items: [
      { title: "Schools",       url: `${BASE}/schools`,       icon: Building2  },
      { title: "Subscriptions", url: `${BASE}/subscriptions`, icon: CreditCard },
      { title: "Finance",       url: `${BASE}/finance`,       icon: Wallet     },
      { title: "Analytics",     url: `${BASE}/analytics`,     icon: BarChart3  },
      { title: "Demo Requests", url: `${BASE}/demo-requests`, icon: CalendarCheck },
    ],
  },
  {
    label: "System",
    items: [
      { title: "Settings",     url: `${BASE}/settings`,      icon: Settings    },
      { title: "Error Logs",  url: `${BASE}/system-errors`, icon: ShieldAlert },
    ],
  },
];

function initials(name?: string): string {
  if (!name) return "PA";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "PA";
}

export function AppSidebar() {
  const { open } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { user } = useAuth();

  const demoCountQ = useQuery({
    queryKey: ["platform-demo-requests-badge"],
    queryFn:  () => getDemoRequests({ status: "new", limit: 1 }).then((r: any) => r.data?.data?.meta?.new_count ?? 0),
    staleTime: 60_000,
    refetchInterval: 5 * 60 * 1000,
    enabled: !!user,
    retry: false,
  });
  const newDemoCount: number = demoCountQ.data ?? 0;

  const isActive = (path: string) => {
    if (path === BASE) return currentPath === BASE || currentPath === `${BASE}/`;
    return currentPath.startsWith(path);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        <div className="flex items-center gap-3 border-b border-sidebar-border p-4">
          {open && (
            <>
              <img src="/favicon-96x96.png" alt="School Ledger" className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-sm" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">
                  {PLATFORM_NAME}
                </span>
                <span className="truncate text-xs text-muted-foreground">Platform Console</span>
              </div>
            </>
          )}
        </div>

        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === BASE}
                        className="flex items-center gap-3 transition-colors"
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="flex-1">{item.title}</span>
                        {item.title === "Demo Requests" && newDemoCount > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-semibold text-white">
                            {newDemoCount > 99 ? "99+" : newDemoCount}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(user?.name)}
          </div>
          {open && (
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {user?.name ?? "Platform Admin"}
              </span>
              <span className="truncate text-xs text-muted-foreground">{user?.platform_role ?? "—"}</span>
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
