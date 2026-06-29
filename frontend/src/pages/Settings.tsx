import { Routes, Route, Navigate } from "react-router-dom";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { GeneralSettingsTab } from "@/components/settings/GeneralSettingsTab";
import { UserAccountsTab } from "@/components/settings/UserAccountsTab";
import { AcademicCalendarTab } from "@/components/settings/AcademicCalendarTab";
import { ReconciliationTab } from "@/components/settings/ReconciliationTab";
import { FeeStructureTab } from "@/components/settings/FeeStructureTab";
import { AccountSettingsTab } from "@/components/settings/AccountSettingsTab";
import { useAuth } from "@/contexts/AuthContext";

function UserManagementRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== 'super_admin' && user?.role !== 'admin') {
    return <Navigate to="/settings/general" replace />;
  }

  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== 'super_admin') {
    return <Navigate to="/settings/general" replace />;
  }

  return <>{children}</>;
}

export default function Settings() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground">
          Manage your school's configuration and preferences
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <SettingsSidebar />

        <main className="flex-1 min-w-0">
          <Routes>
            <Route path="/" element={<Navigate to="general" replace />} />
            <Route path="general" element={<GeneralSettingsTab />} />
            <Route path="calendar" element={<AcademicCalendarTab />} />
            <Route path="users" element={
              <UserManagementRoute>
                <UserAccountsTab />
              </UserManagementRoute>
            } />
            <Route path="reconciliation" element={<SubscriptionGuard><ReconciliationTab /></SubscriptionGuard>} />
            <Route path="fee-structure" element={<SubscriptionGuard><FeeStructureTab /></SubscriptionGuard>} />
            <Route path="account" element={
              <SuperAdminRoute>
                <AccountSettingsTab />
              </SuperAdminRoute>
            } />
          </Routes>
        </main>
      </div>
    </div>
  );
}
