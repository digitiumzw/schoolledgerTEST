import { Users, UserCheck, UserMinus, Clock, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardStats } from "@/types/dashboard";

interface StaffOverviewSectionProps {
  stats: DashboardStats | null;
}

interface StaffMetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  badge?: string;
  description?: string;
  tooltip?: string;
}

function StaffMetricCard({ title, value, icon, badge, description, tooltip }: StaffMetricCardProps) {
  const card = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-xl sm:text-2xl font-bold">{value}</div>
          {badge && <Badge variant="secondary" className="text-xs">{badge}</Badge>}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );

  if (!tooltip) return card;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{card}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-sm">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function StaffOverviewSection({ stats }: StaffOverviewSectionProps) {
  const totalStaff = stats?.totalStaff ?? 0;
  const teachingStaff = stats?.teachingStaff ?? 0;
  const nonTeachingStaff = stats?.nonTeachingStaff ?? 0;
  const staffOnLeaveToday = stats?.staffOnLeaveToday ?? 0;
  const allActiveStaff = stats?.allActiveStaff ?? 0;
  const attendanceRate = stats?.staffAttendanceRate ?? 0;

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
      <StaffMetricCard
        title="Total Staff"
        value={totalStaff}
        icon={<Users className="h-4 w-4" aria-hidden="true" />}
        description="All staff regardless of status"
        tooltip="All staff records in the system, regardless of employment status. Includes active, inactive, and on-leave staff."
      />
      <StaffMetricCard
        title="Teaching Staff"
        value={teachingStaff}
        icon={<UserCheck className="h-4 w-4" aria-hidden="true" />}
        description="Active teaching staff"
        tooltip="Active staff members with a teaching role designation. Excludes administrative and support staff."
      />
      <StaffMetricCard
        title="Non-Teaching Staff"
        value={nonTeachingStaff}
        icon={<UserMinus className="h-4 w-4" aria-hidden="true" />}
        description="Admin & support staff"
        tooltip="All staff members with a non-teaching role designation, including admin and support staff regardless of status."
      />
      <StaffMetricCard
        title="All Active Staff"
        value={allActiveStaff}
        icon={<Users className="h-4 w-4" aria-hidden="true" />}
        description="Staff with active employment status"
        tooltip="Staff members currently marked as active employees. Excludes resigned, on-leave, or inactive staff."
      />
      <StaffMetricCard
        title="Staff On Leave Today"
        value={staffOnLeaveToday}
        icon={<Calendar className="h-4 w-4" aria-hidden="true" />}
        description="Approved leave today"
        tooltip="Staff members on approved leave that covers today's date. These staff are expected to be absent."
      />
      <StaffMetricCard
        title="Today's Attendance Rate"
        value={`${attendanceRate.toFixed(1)}%`}
        icon={<Clock className="h-4 w-4" aria-hidden="true" />}
        description="Checked in today (excludes staff on leave)"
        tooltip="Percentage of active staff (excluding those on approved leave today) who have checked in today."
      />
    </div>
  );
}
