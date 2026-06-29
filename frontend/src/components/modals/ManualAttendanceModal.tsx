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
import { Staff, StaffAttendanceRecord } from '@/types/dashboard';
import { calculateWorkHours } from '@/lib/attendanceUtils';

interface ManualAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: StaffAttendanceRecord | null;
  onSuccess: () => void;
}

export function ManualAttendanceModal({ open, onOpenChange, record, onSuccess }: ManualAttendanceModalProps) {
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [formData, setFormData] = useState({
    staffId: '',
    date: '',
    checkIn: '',
    checkOut: '',
    status: 'present' as 'present' | 'absent' | 'late' | 'half_day' | 'on_leave',
    remarks: '',
  });

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
      if (record) {
        setFormData({
          staffId: record.staffId,
          date: record.date,
          checkIn: record.checkIn || '',
          checkOut: record.checkOut || '',
          status: record.status,
          remarks: record.remarks || '',
        });
      } else {
        setFormData({
          staffId: staff[0]?.id || '',
          date: new Date().toISOString().split('T')[0],
          checkIn: '',
          checkOut: '',
          status: 'present',
          remarks: '',
        });
      }
    }
  }, [open, record, staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.staffId || !formData.date) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const workHours = formData.checkIn && formData.checkOut
        ? calculateWorkHours(formData.checkIn, formData.checkOut)
        : undefined;

      if (record) {
        await api.updateStaffAttendance(record.id, {
          ...formData,
          workHours,
        });
        toast.success('Attendance record updated successfully');
      } else {
        await api.recordStaffAttendance({
          ...formData,
          workHours,
        });
        toast.success('Attendance record created successfully');
      }
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save attendance record');
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
            <DialogTitle>{record ? 'Edit' : 'Add'} Attendance Record</DialogTitle>
            <DialogDescription>
              Manually {record ? 'update' : 'record'} staff attendance
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="staffId">Staff Member *</Label>
              <Select
                value={formData.staffId}
                onValueChange={(value) => setFormData({ ...formData, staffId: value })}
                disabled={!!record}
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
              <Label htmlFor="date">Date *</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkIn">Check In</Label>
                <Input
                  id="checkIn"
                  type="time"
                  value={formData.checkIn}
                  onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="checkOut">Check Out</Label>
                <Input
                  id="checkOut"
                  type="time"
                  value={formData.checkOut}
                  onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="half_day">Half Day</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
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
              {record ? 'Update' : 'Add'} Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
