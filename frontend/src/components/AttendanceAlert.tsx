import { AlertTriangle } from 'lucide-react';
import { AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DismissibleAlert } from '@/components/ui/dismissible-alert';
import { Button } from '@/components/ui/button';
import { TodayStaffEntry } from '@/api/attendance';
import { useAuth } from '@/contexts/AuthContext';

interface AttendanceAlertProps {
  uncheckedCount: number;
  uncheckedStaff: TodayStaffEntry[];
  onMarkStaff: (staff: TodayStaffEntry) => void;
  onDismiss?: () => void;
}

export function AttendanceAlert({
  uncheckedCount,
  uncheckedStaff,
  onMarkStaff,
  onDismiss,
}: AttendanceAlertProps) {
  const { user } = useAuth();
  const canUpdateStatus = user?.role === 'admin' || user?.role === 'super_admin';

  if (uncheckedCount === 0) return null;

  return (
    <DismissibleAlert variant="destructive" className="mb-4" onDismiss={onDismiss}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {uncheckedCount} staff member{uncheckedCount !== 1 ? 's' : ''} have not checked in today
      </AlertTitle>
      <AlertDescription>
        <p className="mb-3 leading-relaxed">
          These staff members have no attendance record for today. Please confirm their status.
        </p>
        {canUpdateStatus ? (
          <div className="flex flex-wrap gap-2">
            {uncheckedStaff.map((s) => (
              <Button
                key={s.staff_id}
                size="sm"
                variant="outline"
                className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                onClick={() => onMarkStaff(s)}
              >
                {s.first_name} {s.last_name}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm mt-1 leading-relaxed">Contact an administrator to update their status.</p>
        )}
      </AlertDescription>
    </DismissibleAlert>
  );
}
