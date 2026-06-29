import { useState, useCallback, useMemo, useEffect } from "react";
import { useAttendanceSummary } from "@/hooks/useAttendance";
import { useStaffAttendanceFilterMetadata } from "@/hooks/useStaffAttendanceData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-error-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function MonthlySummaryTab() {
  // Get available months from filter metadata
  const { data: filterMetadata, isLoading: metadataLoading } = useStaffAttendanceFilterMetadata();

  // Set default month to current month or first available month
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
  const availableMonths = filterMetadata?.months ?? [];
  const defaultMonth = availableMonths.includes(currentMonth)
    ? currentMonth
    : (availableMonths[0] ?? currentMonth);

  const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    setPage(0);
  }, [selectedMonth]);

  // Fetch monthly summary data
  const {
    data: monthlySummaryData,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useAttendanceSummary(selectedMonth);

  const handleMonthChange = useCallback((value: string) => {
    setSelectedMonth(value);
  }, []);

  const isLoading = metadataLoading || summaryLoading;

  const records = monthlySummaryData?.records ?? [];
  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pagedRecords = useMemo(
    () => records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [records, page]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Monthly Attendance Summary</CardTitle>
              <CardDescription>
                Staff attendance totals and breakdowns by month
              </CardDescription>
            </div>
            <div className="w-full sm:w-[200px]">
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.length > 0 ? (
                    availableMonths.map((month) => (
                      <SelectItem key={month} value={month}>
                        {new Date(month + "-01").toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                        })}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={currentMonth}>
                      {new Date(currentMonth + "-01").toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                      })}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : summaryError ? (
            <QueryErrorState
              title="Could not load monthly summary"
              description="Failed to fetch attendance data for this month."
            />
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
              <Users className="h-10 w-10 text-muted-foreground/50" />
              <p className="font-medium text-muted-foreground">No attendance records for this month</p>
              <p className="text-sm text-muted-foreground">
                Select a different month or ensure staff have checked in during this period.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Name</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="text-center">Total Days</TableHead>
                      <TableHead className="text-center">Present</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-center">Late</TableHead>
                      <TableHead className="text-center">On Leave</TableHead>
                      <TableHead className="text-center">Excused</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRecords.map((rec) => (
                      <TableRow key={rec.staff_id}>
                        <TableCell className="font-medium">
                          {rec.first_name} {rec.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{rec.department}</TableCell>
                        <TableCell className="text-center">{rec.total_days}</TableCell>
                        <TableCell className="text-center text-green-600 font-medium">
                          {rec.present_days}
                        </TableCell>
                        <TableCell className="text-center text-red-600 font-medium">
                          {rec.absent_days}
                        </TableCell>
                        <TableCell className="text-center text-yellow-600 font-medium">
                          {rec.late_days || 0}
                        </TableCell>
                        <TableCell className="text-center text-blue-600 font-medium">
                          {rec.on_leave_days || 0}
                        </TableCell>
                        <TableCell className="text-center text-purple-600 font-medium">
                          {rec.excused_days}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages} ({records.length} staff)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
