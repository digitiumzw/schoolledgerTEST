import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '@/api/api';
import { Staff } from '@/types/dashboard';

interface DeleteStaffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
  onSuccess: () => void;
}

export function DeleteStaffModal({ open, onOpenChange, staff, onSuccess }: DeleteStaffModalProps) {
  const [loading, setLoading] = useState(false);
  const [assignedClasses, setAssignedClasses] = useState<number>(0);

  useEffect(() => {
    if (staff?.isTeaching && open) {
      api.getStaffClasses(staff.id).then((classes: any[]) => {
        setAssignedClasses(classes?.length ?? 0);
      }).catch(() => setAssignedClasses(0));
    } else {
      setAssignedClasses(0);
    }
  }, [staff, open]);

  const handleDelete = async () => {
    if (!staff) return;

    setLoading(true);

    try {
      await api.deleteStaff(staff.id);
      toast.success('Staff member deleted successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(
          "This staff member has attendance or leave records and cannot be deleted. " +
          "Update their employment status to 'Resigned' or 'Retired' instead.",
          { duration: 6000 }
        );
      } else {
        toast.error('Failed to delete staff member');
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!staff) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Staff Member
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-foreground">
                {staff.firstName} {staff.lastName}
              </span>{' '}
              ({staff.position})?
            </p>
            {staff.isTeaching && assignedClasses > 0 && (
              <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                <p className="text-sm text-destructive font-medium">
                  ⚠️ Warning: This teacher is assigned to {assignedClasses} class
                  {assignedClasses > 1 ? 'es' : ''}. Deleting them may affect class records.
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
