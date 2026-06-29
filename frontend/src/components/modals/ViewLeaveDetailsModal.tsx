import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { LeaveRequest } from '@/types/dashboard';
import { formatLeaveType, getLeaveTypeVariant } from '@/lib/attendanceUtils';

interface ViewLeaveDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leave: LeaveRequest | null;
  staffName: string;
}

export function ViewLeaveDetailsModal({ open, onOpenChange, leave, staffName }: ViewLeaveDetailsModalProps) {
  if (!leave) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Leave Request Details</DialogTitle>
          <DialogDescription>
            Full details of the leave request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Staff Member</p>
                <p className="font-medium">{staffName}</p>
              </div>
              <Badge variant={getLeaveTypeVariant(leave.leaveType)}>
                {formatLeaveType(leave.leaveType)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Start Date</p>
                <p className="font-medium">{new Date(leave.startDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">End Date</p>
                <p className="font-medium">{new Date(leave.endDate).toLocaleDateString()}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Duration</p>
              <p className="font-medium">{leave.days} working day{leave.days > 1 ? 's' : ''}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1">
                <Badge 
                  variant={
                    leave.status === 'approved' ? 'default' :
                    leave.status === 'rejected' ? 'destructive' :
                    'secondary'
                  }
                >
                  {leave.status.toUpperCase()}
                </Badge>
              </div>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Applied On</p>
              <p className="font-medium">{new Date(leave.appliedDate).toLocaleDateString()}</p>
            </div>

            {leave.reviewedDate && (
              <div>
                <p className="text-sm text-muted-foreground">Reviewed On</p>
                <p className="font-medium">{new Date(leave.reviewedDate).toLocaleDateString()}</p>
              </div>
            )}

            <div>
              <p className="text-sm text-muted-foreground">Reason</p>
              <p className="font-medium mt-1">{leave.reason}</p>
            </div>

            {leave.reviewNotes && (
              <div>
                <p className="text-sm text-muted-foreground">Review Notes</p>
                <p className="font-medium mt-1">{leave.reviewNotes}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
