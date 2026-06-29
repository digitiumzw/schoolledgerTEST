import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/api';
import { LeaveRequest, Staff } from '@/types/dashboard';
import { getLeaveTypeVariant, formatLeaveType } from '@/lib/attendanceUtils';
import { useEffect } from 'react';

interface ReviewLeaveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leave: LeaveRequest | null;
  onSuccess: () => void;
}

export function ReviewLeaveModal({ open, onOpenChange, leave, onSuccess }: ReviewLeaveModalProps) {
  const [loading, setLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [staff, setStaff] = useState<Staff[]>([]);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const staffRes = await api.getStaff({ limit: 100 });
        setStaff(staffRes?.data ?? []);
      } catch (error) {
        console.error(error);
      }
    };
    fetchStaff();
  }, []);

  useEffect(() => {
    if (open) {
      setReviewNotes('');
    }
  }, [open]);

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!leave) return;

    setLoading(true);
    try {
      await api.reviewLeaveRequest(leave.id, status, 'admin1', reviewNotes);
      toast.success(`Leave request ${status}`);
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || `Failed to ${status} leave request`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!leave) return null;

  const getStaffName = (staffId: string) => {
    const staffMember = staff.find(s => s.id === staffId);
    return staffMember ? `${staffMember.firstName} ${staffMember.lastName}` : 'Unknown';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Review Leave Request</DialogTitle>
          <DialogDescription>
            Approve or reject this leave request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Staff Member</p>
                <p className="font-medium">{getStaffName(leave.staffId)}</p>
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
              <p className="text-sm text-muted-foreground">Applied On</p>
              <p className="font-medium">{new Date(leave.appliedDate).toLocaleDateString()}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Reason</p>
              <p className="font-medium mt-1">{leave.reason}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reviewNotes">Review Notes (Optional)</Label>
            <Textarea
              id="reviewNotes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add any notes about your decision..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => handleReview('rejected')}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            type="button"
            onClick={() => handleReview('approved')}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Check className="mr-2 h-4 w-4" />
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
