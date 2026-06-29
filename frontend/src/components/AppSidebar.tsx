/**
 * ============================================
 * APP SIDEBAR - Navigation Menu Component
 * ============================================
 * 
 * This is the LEFT-SIDE navigation menu that users click to move between pages.
 * 
 * Features:
 * - Shows different menu items based on user role
 * - Highlights the current active page
 * - Displays school logo and user name
 * - Collapsible to icon-only mode (saves screen space)
 * 
 * User Role Access:
 * - Super Admin: Sees all menu items (including User Accounts in Settings)
 * - Admin: Sees all menu items except User Accounts tab
 * - Teacher: Only sees "Attendance" and "Help"
 * - HR: Only sees "Staff", "Staff Attendance", and "Help"
 * 
 * Related files:
 * - src/components/ui/sidebar.tsx (UI components)
 * - src/components/NavLink.tsx (link with active state styling)
 * - src/contexts/AuthContext.tsx (provides user role)
 */

// Navigation component with active link highlighting
import { NavLink } from "@/components/NavLink";

// React Router hook to get current URL
import { useLocation } from "react-router-dom";

// Authentication context to get user role
import { useAuth } from "@/contexts/AuthContext";

// React hooks for state management
import { useState } from "react";

// Data fetching
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/api";
import { useRestartTutorial } from "@/hooks/useTutorial";
import { toast } from "sonner";

// Icon library (Lucide React)
import {
  LayoutDashboard,  // Dashboard icon
  Users,            // Students icon
  UsersRound,       // Staff icon
  CreditCard,       // Payments icon
  ClipboardCheck,   // Attendance icon
  Settings,         // Settings icon
  GraduationCap,    // Classes icon (also school logo)
  UserCheck,        // Staff Attendance icon
  Bus,              // Transport icon
  Megaphone,        // Fee Campaigns icon
  Crown,            // Subscription icon
  HelpCircle        // Help icon
} from "lucide-react";

// Sidebar UI components from shadcn/ui
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

/**
 * ==================== NAVIGATION ITEMS ====================
 * 
 * Master list of ALL possible navigation items.
 * 
 * Each item has:
 * - title: Display name
 * - url: Route path
 * - icon: Lucide icon component
 * 
 * Note: This array includes ALL items.
 * The actual displayed items are filtered by user role later.
 */
// Navigation item type
interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Students", url: "/students", icon: Users },
  { title: "Classes", url: "/classes", icon: GraduationCap },
  { title: "Staff", url: "/staff", icon: UsersRound },
  { title: "Staff Attendance", url: "/s-attendance", icon: UserCheck },
  { title: "Transport", url: "/transport", icon: Bus },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Fee Campaigns", url: "/fee-campaigns", icon: Megaphone },
  { title: "Student Attendance", url: "/attendance", icon: ClipboardCheck },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Subscription", url: "/billing", icon: Crown },
  { title: "Help", url: "/help", icon: HelpCircle },
];

/**
 * ==================== MAIN COMPONENT ====================
 * 
 * The AppSidebar component that renders the navigation menu.
 */
export function AppSidebar() {
  /**
   * STATE & HOOKS
   */
  
  // Get sidebar open/closed state from SidebarProvider
  const { open, isMobile, setOpenMobile } = useSidebar();

  // Get current URL path (e.g., "/students", "/payments")
  const location = useLocation();
  const currentPath = location.pathname;

  // Get current logged-in user
  const { user } = useAuth();
  const restartTutorial = useRestartTutorial();

  // Fetch the tenant's school name from the database
  const { data: tenant } = useQuery({
    queryKey: ['current-tenant'],
    queryFn: api.getCurrentTenant,
    staleTime: 10 * 60 * 1000,
    enabled: !!user,
  });

  const schoolName = tenant?.schoolName ?? tenant?.name ?? null;

  /**
   * FUNCTION: Check if a route is active
   * 
   * Used to highlight the current page in the sidebar.
   * 
   * Logic:
   * - For root "/" → only active if path is exactly "/"
   * - For other paths → active if current path STARTS with that path
   *   (e.g., "/settings" is active for "/settings/users")
   * 
   * @param path - The route path to check
   * @returns true if this path should be highlighted
   */
  const isActive = (path: string) => {
    // Special case: root path must match exactly
    if (path === "/") return currentPath === "/";
    
    // Other paths: check if current path starts with this path
    // This handles nested routes like /settings/users, /settings/general
    return currentPath.startsWith(path);
  };

  /**
   * FUNCTION: Filter navigation items by user role
   * 
   * Different users see different menu items based on their role.
   * 
   * Role Access Rules:
   * - Super Admin: All items (full access including User Accounts)
   * - Admin: All items (full access except User Accounts in Settings)
   * - Teacher: Only "Attendance" (can mark student register)
   * - Bursar: "Payments", "Fee Campaigns", "Students", "Transport"
   * 
   * Why filter?
   * - Keeps UI clean (don't show inaccessible pages)
   * - Prevents confusion (users only see what they can use)
   * - Security: Even if teacher manually types "/students" in URL,
   *   ProtectedRoute will block them
   * 
   * @returns Filtered array of navigation items for current user
   */
  const getFilteredNavItems = () => {
    // If no user logged in, show nothing
    if (!user) return [];

    // Filter based on user's role
    switch (user.role) {
      case 'super_admin':
        // Super Admin sees everything (full access)
        return navItems;
      
      case 'admin':
        // Admin sees everything (User Accounts restriction is in Settings)
        return navItems;
        
      case 'bursar':
        // Bursar sees Payments, Fee Campaigns, Students, Transport, and Help
        return navItems.filter(item =>
          ['Payments', 'Fee Campaigns', 'Students', 'Transport', 'Help'].includes(item.title)
        );

      case 'hr':
        // HR sees Staff, Staff Attendance, and Help only
        return navItems.filter(item =>
          ['Staff', 'Staff Attendance', 'Help'].includes(item.title)
        );

      case 'teacher':
        return navItems.filter(item =>
          ['Attendance', 'Help'].includes(item.title)
        );

      default:
        // Unknown role (shouldn't happen, but safety first)
        return [];
    }
  };

  // Get the filtered menu items for current user
  const filteredNavItems = getFilteredNavItems();

  async function handleRestartTutorial() {
    try {
      await restartTutorial.mutateAsync();
      toast.success('Tutorial restarted.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restart tutorial.');
    }
  }

  /**
   * ==================== RENDER SIDEBAR ====================
   */
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarContent>
        {/* ==================== SCHOOL LOGO & NAME ==================== */}
        {/* Outer div preserved to maintain vertical space; contents hidden when collapsed */}
        <div className="flex items-center gap-3 p-4 border-b border-sidebar-border">
          {open && (
            <>
              {/* Logo image */}
              <img src="/favicon-96x96.png" alt="School Ledger" className="h-10 w-10 rounded-lg object-cover" />
              
              {/* School name and user name */}
              <div className="flex flex-col min-w-0">
                {/* School name from database */}
                <span className="text-sm font-semibold text-sidebar-foreground truncate">
                  {schoolName ?? 'School Portal'}
                </span>
                {/* User's name or fallback text */}
                <span className="text-xs text-muted-foreground truncate">
                  {user?.name || 'Portal'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* ==================== NAVIGATION MENU ==================== */}
        <SidebarGroup>
          {/* Section label */}
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Loop through filtered nav items and render each */}
              {filteredNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 transition-colors"
                      onClick={isMobile ? () => setOpenMobile(false) : undefined}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="flex-1">{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button
                    type="button"
                    onClick={handleRestartTutorial}
                    disabled={restartTutorial.isPending}
                    className="flex w-full items-center gap-2"
                  >
                    <HelpCircle className="h-4 w-4" />
                    {open && <span>Restart tutorial</span>}
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
