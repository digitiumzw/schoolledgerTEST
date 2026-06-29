import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PaginatedResponse } from "@/types/dashboard";
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
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useTransportAssignments } from "@/hooks/useTransportAssignments";
import { useToast } from "@/hooks/use-toast";

interface RouteStop {
  id: string;
  name: string;
}

interface Route {
  id: string;
  routeName?: string;
  route_name?: string;
  stops?: RouteStop[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName?: string;
  fromRouteId: string;
  fromRouteName?: string;
  onSuccess?: () => void;
}

/**
 * Feature 054 / US1: Reassignment modal.
 *
 * Atomically moves a student from `fromRouteId` to a new route + stop.
 * Calls POST /transport/allocations/reassign which ends the existing
 * allocation and creates a new one in a single transaction.
 */
export function ReassignStudentModal({
  open,
  onOpenChange,
  studentId,
  studentName,
  fromRouteId,
  fromRouteName,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const { reassignStudent } = useTransportAssignments();

  const [toRouteId, setToRouteId] = useState("");
  const [toStopId, setToStopId] = useState("");
  const [direction, setDirection] = useState<"both" | "inbound" | "outbound">("both");
  const [reassignDate, setReassignDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setToRouteId("");
      setToStopId("");
      setDirection("both");
      setNotes("");
      setReassignDate(new Date().toISOString().slice(0, 10));
      setErrorMsg(null);
    }
  }, [open]);

  // Fetch all routes (excluding the source route)
  const { data: routesData } = useQuery<PaginatedResponse<Route>>({
    queryKey: ["transport-routes"],
    queryFn: () => api.getRoutes(),
    enabled: open,
  });

  const targetRoutes = (routesData?.data ?? []).filter((r) => r.id !== fromRouteId);

  // Fetch stops for the chosen target route
  const { data: stopsData, isLoading: stopsLoading } = useQuery<RouteStop[]>({
    queryKey: ["transport-route-stops", toRouteId],
    queryFn: () => api.getRouteStops(toRouteId),
    enabled: open && !!toRouteId,
  });

  // Reset stop when target route changes
  useEffect(() => {
    setToStopId("");
  }, [toRouteId]);

  const stops = stopsData ?? [];
  const noStops = !!toRouteId && !stopsLoading && stops.length === 0;
  const canSubmit =
    !!toRouteId && !!toStopId && !noStops && !reassignStudent.isPending;

  async function handleSubmit() {
    setErrorMsg(null);
    try {
      await reassignStudent.mutateAsync({
        studentId,
        fromRouteId,
        toRouteId,
        toStopId,
        direction,
        reassignDate,
        notes: notes.trim() || undefined,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      const data = err?.response?.data ?? err?.data;
      setErrorMsg(data?.message ?? err?.message ?? "Failed to reassign student");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign Student</DialogTitle>
          <DialogDescription>
            {studentName ? `Move ${studentName} ` : "Move student "}
            from current route to a new route. The current assignment will be
            ended and a new one created in a single transaction.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* Source / target visualization */}
        <div className="rounded-lg border p-3 bg-muted/40 flex items-center gap-2 text-sm">
          <span className="font-medium truncate">
            {fromRouteName ?? fromRouteId}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground italic truncate">
            {toRouteId
              ? targetRoutes.find((r) => r.id === toRouteId)?.routeName ??
                targetRoutes.find((r) => r.id === toRouteId)?.route_name ??
                toRouteId
              : "Select target route"}
          </span>
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="to-route">
              Target Route <span className="text-destructive">*</span>
            </Label>
            <Select value={toRouteId} onValueChange={setToRouteId}>
              <SelectTrigger id="to-route">
                <SelectValue placeholder="Select a different route" />
              </SelectTrigger>
              <SelectContent>
                {targetRoutes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.routeName ?? r.route_name ?? r.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="to-stop">
              Stop <span className="text-destructive">*</span>
            </Label>
            <Select
              value={toStopId}
              onValueChange={setToStopId}
              disabled={!toRouteId || noStops}
            >
              <SelectTrigger id="to-stop">
                <SelectValue
                  placeholder={
                    !toRouteId
                      ? "Select target route first"
                      : stopsLoading
                      ? "Loading stops..."
                      : noStops
                      ? "Target route has no stops"
                      : "Select a stop"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {stops.map((stop) => (
                  <SelectItem key={stop.id} value={stop.id}>
                    {stop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reassign-date">Effective Date</Label>
            <Input
              id="reassign-date"
              type="date"
              value={reassignDate}
              onChange={(e) => setReassignDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Old assignment ends the day before; new assignment starts on this date.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="direction">Direction</Label>
            <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
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
            <Label htmlFor="notes">Reason / Notes</Label>
            <Textarea
              id="notes"
              placeholder="Reason for reassignment (e.g. moved to new neighborhood)"
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
            disabled={reassignStudent.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {reassignStudent.isPending ? "Reassigning..." : "Reassign Student"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
