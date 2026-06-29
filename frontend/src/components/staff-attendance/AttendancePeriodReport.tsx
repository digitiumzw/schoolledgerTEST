import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart2 } from 'lucide-react';
import {
  useAttendancePeriodReport,
  useAttendanceDepartmentReport,
} from '@/hooks/useStaffAttendanceReport';
import type { AttendancePeriodSummaryStaff, AttendanceDepartmentSummary } from '@/api/api';

const PAGE_SIZE = 10;

function PaginationControls({ page, totalPages, total, onPageChange, loading }: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
  loading?: boolean;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-2">
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages} ({total} records)
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1 || loading}>
          Previous
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || loading}>
          Next
        </Button>
      </div>
    </div>
  );
}

function statusBadge(rate: number, isOnActiveLeave?: boolean) {
  if (isOnActiveLeave) {
    return <Badge className="bg-blue-100 text-blue-800">On Active Leave</Badge>;
  }
  if (rate >= 90) return <Badge className="bg-green-100 text-green-800">{rate}%</Badge>;
  if (rate >= 70) return <Badge className="bg-yellow-100 text-yellow-800">{rate}%</Badge>;
  return <Badge className="bg-red-100 text-red-800">{rate}%</Badge>;
}

export function AttendancePeriodReport() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';

  const [startDate, setStartDate] = useState(firstOfMonth);
  const [endDate, setEndDate] = useState(today);

  const periodHook = useAttendancePeriodReport();
  const deptHook   = useAttendanceDepartmentReport();

  // Staff tab: backend-driven pagination (1-indexed)
  const [staffPage, setStaffPage] = useState(1);
  // Department tab: client-side pagination (few departments)
  const [deptPage, setDeptPage] = useState(0);

  const staffRecords = periodHook.data?.staff ?? [];
  const deptRecords = deptHook.data?.departments ?? [];

  const staffTotalPages = periodHook.data?.pagination?.totalPages ?? 1;
  const staffTotal = periodHook.data?.pagination?.total ?? staffRecords.length;
  const deptTotalPages = Math.max(1, Math.ceil(deptRecords.length / PAGE_SIZE));

  const pagedDept = useMemo(
    () => deptRecords.slice(deptPage * PAGE_SIZE, (deptPage + 1) * PAGE_SIZE),
    [deptRecords, deptPage]
  );

  useEffect(() => { setDeptPage(0); }, [deptHook.data]);

  const fetchStaffPage = (page: number) => {
    setStaffPage(page);
    periodHook.fetch({ startDate, endDate, page, limit: PAGE_SIZE });
  };

  const handleFetch = () => {
    setStaffPage(1);
    periodHook.fetch({ startDate, endDate, page: 1, limit: PAGE_SIZE });
    deptHook.fetch({ startDate, endDate });
  };

  const isLoading = periodHook.loading || deptHook.loading;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5" />
          Attendance Period Report
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1">
            <Label>End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
          <Button onClick={handleFetch} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Report
          </Button>
        </div>

        {(periodHook.error || deptHook.error) && (
          <p className="text-sm text-destructive">
            {periodHook.error?.message ?? deptHook.error?.message}
          </p>
        )}

        {periodHook.data && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Period: {periodHook.data.period.startDate} → {periodHook.data.period.endDate}
              {' '}· {periodHook.data.period.workingDays} working day{periodHook.data.period.workingDays !== 1 ? 's' : ''}
            </p>
            {periodHook.data.summary && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Staff</p>
                  <p className="text-lg font-semibold">{periodHook.data.summary.staffCount}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Avg. Rate</p>
                  <p className="text-lg font-semibold">{periodHook.data.summary.averageAttendanceRate}%</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Late Days</p>
                  <p className="text-lg font-semibold">{periodHook.data.summary.totalLateDays}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Overtime</p>
                  <p className="text-lg font-semibold">{periodHook.data.summary.totalOvertimeHours.toFixed(1)}h</p>
                </div>
              </div>
            )}
          </div>
        )}

        {(periodHook.data || deptHook.data) && (
          <Tabs defaultValue="staff">
            <TabsList>
              <TabsTrigger value="staff">By Staff</TabsTrigger>
              <TabsTrigger value="department">By Department</TabsTrigger>
            </TabsList>

            <TabsContent value="staff">
              {periodHook.data?.staff.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No records found for this period.</p>
              )}
              {staffRecords.length > 0 && (
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2 pr-4">Staff</th>
                          <th className="py-2 pr-4">Dept</th>
                          <th className="py-2 pr-4 text-right">Present</th>
                          <th className="py-2 pr-4 text-right">Late</th>
                          <th className="py-2 pr-4 text-right">Absent</th>
                          <th className="py-2 pr-4 text-right">Leave</th>
                          <th className="py-2 pr-4 text-right">Early Dep.</th>
                          <th className="py-2 pr-4 text-right">OT Hrs</th>
                          <th className="py-2 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffRecords.map((s: AttendancePeriodSummaryStaff) => (
                          <tr
                            key={s.staffId}
                            className={`border-b hover:bg-muted/30${s.isOnActiveLeave ? ' bg-blue-50/40' : ''}`}
                          >
                            <td className="py-2 pr-4 font-medium">
                              {s.firstName} {s.lastName}
                            </td>
                            <td className="py-2 pr-4 text-muted-foreground">{s.department || '—'}</td>
                            <td className="py-2 pr-4 text-right">{s.isOnActiveLeave ? '—' : s.present}</td>
                            <td className="py-2 pr-4 text-right">{s.isOnActiveLeave ? '—' : s.late}</td>
                            <td className="py-2 pr-4 text-right">{s.isOnActiveLeave ? '—' : s.absent}</td>
                            <td className="py-2 pr-4 text-right">{s.onLeave}</td>
                            <td className="py-2 pr-4 text-right">{s.isOnActiveLeave ? '—' : s.earlyDeparture}</td>
                            <td className="py-2 pr-4 text-right">{s.isOnActiveLeave ? '—' : s.totalOvertimeHours.toFixed(1)}</td>
                            <td className="py-2 text-right">{statusBadge(s.attendanceRate, s.isOnActiveLeave)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls page={staffPage} totalPages={staffTotalPages} total={staffTotal} onPageChange={fetchStaffPage} loading={periodHook.loading} />
                </div>
              )}
            </TabsContent>

            <TabsContent value="department">
              {deptHook.data?.departments.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">No records found for this period.</p>
              )}
              {deptRecords.length > 0 && (
                <div className="space-y-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2 pr-4">Department</th>
                          <th className="py-2 pr-4 text-right">Staff</th>
                          <th className="py-2 pr-4 text-right">Present</th>
                          <th className="py-2 pr-4 text-right">Late</th>
                          <th className="py-2 pr-4 text-right">Absent</th>
                          <th className="py-2 pr-4 text-right">Leave</th>
                          <th className="py-2 pr-4 text-right">OT Hrs</th>
                          <th className="py-2 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedDept.map((d: AttendanceDepartmentSummary) => (
                          <tr key={d.department} className="border-b hover:bg-muted/30">
                            <td className="py-2 pr-4 font-medium">{d.department || '—'}</td>
                            <td className="py-2 pr-4 text-right">{d.staffCount}</td>
                            <td className="py-2 pr-4 text-right">{d.presentDays}</td>
                            <td className="py-2 pr-4 text-right">{d.lateDays}</td>
                            <td className="py-2 pr-4 text-right">{d.absentDays}</td>
                            <td className="py-2 pr-4 text-right">{d.onLeaveDays}</td>
                            <td className="py-2 pr-4 text-right">{d.totalOvertimeHours.toFixed(1)}</td>
                            <td className="py-2 text-right">{statusBadge(d.attendanceRate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls page={deptPage + 1} totalPages={deptTotalPages} total={deptRecords.length} onPageChange={(p) => setDeptPage(p - 1)} />
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
