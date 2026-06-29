import type { StudentTimelineEvent } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { History } from "lucide-react";

interface Props {
  events: StudentTimelineEvent[];
  isLoading?: boolean;
}

const EVENT_LABELS: Record<StudentTimelineEvent["eventType"], string> = {
  profile_change: "Profile",
  status_change: "Status",
  enrollment: "Enrollment",
  transport_assignment: "Transport",
  charge: "Charge",
  payment: "Payment",
  ledger_adjustment: "Adjustment",
};

export function StudentTimeline({ events, isLoading = false }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <History className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">No timeline events found for the selected filters</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Student Journey Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {events.map((event) => (
          <div key={event.id} className="rounded-lg border p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{EVENT_LABELS[event.eventType]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.eventDate).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="font-semibold text-foreground">{event.title}</h4>
                {event.summary && <p className="text-sm text-muted-foreground">{event.summary}</p>}
              </div>
              <span className="text-xs text-muted-foreground font-mono">{event.sourceType}</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
