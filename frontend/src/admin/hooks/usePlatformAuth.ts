import { useState, useCallback } from 'react';
import { platformLogin, platformMe } from '@/api/platform';

export interface PlatformUser {
  id: number;
  name: string;
  email: string;
  platform_role: 'Owner' | 'Admin' | 'Finance' | 'Support';
}

export function usePlatformAuth() {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await platformLogin(email, password);
        const { token, user: userData } = res.data.data;
        localStorage.setItem('schoolledger_platform_token', token);
        setUser(userData);
        return { success: true, user: userData };
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Login failed. Please try again.';
        setError(msg);
        return { success: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem('schoolledger_platform_token');
    localStorage.removeItem('schoolledger_platform_refresh_token');
    setUser(null);
    window.location.href = '/platform-control-panel/login';
  }, []);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('schoolledger_platform_token');
    if (!token) return null;

    try {
      const res = await platformMe();
      const userData = res.data.data;
      setUser(userData);
      return userData;
    } catch {
      logout();
      return null;
    }
  }, [logout]);

  const isAuthenticated = !!localStorage.getItem('schoolledger_platform_token');

  return { user, loading, error, login, logout, fetchMe, isAuthenticated };
}
