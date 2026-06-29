// @refresh reset
/**
 * ============================================
 * AUTHENTICATION CONTEXT - Login State Management
 * ============================================
 * 
 * This file manages WHO is logged in and their permissions.
 * It's like a "security guard" that tracks the current user.
 * 
 * What it provides:
 * - user: Currently logged-in user (or null if not logged in)
 * - login(email, password): Function to log in
 * - logout(): Function to log out
 * - isAuthenticated: Quick boolean check if someone is logged in
 * 
 * How it works:
 * 1. Loads saved user from browser storage on page load
 * 2. Provides login/logout functions to components
 * 3. Persists login state across page refreshes
 * 4. Shows loading spinner while checking login status
 * 
 * Usage in components:
 * ```tsx
 * const { user, login, logout, isAuthenticated } = useAuth();
 * ```
 * 
 * Related files:
 * - src/types/auth.ts (defines User and AuthContextType)
 * - src/components/ProtectedRoute.tsx (uses isAuthenticated to block pages)
 */

// React hooks for state and effects
import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';

// Real API for authentication (connected to CodeIgniter backend)
import { api, ApiError, removeToken, removeTenantId, getTenantId, getToken } from '@/api/api';

// TypeScript types for user and authentication context
import { User, AuthContextType } from '@/types/auth';

/**
 * ==================== CREATE CONTEXT ====================
 * 
 * Context is React's way of sharing data across components
 * without passing props down manually through every level.
 * 
 * Think of it like "global variables" but better:
 * - Type-safe (TypeScript knows what's available)
 * - Only updates components that use it
 * - Avoids "prop drilling" (passing props through many layers)
 * 
 * undefined initially means "not provided yet" (error state)
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Export the context for direct use with useContext if needed
export { AuthContext };

/**
 * ==================== STORAGE KEY ====================
 * 
 * This is the key used to save/load user data from localStorage.
 * 
 * Why localStorage?
 * - Persists across page refreshes
 * - Survives browser restarts
 * - Automatically synchronized across tabs
 * 
 * Security Note:
 * - Don't store passwords here!
 * - In production, use httpOnly cookies + JWT tokens instead
 */
const AUTH_STORAGE_KEY = 'school_management_auth';
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * ==================== AUTH PROVIDER COMPONENT ====================
 * 
 * This component WRAPS your app (in App.tsx) to provide auth state.
 * 
 * It handles:
 * - Loading saved user on mount
 * - Login function
 * - Logout function
 * - Showing loading screen while checking auth status
 * 
 * Props:
 * @param children - Your app's components (everything inside <AuthProvider>)
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  /**
   * STATE: Current user
   * - null = not logged in
   * - User object = logged in with user details
   */
  const [user, setUser] = useState<User | null>(null);
  
  /**
   * STATE: Loading indicator
   * - true = still checking if user is logged in
   * - false = done checking, ready to show app
   * 
   * Why?
   * On page load, we need to check localStorage for saved user.
   * This takes a few milliseconds, so we show a spinner.
   */
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    removeToken();
    removeTenantId();
  }, []);

  /**
   * EFFECT: Load user from localStorage on component mount
   * 
   * Runs ONCE when the app starts (empty dependency array [])
   * 
   * Flow:
   * 1. Try to get saved user from localStorage
   * 2. If found, parse JSON and update state
   * 3. If corrupted/invalid, clear it and start fresh
   * 4. Set loading to false (done checking)
   */
  useEffect(() => {
    const restoreSession = async () => {
      const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
      const token      = getToken();

      // No stored session at all — nothing to restore
      if (!storedUser || !token) {
        setIsLoading(false);
        return;
      }

      // Parse the cached user — if it's malformed, clear and start fresh
      let cachedUser: User | null = null;
      try {
        cachedUser = JSON.parse(storedUser);
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setIsLoading(false);
        return;
      }

      // Optimistically show the cached user while we validate in the background
      setUser(cachedUser);

      try {
        // Validate with the server — this also refreshes user role/status
        const freshUser = await api.getCurrentUser() as User;
        setUser(freshUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(freshUser));
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          // Token has expired or been revoked — clear the session
          clearSession();
        }
        // On network errors we keep the cached user so the app still loads
        // offline or during a transient backend issue.
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, [clearSession]); // Empty array = run only once on mount

  /**
   * FUNCTION: Login
   * 
   * Attempts to log in with email and password.
   * 
   * Flow:
   * 1. Call mockApi.login() to validate credentials
   * 2. If valid, save user to state AND localStorage
   * 3. If invalid, throw error (caught by Login page)
   * 
   * @param email - User's email address
   * @param password - User's password
   * @throws Error if credentials are invalid
   * 
   * Usage:
   * ```tsx
   * await login('admin@school.com', 'admin123');
   * ```
   */
  const login = async (email: string, password: string) => {
    const authenticatedUser = await api.login(email, password) as User;
    setUser(authenticatedUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticatedUser));
  };

  /**
   * FUNCTION: Logout
   * 
   * Logs out the current user and clears all auth data.
   * 
   * Flow:
   * 1. Clear user from state (sets to null)
   * 2. Clear user from localStorage
   * 3. User is redirected to login by ProtectedRoute
   * 
   * Usage:
   * ```tsx
   * logout(); // User is logged out
   * ```
   */
  const logout = () => {
    clearSession();
  };

  // ── Inactivity timeout (15 minutes) ─────────────────────────────────────────
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleSessionExpired = () => {
      clearSession();
    };

    window.addEventListener('sessionExpired', handleSessionExpired);

    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired);
    };
  }, [clearSession]);

  useEffect(() => {
    const isPublicAuthPage = ['/login', '/forgot-password', '/reset-password', '/accept-invite'].some((path) =>
      window.location.pathname.startsWith(path)
    );

    if (!user || isPublicAuthPage) {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
      return;
    }

    const handleInactivity = () => {
      clearSession();
      window.dispatchEvent(
        new CustomEvent('sessionExpired', {
          detail: { message: 'You have been logged out due to inactivity.' },
        })
      );
      setTimeout(() => { window.location.href = '/login'; }, 150);
    };

    const reset = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(handleInactivity, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
    };
  }, [clearSession, user]);

  /**
   * ==================== CONTEXT VALUE ====================
   * 
   * This object is what gets shared to all components that call useAuth().
   * 
   * Properties:
   * - user: Current user object (or null)
   * - login: Function to log in
   * - logout: Function to log out
   * - isAuthenticated: Boolean shortcut (true if user exists)
   */
  const value: AuthContextType = {
    user,
    tenantId: user?.tenantId || getTenantId(),
    login,
    logout,
    isAuthenticated: !!user, // !! converts user to boolean (null → false, User → true)
  };

  /**
   * ==================== LOADING STATE ====================
   * 
   * While checking localStorage for saved user, show a loading screen.
   * 
   * Why?
   * Without this, users would briefly see the login page
   * before being redirected to their role's landing page.
   * 
   * Better UX: Show spinner → then go straight to correct page
   */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          {/* Spinning circle animation */}
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          {/* Loading text */}
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  /**
   * ==================== PROVIDE CONTEXT ====================
   * 
   * Wrap children with context provider.
   * Now ANY component inside can call useAuth() to access auth state.
   */
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * ==================== CUSTOM HOOK: useAuth ====================
 * 
 * This is a SHORTCUT hook to access the AuthContext.
 * 
 * Instead of writing:
 * ```tsx
 * const context = useContext(AuthContext);
 * if (!context) throw new Error(...);
 * ```
 * 
 * You can just write:
 * ```tsx
 * const { user, login, logout } = useAuth();
 * ```
 * 
 * Error Handling:
 * If called outside <AuthProvider>, throws helpful error.
 * This prevents bugs from forgetting to wrap with provider.
 * 
 * @returns AuthContextType object with user, login, logout, isAuthenticated
 * @throws Error if used outside AuthProvider
 */
export function useAuth() {
  // Get the context value
  const context = useContext(AuthContext);
  
  // If undefined, hook was called outside <AuthProvider>
  if (context === undefined) {
    // Check if we're in development and this might be a hot reload issue
    if (process.env.NODE_ENV === 'development') {
      console.error('useAuth was called outside AuthProvider. This might be a hot reload issue. Try refreshing the page.');
    }
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  // Return the auth methods and state
  return context;
}
