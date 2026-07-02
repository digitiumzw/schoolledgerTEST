/**
 * ============================================
 * APP.TSX - Main Application Configuration
 * ============================================
 *
 * This is the TOP-LEVEL component that sets up:
 * 1. Global providers (auth, theme, query caching)
 * 2. Routing (which URL shows which page)
 * 3. Layout structure (sidebar + header + content)
 * 4. Role-based access control (who can see what)
 *
 * Think of this as the "foundation" of your app:
 * - Everything else builds on top of this file
 * - Changes here affect the ENTIRE application
 *
 * Key Concepts:
 * - **Providers**: Wrap components to share data (like login state)
 * - **Routing**: Maps URLs (/students, /payments) to pages
 * - **Protected Routes**: Only show pages to authorized users
 *
 * When to modify:
 * - Adding new pages → Add a new <Route> element
 * - Changing user permissions → Modify allowedRoles
 * - Adding global features → Add new providers
 */

// Global error boundary
import { ErrorBoundary } from "@/components/ErrorBoundary";

// ==================== UI COMPONENTS ====================
// Toast notifications for user feedback (success/error messages)
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

// Tooltip wrapper for hover hints
import { TooltipProvider } from "@/components/ui/tooltip";

// React utilities
import { lazy, Suspense } from "react";
// Session expiration handler
import { SessionExpirationHandler } from "@/components/SessionExpirationHandler";
// Global top loading bar and offline banner
import { GlobalTopLoader } from "@/components/ui/global-top-loader";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";

// ==================== DATA & STATE MANAGEMENT ====================
// TanStack Query - Caches server data, prevents duplicate API calls
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// React Router - Handles navigation and URL changes
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// ==================== THEME & STYLING ====================
// Dark/light mode switching
import { ThemeProvider } from "next-themes";

// ==================== LAYOUT COMPONENTS ====================
// Sidebar navigation component
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { TutorialWalkthrough } from "@/components/tutorial/TutorialWalkthrough";
import { useTutorial } from "@/hooks/useTutorial";

// ==================== AUTHENTICATION ====================
// Authentication context - manages login state
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// Route protection - blocks unauthorized users
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { SubscriptionStatusBanner } from "@/components/subscription/SubscriptionStatusBanner";
import { UnbilledChargesAlertBanner } from "@/components/UnbilledChargesAlertBanner";
import { OutsideTermAlertBanner } from "@/components/OutsideTermAlertBanner";
import { ExpiredSubscriptionOverlay } from "@/components/subscription/ExpiredSubscriptionOverlay";

// ==================== PAGE IMPORTS ====================
// All the different pages in your application
import Index from "./pages/Index";                     // Dashboard (admin only)
import Students from "./pages/Students";               // Student management (admin only)
import StudentBulkImportPage from "./pages/StudentBulkImportPage";
import StudentProfile from "./pages/StudentProfile";   // Individual student details (admin only)
import Classes from "./pages/Classes";                 // Class management (admin only)
import ClassStudentsPage from "./pages/ClassStudentsPage"; // Class student roster (admin only)
import UnassignedStudentsPage from "./pages/UnassignedStudentsPage"; // Unassigned students (admin only)
import Staff from "./pages/Staff";                     // Staff management (admin only)
import StaffBulkImportPage from "./pages/StaffBulkImportPage"; // Staff bulk import (admin only)
import StaffProfilePage from "./pages/StaffProfilePage"; // Staff profile details (admin only)
import StaffAttendance from "./pages/StaffAttendance"; // Staff check-in/out (admin only)
import Transport from "./pages/Transport";             // Transport routes (admin only)
import RouteDetailPage from "./pages/RouteDetailPage"; // Route detail page (admin only)
import Payments from "./pages/Payments";               // Payment recording (admin + bursar)
import Attendance from "./pages/Attendance";           // Student attendance (admin + teacher)
import Settings from "./pages/Settings";               // System settings (admin + bursar)
import ComingSoon from "./pages/ComingSoon";       // Coming Soon placeholder (admin only)
import Billing from "./pages/Billing";               // Subscription billing management (admin only)
import CreditsPage from "./pages/subscription/CreditsPage";   // Account credits
import Help from "./pages/Help";                       // Help center (all users)
import Login from "./pages/Login";                     // Login page (public)
import ForgotPasswordPage from "./pages/ForgotPasswordPage"; // Forgot password (public)
import ResetPasswordPage from "./pages/ResetPasswordPage";   // Reset password via token (public)
import AcceptInvitePage from "./pages/AcceptInvitePage";     // Accept invitation & set password (public)
import NotFound from "./pages/NotFound";               // 404 error page
import KioskPage from "./pages/KioskPage";             // Staff attendance kiosk (public)
import StudentKioskPage from "./pages/StudentKioskPage"; // Student attendance kiosk (public)
import DriverKioskPage from "./pages/DriverKioskPage";   // Driver kiosk (public)
import ReceiptPage from "./pages/ReceiptPage";           // Public payment receipt viewer
const ReceiptListPage = lazy(() => import("./pages/ReceiptListPage")); // Public receipt list (092)
import { PlatformApp } from "./admin/PlatformApp";        // Platform control panel (admin console)
import { MaintenanceNotice } from "./components/MaintenanceNotice";
import { useMaintenanceStatus } from "./hooks/useMaintenanceStatus";
import OnboardingPage from "./pages/OnboardingPage";   // Admin onboarding wizard (043-school-creation-onboarding)
import FeeCampaigns from "./pages/FeeCampaigns";         // Fee campaign management (059-fee-campaign)
import FeeCampaignDetail from "./pages/FeeCampaignDetail"; // Fee campaign detail (059-fee-campaign)

/**
 * ==================== QUERY CLIENT SETUP ====================
 *
 * QueryClient is like a "smart cache" for your API calls.
 *
 * Benefits:
 * - Automatically caches API responses
 * - Prevents duplicate requests
 * - Background data refreshing
 * - Optimistic updates
 *
 * Example: If you load the Students page, then navigate away,
 * then come back - TanStack Query shows cached data instantly
 * while fetching fresh data in the background.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60 * 1000,
      // Retry failed queries up to 2 times with exponential back-off
      retry: (failureCount, error: unknown) => {
        // Never retry on client errors (4xx) — only transient failures
        const status = typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: unknown }).status)
          : null;
        if (status !== null && status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      // Refetch when the window regains focus so data stays current
      refetchOnWindowFocus: true,
      // Background polling — all pages reflect changes within 30 seconds
      refetchInterval: 30_000,
      // Treat cached data as stale after 30 seconds (stale-while-revalidate)
      staleTime: 30_000,
    },
    mutations: {
      // Do not retry mutations — side-effect operations must not be duplicated
      retry: false,
    },
  },
});

/**
 * ==================== APP LAYOUT COMPONENT ====================
 *
 * This component wraps every page with the standard layout:
 * - Sidebar on the left (collapsible)
 * - Header at the top (school name, user info, theme toggle)
 * - Main content area (where page content appears)
 *
 * Props:
 * @param children - The page content to display (Students, Payments, etc.)
 *
 * Why wrap in a component?
 * - Avoids repeating layout code on every page
 * - Keeps all pages visually consistent
 * - Easy to update layout globally
 */
const MaintenanceGate = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { data: maintenance } = useMaintenanceStatus();

  if (maintenance?.maintenance_mode && user && user.role !== 'super_admin') {
    return <MaintenanceNotice headline={maintenance.headline} message={maintenance.message} />;
  }

  return <>{children}</>;
};

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const tutorialQ = useTutorial(!!user);

  return (
    // SidebarProvider manages sidebar open/close state
    <SidebarProvider>
      {/* Flexbox container - sidebar and content side-by-side */}
      <div className="flex min-h-screen w-full">
        {/* Left sidebar - navigation menu */}
        <div className="print:hidden">
          <AppSidebar />
        </div>

        {/* Right side - header + content */}
        <div className="flex flex-1 flex-col">
          {/* Global top loading progress bar — appears on any in-flight request */}
          <GlobalTopLoader />

          {/* Top header bar (sticky, stays at top when scrolling) */}
          <div className="print:hidden">
            <AppHeader />
          </div>

          {/* Offline detection banner */}
          <NetworkStatusBanner />

          {/* Subscription status banner (over-limit / expiring soon / no subscription) */}
          <div className="print:hidden">
            <SubscriptionStatusBanner />
          </div>

          {/* Unbilled charges alert — shown to admin/bursar on every page */}
          <div className="print:hidden">
            <UnbilledChargesAlertBanner />
          </div>

          {/* Outside term alert — shown when today falls outside all configured terms */}
          <div className="print:hidden">
            <OutsideTermAlertBanner />
          </div>

          {/* Grace-period overlay: countdown bar when expired with time left;
              blur + renewal CTA when the 5-min/hour allowance is exhausted */}
          <ExpiredSubscriptionOverlay>
            {/* Main content area - this is where pages render */}
            <main className="flex-1 w-full p-3 sm:p-6 bg-background print:p-0">
              <MaintenanceGate>{children}</MaintenanceGate>
            </main>
          </ExpiredSubscriptionOverlay>
        </div>
      </div>
      {tutorialQ.data && <TutorialWalkthrough tutorial={tutorialQ.data} />}
    </SidebarProvider>
  );
};

const App = () => {
  /**
   * ==================== ROOT REDIRECT COMPONENT ====================
   *
   * This component decides where to send users when they visit "/"
   *
   * Redirect Logic:
   * - Admin → Dashboard (/)
   * - Teacher → Attendance page (/attendance)
   * - Bursar → Payments page (/payments)
   * - Not logged in → Login page (/login)
   *
   * Why?
   * Different user roles need different landing pages.
   * Teachers don't need to see the admin dashboard!
   *
   * Technical Note:
   * This component uses useAuth() hook, which only works inside
   * <AuthProvider>. That's why it's defined inside App component.
   */
  const RootRedirect = () => {
    // Get the currently logged-in user (or null if not logged in)
    const { user } = useAuth();

    // If no user is logged in, send them to login page
    if (!user) {
      return <Navigate to="/login" replace />;
    }

    // Redirect based on user's role
    if (user.role === 'super_admin') {
      // Super Admins see the dashboard directly (Index component)
      return <Index />;
    } else if (user.role === 'admin') {
      // Admins see the dashboard directly (Index component)
      return <Index />;
    } else if (user.role === 'bursar') {
      // Bursar users go to payments page
      return <Navigate to="/payments" replace />;
    } else if (user.role === 'hr') {
      // HR users go to staff page
      return <Navigate to="/staff" replace />;
    }

    // Fallback (should never happen, but safety first!)
    return <Navigate to="/login" replace />;
  };

  return (
  // LAYER 0: Global error boundary — catches unhandled render errors
  <ErrorBoundary>
  {/* LAYER 1: TanStack Query - manages all API calls */}
  <QueryClientProvider client={queryClient}>
    {/* LAYER 2: Theme management - light/dark mode */}
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      {/* LAYER 3: Authentication - login state */}
      <AuthProvider>
        {/* LAYER 4: Tooltip wrapper - enables <Tooltip> components */}
        <TooltipProvider>
          {/* Toast notification components (success/error popups) */}
          <Toaster />
          <Sonner />

          {/* Session expiration handler - listens for 401 errors */}
          <SessionExpirationHandler />

          {/* LAYER 5: Router - handles URLs and navigation */}
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            {/* Define all routes (URL patterns) */}
            <Routes>
              {/* ==================== PUBLIC ROUTES ==================== */}
              {/* Login page - no authentication required */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/accept-invite" element={<AcceptInvitePage />} />

              {/* ==================== PROTECTED ROUTES ==================== */}
              {/* All routes below require login (ProtectedRoute checks this) */}

              {/* Root path "/" - redirects based on role */}
              <Route path="/" element={
                <ProtectedRoute>
                  <AppLayout><RootRedirect /></AppLayout>
                </ProtectedRoute>
              } />

              <Route path="/students/import" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'bursar']}>
                  <AppLayout><StudentBulkImportPage /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Student Profile - Admin and Bursar */}
              {/* Pattern: /students/s123 shows profile for student with ID "s123" */}
              <Route path="/students/:id" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'bursar']}>
                  <AppLayout><StudentProfile /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Student List - Admin and Bursar */}
              <Route path="/students" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'bursar']}>
                  <AppLayout><Students /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Class Management - Admin only */}
              <Route path="/classes" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <AppLayout><Classes /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/classes/unassigned" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <AppLayout><UnassignedStudentsPage /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/classes/:classId/students" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'bursar']}>
                  <AppLayout><ClassStudentsPage /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Staff Management - Admin and HR */}
              <Route path="/staff" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'hr']}>
                  <AppLayout><Staff /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Staff Bulk Import - Admin and HR */}
              <Route path="/staff/import" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'hr']}>
                  <AppLayout><StaffBulkImportPage /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Staff Profile - Admin and HR */}
              {/* Pattern: /staff/s123 shows profile for staff with ID "s123" */}
              <Route path="/staff/:id" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'hr']}>
                  <AppLayout><StaffProfilePage /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Staff Attendance (Check-in/out) - Admin and HR */}
              <Route path="/s-attendance" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'hr']}>
                  <AppLayout><StaffAttendance /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Transport Routes - Admin and Bursar */}
              <Route path="/transport" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'bursar']}>
                  <AppLayout><Transport /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Route Detail Page - Admin and Bursar */}
              {/* Pattern: /transport/routes/r123 shows details for route with ID "r123" */}
              <Route path="/transport/routes/:id" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'bursar']}>
                  <AppLayout><RouteDetailPage /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Payments - Admin AND Bursar users */}
              <Route path="/payments" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'bursar']}>
                  <AppLayout><Payments /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Fee Campaigns - Admin AND Bursar users (Feature 059) */}
              <Route path="/fee-campaigns/:id" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'bursar']}>
                  <AppLayout><FeeCampaignDetail /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/fee-campaigns" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'bursar']}>
                  <AppLayout><FeeCampaigns /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Student Attendance Register - Admin only */}
              <Route path="/attendance" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <AppLayout><Attendance /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Settings - Admin only */}
              {/* Note: /* allows nested routes like /settings/users, /settings/general */}
              <Route path="/settings/*" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <AppLayout><Settings /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Subscription / Billing Management - Admin only */}
              <Route path="/billing" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                  <AppLayout><Billing /></AppLayout>
                </ProtectedRoute>
              } />
              <Route path="/subscription/credits" element={
                <ProtectedRoute allowedRoles={['super_admin', 'admin', 'bursar']}>
                  <AppLayout><CreditsPage /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Help Center - All authenticated users */}
              <Route path="/help" element={
                <ProtectedRoute>
                  <AppLayout><Help /></AppLayout>
                </ProtectedRoute>
              } />

              {/* Admin Onboarding Wizard — 043-school-creation-onboarding */}
              {/* Reachable by admins whose onboardingComplete is still false. */}
              <Route path="/onboarding" element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin']} requireOnboardingComplete={false}>
                  <OnboardingPage />
                </ProtectedRoute>
              } />

              {/* ==================== KIOSK ROUTES (PUBLIC) ==================== */}
              {/* No ProtectedRoute — kiosk pages are accessed without logging in */}
              {/* Student attendance kiosk — must be listed BEFORE /kiosk/:code */}
              <Route path="/kiosk/:code/students" element={<StudentKioskPage />} />
              {/* Driver kiosk — must be listed BEFORE /kiosk/:code */}
              <Route path="/kiosk/:code/driver" element={<DriverKioskPage />} />
              {/* Staff attendance kiosk */}
              {/* New format: /kiosk/:code (opaque code, no tenant_id in URL) */}
              {/* Legacy: /kiosk?tenant_id=xxx still handled by KioskPage itself */}
              <Route path="/kiosk/:code" element={<KioskPage />} />
              <Route path="/kiosk" element={<KioskPage />} />

              {/* Public payment receipt — no auth required; QR codes link here */}
              <Route path="/receipt/:id" element={<ReceiptPage />} />
              <Route path="/receipts/student/:studentId" element={<Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}><ReceiptListPage /></Suspense>} />

              {/* ==================== PLATFORM CONTROL PANEL ==================== */}
              {/* Isolated admin console — separate auth, separate UI layer */}
              <Route path="/platform-control-panel/*" element={<PlatformApp />} />

              {/* ==================== CATCH-ALL ROUTE ==================== */}
              {/* This MUST be last! Matches any URL not defined above */}
              {/* Shows 404 "Not Found" page for invalid URLs */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </ErrorBoundary>
  );
};

// Export the App component so main.tsx can use it
export default App;
