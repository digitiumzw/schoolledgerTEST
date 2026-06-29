import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Users,
  UserCheck,
  ClipboardCheck,
  TrendingUp,
  Clock,
  Calendar,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  X,
} from "lucide-react";
import { AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DismissibleAlert } from "@/components/ui/dismissible-alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentFormModal } from "@/components/modals/StudentFormModal";
import { RecordPaymentModal } from "@/components/modals/RecordPaymentModal";
import { useSubscription } from "@/hooks/useSubscription";
import { Class, StudentAttendanceSummary, Student } from "@/types/dashboard";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { api } from "@/api/api";
import { useEffect } from "react";

// Dashboard section components
import { DashboardSection } from "@/components/dashboard/DashboardSection";
import { FinancialSection } from "@/components/dashboard/FinancialSection";
import { EnrolmentSection } from "@/components/dashboard/EnrolmentSection";
import { StaffOverviewSection } from "@/components/dashboard/StaffOverviewSection";
import { TransportOverviewSection } from "@/components/dashboard/TransportOverviewSection";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { EnrollmentByClassSection } from "@/components/dashboard/EnrollmentByClassSection";
import { StudentsAlertsSection } from "@/components/dashboard/StudentsAlertsSection";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { useDashboardAggregation } from "@/hooks/useDashboardAggregation";
import { SetupGuideCard } from "@/components/onboarding/SetupGuideCard";
import { useSetupGuide } from "@/hooks/useSetupGuide";

type TeacherAttendanceRecord = {
  studentId: string;
  date: string;
  status: "present" | "absent" | "late" | "excused" | "half_day" | string;
};


// ─── Teacher Dashboard ────────────────────────────────────────────────────────

function TeacherDashboard() {
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [teacherClasses, setTeacherClasses] = useState<Class[]>([]);
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [attendanceSummary, setAttendanceSummary] = useState<StudentAttendanceSummary[]>([]);
  const [classStudents, setClassStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [classesErrorDismissed, setClassesErrorDismissed] = useState(false);
  const [analyticsErrorDismissed, setAnalyticsErrorDismissed] = useState(false);
  const [attendancePage, setAttendancePage] = useState(0);
  const ATTENDANCE_PAGE_SIZE = 10;

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      loadClassStudents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId]);

  useEffect(() => {
    setAttendancePage(0);
  }, [selectedClassId, startDate, endDate]);

  useEffect(() => {
    if (selectedClassId && classStudents.length > 0) {
      loadClassAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classStudents, startDate, endDate]);

  const loadClasses = async () => {
    try {
      setLoading(true);
      setClassesError(null);
      setClassesErrorDismissed(false);
      const classes = await api.getClasses();
      setTeacherClasses(classes);
      if (classes.length > 0) {
        setSelectedClassId(classes[0].id);
      }
    } catch {
      setClassesError("Could not load your classes. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const loadClassStudents = async () => {
    try {
      const students = await api.getStudentsByClass(selectedClassId);
      setClassStudents(students);
    } catch {
      console.error("Error loading students for class:", selectedClassId);
    }
  };

  const loadClassAnalytics = async () => {
    try {
      setAnalyticsError(null);
      setAnalyticsErrorDismissed(false);
      const startDateStr = format(startDate, "yyyy-MM-dd");
      const endDateStr = format(endDate, "yyyy-MM-dd");

      const records = await api.getStudentAttendance({ classId: selectedClassId });

      const filtered = ((records || []) as TeacherAttendanceRecord[]).filter((r) => {
        const d = new Date(r.date);
        const dow = d.getDay();
        return dow !== 0 && dow !== 6 && r.date >= startDateStr && r.date <= endDateStr;
      });

      const summaryMap = new Map<string, StudentAttendanceSummary>();
      classStudents.forEach((s) => {
        summaryMap.set(s.id, {
          studentId: s.id,
          studentName: `${s.firstName} ${s.lastName}`,
          presentDays: 0,
          absentDays: 0,
          lateDays: 0,
          excusedDays: 0,
          totalDays: filtered.length > 0
            ? [...new Set(filtered.map((r) => r.date))].length
            : 0,
          attendancePercentage: 0,
        });
      });

      filtered.forEach((r) => {
        const entry = summaryMap.get(r.studentId);
        if (!entry) return;
        if (r.status === "present") entry.presentDays++;
        else if (r.status === "absent") entry.absentDays++;
        else if (r.status === "late") entry.lateDays++;
        else if (r.status === "excused") entry.excusedDays++;
      });

      summaryMap.forEach((entry) => {
        if (entry.totalDays > 0) {
          entry.attendancePercentage = Math.round(
            ((entry.presentDays + entry.lateDays) / entry.totalDays) * 100
          );
        }
      });

      setAttendanceSummary(Array.from(summaryMap.values()));
    } catch {
      setAnalyticsError("Could not load attendance analytics. Try selecting the class again.");
    }
  };

  const selectedClass = teacherClasses.find((c) => c.id === selectedClassId);

  const attendanceTotalPages = Math.max(1, Math.ceil(attendanceSummary.length / ATTENDANCE_PAGE_SIZE));
  const pagedAttendance = useMemo(
    () => attendanceSummary.slice(attendancePage * ATTENDANCE_PAGE_SIZE, (attendancePage + 1) * ATTENDANCE_PAGE_SIZE),
    [attendanceSummary, attendancePage]
  );

  const classStats = {
    totalStudents: classStudents.length,
    avgAttendance:
      attendanceSummary.length > 0
        ? Math.round(
            attendanceSummary.reduce((sum, s) => sum + s.attendancePercentage, 0) /
              attendanceSummary.length
          )
        : 0,
    perfectAttendance: attendanceSummary.filter((s) => s.attendancePercentage === 100).length,
    lowAttendance: attendanceSummary.filter((s) => s.attendancePercentage < 75).length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 border border-primary/10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Teacher Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Class analytics and attendance overview</p>
      </div>

      {classesError && !classesErrorDismissed && (
        <DismissibleAlert
          variant="destructive"
          onDismiss={() => setClassesErrorDismissed(true)}
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load classes</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
            <span className="leading-relaxed">{classesError}</span>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 self-start sm:self-center"
              onClick={loadClasses}
            >
              Retry
            </Button>
          </AlertDescription>
        </DismissibleAlert>
      )}

      {analyticsError && !analyticsErrorDismissed && (
        <DismissibleAlert
          variant="destructive"
          onDismiss={() => setAnalyticsErrorDismissed(true)}
        >
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load analytics</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
            <span className="leading-relaxed">{analyticsError}</span>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 self-start sm:self-center"
              onClick={loadClassAnalytics}
            >
              Retry
            </Button>
          </AlertDescription>
        </DismissibleAlert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Select Class & Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Class</label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {teacherClasses.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(startDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => date && setStartDate(date)}
                    disabled={(date) => date > new Date()}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Calendar className="mr-2 h-4 w-4" />
                    {format(endDate, "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={endDate}
                    onSelect={(date) => date && setEndDate(date)}
                    disabled={(date) => date > new Date()}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h3 className="text-lg font-semibold mb-4">{selectedClass?.name} - Analytics</h3>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card aria-label={`Total Students: ${classStats.totalStudents}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Students</CardTitle>
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{classStats.totalStudents}</div>
              <p className="text-xs text-muted-foreground mt-1">In {selectedClass?.name || "class"}</p>
            </CardContent>
          </Card>
          <Card aria-label={`Average Attendance: ${classStats.avgAttendance}%`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Average Attendance</CardTitle>
              <ClipboardCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{classStats.avgAttendance}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {format(startDate, "MMM d")} - {format(endDate, "MMM d")}
              </p>
            </CardContent>
          </Card>
          <Card aria-label={`Perfect Attendance: ${classStats.perfectAttendance}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Perfect Attendance</CardTitle>
              <UserCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{classStats.perfectAttendance}</div>
              <p className="text-xs text-muted-foreground mt-1">100% present</p>
            </CardContent>
          </Card>
          <Card aria-label={`Low Attendance: ${classStats.lowAttendance}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Low Attendance</CardTitle>
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold">{classStats.lowAttendance}</div>
              <p className="text-xs text-muted-foreground mt-1">Below 75%</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Student Attendance Details</CardTitle>
          <CardDescription>Detailed breakdown for {selectedClass?.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {attendanceSummary.length > 0 ? (
            <>
              {/* Desktop: table */}
              <div className="hidden sm:block rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student Name</TableHead>
                      <TableHead className="text-center">Present</TableHead>
                      <TableHead className="text-center">Absent</TableHead>
                      <TableHead className="text-center">Late</TableHead>
                      <TableHead className="text-center">Total Days</TableHead>
                      <TableHead className="text-center">Attendance %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedAttendance.map((summary) => (
                      <TableRow key={summary.studentId}>
                        <TableCell className="font-medium">{summary.studentName}</TableCell>
                        <TableCell className="text-center">{summary.presentDays}</TableCell>
                        <TableCell className="text-center">{summary.absentDays}</TableCell>
                        <TableCell className="text-center">{summary.lateDays}</TableCell>
                        <TableCell className="text-center">{summary.totalDays}</TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={cn(
                              summary.attendancePercentage >= 90
                                ? "bg-green-500 hover:bg-green-500"
                                : summary.attendancePercentage >= 75
                                ? "bg-yellow-500 hover:bg-yellow-500"
                                : "bg-red-500 hover:bg-red-500"
                            )}
                          >
                            {summary.attendancePercentage}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile: card list */}
              <div className="sm:hidden space-y-3">
                {pagedAttendance.map((summary) => (
                  <div key={summary.studentId} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{summary.studentName}</span>
                      <Badge
                        className={cn(
                          "shrink-0",
                          summary.attendancePercentage >= 90
                            ? "bg-green-500 hover:bg-green-500"
                            : summary.attendancePercentage >= 75
                            ? "bg-yellow-500 hover:bg-yellow-500"
                            : "bg-red-500 hover:bg-red-500"
                        )}
                      >
                        {summary.attendancePercentage}%
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <div className="font-semibold text-sm">{summary.presentDays}</div>
                        <div className="text-muted-foreground">Present</div>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{summary.absentDays}</div>
                        <div className="text-muted-foreground">Absent</div>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{summary.lateDays}</div>
                        <div className="text-muted-foreground">Late</div>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{summary.totalDays}</div>
                        <div className="text-muted-foreground">Total</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination */}
              {attendanceTotalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <span className="text-sm text-muted-foreground">
                    Page {attendancePage + 1} of {attendanceTotalPages} ({attendanceSummary.length} students)
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAttendancePage((p) => Math.max(0, p - 1))}
                      disabled={attendancePage === 0}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAttendancePage((p) => Math.min(attendanceTotalPages - 1, p + 1))}
                      disabled={attendancePage >= attendanceTotalPages - 1}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No attendance data for selected period
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Admin / Bursar Dashboard ─────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [noTermAlertDismissed, setNoTermAlertDismissed] = useState(false);
  const [staleDataDismissed, setStaleDataDismissed] = useState(false);
  
  // Must be called unconditionally (React rules of hooks)
  const { activities, activitiesLoading, refetch } =
    useDashboardStats({ includeStats: false, includeEnrollmentByClass: false });
  const {
    stats: aggregatedStats,
    enrollmentByClass: aggregatedEnrollmentByClass,
    isLoading: aggregationLoading,
    error: aggregationError,
    notifications,
    refetch: refetchAggregation,
    refreshNow,
    isRefreshing,
    isStale,
    lastRefresh,
  } = useDashboardAggregation(user?.role !== "teacher");
  const { hasActivePlan } = useSubscription();
  const setupGuideQ = useSetupGuide(user?.role === "admin" || user?.role === "super_admin");

  // Teachers see a different view — no financial/staff/transport data
  if (user?.role === "teacher") {
    return <TeacherDashboard />;
  }

  const handleQuickActionSuccess = () => {
    refetch();
    refetchAggregation();
  };

  return (
    <main className="w-full space-y-6 lg:space-y-8" aria-label="School overview dashboard">
      {/* Hero header */}
      <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 border border-primary/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Dashboard
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <p className="text-sm text-muted-foreground">
                Welcome back! Here's what's happening with your school today.
              </p>
              {!aggregationLoading && (
                aggregatedStats?.currentTermName
                  ? <Badge variant="secondary" className="text-xs font-medium">
                      <Calendar className="h-3 w-3 mr-1" />
                      {aggregatedStats.currentTermName}
                    </Badge>
                  : <Badge variant="outline" className="text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />
                      No active term
                    </Badge>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshNow()}
            disabled={isRefreshing}
            className="shrink-0 w-full sm:w-auto"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing…' : 'Refresh KPIs'}
          </Button>
        </div>
      </div>

      {/* No active term banner */}
      {!aggregationLoading && !aggregatedStats?.currentTermName && !noTermAlertDismissed && (
        <DismissibleAlert
          variant="warning"
          onDismiss={() => setNoTermAlertDismissed(true)}
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No active term configured</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
            <span className="leading-relaxed">
              Some KPIs (collection rate, term revenue, low attendance) require an active term. Update your academic calendar to enable them.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/settings/calendar")}
              className="shrink-0 self-start sm:self-center"
            >
              Update Calendar
            </Button>
          </AlertDescription>
        </DismissibleAlert>
      )}

      {/* Stale data banner */}
      {isStale && !staleDataDismissed && (
        <DismissibleAlert
          variant="warning"
          onDismiss={() => setStaleDataDismissed(true)}
        >
          <RefreshCw className="h-4 w-4" />
          <AlertTitle>KPI data may be outdated</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
            <span className="leading-relaxed">
              {lastRefresh
                ? `Last updated ${new Date(lastRefresh).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Data is more than 5 minutes old'}
              {' — click Refresh to load the latest figures.'}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshNow()}
              disabled={isRefreshing}
              className="shrink-0 self-start sm:self-center"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing…' : 'Refresh now'}
            </Button>
          </AlertDescription>
        </DismissibleAlert>
      )}

      {setupGuideQ.data && (
        <SetupGuideCard guide={setupGuideQ.data} />
      )}

      {/* Quick Actions */}
      <Card className="py-0">
        <CardContent className="px-3 py-2.5 sm:px-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide shrink-0">
              Quick Actions
            </span>
            <QuickActions
              onAddStudent={() => hasActivePlan && setShowAddStudentModal(true)}
              onRecordPayment={() => hasActivePlan && setShowRecordPaymentModal(true)}
              hasActivePlan={hasActivePlan}
            />
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <DashboardSection
        title="Financial Summary"
        description="Outstanding fees, collection rate, and term revenue"
        loading={aggregationLoading}
        error={aggregationError as Error | null}
        onRetry={refetchAggregation}
        skeleton={
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 sm:h-32 rounded-lg" />)}
          </div>
        }
      >
        <FinancialSection stats={aggregatedStats} loading={false} />
      </DashboardSection>

      {/* Enrolment & Academics */}
      <DashboardSection
        title="Enrolment & Academics"
        description="Student counts, classes, and bursary information"
        loading={aggregationLoading}
        error={aggregationError as Error | null}
        onRetry={refetchAggregation}
        skeleton={
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 sm:h-32 rounded-lg" />)}
          </div>
        }
      >
        <EnrolmentSection stats={aggregatedStats} loading={false} />
      </DashboardSection>

      {/* Enrollment by Class */}
      <DashboardSection
        title="Enrollment by Class"
        description="Active student headcount per class broken down by gender"
        loading={aggregationLoading}
        error={aggregationError as Error | null}
        onRetry={refetchAggregation}
        skeleton={
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
          </div>
        }
      >
        <EnrollmentByClassSection classes={aggregatedEnrollmentByClass} loading={false} />
      </DashboardSection>

      {/* Students & Alerts */}
      <DashboardSection
        title="Students & Alerts"
        description="Important student-related information and alerts"
        loading={aggregationLoading}
        error={aggregationError as Error | null}
        onRetry={refetchAggregation}
        skeleton={
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 sm:h-32 rounded-lg" />)}
          </div>
        }
      >
        <StudentsAlertsSection stats={aggregatedStats} />
      </DashboardSection>

      {/* Staff Overview */}
      <DashboardSection
        title="Staff Overview"
        description="Staff headcount, leave, and attendance"
        loading={aggregationLoading}
        error={aggregationError as Error | null}
        onRetry={refetchAggregation}
        skeleton={
          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-28 sm:h-32 rounded-lg" />)}
          </div>
        }
      >
        <StaffOverviewSection stats={aggregatedStats} />
      </DashboardSection>

      {/* Transport */}
      <DashboardSection
        title="Transport"
        description="Active routes and students using transport"
        loading={aggregationLoading}
        error={aggregationError as Error | null}
        onRetry={refetchAggregation}
        skeleton={
          <div className="grid gap-3 sm:gap-4 grid-cols-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-28 sm:h-32 rounded-lg" />)}
          </div>
        }
      >
        <TransportOverviewSection stats={aggregatedStats} />
      </DashboardSection>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" aria-hidden="true" />
            Recent Activity
          </CardTitle>
          <CardDescription>5 most recent activities</CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityFeed activities={activities} loading={activitiesLoading} />
        </CardContent>
      </Card>

      {/* Modals */}
      <StudentFormModal
        open={showAddStudentModal}
        onOpenChange={setShowAddStudentModal}
        onSuccess={handleQuickActionSuccess}
      />
      <RecordPaymentModal
        open={showRecordPaymentModal}
        onOpenChange={setShowRecordPaymentModal}
        onSuccess={handleQuickActionSuccess}
      />
    </main>
  );
}
