/**
 * Step: Staff and student work hours.
 *
 * Feature: 043-school-creation-onboarding
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSaveStep } from '@/hooks/useOnboarding';
import { toast } from 'sonner';

interface Hours { startTime: string; endTime: string; }
interface Props {
  initial?: { staff_work_hours?: Hours; student_work_hours?: Hours };
  onAdvance: () => void;
}

const DEFAULT_STAFF: Hours   = { startTime: '08:00', endTime: '17:00' };
const DEFAULT_STUDENT: Hours = { startTime: '08:00', endTime: '15:30' };

export function StepWorkHours({ initial, onAdvance }: Props) {
  const [staff, setStaff]     = useState<Hours>(initial?.staff_work_hours ?? DEFAULT_STAFF);
  const [student, setStudent] = useState<Hours>(initial?.student_work_hours ?? DEFAULT_STUDENT);
  const save = useSaveStep();

  function isValid(h: Hours) {
    return /^\d{2}:\d{2}$/.test(h.startTime) && /^\d{2}:\d{2}$/.test(h.endTime) && h.startTime < h.endTime;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid(staff) || !isValid(student)) {
      toast.error('Each schedule must have a valid start time before its end time.');
      return;
    }
    try {
      await save.mutateAsync({
        step: 'work-hours',
        data: { staff_work_hours: staff, student_work_hours: student },
      });
      onAdvance();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save work hours');
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold">Operating hours</h2>
        <p className="text-sm text-muted-foreground">
          Set the default work hours for staff and students. These power attendance, late check-ins,
          and reports.
        </p>
      </div>

      <fieldset className="grid gap-2 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Staff hours</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start</Label>
            <Input type="time" value={staff.startTime}
              onChange={(e) => setStaff({ ...staff, startTime: e.target.value })} />
          </div>
          <div>
            <Label>End</Label>
            <Input type="time" value={staff.endTime}
              onChange={(e) => setStaff({ ...staff, endTime: e.target.value })} />
          </div>
        </div>
      </fieldset>

      <fieldset className="grid gap-2 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Student hours</legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start</Label>
            <Input type="time" value={student.startTime}
              onChange={(e) => setStudent({ ...student, startTime: e.target.value })} />
          </div>
          <div>
            <Label>End</Label>
            <Input type="time" value={student.endTime}
              onChange={(e) => setStudent({ ...student, endTime: e.target.value })} />
          </div>
        </div>
      </fieldset>

      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  );
}
