/**
 * ============================================
 * PROTECTED ROUTE - Role-Based Access Control
 * ============================================
 * 
 * This component is a "security guard" for your routes.
 * It checks if a user is:
 * 1. Logged in (authenticated)
 * 2. Has the right role (admin, teacher, or bursar)
 * 
 * If checks fail → redirect to appropriate page
 * If checks pass → show the requested page
 * 
 * Usage Example:
 * ```tsx
 * <Route path="/students" element={
 *   <ProtectedRoute allowedRoles={['admin']}>
 *     <Students />
 *   </ProtectedRoute>
 * } />
 * ```
 * 
 * This means:
 * - Only admins can see /students
 * - Teachers/bursar users get redirected to their landing page
 * - Not logged in? → redirected to /login
 * 
 * Related files:
 * - src/contexts/AuthContext.tsx (provides user info)
 * - src/types/auth.ts (defines UserRole type)
 * - src/App.tsx (uses this on every protected route)
 */

// React Router's redirect component
import { Navigate } from 'react-router-dom';

// Authentication context to get current user
import { useAuth } from '@/contexts/AuthContext';
import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

// UserRole type (admin | teacher | bursar)
import { UserRole } from '@/types/auth';

/**
 * ==================== COMPONENT PROPS ====================
 * 
 * TypeScript interface defining what props this component accepts.
 * 
 * Props:
 * @param children - The page/component to protect (e.g., <Students />)
 * @param allowedRoles - Optional array of roles that can access this route
 *                       If omitted, ANY logged-in user can access
 * 
 * Example with roles:
 * <ProtectedRoute allowedRoles={['admin']}>...</ProtectedRoute>
 * 
 * Example without roles (any logged-in user):
 * <ProtectedRoute>...</ProtectedRoute>
 */
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  /**
   * When false, this route is exempt from the onboarding-complete guard.
   * Used by /onboarding itself so an incomplete admin can reach the wizard
   * without being redirected back to it in an infinite loop. Defaults to true.
   */
  requireOnboardingComplete?: boolean;
}

/**
 * ==================== MAIN COMPONENT ====================
 * 
 * The ProtectedRoute wrapper component.
 * 
 * Security Flow:
 * 1. Check if user is logged in
 *    → If NO: redirect to /login
 * 2. Check if user has allowed role (if specified)
 *    → If NO: redirect to user's role-specific landing page
 * 3. If both checks pass: render the protected content
 */
export function ProtectedRoute({
  children,
  allowedRoles,
  requireOnboardingComplete = true,
}: ProtectedRouteProps) {
  // Get authentication state from context
  // First try to get the context directly to check if it's available
  const context = useContext(AuthContext);
  
  // If context is not available, show a loading state
  // This can happen during hot reload or initial render
  if (context === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // Now safely destructure the context
  const { isAuthenticated, user } = context;

  /**
   * ==================== CHECK 1: Is user logged in? ====================
   * 
   * If isAuthenticated is false (no user logged in):
   * - Redirect to /login page
   * - replace=true means "replace current history entry"
   *   (back button won't go to protected page)
   */
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  /**
   * ==================== CHECK 1.5: Onboarding completion guard ====================
   *
   * 043-school-creation-onboarding: a school admin whose onboarding is not yet
   * complete must be funnelled to /onboarding regardless of which route they
   * tried to load. The /onboarding route opts out of this check via
   * requireOnboardingComplete={false}.
   *
   * Only enforced for the 'admin' role since onboarding is admin-scoped.
   */
  if (
    requireOnboardingComplete &&
    user &&
    (user.role === 'admin' || user.role === 'super_admin') &&
    user.onboardingComplete === false
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  /**
   * ==================== CHECK 2: Does user have the right role? ====================
   * 
   * Only runs if allowedRoles was specified.
   * 
   * Logic:
   * - If allowedRoles is provided AND user exists
   * - Check if user's role is in the allowedRoles array
   * - If NOT in array → redirect to role-specific landing page
   * 
   * Role Landing Pages:
   * - Admin → / (dashboard)
   * - Teacher → /attendance
   * - Bursar → /payments
   * 
   * Example:
   * If a teacher tries to access /students (admin-only):
   * - allowedRoles = ['admin']
   * - user.role = 'teacher'
   * - 'teacher' NOT in ['admin'] → redirect to /attendance
   */
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // User doesn't have permission - redirect based on their role
    switch (user.role) {
      case 'super_admin':
        // Super Admins always go to dashboard
        return <Navigate to="/" replace />;
      case 'admin':
        // Admins always go to dashboard
        return <Navigate to="/" replace />;
      case 'teacher':
        // Teachers go to attendance page (their only allowed page)
        return <Navigate to="/attendance" replace />;
      case 'bursar':
        // Bursar users go to payments page
        return <Navigate to="/payments" replace />;
      case 'hr':
        // HR users go to staff page
        return <Navigate to="/staff" replace />;
      default:
        // Unknown role (shouldn't happen, but safety first)
        return <Navigate to="/login" replace />;
    }
  }

  /**
   * ==================== SUCCESS: Render Protected Content ====================
   * 
   * If we reach here, all checks passed:
   * ✅ User is logged in
   * ✅ User has the required role (if specified)
   * 
   * Now we can safely show the protected content.
   * 
   * Why <>{children}</>?
   * - React needs a single parent element
   * - <></> is a "fragment" - invisible wrapper with no HTML output
   */
  return <>{children}</>;
}
