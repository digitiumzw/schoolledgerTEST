import { AccountDeletionCard } from './AccountDeletionCard';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield } from 'lucide-react';

export function AccountSettingsTab() {
  const { user } = useAuth();

  // This tab only contains deletion functionality which is restricted to super_admin
  if (user?.role !== 'super_admin') {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Account management settings are restricted to Super Admin users only.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <AccountDeletionCard />
    </div>
  );
}
