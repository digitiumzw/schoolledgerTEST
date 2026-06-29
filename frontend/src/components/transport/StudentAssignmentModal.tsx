import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useTransportAssignments } from "@/hooks/useTransportAssignments";
import { useToast } from "@/hooks/use-toast";

interface RouteStop {
  id: string;
  name: string;
  pickupTime?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeId: string;
  routeName?: string;
  /** Optional: pre-select a student (e.g. from student profile assignment flow). */
  preselectedStudentId?: string;
  onSuccess?: () => void;
}

/**
 * Feature 054 / US1 + US2: Transport assignment modal.
 *
 * Enforces:
 *  - Stop is required (US2). Submit is disabled until a stop is selected.
 *  - Surfaces 409 errors from the API when the student is already assigned
 *    to another route, prompting the admin to use Reassign instead.
 */
export function StudentAssignmentModal({
  open,
  onOpenChange,
  routeId,
  routeName,
  preselectedStudentId,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const { assignStudent } = useTransportAssignments();

  const [studentId, setStudentId] = useState(preselectedStudentId ?? "");
  const [stopId, setStopId] = useState("");
  const [direction, setDirection] = useState<"both" | "inbound" | "outbound">("both");
  const [notes, setNotes] = useState("");
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Reset when reopened
  useEffect(() => {
    if (open) {
      setStudentId(preselectedStudentId ?? "");
      setStopId("");
      setDirection("both");
      setNotes("");
      setConflictError(null);
    }
  }, [open, preselectedStudentId]);

  // Fetch route stops
  const { data: stopsData, isLoading: stopsLoading } = useQuery<RouteStop[]>({
    queryKey: ["transport-route-stops", routeId],
    queryFn: () => api.getRouteStops(routeId),
    enabled: open && !!routeId,
  });

  // Fetch students (for selection)
  const { data: studentsData } = useQuery<any>({
    queryKey: ["students-for-assignment"],
    queryFn: () => api.getStudents(),
    enabled: open && !preselectedStudentId,
  });

  const students = useMemo(() => {
    const list = Array.isArray(studentsData)
      ? studentsData
      : studentsData?.students ?? [];
    return list.filter((s: any) => s.status === "active");
  }, [studentsData]);

  const stops = stopsData ?? [];
  const noStops = !stopsLoading && stops.length === 0;

  const canSubmit =
    !!studentId && !!stopId && !noStops && !assignStudent.isPending;

  async function handleSubmit() {
    setConflictError(null);
    try {
      await assignStudent.mutateAsync({
        routeId,
        studentId,
        stopId,
        direction,
        notes: notes.trim() || undefined,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status;
      const data = err?.response?.data ?? err?.data;
      const existing = data?.errors?.existingAssignment;
      if (status === 409 && existing) {
        setConflictError(
          `Student is already assigned to "${existing.routeName ?? existing.routeId}". Use Reassign instead.`
        );
      } else if (status === 400) {
        setConflictError(data?.message ?? "Validation failed");
      } else {
        toast({
          title: "Assignment failed",
          description: data?.message ?? err?.message ?? "Unknown error",
          variant: "destructive",
        });
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Student to Route</DialogTitle>
          <DialogDescription>
            {routeName ? `Add a student to "${routeName}"` : "Add a student to this route"}
          </DialogDescription>
        </DialogHeader>

        {noStops && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This route has no stops configured. Add at least one stop before
              assigning students.
            </AlertDescription>
          </Alert>
        )}

        {conflictError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{conflictError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-2">
          {!preselectedStudentId && (
            <div className="space-y-1.5">
              <Label htmlFor="student">Student</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger id="student">
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName ?? s.first_name} {s.lastName ?? s.last_name}
                      {s.className ? ` (${s.className})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="stop">
              Stop <span className="text-destructive">*</span>
            </Label>
            <Select value={stopId} onValueChange={setStopId} disabled={noStops}>
              <SelectTrigger id="stop">
                <SelectValue
                  placeholder={
                    stopsLoading ? "Loading stops..." : "Select a stop"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {stops.map((stop) => (
                  <SelectItem key={stop.id} value={stop.id}>
                    {stop.name}
                    {stop.pickupTime ? ` — ${stop.pickupTime}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Required: a specific stop on this route.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="direction">Direction</Label>
            <Select
              value={direction}
              onValueChange={(v) => setDirection(v as any)}
            >
              <SelectTrigger id="direction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both ways</SelectItem>
                <SelectItem value="inbound">Inbound only</SelectItem>
                <SelectItem value="outbound">Outbound only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Optional notes (pickup details, etc.)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={assignStudent.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {assignStudent.isPending ? "Assigning..." : "Assign Student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
