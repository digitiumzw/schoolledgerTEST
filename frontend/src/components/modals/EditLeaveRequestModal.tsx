import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/api';
import { LeaveRequest } from '@/types/dashboard';
import { formatLeaveType, calculateWorkingDays } from '@/lib/attendanceUtils';

interface EditLeaveRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leave: LeaveRequest | null;
  onSuccess: () => void;
}

export function EditLeaveRequestModal({ open, onOpenChange, leave, onSuccess }: EditLeaveRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    leaveType: 'annual' as 'annual' | 'sick' | 'maternity' | 'paternity' | 'study' | 'unpaid' | 'compassionate',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    if (open && leave) {
      setFormData({
        leaveType: leave.leaveType as any,
        startDate: leave.startDate,
        endDate: leave.endDate,
        reason: leave.reason,
      });
      // Fetch holidays
      api.getCalendar().then((holidaysData: any[]) => {
        const holidayDates = holidaysData
          .filter((event: any) => event.type === 'holiday')
          .map((event: any) => event.date);
        setHolidays(holidayDates);
      }).catch(console.error);
    }
  }, [open, leave]);

  const days = formData.startDate && formData.endDate
    ? calculateWorkingDays(formData.startDate, formData.endDate, holidays)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.startDate || !formData.endDate || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error('End date must be after start date');
      return;
    }

    setLoading(true);
    try {
      await api.updateLeaveRequest(leave!.id, {
        ...formData,
        days,
      });
      toast.success('Leave request updated successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update leave request');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Leave Request</DialogTitle>
            <DialogDescription>
              Update the leave request details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="leaveType">Leave Type *</Label>
              <Select
                value={formData.leaveType}
                onValueChange={(value: any) => setFormData({ ...formData, leaveType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                  <SelectItem value="maternity">Maternity Leave</SelectItem>
                  <SelectItem value="paternity">Paternity Leave</SelectItem>
                  <SelectItem value="study">Study Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  <SelectItem value="compassionate">Compassionate Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  min={formData.startDate}
                  required
                />
              </div>
            </div>

            {days > 0 && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  Working days (excluding weekends & holidays):{' '}
                  <span className="font-medium text-foreground">{days}</span>
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="reason">Reason *</Label>
              <Textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Enter reason for leave..."
                rows={3}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
