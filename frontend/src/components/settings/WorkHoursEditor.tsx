import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WorkHours } from "@/types/dashboard";

export interface WorkHoursEditorProps {
  staffWorkHours?: WorkHours;
  studentWorkHours?: WorkHours;
  onStaffWorkHoursChange: (hours: WorkHours) => void;
  onStudentWorkHoursChange: (hours: WorkHours) => void;
}

export function WorkHoursEditor({
  staffWorkHours,
  studentWorkHours,
  onStaffWorkHoursChange,
  onStudentWorkHoursChange,
}: WorkHoursEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-semibold">Work Hours</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure start and end times for attendance status calculation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Staff</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="staffStartTime">Start Time</Label>
              <Input
                id="staffStartTime"
                type="time"
                value={staffWorkHours?.startTime || "08:30"}
                onChange={(e) =>
                  onStaffWorkHoursChange({
                    startTime: e.target.value,
                    endTime: staffWorkHours?.endTime || "17:00",
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staffEndTime">End Time</Label>
              <Input
                id="staffEndTime"
                type="time"
                value={staffWorkHours?.endTime || "17:00"}
                onChange={(e) =>
                  onStaffWorkHoursChange({
                    startTime: staffWorkHours?.startTime || "08:30",
                    endTime: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Students</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="studentStartTime">Start Time</Label>
              <Input
                id="studentStartTime"
                type="time"
                value={studentWorkHours?.startTime || "08:00"}
                onChange={(e) =>
                  onStudentWorkHoursChange({
                    startTime: e.target.value,
                    endTime: studentWorkHours?.endTime || "15:00",
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="studentEndTime">End Time</Label>
              <Input
                id="studentEndTime"
                type="time"
                value={studentWorkHours?.endTime || "15:00"}
                onChange={(e) =>
                  onStudentWorkHoursChange({
                    startTime: studentWorkHours?.startTime || "08:00",
                    endTime: e.target.value,
                  })
                }
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
