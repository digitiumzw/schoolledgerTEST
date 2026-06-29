import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentCapacityCardProps {
  studentCount: number;
  maxStudents: number | null;
  capacityPercent: number | null;
  remainingSlots: number | null;
  isLoading: boolean;
}

function getProgressColor(percent: number): string {
  if (percent >= 75) return "bg-red-500";
  if (percent >= 50) return "bg-amber-500";
  return "bg-primary";
}

export function StudentCapacityCard({
  studentCount,
  maxStudents,
  capacityPercent,
  remainingSlots,
  isLoading,
}: StudentCapacityCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Users className="h-4 w-4 text-muted-foreground" />
          Student Capacity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-4 w-52" />
          </div>
        ) : maxStudents === null ? (
          <div className="space-y-1 text-sm">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold">{studentCount}</span>
              <span className="text-muted-foreground">students enrolled</span>
            </div>
            <p className="text-xs text-muted-foreground">No student limit on this plan</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end justify-between text-sm">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold">{studentCount}</span>
                <span className="text-muted-foreground">/ {maxStudents} students</span>
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  capacityPercent !== null && capacityPercent >= 75
                    ? "text-red-600 dark:text-red-400"
                    : capacityPercent !== null && capacityPercent >= 50
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground",
                )}
              >
                {capacityPercent}% used
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  getProgressColor(capacityPercent ?? 0),
                )}
                style={{ width: `${Math.min(capacityPercent ?? 0, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {remainingSlots !== null && remainingSlots > 0
                ? `${remainingSlots} slot${remainingSlots !== 1 ? "s" : ""} remaining`
                : "No slots remaining"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
