import { UserCheck, Calendar, ClipboardCheck, UserMinus, BarChart2 } from "lucide-react";
import { MetricTile } from "@/components/dashboard/MetricTile";
import { DashboardStats } from "@/types/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface StaffSectionProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function StaffSection({ stats, loading }: StaffSectionProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
      </div>
    );
  }

  const pendingLeaves = stats?.pendingLeaveRequests ?? 0;
  const staffOnLeave = stats?.staffOnLeave ?? 0;
  const attendanceRate = stats?.staffAttendanceRate ?? 0;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <MetricTile
        title="Total Staff"
        value={stats?.totalStaff ?? 0}
        icon={UserCheck}
        description={`${stats?.teachingStaff ?? 0} teaching · ${(stats?.totalStaff ?? 0) - (stats?.teachingStaff ?? 0)} non-teaching`}
        tooltip="The total number of active staff members at your school, including both teaching and non-teaching personnel."
      />
      <MetricTile
        title="Pending Leave"
        value={pendingLeaves}
        icon={Calendar}
        description={pendingLeaves === 0 ? "No pending requests" : "Awaiting approval"}
        variant={pendingLeaves > 0 ? "warning" : "default"}
        onClick={pendingLeaves > 0 ? () => navigate("/staff-attendance") : undefined}
        tooltip="Leave requests from staff members that are awaiting your approval. Click to review and approve or reject them."
      />
      <MetricTile
        title="On Leave"
        value={staffOnLeave}
        icon={UserMinus}
        description={staffOnLeave === 0 ? "All staff active" : "Currently on approved leave"}
        variant={staffOnLeave > 0 ? "warning" : "default"}
        tooltip="Staff members who are currently on approved leave and not expected to be present at school."
      />
      <MetricTile
        title="Attendance Rate"
        value={`${attendanceRate.toFixed(1)}%`}
        icon={BarChart2}
        description="Today's staff attendance"
        variant={attendanceRate >= 90 ? "success" : attendanceRate >= 70 ? "warning" : attendanceRate > 0 ? "danger" : "default"}
        tooltip="The percentage of staff members who have checked in today. Calculated from today's attendance records."
      />
      <MetricTile
        title="Teaching Staff"
        value={stats?.teachingStaff ?? 0}
        icon={ClipboardCheck}
        description="With active classes"
        tooltip="Staff members who are assigned to teach at least one class. This excludes administrative and support staff."
      />
    </div>
  );
}
