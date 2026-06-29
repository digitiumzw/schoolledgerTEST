import { AlertTriangle, DollarSign, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DashboardStats } from "@/types/dashboard";

interface StudentsAlertsSectionProps {
  stats: DashboardStats | null;
}

interface AlertCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconClassName?: string;
  isEmpty: boolean;
  emptyLabel: string;
  description?: string;
  tooltip?: string;
  footer?: React.ReactNode;
}

function AlertCard({ title, value, icon, iconClassName, isEmpty, emptyLabel, description, tooltip, footer }: AlertCardProps) {
  const card = (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <span
          className={cn(
            "inline-flex h-7 w-7 items-center justify-center rounded-full",
            isEmpty ? "bg-muted text-muted-foreground" : iconClassName
          )}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isEmpty ? (
          <p className="text-sm text-muted-foreground leading-relaxed">{emptyLabel}</p>
        ) : (
          <div className="space-y-1">
            <div className="text-xl sm:text-2xl font-bold tracking-tight">{value}</div>
            {description && <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>}
            {footer && <div className="pt-1">{footer}</div>}
          </div>
        )}
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

export function StudentsAlertsSection({ stats }: StudentsAlertsSectionProps) {
  const lowAttendance = stats?.lowAttendanceStudents ?? 0;
  const outstanding = stats?.outstandingBalanceStudents ?? 0;
  const overCapacityCount = stats?.overCapacityClasses ?? 0;
  const overCapacityNames = stats?.overCapacityClassNames ?? [];

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
      <AlertCard
        title="Low Attendance"
        value={lowAttendance}
        icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
        iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
        isEmpty={lowAttendance === 0}
        emptyLabel="No students below 75% attendance"
        description="Students below 75% attendance this term"
        tooltip="Students whose attendance is below 75% for the current academic term. Requires an active term to be configured."
      />

      <AlertCard
        title="Outstanding Balances"
        value={outstanding}
        icon={<DollarSign className="h-3.5 w-3.5" aria-hidden="true" />}
        iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
        isEmpty={outstanding === 0}
        emptyLabel="No outstanding balances"
        description="Students with any balance owed"
        tooltip="Students who owe any positive amount across all terms, regardless of when the charges were raised."
      />

      <AlertCard
        title="Over-Capacity Classes"
        value={overCapacityCount}
        icon={<LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />}
        iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
        isEmpty={overCapacityCount === 0}
        emptyLabel="All classes within capacity"
        description={overCapacityCount > 0 ? "Classes exceeding student limit" : undefined}
        tooltip="Active classes where enrolled active student count is at or above the configured class capacity (100% utilization or more)."
        footer={
          overCapacityCount > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {overCapacityNames.map((name) => (
                <Badge key={name} variant="destructive" className="text-[10px] font-medium">
                  {name}
                </Badge>
              ))}
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
