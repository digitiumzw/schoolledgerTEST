import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

/**
 * SessionExpirationHandler - Handles session expiration events
 * 
 * This component listens for 'sessionExpired' events dispatched by the API
 * when a 401 Unauthorized response is received. It shows a toast notification
 * to the user before the redirect to login page.
 * 
 * Usage:
 * Add this component to your main App component or layout:
 * ```tsx
 * <SessionExpirationHandler />
 * ```
 */
export function SessionExpirationHandler() {
  const { toast } = useToast();

  useEffect(() => {
    const handleSessionExpired = (event: CustomEvent) => {
      const { message } = event.detail;
      
      // Suppress duplicate alerts on the login page where the user already
      // expects to sign in.
      if (window.location.pathname.startsWith('/login')) {
        return;
      }

      // Show toast notification
      toast({
        title: 'Session Expired',
        description: message || 'Your session has expired. Please sign in again.',
        variant: 'destructive',
        duration: 5000, // Show for 5 seconds
      });
    };

    // Add event listener
    window.addEventListener('sessionExpired', handleSessionExpired as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired as EventListener);
    };
  }, [toast]);

  // This component doesn't render anything visible
  return null;
}
