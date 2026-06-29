import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/api';
import { Staff } from '@/types/dashboard';
import { getCurrentTime } from '@/lib/attendanceUtils';

interface CheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
  onSuccess: () => void;
}

export function CheckInModal({ open, onOpenChange, staff, onSuccess }: CheckInModalProps) {
  const [loading, setLoading] = useState(false);
  const [checkInTime, setCheckInTime] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (open) {
      setCheckInTime(getCurrentTime());
      setRemarks('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff || !checkInTime) return;

    setLoading(true);
    try {
      await api.checkInStaff(staff.id, checkInTime);
      toast.success('Checked in successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to check in');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!staff) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Check In</DialogTitle>
            <DialogDescription>
              Recording check-in for {staff.firstName} {staff.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="checkInTime">Check-in Time</Label>
              <Input
                id="checkInTime"
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Any additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check In
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
