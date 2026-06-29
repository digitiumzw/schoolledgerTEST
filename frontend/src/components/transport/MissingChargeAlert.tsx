import { AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DismissibleAlert } from "@/components/ui/dismissible-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useMissingChargeAlerts } from "@/hooks/useMissingChargeAlerts";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  /** Optional month override (YYYY-MM). Defaults to current month. */
  month?: string;
  /** Optional route filter. */
  routeId?: string;
  /** Called when the user dismisses the alert banner. */
  onDismiss?: () => void;
}

/**
 * Feature 054 / US5: Dashboard alert banner highlighting students with active
 * transport assignments who are missing a transport charge for the month.
 *
 * Renders nothing when there are no missing charges (silent on success).
 */
export function MissingChargeAlert({ month, routeId, onDismiss }: Props) {
  const { totalMissing, byRoute, month: resolvedMonth, isLoading } =
    useMissingChargeAlerts({ month, routeId });
  const [showDetails, setShowDetails] = useState(false);

  if (isLoading || totalMissing === 0) {
    return null;
  }

  const monthLabel = formatMonth(resolvedMonth);

  return (
    <>
      <DismissibleAlert variant="warning" onDismiss={onDismiss}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>
          {totalMissing} student{totalMissing === 1 ? "" : "s"} missing transport
          charges for {monthLabel}
        </AlertTitle>
        <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2">
          <span className="leading-relaxed">
            Generate transport charges to ensure billing is up to date.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(true)}
            className="shrink-0 self-start sm:self-center"
          >
            View details <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </AlertDescription>
      </DismissibleAlert>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Missing Transport Charges — {monthLabel}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {byRoute.map((group) => (
              <div key={group.routeId}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold">
                    {group.routeName ?? group.routeId}
                  </h3>
                  <Badge variant="secondary">
                    {group.missingCount} missing
                  </Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Adm. No.</TableHead>
                      <TableHead className="text-right">Monthly Fee</TableHead>
                      <TableHead>Assigned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.students.map((student) => (
                      <TableRow key={student.studentId}>
                        <TableCell className="font-medium">
                          {student.firstName} {student.lastName}
                        </TableCell>
                        <TableCell className="text-sm">
                          {student.className ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {student.admissionNumber ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {student.monthlyFee.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {student.assignmentDate
                            ? new Date(student.assignmentDate).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map((p) => parseInt(p, 10));
  if (!y || !m) return yyyymm;
  const date = new Date(y, m - 1, 1);
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
