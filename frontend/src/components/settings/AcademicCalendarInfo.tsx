import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";
import { Term } from "@/types/dashboard";
import { format, parseISO } from "date-fns";

export interface AcademicCalendarInfoProps {
  systemAcademicYear: string;
  activeAcademicSession: string | null | undefined;
  recommendedSession: string;
  currentTerm: Term | null;
}

export function AcademicCalendarInfo({
  systemAcademicYear,
  activeAcademicSession,
  recommendedSession,
  currentTerm,
}: AcademicCalendarInfoProps) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Academic Calendar</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Academic Year</p>
          <p className="text-sm font-medium">{systemAcademicYear}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Derived from system date</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Active Session</p>
          <p className="text-sm font-medium">{activeAcademicSession ?? recommendedSession}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {activeAcademicSession ? "Configured active session" : "Recommended from current date"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Current Term</p>
          {currentTerm ? (
            <>
              <Badge variant="default">{currentTerm.name}</Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {format(parseISO(currentTerm.start), 'MMM d, yyyy')} – {format(parseISO(currentTerm.end), 'MMM d, yyyy')}
              </p>
            </>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">No active term</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
