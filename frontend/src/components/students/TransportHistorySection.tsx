import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Bus, MapPin } from "lucide-react";
import { useTransportHistory } from "@/hooks/useTransportHistory";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  studentId: string | undefined;
  month?: string;
  year?: string;
  onMonthChange?: (value: string) => void;
  onYearChange?: (value: string) => void;
}

/**
 * Feature 054 / US4: Transport History tab content for the student profile.
 *
 * Shows the chronological list of transport assignments for the student,
 * highlighting the active assignment (if any). Empty state is displayed
 * when the student has no recorded transport history.
 */
export function TransportHistorySection({ studentId, month = "all", year = "all", onMonthChange, onYearChange }: Props) {
  const { data, history, currentAssignment, summary, isLoading } =
    useTransportHistory(studentId, {
      month: month === "all" ? undefined : month,
      year: year === "all" ? undefined : year,
    });
  const filterOptions = data?.filterOptions;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Assignment History</CardTitle>
            <HistoryFilters month={month} year={year} options={filterOptions} onMonthChange={onMonthChange} onYearChange={onYearChange} />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Bus className="h-12 w-12 mb-3 opacity-30" />
          <p className="text-sm">No transport assignments on record</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current assignment summary */}
      {currentAssignment && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bus className="h-4 w-4" /> Current Assignment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Route</p>
                <p className="font-medium">
                  {currentAssignment.routeName ?? currentAssignment.routeId}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stop</p>
                <p className="font-medium flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {currentAssignment.stopName ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Direction</p>
                <p className="font-medium capitalize">
                  {currentAssignment.direction}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="font-medium">
                  {currentAssignment.startDate
                    ? new Date(currentAssignment.startDate).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary stats */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard label="Total Assignments" value={summary.totalAssignments} />
          <SummaryCard label="Active" value={summary.activeAssignments} />
          <SummaryCard
            label="Current Route"
            value={summary.currentRoute ?? "—"}
          />
          <SummaryCard
            label="Earliest"
            value={
              summary.earliestAssignment
                ? new Date(summary.earliestAssignment).toLocaleDateString()
                : "—"
            }
          />
        </div>
      )}

      {/* Full history table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Assignment History</CardTitle>
            <HistoryFilters month={month} year={year} options={filterOptions} onMonthChange={onMonthChange} onYearChange={onYearChange} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Route</TableHead>
                <TableHead>Stop</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {entry.routeName ?? entry.routeId}
                  </TableCell>
                  <TableCell>{entry.stopName ?? "—"}</TableCell>
                  <TableCell className="capitalize text-sm">
                    {entry.direction}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {entry.startDate
                      ? new Date(entry.startDate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {entry.endDate
                      ? new Date(entry.endDate).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        entry.status === "active"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-700"
                      }
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                    {entry.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HistoryFilters({
  month,
  year,
  options,
  onMonthChange,
  onYearChange,
}: {
  month: string;
  year: string;
  options?: {
    months: number[];
    years: number[];
  };
  onMonthChange?: (value: string) => void;
  onYearChange?: (value: string) => void;
}) {
  const months = options?.months ?? [];
  const years = options?.years ?? [];
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={month} onValueChange={onMonthChange}>
        <SelectTrigger className="w-full sm:w-[150px]">
          <SelectValue placeholder="Month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All months</SelectItem>
          {months.map((item) => (
            <SelectItem key={item} value={String(item)}>
              {new Date(2024, item - 1, 1).toLocaleString("en-US", { month: "long" })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={year} onValueChange={onYearChange}>
        <SelectTrigger className="w-full sm:w-[120px]">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All years</SelectItem>
          {years.map((item) => (
            <SelectItem key={item} value={String(item)}>{item}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold mt-1 truncate">{value}</p>
      </CardContent>
    </Card>
  );
}
