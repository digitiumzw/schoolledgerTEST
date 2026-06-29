/**
 * ============================================
 * AUTHENTICATION TYPES - User & Auth Types
 * ============================================
 * 
 * This file defines TypeScript types for authentication.
 * 
 * Why do we need this?
 * TypeScript needs to know the "shape" of our data:
 * - What fields does a User have?
 * - What methods are available in AuthContext?
 * 
 * This prevents bugs like:
 * - Accessing user.fullName when it should be user.name
 * - Calling user.signOut() when it's logout()
 * 
 * Think of types as a "contract" or "blueprint" for your data.
 * 
 * Related files:
 * - src/contexts/AuthContext.tsx (implements AuthContextType)
 * - src/components/ProtectedRoute.tsx (uses UserRole)
 */

/**
 * ==================== USER ROLE TYPE ====================
 * 
 * Defines the 4 possible user roles in the system.
 * 
 * This is a "union type" meaning a value can ONLY be
 * one of these four strings.
 * 
 * Role Permissions:
 * - super_admin: Full access to EVERYTHING including User Accounts (protected from deactivation)
 * - admin: Full access to everything EXCEPT User Accounts tab
 * - teacher: Can only mark student attendance
 * - bursar: Can record payments, manage students, and manage transport
 * 
 * Usage Example:
 * ```tsx
 * const userRole: UserRole = 'admin'; // ✅ Valid
 * const badRole: UserRole = 'manager'; // ❌ Error! Not a valid role
 * ```
 * 
 * Why not use a regular string?
 * - TypeScript catches typos: 'teachr' would cause an error
 * - Auto-complete in your editor
 * - Self-documenting code (you see all valid options)
 */
export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'bursar' | 'hr';

/**
 * ==================== USER INTERFACE ====================
 * 
 * Defines the structure of a User object.
 * 
 * Every user MUST have these 5 fields.
 * 
 * Fields:
 * - id: Unique identifier (e.g., "u1", "u2")
 * - tenantId: Which school this user belongs to (multi-tenancy support)
 * - role: User's role (admin/teacher/bursar)
 * - email: User's email address (used for login)
 * - name: User's display name (e.g., "John Doe")
 * 
 * Multi-tenancy:
 * The tenantId allows one system to serve multiple schools.
 * Each school is a "tenant" with their own data.
 * 
 * Usage Example:
 * ```tsx
 * const user: User = {
 *   id: "u1",
 *   tenantId: "t1",
 *   role: "admin",
 *   email: "admin@school.com",
 *   name: "Admin User"
 * };
 * ```
 */
export interface User {
  id: string;          // Unique user ID (e.g., "u1", "u2", "u3")
  tenantId: string;    // School/tenant ID (e.g., "t1" for Greenwood Academy)
  role: UserRole;      // User's permission level (admin/teacher/bursar)
  email: string;       // Email address for login
  name: string;        // Display name (e.g., "John Smith")

  /**
   * Credential lifecycle flags (043-school-creation-onboarding).
   *
   * - isTempPassword: true when the admin was provisioned with a temporary
   *   password and has not yet logged in. Cleared on first successful login.
   * - onboardingComplete: true once the school admin has finished the
   *   onboarding wizard. Used as the dashboard access guard.
   *
   * Both default to true for legacy users (existing accounts before this
   * feature shipped) so they are never redirected to /onboarding.
   */
  isTempPassword?: boolean;
  onboardingComplete?: boolean;
  status?: string;
}

/**
 * ==================== AUTH CONTEXT TYPE ====================
 * 
 * Defines what the AuthContext provides to components.
 * 
 * This is the "contract" for the authentication system.
 * Any component using useAuth() will get these 4 things:
 * 
 * Properties & Methods:
 * 1. user: The currently logged-in user (or null if not logged in)
 * 2. login: Function to log in with email and password
 * 3. logout: Function to log out the current user
 * 4. isAuthenticated: Quick boolean check (true if logged in)
 * 
 * Usage Example:
 * ```tsx
 * const { user, login, logout, isAuthenticated } = useAuth();
 * 
 * if (isAuthenticated) {
 *   console.log('Logged in as:', user.name);
 * }
 * 
 * // Log in
 * await login('admin@school.com', 'admin123');
 * 
 * // Log out
 * logout();
 * ```
 * 
 * Why define this interface?
 * - TypeScript knows what's available
 * - Auto-complete shows login, logout, etc.
 * - Prevents calling wrong method names
 */
export interface AuthContextType {
  /**
   * Currently logged-in user
   * - null: No one is logged in
   * - User object: Someone is logged in
   */
  user: User | null;
  
  /**
   * Current tenant ID
   * 
   * The tenant ID of the logged-in user, retrieved dynamically from
   * the server on login and stored in localStorage.
   * 
   * - null: No user logged in or tenant ID not yet loaded
   * - string: The active tenant ID for all API calls
   * 
   * Example:
   * ```tsx
   * const { tenantId } = useAuth();
   * if (tenantId) {
   *   await api.getAlertState(tenantId);
   * }
   * ```
   */
  tenantId: string | null;
  
  /**
   * Login function
   * 
   * Attempts to log in with credentials.
   * 
   * @param email - User's email address
   * @param password - User's password
   * @returns Promise that resolves when login succeeds
   * @throws Error if credentials are invalid
   * 
   * Example:
   * ```tsx
   * try {
   *   await login('admin@school.com', 'admin123');
   *   // Success! User is now logged in
   * } catch (error) {
   *   // Login failed - wrong email or password
   * }
   * ```
   */
  login: (email: string, password: string) => Promise<void>;
  
  /**
   * Logout function
   * 
   * Logs out the current user.
   * Clears all authentication state.
   * 
   * Example:
   * ```tsx
   * logout();
   * // User is now logged out
   * ```
   */
  logout: () => void;
  
  /**
   * Authentication status
   * 
   * Quick way to check if someone is logged in.
   * 
   * - true: User is logged in
   * - false: No one is logged in
   * 
   * Equivalent to checking: user !== null
   * 
   * Example:
   * ```tsx
   * if (isAuthenticated) {
   *   return <Dashboard />;
   * } else {
   *   return <LoginPage />;
   * }
   * ```
   */
  isAuthenticated: boolean;
}
