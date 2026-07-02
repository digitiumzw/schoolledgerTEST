// ─────────────────────────────────────────────────────────────────────────────
// API SERVICE — Production-grade HTTP client for the CodeIgniter 4 backend
// ─────────────────────────────────────────────────────────────────────────────

import type { DashboardStats, ImportExecuteResult, ImportValidationResult, SetupGuideResponse, SetupGuideStepKey, SetupGuideStepStatus, TutorialResponse, TutorialStatus, TenantDeletionStatus, DeletionRequestInput, DeletionRequestResponse, UndoDeletionInput, UndoDeletionResponse, StaffListParams, StaffListResponse, TransportListParams, PaginatedResponse, TransportRoute, RouteStudentsParams, PaginatedRouteStudentsResponse, CurrencyConfiguration, ExchangeRate, ExchangeRateLookupResult } from '@/types/dashboard';
export type { StaffListParams, StaffListResponse, TransportListParams, PaginatedResponse, RouteStudentsParams, PaginatedRouteStudentsResponse, CurrencyConfiguration, ExchangeRate, ExchangeRateLookupResult };

// ── Academic calendar error codes ─────────────────────────────────────────────
export type ChargeGenerationErrorCode =
  | 'TERM_MISMATCH'
  | 'CALENDAR_INCOMPLETE'
  | 'OUTSIDE_TERM_DATES'
  | 'NEW_YEAR_DETECTED'
  | 'TERM_OVERLAP';

export interface CalendarStatus {
  canGenerateCharges: boolean;
  calendarComplete: boolean;
  isNewYear: boolean;
  blockingReason: ChargeGenerationErrorCode | null;
  currentTerm: { id: string; name: string; start: string; end: string } | null;
  today: string;
  missingTerms?: string[];
  actionRequired?: string;
}

// ── Receipt list types (feature 092 — parent receipt list) ───────────────────
export interface ReceiptListItem {
  id: string;
  amount: number;
  date: string;
  method: string;
  category: string;
  description: string;
  receiptNumber: string | null;
  isGeneralPayment: boolean;
  paymentGroupId: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface ReceiptListStudent {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string | null;
  className: string | null;
}

export interface ReceiptListPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  last_page: number;
}

export interface ReceiptListResponse {
  receipts: ReceiptListItem[];
  student: ReceiptListStudent;
  pagination: ReceiptListPagination;
}

// Resolve base URL from Vite environment variable; fall back to localhost for
// local development.  Set VITE_API_BASE_URL in your .env file for production.
const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8080/api';

// ── Storage keys ───────────────────────────────────────────────────────────────
const TOKEN_KEY  = 'schoolledger_token';
const TENANT_KEY = 'schoolledger_tenant_id';

// ── Token helpers ──────────────────────────────────────────────────────────────
const getToken      = (): string | null => localStorage.getItem(TOKEN_KEY);
const setToken = (t: string): void => {
  localStorage.setItem(TOKEN_KEY, t);
  // New login → allow future expiries to be handled again
  sessionExpiryHandled = false;
};
const removeToken   = (): void           => localStorage.removeItem(TOKEN_KEY);

const getTenantId   = (): string | null => localStorage.getItem(TENANT_KEY);
const setTenantId   = (id: string): void => localStorage.setItem(TENANT_KEY, id);
const removeTenantId = (): void          => localStorage.removeItem(TENANT_KEY);

// ── Session expiration ─────────────────────────────────────────────────────────
// This flag ensures we only process the first 401 that indicates an expired
// session. Subsequent 401s that arrive while the app is already redirecting to
// /login (e.g. background React-Query refetches) will be ignored so the user
// does not get spammed with duplicate toast notifications.
let sessionExpiryHandled = false;

const handleTokenExpiration = (): void => {
  // If there is no stored token or we already handled an expiry during this
  // browser session, do nothing – the user is either already logged out or the
  // redirect is in progress.
  if (sessionExpiryHandled || !getToken()) {
    return;
  }
  sessionExpiryHandled = true;

  removeToken();
  removeTenantId();
  localStorage.removeItem('school_management_auth');

  // Notify listeners (e.g. toast handler, AuthContext) **before** navigation
  window.dispatchEvent(
    new CustomEvent('sessionExpired', {
      detail: { message: 'Your session has expired. Please sign in again.' },
    })
  );

  // Redirect to login after a short delay so the toast can render first. If the
  // user is already on the login page we skip the redirect entirely to avoid an
  // unnecessary page reload.
  setTimeout(() => {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }, 150);
};

// ── Report response types ──────────────────────────────────────────────────────

export interface PaymentCollectionReport {
  termId: string;
  totalCharged: number;
  totalCollected: number;
  collectionRate: number;
  studentsFullyPaid: number;
  studentsWithBalance: number;
  studentsNotPaid: number;
  byStudent: Array<{
    studentId: string;
    name: string;
    class: string | null;
    totalCharged: number;
    totalPaid: number;
    balance: number;
    status: 'paid' | 'partial' | 'unpaid';
  }>;
}

export interface AgedBalancesReport {
  termId: string;
  generatedAt: string;
  summary: {
    current:    { count: number; totalBalance: number };
    days1to30:  { count: number; totalBalance: number };
    days31to60: { count: number; totalBalance: number };
    days61to90: { count: number; totalBalance: number };
    days90plus: { count: number; totalBalance: number };
  };
  students: Array<{
    studentId: string;
    name: string;
    class: string | null;
    oldestDueDate: string;
    daysOverdue: number;
    bucket: 'current' | 'days1to30' | 'days31to60' | 'days61to90' | 'days90plus';
    outstandingBalance: number;
  }>;
}

export interface RevenueByCategoryReport {
  termId: string;
  categories: Array<{
    category: string;
    totalCharged: number;
    totalCollected: number;
    collectionRate: number;
    outstanding: number;
  }>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BackendSortMetadata<TSortBy extends string = string> {
  sortBy: TSortBy;
  sortOrder: 'asc' | 'desc';
}

export interface BackendPreparedListResponse<TRow, TSummary = unknown, TFilters = Record<string, unknown>, TSortBy extends string = string> {
  data?: TRow[];
  pagination: PaginationMeta;
  summary?: TSummary;
  filters?: TFilters;
  sort?: BackendSortMetadata<TSortBy>;
}

export interface PaymentStats {
  totalThisMonth: number;
  paymentsToday: number;
  totalOutstanding: number;
}

export type PaymentSortField = 'date' | 'amount' | 'studentName' | 'method' | 'category' | 'receiptNumber';
export type PaymentSortOrder = 'asc' | 'desc';
export type PaymentTypeFilter = 'all' | 'system' | 'general' | 'campaign' | 'grouped';

export interface PaymentSummaryBreakdown {
  label: string;
  count: number;
  total: number;
}

export interface PaymentSummary extends PaymentStats {
  totalAmount: number;
  totalCount: number;
  byMethod: PaymentSummaryBreakdown[];
  byCategory: PaymentSummaryBreakdown[];
}

export interface PaymentCategoryTotals {
  dateFrom: string;
  dateTo: string;
  grandTotal: number;
  grandCount: number;
  byCategory: PaymentSummaryBreakdown[];
}

export interface PaymentsWithStudentsParams {
  page?: number;
  limit?: number;
  search?: string;
  method?: string;
  category?: string;
  classId?: string;
  month?: string | number;
  year?: string | number;
  dateFrom?: string;
  dateTo?: string;
  paymentType?: PaymentTypeFilter;
  sortBy?: PaymentSortField;
  sortOrder?: PaymentSortOrder;
  includeVoided?: boolean;
}

export interface PaymentFilterOptions {
  methods: string[];
  categories: string[];
  classes: Array<{
    id: string;
    name: string;
  }>;
  months: number[];
  years: number[];
}

export interface FinancialReportFilterParams {
  termId?: string;
  month?: number | string;
  year?: number | string;
  classId?: string;
  method?: string;
  category?: string;
  reportingCurrency?: string;
}

export interface PaymentStudentDisplay {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string | null;
  classId: string | null;
  className: string | null;
  currentBalance?: number;
}

export interface PaymentHistoryRecord {
  id: string;
  tenantId: string;
  studentId: string;
  amount: number;
  date: string;
  method: string;
  description: string;
  category: string;
  month?: number | null;
  routeId?: string | null;
  feeCampaignId?: string | null;
  balanceAfterPayment?: number | null;
  receiptNumber?: string | null;
  isGeneralPayment?: boolean;
  paymentGroupId?: string | null;
  currencyCode?: string | null;
  originalAmount?: number | null;
  exchangeRate?: number | null;
  rateManualOverride?: boolean;
  student?: PaymentStudentDisplay | null;
}

export interface PaymentsWithStudentsResponse<TPayment = PaymentHistoryRecord> {
  data: TPayment[];
  pagination: PaginationMeta;
  summary: PaymentSummary;
  stats: PaymentStats;
  filters?: PaymentsWithStudentsParams;
}

export interface StudentPaymentHistorySummary {
  totalPaid: number;
  totalThisTerm: number;
  latestPaymentDate: string | null;
  latestPaymentAmount?: number | null;
  daysSinceLastPayment: number | null;
}

export interface StudentPaymentHistoryResponse {
  student: PaymentStudentDisplay;
  data: PaymentHistoryRecord[];
  pagination: PaginationMeta;
  summary: StudentPaymentHistorySummary;
  filters?: PaymentsWithStudentsParams;
}

export interface AttendanceSummaryRow {
  studentId: string;
  studentName: string;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
}

export interface AttendanceSummaryResponse {
  summary: AttendanceSummaryRow[];
  meta: {
    classId: string;
    startDate: string;
    endDate: string;
    total: number;
  };
}

export interface StudentProfileHistoryInput {
  fieldName: string;
  newValue: string | null;
  changeType: 'correction' | 'historical_change';
  effectiveDate: string;
  reason: string;
}

export interface StudentTimelineFilters {
  from?: string;
  to?: string;
  academicYear?: string;
  types?: string[];
  limit?: number;
  page?: number;
}

export interface StudentFeeStatementFilters {
  paymentMonth?: number | string;
  paymentYear?: number | string;
  paymentsPage?: number;
  paymentsLimit?: number;
  chargeMonth?: number | string;
  chargeYear?: number | string;
  chargesPage?: number;
  chargesLimit?: number;
}

export interface StudentSectionHistoryFilters {
  month?: number | string;
  year?: number | string;
  page?: number;
  limit?: number;
}

export interface StudentProfileFilters {
  attendanceMonth?: number | string;
  attendanceYear?: number | string;
  classMonth?: number | string;
  classYear?: number | string;
}

export interface StudentTransportHistoryFilters {
  month?: number | string;
  year?: number | string;
}

export interface AttendancePeriodSummaryStaff {
  staffId: string;
  firstName: string;
  lastName: string;
  department: string;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  halfDay: number;
  earlyDeparture: number;
  totalWorkHours: number;
  totalOvertimeHours: number;
  attendanceRate: number;
  isOnActiveLeave?: boolean;
}

export interface AttendancePeriodReport {
  period: { startDate: string; endDate: string; workingDays: number };
  staff: AttendancePeriodSummaryStaff[];
  summary?: {
    workingDays: number;
    staffCount: number;
    averageAttendanceRate: number;
    totalLateDays: number;
    totalOvertimeHours: number;
  };
  pagination?: PaginationMeta;
  filters?: {
    startDate: string;
    endDate: string;
    department?: string | null;
    staffId?: string | null;
    search?: string;
  };
  sort?: BackendSortMetadata<'staffName' | 'departmentName' | 'attendanceRate' | 'presentDays' | 'lateDays' | 'totalOvertimeHours'>;
}

export interface AttendanceDepartmentSummary {
  department: string;
  staffCount: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  onLeaveDays: number;
  totalOvertimeHours: number;
  attendanceRate: number;
}

export interface AttendanceDepartmentReport {
  period: { startDate: string; endDate: string; workingDays?: number };
  departments: AttendanceDepartmentSummary[];
}

export interface DashboardDrillDown {
  url: string;
  params?: Record<string, string | number | boolean | null>;
}

export interface DashboardAggregatedWidget {
  widgetKey: string;
  widgetType: 'metric_card' | 'chart' | 'table' | 'summary';
  title: string;
  description: string | null;
  icon: string | null;
  metricValue: number;
  metricLabel: string;
  drillDown: DashboardDrillDown | null;
  lastUpdated: string | null;
  isFresh: boolean;
}

export interface DashboardAggregatedEnrollmentClass {
  classId: string;
  className: string;
  level: number;
  total: number;
  male: number;
  female: number;
  other: number;
}

export interface DashboardNotification {
  id: string;
  category: 'calendar' | 'billing' | 'staff' | 'attendance' | 'classes' | string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  actionUrl: string | null;
  actionLabel: string | null;
  count: number | null;
  createdAt: string;
}

export interface DashboardAggregatedResponse {
  widgets: DashboardAggregatedWidget[];
  stats: DashboardStats;
  enrollmentByClass: DashboardAggregatedEnrollmentClass[];
  notifications?: DashboardNotification[];
  summary: {
    totalWidgets: number;
    freshWidgets: number;
    staleWidgets: number;
    lastRefresh: string | null;
  };
}

// ── Error class ────────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Core request function ──────────────────────────────────────────────────────

const REQUEST_TIMEOUT_MS = 30_000; // 30 s
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 504]);
const MAX_RETRIES        = 2;

/**
 * Execute an authenticated HTTP request.
 *
 * Features:
 * - Attaches JWT Bearer token automatically
 * - Times out after REQUEST_TIMEOUT_MS
 * - Retries on transient server errors (up to MAX_RETRIES times)
 * - Dispatches `sessionExpired` event and redirects on 401
 * - Throws ApiError with structured error info on failure
 */
const apiRequest = async (
  endpoint: string,
  options: RequestInit = {},
  attempt = 0,
  skipExpiry = false
): Promise<any> => {
  const token = getToken();

  const headers: Record<string, string> = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection and try again.', 0);
    }
    throw new ApiError('Network error. Please check your connection.', 0);
  }
  clearTimeout(timeoutId);

  // 401 — either a login failure (skipExpiry=true) or an expired session
  if (response.status === 401) {
    if (skipExpiry) {
      // Login endpoint: parse the body so the UI gets the backend's message
      let errData: any;
      const ct = response.headers.get('Content-Type') ?? '';
      if (ct.includes('application/json')) {
        try { errData = await response.json(); } catch { /* ignore */ }
      }
      throw new ApiError(
        errData?.message || 'Invalid email or password',
        401,
        errData?.errors
      );
    }
    handleTokenExpiration();
    throw new ApiError('Session expired. Please sign in again.', 401);
  }

  // Parse response body
  let data: any;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { status: response.ok, message: await response.text() };
  }

  // Retry on transient errors
  if (!response.ok && RETRYABLE_STATUSES.has(response.status) && attempt < MAX_RETRIES) {
    const delay = Math.min(500 * 2 ** attempt, 4000);
    await new Promise((res) => setTimeout(res, delay));
    return apiRequest(endpoint, options, attempt + 1, skipExpiry);
  }

  if (!response.ok) {
    if (response.status === 500 && data?.error?.correlationId) {
      window.dispatchEvent(
        new CustomEvent('serverError', {
          detail: { correlationId: data.error.correlationId, message: data?.message },
        })
      );
    }

    throw new ApiError(
      data?.message || `Request failed with status ${response.status}`,
      response.status,
      data?.errors
    );
  }

  return data;
};

// ─── Domain interfaces ─────────────────────────────────────────────────────────

export interface SchoolClass {
  id: string;
  tenantId: string;
  name: string;
  teacherId: string | null;
  teacherName?: string | null;
  nextClassId: string | null;
  nextClass: { id: string; name: string } | null;
  capacity: number;
  studentCount: number;
  isFinalClass: boolean;
  archivedAt: string | null;
}

export interface ClassStudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  gender: string | null;
  status: string;
  classId: string | null;
  className: string;
}

export interface ClassWithStudents {
  class: {
    id: string;
    name: string;
    capacity: number;
    studentCount: number;
    teacherName: string;
    teacherId: string | null;
    nextClass: { id: string; name: string } | null;
    isFinalClass: boolean;
    archivedAt: string | null;
  };
  students: ClassStudentRecord[];
  summary?: {
    studentCount: number;
    capacity: number;
    availableSeats: number;
  };
  pagination?: PaginationMeta;
  filters?: {
    search: string;
    status: string;
  };
  sort?: BackendSortMetadata<'name' | 'admissionNumber' | 'status' | 'gender'>;
}

export interface ClassesDirectoryResponse {
  classes: SchoolClass[];
  teachers?: Array<{ id: string; firstName?: string; lastName?: string; name: string }>;
  summary: {
    totalStudents: number;
    totalCapacity: number;
    avgFill: number;
    graduatingCount: number;
    activeCount: number;
    archivedCount: number;
  };
  pagination: PaginationMeta;
  filters: {
    archived: 'true' | 'false' | 'all';
    search: string;
    teacherId: string | null;
  };
  sort: BackendSortMetadata<'name' | 'studentCount' | 'capacity' | 'teacherName' | 'createdAt'>;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  maxStudents: number | null;
  monthlyPriceCents: number;
  annualPriceCents: number;
  currency: string;
  sortOrder: number;
}

export interface SchoolSubscription {
  id: string;
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  status: 'pending' | 'active' | 'expired' | 'superseded' | 'cancelled';
  startsAt: string;
  expiresAt: string | null;
  amountPaidCents: number;
  currency: string;
  activatedAt: string | null;
  pendingPlanId?: string | null;
  pendingChangeEffectiveAt?: string | null;
  pendingChangeType?: string | null;
}

export interface SubscriptionTransitionPolicy {
  canSwitchToAnnual: boolean;
  canSwitchToMonthly: boolean;
  canChangeTier: boolean;
  blockedReason: string | null;
}

export interface SubscriptionTransaction {
  id: string;
  ourReference: string;
  paynowReference: string | null;
  amountCents: number;
  currency: string;
  status: 'initiated' | 'paid' | 'failed' | 'cancelled' | 'disputed';
  initiatedAt: string;
  completedAt: string | null;
}

export interface CurrentSubscriptionResponse {
  subscription: SchoolSubscription | null;
  studentCount: number;
  recommendedPlanId: string;
  isExpired: boolean;
  isOverLimit: boolean;
  daysUntilExpiry: number | null;
  transitionPolicy?: SubscriptionTransitionPolicy;
}

export interface SubscriptionHistoryResponse {
  subscriptions: SchoolSubscription[];
  transactions: SubscriptionTransaction[];
}

export interface SubscriptionInvoice {
  id: string;
  invoiceNumber: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  amountCents: number;
  currency: string;
  issuedAt: string;
  downloadUrl: string;
}

export interface InvoiceListResponse {
  invoices: SubscriptionInvoice[];
}

export interface DowngradeBlockedError {
  downgrade_blocked: boolean;
  studentCount: number;
  planLimit: number;
}

export interface InitiateSubscriptionResponse {
  subscriptionId: string;
  transactionId: string;
  redirectUrl: string;
  ourReference: string;
}

// ── Proration types ───────────────────────────────────────────────────────────

export interface ProrationCalculation {
  calculationId: string;
  originalPlan: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
  };
  newPlan: {
    id: string;
    name: string;
    priceCents: number;
    currency: string;
  };
  billingCycle: 'monthly' | 'annual';
  cycleDates: {
    startDate: string;
    endDate: string;
    daysInCycle: number;
    daysRemaining: number;
  };
  proration: {
    unusedValueCreditCents: number;
    proratedChargeCents: number;
    netAmountCents: number;
    isUpgrade: boolean;
    isDowngrade: boolean;
  };
  breakdown: {
    dailyRateOriginalCents: number;
    dailyRateNewCents: number;
    formula: string;
  };
}

export interface UpgradeWithProrationResponse {
  subscriptionId: string;
  transactionId: string;
  redirectUrl: string | null;
  ourReference: string;
  activated: boolean;
  prorationApplied: {
    creditUsedCents: number;
    amountToChargeCents: number;
  };
}

export interface Credit {
  id: string;
  initialAmountCents: number;
  remainingAmountCents: number;
  reason: 'downgrade_proration' | 'upgrade_discount' | 'manual_adjustment';
  createdAt: string;
  expiresAt: string | null;
}

export interface CreditsResponse {
  totalCreditsCents: number;
  currency: string;
  credits: Credit[];
}

export interface ProrationHistoryItem {
  id: string;
  originalPlanName: string;
  newPlanName: string;
  billingCycle: 'monthly' | 'annual';
  changeType?: string | null;
  policyCode?: string | null;
  netAmountCents: number;
  status: 'calculated' | 'confirmed' | 'cancelled' | 'failed';
  createdAt: string;
  confirmedAt: string | null;
}

export interface ProrationHistoryResponse {
  calculations: ProrationHistoryItem[];
  total: number;
  page: number;
  perPage: number;
}

export interface GraceUsageStatus {
  gracePeriod: boolean;
  allowed: boolean;
  usedSeconds: number;
  remainingSeconds: number | null;
  totalSeconds: number;
  nextHourAt: string | null;
}

// ── Fee Rule types (Feature 056) ──────────────────────────────────────────────

export type FeeRuleScopeType = 'school_wide' | 'class' | 'category' | 'service' | 'student';
export type FeeRuleInputScopeType = Extract<FeeRuleScopeType, 'school_wide' | 'class' | 'student'>;

export type BillingCycleStructureType = 'monthly' | 'termly';

export interface FeeRule {
  id: string;
  name: string;
  amount: number;
  assignmentScopeType: FeeRuleScopeType;
  /**
   * Scope identifier:
   *   school_wide: null
   *   class:       single class ID (string) or array of class IDs (feature 057 multi-class)
   *   category:    category key string
   *   service:     service key string
   */
  assignmentScopeId: string | string[] | null;
  assignmentScopeLabel: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FeeRuleInput {
  name: string;
  amount: number;
  assignmentScopeType: FeeRuleInputScopeType;
  assignmentScopeId?: string | string[] | null;
  isActive?: boolean;
}

export interface FeeRuleBillingMeta {
  structureType: BillingCycleStructureType;
  currentPeriod: string;
  availablePeriods: Array<{ value: string; label: string }>;
}

export interface FeeRuleGenerateInput {
  billingPeriod: string;
  feeRuleIds?: string[];
  currency?: string;
  exchangeRateOverride?: number;
}

export interface FeeRuleGenerationResult {
  billingPeriod: string;
  batchId?: string | null;
  descriptionLabel?: string;
  generatedCount: number;
  skippedDuplicateCount: number;
  totalAmount: number;
  perRule: Array<{
    feeRuleId: string;
    name: string;
    studentsCharged: number;
    amount: number;
  }>;
}

export interface FeeRuleUnbilledAlert {
  hasActiveTerm?: boolean;
  billingPeriod: string;
  eligibleStudentCount: number;
  unbilledStudentCount: number;
}

export type ChargeBatchType = 'fee_structure' | 'transport';

export interface ChargeBatchSummary {
  id: string;
  chargeType: ChargeBatchType;
  periodKey: string | null;
  periodLabel: string;
  descriptionLabel: string;
  generatedAt: string | null;
  generatedBy: string | null;
  chargeCount: number;
  affectedStudentCount: number;
  totalAmount: number;
  canVoid: boolean;
  blockedReason: string | null;
}

export interface ChargeBatchVoidResult {
  batchId: string;
  chargeType: ChargeBatchType;
  periodLabel: string;
  descriptionLabel?: string;
  chargeCount: number;
  affectedStudentCount: number;
  totalAmount: number;
  voidedAt: string;
}

export interface ChargeBatchVoidInput {
  reason?: string;
}

// ── Fee Campaign types (Feature 059) ────────────────────────────────────────

export type CampaignScopeType = 'school_wide' | 'class' | 'students';
export type CampaignStatus = 'active' | 'closed';
export type CampaignStudentStatus = 'unpaid' | 'partially_paid' | 'fully_paid';

export interface FeeCampaign {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  targetScopeType: CampaignScopeType;
  targetScopeId: string | string[] | null;
  amount: number;
  dueDate: string | null;
  status: CampaignStatus;
  createdBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  summary?: FeeCampaignSummary;
}

export interface FeeCampaignSummary {
  totalStudents: number;
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
  fullyPaidCount: number;
  partiallyPaidCount: number;
  unpaidCount: number;
}

export interface CampaignStudent {
  id: string;
  tenantId: string;
  feeCampaignId: string;
  studentId: string;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: CampaignStudentStatus;
  studentName?: string;
  className?: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface StudentCampaignMembership {
  feeCampaignId: string;
  campaignName: string;
  campaignStatus: CampaignStatus;
  dueDate: string | null;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: CampaignStudentStatus;
}

export interface CreateCampaignInput {
  name: string;
  description?: string;
  targetScopeType: CampaignScopeType;
  targetScopeId?: string | string[] | null;
  amount: number;
  dueDate?: string | null;
}

export interface CampaignPaymentRecord {
  id: string;
  studentId: string;
  studentName: string | null;
  className: string | null;
  amount: number;
  method: string;
  date: string;
  description: string | null;
  receiptNumber: string | null;
  isVoided: boolean;
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: string | null;
  createdAt: string | null;
}

export interface RecordCampaignPaymentInput {
  studentId: string;
  amount: number;
  method: string;
  date?: string;
  description?: string;
}

export interface MultiCategoryPaymentInput {
  studentId: string;
  amount: number;
  date?: string;
  method: string;
  description?: string;
  categories: Array<{ categoryName: string; amount: number }>;
  currency?: string;
  exchangeRateOverride?: number;
}

/**
 * Main API object - mirrors mockApi structure
 */
export const api = {
  // ═══════════════════════════════════════════════════════════════════════════
  // MAINTENANCE STATUS (Public — no auth required)
  // ═══════════════════════════════════════════════════════════════════════════

  getMaintenanceStatus: async () => {
    const response = await apiRequest('/maintenance-status', { method: 'GET' }, 0, true);
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  login: async (email: string, password: string) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, 0, true); // skipExpiry=true: bad credentials must show an error, not redirect

    if (response.status && response.data) {
      setToken(response.data.token);
      if (response.data.user?.tenantId) {
        setTenantId(response.data.user.tenantId);
      }
      return response.data.user;
    }

    throw new ApiError(response.message || 'Login failed', 401);
  },

  refreshToken: async () => {
    const response = await apiRequest('/auth/refresh', { method: 'POST' });
    if (response.status && response.data?.token) {
      setToken(response.data.token);
      return response.data.user;
    }
    throw new ApiError('Token refresh failed', 401);
  },

  logout: () => {
    removeToken();
    removeTenantId();
    localStorage.removeItem('school_management_auth');
  },

  getCurrentUser: async () => {
    const response = await apiRequest('/auth/me');
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
    if (!response.status) throw new ApiError(response.message || 'Request failed', 400);
    return response.message as string;
  },

  resetPassword: async (token: string, password: string) => {
    const response = await apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
    if (!response.status) throw new ApiError(response.message || 'Reset failed', 400);
    return response.message as string;
  },

  acceptInvite: async (token: string, password: string) => {
    const response = await apiRequest('/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
    if (!response.status) throw new ApiError(response.message || 'Invitation failed', 400);
    return response.message as string;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ONBOARDING (043-school-creation-onboarding)
  // ═══════════════════════════════════════════════════════════════════════════

  getOnboardingProgress: async () => {
    const response = await apiRequest('/onboarding/progress');
    return response.data as {
      current_step: string;
      completed_steps: string[];
      school_name: string;
      admin_email: string;
      is_temp_password: boolean;
      onboarding_complete: boolean;
      step_data: Record<string, unknown>;
    };
  },

  saveOnboardingStep: async (step: string, data: Record<string, unknown>) => {
    const response = await apiRequest('/onboarding/progress', {
      method: 'POST',
      body: JSON.stringify({ step, data }),
    });
    return response.data as { current_step: string; completed_steps: string[] };
  },

  completeOnboarding: async () => {
    const response = await apiRequest('/onboarding/complete', { method: 'POST' });
    return response.data as {
      tenant_id: string;
      tenant_status: string;
      subscription: {
        plan_name: string;
        status: string;
        starts_at: string;
        expires_at: string;
      };
      onboarding_complete: boolean;
      show_setup_guide?: boolean;
      show_tutorial?: boolean;
    };
  },

  changeOnboardingPassword: async (newPassword: string, confirmPassword: string) => {
    const response = await apiRequest('/onboarding/change-password', {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword, confirm_password: confirmPassword }),
    });
    return response.data as { is_temp_password: boolean };
  },

  getSetupGuide: async () => {
    const response = await apiRequest('/setup-guide');
    return response.data as SetupGuideResponse;
  },

  updateSetupGuideStep: async (stepKey: SetupGuideStepKey, status: Extract<SetupGuideStepStatus, 'completed' | 'skipped'>) => {
    const response = await apiRequest(`/setup-guide/steps/${stepKey}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return response.data as SetupGuideResponse;
  },

  dismissSetupGuide: async () => {
    const response = await apiRequest('/setup-guide/dismiss', { method: 'POST' });
    return response.data as SetupGuideResponse;
  },

  getTutorial: async () => {
    const response = await apiRequest('/tutorial');
    return response.data as TutorialResponse;
  },

  updateTutorialProgress: async (input: { status: TutorialStatus; last_seen_step?: string | null; seen_module_keys?: string[] }) => {
    const response = await apiRequest('/tutorial/progress', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
    return response.data as TutorialResponse;
  },

  restartTutorial: async () => {
    const response = await apiRequest('/tutorial/restart', { method: 'POST' });
    return response.data as TutorialResponse;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  getTenants: async () => {
    const response = await apiRequest('/tenants');
    return response.data;
  },

  getCurrentTenant: async () => {
    const response = await apiRequest('/tenants/current');
    return response.data;
  },

  getTenantById: async (id: string) => {
    const response = await apiRequest(`/tenants/${id}`);
    return response.data;
  },

  // ── Tenant Deletion ───────────────────────────────────────────────────────────

  getTenantDeletionStatus: async (): Promise<TenantDeletionStatus> => {
    const response = await apiRequest('/tenant/deletion-status');
    return response.data as TenantDeletionStatus;
  },

  requestAccountDeletion: async (data: DeletionRequestInput): Promise<DeletionRequestResponse> => {
    const response = await apiRequest('/tenant/deletion-request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data as DeletionRequestResponse;
  },

  undoAccountDeletion: async (data: UndoDeletionInput): Promise<UndoDeletionResponse> => {
    const response = await apiRequest('/tenant/undo-deletion', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data as UndoDeletionResponse;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // USERS
  // ═══════════════════════════════════════════════════════════════════════════
  
  getUsers: async () => {
    const response = await apiRequest('/users');
    return response.data;
  },

  getUserById: async (id: string) => {
    const response = await apiRequest(`/users/${id}`);
    return response.data;
  },

  inviteUser: async (userData: { name: string; email: string; role: string }) => {
    const response = await apiRequest('/users/invite', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    return response.data;
  },

  resendInvite: async (id: string) => {
    const response = await apiRequest(`/users/${id}/resend-invite`, {
      method: 'POST',
    });
    return response.data;
  },

  updateUser: async (id: string, userData: any) => {
    const response = await apiRequest(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
    return response.data;
  },

  deleteUser: async (id: string) => {
    const response = await apiRequest(`/users/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  toggleUserStatus: async (id: string) => {
    const response = await apiRequest(`/users/${id}/status`, {
      method: 'PUT',
    });
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STUDENTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  getStudentsOptimized: async (params?: { classId?: string; status?: string; search?: string; balanceOnly?: boolean; unassignedOnly?: boolean; sortBy?: string; sortOrder?: string; page?: number; limit?: number; includeClasses?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.classId) searchParams.append('classId', params.classId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.balanceOnly) searchParams.append('balanceOnly', params.balanceOnly.toString());
    if (params?.unassignedOnly) searchParams.append('unassignedOnly', 'true');
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.includeClasses !== undefined) searchParams.append('includeClasses', params.includeClasses.toString());
    const queryString = searchParams.toString();
    const response = await apiRequest(`/students-optimized${queryString ? '?' + queryString : ''}`);
    return response.data as {
      students: import('@/types/dashboard').Student[];
      stats: {
        totalStudents: number;
        studentsWithOutstandingBalance: number;
        totalFeesOwed: number;
        studentsOnFinancialAid: number;
        bursaryCoveragePercentage: number;
        statusCounts: Record<string, number>;
      };
      pagination: PaginationMeta;
      filters?: Record<string, unknown>;
      sort?: BackendSortMetadata;
      classes?: SchoolClass[];
    };
  },



  downloadStudentImportTemplate: async (): Promise<Blob> => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/students/import/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (response.status === 401) {
      handleTokenExpiration();
      throw new ApiError('Session expired. Please sign in again.', 401);
    }

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      const contentType = response.headers.get('Content-Type') ?? '';
      if (contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          message = errorData?.message ?? message;
        } catch {
          message = `Request failed with status ${response.status}`;
        }
      }
      throw new ApiError(message, response.status);
    }

    return response.blob();
  },

  validateStudentImport: async (file: File): Promise<ImportValidationResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiRequest('/students/import/validate', {
      method: 'POST',
      body: formData,
    });
    return response.data as ImportValidationResult;
  },

  executeStudentImport: async (file: File): Promise<ImportExecuteResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiRequest('/students/import/execute', {
      method: 'POST',
      body: formData,
    });
    return response.data as ImportExecuteResult;
  },

  exportStudentsCsv: async (params?: {
    classId?: string;
    status?: string;
    search?: string;
    balanceOnly?: boolean;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<Blob> => {
    const token = getToken();
    const searchParams = new URLSearchParams();
    if (params?.classId) searchParams.append('classId', params.classId);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.balanceOnly) searchParams.append('balanceOnly', 'true');
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const qs = searchParams.toString();

    const response = await fetch(`${API_BASE_URL}/students/export${qs ? '?' + qs : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (response.status === 401) {
      handleTokenExpiration();
      throw new ApiError('Session expired. Please sign in again.', 401);
    }

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      const contentType = response.headers.get('Content-Type') ?? '';
      if (contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          message = errorData?.message ?? message;
        } catch {
          message = `Request failed with status ${response.status}`;
        }
      }
      throw new ApiError(message, response.status);
    }

    return response.blob();
  },

  getStudentCount: async (params?: { status?: string; classId?: string }): Promise<number> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.classId) searchParams.append('classId', params.classId);
    const queryString = searchParams.toString();
    const response = await apiRequest(`/students/count${queryString ? '?' + queryString : ''}`);
    return response.data?.count ?? 0;
  },

  getStudentById: async (id: string) => {
    const response = await apiRequest(`/students/${id}`);
    return response.data;
  },

  getStudentProfile: async (id: string, filters?: StudentProfileFilters) => {
    const params = new URLSearchParams();
    if (filters?.attendanceMonth) params.append('attendanceMonth', String(filters.attendanceMonth));
    if (filters?.attendanceYear) params.append('attendanceYear', String(filters.attendanceYear));
    if (filters?.classMonth) params.append('classMonth', String(filters.classMonth));
    if (filters?.classYear) params.append('classYear', String(filters.classYear));
    const query = params.toString();
    const response = await apiRequest(`/students/${id}/profile${query ? '?' + query : ''}`);
    return response.data;
  },

  getStudentIdentity: async (id: string) => {
    const response = await apiRequest(`/students/${id}/identity`);
    return response.data;
  },

  getStudentTimeline: async (id: string, filters?: StudentTimelineFilters) => {
    const params = new URLSearchParams();
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    if (filters?.academicYear) params.append('academicYear', filters.academicYear);
    if (filters?.types?.length) params.append('types', filters.types.join(','));
    if (filters?.limit) params.append('limit', String(filters.limit));
    if (filters?.page) params.append('page', String(filters.page));
    const query = params.toString();
    const response = await apiRequest(`/students/${id}/timeline${query ? '?' + query : ''}`);
    return response.data;
  },

  getStudentProfileHistory: async (id: string, filters?: { fieldName?: string; from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (filters?.fieldName) params.append('fieldName', filters.fieldName);
    if (filters?.from) params.append('from', filters.from);
    if (filters?.to) params.append('to', filters.to);
    const query = params.toString();
    const response = await apiRequest(`/students/${id}/profile-history${query ? '?' + query : ''}`);
    return response.data;
  },

  recordStudentProfileHistory: async (id: string, input: StudentProfileHistoryInput) => {
    const response = await apiRequest(`/students/${id}/profile-history`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  },

  getFeeStatement: async (id: string, filters?: StudentFeeStatementFilters) => {
    const params = new URLSearchParams();
    if (filters?.paymentMonth) params.append('paymentMonth', String(filters.paymentMonth));
    if (filters?.paymentYear) params.append('paymentYear', String(filters.paymentYear));
    if (filters?.paymentsPage) params.append('paymentsPage', String(filters.paymentsPage));
    if (filters?.paymentsLimit) params.append('paymentsLimit', String(filters.paymentsLimit));
    if (filters?.chargeMonth) params.append('chargeMonth', String(filters.chargeMonth));
    if (filters?.chargeYear) params.append('chargeYear', String(filters.chargeYear));
    if (filters?.chargesPage) params.append('chargesPage', String(filters.chargesPage));
    if (filters?.chargesLimit) params.append('chargesLimit', String(filters.chargesLimit));
    const query = params.toString();
    const response = await apiRequest(`/students/${id}/fee-statement${query ? '?' + query : ''}`);
    return response.data;
  },

  getStudentAdjustmentsHistory: async (id: string, filters?: StudentSectionHistoryFilters) => {
    const params = new URLSearchParams();
    if (filters?.month) params.append('month', String(filters.month));
    if (filters?.year) params.append('year', String(filters.year));
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    const query = params.toString();
    const response = await apiRequest(`/students/${id}/adjustments-history${query ? '?' + query : ''}`);
    return response.data;
  },

  getStudentClassHistory: async (id: string, filters?: StudentSectionHistoryFilters) => {
    const params = new URLSearchParams();
    if (filters?.month) params.append('month', String(filters.month));
    if (filters?.year) params.append('year', String(filters.year));
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    const query = params.toString();
    const response = await apiRequest(`/students/${id}/class-history${query ? '?' + query : ''}`);
    return response.data;
  },

  createStudent: async (studentData: any) => {
    const response = await apiRequest('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
    return response.data;
  },

  updateStudent: async (id: string, studentData: any) => {
    const response = await apiRequest(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
    return response.data;
  },

  assignStudentsToClass: async (classId: string, studentIds: string[], force = false) => {
    const response = await apiRequest(`/classes/${classId}/assign-students`, {
      method: 'POST',
      body: JSON.stringify({ studentIds, force }),
    });
    return response.data;
  },

  deleteStudent: async (id: string) => {
    const response = await apiRequest(`/students/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  changeStudentStatus: async (id: string, status: string, effectiveDate: string, reason: string) => {
    const response = await apiRequest(`/students/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, effectiveDate, reason }),
    });
    return response.data;
  },

  getStudentStatusHistory: async (id: string, filters?: StudentSectionHistoryFilters) => {
    const params = new URLSearchParams();
    if (filters?.month) params.append('month', String(filters.month));
    if (filters?.year) params.append('year', String(filters.year));
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));
    const query = params.toString();
    const response = await apiRequest(`/students/${id}/status-history${query ? '?' + query : ''}`);
    return response.data;
  },

  bulkUpdateStudentStatus: async (studentIds: string[], status: string, effectiveDate: string, reason: string) => {
    const response = await apiRequest('/students/bulk-status', {
      method: 'PUT',
      body: JSON.stringify({ studentIds, status, effectiveDate, reason }),
    });
    return response.data;
  },

  searchStudents: async (query: string, classId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (query) params.append('query', query);
    if (classId) params.append('classId', classId);
    params.append('limit', String(limit ?? 20));
    const response = await apiRequest(`/students/search?${params}`);
    return response.data;
  },

  getStudentsByClass: async (classId: string, status: string = 'active') => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const qs = params.toString();
    const response = await apiRequest(`/students/by-class/${classId}${qs ? '?' + qs : ''}`);
    return response.data;
  },

  promoteStudents: async (options?: { classIds?: string[], studentIds?: string[], academicSession?: string }) => {
    const response = await apiRequest('/students/promote', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
    return response.data;
  },

  getMigrationPreview: async () => {
    const response = await apiRequest('/students/migration-preview');
    return response.data;
  },

  reconcileStudents: async (dryRun = false): Promise<{
    total: number;
    synced: number;
    repaired: number;
    needsManualReview: number;
    manualReviewStudents: Array<{ id: string; name: string; classId: string | null; reason: string }>;
    repairs: Array<unknown>;
    dryRun: boolean;
  }> => {
    const response = await apiRequest('/students/reconcile', {
      method: 'POST',
      body: JSON.stringify({ dryRun }),
    });
    return response.data;
  },

  getClassPromotionPreview: async () => {
    const response = await apiRequest('/classes/promotion-preview');
    return response.data;
  },

  promoteStudent: async (studentId: string, options?: { classId?: string, academicSession?: string, remarks?: string }) => {
    const response = await apiRequest(`/students/${studentId}/promote`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
    return response.data;
  },

  repeatStudent: async (studentId: string, options?: { academicSession?: string, remarks?: string }) => {
    const response = await apiRequest(`/students/${studentId}/repeat`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // CLASSES
  // ═══════════════════════════════════════════════════════════════════════════

  getClassInstances: async (academicYear?: string) => {
    const params = new URLSearchParams();
    if (academicYear) params.append('academicYear', academicYear);
    const qs = params.toString();
    const response = await apiRequest(`/class-instances${qs ? '?' + qs : ''}`);
    return response.data as { id: string; classId: string; className: string; academicYear: string; teacherId: string | null }[];
  },

  getClasses: async (includeArchived = false): Promise<SchoolClass[]> => {
    const params = new URLSearchParams();
    if (includeArchived) params.append('include_archived', 'true');
    const qs = params.toString();
    const response = await apiRequest(`/classes${qs ? '?' + qs : ''}`);
    return Array.isArray(response.data) ? response.data : (response.data?.classes ?? []);
  },

  getClassesDirectory: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    archived?: 'true' | 'false' | 'all';
    teacherId?: string;
    includeTeachers?: boolean;
    sortBy?: 'progressionOrder' | 'name' | 'studentCount' | 'capacity' | 'teacherName' | 'createdAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ClassesDirectoryResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.search) searchParams.append('search', params.search);
    if (params?.archived) searchParams.append('archived', params.archived);
    if (params?.teacherId) searchParams.append('teacherId', params.teacherId);
    if (params?.includeTeachers) searchParams.append('includeTeachers', 'true');
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const qs = searchParams.toString();
    const response = await apiRequest(`/classes${qs ? '?' + qs : ''}`);
    return response.data as ClassesDirectoryResponse;
  },

  getStudentCounts: async () => {
    const response = await apiRequest('/classes/student-counts');
    return response.data;
  },

  getClassById: async (id: string) => {
    const response = await apiRequest(`/classes/${id}`);
    return response.data;
  },

  createClass: async (classData: any) => {
    const response = await apiRequest('/classes', {
      method: 'POST',
      body: JSON.stringify(classData),
    });
    return response.data;
  },

  updateClass: async (id: string, classData: any) => {
    const response = await apiRequest(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(classData),
    });
    return response.data;
  },

  archiveClass: async (id: string) => {
    const response = await apiRequest(`/classes/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  deleteClassPermanently: async (id: string) => {
    const response = await apiRequest(`/classes/${id}/permanent-delete`, {
      method: 'DELETE',
    });
    return response.data;
  },

  unarchiveClass: async (id: string) => {
    const response = await apiRequest(`/classes/${id}/unarchive`, {
      method: 'POST',
    });
    return response.data;
  },

  getClassWithStudents: async (classId: string, options?: { search?: string; status?: string; page?: number; limit?: number; sortBy?: 'name' | 'admissionNumber' | 'status' | 'gender'; sortOrder?: 'asc' | 'desc' }): Promise<ClassWithStudents> => {
    const searchParams = new URLSearchParams();
    if (options?.search) searchParams.append('search', options.search);
    if (options?.status) searchParams.append('status', options.status);
    if (options?.page) searchParams.append('page', String(options.page));
    if (options?.limit) searchParams.append('limit', String(options.limit));
    if (options?.sortBy) searchParams.append('sortBy', options.sortBy);
    if (options?.sortOrder) searchParams.append('sortOrder', options.sortOrder);
    const qs = searchParams.toString();
    const response = await apiRequest(`/classes/${classId}/students${qs ? `?${qs}` : ''}`);
    return response.data;
  },

  getClassEnrollmentHistory: async (classId: string): Promise<{ classId: string; hasEnrollments: boolean; count: number }> => {
    const response = await apiRequest(`/classes/${classId}/enrollment-history`);
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STAFF
  // ═══════════════════════════════════════════════════════════════════════════
  
  getStaff: async (params?: StaffListParams): Promise<StaffListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.department) searchParams.append('department', params.department);
    if (params?.isTeaching) searchParams.append('isTeaching', params.isTeaching);
    if (params?.employmentStatus) searchParams.append('employmentStatus', params.employmentStatus);
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    const qs = searchParams.toString();
    const response = await apiRequest(`/staff${qs ? '?' + qs : ''}`);
    return response.data;
  },

  getTeachers: async () => {
    const response = await apiRequest('/teachers');
    return response.data;
  },

  getStaffById: async (id: string) => {
    const response = await apiRequest(`/staff/${id}`);
    return response.data;
  },

  createStaff: async (staffData: any) => {
    const response = await apiRequest('/staff', {
      method: 'POST',
      body: JSON.stringify(staffData),
    });
    return response.data;
  },

  updateStaff: async (id: string, staffData: any) => {
    const response = await apiRequest(`/staff/${id}`, {
      method: 'PUT',
      body: JSON.stringify(staffData),
    });
    return response.data;
  },

  deleteStaff: async (id: string) => {
    const response = await apiRequest(`/staff/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // QR CODES
  // ═══════════════════════════════════════════════════════════════════════════
  
  generateStaffQRCode: async (staffId: string) => {
    const response = await apiRequest(`/staff/${staffId}/qr-code`, {
      method: 'POST',
    });
    return response.data;
  },

  bulkGenerateQRCodes: async () => {
    const response = await apiRequest('/staff/qr-codes/bulk', {
      method: 'POST',
    });
    return response.data;
  },

  getStaffClasses: async (staffId: string) => {
    const response = await apiRequest(`/staff/${staffId}/classes`);
    return response.data;
  },

  downloadStaffImportTemplate: async (): Promise<Blob> => {
    const token = getToken();
    const response = await fetch(`${API_BASE_URL}/staff/import/template`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (response.status === 401) {
      handleTokenExpiration();
      throw new ApiError('Session expired. Please sign in again.', 401);
    }

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      const contentType = response.headers.get('Content-Type') ?? '';
      if (contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          message = errorData?.message ?? message;
        } catch {
          message = `Request failed with status ${response.status}`;
        }
      }
      throw new ApiError(message, response.status);
    }

    return response.blob();
  },

  validateStaffImport: async (file: File): Promise<ImportValidationResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiRequest('/staff/import/validate', {
      method: 'POST',
      body: formData,
    });
    return response.data as ImportValidationResult;
  },

  executeStaffImport: async (file: File): Promise<ImportExecuteResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiRequest('/staff/import/execute', {
      method: 'POST',
      body: formData,
    });
    return response.data as ImportExecuteResult;
  },

  exportStaffCsv: async (params?: {
    department?: string;
    employmentStatus?: string;
    search?: string;
    isTeaching?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<Blob> => {
    const token = getToken();
    const searchParams = new URLSearchParams();
    if (params?.department) searchParams.append('department', params.department);
    if (params?.employmentStatus) searchParams.append('employmentStatus', params.employmentStatus);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.isTeaching) searchParams.append('isTeaching', params.isTeaching);
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const qs = searchParams.toString();

    const response = await fetch(`${API_BASE_URL}/staff/export${qs ? '?' + qs : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (response.status === 401) {
      handleTokenExpiration();
      throw new ApiError('Session expired. Please sign in again.', 401);
    }

    if (!response.ok) {
      let message = `Request failed with status ${response.status}`;
      const contentType = response.headers.get('Content-Type') ?? '';
      if (contentType.includes('application/json')) {
        try {
          const errorData = await response.json();
          message = errorData?.message ?? message;
        } catch {
          message = `Request failed with status ${response.status}`;
        }
      }
      throw new ApiError(message, response.status);
    }

    return response.blob();
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  getPayments: async () => {
    const response = await apiRequest('/payments');
    return response.data;
  },

  getPaymentsWithStudents: async (params?: PaymentsWithStudentsParams): Promise<PaymentsWithStudentsResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.search) searchParams.append('search', params.search);
    if (params?.method && params.method !== 'all') searchParams.append('method', params.method);
    if (params?.category && params.category !== 'all') searchParams.append('category', params.category);
    if (params?.classId && params.classId !== 'all') searchParams.append('classId', params.classId);
    if (params?.month && params.month !== 'all') searchParams.append('month', String(params.month));
    if (params?.year && params.year !== 'all') searchParams.append('year', String(params.year));
    if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.append('dateTo', params.dateTo);
    if (params?.paymentType && params.paymentType !== 'all') searchParams.append('paymentType', params.paymentType);
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    if (params?.includeVoided) searchParams.append('includeVoided', 'true');
    const qs = searchParams.toString();
    const response = await apiRequest(`/payments/with-students${qs ? `?${qs}` : ''}`);
    return response.data;
  },

  getPaymentFilterOptions: async (): Promise<PaymentFilterOptions> => {
    const response = await apiRequest('/payments/filter-options');
    return response.data;
  },

  getPaymentCategoryTotals: async (dateFrom: string, dateTo: string): Promise<PaymentCategoryTotals> => {
    const searchParams = new URLSearchParams();
    searchParams.append('dateFrom', dateFrom);
    searchParams.append('dateTo', dateTo);
    const response = await apiRequest(`/payments/category-totals?${searchParams.toString()}`);
    return response.data;
  },

  downloadFinancialReport: async (params: FinancialReportFilterParams): Promise<Blob> => {
    const searchParams = new URLSearchParams();
    if (params.termId) searchParams.append('termId', params.termId);
    if (params.month && params.month !== 'all') searchParams.append('month', String(params.month));
    if (params.year && params.year !== 'all') searchParams.append('year', String(params.year));
    if (params.classId && params.classId !== 'all') searchParams.append('classId', params.classId);
    if (params.method && params.method !== 'all') searchParams.append('method', params.method);
    if (params.category && params.category !== 'all' && params.category !== 'none') searchParams.append('category', params.category);
    if (params.reportingCurrency) searchParams.append('reportingCurrency', params.reportingCurrency);
    const qs = searchParams.toString();
    const token = localStorage.getItem('schoolledger_token');
    const response = await fetch(
      `${API_BASE_URL}/payments/report/pdf${qs ? `?${qs}` : ''}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!response.ok) {
      let message = 'Failed to generate financial report';
      try {
        const err = await response.json();
        message = err?.message || message;
      } catch { /* ignore parse error */ }
      throw new ApiError(message, response.status);
    }
    return response.blob();
  },

  getRecentPayments: async (limit = 10) => {
    const response = await apiRequest(`/payments/recent?limit=${limit}`);
    return response.data;
  },

  getPaymentsByStudent: async (studentId: string, params?: PaymentsWithStudentsParams): Promise<StudentPaymentHistoryResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.search) searchParams.append('search', params.search);
    if (params?.method && params.method !== 'all') searchParams.append('method', params.method);
    if (params?.category && params.category !== 'all') searchParams.append('category', params.category);
    if (params?.dateFrom) searchParams.append('dateFrom', params.dateFrom);
    if (params?.dateTo) searchParams.append('dateTo', params.dateTo);
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    if (params?.includeVoided) searchParams.append('includeVoided', 'true');
    const qs = searchParams.toString();
    const response = await apiRequest(`/payments/student/${studentId}${qs ? `?${qs}` : ''}`);
    return response.data;
  },

  getTotalPaidThisTerm: async (studentId: string, termId?: string) => {
    const url = termId
      ? `/payments/student/${studentId}/term-total?termId=${termId}`
      : `/payments/student/${studentId}/term-total`;
    const response = await apiRequest(url);
    return response.data;
  },

  createPayment: async (paymentData: any) => {
    const response = await apiRequest('/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
    return response.data;
  },

  cancelPayment: async (paymentId: string, reason: string): Promise<{ paymentId: string; receiptNumber: string; voidedAt: string; voidReason: string; voidedBy: string; studentId: string; recalculatedBalance: number; groupedRowsVoided: number }> => {
    const response = await apiRequest(`/payments/${encodeURIComponent(paymentId)}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return response.data;
  },

  getReceipt: async (paymentId: string) => {
    const response = await fetch(`${API_BASE_URL}/receipts/${encodeURIComponent(paymentId)}`);
    if (!response.ok) throw new Error('Receipt not found');
    const json = await response.json();
    return json.data as { payment: any; student: any; school: { name: string } };
  },

  getReceiptList: async (studentId: string, page: number = 1, limit: number = 20): Promise<ReceiptListResponse> => {
    const url = `${API_BASE_URL}/receipts/student/${encodeURIComponent(studentId)}?page=${page}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) {
      const json = await response.json().catch(() => ({}));
      throw new Error(json.message || 'Failed to load receipts');
    }
    const json = await response.json();
    return json.data as ReceiptListResponse;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════════════════
  
  getDashboardStats: async () => {
    const response = await apiRequest('/dashboard/stats');
    return response.data;
  },

  getDashboard: async (refresh = false): Promise<DashboardAggregatedResponse> => {
    const response = await apiRequest(`/dashboard?refresh=${refresh ? 'true' : 'false'}`);
    return response.data;
  },

  refreshDashboardMetrics: async () => {
    const response = await apiRequest('/dashboard/refresh', { method: 'POST' });
    return response.data;
  },

  getDashboardActivity: async (limit = 5) => {
    const response = await apiRequest(`/dashboard/activity?limit=${limit}`);
    return response.data;
  },

  getDashboardEnrollmentByClass: async () => {
    const response = await apiRequest('/dashboard/enrollment-by-class');
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  
  getSettings: async () => {
    const response = await apiRequest('/settings');
    return response.data;
  },

  saveSettings: async (settings: any) => {
    const response = await apiRequest('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return response.data;
  },

  getFeeStructure: async () => {
    const response = await apiRequest('/fee-structure');
    return response.data;
  },

  saveFeeStructure: async (feeStructure: any) => {
    const response = await apiRequest('/fee-structure', {
      method: 'PUT',
      body: JSON.stringify(feeStructure),
    });
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FEE RULES (Feature 056 — Fee Structure & Billing Engine)
  // ═══════════════════════════════════════════════════════════════════════════

  getFeeRules: async (): Promise<FeeRule[]> => {
    const response = await apiRequest('/fee-rules');
    return response.data;
  },

  createFeeRule: async (payload: FeeRuleInput): Promise<FeeRule> => {
    const response = await apiRequest('/fee-rules', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  updateFeeRule: async (id: string, payload: Partial<FeeRuleInput>): Promise<FeeRule> => {
    const response = await apiRequest(`/fee-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  deleteFeeRule: async (id: string): Promise<{ id: string }> => {
    const response = await apiRequest(`/fee-rules/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  getFeeRuleBillingMeta: async (): Promise<FeeRuleBillingMeta> => {
    const response = await apiRequest('/fee-rules/billing-meta');
    return response.data;
  },

  generateFeeRuleCharges: async (
    payload: FeeRuleGenerateInput,
  ): Promise<FeeRuleGenerationResult> => {
    const response = await apiRequest('/fee-rules/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  getLatestFeeRuleChargeBatch: async (): Promise<ChargeBatchSummary> => {
    const response = await apiRequest('/fee-rules/latest-charge-batch');
    return response.data;
  },

  voidLatestFeeRuleChargeBatch: async (
    payload: ChargeBatchVoidInput = {},
  ): Promise<ChargeBatchVoidResult> => {
    const response = await apiRequest('/fee-rules/latest-charge-batch/void', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  getFeeRuleUnbilledAlert: async (): Promise<FeeRuleUnbilledAlert> => {
    const response = await apiRequest('/fee-rules/unbilled-alert');
    return response.data;
  },

  getPaymentCategories: async () => {
    const response = await apiRequest('/payment-categories');
    return response.data;
  },

  createPaymentCategory: async (category: any) => {
    const response = await apiRequest('/payment-categories', {
      method: 'POST',
      body: JSON.stringify(category),
    });
    return response.data;
  },

  updatePaymentCategory: async (id: string, category: any) => {
    const response = await apiRequest(`/payment-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(category),
    });
    return response.data;
  },

  deletePaymentCategory: async (id: string) => {
    const response = await apiRequest(`/payment-categories/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  getCalendar: async () => {
    const response = await apiRequest('/calendar');
    return response.data;
  },

  saveCalendar: async (calendar: any) => {
    const response = await apiRequest('/calendar', {
      method: 'PUT',
      body: JSON.stringify(calendar),
    });
    return response.data;
  },

  getCalendarStatus: async (): Promise<CalendarStatus> => {
    const response = await apiRequest('/calendar-status');
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTENDANCE
  // ═══════════════════════════════════════════════════════════════════════════
  
  getStudentAttendance: async (params?: { studentId?: string; classId?: string; date?: string; recordedBy?: string; startDate?: string; endDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.studentId)  searchParams.append('studentId', params.studentId);
    if (params?.classId)    searchParams.append('classId', params.classId);
    if (params?.date)       searchParams.append('date', params.date);
    if (params?.recordedBy) searchParams.append('recordedBy', params.recordedBy);
    if (params?.startDate)  searchParams.append('start_date', params.startDate);
    if (params?.endDate)    searchParams.append('end_date', params.endDate);
    const response = await apiRequest(`/student-attendance?${searchParams}`);
    return response.data;
  },

  saveStudentAttendance: async (records: any[]) => {
    const response = await apiRequest('/student-attendance', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
    return response.data;
  },

  getStudentAttendanceSummary: async (studentId: string) => {
    const response = await apiRequest(`/student-attendance/summary/${studentId}`);
    return response.data;
  },

  getStaffAttendance: async (params?: { staffId?: string; date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.staffId) searchParams.append('staffId', params.staffId);
    if (params?.date) searchParams.append('date', params.date);
    const response = await apiRequest(`/staff-attendance?${searchParams}`);
    return response.data;
  },

  getStaffAttendanceFilterMetadata: async () => {
    const response = await apiRequest('/staff-attendance/filter-metadata');
    return response.data as {
      years: number[];
      departments: string[];
      staff: { id: string; name: string; department: string }[];
      months: string[];
      statuses: string[];
    };
  },

  getPagedStaffAttendance: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    staffId?: string;
    department?: string;
    startDate?: string;
    endDate?: string;
    sortBy?: 'date' | 'staffName' | 'status' | 'workHours' | 'overtimeHours';
    sortOrder?: 'asc' | 'desc';
  } = {}) => {
    const searchParams = new URLSearchParams();
    searchParams.append('page', String(params.page ?? 1));
    searchParams.append('limit', String(params.limit ?? 20));
    if (params.search)                          searchParams.append('search', params.search);
    if (params.status && params.status !== 'all') searchParams.append('status', params.status);
    if (params.staffId)                         searchParams.append('staffId', params.staffId);
    if (params.department)                        searchParams.append('department', params.department);
    if (params.startDate)                         searchParams.append('start_date', params.startDate);
    if (params.endDate)                           searchParams.append('end_date', params.endDate);
    if (params.sortBy)                            searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder)                         searchParams.append('sortOrder', params.sortOrder);
    const response = await apiRequest(`/staff-attendance?${searchParams}`);
    const payload = response.data;
    // Backend legacy branch returns a flat array when staffId/date is passed.
    if (Array.isArray(payload)) {
      return {
        records: payload as import('@/types/dashboard').StaffAttendanceRecord[],
        pagination: { page: 1, limit: payload.length, total: payload.length, totalPages: 1 },
      };
    }
    return payload as {
      records: import('@/types/dashboard').StaffAttendanceRecord[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
      summary?: {
        present: number;
        absent: number;
        late: number;
        onLeave: number;
        earlyDeparture: number;
        halfDay: number;
        totalOvertimeHours: number;
        attendanceRate: number;
      };
      filters?: Record<string, unknown>;
      sort?: BackendSortMetadata<'date' | 'staffName' | 'status' | 'workHours' | 'overtimeHours'>;
    };
  },

  checkInStaff: async (staffId: string, checkInTime?: string, date?: string, force?: boolean) => {
    const body: { staffId: string; checkIn?: string; date?: string; force?: boolean } = { staffId };
    if (checkInTime) body.checkIn = checkInTime;
    if (date) body.date = date;
    if (force) body.force = true;
    const response = await apiRequest('/staff-attendance/check-in', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.data as { id: string; checkIn: string; status: string };
  },

  checkOutStaff: async (staffId: string, checkOutTime?: string, date?: string) => {
    const body: { staffId: string; checkOut?: string; date?: string } = { staffId };
    if (checkOutTime) body.checkOut = checkOutTime;
    if (date) body.date = date;
    const response = await apiRequest('/staff-attendance/check-out', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return response.data as { checkOut: string; workHours: number; overtimeHours: number; status: string };
  },

  getStaffAttendanceSummary: async (staffId: string, month?: string, includeTrend?: boolean) => {
    const searchParams = new URLSearchParams();
    if (month) searchParams.append('month', month);
    if (includeTrend) searchParams.append('includeTrend', 'true');
    const params = searchParams.toString();
    const response = await apiRequest(`/staff-attendance/summary/${staffId}${params ? '?' + params : ''}`);
    return response.data;
  },

  deleteStaffAttendance: async (id: string) => {
    const response = await apiRequest(`/staff-attendance/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  updateStaffAttendance: async (id: string, updates: any) => {
    const response = await apiRequest(`/staff-attendance/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.data;
  },

  recordStaffAttendance: async (data: any) => {
    const response = await apiRequest('/staff-attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STAFF ATTENDANCE REPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════════════════════
  // LEAVE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════
  
  getLeaveRequests: async (params?: { page?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    const query = searchParams.toString();
    const response = await apiRequest(`/leave-requests${query ? `?${query}` : ''}`);
    return response.data;
  },

  getPendingLeaveRequests: async () => {
    const response = await apiRequest('/leave-requests/pending');
    return response.data;
  },

  getLeaveRequestsByStaff: async (staffId: string) => {
    const response = await apiRequest(`/leave-requests/staff/${staffId}`);
    return response.data;
  },

  createLeaveRequest: async (leaveData: any) => {
    const response = await apiRequest('/leave-requests', {
      method: 'POST',
      body: JSON.stringify(leaveData),
    });
    return response.data;
  },

  reviewLeaveRequest: async (id: string, status: string, reviewedBy: string, reviewNotes?: string) => {
    const response = await apiRequest(`/leave-requests/${id}/review`, {
      method: 'PUT',
      body: JSON.stringify({ status, reviewedBy, reviewNotes }),
    });
    return response.data as { id: string; status: string; syncedAttendanceDays?: number };
  },

  getAttendancePeriodReport: async (params: {
    startDate: string;
    endDate: string;
    department?: string;
    staffId?: string;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'staffName' | 'departmentName' | 'attendanceRate' | 'presentDays' | 'lateDays' | 'totalOvertimeHours';
    sortOrder?: 'asc' | 'desc';
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.append('start_date', params.startDate);
    searchParams.append('end_date', params.endDate);
    if (params.department) searchParams.append('department', params.department);
    if (params.staffId) searchParams.append('staff_id', params.staffId);
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));
    if (params.search) searchParams.append('search', params.search);
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const response = await apiRequest(`/staff-attendance/report?${searchParams}`);
    return response.data as AttendancePeriodReport;
  },

  getAttendanceDepartmentReport: async (params: { startDate: string; endDate: string }) => {
    const searchParams = new URLSearchParams();
    searchParams.append('start_date', params.startDate);
    searchParams.append('end_date', params.endDate);
    const response = await apiRequest(`/staff-attendance/departments?${searchParams}`);
    return response.data as AttendanceDepartmentReport;
  },

  // ─── Class-Linked Student Attendance (feature 068) ──────────────────────────

  submitClassAttendance: async (input: {
    classId: string;
    date: string;
    periodKey?: string | null;
    records: { studentId: string; status: string; remarks?: string }[];
  }) => {
    const response = await apiRequest('/class-attendance', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  },

  getClassAttendanceRegister: async (params: {
    classId: string;
    date: string;
    periodKey?: string | null;
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    sortBy?: 'studentName' | 'status' | 'submittedAt';
    sortOrder?: 'asc' | 'desc';
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.append('classId', params.classId);
    searchParams.append('date', params.date);
    if (params.periodKey) searchParams.append('periodKey', params.periodKey);
    if (params.page) searchParams.append('page', String(params.page));
    if (params.limit) searchParams.append('limit', String(params.limit));
    if (params.search) searchParams.append('search', params.search);
    if (params.status) searchParams.append('status', params.status);
    if (params.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const response = await apiRequest(`/class-attendance?${searchParams}`);
    return response.data;
  },

  getStudentClassAttendanceSummary: async (params: {
    studentId: string;
    sessionId: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.append('sessionId', params.sessionId);
    if (params.startDate) searchParams.append('startDate', params.startDate);
    if (params.endDate)   searchParams.append('endDate', params.endDate);
    const response = await apiRequest(`/class-attendance/summary/student/${params.studentId}?${searchParams}`);
    return response.data;
  },

  getClassAttendanceSummary: async (params: {
    classId: string;
    startDate: string;
    endDate: string;
    search?: string;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.append('startDate', params.startDate);
    searchParams.append('endDate', params.endDate);
    if (params.search) searchParams.append('search', params.search);
    const response = await apiRequest(`/class-attendance/summary/class/${params.classId}?${searchParams}`);
    return response.data;
  },

  getSessionAttendanceSummary: async (academicSession: string) => {
    const response = await apiRequest(`/class-attendance/summary/session?academicSession=${encodeURIComponent(academicSession)}`);
    return response.data;
  },

  getClassAttendanceAuditLog: async (params: {
    studentId: string;
    classId: string;
    date: string;
    periodKey?: string | null;
  }) => {
    const searchParams = new URLSearchParams();
    searchParams.append('studentId', params.studentId);
    searchParams.append('classId', params.classId);
    searchParams.append('date', params.date);
    if (params.periodKey) searchParams.append('periodKey', params.periodKey);
    const response = await apiRequest(`/class-attendance/audit?${searchParams}`);
    return response.data;
  },

  updateLeaveRequest: async (id: string, leaveData: any) => {
    const response = await apiRequest(`/leave-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(leaveData),
    });
    return response.data;
  },

  deleteLeaveRequest: async (id: string) => {
    const response = await apiRequest(`/leave-requests/${id}`, {
      method: 'DELETE',
    });
    return response.data;
  },

  
  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSPORT
  // ═══════════════════════════════════════════════════════════════════════════

  // Routes
  getRoutes: async (params?: TransportListParams): Promise<PaginatedResponse<any>> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const qs = searchParams.toString();
    const response = await apiRequest(`/transport/routes${qs ? `?${qs}` : ''}`);
    return response.data;
  },
  getRouteById: async (id: string): Promise<TransportRoute> => {
    const response = await apiRequest(`/transport/routes/${id}`);
    return response.data;
  },
  createRoute: async (routeData: any) => {
    const response = await apiRequest('/transport/routes', { method: 'POST', body: JSON.stringify(routeData) });
    return response.data;
  },
  updateRoute: async (id: string, routeData: any) => {
    const response = await apiRequest(`/transport/routes/${id}`, { method: 'PUT', body: JSON.stringify(routeData) });
    return response.data;
  },
  deleteRoute: async (id: string) => {
    const response = await apiRequest(`/transport/routes/${id}`, { method: 'DELETE' });
    return response.data;
  },

  // Stops
  getRouteStops: async (routeId: string) => {
    const response = await apiRequest(`/transport/routes/${routeId}/stops`);
    return response.data;
  },
  createStop: async (routeId: string, data: { name: string; pickupTime?: string; orderPosition?: number }) => {
    const response = await apiRequest(`/transport/routes/${routeId}/stops`, { method: 'POST', body: JSON.stringify(data) });
    return response.data;
  },
  updateStop: async (stopId: string, data: { name?: string; pickupTime?: string; orderPosition?: number }) => {
    const response = await apiRequest(`/transport/stops/${stopId}`, { method: 'PUT', body: JSON.stringify(data) });
    return response.data;
  },
  deleteStop: async (stopId: string) => {
    const response = await apiRequest(`/transport/stops/${stopId}`, { method: 'DELETE' });
    return response.data;
  },
  reorderStops: async (routeId: string, order: string[]) => {
    const response = await apiRequest(`/transport/routes/${routeId}/stops/reorder`, { method: 'PUT', body: JSON.stringify({ order }) });
    return response.data;
  },

  // Vehicles
  getVehicles: async (params?: TransportListParams): Promise<PaginatedResponse<any>> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const qs = searchParams.toString();
    const response = await apiRequest(`/transport/vehicles${qs ? `?${qs}` : ''}`);
    return response.data;
  },
  createVehicle: async (data: { name: string; regNumber?: string; type?: string; capacity: number }) => {
    const response = await apiRequest('/transport/vehicles', { method: 'POST', body: JSON.stringify(data) });
    return response.data;
  },
  updateVehicle: async (id: string, data: any) => {
    const response = await apiRequest(`/transport/vehicles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return response.data;
  },
  deleteVehicle: async (id: string) => {
    const response = await apiRequest(`/transport/vehicles/${id}`, { method: 'DELETE' });
    return response.data;
  },

  // Drivers
  getDrivers: async (params?: TransportListParams): Promise<PaginatedResponse<any>> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const qs = searchParams.toString();
    const response = await apiRequest(`/transport/drivers${qs ? `?${qs}` : ''}`);
    return response.data;
  },
  createDriver: async (data: { name?: string; staffId?: string; phone?: string; licenseNumber?: string }) => {
    const response = await apiRequest('/transport/drivers', { method: 'POST', body: JSON.stringify(data) });
    return response.data;
  },
  updateDriver: async (id: string, data: any) => {
    const response = await apiRequest(`/transport/drivers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return response.data;
  },
  deleteDriver: async (id: string) => {
    const response = await apiRequest(`/transport/drivers/${id}`, { method: 'DELETE' });
    return response.data;
  },

  // Route periods (vehicle + driver assignment)
  getRoutePeriods: async (routeId: string) => {
    const response = await apiRequest(`/transport/routes/${routeId}/periods`);
    return response.data;
  },
  createRoutePeriod: async (routeId: string, data: { vehicleId: string; driverId?: string }) => {
    const response = await apiRequest(`/transport/routes/${routeId}/periods`, { method: 'POST', body: JSON.stringify(data) });
    return response.data;
  },
  updateRoutePeriod: async (periodId: string, data: any) => {
    const response = await apiRequest(`/transport/route-periods/${periodId}`, { method: 'PUT', body: JSON.stringify(data) });
    return response.data;
  },
  deleteRoutePeriod: async (periodId: string) => {
    const response = await apiRequest(`/transport/route-periods/${periodId}`, { method: 'DELETE' });
    return response.data;
  },

  // Student allocations
  getAllocations: async (filters?: { routeId?: string; studentId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.routeId)      params.append('routeId', filters.routeId);
    if (filters?.studentId)    params.append('studentId', filters.studentId);
    if (filters?.status)       params.append('status', filters.status);
    const response = await apiRequest(`/transport/allocations${params.toString() ? '?' + params.toString() : ''}`);
    return response.data;
  },
  createAllocation: async (routeId: string, data: { studentId: string; stopId?: string; direction?: string; notes?: string }) => {
    const response = await apiRequest(`/transport/routes/${routeId}/allocations`, { method: 'POST', body: JSON.stringify(data) });
    return response.data;
  },
  updateAllocation: async (id: string, data: any) => {
    const response = await apiRequest(`/transport/allocations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    return response.data;
  },
  removeAllocation: async (id: string) => {
    const response = await apiRequest(`/transport/allocations/${id}`, { method: 'DELETE' });
    return response.data;
  },

  // Feature 054: atomic reassignment from one route to another
  reassignAllocation: async (data: {
    studentId: string;
    fromRouteId: string;
    toRouteId: string;
    toStopId: string;
    direction?: string;
    notes?: string;
    reassignDate?: string;
    academicYear?: string;
  }) => {
    const response = await apiRequest('/transport/allocations/reassign', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  },

  // Feature 054: students with active assignments missing a transport charge for the month
  getMissingTransportCharges: async (filters?: {
    month?: string;
    routeId?: string;
    academicYear?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.month)        params.append('month', filters.month);
    if (filters?.routeId)      params.append('routeId', filters.routeId);
    if (filters?.academicYear) params.append('academicYear', filters.academicYear);
    const qs = params.toString();
    const response = await apiRequest(`/transport/missing-charges${qs ? '?' + qs : ''}`);
    return response.data;
  },

  // Feature 054: chronological transport history for a student
  getStudentTransportHistory: async (studentId: string, filters?: StudentTransportHistoryFilters) => {
    const params = new URLSearchParams();
    if (filters?.month) params.append('month', String(filters.month));
    if (filters?.year) params.append('year', String(filters.year));
    const query = params.toString();
    const response = await apiRequest(`/students/${studentId}/transport-history${query ? '?' + query : ''}`);
    return response.data;
  },

  generateTransportCharges: async (month: string, currency?: string, exchangeRateOverride?: number) => {
    const response = await apiRequest('/transport/generate-charges', {
      method: 'POST',
      body: JSON.stringify({ month, ...(currency ? { currency, exchangeRateOverride } : {}) }),
    });
    return response.data;
  },
  generateStudentTransportCharge: async (studentId: string, month?: string) => {
    const response = await apiRequest('/transport/generate-student-charge', {
      method: 'POST',
      body: JSON.stringify({ studentId, month }),
    });
    return response.data;
  },
  getLatestTransportChargeBatch: async (): Promise<ChargeBatchSummary> => {
    const response = await apiRequest('/transport/latest-charge-batch');
    return response.data;
  },
  voidLatestTransportChargeBatch: async (
    payload: ChargeBatchVoidInput = {},
  ): Promise<ChargeBatchVoidResult> => {
    const response = await apiRequest('/transport/latest-charge-batch/void', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },
  getDriverRoutes: async () => {
    const response = await apiRequest('/transport/driver/routes');
    return response.data;
  },
  getDriverRoster: async (routeId: string) => {
    const response = await apiRequest(`/transport/driver/routes/${routeId}/roster`);
    return response.data;
  },
  getTransportReport: async (type: string, month?: string) => {
    const params = new URLSearchParams({ type });
    if (month) params.append('month', month);
    const response = await apiRequest(`/transport/reports?${params}`);
    return response.data;
  },
  getStudentsWithRouteStatus: async (routeId: string, term?: string) => {
    const params = new URLSearchParams();
    if (term) params.append('term', term);
    const qs = params.toString();
    const response = await apiRequest(`/transport/routes/${routeId}/students-with-status${qs ? '?' + qs : ''}`);
    return response.data;
  },
  getRoutePaymentStatus: async (routeId: string, month?: string): Promise<RoutePaymentStatusResponse> => {
    const params = new URLSearchParams();
    if (month) params.append('month', month);
    const qs = params.toString();
    const response = await apiRequest(`/transport/routes/${routeId}/payment-status${qs ? '?' + qs : ''}`);
    return response.data;
  },
  getRouteStudents: async (routeId: string, params?: RouteStudentsParams): Promise<PaginatedRouteStudentsResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const qs = searchParams.toString();
    const response = await apiRequest(`/transport/routes/${routeId}/students${qs ? '?' + qs : ''}`);
    return response.data;
  },

  downloadRoutePdf: async (routeId: string, includeBalances = false): Promise<void> => {
    const token = getToken() ?? '';
    const qs = includeBalances ? '?includeBalances=1' : '';
    const res = await fetch(
      `${API_BASE_URL}/transport/routes/${encodeURIComponent(routeId)}/pdf${qs}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error(`PDF generation failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cd = res.headers.get('Content-Disposition') ?? '';
    const match = cd.match(/filename="?([^"]+)"?/);
    a.download = match?.[1] ?? 'route-report.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LEDGER / CHARGES
  // ═══════════════════════════════════════════════════════════════════════════
  
  getCharges: async (studentId?: string, termId?: string) => {
    const params = new URLSearchParams();
    if (studentId) params.append('studentId', studentId);
    if (termId) params.append('termId', termId);
    const response = await apiRequest(`/charges?${params}`);
    return response.data;
  },

  getStudentCharges: async (studentId: string) => {
    const response = await apiRequest(`/charges/student/${studentId}`);
    return response.data;
  },

  /**
   * Get ledger-based balance for a student
   * Balance = Total Charges - Total Payments
   * Returns: { studentId, balance, totalCharges, totalPayments, studentName }
   */
  getStudentBalance: async (studentId: string) => {
    const response = await apiRequest(`/students/${studentId}/balance`);
    return response.data;
  },

  getAllStudentBalances: async () => {
    const response = await apiRequest('/ledger/balances');
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════════════════

  getPaymentCollectionReport: async (termId: string): Promise<PaymentCollectionReport> => {
    const response = await apiRequest(`/reports/payment-collection?termId=${termId}`);
    return response.data;
  },

  getAgedBalances: async (termId: string): Promise<AgedBalancesReport> => {
    const response = await apiRequest(`/reports/aged-balances?termId=${termId}`);
    return response.data;
  },

  getRevenueByCategoryReport: async (termId: string, category?: string): Promise<RevenueByCategoryReport> => {
    const url = `/reports/revenue-by-category?termId=${termId}${category ? `&category=${category}` : ''}`;
    const response = await apiRequest(url);
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RECONCILIATION
  // ═══════════════════════════════════════════════════════════════════════════

  // Adjustments
  getAdjustments: async (params?: {
    studentId?: string;
    category?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    if (params?.category) searchParams.append('category', params.category);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.fromDate) searchParams.append('fromDate', params.fromDate);
    if (params?.toDate) searchParams.append('toDate', params.toDate);
    const queryString = searchParams.toString();
    const response = await apiRequest(`/reconciliation/adjustments${queryString ? '?' + queryString : ''}`);
    return response.data;
  },

  getAdjustment: async (id: string) => {
    const response = await apiRequest(`/reconciliation/adjustments/${id}`);
    return response.data;
  },

  createAdjustment: async (data: {
    studentId: string;
    adjustmentType: 'credit' | 'debit';
    category: 'correction' | 'refund' | 'write_off' | 'fee_waiver' | 'late_fee' | 'penalty' | 'discount' | 'other';
    amount: number;
    reason: string;
    referenceType?: 'charge' | 'payment' | 'none';
    referenceId?: string;
    termId?: string;
    effectiveDate?: string;
  }) => {
    const response = await apiRequest('/reconciliation/adjustments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  },

  voidAdjustment: async (id: string, reason: string) => {
    const response = await apiRequest(`/reconciliation/adjustments/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return response.data;
  },

  // Refunds
  getRefunds: async (params?: { studentId?: string; status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    if (params?.status) searchParams.append('status', params.status);
    const queryString = searchParams.toString();
    const response = await apiRequest(`/reconciliation/refunds${queryString ? '?' + queryString : ''}`);
    return response.data;
  },

  createRefund: async (data: {
    studentId: string;
    refundType: 'full' | 'partial';
    amount: number;
    reason: string;
    originalPaymentId?: string;
    originalChargeId?: string;
    refundMethod?: 'cash' | 'bank_transfer' | 'check' | 'credit_note' | 'other';
    referenceNumber?: string;
  }) => {
    const response = await apiRequest('/reconciliation/refunds', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data;
  },

  processRefund: async (id: string, referenceNumber?: string) => {
    const response = await apiRequest(`/reconciliation/refunds/${id}/process`, {
      method: 'PUT',
      body: JSON.stringify({ referenceNumber }),
    });
    return response.data;
  },

  completeRefund: async (id: string) => {
    const response = await apiRequest(`/reconciliation/refunds/${id}/complete`, {
      method: 'PUT',
    });
    return response.data;
  },

  cancelRefund: async (id: string, reason: string) => {
    const response = await apiRequest(`/reconciliation/refunds/${id}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
    return response.data;
  },

  // Audit & History
  getReconciliationAuditLog: async (params?: {
    studentId?: string;
    actionType?: string;
    entityType?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.studentId) searchParams.append('studentId', params.studentId);
    if (params?.actionType) searchParams.append('actionType', params.actionType);
    if (params?.entityType) searchParams.append('entityType', params.entityType);
    if (params?.fromDate) searchParams.append('fromDate', params.fromDate);
    if (params?.toDate) searchParams.append('toDate', params.toDate);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    const queryString = searchParams.toString();
    const response = await apiRequest(`/reconciliation/audit-log${queryString ? '?' + queryString : ''}`);
    return response.data;
  },

  getStudentFinancialHistory: async (studentId: string) => {
    const response = await apiRequest(`/reconciliation/student/${studentId}/history`);
    return response.data;
  },

  getStudentBalanceDetail: async (studentId: string) => {
    const response = await apiRequest(`/reconciliation/student/${studentId}/balance`);
    return response.data;
  },

  // Balance & Summary
  recalculateStudentBalance: async (studentId: string) => {
    const response = await apiRequest('/reconciliation/recalculate-balance', {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    });
    return response.data;
  },

  getReconciliationSummary: async (params?: { fromDate?: string; toDate?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.fromDate) searchParams.append('fromDate', params.fromDate);
    if (params?.toDate) searchParams.append('toDate', params.toDate);
    const queryString = searchParams.toString();
    const response = await apiRequest(`/reconciliation/summary${queryString ? '?' + queryString : ''}`);
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ALERTS
  // ═══════════════════════════════════════════════════════════════════════════
  
  getAlertState: async () => {
    const response = await apiRequest('/alerts');
    return response.data;
  },

  dismissAlert: async (alertType: string) => {
    const response = await apiRequest('/alerts/dismiss', {
      method: 'POST',
      body: JSON.stringify({ alertType }),
    });
    return response.data;
  },

  logAlertNotification: async (level: string, message: string) => {
    const response = await apiRequest('/alerts/log', {
      method: 'POST',
      body: JSON.stringify({ level, message }),
    });
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIPTION
  // ═══════════════════════════════════════════════════════════════════════════

  getSubscriptionPlans: async (): Promise<SubscriptionPlan[]> => {
    const response = await apiRequest('/subscription/plans');
    return response.data;
  },

  getCurrentSubscription: async (): Promise<CurrentSubscriptionResponse> => {
    const response = await apiRequest('/subscription/current');
    return response.data;
  },

  getSubscriptionHistory: async (): Promise<SubscriptionHistoryResponse> => {
    const response = await apiRequest('/subscription/history');
    return response.data;
  },

  getInvoices: async (): Promise<InvoiceListResponse> => {
    const response = await apiRequest('/subscription/invoices');
    return response.data;
  },

  downloadInvoice: async (invoiceId: string): Promise<Blob> => {
    const token = getToken() ?? '';
    const res = await fetch(`${API_BASE_URL}/subscription/invoices/${encodeURIComponent(invoiceId)}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return res.blob();
  },

  initiateSubscription: async (planId: string, billingCycle: 'monthly' | 'annual'): Promise<InitiateSubscriptionResponse> => {
    const response = await apiRequest('/subscription/initiate', {
      method: 'POST',
      body: JSON.stringify({ planId, billingCycle }),
    });
    return response.data;
  },

  pollSubscriptionStatus: async (transactionId: string): Promise<{ paid: boolean; paynowStatus: string; subscriptionStatus: string }> => {
    const response = await apiRequest(`/subscription/poll/${encodeURIComponent(transactionId)}`);
    return response.data;
  },

  getGraceUsageStatus: async (): Promise<GraceUsageStatus> => {
    const response = await apiRequest('/subscription/usage/status');
    return response.data;
  },

  recordGraceHeartbeat: async (): Promise<GraceUsageStatus> => {
    const response = await apiRequest('/subscription/usage/heartbeat', { method: 'POST' });
    return response.data;
  },

  calculateProration: async (
    targetPlanId: string,
    billingCycle?: 'monthly' | 'annual'
  ): Promise<ProrationCalculation> => {
    const response = await apiRequest('/subscription/calculate-proration', {
      method: 'POST',
      body: JSON.stringify({ targetPlanId, billingCycle }),
    });
    return response.data;
  },

  initiateUpgrade: async (
    calculationId: string,
    paymentMethod?: string
  ): Promise<UpgradeWithProrationResponse> => {
    const response = await apiRequest('/subscription/upgrade-with-proration', {
      method: 'POST',
      body: JSON.stringify({ calculationId, paymentMethod }),
    });
    return response.data;
  },

  getCredits: async (): Promise<CreditsResponse> => {
    const response = await apiRequest('/subscription/credits');
    return response.data;
  },

  getProrationHistory: async (page = 1, perPage = 20): Promise<ProrationHistoryResponse> => {
    const response = await apiRequest(`/subscription/proration-history?page=${page}&perPage=${perPage}`);
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FEE CAMPAIGNS (Feature 059)
  // ═══════════════════════════════════════════════════════════════════════════

  getFeeCampaigns: async (params?: { status?: CampaignStatus; search?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: string }): Promise<PaginatedResponse<FeeCampaign>> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.limit) searchParams.append('limit', String(params.limit));
    if (params?.sortBy) searchParams.append('sortBy', params.sortBy);
    if (params?.sortOrder) searchParams.append('sortOrder', params.sortOrder);
    const qs = searchParams.toString();
    const response = await apiRequest(`/fee-campaigns${qs ? '?' + qs : ''}`);
    return response.data;
  },

  createFeeCampaign: async (input: CreateCampaignInput): Promise<{ campaign: FeeCampaign; assignedCount: number }> => {
    const response = await apiRequest('/fee-campaigns', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  },

  getFeeCampaign: async (id: string): Promise<FeeCampaign> => {
    const response = await apiRequest(`/fee-campaigns/${id}`);
    return response.data;
  },

  updateFeeCampaign: async (id: string, input: Partial<CreateCampaignInput>): Promise<FeeCampaign> => {
    const response = await apiRequest(`/fee-campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
    return response.data;
  },

  closeFeeCampaign: async (id: string, force = false): Promise<FeeCampaign> => {
    const response = await apiRequest(`/fee-campaigns/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ force }),
    });
    return response.data;
  },

  getCampaignStudents: async (campaignId: string, status?: CampaignStudentStatus): Promise<CampaignStudent[]> => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    const qs = params.toString();
    const response = await apiRequest(`/fee-campaigns/${campaignId}/students${qs ? '?' + qs : ''}`);
    return response.data;
  },

  addCampaignStudent: async (campaignId: string, studentId: string): Promise<CampaignStudent> => {
    const response = await apiRequest(`/fee-campaigns/${campaignId}/students`, {
      method: 'POST',
      body: JSON.stringify({ studentId }),
    });
    return response.data;
  },

  removeCampaignStudent: async (campaignId: string, studentId: string, force = false): Promise<void> => {
    const params = new URLSearchParams();
    if (force) params.append('force', 'true');
    const qs = params.toString();
    await apiRequest(`/fee-campaigns/${campaignId}/students/${studentId}${qs ? '?' + qs : ''}`, {
      method: 'DELETE',
    });
  },

  recordCampaignPayment: async (campaignId: string, input: RecordCampaignPaymentInput) => {
    const response = await apiRequest(`/fee-campaigns/${campaignId}/record-payment`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return response.data;
  },

  getCampaignPayments: async (campaignId: string): Promise<CampaignPaymentRecord[]> => {
    const response = await apiRequest(`/fee-campaigns/${campaignId}/payments`);
    return response.data;
  },

  voidCampaignPayment: async (campaignId: string, paymentId: string, reason: string): Promise<{ voided: boolean; amountReversed: number; newPaidAmount: number; newStatus: string }> => {
    const response = await apiRequest(`/fee-campaigns/${campaignId}/payments/${paymentId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
    return response.data;
  },

  getStudentCampaigns: async (studentId: string): Promise<StudentCampaignMembership[]> => {
    const response = await apiRequest(`/students/${studentId}/campaigns`);
    return response.data;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CURRENCIES & EXCHANGE RATES (Feature 094)
  // ═══════════════════════════════════════════════════════════════════════════

  getCurrencyConfig: async (): Promise<CurrencyConfiguration> => {
    const response = await apiRequest('/currencies');
    return response.data as CurrencyConfiguration;
  },

  updateCurrencyConfig: async (data: { baseCurrency?: string; enabledCurrencies?: string[]; multiCurrencyEnabled?: boolean }): Promise<CurrencyConfiguration> => {
    const response = await apiRequest('/currencies', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data as CurrencyConfiguration;
  },

  getExchangeRates: async (currency: string): Promise<ExchangeRate[]> => {
    const response = await apiRequest(`/exchange-rates?currency=${encodeURIComponent(currency)}`);
    return response.data as ExchangeRate[];
  },

  lookupExchangeRate: async (currency: string, date: string): Promise<ExchangeRateLookupResult> => {
    const response = await apiRequest(`/exchange-rates/lookup?currency=${encodeURIComponent(currency)}&date=${encodeURIComponent(date)}`);
    return response.data as ExchangeRateLookupResult;
  },

  createExchangeRate: async (data: { currency: string; rateToBase: number; effectiveDate: string }): Promise<ExchangeRate> => {
    const response = await apiRequest('/exchange-rates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data as ExchangeRate;
  },

  updateExchangeRate: async (id: string, data: { rateToBase: number }): Promise<ExchangeRate> => {
    const response = await apiRequest(`/exchange-rates/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return response.data as ExchangeRate;
  },

};

// Export token and tenant helpers for use elsewhere
export { getToken, setToken, removeToken, getTenantId, setTenantId, removeTenantId, apiRequest };

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface RoutePaymentStatusResponse {
  routeId: string;
  month: string;
  students: Array<{
    studentId: string;
    paymentStatus: 'paid' | 'unpaid' | 'no_charge';
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// KIOSK API — Public endpoints (no JWT, separate request function)
// ─────────────────────────────────────────────────────────────────────────────

export interface KioskStatusResponse {
  kioskEnabled: boolean;
  schoolName: string;
  workHours: { startTime: string; endTime: string } | null;
  date?: string;
}

export interface KioskActionRequest {
  kiosk_code: string;
  employee_id: string;
}

export interface KioskActionResult {
  staffName: string;
  action: 'check_in' | 'check_out' | 'already_completed';
  timestamp: string;
  date: string;
  attendanceStatus: 'present' | 'late' | 'early_departure' | 'half_day' | 'on_leave' | string;
  workHours?: number;
  overtimeHours?: number;
  earlyDeparture?: boolean;
}

/**
 * Unauthenticated request for kiosk endpoints.
 * Does NOT attach a JWT — the kiosk page has no login session.
 */
const kioskRequest = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<any> => {
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) },
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out.', 0);
    }
    throw new ApiError('Network error. Please check your connection.', 0);
  }
  clearTimeout(timeoutId);

  let data: any;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = { status: response.ok, message: await response.text() };
  }

  if (!response.ok) {
    throw new ApiError(data?.message || `Request failed with status ${response.status}`, response.status);
  }

  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT KIOSK API — Public endpoints for student attendance kiosk
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentKioskStatusResponse {
  kioskEnabled: boolean;
  schoolName: string;
  date: string;
}

export interface StudentKioskClass {
  id: string;
  name: string;
  studentCount: number;
  attendanceRecorded: boolean;
}

export interface StudentKioskValidateTeacherResponse {
  teacherName: string;
  employeeId: string;
  classes: StudentKioskClass[];
}

export interface StudentKioskStudent {
  id: string;
  firstName: string;
  lastName: string;
  currentStatus: 'present' | 'absent' | 'late' | 'excused' | 'half_day' | null;
  remarks?: string;
}

export interface StudentKioskClassStudentsResponse {
  classId: string;
  className: string;
  date: string;
  students: StudentKioskStudent[];
}

export interface StudentKioskAttendanceRecord {
  studentId: string;
  status: 'present' | 'absent' | 'late' | 'excused' | 'half_day';
  remarks?: string;
}

export interface StudentKioskSubmitRequest {
  kiosk_code: string;
  employee_id: string;
  class_id: string;
  date: string;
  records: StudentKioskAttendanceRecord[];
}

export interface StudentKioskSubmitResponse {
  classId: string;
  className: string;
  date: string;
  totalStudents: number;
  saved: number;
  submittedBy: string;
}

export const studentKioskApi = {
  getStatus: async (code: string): Promise<StudentKioskStatusResponse> => {
    const response = await kioskRequest(`/kiosk/student-attendance/status/${encodeURIComponent(code)}`);
    return response.data as StudentKioskStatusResponse;
  },

  validateTeacher: async (kioskCode: string, employeeId: string): Promise<StudentKioskValidateTeacherResponse> => {
    const response = await kioskRequest('/kiosk/student-attendance/validate-teacher', {
      method: 'POST',
      body: JSON.stringify({ kiosk_code: kioskCode, employee_id: employeeId }),
    });
    return response.data as StudentKioskValidateTeacherResponse;
  },

  getClassStudents: async (code: string, employeeId: string, classId: string): Promise<StudentKioskClassStudentsResponse> => {
    const params = new URLSearchParams({ employee_id: employeeId, class_id: classId });
    const response = await kioskRequest(`/kiosk/student-attendance/class-students/${encodeURIComponent(code)}?${params}`);
    return response.data as StudentKioskClassStudentsResponse;
  },

  submitAttendance: async (payload: StudentKioskSubmitRequest): Promise<StudentKioskSubmitResponse> => {
    const response = await kioskRequest('/kiosk/student-attendance/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data as StudentKioskSubmitResponse;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER KIOSK API — Public endpoints for driver route and roster access
// ─────────────────────────────────────────────────────────────────────────────

export interface KioskBus {
  id: string;
  name: string;
  regNumber: string | null;
  type: 'bus' | 'minibus' | 'van' | 'other';
  capacity: number;
}

export interface KioskStop {
  id: string;
  name: string;
  pickupTime: string | null;
  orderPosition: number;
}

export interface DriverKioskRoute {
  id: string;
  name: string;
  description: string | null;
  stops: KioskStop[];
}

export interface DriverKioskValidateResponse {
  driverName: string;
  employeeId: string;
  bus: KioskBus | null;
  routes: DriverKioskRoute[];
}

export interface StudentStop {
  id: string;
  name: string;
  pickupTime: string | null;
}

export interface DriverKioskStudent {
  id: string;
  firstName: string;
  lastName: string;
  stop: StudentStop | null;
  direction: 'both' | 'inbound' | 'outbound';
  notes: string | null;
  paymentStatus: 'paid' | 'unpaid';
  transportBalance: number | null;
}

export interface DriverKioskRosterResponse {
  routeName: string;
  busName: string | null;
  totalCount: number;
  paidCount: number;
  unpaidCount: number;
  students: DriverKioskStudent[];
}

export const kioskDriverApi = {
  validate: async (kioskCode: string, employeeId: string): Promise<DriverKioskValidateResponse> => {
    const response = await kioskRequest('/kiosk/driver/validate', {
      method: 'POST',
      body: JSON.stringify({ kiosk_code: kioskCode, employee_id: employeeId }),
    });
    return response.data as DriverKioskValidateResponse;
  },

  getRoster: async (
    kioskCode: string,
    employeeId: string,
    routeId: string,
    paidOnly: boolean = false
  ): Promise<DriverKioskRosterResponse> => {
    const params = new URLSearchParams({
      employee_id: employeeId,
      route_id: routeId,
      ...(paidOnly ? { paid_only: 'true' } : {}),
    });
    const response = await kioskRequest(`/kiosk/driver/routes/${encodeURIComponent(kioskCode)}?${params}`);
    return response.data as DriverKioskRosterResponse;
  },
};

export const kioskApi = {
  /**
   * Fetch kiosk status by opaque code (new format: /kiosk/status/:code).
   * Falls back to legacy ?tenant_id= param when code is absent.
   */
  getKioskStatus: async (codeOrTenantId: string, useLegacy = false): Promise<KioskStatusResponse> => {
    const endpoint = useLegacy
      ? `/kiosk/status?tenant_id=${encodeURIComponent(codeOrTenantId)}`
      : `/kiosk/status/${encodeURIComponent(codeOrTenantId)}`;
    const response = await kioskRequest(endpoint);
    return response.data as KioskStatusResponse;
  },

  postKioskAction: async (payload: KioskActionRequest): Promise<KioskActionResult> => {
    const response = await kioskRequest('/kiosk/action', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data as KioskActionResult;
  },

};
