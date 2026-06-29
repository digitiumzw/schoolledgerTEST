import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ClipboardList, BarChart2 } from 'lucide-react';
import { api } from '../../api/api';
import ClassAttendanceSubmitForm from './ClassAttendanceSubmitForm';
import ClassAttendanceSummaryTable from './ClassAttendanceSummaryTable';
import { useAttendanceAuditLog } from '../../hooks/useClassAttendance';
import type { AttendanceAuditEvent, ClassAttendanceStatus } from '../../types/dashboard';

// ─── Audit log dialog ────────────────────────────────────────────────────────

interface AuditDialogProps {
  studentId: string;
  classId: string;
  date: string;
  periodKey?: string | null;
  onClose: () => void;
}

function AuditDialog({ studentId, classId, date, periodKey, onClose }: AuditDialogProps) {
  const { data, isLoading } = useAttendanceAuditLog(studentId, classId, date, periodKey);

  const statusColor: Record<ClassAttendanceStatus, string> = {
    present:  'bg-green-100 text-green-800',
    absent:   'bg-red-100 text-red-800',
    late:     'bg-yellow-100 text-yellow-800',
    excused:  'bg-blue-100 text-blue-800',
    half_day: 'bg-purple-100 text-purple-800',
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Attendance History — {date}</DialogTitle>
        </DialogHeader>

        {isLoading && <p className="text-sm text-muted-foreground py-4">Loading…</p>}

        {!isLoading && data && (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {data.events.length === 0 && (
              <p className="text-sm text-muted-foreground">No events recorded.</p>
            )}
            {data.events.map((ev: AttendanceAuditEvent, i: number) => (
              <div key={ev.id} className="flex items-start gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 ${ev.isEffective ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                  {i < data.events.length - 1 && <div className="w-0.5 h-6 bg-border mt-0.5" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${statusColor[ev.status as ClassAttendanceStatus]}`}>
                      {ev.status}
                    </span>
                    {ev.isEffective && <Badge variant="outline" className="text-xs text-green-600 border-green-300">Effective</Badge>}
                    {!ev.isEffective && <span className="text-xs text-muted-foreground/60 line-through">Superseded</span>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(ev.submittedAt).toLocaleString()} · {ev.submittedBy}
                  </div>
                  {ev.remarks && <div className="text-xs text-muted-foreground italic mt-0.5">"{ev.remarks}"</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Summary date picker ─────────────────────────────────────────────────────

function SummaryPane() {
  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [classId, setClassId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(thirtyDaysAgo);
  const [endDate, setEndDate] = useState<string>(today);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-for-attendance-summary'],
    queryFn: () => api.getClasses(),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Select class…" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c: { id: string; name: string }) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="summary-from">From</Label>
          <Input id="summary-from" type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="summary-to">To</Label>
          <Input id="summary-to" type="date" value={endDate} min={startDate} max={today} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      {classId && startDate && endDate && (
        <ClassAttendanceSummaryTable
          classId={classId}
          startDate={startDate}
          endDate={endDate}
        />
      )}

      {!classId && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <BarChart2 className="h-10 w-10 mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Select a class to view attendance summary.</p>
        </div>
      )}
    </div>
  );
}

// ─── Main tab ────────────────────────────────────────────────────────────────

export default function ClassAttendanceTab() {
  const [auditTarget, setAuditTarget] = useState<{
    studentId: string; classId: string; date: string; periodKey?: string | null;
  } | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Class Attendance
          </CardTitle>
          <CardDescription>
            Record and review daily student attendance linked directly to classes.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="record">
            <TabsList className="mb-4">
              <TabsTrigger value="record">Record Attendance</TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            <TabsContent value="record">
              <ClassAttendanceSubmitForm />
            </TabsContent>

            <TabsContent value="summary">
              <SummaryPane />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {auditTarget && (
        <AuditDialog
          studentId={auditTarget.studentId}
          classId={auditTarget.classId}
          date={auditTarget.date}
          periodKey={auditTarget.periodKey}
          onClose={() => setAuditTarget(null)}
        />
      )}
    </>
  );
}
