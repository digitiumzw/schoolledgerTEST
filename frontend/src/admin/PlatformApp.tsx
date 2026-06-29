import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Routes, Route } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminLayout } from "./components/admin/AdminLayout";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import NotFound from "./pages/NotFound";
import Schools from "./pages/Schools";
import Subscriptions from "./pages/Subscriptions";
import Finance from "./pages/Finance";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import SystemErrors from "./pages/SystemErrors";
import DemoRequests from "./pages/DemoRequests";

const platformQueryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: false },
    mutations: { retry: false },
  },
});

export function PlatformApp() {
  return (
    <QueryClientProvider client={platformQueryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Routes>
            <Route path="login" element={<Login />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="accept-invite" element={<AcceptInvitePage />} />
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <AdminLayout>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="schools" element={<Schools />} />
                      <Route path="subscriptions" element={<Subscriptions />} />
                      <Route path="finance" element={<Finance />} />
                      <Route path="analytics" element={<Analytics />} />
                      <Route path="settings" element={<Settings />} />
                      <Route path="system-errors" element={<SystemErrors />} />
                      <Route path="demo-requests" element={<DemoRequests />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </AdminLayout>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
