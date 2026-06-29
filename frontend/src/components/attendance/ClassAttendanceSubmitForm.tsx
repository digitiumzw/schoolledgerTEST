import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/api';
import { useSubmitClassAttendance, useClassAttendanceRegister } from '../../hooks/useClassAttendance';
import type { ClassAttendanceBatchRecord, ClassAttendanceStatus } from '../../types/dashboard';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { AlertCircle, CheckCircle2, Clock, Loader2, UserX, BookOpen } from 'lucide-react';
import type { Class } from '../../types/dashboard';

const STATUS_OPTIONS: { value: ClassAttendanceStatus; label: string; color: string }[] = [
  { value: 'present',  label: 'Present',   color: 'bg-green-100 text-green-800' },
  { value: 'absent',   label: 'Absent',    color: 'bg-red-100 text-red-800' },
  { value: 'late',     label: 'Late',      color: 'bg-yellow-100 text-yellow-800' },
  { value: 'excused',  label: 'Excused',   color: 'bg-blue-100 text-blue-800' },
  { value: 'half_day', label: 'Half Day',  color: 'bg-purple-100 text-purple-800' },
];

export default function ClassAttendanceSubmitForm() {
  const today = new Date().toISOString().split('T')[0];

  const [classId, setClassId] = useState<string>('');
  const [date, setDate] = useState<string>(today);
  const [records, setRecords] = useState<Record<string, ClassAttendanceBatchRecord>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['classes-for-attendance'],
    queryFn: () => api.getClasses(),
    staleTime: 5 * 60_000,
  });

  const { data: enrolledStudents = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['class-students-for-attendance', classId],
    queryFn: async () => {
      if (!classId) return [];
      const result = await api.getClassWithStudents(classId, { status: 'active', limit: 100, sortBy: 'name', sortOrder: 'asc' });
      return (result?.students ?? []) as { id: string; firstName: string; lastName: string }[];
    },
    enabled: Boolean(classId),
    staleTime: 60_000,
  });

  const { data: existingRegister } = useClassAttendanceRegister(classId || null, date || null, null, { limit: 100, sortBy: 'studentName', sortOrder: 'asc' });

  const submitMutation = useSubmitClassAttendance();

  // Get selected class name for display
  const selectedClass = classes.find((c) => c.id === classId);

  const setStatus = (studentId: string, status: ClassAttendanceStatus) => {
    setRecords((prev) => ({ ...prev, [studentId]: { studentId, status, remarks: prev[studentId]?.remarks ?? '' } }));
  };

  const setRemarks = (studentId: string, remarks: string) => {
    setRecords((prev) => {
      const existing = prev[studentId];
      if (!existing) return prev;
      return { ...prev, [studentId]: { ...existing, remarks } };
    });
  };

  const markAll = (status: ClassAttendanceStatus) => {
    const next: Record<string, ClassAttendanceBatchRecord> = {};
    enrolledStudents.forEach((s) => {
      next[s.id] = { studentId: s.id, status, remarks: records[s.id]?.remarks ?? '' };
    });
    setRecords(next);
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!classId || !date) {
      setSubmitError('Select a class and date before submitting.');
      return;
    }

    const batchRecords = Object.values(records);
    if (batchRecords.length === 0) {
      setSubmitError('Mark at least one student before submitting.');
      return;
    }

    try {
      const result = await submitMutation.mutateAsync({ classId, date, records: batchRecords });
      const skippedMsg = result.skipped?.length > 0
        ? ` (${result.skipped.length} student(s) skipped — not enrolled or inactive)`
        : '';
      setSubmitSuccess(`Attendance saved for ${result.saved} student(s).${skippedMsg}`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to save attendance.');
    }
  };

  const existingMap = Object.fromEntries(
    (existingRegister?.records ?? []).map((r) => [r.studentId, r.status as ClassAttendanceStatus])
  );

  return (
    <div className="space-y-5">
      {/* Class + Date selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select value={classId} onValueChange={(v) => { setClassId(v); setRecords({}); }}>
            <SelectTrigger>
              <SelectValue placeholder={loadingClasses ? 'Loading…' : 'Select class'} />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c: Class) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClass && (
            <p className="text-xs text-muted-foreground">
              {enrolledStudents.length} active student{enrolledStudents.length !== 1 ? 's' : ''} enrolled
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="attendance-date">Date</Label>
          <Input
            id="attendance-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* Quick-mark all */}
      {enrolledStudents.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground font-medium">Mark all:</span>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => markAll(opt.value)}
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${opt.color} hover:opacity-80 transition-opacity`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {existingRegister?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Present</p>
            <p className="font-semibold">{existingRegister.summary.presentCount}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Absent</p>
            <p className="font-semibold">{existingRegister.summary.absentCount}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Late</p>
            <p className="font-semibold">{existingRegister.summary.lateCount}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Excused</p>
            <p className="font-semibold">{existingRegister.summary.excusedCount}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Half Day</p>
            <p className="font-semibold">{existingRegister.summary.halfDayCount}</p>
          </div>
        </div>
      )}

      {/* Student list */}
      {classId && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Remarks</TableHead>
                <TableHead className="text-center">Existing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingStudents
                ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </TableCell>
                    </TableRow>
                  ))
                : enrolledStudents.map((student) => {
                    const current = records[student.id]?.status;
                    const existing = existingMap[student.id];
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">
                          {student.firstName} {student.lastName}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={current ?? ''}
                            onValueChange={(v) => setStatus(student.id, v as ClassAttendanceStatus)}
                          >
                            <SelectTrigger className="h-8 text-xs w-32">
                              <SelectValue placeholder="—" />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Input
                            className="h-8 text-xs"
                            placeholder="Optional remarks"
                            value={records[student.id]?.remarks ?? ''}
                            onChange={(e) => setRemarks(student.id, e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          {existing ? (
                            <Badge variant="outline" className="text-xs">{existing}</Badge>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>

          {!loadingStudents && enrolledStudents.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center px-4">
              <BookOpen className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No active enrolled students found for this class.</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Inactive, transferred, graduated, suspended, or archived students are excluded.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Feedback */}
      {submitError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      )}
      {submitSuccess && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700 dark:text-green-300">{submitSuccess}</AlertDescription>
        </Alert>
      )}

      {/* Summary + submit row */}
      <div className="flex items-center justify-between pt-1">
        {Object.keys(records).length > 0 ? (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span>{Object.values(records).filter((r) => r.status === 'present').length} present</span>
            <UserX className="h-3.5 w-3.5 text-red-500" />
            <span>{Object.values(records).filter((r) => r.status === 'absent').length} absent</span>
            <Clock className="h-3.5 w-3.5 text-yellow-500" />
            <span>{Object.values(records).filter((r) => r.status === 'late').length} late</span>
          </div>
        ) : <div />}
        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending || Object.keys(records).length === 0 || !classId}
        >
          {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {submitMutation.isPending ? 'Saving…' : 'Save Attendance'}
        </Button>
      </div>
    </div>
  );
}
