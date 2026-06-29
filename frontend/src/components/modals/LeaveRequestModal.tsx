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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/api';
import { Staff } from '@/types/dashboard';
import { calculateDays, calculateWorkingDays } from '@/lib/attendanceUtils';

interface LeaveRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LeaveRequestModal({ open, onOpenChange, onSuccess }: LeaveRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    staffId: '',
    leaveType: 'annual' as 'annual' | 'sick' | 'maternity' | 'paternity' | 'study' | 'unpaid' | 'compassionate',
    startDate: '',
    endDate: '',
    reason: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [staffRes, holidaysData] = await Promise.all([
          api.getStaff({ limit: 100 }),
          api.getCalendar(), // Fetch holidays from school calendar
        ]);
        const staffData = staffRes?.data ?? [];
        setStaff(staffData);
        // Holidays is an array of 'YYYY-MM-DD' strings from academic_calendar.holidays
        const holidayDates: string[] = Array.isArray(holidaysData?.holidays)
          ? holidaysData.holidays
          : [];
        setHolidays(holidayDates);
        
        if (staffData.length > 0) {
          setFormData(prev => ({ ...prev, staffId: staffData[0].id }));
        }
      } catch (error) {
        console.error(error);
        // Still set staff even if holidays fail
        try {
          const staffRes = await api.getStaff({ limit: 100 });
          const staffData = staffRes?.data ?? [];
          setStaff(staffData);
          if (staffData.length > 0) {
            setFormData(prev => ({ ...prev, staffId: staffData[0].id }));
          }
        } catch (staffError) {
          console.error(staffError);
        }
      }
    };
    
    if (open) {
      fetchData();
    }
  }, [open]);

  const days = formData.startDate && formData.endDate
    ? calculateWorkingDays(formData.startDate, formData.endDate, holidays)
    : 0;


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.staffId || !formData.startDate || !formData.endDate || !formData.reason) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error('End date must be after start date');
      return;
    }


    setLoading(true);
    try {
      await api.createLeaveRequest({
        ...formData,
        days,
      });
      toast.success('Leave request submitted successfully');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit leave request');
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
            <DialogTitle>Request Leave</DialogTitle>
            <DialogDescription>
              Submit a new leave request for approval
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="staffId">Staff Member *</Label>
              <Select
                value={formData.staffId}
                onValueChange={(value) => setFormData({ ...formData, staffId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                placeholder="Please provide a reason for your leave request..."
                rows={4}
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
