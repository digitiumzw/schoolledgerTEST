/**
 * ============================================
 * APP HEADER - Top Bar Component
 * ============================================
 * 
 * This is the TOP BAR that appears at the top of every page.
 * 
 * Features:
 * - School name display
 * - User name
 * - Theme toggle (dark/light mode)
 * - Logout button
 * - Sidebar collapse/expand button
 * 
 * The header is "sticky" meaning it stays visible when scrolling.
 * 
 * Related files:
 * - src/contexts/AuthContext.tsx (provides user and logout function)
 */

// Icon components from Lucide React
import { Moon, Sun, LogOut, RefreshCw } from "lucide-react";

// UI components
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Notification components
import { NotificationIcon, NotificationDropdown } from "@/components/notifications";

// Theme management (dark/light mode)
import { useTheme } from "next-themes";

// Authentication context (user data and logout)
import { useAuth } from "@/contexts/AuthContext";

// Navigation hook (for redirecting after logout)
import { useNavigate } from "react-router-dom";

// React hooks for state and effects
import { useState, useEffect } from "react";

// Global data refresh hook
import { useGlobalRefresh } from "@/hooks/useGlobalRefresh";

// Notifications hook
import { useNotifications } from "@/hooks/useNotifications";

// Mock API for data fetching
import { api, apiRequest } from "@/api/api";

/**
 * ==================== MAIN COMPONENT ====================
 * 
 * The AppHeader component that renders the top bar.
 */
export function AppHeader() {
  /**
   * ==================== HOOKS & STATE ====================
   */
  
  // Theme management (dark/light mode)
  const { theme, setTheme } = useTheme();

  // Global data refresh
  const { isRefreshing, refreshAll } = useGlobalRefresh();
  
  // Notifications
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    dismissNotification,
    handleNotificationClick,
  } = useNotifications();
  
  // Authentication (user info and logout function)
  const { user, logout } = useAuth();
  
  // Navigation (for redirecting to login after logout)
  const navigate = useNavigate();
  
  // School name (loaded from settings)
  const [schoolName, setSchoolName] = useState("School Management System");

  /**
   * ==================== LOAD DATA ON MOUNT ====================
   * 
   * Runs when component first renders and when user changes.
   * 
   * What it loads:
   * 1. School name (for all users)
   * 2. Listens for settings updates (if admin changes school name)
   */
  useEffect(() => {
    // Load school name
    loadSchoolName();
    
    /**
     * Listen for settings updates
     * 
     * When admin saves settings in Settings page, it fires
     * a 'settingsUpdated' event. We listen for it here to
     * update the school name without page refresh.
     */
    const handleSettingsUpdate = (event: CustomEvent<{ schoolName: string }>) => {
      setSchoolName(event.detail.schoolName);
    };
    
    // Add event listener
    window.addEventListener('settingsUpdated', handleSettingsUpdate);
    
    // Cleanup: Remove event listener when component unmounts
    return () => window.removeEventListener('settingsUpdated', handleSettingsUpdate);
  }, [user]); // Re-run if user changes (login/logout)

  /**
   * ==================== LOAD SCHOOL NAME ====================
   * 
   * Fetches school name from settings API.
   * Falls back to "School Management System" if fetch fails.
   */
  const loadSchoolName = async () => {
    try {
      const settings = await api.getSettings();
      setSchoolName(settings.schoolName || "School Management System");
    } catch (error) {
      console.error('Failed to load school name:', error);
    }
  };

  /**
   * ==================== TOGGLE THEME ====================
   * 
   * Switches between light and dark mode.
   * 
   * How it works:
   * - If currently dark → switch to light
   * - If currently light → switch to dark
   * 
   * The theme is persisted in localStorage automatically
   * by the ThemeProvider component.
   */
  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  /**
   * ==================== HANDLE LOGOUT ====================
   * 
   * Logs out the current user and redirects to login.
   * 
   * Flow:
   * 1. Call logout() from AuthContext
   *    - Clears user from state
   *    - Clears user from localStorage
   * 2. Navigate to /login page
   */
  const handleLogout = () => {
    logout(); // Clear auth state
    navigate('/login'); // Redirect to login
  };

  /**
   * ==================== RENDER HEADER ====================
   */
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Header content container with fixed height */}
      <div className="flex h-14 items-center gap-4 px-4">
        {/* Sidebar collapse/expand button (hamburger menu) */}
        <SidebarTrigger className="-ml-1" />
        
        {/* Main header content (space-between pushes items to edges) */}
        <div className="flex flex-1 items-center justify-between">
          {/* LEFT SIDE: School name */}
          <div className="flex items-center gap-2 min-w-0">
            {/* School name */}
            <h1 className="text-sm sm:text-lg font-semibold text-foreground truncate max-w-[100px] sm:max-w-[220px] md:max-w-none">
              {schoolName}
            </h1>
          </div>

          {/* RIGHT SIDE: User name + theme toggle + logout button */}
          <div className="flex items-center gap-2">
            {/* User's name (hidden on small screens) */}
            {user && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {user.name}
              </span>
            )}
            
            {/* Refresh data button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={refreshAll}
              disabled={isRefreshing}
              aria-label={isRefreshing ? "Refreshing..." : "Refresh data"}
              className="h-9 w-9"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="sr-only">{isRefreshing ? "Refreshing..." : "Refresh data"}</span>
            </Button>

            {/* Notifications icon with dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <div>
                  <NotificationIcon
                    unreadCount={unreadCount}
                    isLoading={notificationsLoading}
                    onClick={() => {}}
                  />
                </div>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={4} className="p-0">
                <NotificationDropdown
                  notifications={notifications}
                  unreadCount={unreadCount}
                  isLoading={notificationsLoading}
                  onDismiss={dismissNotification}
                  onNotificationClick={handleNotificationClick}
                />
              </PopoverContent>
            </Popover>

            {/* Theme toggle button (sun/moon icon) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
            >
              {/* Sun icon (visible in light mode, hidden in dark mode) */}
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              {/* Moon icon (hidden in light mode, visible in dark mode) */}
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              {/* Screen reader text */}
              <span className="sr-only">Toggle theme</span>
            </Button>
            
            {/* Logout button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9"
            >
              {/* Logout icon */}
              <LogOut className="h-5 w-5" />
              {/* Screen reader text */}
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
