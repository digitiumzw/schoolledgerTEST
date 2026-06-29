import { useState } from 'react';
import { useClassAttendanceSummary } from '../../hooks/useClassAttendance';
import type { ClassAttendanceSummaryStudent } from '../../types/dashboard';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface Props {
  classId: string;
  startDate: string;
  endDate: string;
}

function RateBadge({ rate }: { rate: number }) {
  const color =
    rate >= 85 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
    rate >= 70 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {rate.toFixed(1)}%
    </span>
  );
}

export default function ClassAttendanceSummaryTable({ classId, startDate, endDate }: Props) {
  const [search, setSearch] = useState('');

  const { data, isLoading, isError } = useClassAttendanceSummary(classId, startDate, endDate, search || undefined);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive py-4">Failed to load attendance summary.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xl font-semibold tabular-nums">{data.totalStudents}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Students</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <div className="flex justify-center mt-0.5">
            <RateBadge rate={data.classAttendanceRate} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Class Rate</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-sm font-medium truncate">{data.className}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{data.academicSession}</p>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Search students…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="text-center">Present</TableHead>
              <TableHead className="text-center">Absent</TableHead>
              <TableHead className="text-center hidden sm:table-cell">Late</TableHead>
              <TableHead className="text-center hidden sm:table-cell">Excused</TableHead>
              <TableHead className="text-center">Days</TableHead>
              <TableHead className="text-center">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.students.map((s: ClassAttendanceSummaryStudent) => (
              <TableRow key={s.studentId}>
                <TableCell>
                  <div className="font-medium">{s.studentName}</div>
                  <div className="text-xs text-muted-foreground">{s.admissionNumber}</div>
                </TableCell>
                <TableCell className="text-center text-green-700 dark:text-green-400">{s.present}</TableCell>
                <TableCell className="text-center text-red-700 dark:text-red-400">{s.absent}</TableCell>
                <TableCell className="text-center text-yellow-700 dark:text-yellow-400 hidden sm:table-cell">{s.late}</TableCell>
                <TableCell className="text-center text-blue-700 dark:text-blue-400 hidden sm:table-cell">{s.excused}</TableCell>
                <TableCell className="text-center text-muted-foreground">{s.totalDays}</TableCell>
                <TableCell className="text-center">
                  <RateBadge rate={s.attendanceRate} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {data.students.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            No attendance records found for this period.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> ≥85% good</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> ≥70% warning</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> &lt;70% at risk</span>
      </div>
    </div>
  );
}
