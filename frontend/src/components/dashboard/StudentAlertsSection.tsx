import { AlertTriangle, DollarSign, Users, GraduationCap } from "lucide-react";
import { MetricTile } from "@/components/dashboard/MetricTile";
import { DashboardStats } from "@/types/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface StudentAlertsSectionProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function StudentAlertsSection({ stats, loading }: StudentAlertsSectionProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
      </div>
    );
  }

  const lowAttendance = stats?.lowAttendanceStudents ?? 0;
  const highOverdue = stats?.highOverdueBalances ?? 0;
  const overCapacity = stats?.overCapacityClasses ?? 0;
  const withOutstanding = stats?.withOutstanding ?? 0;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <MetricTile
        title="Low Attendance"
        value={lowAttendance}
        icon={AlertTriangle}
        description={lowAttendance === 0 ? "All students above 75%" : "Students below 75% attendance"}
        variant={lowAttendance > 0 ? "danger" : "success"}
        onClick={lowAttendance > 0 ? () => navigate("/attendance") : undefined}
        tooltip="Students whose overall attendance rate has fallen below 75%. These students may need follow-up from teachers or parents."
      />
      <MetricTile
        title="High Overdue Balances"
        value={highOverdue}
        icon={DollarSign}
        description={highOverdue === 0 ? "No high overdue balances" : "Students with balance over $100"}
        variant={highOverdue > 0 ? "danger" : "success"}
        onClick={highOverdue > 0 ? () => navigate("/students") : undefined}
        tooltip="Students with an outstanding balance exceeding $100. These accounts may need urgent attention or payment arrangements."
      />
      <MetricTile
        title="Outstanding Balances"
        value={withOutstanding}
        icon={Users}
        description={withOutstanding === 0 ? "All balances settled" : "Students with any outstanding balance"}
        variant={withOutstanding > 0 ? "warning" : "success"}
        onClick={withOutstanding > 0 ? () => navigate("/students") : undefined}
        tooltip="The total number of students who have any unpaid balance, regardless of amount. Includes both current-term and carried-over fees."
      />
      <MetricTile
        title="Over-Capacity Classes"
        value={overCapacity}
        icon={GraduationCap}
        description={overCapacity === 0 ? "All classes within capacity" : "Classes exceeding student limit"}
        variant={overCapacity > 0 ? "warning" : "success"}
        onClick={overCapacity > 0 ? () => navigate("/classes") : undefined}
        tooltip="Classes where the number of enrolled students exceeds the defined maximum capacity. Consider redistributing students or increasing the limit."
      />
    </div>
  );
}
