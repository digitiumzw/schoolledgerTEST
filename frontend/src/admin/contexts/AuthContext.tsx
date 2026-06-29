import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { platformMe } from '@/api/platform';
import { can as canDo, type PermissionAction, type PlatformRole } from '@/admin/lib/permissions';

export interface PlatformUser {
  id: number;
  name: string;
  email: string;
  platform_role: PlatformRole;
  status?: 'Active' | 'Invited' | 'Deactivated';
}

interface AuthContextValue {
  user: PlatformUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: PlatformUser | null) => void;
  logout: () => void;
  can: (action: PermissionAction) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('schoolledger_platform_token');
    if (!token) {
      setIsLoading(false);
      return;
    }

    platformMe()
      .then((res) => setUser(res.data.data))
      .catch(() => {
        localStorage.removeItem('schoolledger_platform_token');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const logout = () => {
    localStorage.removeItem('schoolledger_platform_token');
    localStorage.removeItem('schoolledger_platform_refresh_token');
    setUser(null);
    window.location.href = '/platform-control-panel/login';
  };

  // ── Inactivity timeout (30 minutes) ─────────────────────────────────────────
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isPublicAuthPage = [
      '/platform-control-panel/login',
      '/platform-control-panel/forgot-password',
      '/platform-control-panel/reset-password',
      '/platform-control-panel/accept-invite',
    ].some((path) => window.location.pathname.startsWith(path));

    if (!user || isPublicAuthPage) {
      if (inactivityTimer.current) {
        clearTimeout(inactivityTimer.current);
        inactivityTimer.current = null;
      }
      return;
    }

    const handleInactivity = () => {
      localStorage.removeItem('schoolledger_platform_token');
      localStorage.removeItem('schoolledger_platform_refresh_token');
      setUser(null);
      window.location.href = '/platform-control-panel/login';
    };

    const reset = () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(handleInactivity, 30 * 60 * 1000);
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
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        setUser,
        logout,
        can: (action) => canDo(user?.platform_role, action),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
