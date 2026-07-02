import { useEffect, useState, useCallback, useRef, useMemo, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { api, FeeRuleUnbilledAlert } from "@/api/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileCard } from "@/components/MobileCard";
import { Student, Class } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageLoading } from '@/components/ui/loading-spinner';
import { StudentFormModal } from "@/components/modals/StudentFormModal";
import { DeleteStudentModal } from "@/components/modals/DeleteStudentModal";
import { StatusChangeModal } from "@/components/modals/StatusChangeModal";
import { UserPlus, Search, Pencil, Trash2, Eye, ArrowUpDown, Check, X, Users, DollarSign, TrendingUp, Award, Filter, AlertCircle, Receipt, Upload, Download, GraduationCap, HelpCircle } from "lucide-react";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getStatusColor, getBalanceColor, formatCurrency } from "@/lib/studentUtils";
import { useToast } from "@/hooks/use-toast";
import ContextualHelpLink from "@/components/help/ContextualHelpLink";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const StudentRow = memo(({ student, formatCurrency, getBalanceColor, getStatusColor, handleView, handleEdit, handleChangeStatus, handleDelete }: {
  student: Student;
  formatCurrency: (amount: number) => string;
  getBalanceColor: (balance: number) => string;
  getStatusColor: (status: string) => string;
  handleView: (id: string) => void;
  handleEdit: (student: Student) => void;
  handleChangeStatus: (student: Student) => void;
  handleDelete: (student: Student) => void;
}) => (
  <TableRow key={student.id}>
    <TableCell className="font-medium">
      <span className="break-words whitespace-normal">{student.firstName} {student.lastName}</span>
      {student.bursaryStatus === 'full' && (
        <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          Full Bursary
        </Badge>
      )}
      {student.bursaryStatus === 'partial' && (
        <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
          {student.bursaryPercentage}% Bursary
        </Badge>
      )}
      {student.admissionNumber && (
        <div className="text-xs text-muted-foreground font-mono mt-0.5">{student.admissionNumber}</div>
      )}
    </TableCell>
    <TableCell>{student.className || 'No Class'}</TableCell>
    <TableCell>
      <span className={`font-medium ${student.balance > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
        {student.balance > 0 ? formatCurrency(student.balance) : 'Paid up'}
      </span>
    </TableCell>
    <TableCell>
        <div className="text-sm">
        <div className="font-medium">{student.guardian?.name || '—'}</div>
        <div className="text-muted-foreground">{student.guardian?.phone || '—'}</div>
      </div>
    </TableCell>
    <TableCell>
      <Badge className={getStatusColor(student.status)} variant="outline">
        {student.status.replace('_', ' ')}
      </Badge>
    </TableCell>
    <TableCell className="text-right print:hidden">
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleView(student.id)}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleEdit(student)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleChangeStatus(student)}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleDelete(student)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </TableCell>
  </TableRow>
));
StudentRow.displayName = 'StudentRow';

const MobileStudentCard = memo(({ student, formatCurrency, getStatusColor, handleView, handleEdit, handleChangeStatus, handleDelete }: {
  student: Student;
  formatCurrency: (amount: number) => string;
  getStatusColor: (status: string) => string;
  handleView: (id: string) => void;
  handleEdit: (student: Student) => void;
  handleChangeStatus: (student: Student) => void;
  handleDelete: (student: Student) => void;
}) => (
  <MobileCard key={student.id}>
    <div className="space-y-3">
      {/* Header: name, admission no., class, badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-base leading-tight break-words whitespace-normal">
            {student.firstName} {student.lastName}
          </div>
          {student.admissionNumber && (
            <div className="text-xs font-mono text-muted-foreground mt-0.5">
              {student.admissionNumber}
            </div>
          )}
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {student.className || 'No Class'}
            </span>
            {student.gender && (
              <span className="text-xs text-muted-foreground capitalize">· {student.gender}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className={getStatusColor(student.status)} variant="outline">
            {student.status.replace('_', ' ')}
          </Badge>
          {student.bursaryStatus === 'full' && (
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 text-xs">
              Full Bursary
            </Badge>
          )}
          {student.bursaryStatus === 'partial' && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 text-xs">
              {student.bursaryPercentage}% Bursary
            </Badge>
          )}
        </div>
      </div>

      {/* Balance row */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div>
          <div className="text-xs text-muted-foreground">Outstanding Balance</div>
          <div className={`font-semibold ${student.balance > 0 ? 'text-destructive' : 'text-green-600 dark:text-green-400'}`}>
            {student.balance > 0 ? formatCurrency(student.balance) : 'Paid up'}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleView(student.id)}
          className="text-muted-foreground"
        >
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      </div>

      {/* Guardian */}
      <div className="pt-2 border-t border-border">
        <div className="text-xs text-muted-foreground mb-1">Primary Guardian</div>
        <div className="text-sm font-medium">{student.guardian?.name || '—'}</div>
        <div className="text-sm text-muted-foreground">{student.guardian?.phone || '—'}</div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleEdit(student)}
          className="flex-1"
        >
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleChangeStatus(student)}
          className="flex-1"
        >
          <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
          Status
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleDelete(student)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  </MobileCard>
));
MobileStudentCard.displayName = 'MobileStudentCard';

export default function Students() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { isOverLimit, maxStudents, studentCount } = useSubscription();
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState({
    totalStudents: 0,
    studentsWithOutstandingBalance: 0,
    totalFeesOwed: 0,
    bursaryCoveragePercentage: 0,
    studentsOnFinancialAid: 0,
    statusCounts: {
      active: 0,
      inactive: 0,
      graduated: 0,
      transferred: 0,
      dropped_out: 0,
      total: 0,
    }
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("active");
  const [showOnlyWithBalance, setShowOnlyWithBalance] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'class' | 'balance'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("students-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("students-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [unbilledAlert, setUnbilledAlert] = useState<FeeRuleUnbilledAlert | null>(null);
  const [unbilledAlertDismissed, setUnbilledAlertDismissed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);


  const classesFetchedRef = useRef(false);

  const fetchClasses = useCallback(async () => {
    if (classesFetchedRef.current) return;
    try {
      // Classes are now fetched with students, no separate call needed
      classesFetchedRef.current = true;
    } catch (error) {
      console.error("Failed to fetch classes:", error);
    }
  }, []);

  const fetchStudents = useCallback(async (page: number = 1, includeClasses: boolean = false) => {
    try {
      setLoading(true);
      const studentsResponse = await api.getStudentsOptimized({
        classId: selectedClass === "all" ? undefined : selectedClass,
        status: selectedStatus === "all" ? "all" : selectedStatus,
        search: searchQuery || undefined,
        balanceOnly: showOnlyWithBalance,
        sortBy: sortField,
        sortOrder: sortOrder,
        page: page,
        limit: pagination.limit,
        includeClasses: includeClasses,
      });
      
      setStudents(studentsResponse.students);
      
      // Set classes if included in response
      if (studentsResponse.classes && !classesFetchedRef.current) {
        setClasses(studentsResponse.classes);
        classesFetchedRef.current = true;
      }
      
      setStats(studentsResponse.stats || {
        totalStudents: 0,
        studentsWithOutstandingBalance: 0,
        totalFeesOwed: 0,
        bursaryCoveragePercentage: 0,
        studentsOnFinancialAid: 0,
        statusCounts: {
          active: 0,
          inactive: 0,
          graduated: 0,
          transferred: 0,
          dropped_out: 0,
          total: 0,
        }
      });
      setPagination(studentsResponse.pagination || {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      });
    } catch (error) {
      console.error("Failed to fetch students:", error);
      setFetchError("Could not load students. Check your connection.");
      toast({
        title: "Error",
        description: "Failed to load students data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [selectedClass, selectedStatus, showOnlyWithBalance, searchQuery, sortField, sortOrder, pagination.limit, toast]);

  const fetchData = useCallback(async (overridePage?: number) => {
    // Single API call that fetches both students and classes
    await fetchStudents(overridePage || 1, true);
  }, [fetchStudents]);

  // Search on Enter key only
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setPagination(prev => ({ ...prev, page: 1 }));
      fetchStudents(1, false);
    }
  }, [fetchStudents]);

  // Single effect for all non-search filters — also runs on mount for initial load (includeClasses: true)
  useEffect(() => {
    // Reset to page 1 and fetch new data
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchStudents(1, true);
  }, [selectedClass, selectedStatus, showOnlyWithBalance, sortField, sortOrder]);



  // Memoized class name lookup to avoid O(n) searches on every render
  const getClassName = useMemo(() => {
    const classMap = new Map(classes.map(cls => [cls.id, cls.name]));
    return (classId: string) => classMap.get(classId) || classId;
  }, [classes]);

  // Memoized pagination calculations - now using server data
  const paginationData = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.limit + 1;
    const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);
    return { 
      totalPages: pagination.totalPages, 
      startIndex, 
      endIndex,
      currentPage: pagination.page,
      total: pagination.total
    };
  }, [pagination]);

  const handleSort = useCallback((field: 'name' | 'class' | 'balance') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    // Backend will handle sorting, no need to manipulate data here
  }, [sortField, sortOrder]);

  const handleView = useCallback((studentId: string) => {
    navigate(`/students/${studentId}`);
  }, [navigate]);

  const handleEdit = useCallback((student: Student) => {
    setSelectedStudent(student);
    setShowEditModal(true);
  }, []);

  const handleDelete = useCallback((student: Student) => {
    setSelectedStudent(student);
    setShowDeleteModal(true);
  }, []);

  const handleChangeStatus = useCallback((student: Student) => {
    setSelectedStudent(student);
    setShowStatusModal(true);
  }, []);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const blob = await api.exportStudentsCsv({
        classId: selectedClass === 'all' ? undefined : selectedClass,
        status: selectedStatus === 'all' ? 'all' : selectedStatus,
        search: searchQuery || undefined,
        balanceOnly: showOnlyWithBalance,
        sortBy: sortField,
        sortOrder: sortOrder,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `students_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to export students';
      toast({ title: 'Export failed', description: message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  }, [selectedClass, selectedStatus, searchQuery, showOnlyWithBalance, sortField, sortOrder, toast]);

  const handleStudentAdded = useCallback(async () => {
    await fetchData();
    setUnbilledAlertDismissed(false);
    api.getFeeRuleUnbilledAlert()
      .then((data) => setUnbilledAlert(data))
      .catch(() => { /* non-critical */ });
  }, [fetchData]);

  // Page navigation functions
  const goToPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
    fetchStudents(page);
  }, [fetchStudents]);

  const goToNextPage = useCallback(() => {
    const nextPage = Math.min(pagination.page + 1, pagination.totalPages);
    setPagination(prev => ({ ...prev, page: nextPage }));
    fetchStudents(nextPage);
  }, [pagination.page, pagination.totalPages, fetchStudents]);

  const goToPreviousPage = useCallback(() => {
    const prevPage = Math.max(1, pagination.page - 1);
    setPagination(prev => ({ ...prev, page: prevPage }));
    fetchStudents(prevPage);
  }, [pagination.page, fetchStudents]);


  if (loading && initialLoad) {
    return <PageLoading text="Loading students..." />;
  }

  return (
    <SubscriptionGuard>
    <TooltipProvider>
      <div className="space-y-6">
      {/* Print-only header */}
      <div className="hidden print:block mb-6 border-b-2 border-foreground pb-4">
        <h1 className="text-2xl font-bold text-center">Student List Report</h1>
        <p className="text-sm text-center text-muted-foreground mt-1">
          Generated on {new Date().toLocaleDateString()}
        </p>
        <div className="mt-3 text-sm text-center">
          <p><strong>Total Students:</strong> {stats.totalStudents}</p>
          {showOnlyWithBalance && (
            <>
              <p><strong>Filter:</strong> Students with Outstanding Balance</p>
              <p><strong>Total Outstanding:</strong> {formatCurrency(
                stats.totalFeesOwed || 0
              )}</p>
            </>
          )}
          {selectedClass && selectedClass !== "all" && (
            <p><strong>Class:</strong> {getClassName(selectedClass)}</p>
          )}
          {selectedStatus && selectedStatus !== "all" && (
            <p><strong>Status:</strong> {selectedStatus.charAt(0).toUpperCase() + selectedStatus.slice(1)}</p>
          )}
        </div>
      </div>

      {!unbilledAlertDismissed && unbilledAlert && unbilledAlert.unbilledStudentCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            {unbilledAlert.unbilledStudentCount} student{unbilledAlert.unbilledStudentCount !== 1 ? 's' : ''} not yet billed
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            <span className="text-amber-700 dark:text-amber-300">
              {unbilledAlert.unbilledStudentCount} of {unbilledAlert.eligibleStudentCount} active students have no charges
              for the current billing period ({unbilledAlert.billingPeriod || '—'}).
              Go to <strong>Payments → Billing</strong> and click <strong>Generate Charges</strong> to bill them
              {unbilledAlert.unbilledStudentCount > 0 ? ' — prorated charges will be applied automatically based on each student\'s enrollment date.' : '.'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-4 shrink-0 text-amber-700 hover:text-amber-900 dark:text-amber-300"
              onClick={() => setUnbilledAlertDismissed(true)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isOverLimit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Student Limit Reached</AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            You've reached your plan's limit of {maxStudents} students. Upgrade your plan to add more.
            <Link to="/billing" className="ml-4 shrink-0">
              <Button variant="outline" size="sm">Upgrade Plan</Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could not load students</AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            {fetchError}
            <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={() => { setFetchError(null); fetchData(); }}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Students</h1>
          <p className="text-muted-foreground">Manage student records and information</p>
        </div>
        <ContextualHelpLink sectionId="student-management" label="Student Management Help" />
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)} className="hidden sm:flex">
            <HelpCircle className="h-4 w-4 mr-2" />
            Students guide
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleExport}
            disabled={isExporting}
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => navigate('/students/import')}
            disabled={isOverLimit}
            title={isOverLimit ? `Student limit reached (${studentCount}/${maxStudents})` : ""}
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button 
            onClick={() => setShowAddModal(true)} 
            className="w-full sm:w-auto"
            disabled={isOverLimit}
            title={isOverLimit ? `Student limit reached (${studentCount}/${maxStudents})` : ""}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Add Student
          </Button>
        </div>
      </div>

      {/* Stat Cards — update dynamically when filters change */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded-lg border border-border bg-card p-6 cursor-help">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground capitalize">
                    {selectedStatus === 'all' ? 'All' : selectedStatus.replace('_', ' ')} Students
                  </p>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.statusCounts.total > 0
                      ? `${stats.statusCounts.total} total across all statuses`
                      : "No students found"}
                  </p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>The number of students matching your current status filter ({selectedStatus === 'all' ? 'all statuses' : selectedStatus.replace('_', ' ')}). Change the status tab to see counts for other groups.</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded-lg border border-border bg-card p-6 cursor-help">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Owing Fees</p>
                  <p className="text-2xl font-bold text-destructive">{stats.studentsWithOutstandingBalance}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalStudents > 0
                      ? `${Math.round((stats.studentsWithOutstandingBalance / stats.totalStudents) * 100)}% of ${stats.totalStudents} students`
                      : "—"}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-destructive" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>Students who still owe money — their total charges (including adjustments) exceed their total payments. Only counts students in the current filter.</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded-lg border border-border bg-card p-6 cursor-help">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Outstanding</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalFeesOwed)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.studentsWithOutstandingBalance > 0
                      ? `avg ${formatCurrency(stats.totalFeesOwed / stats.studentsWithOutstandingBalance)} per student`
                      : "All balances settled"}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-yellow-500" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>The combined unpaid balance across all students in the current filter. This is the total amount still owed to the school.</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <div className="rounded-lg border border-border bg-card p-6 cursor-help">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">On Financial Aid</p>
                  <p className="text-2xl font-bold">{stats.studentsOnFinancialAid ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.totalStudents > 0
                      ? `${stats.bursaryCoveragePercentage}% of ${stats.totalStudents} students`
                      : "—"}
                  </p>
                </div>
                <Award className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p>Students receiving a full or partial bursary/scholarship. Their bursary status is set in their profile and may reduce the fees they are charged.</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Smart Filter Chip - Outstanding Balance Only */}
      <div className="print:hidden">
        <button
          onClick={() => setShowOnlyWithBalance(!showOnlyWithBalance)}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
            showOnlyWithBalance
              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-2 border-red-200 dark:border-red-800 shadow-md"
              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${
            showOnlyWithBalance ? "bg-red-500" : "bg-gray-400"
          }`} />
          {showOnlyWithBalance ? (
            <>
              <span className="font-semibold">Student with Debt ({stats.studentsWithOutstandingBalance})</span>
              <X className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              <span>Show All Students</span>
              <DollarSign className="h-3 w-3" />
            </>
          )}
        </button>
        {showOnlyWithBalance && (
          <p className="mt-2 text-sm text-muted-foreground ml-4">
            Filtering: Only showing students with outstanding balances totaling {formatCurrency(stats.totalFeesOwed)}
          </p>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-col gap-2 print:hidden">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Status Filter:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { value: "active",      label: "Active",      count: stats.statusCounts.active },
            { value: "inactive",    label: "Inactive",    count: stats.statusCounts.inactive },
            { value: "graduated",   label: "Graduated",   count: stats.statusCounts.graduated },
            { value: "transferred", label: "Transferred", count: stats.statusCounts.transferred },
            { value: "dropped_out", label: "Dropped Out", count: stats.statusCounts.dropped_out },
            { value: "all",         label: "All",         count: stats.statusCounts.total },
          ] as const).map(({ value, label, count }) => (
            <button
              key={value}
              onClick={() => setSelectedStatus(value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                selectedStatus === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                selectedStatus === value
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 print:hidden">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, admission number, or guardian..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="pl-10"
          />
        </div>
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isMobile ? (
        /* Mobile Card Layout */
        <div className="space-y-3">
          {students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No students found
            </div>
          ) : (
            students.map((student) => (
              <MobileStudentCard
                key={student.id}
                student={student}
                formatCurrency={formatCurrency}
                getStatusColor={getStatusColor}
                handleView={handleView}
                handleEdit={handleEdit}
                handleChangeStatus={handleChangeStatus}
                handleDelete={handleDelete}
              />
            ))
          )}
        </div>
      ) : (
        /* Desktop Table Layout */
        <div className="rounded-lg border border-border bg-card">
          <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Name
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('class')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Class
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => handleSort('balance')}
                    className="flex items-center gap-1 hover:text-foreground"
                  >
                    Balance
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead>Guardian Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right print:hidden">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No students found
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => (
                  <StudentRow
                    key={student.id}
                    student={student}
                    formatCurrency={formatCurrency}
                    getBalanceColor={getBalanceColor}
                    getStatusColor={getStatusColor}
                    handleView={handleView}
                    handleEdit={handleEdit}
                    handleChangeStatus={handleChangeStatus}
                    handleDelete={handleDelete}
                  />
                ))
              )}
            </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.total > pagination.limit && (
        <div className="flex flex-col items-center justify-between gap-4 px-2 py-4 print:hidden sm:flex-row">
          <div className="text-sm text-muted-foreground">
            Showing {paginationData.startIndex} to {paginationData.endIndex} of{" "}
            {pagination.total} students
          </div>
          
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={goToPreviousPage}
                  className={pagination.page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              
              {/* Desktop: Show page numbers */}
              <div className="hidden sm:flex">
                {Array.from({ length: paginationData.totalPages }, (_, i) => i + 1).map((page) => {
                  const showPage =
                    page === 1 ||
                    page === paginationData.totalPages ||
                    (page >= pagination.page - 1 && page <= pagination.page + 1);
                  
                  const showEllipsisBefore = page === pagination.page - 2 && pagination.page > 3;
                  const showEllipsisAfter = page === pagination.page + 2 && pagination.page < paginationData.totalPages - 2;
                  
                  if (showEllipsisBefore || showEllipsisAfter) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  
                  if (!showPage) return null;
                  
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => goToPage(page)}
                        isActive={pagination.page === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
              </div>
              
              {/* Mobile: Show current page indicator */}
              <PaginationItem className="sm:hidden">
                <span className="px-4 text-sm">
                  Page {pagination.page} of {paginationData.totalPages}
                </span>
              </PaginationItem>
              
              <PaginationItem>
                <PaginationNext
                  onClick={goToNextPage}
                  className={pagination.page === paginationData.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      <StudentFormModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onSuccess={handleStudentAdded}
      />

      <StudentFormModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        student={selectedStudent}
        onSuccess={fetchData}
      />

      <DeleteStudentModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        student={selectedStudent}
        onSuccess={fetchData}
      />

      <StatusChangeModal
        open={showStatusModal}
        onOpenChange={setShowStatusModal}
        student={selectedStudent}
        onSuccess={fetchData}
      />

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Getting Started with Students
            </DialogTitle>
            <DialogDescription>
              How to manage student records, enrollment, and balances.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "Add Students", "Create student profiles with personal details, admission numbers, and guardian contacts. You can also bulk-import students from a CSV template.", UserPlus],
              ["2", "Class Assignment", "Assign students to classes so they appear in attendance registers and fee-rule scopes. Use the Classes page for bulk assignments.", Users],
              ["3", "Status Tracking", "Monitor active, inactive, suspended, and graduated statuses. Status changes are recorded in an auditable history with reasons.", Filter],
              ["4", "Balances & Fees", "View outstanding balances, total charged, and total paid per student. Filter by students with outstanding debt to focus collection efforts.", DollarSign],
              ["5", "Bursaries & Aid", "Mark students with full or partial bursaries. The bursary status appears on their profile and can reduce fee amounts during billing generation.", Award],
            ].map(([step, title, detail, Icon]) => (
              <div key={step} className="flex items-start gap-3 border-b py-2.5 last:border-0">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                  {step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold">{title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="stu-dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="stu-dont-show-again" className="text-sm cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
            <Button onClick={handleDismissOnboarding}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
    </SubscriptionGuard>
  );
}
