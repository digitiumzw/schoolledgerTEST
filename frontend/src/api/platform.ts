// Resolve the platform API base URL. Priority:
//   1. VITE_PLATFORM_API_URL — explicit override for the platform endpoint.
//   2. VITE_API_BASE_URL + '/platform' — derived from the shared backend URL
//      configured in .env (no trailing slash expected on VITE_API_BASE_URL).
//   3. localhost fallback for local development.
const PLATFORM_API_URL = import.meta.env.VITE_PLATFORM_API_URL as string | undefined;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;

const BASE_URL =
  PLATFORM_API_URL ??
  (API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, '')}/platform` : undefined) ??
  'http://localhost:8080/api/platform';

function getToken(): string | null {
  return localStorage.getItem('schoolledger_platform_token');
}

function clearSession(): void {
  localStorage.removeItem('schoolledger_platform_token');
  localStorage.removeItem('schoolledger_platform_refresh_token');
}

async function request<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestInit = {}
): Promise<{ data: T; status: number }> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...options,
  });

  let data: T;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = (await res.blob()) as unknown as T;
  }

  if (res.status === 401) {
    // Login endpoint: pass the error through so the UI can show it.
    if (path === '/auth/login') {
      const msg = (data as { message?: string })?.message ?? 'Invalid email or password';
      throw Object.assign(new Error(msg), { response: { status: res.status, data } });
    }

    // For all other endpoints treat 401 as expired session — but only if we still
    // have a token stored. This prevents redundant redirects/pop-ups when the
    // user is already logged out and background requests (e.g. react-query
    // refetch) succeed with 401.
    const token = getToken();
    if (token) {
      clearSession();
      window.dispatchEvent(
        new CustomEvent('sessionExpired', {
          detail: { message: 'Your session has expired. Please sign in again.' },
        })
      );
      window.location.href = '/platform-control-panel/login';
    }

    const msg = (data as { message?: string })?.message ?? 'Session expired';
    throw Object.assign(new Error(msg), { response: { status: res.status, data } });
  }

  if (!res.ok) {
    const msg = (data as { message?: string })?.message ?? `HTTP ${res.status}`;
    const err = Object.assign(new Error(msg), { response: { status: res.status, data } });
    throw err;
  }

  return { data, status: res.status };
}

const get  = <T = unknown>(path: string) => request<T>('GET', path);
const post = <T = unknown>(path: string, body?: unknown) => request<T>('POST', path, body);
const put  = <T = unknown>(path: string, body?: unknown) => request<T>('PUT', path, body);
const del  = <T = unknown>(path: string, body?: unknown) => request<T>('DELETE', path, body);

// ─── Auth ────────────────────────────────────────────────────────────────────

export const platformLogin = (email: string, password: string) =>
  post('/auth/login', { email, password });

export const platformRefresh = (refreshToken: string) =>
  post('/auth/refresh', { refresh_token: refreshToken });

export const platformMe = () => get('/auth/me');

export const platformImpersonate = (tenantId: string | number) =>
  post('/auth/impersonate', { tenant_id: tenantId });

export const platformStopImpersonation = () =>
  post('/auth/stop-impersonation');

export const platformForgotPassword = (email: string) =>
  post('/auth/forgot-password', { email });

export const platformResetPassword = (token: string, password: string) =>
  post('/auth/reset-password', { token, password });

// ─── Dashboard ───────────────────────────────────────────────────────────────

export const getDashboardKpis     = () => get('/dashboard/kpis');
export const getDashboardRevenue  = () => get('/dashboard/revenue');
export const getDashboardPlans    = () => get('/dashboard/plans');
export const getDashboardActivity = () => get('/dashboard/activity');

// ─── Tenants ─────────────────────────────────────────────────────────────────

export const getTenants = (params: Record<string, unknown> = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get(`/tenants${qs ? '?' + qs : ''}`);
};

export const getTenant        = (id: number) => get(`/tenants/${id}`);
export const createTenant     = (data: Record<string, unknown>) => post('/tenants', data);
export const resendTenantWelcome = (id: string | number) => post(`/tenants/${id}/resend-welcome`);
export const suspendTenant    = (id: number) => post(`/tenants/${id}/suspend`);
export const reactivateTenant = (id: number) => post(`/tenants/${id}/reactivate`);
export const deleteTenant     = (id: number) => del(`/tenants/${id}`);

export const getTenantInvoices = (
  tenantId: string | number,
  params: Record<string, unknown> = {}
) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get(`/tenants/${tenantId}/invoices${qs ? '?' + qs : ''}`);
};

// ─── Plans ───────────────────────────────────────────────────────────────────

export const getPlans    = ()                                         => get('/plans');
export const getPlan     = (id: number)                              => get(`/plans/${id}`);
export const createPlan  = (data: Record<string, unknown>)           => post('/plans', data);
export const updatePlan  = (id: number, data: Record<string, unknown>) => put(`/plans/${id}`, data);
export const deletePlan  = (id: number)                              => del(`/plans/${id}`);

// ─── Subscriptions ───────────────────────────────────────────────────────────

export const getSubscriptions = (params: Record<string, unknown> = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get(`/subscriptions${qs ? '?' + qs : ''}`);
};

export const changePlan         = (id: number, planId: number) => post(`/subscriptions/${id}/change-plan`, { plan_id: planId });
export const cancelSubscription = (id: number)                 => post(`/subscriptions/${id}/cancel`);
export const assignSubscription = (data: {
  tenant_id: string;
  plan_id: string;
  billing_cycle: 'monthly' | 'annual';
  starts_at: string;
  expires_at: string;
}) => post('/subscriptions/assign', data);

export interface PlatformSubscriptionTransitionPolicy {
  canSwitchToAnnual: boolean;
  canSwitchToMonthly: boolean;
  canChangeTier: boolean;
  blockedReason: string | null;
}

export interface PlatformSubscriptionPendingChange {
  pending_plan_id?: string | null;
  pending_change_effective_at?: string | null;
  pending_change_type?: string | null;
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export interface PlatformFinanceTrendPoint {
  month: string;
  monthLabel?: string;
  revenue: number;
  displayValue?: string;
  comparisonValue?: number;
  deltaPercent?: number;
}

export interface PlatformFinanceOperationalItem {
  type: string;
  title: string;
  amount?: number;
  currency?: string;
  status: "positive" | "warning" | "neutral" | "critical";
  date?: string;
  reference?: string;
  description?: string;
}

export interface PlatformFinanceInvoiceRow {
  id: string;
  invoice_number: string;
  school_name: string;
  plan_name: string | null;
  billing_cycle: string;
  amount: number;
  currency: string;
  issued_at: string | null;
  payment_status: string | null;
  alerts?: string[];
}

export interface PlatformRecentSubscription {
  id: string;
  tenant_name: string | null;
  plan_name: string | null;
  billing_cycle: string;
  status: string;
  created_at: string;
  last_payment_at: string | null;
}

export interface PlatformFinanceSummary {
  total_revenue: number;
  pending_amount: number;
  failed_amount: number;
  invoice_count: number;
  mrr: number;
  failed_payments_count: number;
  renewals_due_count: number;
  growth_rate: number;
  net_revenue: number;
  outstanding_invoices_count: number;
  active_schools_count: number;
  recent_transactions: PlatformFinanceOperationalItem[];
  recent_subscriptions: PlatformRecentSubscription[];
}

export interface PlatformFinanceInvoicesResponse {
  data: PlatformFinanceInvoiceRow[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    last_page: number;
  };
}

export interface PlatformFinanceFilters {
  page?: number;
  limit?: number;
  status?: string;
  from?: string;
  to?: string;
  tenant_id?: string | number;
}

export const getFinanceSummary = (params: PlatformFinanceFilters = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get<{ status: string; data: PlatformFinanceSummary }>(`/finance/summary${qs ? '?' + qs : ''}`);
};

export const getInvoices = (params: PlatformFinanceFilters = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get(`/finance/invoices${qs ? '?' + qs : ''}`);
};

export const downloadInvoicePdf = (id: string) => get(`/finance/invoices/${id}/pdf`);
export const exportInvoicesCsv  = (params: PlatformFinanceFilters = {}) => post('/finance/invoices/export', params);

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface PlatformGrowthAnalyticsSummary {
  totalTenants: number;
  total_tenants?: number;
  monthsTracked: number;
  months_tracked?: number;
  newThisMonth: number;
  new_this_month?: number;
  totalRevenue?: number;
  total_revenue?: number;
  activeTenants?: number;
  active_tenants?: number;
  avgRevenuePerTenant?: number;
  avg_revenue_per_tenant?: number;
}

export interface PlatformGeographyItem {
  country: string;
  tenant_count: number;
  student_count: number;
}

export interface PlatformGrowthAnalyticsTenantPoint {
  month: string;
  monthLabel?: string;
  new_tenants: number;
  newTenants?: number;
  cumulative_tenants: number;
  cumulativeTenants?: number;
}

export interface PlatformGrowthAnalyticsResponse {
  summary?: PlatformGrowthAnalyticsSummary;
  tenant_growth?: PlatformGrowthAnalyticsTenantPoint[];
  tenantGrowth?: PlatformGrowthAnalyticsTenantPoint[];
  revenue_growth: PlatformFinanceTrendPoint[];
  revenueGrowth?: PlatformFinanceTrendPoint[];
}

export const getGrowthAnalytics   = (params: PlatformFinanceFilters = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get<{ status: string; data: PlatformGrowthAnalyticsResponse }>(`/analytics/growth${qs ? '?' + qs : ''}`);
};
export const getGeographyAnalytics = () => get<{ status: string; data: PlatformGeographyItem[] }>('/analytics/geography');
export interface PlatformLeaderboardItem {
  id: string;
  name: string;
  value: number;
  displayValue: string;
  progressPercent: number;
}

export const getLeaderboard       = (params: Record<string, unknown> = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get<{ status: string; data: PlatformLeaderboardItem[] }>(`/analytics/leaderboard${qs ? '?' + qs : ''}`);
};

// ─── Settings ────────────────────────────────────────────────────────────────

export const getSettings            = ()                                   => get('/settings');
export const updateSettings         = (data: Record<string, unknown>)      => put('/settings', data);
export const getTeam                = ()                                   => get('/team');
export const inviteTeamMember       = (data: Record<string, unknown>)      => post('/team/invite', data);
export const removeTeamMember       = (id: number)                        => del(`/team/${id}`);
export const changeTeamMemberRole   = (id: number, role: string)          => put(`/team/${id}/role`, { role });
export const resendTeamInvite       = (id: number)                        => post(`/team/${id}/resend-invite`);
export const deactivateTeamMember   = (id: number)                        => post(`/team/${id}/deactivate`);

// ─── Account ─────────────────────────────────────────────────────────────────

export const updateAccount  = (data: { name: string; email: string }) => put('/account', data);
export const updatePassword = (data: { current_password: string; new_password: string; new_password_confirmation: string }) =>
  put('/account/password', data);

// ─── Login History ───────────────────────────────────────────────────────────

export const getLoginHistory = () => get('/auth/login-history');

// ─── Accept Invite (public) ──────────────────────────────────────────────────

export const acceptInvite = (token: string, password: string, password_confirmation: string) =>
  post('/auth/accept-invite', { token, password, password_confirmation });

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export const getAuditLog = (params: Record<string, unknown> = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get(`/audit${qs ? '?' + qs : ''}`);
};

export const exportAuditLog = (filters: Record<string, unknown> = {}) =>
  post<Blob>('/audit/export', filters);

// ─── System Error Logs ───────────────────────────────────────────────────────

export interface SystemErrorLog {
  id: string;
  correlation_id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  user_id: string | null;
  exception_class: string;
  message: string;
  stack_trace: string | null;
  request_uri: string;
  request_method: string;
  ip_address: string;
  created_at: string;
}

export interface SystemErrorLogFilters {
  search?: string;
  tenant_id?: string;
  from_date?: string;
  to_date?: string;
  exception_class?: string;
  page?: number;
  per_page?: number;
}

export const getSystemErrors = (params: SystemErrorLogFilters = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get<{ status: string; data: SystemErrorLog[]; meta?: Record<string, unknown> }>(
    `/system-errors${qs ? '?' + qs : ''}`
  );
};

export const getSystemError = (correlationId: string) =>
  get<{ status: string; data: SystemErrorLog }>(`/system-errors/${correlationId}`);

// ─── Demo Requests ────────────────────────────────────────────────────────────

export interface DemoRequest {
  id: string;
  school_name: string;
  email: string;
  school_address: string;
  estimated_students: number;
  status: 'new' | 'contacted' | 'converted' | 'dismissed';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DemoRequestsResponse {
  data: DemoRequest[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    new_count: number;
  };
}

export interface DemoRequestFilters {
  status?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const getDemoRequests = (params: DemoRequestFilters = {}) => {
  const qs = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => [k, String(v)])
    )
  ).toString();
  return get<{ status: string; data: DemoRequestsResponse }>(`/demo-requests${qs ? '?' + qs : ''}`);
};

export const getDemoRequest = (id: string) =>
  get<{ status: string; data: DemoRequest }>(`/demo-requests/${id}`);

export const updateDemoRequest = (id: string, data: { status?: string; notes?: string }) =>
  request<{ status: string; data: DemoRequest }>('PATCH', `/demo-requests/${id}`, data);

export const deleteDemoRequest = (id: string) =>
  del(`/demo-requests/${id}`);
