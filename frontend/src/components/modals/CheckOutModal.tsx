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
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/api';
import { Staff, StaffAttendanceRecord } from '@/types/dashboard';
import { getCurrentTime, calculateWorkHours, formatTime, formatWorkHours } from '@/lib/attendanceUtils';

interface CheckOutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
  onSuccess: () => void;
}

export function CheckOutModal({ open, onOpenChange, staff, onSuccess }: CheckOutModalProps) {
  const [loading, setLoading] = useState(false);
  const [checkOutTime, setCheckOutTime] = useState('');
  const [attendance, setAttendance] = useState<StaffAttendanceRecord | null>(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      if (open && staff) {
        setCheckOutTime(getCurrentTime());
        try {
          const today = new Date().toISOString().split('T')[0];
          const records = await api.getStaffAttendance({ date: today });
          const record = records.find(r => r.staffId === staff.id);
          setAttendance(record || null);
        } catch (error) {
          console.error(error);
        }
      }
    };
    fetchAttendance();
  }, [open, staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staff || !checkOutTime) return;

    setLoading(true);
    try {
      await api.checkOutStaff(staff.id, checkOutTime);
      toast.success('Checked out successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to check out');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!staff) return null;

  const workHours = attendance?.checkIn && checkOutTime
    ? calculateWorkHours(attendance.checkIn, checkOutTime)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Check Out</DialogTitle>
            <DialogDescription>
              Recording check-out for {staff.firstName} {staff.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {attendance?.checkIn && (
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Check-in time:</span>
                  <span className="font-medium">{formatTime(attendance.checkIn)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="checkOutTime">Check-out Time</Label>
              <Input
                id="checkOutTime"
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                required
              />
            </div>

            {workHours > 0 && (
              <div className="rounded-lg bg-muted p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Work hours:</span>
                  <span className="font-medium text-lg">{formatWorkHours(workHours)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Check Out
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
