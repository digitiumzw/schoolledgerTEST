import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/api/api";
import {
  Student, Class, AttendanceSummary, TransportAllocation, TransportRoute, Enrollment, StatusHistoryEntry,
  StudentProfileHistoryEntry, StudentTimelineResponse
} from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StudentFormModal } from "@/components/modals/StudentFormModal";
import { RecordPaymentModal } from "@/components/modals/RecordPaymentModal";
import { TransportHistorySection } from "@/components/students/TransportHistorySection";
import { ProfileHistoryChangeDialog } from "@/components/students/ProfileHistoryChangeDialog";
import { StudentTimeline } from "@/components/students/StudentTimeline";
import { StudentCampaignsCard } from "@/components/StudentCampaignsCard";
import {
  ArrowLeft, Pencil, DollarSign, Mail, Phone, MapPin, Calendar, User,
  Bus, Receipt, History, AlertCircle, CheckCircle2, Clock, TrendingDown,
  BookOpen, ClipboardCheck, ChevronDown, ChevronRight, Printer, Loader2
} from "lucide-react";
import {
  calculateAge, formatPhoneNumber, getStatusColor, formatCurrency, formatCurrencyForCode
} from "@/lib/studentUtils";
import { useCurrencyConfig } from "@/hooks/useCurrencyConfig";
import { formatTransportFee } from "@/lib/transportUtils";
import { useStudentPrintData } from "@/pages/StudentProfile/hooks/useStudentPrintData";
import { StudentProfilePrintDocument } from "@/pages/StudentProfile/StudentProfilePrintDocument";
import { cn } from "@/lib/utils";

// ─── Local Types ─────────────────────────────────────────────────────────────

interface ChargeRow {
  id: string;
  category: string;
  chargeType: 'fee_structure' | 'transport' | 'other';
  amount: number;
  status: "pending" | "partial" | "paid" | "waived" | "cancelled";
  dateGenerated: string;
  dueDate: string | null;
  termId: string | null;
  termName: string;
  description: string;
  isOpeningBalance: boolean;
}

interface PaymentRow {
  id: string;
  amount: number;
  date: string;
  method: string;
  category: string;
  description: string;
  routeId: string | null;
  currencyCode?: string | null;
  originalAmount?: number | null;
  exchangeRate?: number | null;
  rateManualOverride?: boolean;
}

interface TermBreakdown {
  termId: string;
  termName: string;
  charged: number;
  paid: number;
  balance: number;
}

interface AdjustmentRow {
  id: string;
  adjustmentType: 'credit' | 'debit';
  category: string;
  amount: number;
  paidAmount?: number;
  paymentStatus?: string;
  paidAt?: string | null;
  reason: string;
  effectiveDate: string;
  createdAt: string;
}

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface PaginatedSectionResponse<T> {
  data: T[];
  pagination: PaginationMeta;
  filterOptions?: {
    months: number[];
    years: number[];
  };
}

interface EnrollmentHistoryRow {
  id: string;
  academicSession: string;
  className?: string | null;
  status: string;
  enrollmentDate: string;
  completionDate?: string | null;
}

interface RecentAttendanceRow {
  id: string;
  date: string;
  status: string;
  remarks?: string;
}

interface MonthYearFilterOptions {
  months: number[];
  years: number[];
}

interface FeeStatement {
  summary: {
    totalCharged: number;
    totalPaid: number;
    creditAdjustments: number;
    debitAdjustments: number;
    balance: number;
    feeBalance: number;
    transportBalance: number;
  };
  charges: ChargeRow[];
  chargesPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  paymentsPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  payments: PaymentRow[];
  adjustments: AdjustmentRow[];
  termBreakdown: TermBreakdown[];
  filterOptions?: {
    payments?: MonthYearFilterOptions;
    charges?: MonthYearFilterOptions;
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Derive a human-readable period label for a charge. Monthly charges (due
 * date on the 1st of a month, set by the monthly billing-cycle generator)
 * are labelled "{Month Year} fees" so they are clearly distinguished from
 * single-term charges. Falls back to the charge's term name otherwise.
 */
function getChargePeriodLabel(charge: { dueDate: string | null; termName: string }): string {
  if (charge.dueDate) {
    const d = new Date(charge.dueDate);
    if (!isNaN(d.getTime()) && d.getDate() === 1) {
      return `${d.toLocaleString('en-US', { month: 'long', year: 'numeric' })} fees`;
    }
  }
  return charge.termName;
}

function isMonthlyCharge(charge: { dueDate: string | null }): boolean {
  if (!charge.dueDate) return false;
  const d = new Date(charge.dueDate);
  return !isNaN(d.getTime()) && d.getDate() === 1;
}

function ChargeStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    partial:   "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    pending:   "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    waived:    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  const labels: Record<string, string> = {
    paid:      "Paid",
    partial:   "Partially Paid",
    pending:   "Not Paid",
    waived:    "Waived",
    cancelled: "Cancelled",
  };
  const icons: Record<string, React.ReactNode> = {
    paid:    <CheckCircle2 className="h-3 w-3 mr-1" />,
    partial: <Clock className="h-3 w-3 mr-1" />,
    pending: <AlertCircle className="h-3 w-3 mr-1" />,
  };
  return (
    <Badge variant="outline" className={cn("text-xs flex items-center w-fit", map[status] ?? map.pending)}>
      {icons[status]}
      {labels[status] ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function getAttendanceStatusColor(status: string) {
  switch (status) {
    case "present": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "absent":  return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    case "late":    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    case "excused": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    default:        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  }
}

function monthYearFilterParams(month: string, year: string) {
  return {
    month: month === "all" ? undefined : month,
    year: year === "all" ? undefined : year,
  };
}

function MonthYearFilters({
  month,
  year,
  options,
  onMonthChange,
  onYearChange,
}: {
  month: string;
  year: string;
  options?: MonthYearFilterOptions;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
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

function StatusHistoryTab({ statusHistory }: { statusHistory: StatusHistoryEntry[] }) {
  const statusColors: Record<string, string> = {
    active:      "bg-green-100 text-green-800",
    inactive:    "bg-gray-100 text-gray-700",
    transferred: "bg-blue-100 text-blue-800",
    dropped_out: "bg-red-100 text-red-800",
    graduated:   "bg-purple-100 text-purple-800",
  };

  if (statusHistory.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <History className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm">No status changes recorded yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Status Change History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Changed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statusHistory.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {new Date(entry.effectiveDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {entry.previousStatus ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[entry.previousStatus] ?? "bg-gray-100 text-gray-700"}`}>
                      {entry.previousStatus.replace("_", " ")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[entry.newStatus] ?? "bg-gray-100 text-gray-700"}`}>
                    {entry.newStatus.replace("_", " ")}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs">
                  {entry.reason || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {entry.changedByName || "System"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: currencyConfig } = useCurrencyConfig();
  const baseCurrency = currencyConfig?.baseCurrency ?? 'USD';

  // Core profile data
  const [student, setStudent] = useState<Student | null>(null);
  const [currentEnrollment, setCurrentEnrollment] = useState<Enrollment | null>(null);
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [teacherName, setTeacherName] = useState("Unassigned");
  const [classStudentCount, setClassStudentCount] = useState(0);
  const [transportAssignment, setTransportAssignment] = useState<TransportAllocation | null>(null);
  const [transportRoute, setTransportRoute] = useState<TransportRoute | null>(null);
  const [enrollmentHistory, setEnrollmentHistory] = useState<EnrollmentHistoryRow[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [profileHistory, setProfileHistory] = useState<StudentProfileHistoryEntry[]>([]);
  const [profileFilterOptions, setProfileFilterOptions] = useState<{
    attendance?: MonthYearFilterOptions;
    classHistory?: MonthYearFilterOptions;
  }>({});
  const [timeline, setTimeline] = useState<StudentTimelineResponse | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Attendance data
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<RecentAttendanceRow[]>([]);

  // Quick balance from profile (available immediately, no extra fetch)
  const [balanceData, setBalanceData] = useState<{ balance: number; totalCharges: number; totalPayments: number; feeBalance?: number; transportBalance?: number } | null>(null);

  // Fee statement
  const [feeStatement, setFeeStatement] = useState<FeeStatement | null>(null);
  const [feeStatementLoading, setFeeStatementLoading] = useState(false);
  const [feeStatementError, setFeeStatementError] = useState<string | null>(null);
  const [chargesPage, setChargesPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [openFinanceSections, setOpenFinanceSections] = useState<Record<string, boolean>>({
    payments: true,
    charges: true,
    adjustments: false,
    classHistory: false,
    statusHistory: false,
  });
  const [adjustmentsPage, setAdjustmentsPage] = useState(1);
  const [classHistoryPage, setClassHistoryPage] = useState(1);
  const [statusHistoryPage, setStatusHistoryPage] = useState(1);
  const [adjustmentsData, setAdjustmentsData] = useState<PaginatedSectionResponse<AdjustmentRow> | null>(null);
  const [classHistoryData, setClassHistoryData] = useState<PaginatedSectionResponse<EnrollmentHistoryRow> | null>(null);
  const [statusHistoryData, setStatusHistoryData] = useState<PaginatedSectionResponse<StatusHistoryEntry> | null>(null);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);
  const [classHistoryLoading, setClassHistoryLoading] = useState(false);
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false);
  const [paymentFilterMonth, setPaymentFilterMonth] = useState("all");
  const [paymentFilterYear, setPaymentFilterYear] = useState("all");
  const [chargeFilterMonth, setChargeFilterMonth] = useState("all");
  const [chargeFilterYear, setChargeFilterYear] = useState("all");
  const [attendanceFilterMonth, setAttendanceFilterMonth] = useState("all");
  const [attendanceFilterYear, setAttendanceFilterYear] = useState("all");
  const [classFilterMonth, setClassFilterMonth] = useState("all");
  const [classFilterYear, setClassFilterYear] = useState("all");
  const [assignmentFilterMonth, setAssignmentFilterMonth] = useState("all");
  const [assignmentFilterYear, setAssignmentFilterYear] = useState("all");

  // UI state
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEnrollmentHistory, setShowEnrollmentHistory] = useState(false);
  const [showProfileHistoryDialog, setShowProfileHistoryDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  // ── Data fetching ───────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setFetchError(null);
      const attendanceFilters = monthYearFilterParams(attendanceFilterMonth, attendanceFilterYear);
      const classFilters = monthYearFilterParams(classFilterMonth, classFilterYear);
      const [data, profileHistoryData, statusHistoryData] = await Promise.all([
        api.getStudentProfile(id, {
          attendanceMonth: attendanceFilters.month,
          attendanceYear: attendanceFilters.year,
          classMonth: classFilters.month,
          classYear: classFilters.year,
        }),
        api.getStudentProfileHistory(id),
        api.getStudentStatusHistory(id),
      ]);

      if (!data?.student) {
        navigate("/students");
        return;
      }

      setStudent(data.student);
      setCurrentEnrollment(data.currentEnrollment ?? data.student?.currentEnrollment ?? null);
      setClassInfo(data.class ?? null);
      setTeacherName(data.class?.teacherName ?? "Unassigned");
      setClassStudentCount(data.class?.studentCount ?? 0);
      setAttendanceSummary(data.attendanceSummary ?? null);
      setRecentAttendance(data.recentAttendance ?? []);
      setProfileFilterOptions(data.filterOptions ?? {});
      setTransportAssignment(data.transportAllocation ?? null);
      setTransportRoute(data.transportRoute ?? null);
      setBalanceData(data.balanceData ?? null);
      setEnrollmentHistory(data.enrollmentHistory ?? []);
      setStatusHistory(Array.isArray(statusHistoryData) ? statusHistoryData : (statusHistoryData?.data ?? data.statusHistory ?? []));
      setProfileHistory(profileHistoryData?.history ?? []);
    } catch {
      setFetchError("Could not load student profile. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [id, navigate, attendanceFilterMonth, attendanceFilterYear, classFilterMonth, classFilterYear]);

  const fetchFeeStatement = useCallback(async () => {
    if (!id) return;
    try {
      setFeeStatementLoading(true);
      setFeeStatementError(null);
      const paymentFilters = monthYearFilterParams(paymentFilterMonth, paymentFilterYear);
      const chargeFilters = monthYearFilterParams(chargeFilterMonth, chargeFilterYear);
      const data = await api.getFeeStatement(id, {
        paymentMonth: paymentFilters.month,
        paymentYear: paymentFilters.year,
        chargeMonth: chargeFilters.month,
        chargeYear: chargeFilters.year,
        paymentsPage,
        paymentsLimit: ITEMS_PER_PAGE,
        chargesPage,
        chargesLimit: ITEMS_PER_PAGE,
      });
      setFeeStatement(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setFeeStatementError(message);
    } finally {
      setFeeStatementLoading(false);
    }
  }, [id, paymentFilterMonth, paymentFilterYear, chargeFilterMonth, chargeFilterYear, paymentsPage, chargesPage]);

  const toggleFinanceSection = (section: string) => {
    setOpenFinanceSections((current) => ({ ...current, [section]: !current[section] }));
  };

  const fetchAdjustmentsHistory = useCallback(async () => {
    if (!id || !openFinanceSections.adjustments) return;
    setAdjustmentsLoading(true);
    try {
      const data = await api.getStudentAdjustmentsHistory(id, { page: adjustmentsPage, limit: ITEMS_PER_PAGE });
      setAdjustmentsData(data);
    } finally {
      setAdjustmentsLoading(false);
    }
  }, [id, openFinanceSections.adjustments, adjustmentsPage]);

  const fetchClassHistory = useCallback(async () => {
    if (!id || !openFinanceSections.classHistory) return;
    setClassHistoryLoading(true);
    try {
      const data = await api.getStudentClassHistory(id, { page: classHistoryPage, limit: ITEMS_PER_PAGE });
      setClassHistoryData(data);
    } finally {
      setClassHistoryLoading(false);
    }
  }, [id, openFinanceSections.classHistory, classHistoryPage]);

  const fetchStatusHistory = useCallback(async () => {
    if (!id || !openFinanceSections.statusHistory) return;
    setStatusHistoryLoading(true);
    try {
      const data = await api.getStudentStatusHistory(id, { page: statusHistoryPage, limit: ITEMS_PER_PAGE });
      setStatusHistoryData(data);
    } finally {
      setStatusHistoryLoading(false);
    }
  }, [id, openFinanceSections.statusHistory, statusHistoryPage]);

  const fetchTimeline = useCallback(async () => {
    if (!id) return;
    try {
      setTimelineLoading(true);
      const data = await api.getStudentTimeline(id, { limit: 100 });
      setTimeline(data);
    } finally {
      setTimelineLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    if (activeTab === "fees") {
      fetchFeeStatement();
    }
  }, [activeTab, fetchFeeStatement]);

  useEffect(() => { if (activeTab === "fees") fetchAdjustmentsHistory(); }, [activeTab, fetchAdjustmentsHistory]);
  useEffect(() => { if (activeTab === "fees") fetchClassHistory(); }, [activeTab, fetchClassHistory]);
  useEffect(() => { if (activeTab === "fees") fetchStatusHistory(); }, [activeTab, fetchStatusHistory]);

  useEffect(() => {
    if (activeTab === "timeline" && !timeline && !timelineLoading) {
      fetchTimeline();
    }
  }, [activeTab, timeline, timelineLoading, fetchTimeline]);

  const handleSuccess = () => {
    fetchProfile();
    if (activeTab === "fees") fetchFeeStatement();
    if (activeTab === "timeline") fetchTimeline();
  };

  const { isPreparing, handlePrint, printData } = useStudentPrintData({
    studentId: id ?? '',
    student,
    feeStatement,
    timeline,
    attendanceSummary,
    transportAssignment,
    transportRoute,
    currentEnrollment,
    className: classInfo?.name ?? null,
    teacherName: teacherName !== 'Unassigned' ? teacherName : null,
    classStudentCount,
    balanceData,
  });

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load student profile</AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            {fetchError}
            <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={fetchProfile}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Student not found</p>
        <Button onClick={() => navigate("/students")} className="mt-4">Back to Students</Button>
      </div>
    );
  }

  const attendanceRate = attendanceSummary?.attendanceRate ?? 0;
  // Use feeStatement when available (full detail), otherwise fall back to profile's balanceData
  const balance = feeStatement?.summary.balance ?? balanceData?.balance ?? 0;
  const feeBalance = feeStatement?.summary.feeBalance ?? balanceData?.feeBalance ?? 0;
  const transportBalance = feeStatement?.summary.transportBalance ?? balanceData?.transportBalance ?? 0;

  return (
    <>
    <SubscriptionGuard>
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/students")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Student Profile</h1>
            <p className="text-sm text-muted-foreground">View and manage student details</p>
          </div>
        </div>
        <div className="flex gap-2 pl-12 sm:pl-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={isPreparing || loading}
            className="flex-1 sm:flex-none print:hidden"
          >
            {isPreparing
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Printer className="mr-2 h-4 w-4" />}
            <span>{isPreparing ? 'Preparing…' : 'Print'}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setShowPaymentModal(true); }} className="flex-1 sm:flex-none">
            <DollarSign className="mr-2 h-4 w-4" />
            <span>Record Payment</span>
          </Button>
          <Button size="sm" onClick={() => setShowEditModal(true)} className="flex-1 sm:flex-none">
            <Pencil className="mr-2 h-4 w-4" />
            <span>Edit Student</span>
          </Button>
        </div>
      </div>

      {/* ── Student identity card ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                {student.firstName.charAt(0)}{student.lastName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-4">
              <div>
                <h3 className="text-2xl font-bold text-foreground">
                  {student.firstName} {student.lastName}
                </h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge className={getStatusColor(student.status)} variant="outline">
                    {student.status}
                  </Badge>
                  {classInfo && <Badge variant="secondary">{classInfo.name}</Badge>}
                
                  {student.bursaryStatus !== "none" && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      Bursary {student.bursaryStatus === "partial" ? `(${student.bursaryPercentage}%)` : "(Full)"}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {student.dateOfBirth && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(student.dateOfBirth).toLocaleDateString()} · Age {calculateAge(student.dateOfBirth)}
                  </div>
                )}
                {student.email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {student.email}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Enrolled: {new Date(student.enrollmentDate).toLocaleDateString()}
                </div>
              </div>
            </div>
            {/* Quick balance snapshot — full breakdown is in the Fee Statement tab */}
            <div
              className="w-full cursor-pointer rounded-lg border bg-muted/20 p-4 md:w-auto md:min-w-80"
              onClick={() => setActiveTab("fees")}
              title="View full fee statement"
            >
              <div className="text-sm font-medium text-muted-foreground">Balance Summary</div>
              {(feeStatement || balanceData) ? (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Fees Balance</div>
                      <div className={cn(
                        "text-xl font-bold",
                        feeBalance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"
                      )}>
                        {formatCurrency(feeBalance)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Transport Balance</div>
                      <div className={cn(
                        "text-xl font-bold",
                        transportBalance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"
                      )}>
                        {formatCurrency(transportBalance)}
                      </div>
                    </div>
                  </div>
                  <div className="border-t pt-2 text-xs text-muted-foreground">
                    Actual balance: {formatCurrency(balance)}
                  </div>
                  <div className="text-xs text-muted-foreground underline">View statement →</div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Loading balance…</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold tracking-tight">Student Records</h2>
            <p className="text-sm text-muted-foreground">Use the tabs to move between profile details, finances, attendance, transport, and the full journey timeline.</p>
          </div>
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/60 p-1 sm:grid-cols-3 xl:grid-cols-5">
            <TabsTrigger value="profile" className="justify-start">
              <User className="h-4 w-4 mr-2 hidden sm:inline" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="fees" className="justify-start">
              <Receipt className="h-4 w-4 mr-2 hidden sm:inline" />
              Finance
            </TabsTrigger>
            <TabsTrigger value="attendance" className="justify-start">
              <ClipboardCheck className="h-4 w-4 mr-2 hidden sm:inline" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="transport" className="justify-start">
              <Bus className="h-4 w-4 mr-2 hidden sm:inline" />
              Transport
            </TabsTrigger>
            <TabsTrigger value="timeline" className="justify-start">
              <History className="h-4 w-4 mr-2 hidden sm:inline" />
              Timeline
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="profile" className="space-y-6 mt-6">
          <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Student Details
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setShowProfileHistoryDialog(true)}>
                Record Change
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {student.admissionNumber && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Admission No.</span>
                <span className="font-mono font-semibold text-right">{student.admissionNumber}</span>
              </div>
            )}
            {student.gender && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Gender</span>
                <span className="capitalize text-right">{student.gender}</span>
              </div>
            )}
            {student.nationalId && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">National ID</span>
                <span className="font-mono text-xs text-right">{student.nationalId}</span>
              </div>
            )}
            {student.address && (
              <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3">
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{student.address}</span>
              </div>
            )}
            <Separator />
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Profile History</div>
              {profileHistory.length > 0 ? (
                <div className="space-y-2">
                  {profileHistory.slice(0, 2).map((entry) => (
                    <div key={entry.id} className="rounded-md bg-muted/40 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium capitalize">{entry.fieldName.replace(/_/g, " ")}</span>
                        <span className="text-xs text-muted-foreground">{new Date(entry.effectiveDate).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{entry.reason}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No profile changes recorded.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Phone className="h-4 w-4" />
              Guardian & Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Guardian</span>
              <span className="font-medium text-right">{student.guardian.name}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Relationship</span>
              <span className="text-right">{student.guardian.relationship}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Phone</span>
              <span className="text-right">{formatPhoneNumber(student.guardian.phone)}</span>
            </div>
            {student.guardian.email && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Email</span>
                <span className="text-right break-all">{student.guardian.email}</span>
              </div>
            )}
            {student.guardian2 && (
              <>
                <Separator />
                <div className="rounded-md bg-muted/40 p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Second Guardian</p>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-right">{student.guardian2.name}</span>
                  </div>
                  {student.guardian2.relationship && (
                    <div className="flex justify-between gap-3">
                      <span className="text-muted-foreground">Relationship</span>
                      <span className="text-right">{student.guardian2.relationship}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Phone</span>
                    <span className="text-right">{formatPhoneNumber(student.guardian2.phone)}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Academic & Services
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {classInfo ? (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Class</span>
                  <span className="font-medium text-right">{classInfo.name}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Teacher</span>
                  <span className="text-right">{teacherName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Class Size</span>
                  <span className="text-right">{classStudentCount} / {classInfo.capacity}</span>
                </div>
                {currentEnrollment && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Session</span>
                    <span className="text-right">{currentEnrollment.academicSession}</span>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => setShowEnrollmentHistory(true)}>
                  <History className="mr-2 h-4 w-4" />
                  View Class History
                </Button>
              </div>
            ) : (
              <div className="rounded-md border p-3 text-muted-foreground">No current class assignment.</div>
            )}
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Transport</span>
                <Badge variant={transportAssignment?.status === "active" ? "default" : "outline"}>
                  {transportAssignment?.status === "active" ? "Active" : "Not Active"}
                </Badge>
              </div>
              {transportAssignment && transportRoute && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Route</span>
                    <span className="font-medium text-right">{transportRoute.routeName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Stop</span>
                    <span className="text-right">{transportAssignment.stopName ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Monthly Fee</span>
                    <span className="font-semibold text-primary text-right">{formatTransportFee(transportRoute.monthlyFee)}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
            <StatusHistoryTab statusHistory={statusHistory} />
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            FEE STATEMENT TAB
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="fees" className="space-y-6 mt-6">
          {feeStatementLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : feeStatementError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not load fee statement</AlertTitle>
              <AlertDescription className="flex items-center justify-between mt-1">
                {feeStatementError}
                <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={fetchFeeStatement}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          ) : !feeStatement ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No fee statement data available.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* ── Balance Summary ─────────────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-muted">
                  <CardContent className="pt-4 pb-4">
                    <div className="text-sm text-muted-foreground">Total Billed</div>
                    <div className="text-2xl font-bold text-foreground mt-1">
                      {formatCurrency(feeStatement.summary.totalCharged)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-muted">
                  <CardContent className="pt-4 pb-4">
                    <div className="text-sm text-muted-foreground">Total Paid</div>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                      {formatCurrency(feeStatement.summary.totalPaid)}
                    </div>
                  </CardContent>
                </Card>
                <Card className={cn(
                  "border",
                  feeStatement.summary.balance > 0
                    ? "border-destructive/50 bg-destructive/5"
                    : "border-green-500/30 bg-green-500/5"
                )}>
                  <CardContent className="pt-4 pb-4">
                    <div className="text-sm text-muted-foreground">Outstanding Balance</div>
                    <div className={cn(
                      "text-2xl font-bold mt-1",
                      feeStatement.summary.balance > 0
                        ? "text-destructive"
                        : "text-green-600 dark:text-green-400"
                    )}>
                      {formatCurrency(feeStatement.summary.balance)}
                    </div>
                    {feeStatement.summary.balance <= 0 && (
                      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mt-1">
                        <CheckCircle2 className="h-3 w-3" /> Fully paid
                      </div>
                    )}
                    {feeStatement.summary.balance > 0 && (
                      <>
                        <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                          <TrendingDown className="h-3 w-3" />
                          {formatCurrency(feeStatement.summary.totalPaid)} of {formatCurrency(feeStatement.summary.totalCharged)} paid
                        </div>
                        {(feeStatement.summary.feeBalance !== 0 || feeStatement.summary.transportBalance !== 0) && (
                          <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                            {feeStatement.summary.feeBalance !== 0 && (
                              <div>Fees: {formatCurrency(feeStatement.summary.feeBalance)}</div>
                            )}
                            {feeStatement.summary.transportBalance !== 0 && (
                              <div>Transport: {formatCurrency(feeStatement.summary.transportBalance)}</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── Adjustments section (only if records exist) ─────────────── */}
              {feeStatement.adjustments && feeStatement.adjustments.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Balance Adjustments</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {feeStatement.adjustments.map((adj) => (
                            <TableRow key={adj.id}>
                              <TableCell className="text-sm whitespace-nowrap">
                                {new Date(adj.effectiveDate).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    adj.adjustmentType === 'credit'
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                  )}
                                >
                                  {adj.adjustmentType === 'credit' ? 'Credit' : 'Debit'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm capitalize">
                                {adj.category.replace(/_/g, ' ')}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {adj.reason || "-"}
                              </TableCell>
                              <TableCell className={cn(
                                "text-right font-semibold text-sm",
                                adj.adjustmentType === 'credit'
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-destructive"
                              )}>
                                {adj.adjustmentType === 'credit' ? '-' : '+'}{formatCurrency(adj.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Term-by-term breakdown ──────────────────────────────────── */}
              {feeStatement.termBreakdown.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Term Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Term</TableHead>
                          <TableHead className="text-right">Billed</TableHead>
                          <TableHead className="text-right">Paid</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {feeStatement.termBreakdown.map((term) => (
                          <TableRow key={term.termId}>
                            <TableCell className="font-medium">{term.termName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(term.charged)}</TableCell>
                            <TableCell className="text-right text-green-600 dark:text-green-400">
                              {formatCurrency(term.paid)}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-semibold",
                              term.balance > 0 ? "text-destructive" : "text-green-600 dark:text-green-400"
                            )}>
                              {formatCurrency(term.balance)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── Payments table (BEFORE Charges) ──────────────────────────────────────────── */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="ghost" className="justify-start px-0 text-base font-semibold" onClick={() => toggleFinanceSection("payments")}>
                      {openFinanceSections.payments ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                      Payment History
                    </Button>
                    {openFinanceSections.payments && (
                      <MonthYearFilters
                        month={paymentFilterMonth}
                        year={paymentFilterYear}
                        options={feeStatement.filterOptions?.payments}
                        onMonthChange={(value) => {
                          setPaymentFilterMonth(value);
                          setPaymentsPage(1);
                        }}
                        onYearChange={(value) => {
                          setPaymentFilterYear(value);
                          setPaymentsPage(1);
                        }}
                      />
                    )}
                  </div>
                </CardHeader>
                {openFinanceSections.payments && <CardContent className="p-0">
                  {feeStatement.payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No payments recorded</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Method</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {feeStatement.payments.map((payment) => (
                              <TableRow key={payment.id}>
                                <TableCell className="text-sm whitespace-nowrap">
                                  {new Date(payment.date).toLocaleDateString()}
                                </TableCell>
                                <TableCell className="text-sm">
                                  <span className={cn(
                                    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                    payment.category !== "Transport Fee"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                  )}>
                                    {payment.category || "Fees"}
                                  </span>
                                </TableCell>
                                <TableCell className="text-sm">{payment.method}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {payment.description || "-"}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm text-green-600 dark:text-green-400">
                                  {payment.currencyCode && payment.originalAmount != null && payment.currencyCode !== baseCurrency ? (
                                    <div className="flex flex-col items-end">
                                      <span>{formatCurrencyForCode(payment.originalAmount, payment.currencyCode)}</span>
                                      <span className="text-xs font-normal text-muted-foreground">
                                        ≈ {formatCurrencyForCode(payment.amount, baseCurrency)}
                                      </span>
                                    </div>
                                  ) : (
                                    formatCurrencyForCode(payment.amount, baseCurrency)
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {feeStatement.paymentsPagination && feeStatement.paymentsPagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
                          <span className="text-muted-foreground">
                            {(feeStatement.paymentsPagination.page - 1) * feeStatement.paymentsPagination.limit + 1}–{Math.min(feeStatement.paymentsPagination.page * feeStatement.paymentsPagination.limit, feeStatement.paymentsPagination.total)} of {feeStatement.paymentsPagination.total}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPaymentsPage(p => Math.max(1, p - 1))}
                              disabled={feeStatement.paymentsPagination.page === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPaymentsPage(p => Math.min(feeStatement.paymentsPagination?.totalPages ?? 1, p + 1))}
                              disabled={feeStatement.paymentsPagination.page >= feeStatement.paymentsPagination.totalPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>}
              </Card>

              {/* ── Charges table ───────────────────────────────────────────── */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button variant="ghost" className="justify-start px-0 text-base font-semibold" onClick={() => toggleFinanceSection("charges")}>
                      {openFinanceSections.charges ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                      Billed/Charges
                    </Button>
                    {openFinanceSections.charges && (
                      <MonthYearFilters
                        month={chargeFilterMonth}
                        year={chargeFilterYear}
                        options={feeStatement.filterOptions?.charges}
                        onMonthChange={(value) => {
                          setChargeFilterMonth(value);
                          setChargesPage(1);
                        }}
                        onYearChange={(value) => {
                          setChargeFilterYear(value);
                          setChargesPage(1);
                        }}
                      />
                    )}
                  </div>
                </CardHeader>
                {openFinanceSections.charges && <CardContent className="p-0">
                  {feeStatement.charges.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No billed charges on record</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Period</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {feeStatement.charges.map((charge) => (
                              <TableRow key={charge.id}>
                                <TableCell className="text-sm whitespace-nowrap">
                                  {new Date(charge.dateGenerated).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm">{charge.category}</div>
                                  {charge.description && (
                                    <div className="text-xs text-muted-foreground">{charge.description}</div>
                                  )}
                                  {charge.isOpeningBalance && (
                                    <Badge variant="outline" className="text-xs mt-1">Opening Balance</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm whitespace-nowrap">
                                  {isMonthlyCharge(charge) ? (
                                    <Badge variant="secondary" className="text-xs">
                                      {getChargePeriodLabel(charge)}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">{charge.termName}</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <ChargeStatusBadge status={charge.status} />
                                  {charge.dueDate && charge.status !== "paid" && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Due {new Date(charge.dueDate).toLocaleDateString()}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-sm">
                                  {formatCurrency(charge.amount)}
                                  {charge.currencyCode && (
                                    <span className="ml-1 text-xs text-muted-foreground" title={`Original: ${charge.originalAmount} ${charge.currencyCode} @ ${charge.exchangeRate}`}>
                                      ({charge.currencyCode})
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {feeStatement.chargesPagination && feeStatement.chargesPagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-sm">
                          <span className="text-muted-foreground">
                            {(feeStatement.chargesPagination.page - 1) * feeStatement.chargesPagination.limit + 1}–{Math.min(feeStatement.chargesPagination.page * feeStatement.chargesPagination.limit, feeStatement.chargesPagination.total)} of {feeStatement.chargesPagination.total}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setChargesPage(p => Math.max(1, p - 1))}
                              disabled={feeStatement.chargesPagination.page === 1}
                            >
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setChargesPage(p => Math.min(feeStatement.chargesPagination?.totalPages ?? 1, p + 1))}
                              disabled={feeStatement.chargesPagination.page >= feeStatement.chargesPagination.totalPages}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>}
              </Card>
              <Card>
                <CardHeader>
                  <Button variant="ghost" className="justify-start px-0 text-base font-semibold" onClick={() => toggleFinanceSection("adjustments")}>
                    {openFinanceSections.adjustments ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                    Balance Adjustments
                  </Button>
                </CardHeader>
                {openFinanceSections.adjustments && <CardContent className="p-0">
                  {adjustmentsLoading ? <div className="p-4 text-sm text-muted-foreground">Loading adjustments…</div> : !adjustmentsData || adjustmentsData.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No balance adjustments recorded</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {adjustmentsData.data.map((adj) => (
                            <TableRow key={adj.id}>
                              <TableCell>{new Date(adj.effectiveDate).toLocaleDateString()}</TableCell>
                              <TableCell><Badge variant="outline">{adj.adjustmentType}</Badge></TableCell>
                              <TableCell className="capitalize">{adj.category.replace(/_/g, " ")}</TableCell>
                              <TableCell className="text-muted-foreground">{adj.reason || "-"}</TableCell>
                              <TableCell className="text-right font-semibold">{adj.adjustmentType === "credit" ? "-" : "+"}{formatCurrency(adj.amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      </div>
                      {adjustmentsData.pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
                          <span className="text-muted-foreground">{(adjustmentsData.pagination.page - 1) * adjustmentsData.pagination.limit + 1}–{Math.min(adjustmentsData.pagination.page * adjustmentsData.pagination.limit, adjustmentsData.pagination.total)} of {adjustmentsData.pagination.total}</span>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setAdjustmentsPage(p => Math.max(1, p - 1))} disabled={adjustmentsData.pagination.page === 1}>Previous</Button>
                            <Button variant="outline" size="sm" onClick={() => setAdjustmentsPage(p => Math.min(adjustmentsData.pagination.totalPages, p + 1))} disabled={adjustmentsData.pagination.page >= adjustmentsData.pagination.totalPages}>Next</Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>}
              </Card>
              <Card>
                <CardHeader>
                  <Button variant="ghost" className="justify-start px-0 text-base font-semibold" onClick={() => toggleFinanceSection("classHistory")}>
                    {openFinanceSections.classHistory ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                    Class History
                  </Button>
                </CardHeader>
                {openFinanceSections.classHistory && <CardContent className="p-0">
                  {classHistoryLoading ? <div className="p-4 text-sm text-muted-foreground">Loading class history…</div> : !classHistoryData || classHistoryData.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No class history recorded</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Class</TableHead><TableHead>Session</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>
                        {classHistoryData.data.map((entry) => (<TableRow key={entry.id}><TableCell>{new Date(entry.enrollmentDate).toLocaleDateString()}</TableCell><TableCell>{entry.className || "—"}</TableCell><TableCell>{entry.academicSession}</TableCell><TableCell><Badge variant="outline">{entry.status}</Badge></TableCell></TableRow>))}
                      </TableBody></Table></div>
                      {classHistoryData.pagination.totalPages > 1 && <div className="flex items-center justify-between px-4 py-3 border-t text-sm"><span className="text-muted-foreground">{(classHistoryData.pagination.page - 1) * classHistoryData.pagination.limit + 1}–{Math.min(classHistoryData.pagination.page * classHistoryData.pagination.limit, classHistoryData.pagination.total)} of {classHistoryData.pagination.total}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setClassHistoryPage(p => Math.max(1, p - 1))} disabled={classHistoryData.pagination.page === 1}>Previous</Button><Button variant="outline" size="sm" onClick={() => setClassHistoryPage(p => Math.min(classHistoryData.pagination.totalPages, p + 1))} disabled={classHistoryData.pagination.page >= classHistoryData.pagination.totalPages}>Next</Button></div></div>}
                    </>
                  )}
                </CardContent>}
              </Card>
              <Card>
                <CardHeader><Button variant="ghost" className="justify-start px-0 text-base font-semibold" onClick={() => toggleFinanceSection("statusHistory")}>{openFinanceSections.statusHistory ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}Status Change History</Button></CardHeader>
                {openFinanceSections.statusHistory && <CardContent className="p-0">
                  {statusHistoryLoading ? <div className="p-4 text-sm text-muted-foreground">Loading status history…</div> : !statusHistoryData || statusHistoryData.data.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No status changes recorded</p> : <><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead>Changed By</TableHead></TableRow></TableHeader><TableBody>{statusHistoryData.data.map((entry) => (<TableRow key={entry.id}><TableCell>{new Date(entry.effectiveDate).toLocaleDateString()}</TableCell><TableCell>{entry.previousStatus || "—"}</TableCell><TableCell><Badge variant="outline">{entry.newStatus}</Badge></TableCell><TableCell className="text-muted-foreground">{entry.reason || "—"}</TableCell><TableCell className="text-muted-foreground">{entry.changedByName || "System"}</TableCell></TableRow>))}</TableBody></Table></div>{statusHistoryData.pagination.totalPages > 1 && <div className="flex items-center justify-between px-4 py-3 border-t text-sm"><span className="text-muted-foreground">{(statusHistoryData.pagination.page - 1) * statusHistoryData.pagination.limit + 1}–{Math.min(statusHistoryData.pagination.page * statusHistoryData.pagination.limit, statusHistoryData.pagination.total)} of {statusHistoryData.pagination.total}</span><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setStatusHistoryPage(p => Math.max(1, p - 1))} disabled={statusHistoryData.pagination.page === 1}>Previous</Button><Button variant="outline" size="sm" onClick={() => setStatusHistoryPage(p => Math.min(statusHistoryData.pagination.totalPages, p + 1))} disabled={statusHistoryData.pagination.page >= statusHistoryData.pagination.totalPages}>Next</Button></div></div>}</>}
                </CardContent>}
              </Card>            </>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            ATTENDANCE TAB
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="attendance" className="space-y-6 mt-6">
          {attendanceSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <Card className="col-span-2 sm:col-span-1">
                <CardContent className="pt-4 text-center">
                  <div className="text-3xl font-bold text-foreground">{attendanceRate}%</div>
                  <div className="text-xs text-muted-foreground mt-1">Rate</div>
                </CardContent>
              </Card>
              {[
                { label: "Present", value: attendanceSummary.present, color: "text-green-600 dark:text-green-400" },
                { label: "Absent",  value: attendanceSummary.absent,  color: "text-red-600 dark:text-red-400" },
                { label: "Late",    value: attendanceSummary.late,    color: "text-yellow-600 dark:text-yellow-400" },
                { label: "Excused", value: attendanceSummary.excused, color: "text-blue-600 dark:text-blue-400" },
              ].map(({ label, value, color }) => (
                <Card key={label}>
                  <CardContent className="pt-4 text-center">
                    <div className={cn("text-2xl font-bold", color)}>{value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {recentAttendance.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Attendance Records</CardTitle>
                  <MonthYearFilters
                    month={attendanceFilterMonth}
                    year={attendanceFilterYear}
                    options={profileFilterOptions.attendance}
                    onMonthChange={setAttendanceFilterMonth}
                    onYearChange={setAttendanceFilterYear}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentAttendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge className={getAttendanceStatusColor(record.status)} variant="outline">
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{record.remarks || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {recentAttendance.length === 0 && (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Attendance Records</CardTitle>
                  <MonthYearFilters
                    month={attendanceFilterMonth}
                    year={attendanceFilterYear}
                    options={profileFilterOptions.attendance}
                    onMonthChange={setAttendanceFilterMonth}
                    onYearChange={setAttendanceFilterYear}
                  />
                </div>
              </CardHeader>
              <CardContent className="py-12 text-center text-muted-foreground">
                No attendance records found
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            TRANSPORT HISTORY TAB (Feature 054 / US4)
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="transport" className="space-y-6 mt-6">
          <TransportHistorySection
            studentId={id}
            month={assignmentFilterMonth}
            year={assignmentFilterYear}
            onMonthChange={setAssignmentFilterMonth}
            onYearChange={setAssignmentFilterYear}
          />
        </TabsContent>

        {/* ════════════════════════════════════════════════════════════════════
            STATUS HISTORY TAB
        ════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="status-history" className="space-y-6 mt-6">
          <StatusHistoryTab statusHistory={statusHistory} />
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6 mt-6">
          <StudentTimeline events={timeline?.events ?? []} isLoading={timelineLoading} />
        </TabsContent>
      </Tabs>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <StudentFormModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        student={student}
        onSuccess={handleSuccess}
      />

      <RecordPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        preSelectedStudent={student}
        onSuccess={() => {
          handleSuccess();
          fetchFeeStatement();
        }}
      />

      <ProfileHistoryChangeDialog
        studentId={student.id}
        open={showProfileHistoryDialog}
        onOpenChange={setShowProfileHistoryDialog}
        onSuccess={handleSuccess}
      />

      {/* Class / Enrollment history modal */}
      <Dialog open={showEnrollmentHistory} onOpenChange={setShowEnrollmentHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <DialogTitle>Class History</DialogTitle>
              <MonthYearFilters
                month={classFilterMonth}
                year={classFilterYear}
                options={profileFilterOptions.classHistory}
                onMonthChange={setClassFilterMonth}
                onYearChange={setClassFilterYear}
              />
            </div>
          </DialogHeader>
          {enrollmentHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollmentHistory.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.academicSession}</TableCell>
                    <TableCell>{e.className || "N/A"}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(e.status?.toLowerCase())} variant="outline">
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(e.enrollmentDate).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {e.completionDate ? new Date(e.completionDate).toLocaleDateString() : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">No enrollment history available</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </SubscriptionGuard>

    {createPortal(
      <div id="student-profile-print" className="hidden print-only">
        <style>{`
          @media print {
            body > *:not(#student-profile-print) { display: none !important; }
            #student-profile-print { display: block !important; }
          }
        `}</style>
        {printData && <StudentProfilePrintDocument data={printData} />}
      </div>,
      document.body
    )}
    </>
  );
}
