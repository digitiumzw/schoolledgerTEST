import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, type FeeRuleUnbilledAlert, type PaymentFilterOptions, type PaymentHistoryRecord, type PaymentSortField } from "@/api/api";
import { Student, Class, PaymentCategory, AcademicCalendar } from "@/types/dashboard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/useDebounce";
import { useCurrencyConfig } from "@/hooks/useCurrencyConfig";
import { MobileCard } from "@/components/MobileCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RecordPaymentModal } from "@/components/modals/RecordPaymentModal";
import { PaymentHistoryModal } from "@/components/modals/PaymentHistoryModal";
import { PrintReceiptModal } from "@/components/modals/PrintReceiptModal";
import { PaymentsByCategoryPanel } from "@/components/payments/PaymentsByCategoryPanel";
import { CancelReceiptModal } from "@/components/modals/CancelReceiptModal";
import { useCancelReceipt } from "@/hooks/useCancelReceipt";
import { ReconciliationTab } from "@/components/settings/ReconciliationTab";
import ContextualHelpLink from "@/components/help/ContextualHelpLink";
import { FeeStructureTab } from "@/components/settings";
import { BillingTab } from "@/components/settings/BillingTab";
import { PaymentCategoriesTab } from "@/components/settings/PaymentCategoriesTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import {
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  Receipt,
  AlertCircle,
  Eye,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Tag,
  FileText,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { formatCurrency, formatCurrencyForCode } from "@/lib/studentUtils";

function getStudentName(payment: PaymentHistoryRecord): string {
  const student = payment.student;
  if (student?.firstName && student?.lastName) {
    return `${student.firstName} ${student.lastName}`;
  }
  return student?.firstName || 'Unknown Student';
}

function getStudentClass(payment: PaymentHistoryRecord): string {
  return payment.student?.className || 'Unassigned';
}

function getStudentId(payment: PaymentHistoryRecord): string {
  return payment.student?.id || payment.studentId;
}

export default function Payments() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { data: currencyConfig } = useCurrencyConfig();
  const baseCurrency = currencyConfig?.baseCurrency ?? 'USD';
  const [classes, setClasses] = useState<Class[]>([]);
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
  const [paymentFilterOptions, setPaymentFilterOptions] = useState<PaymentFilterOptions | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterClass, setFilterClass] = useState("all");
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterYear, setFilterYear] = useState("all");
  const [showVoided, setShowVoided] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<PaymentSortField>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);
  const [cancelReceiptNumber, setCancelReceiptNumber] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>(() => {
    const tabParam = searchParams.get("tab");
    return tabParam ?? "payments";
  });
  const [unbilledAlert, setUnbilledAlert] = useState<FeeRuleUnbilledAlert | null>(null);
  const [unbilledDismissed, setUnbilledDismissed] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [showGenerateReportModal, setShowGenerateReportModal] = useState(false);
  const [reportType, setReportType] = useState<'month' | 'term'>('month');
  const [reportMonth, setReportMonth] = useState<string>(String(new Date().getMonth() + 1));
  const [reportYear, setReportYear] = useState<string>(String(new Date().getFullYear()));
  const [reportTermId, setReportTermId] = useState<string>('');
  const [reportCurrency, setReportCurrency] = useState<string>('');
  const [calendar, setCalendar] = useState<AcademicCalendar | null>(null);
  const itemsPerPage = 20;
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch unbilled-charges alert (feature 057 US1)
  useEffect(() => {
    let cancelled = false;
    api.getFeeRuleUnbilledAlert()
      .then((data) => { if (!cancelled) setUnbilledAlert(data); })
      .catch(() => { /* silently ignore — endpoint may be unavailable on older backends */ });
    return () => { cancelled = true; };
  }, []);

  const canGenerateReport = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'bursar';

  const handleGenerateReport = useCallback(async () => {
    setIsGeneratingReport(true);
    try {
      const filters: { month?: number; year?: number; termId?: string; classId?: string; method?: string; category?: string; reportingCurrency?: string } = {
        classId: filterClass !== 'all' ? filterClass : undefined,
        method: filterMethod !== 'all' ? filterMethod : undefined,
        category: filterCategory !== 'all' && filterCategory !== 'none' ? filterCategory : undefined,
        ...(reportCurrency && reportCurrency !== baseCurrency ? { reportingCurrency: reportCurrency } : {}),
      };

      if (reportType === 'term') {
        if (!reportTermId) {
          toast.error('Please select a term');
          setIsGeneratingReport(false);
          return;
        }
        filters.termId = reportTermId;
      } else {
        filters.month = Number(reportMonth);
        filters.year = Number(reportYear);
      }

      const blob = await api.downloadFinancialReport(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = reportType === 'term'
        ? `financial-report-term-${reportTermId}-${new Date().toISOString().slice(0, 10)}.pdf`
        : `financial-report-${reportYear}-${String(reportMonth).padStart(2, '0')}.pdf`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Financial report downloaded successfully.');
      setShowGenerateReportModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate report.';
      toast.error(msg);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [reportType, reportTermId, reportMonth, reportYear, filterClass, filterMethod, filterCategory, calendar]);

  const fetchReferenceData = useCallback(async () => {
    const sourceNames = ['classes', 'payment categories', 'payment filter options'];
    try {
      setFetchError(null);
      const results = await Promise.allSettled([
        api.getClasses(),
        api.getPaymentCategories(),
        api.getPaymentFilterOptions(),
        api.getCalendar(),
      ]);

      const failures = results
        .map((r, i) => r.status === 'rejected' ? sourceNames[i] : null)
        .filter(Boolean);
      if (failures.length > 0) {
        setFetchError(`Could not load: ${failures.join(', ')}. Other data may be incomplete.`);
      }

      const [classesResult, categoriesResult, filterOptionsResult] = results;
      const classesData = classesResult.status === 'fulfilled' ? classesResult.value : [];
      const categoriesData = categoriesResult.status === 'fulfilled' ? categoriesResult.value : [];
      setClasses(classesData);
      setPaymentCategories(categoriesData.filter((cat: PaymentCategory) => cat.active));
      setPaymentFilterOptions(filterOptionsResult.status === 'fulfilled' ? filterOptionsResult.value : null);
      setCalendar(results[3].status === 'fulfilled' ? results[3].value : null);
    } catch {
      setFetchError("Failed to load payments data. Check your connection.");
    }
  }, []);

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  const paymentsQuery = useQuery({
    queryKey: ['payments-with-students', currentPage, itemsPerPage, debouncedSearchTerm, filterMethod, filterCategory, filterClass, filterMonth, filterYear, sortBy, sortOrder, showVoided],
    queryFn: () => api.getPaymentsWithStudents({
      page: currentPage,
      limit: itemsPerPage,
      search: debouncedSearchTerm,
      method: filterMethod,
      category: filterCategory === "none" ? "" : filterCategory,
      classId: filterClass,
      month: filterMonth,
      year: filterYear,
      sortBy,
      sortOrder,
      includeVoided: showVoided,
    }),
    placeholderData: keepPreviousData,
  });

  const paginatedPayments = paymentsQuery.data?.data ?? [];

  const stats = paymentsQuery.data?.summary ?? paymentsQuery.data?.stats ?? {
    totalAmount: 0,
    totalCount: 0,
    totalThisMonth: 0,
    totalOutstanding: 0,
    paymentsToday: 0,
    byMethod: [],
    byCategory: [],
  };
  const totalPages = paymentsQuery.data?.pagination.totalPages ?? 1;
  const totalPayments = paymentsQuery.data?.pagination.total ?? 0;
  const isLoadingPayments = paymentsQuery.isLoading;
  const isFetchingPayments = paymentsQuery.isFetching;
  const cancelMutation = useCancelReceipt();
  const monthNames = useMemo(
    () => Array.from({ length: 12 }, (_, index) => new Date(2024, index, 1).toLocaleString("en-US", { month: "long" })),
    []
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, filterMethod, filterCategory, filterClass, filterMonth, filterYear, sortBy, sortOrder, showVoided]);

  useEffect(() => {
    if (!paymentsQuery.isFetching && totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, paymentsQuery.isFetching, totalPages]);

  const handleViewHistory = (payment: PaymentHistoryRecord) => {
    const studentDisplayName = getStudentName(payment);
    const [firstName = studentDisplayName, ...rest] = studentDisplayName.split(" ");
    const lastName = rest.join(" ");
    const paymentStudent = payment.student;
    const student: Student = {
      id: getStudentId(payment),
      tenantId: payment.tenantId,
      firstName: paymentStudent?.firstName || firstName,
      lastName: paymentStudent?.lastName || lastName,
      admissionNumber: paymentStudent?.admissionNumber ?? '',
      classId: paymentStudent?.classId ?? '',
      className: getStudentClass(payment),
      balance: Number(paymentStudent?.currentBalance) || 0,
    } as Student;

    setSelectedStudent(student);
    setShowHistoryModal(true);
  };

  const handleSort = (field: PaymentSortField) => {
    if (sortBy === field) {
      setSortOrder((current) => current === "asc" ? "desc" : "asc");
      return;
    }
    setSortBy(field);
    setSortOrder(field === "studentName" ? "asc" : "desc");
  };

  const sortLabel = (field: PaymentSortField) => sortBy === field ? (sortOrder === "asc" ? " ↑" : " ↓") : "";


  const getMethodBadgeColor = (method: string) => {
    switch (method) {
      case "Cash":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "EcoCash":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Bank Transfer":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <SubscriptionGuard>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Payments</h1>
          <p className="text-muted-foreground">Track and manage school fees, payments, and reconciliation</p>
        </div>
        <ContextualHelpLink sectionId="recording-payments" label="Payment Recording Help" />
      </div>

      {fetchError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Data load issue</AlertTitle>
          <AlertDescription className="flex items-center justify-between mt-1">
            {fetchError}
            <Button variant="outline" size="sm" className="ml-4 shrink-0" onClick={() => { fetchReferenceData(); paymentsQuery.refetch(); }}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {unbilledAlert && unbilledAlert.unbilledStudentCount > 0 && !unbilledDismissed && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Charges not yet generated</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-1">
            <span>
              {unbilledAlert.unbilledStudentCount} of {unbilledAlert.eligibleStudentCount}{' '}
              eligible student{unbilledAlert.eligibleStudentCount === 1 ? '' : 's'} have not been billed for{' '}
              <strong>{unbilledAlert.billingPeriod}</strong>.
            </span>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => setActiveTab("billing")}>Generate Charges</Button>
              <Button variant="outline" size="sm" onClick={() => setUnbilledDismissed(true)}>Dismiss</Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="w-full overflow-x-auto pb-0.5">
          <TabsList className="flex flex-nowrap w-max sm:w-auto sm:inline-flex">
            <TabsTrigger value="payments" className="flex items-center gap-1.5 whitespace-nowrap">
              <DollarSign className="h-4 w-4 shrink-0" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="reconciliation" className="flex items-center gap-1.5 whitespace-nowrap">
              <RotateCcw className="h-4 w-4 shrink-0" />
              Reconciliation
            </TabsTrigger>
            <TabsTrigger value="fee-structure" className="flex items-center gap-1.5 whitespace-nowrap">
              <TrendingUp className="h-4 w-4 shrink-0" />
              Tuition Structure
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-1.5 whitespace-nowrap">
              <FileText className="h-4 w-4 shrink-0" />
              Billing
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex items-center gap-1.5 whitespace-nowrap">
              <Tag className="h-4 w-4 shrink-0" />
              <span className="sm:inline">Payment</span> Categories
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="payments" className="space-y-6">
          {/* Record Payment Button - Only show on Payments tab */}
          <div className="flex justify-end gap-2">
            {canGenerateReport && (
              <Button
                variant="outline"
                onClick={() => setShowGenerateReportModal(true)}
                disabled={isGeneratingReport}
                className="no-print"
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            )}
            <Button onClick={() => setShowRecordModal(true)} className="no-print">
              <Plus className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          </div>

          {/* Statistics Cards */}
      <TooltipProvider>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total This Month
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <DollarSign className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Sum of all payments recorded in the current calendar month</p>
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-primary">
                {formatCurrency(stats.totalThisMonth)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Outstanding
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Total unpaid balance across all active students</p>
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-destructive">
                {formatCurrency(stats.totalOutstanding)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payments Today
            </CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Receipt className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Number of payment transactions recorded today</p>
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent>
            {isLoadingPayments ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-card-foreground">
                {stats.paymentsToday}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </TooltipProvider>

      {/* Payments by Category */}
      <PaymentsByCategoryPanel />

      {/* Filters */}
      <Card className="no-print">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by student name or receipt number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={filterMethod} onValueChange={setFilterMethod}>
                <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Payment Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {(paymentFilterOptions?.methods ?? []).map((method) => (
                  <SelectItem key={method} value={method}>
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="none">Uncategorized</SelectItem>
                {(paymentFilterOptions?.categories ?? paymentCategories.map((category) => category.name)).map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>
              <Select value={filterClass} onValueChange={setFilterClass}>
                <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {(paymentFilterOptions?.classes ?? classes).map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {(paymentFilterOptions?.months ?? []).map((month) => (
                  <SelectItem key={month} value={String(month)}>
                    {monthNames[month - 1]}
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {(paymentFilterOptions?.years ?? []).map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch
                id="show-voided"
                checked={showVoided}
                onCheckedChange={setShowVoided}
              />
              <label htmlFor="show-voided" className="text-sm text-muted-foreground cursor-pointer">
                Show voided payments
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoadingPayments ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isMobile ? (
            /* Mobile Card Layout */
            <div className={`space-y-3 relative ${isFetchingPayments ? 'opacity-70 pointer-events-none' : ''}`}>
              {isFetchingPayments && (
                <div className="absolute right-2 top-2 z-10 text-xs text-muted-foreground">
                  Loading…
                </div>
              )}
              {paginatedPayments.length > 0 ? (
                paginatedPayments.map((payment) => (
                  <MobileCard key={payment.id}>
                    <div className={`space-y-3 ${payment.isVoided ? 'line-through opacity-60' : ''}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-semibold text-base">{getStudentName(payment)}</div>
                          <div className="text-sm text-muted-foreground">{getStudentClass(payment)}</div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${payment.isVoided ? 'text-muted-foreground' : 'text-primary'}`}>
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
                          </div>
                          {payment.isVoided && (
                            <Badge variant="destructive" className="text-xs">Voided</Badge>
                          )}
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(payment.date), "MMM dd, yyyy")}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <div>
                          <div className="text-xs text-muted-foreground">Method</div>
                          <Badge variant="secondary" className={getMethodBadgeColor(payment.method)}>
                            {payment.method}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Balance After</div>
                          <div className={`font-semibold ${((payment.balanceAfterPayment ?? 0) > 0) ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {payment.balanceAfterPayment !== null
                              ? formatCurrency(payment.balanceAfterPayment)
                              : '—'}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 grid-cols-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceiptPaymentId(payment.id)}
                        >
                          <Receipt className="mr-2 h-4 w-4" />
                          Receipt
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewHistory(payment)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          History
                        </Button>
                      </div>
                    </div>
                  </MobileCard>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No payments found
                </div>
              )}

              {/* Mobile Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col items-center gap-3 mt-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={isFetchingPayments || currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium px-3">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={isFetchingPayments || currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Desktop Table Layout */
            <>
              {isFetchingPayments && (
                <div className="mb-2 text-xs text-muted-foreground text-right">
                  Loading…
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="px-0" onClick={() => handleSort("studentName")}>
                        Student Name{sortLabel("studentName")}
                      </Button>
                    </TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="px-0" onClick={() => handleSort("date")}>
                        Date{sortLabel("date")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="px-0" onClick={() => handleSort("amount")}>
                        Amount{sortLabel("amount")}
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button variant="ghost" size="sm" className="px-0" onClick={() => handleSort("method")}>
                        Method{sortLabel("method")}
                      </Button>
                    </TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead className="no-print">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={isFetchingPayments ? 'opacity-70 pointer-events-none' : ''}>
                  {paginatedPayments.length > 0 ? (
                    paginatedPayments.map((payment) => (
                      <TableRow key={payment.id} className={payment.isVoided ? 'opacity-60 [&>td]:line-through' : ''}>
                        <TableCell className="font-medium">{getStudentName(payment)}</TableCell>
                        <TableCell>{getStudentClass(payment)}</TableCell>
                        <TableCell>{format(new Date(payment.date), "MMM dd, yyyy")}</TableCell>
                        <TableCell className={`font-semibold ${payment.isVoided ? 'text-muted-foreground' : 'text-primary'}`}>
                          {payment.currencyCode && payment.originalAmount != null && payment.currencyCode !== baseCurrency ? (
                            <div className="flex flex-col">
                              <span>{formatCurrencyForCode(payment.originalAmount, payment.currencyCode)}</span>
                              <span className="text-xs font-normal text-muted-foreground">
                                ≈ {formatCurrencyForCode(payment.amount, baseCurrency)}
                              </span>
                            </div>
                          ) : (
                            formatCurrencyForCode(payment.amount, baseCurrency)
                          )}
                          {payment.isVoided && (
                            <Badge variant="destructive" className="ml-2 text-xs">Voided</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className={getMethodBadgeColor(payment.method)}>
                              {payment.method}
                            </Badge>
                            {payment.feeCampaignId && (
                              <Badge variant="outline" className="text-xs border-amber-400 text-amber-700 bg-amber-50">
                                Campaign
                              </Badge>
                            )}
                            {payment.isVoided && (
                              <Badge variant="destructive" className="text-xs">Voided</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {payment.balanceAfterPayment !== null ? (
                            <span className={payment.balanceAfterPayment > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                              {formatCurrency(payment.balanceAfterPayment)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="no-print">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReceiptPaymentId(payment.id)}
                              title="View receipt"
                            >
                              <Receipt className="mr-2 h-4 w-4" />
                              Receipt
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewHistory(payment)}
                              title="View student payment history"
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              History
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No payments found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 no-print">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(currentPage * itemsPerPage, totalPayments)} of{" "}
                    {totalPayments} payments
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={isFetchingPayments || currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page)}
                              disabled={isFetchingPayments}
                              className="w-9"
                            >
                              {page}
                            </Button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="px-2">...</span>;
                        }
                        return null;
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={isFetchingPayments || currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="reconciliation">
          <ReconciliationTab />
        </TabsContent>

        <TabsContent value="fee-structure">
          <FeeStructureTab />
        </TabsContent>

        <TabsContent value="billing">
          <BillingTab />
        </TabsContent>

        <TabsContent value="categories">
          <PaymentCategoriesTab />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <RecordPaymentModal
        open={showRecordModal}
        onOpenChange={setShowRecordModal}
        onSuccess={() => { fetchReferenceData(); paymentsQuery.refetch(); }}
      />

      <PaymentHistoryModal
        open={showHistoryModal}
        onOpenChange={setShowHistoryModal}
        student={selectedStudent}
      />

      <PrintReceiptModal
        open={receiptPaymentId !== null}
        onOpenChange={(open) => { if (!open) setReceiptPaymentId(null); }}
        paymentId={receiptPaymentId}
        onCancel={(pid, receiptNum) => {
          setCancelPaymentId(pid);
          setCancelReceiptNumber(receiptNum);
          setReceiptPaymentId(null);
        }}
      />

      <CancelReceiptModal
        open={cancelPaymentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCancelPaymentId(null);
            setCancelReceiptNumber(null);
          }
        }}
        paymentId={cancelPaymentId}
        receiptNumber={cancelReceiptNumber}
        onConfirm={(paymentId, reason) => {
          cancelMutation.mutate(
            { paymentId, reason },
            {
              onSuccess: () => {
                setCancelPaymentId(null);
                setCancelReceiptNumber(null);
                paymentsQuery.refetch();
              },
            }
          );
        }}
        isPending={cancelMutation.isPending}
      />

      {/* Generate Report Modal */}
      <Dialog open={showGenerateReportModal} onOpenChange={setShowGenerateReportModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Generate Financial Report</DialogTitle>
            <DialogDescription>
              Select the period for the financial report by month/year or by academic term. The report will include payments, charges, and summaries for the selected period.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Report Type Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Report Type</label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as 'month' | 'term')}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">By Month/Year</SelectItem>
                  <SelectItem value="term">By Academic Term</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Month/Year Selection */}
            {reportType === 'month' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="report-month" className="text-sm font-medium">Month</label>
                  <Select value={reportMonth} onValueChange={setReportMonth}>
                    <SelectTrigger id="report-month">
                      <SelectValue placeholder="Select month" />
                    </SelectTrigger>
                    <SelectContent>
                      {(paymentFilterOptions?.months?.length ? paymentFilterOptions.months : [1,2,3,4,5,6,7,8,9,10,11,12]).map((m) => {
                        const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                        return (
                          <SelectItem key={m} value={String(m)}>
                            {monthNames[m - 1]}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="report-year" className="text-sm font-medium">Year</label>
                  <Select value={reportYear} onValueChange={setReportYear}>
                    <SelectTrigger id="report-year">
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {(paymentFilterOptions?.years?.length ? paymentFilterOptions.years : [new Date().getFullYear()]).map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Term Selection */}
            {reportType === 'term' && (
              <div className="space-y-2">
                <label htmlFor="report-term" className="text-sm font-medium">Academic Term</label>
                <Select value={reportTermId} onValueChange={setReportTermId}>
                  <SelectTrigger id="report-term">
                    <SelectValue placeholder={calendar?.terms?.length ? "Select a term" : "No terms available"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(calendar?.terms?.length ? calendar.terms : []).map((term) => (
                      <SelectItem key={term.id} value={term.id}>
                        {term.name} ({new Date(term.start).toLocaleDateString()} - {new Date(term.end).toLocaleDateString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!calendar?.terms?.length && (
                  <p className="text-xs text-muted-foreground">
                    No academic terms configured. Please set up terms in Settings &gt; Academic Calendar.
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateReportModal(false)} disabled={isGeneratingReport}>
              Cancel
            </Button>
            <Button onClick={handleGenerateReport} disabled={isGeneratingReport}>
              {isGeneratingReport ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </SubscriptionGuard>
  );
}
