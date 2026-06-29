import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Building2, CalendarClock, Check, CreditCard, Edit2,
  HelpCircle, Infinity, Layers, MoreHorizontal, Plus, Power, RefreshCw,
  Search, Star, Trash2, TrendingUp, Users, XCircle,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { PageHeader } from "../components/admin/PageHeader";
import { StatCard } from "../components/admin/StatCard";
import { StatusBadge } from "../components/admin/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getPlans, getSubscriptions, getTenants,
  getFinanceSummary, type PlatformFinanceSummary,
  updatePlan, deletePlan, cancelSubscription, assignSubscription,
} from "@/api/platform";

type Plan = {
  id: string;
  name: string;
  description: string | null;
  max_students: number | null;
  monthly_price_cents: number;
  annual_price_cents: number;
  annual_discount_pct: number;
  monthly_price: number;
  annual_price: number;
  currency: string;
  is_active: number;
  sort_order: number;
  subscriber_count: number;
};

type Subscription = {
  id: string;
  tenant_id: string;
  tenant_name: string | null;
  tenant_email: string | null;
  plan_id: string;
  plan_name: string | null;
  monthly_price: number;
  annual_price: number;
  billing_cycle: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  cancelled_at: string | null;
  max_students: number | null;
  payment_status: string | null;
  alerts: string[];
  pending_plan_id?: string | null;
  pending_change_effective_at?: string | null;
  pending_change_type?: string | null;
};

function formatPrice(dollars: number, cycle: 'mo' | 'yr'): string {
  if (!dollars || dollars === 0) return 'Free';
  const n = Math.round(dollars * 100) / 100;
  const s = Number.isInteger(n) ? `$${n}` : `$${parseFloat(n.toFixed(2))}`;
  return `${s}/${cycle}`;
}

const ALERT_LABELS: Record<string, string> = {
  payment_failed: 'Payment Failed',
  expiring_soon:  'Expiring Soon',
  trial_ending:   'Trial Ending',
};

type Tenant = { id: string; name: string | null; email: string | null; settings?: string | null };

const emptyPlanForm = {
  id: "", name: "", description: "", monthly_price_cents: "",
  annual_discount_pct: "17", max_students: "", sort_order: "0", is_active: true,
};

const todayStr    = () => new Date().toISOString().slice(0, 10);
const oneYearStr  = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
const emptyAssign = { tenant_id: "", plan_id: "", billing_cycle: "monthly" as "monthly" | "annual", starts_at: todayStr(), expires_at: oneYearStr() };

const STATUS_FILTERS = ["all", "active", "expired", "cancelled", "pending", "superseded"] as const;

export default function Subscriptions() {
  const qc = useQueryClient();

  const [planDialog, setPlanDialog]   = useState<{ open: boolean; editing: Plan | null }>({ open: false, editing: null });
  const [planForm,   setPlanForm]     = useState(emptyPlanForm);
  const [assignOpen, setAssignOpen]   = useState(false);
  const [assignForm, setAssignForm]   = useState(emptyAssign);
  const [page,              setPage]             = useState(1);
  const [statusFilter,       setStatusFilter]      = useState<string>("active");
  const [search,             setSearch]            = useState("");
  const [planFilter,         setPlanFilter]        = useState("");
  const [cycleFilter,        setCycleFilter]       = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [expiringSoon,       setExpiringSoon]      = useState(false);

  const debouncedSearch = useDebounce(search, 400);

  // ── Queries ────────────────────────────────────────────────────────────────
  const plansQ = useQuery({
    queryKey: ["platform-plans"],
    queryFn:  () => getPlans().then((r: any) => r.data.data as Plan[]),
  });

  const financeSummaryQ = useQuery({
    queryKey: ["platform-finance-summary"],
    queryFn: () => getFinanceSummary().then((r) => r.data.data as PlatformFinanceSummary),
  });

  const subsQ = useQuery({
    queryKey: ["platform-subscriptions", page, statusFilter, debouncedSearch, planFilter, cycleFilter, paymentStatusFilter, expiringSoon],
    queryFn:  () => getSubscriptions({
      page, limit: 25,
      ...(statusFilter !== "all" ? { status: statusFilter } : {}),
      ...(debouncedSearch        ? { q: debouncedSearch }   : {}),
      ...(planFilter             ? { plan_id: planFilter }  : {}),
      ...(cycleFilter            ? { billing_cycle: cycleFilter } : {}),
      ...(paymentStatusFilter    ? { payment_status: paymentStatusFilter } : {}),
      ...(expiringSoon           ? { expiring_soon: true }  : {}),
    }).then((r: any) => r.data),
  });

  const tenantsQ = useQuery({
    queryKey: ["platform-tenants-all"],
    queryFn:  () => getTenants({ limit: 200 }).then((r: any) => r.data.data as Tenant[]),
    enabled:  assignOpen,
  });

  const plans: Plan[]         = [...(plansQ.data ?? [])].sort((a, b) => a.monthly_price_cents - b.monthly_price_cents);
  const subs:  Subscription[] = subsQ.data?.data ?? [];
  const meta                  = subsQ.data?.meta;
  const tenants: Tenant[]       = tenantsQ.data ?? [];
  const selectedTenantActiveAnnual = subs.some(
    (s) => s.tenant_id === assignForm.tenant_id && s.status === "active" && s.billing_cycle === "annual",
  );

  // ── Derived stats ──────────────────────────────────────────────────────────
  const totalSubs          = meta?.total ?? subs.length;
  const activeSubs         = meta?.active_count ?? 0;
  const fs                 = financeSummaryQ.data;
  const mrr                = fs?.mrr ?? 0;
  const failedPayments     = fs?.failed_payments_count ?? 0;
  const renewalsDue        = fs?.renewals_due_count ?? 0;
  const mostPopularId = plans.reduce<string | null>((id, p) =>
    (id === null || p.subscriber_count > (plans.find((x) => x.id === id)?.subscriber_count ?? 0)) ? p.id : id, null);

  const hasActiveFilters = debouncedSearch !== '' || planFilter !== '' || cycleFilter !== '' || paymentStatusFilter !== '' || expiringSoon;

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ["platform-plans"] });
    qc.invalidateQueries({ queryKey: ["platform-finance-summary"] });
    qc.invalidateQueries({ queryKey: ["platform-subscriptions"] });
  }

  function clearFilters() {
    setSearch('');
    setPlanFilter('');
    setCycleFilter('');
    setPaymentStatusFilter('');
    setExpiringSoon(false);
    setPage(1);
  }

  function openAssignForTenant(tenantId: string) {
    setAssignForm((f) => ({ ...f, tenant_id: tenantId }));
    setAssignOpen(true);
  }

  // ── Mutations ──────────────────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => updatePlan(id as any, data),
    onSuccess: () => {
      toast.success("Plan updated");
      setPlanDialog({ open: false, editing: null });
      qc.invalidateQueries({ queryKey: ["platform-plans"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      updatePlan(id as any, { is_active: active ? 1 : 0 }),
    onSuccess: (_d, vars) => {
      toast.success(vars.active ? "Plan activated" : "Plan deactivated");
      qc.invalidateQueries({ queryKey: ["platform-plans"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deletePlan(id as any),
    onSuccess: () => { toast.success("Plan deleted"); qc.invalidateQueries({ queryKey: ["platform-plans"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => cancelSubscription(id as any),
    onSuccess: () => {
      toast.success("Subscription cancelled");
      qc.invalidateQueries({ queryKey: ["platform-subscriptions"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const assignMut = useMutation({
    mutationFn: (data: typeof emptyAssign) => assignSubscription(data),
    onSuccess: () => {
      toast.success("Subscription assigned");
      setAssignOpen(false);
      setAssignForm({ ...emptyAssign, starts_at: todayStr(), expires_at: oneYearStr() });
      qc.invalidateQueries({ queryKey: ["platform-subscriptions"] });
      qc.invalidateQueries({ queryKey: ["platform-plans"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to assign subscription"),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  function openEdit(plan: Plan) {
    setPlanForm({
      id:                  plan.id,
      name:                plan.name,
      description:         plan.description ?? "",
      monthly_price_cents: String(plan.monthly_price_cents),
      annual_discount_pct: String(plan.annual_discount_pct ?? 17),
      max_students:        plan.max_students != null ? String(plan.max_students) : "",
      sort_order:          String(plan.sort_order),
      is_active:           Number(plan.is_active) === 1,
    });
    setPlanDialog({ open: true, editing: plan });
  }

  function submitPlan() {
    if (!planDialog.editing) return;
    updateMut.mutate({
      id: planDialog.editing.id,
      data: {
        name:                planForm.name,
        description:         planForm.description || null,
        max_students:        planForm.max_students ? parseInt(planForm.max_students) : null,
        monthly_price_cents: planForm.monthly_price_cents ? parseInt(planForm.monthly_price_cents) : 0,
        annual_discount_pct: planForm.annual_discount_pct ? parseFloat(planForm.annual_discount_pct) : 17,
        sort_order:          parseInt(planForm.sort_order) || 0,
        is_active:           planForm.is_active ? 1 : 0,
      },
    });
  }

  function submitAssign() {
    if (!assignForm.tenant_id || !assignForm.plan_id) {
      toast.error("Please select a tenant and plan.");
      return;
    }
    if (assignForm.expires_at <= assignForm.starts_at) {
      toast.error("End date must be after start date.");
      return;
    }
    if (selectedTenantActiveAnnual && assignForm.billing_cycle === "monthly") {
      toast.error("Annual subscriptions cannot be converted to monthly billing.");
      return;
    }
    assignMut.mutate(assignForm);
  }

  function getTenantLabel(t: Tenant): string {
    if (t.name) return t.name;
    if (t.settings) {
      try { const s = JSON.parse(t.settings); if (s?.schoolName) return s.schoolName; } catch { /**/ }
    }
    return t.email ?? t.id;
  }

  // ── Computed for edit plan dialog annual preview ───────────────────────────
  const monthlyCents    = parseInt(planForm.monthly_price_cents) || 0;
  const fullAnnualCents = monthlyCents * 12;
  const discountPct     = parseFloat(planForm.annual_discount_pct) || 0;
  const discountCents   = Math.round(fullAnnualCents * discountPct / 100);
  const finalAnnual     = fullAnnualCents - discountCents;

  return (
    <TooltipProvider>
    <div className="space-y-8">
      {/* ── Header ── */}
      <PageHeader
        title="Subscriptions & Plans"
        description="Manage pricing tiers and active subscriptions across all tenants."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={plansQ.isFetching || financeSummaryQ.isFetching || subsQ.isFetching}>
              <RefreshCw className={cn("mr-2 h-4 w-4", (plansQ.isFetching || financeSummaryQ.isFetching || subsQ.isFetching) && "animate-spin")} />
              Refresh
            </Button>
            <Button onClick={() => setAssignOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Assign subscription
            </Button>
          </>
        }
      />

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        {financeSummaryQ.isLoading || subsQ.isLoading || plansQ.isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <div><StatCard
                  label="Active Schools"
                  value={financeSummaryQ.isError ? "—" : String(activeSubs)}
                  icon={Building2}
                  tone="success"
                  subtitle={financeSummaryQ.isError ? "unavailable" : "with active subscription"}
                /></div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Schools with a currently active subscription (not expired or cancelled).
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div><StatCard
                  label="MRR"
                  value={financeSummaryQ.isError ? "—" : (mrr === 0 ? "$0" : `$${Number.isInteger(mrr) ? mrr : parseFloat(mrr.toFixed(2))}`)}
                  icon={TrendingUp}
                  tone="primary"
                  subtitle={financeSummaryQ.isError ? "unavailable" : "monthly recurring revenue"}
                /></div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Monthly Recurring Revenue across all active subscriptions. Annual subscribers are normalised to monthly.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div><StatCard
                  label="Failed Payments"
                  value={financeSummaryQ.isError ? "—" : String(failedPayments)}
                  icon={AlertTriangle}
                  tone="danger"
                  subtitle={financeSummaryQ.isError ? "unavailable" : "active subs with failed payment"}
                /></div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Active subscriptions whose most recent payment transaction has status "failed".
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div><StatCard
                  label="Renewals Due"
                  value={financeSummaryQ.isError ? "—" : String(renewalsDue)}
                  icon={CalendarClock}
                  tone="warning"
                  subtitle={financeSummaryQ.isError ? "unavailable" : "expiring within 30 days"}
                /></div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Active subscriptions whose expiry date falls within the next 30 days.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div><StatCard
                  label="Pricing Plans"
                  value={plansQ.isError ? "—" : String(plans.length)}
                  icon={Layers}
                  tone="info"
                  subtitle={plansQ.isError ? "unavailable" : `${plans.filter(p => Number(p.is_active)).length} active`}
                /></div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                Total pricing tiers configured. Inactive (retired) plans are hidden from new subscriptions.
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="subscriptions" className="mt-2">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Pricing Plans</TabsTrigger>
        </TabsList>

        {/* ── Subscriptions tab ── */}
        <TabsContent value="subscriptions" className="mt-6">
          <Card className="shadow-card">
            <CardHeader className="border-b px-6 py-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">All Subscriptions</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {meta?.total ?? "…"} records across all tenants
                    </p>
                  </div>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start sm:self-auto">
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Clear filters
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search school name or email…"
                      className="pl-8 h-8 text-sm"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-8 w-36 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTERS.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">
                          {s === "all" ? "All statuses" : s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={planFilter || "_all"} onValueChange={(v) => { setPlanFilter(v === "_all" ? "" : v); setPage(1); }}>
                    <SelectTrigger className="h-8 w-36 text-sm">
                      <SelectValue placeholder="All plans" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All plans</SelectItem>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={cycleFilter || "_all"} onValueChange={(v) => { setCycleFilter(v === "_all" ? "" : v); setPage(1); }}>
                    <SelectTrigger className="h-8 w-32 text-sm">
                      <SelectValue placeholder="All cycles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All cycles</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={paymentStatusFilter || "_all"} onValueChange={(v) => { setPaymentStatusFilter(v === "_all" ? "" : v); setPage(1); }}>
                    <SelectTrigger className="h-8 w-36 text-sm">
                      <SelectValue placeholder="Payment health" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_all">All payments</SelectItem>
                      <SelectItem value="completed">Paid</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="initiated">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant={expiringSoon ? "default" : "outline"}
                    size="sm"
                    className="h-8 text-sm"
                    onClick={() => { setExpiringSoon((v) => !v); setPage(1); }}
                  >
                    <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                    Expiring Soon
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>School</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        Status
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="font-semibold mb-1">Status meanings:</p>
                            <ul className="space-y-0.5 text-xs">
                              <li><span className="font-medium">Active</span> — current and valid</li>
                              <li><span className="font-medium">Expired</span> — end date has passed</li>
                              <li><span className="font-medium">Cancelled</span> — manually terminated</li>
                              <li><span className="font-medium">Pending</span> — awaiting activation</li>
                              <li><span className="font-medium">Superseded</span> — replaced by newer assignment</li>
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </span>
                    </TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        Renewal
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            Expiry / renewal date. Amber when due within 30 days.
                          </TooltipContent>
                        </Tooltip>
                      </span>
                    </TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>
                      <span className="inline-flex items-center gap-1">
                        Seats
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            Maximum students allowed on this plan. Unlimited = no cap.
                          </TooltipContent>
                        </Tooltip>
                      </span>
                    </TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subsQ.isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : subs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <CreditCard className="h-8 w-8 text-muted-foreground/30" />
                          {hasActiveFilters ? (
                            <>
                              <p className="text-sm text-muted-foreground">No subscriptions match your filters.</p>
                              <Button variant="ghost" size="sm" onClick={clearFilters} className="mt-1 h-7 text-xs">
                                Clear filters
                              </Button>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">No subscriptions found</p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    subs.map((s) => {
                      const expiresAt  = s.expires_at ? new Date(s.expires_at) : null;
                      const daysToExp  = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000) : null;
                      const urgentExp  = daysToExp !== null && daysToExp <= 30 && s.status === 'active';
                      const isActive   = s.status === 'active';
                      const isInactive = ['cancelled', 'expired', 'superseded'].includes(s.status);
                      return (
                        <TableRow key={s.id}>
                          <TableCell>
                            <p className="font-medium leading-none">{s.tenant_name ?? s.tenant_id}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{s.tenant_email}</p>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">{s.plan_name ?? "—"}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {s.billing_cycle}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={s.status} />
                              {(s.alerts ?? []).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {s.alerts.map((a) => (
                                    <StatusBadge
                                      key={a}
                                      status={ALERT_LABELS[a] ?? a}
                                      className="text-[10px] py-0"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            {expiresAt ? (
                              <span className={cn(urgentExp && "font-medium text-amber-600 dark:text-amber-400")}>
                                {expiresAt.toLocaleDateString()}
                                {urgentExp && daysToExp !== null && (
                                  <span className="ml-1 text-[10px]">({daysToExp}d)</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">No expiry</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {s.payment_status ? (
                              <StatusBadge status={s.payment_status} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {s.max_students != null
                              ? s.max_students.toLocaleString()
                              : <span className="inline-flex items-center gap-1"><Infinity className="h-3 w-3" /> Unlimited</span>
                            }
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums text-sm">
                            {s.billing_cycle === "annual"
                              ? formatPrice(s.annual_price, 'yr')
                              : formatPrice(s.monthly_price, 'mo')}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openAssignForTenant(s.tenant_id)}
                                >
                                  <CreditCard className="mr-2 h-4 w-4" />
                                  {isInactive ? 'Re-activate' : 'Assign / Reassign Plan'}
                                </DropdownMenuItem>
                                {isActive && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      disabled={cancelMut.isPending}
                                      onClick={() => {
                                        if (confirm("Cancel this subscription? This cannot be undone."))
                                          cancelMut.mutate(s.id);
                                      }}
                                    >
                                      <XCircle className="mr-2 h-4 w-4" />
                                      Cancel subscription
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t px-6 py-3 text-sm text-muted-foreground">
                <span>{meta ? `${subs.length} of ${meta.total}` : "Loading…"}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={!meta || page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Plans tab ── */}
        <TabsContent value="plans" className="mt-6">
          {plansQ.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
            </div>
          ) : plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-20 text-center">
              <CreditCard className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No pricing plans configured.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {plans.map((tier) => {
                const isPopular  = tier.id === mostPopularId && tier.subscriber_count > 0;
                const isActive   = Number(tier.is_active) === 1;
                return (
                  <Card
                    key={tier.id}
                    className={cn(
                      "relative flex flex-col shadow-card transition-all hover:shadow-elegant",
                      isPopular && "border-primary/40 ring-1 ring-primary/20",
                      !isActive  && "opacity-60",
                    )}
                  >
                    {/* Popular badge */}
                    {isPopular && (
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <Badge className="gap-1 bg-primary px-2.5 py-0.5 text-[11px] text-primary-foreground shadow">
                          <Star className="h-3 w-3 fill-current" /> Most popular
                        </Badge>
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-5">
                      {/* Plan name + retired badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold">{tier.name}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {tier.description ?? "No description"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {!isActive && <Badge variant="secondary" className="text-xs">Retired</Badge>}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem onClick={() => openEdit(tier)}>
                                    <Edit2 className="mr-2 h-4 w-4" /> Edit plan
                                  </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  Update pricing, discount, student limit, or description for this plan.
                                </TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      const next = !isActive;
                                      if (confirm(next
                                        ? `Activate "${tier.name}"?`
                                        : `Deactivate "${tier.name}"? It won't be available for new subscriptions.`))
                                        toggleActiveMut.mutate({ id: tier.id, active: next });
                                    }}
                                  >
                                    <Power className="mr-2 h-4 w-4" />
                                    {isActive ? "Deactivate" : "Activate"}
                                  </DropdownMenuItem>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  {isActive
                                    ? "Hides this plan from new subscriptions. Existing subscribers are not affected."
                                    : "Makes this plan available for new subscriptions again."}
                                </TooltipContent>
                              </Tooltip>
                              {tier.subscriber_count === 0 && (
                                <>
                                  <DropdownMenuSeparator />
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => {
                                          if (confirm(`Permanently delete "${tier.name}"?`))
                                            deleteMut.mutate(tier.id);
                                        }}
                                      >
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete plan
                                      </DropdownMenuItem>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs">
                                      Permanently removes this plan. Only available when there are no active subscribers.
                                    </TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {/* Price */}
                      <div className="mt-4">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold tabular-nums">
                            {formatPrice(tier.monthly_price ?? (tier.monthly_price_cents / 100), 'mo').replace('/mo', '')}
                          </span>
                          <span className="text-sm text-muted-foreground">/mo</span>
                        </div>
                        {Number(tier.annual_price) > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {formatPrice(tier.annual_price ?? (tier.annual_price_cents / 100), 'yr')}
                            {Number(tier.annual_discount_pct) > 0 && (
                              <span className="ml-1.5 font-medium text-green-600 dark:text-green-400">
                                {(() => { const d = Number(tier.annual_discount_pct); return `(${Number.isInteger(d) ? d : parseFloat(d.toFixed(1))}% off)`; })()}
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Features */}
                      <ul className="mt-4 flex-1 space-y-2 text-sm">
                        <li className="flex items-center gap-2">
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                          {tier.max_students
                            ? <span>Up to <strong>{tier.max_students.toLocaleString()}</strong> students</span>
                            : <span className="flex items-center gap-1"><Infinity className="h-3.5 w-3.5" /> Unlimited students</span>
                          }
                        </li>
                      </ul>

                      {/* Subscriber count footer */}
                      <div className="mt-4 flex items-center gap-2 border-t pt-4 text-sm text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          <strong className="text-foreground">{tier.subscriber_count}</strong> active subscriber{tier.subscriber_count !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Assign subscription dialog ── */}
      <Dialog
        open={assignOpen}
        onOpenChange={(o) => {
          setAssignOpen(o);
          if (!o) setAssignForm({ ...emptyAssign, starts_at: todayStr(), expires_at: oneYearStr() });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign subscription</DialogTitle>
            <DialogDescription>
              Manually place a tenant on a plan for a custom date range. Any existing active subscription will be superseded.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            {/* Tenant */}
            <div className="grid gap-1.5">
              <Label>Tenant</Label>
              {tenantsQ.isLoading ? (
                <Skeleton className="h-9 w-full rounded-md" />
              ) : (
                <Select value={assignForm.tenant_id} onValueChange={(v) => setAssignForm((f) => {
                  const hasAnnual = subs.some((s) => s.tenant_id === v && s.status === "active" && s.billing_cycle === "annual");
                  return { ...f, tenant_id: v, billing_cycle: hasAnnual ? "annual" : f.billing_cycle };
                })}>
                  <SelectTrigger><SelectValue placeholder="Select a school…" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{getTenantLabel(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Plan */}
            <div className="grid gap-1.5">
              <Label>Plan</Label>
              <Select value={assignForm.plan_id} onValueChange={(v) => setAssignForm((f) => ({ ...f, plan_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a plan…" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {formatPrice(p.monthly_price ?? (p.monthly_price_cents / 100), 'mo')}
                      {p.annual_price > 0 && ` or ${formatPrice(p.annual_price ?? (p.annual_price_cents / 100), 'yr')}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Billing cycle */}
            <div className="grid gap-1.5">
              <Label>Billing cycle</Label>
              <Select
                value={assignForm.billing_cycle}
                onValueChange={(v: "monthly" | "annual") => setAssignForm((f) => ({ ...f, billing_cycle: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {!selectedTenantActiveAnnual && <SelectItem value="monthly">Monthly</SelectItem>}
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
              {selectedTenantActiveAnnual && (
                <p className="text-xs text-muted-foreground">
                  This tenant has an active annual subscription, so monthly assignment is blocked.
                </p>
              )}
            </div>

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Start date</Label>
                <Input type="date" value={assignForm.starts_at}
                  onChange={(e) => setAssignForm((f) => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>End date</Label>
                <Input type="date" value={assignForm.expires_at} min={assignForm.starts_at}
                  onChange={(e) => setAssignForm((f) => ({ ...f, expires_at: e.target.value }))} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button
              onClick={submitAssign}
              disabled={assignMut.isPending || !assignForm.tenant_id || !assignForm.plan_id}
            >
              {assignMut.isPending ? "Assigning…" : "Assign subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit plan dialog ── */}
      <Dialog open={planDialog.open} onOpenChange={(o) => setPlanDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit plan</DialogTitle>
          </DialogHeader>
          {planDialog.editing && (
            <div className="grid gap-4 py-1">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input placeholder="Starter" value={planForm.name}
                  onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>Description</Label>
                <Input placeholder="Brief description" value={planForm.description}
                  onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Monthly price <span className="text-xs text-muted-foreground">(cents)</span></Label>
                  <Input type="number" min="0" placeholder="1500" value={planForm.monthly_price_cents}
                    onChange={(e) => setPlanForm((f) => ({ ...f, monthly_price_cents: e.target.value }))} />
                  {monthlyCents > 0 && (
                    <p className="text-xs text-muted-foreground">${(monthlyCents / 100).toFixed(2)}/mo</p>
                  )}
                </div>
                <div className="grid gap-1.5">
                  <Label>Annual discount <span className="text-xs text-muted-foreground">(%)</span></Label>
                  <Input type="number" min="0" max="100" step="0.5" placeholder="17" value={planForm.annual_discount_pct}
                    onChange={(e) => setPlanForm((f) => ({ ...f, annual_discount_pct: e.target.value }))} />
                </div>
              </div>
              {monthlyCents > 0 && (
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Annual (full)</span><span>${(fullAnnualCents / 100).toFixed(2)}/yr</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span className="text-destructive">−${(discountCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="mt-1.5 flex justify-between border-t pt-1.5 font-semibold">
                    <span>Annual price</span>
                    <span className="text-primary">${(finalAnnual / 100).toFixed(2)}/yr</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Max students <span className="text-xs text-muted-foreground">(blank = unlimited)</span></Label>
                  <Input type="number" placeholder="300" value={planForm.max_students}
                    onChange={(e) => setPlanForm((f) => ({ ...f, max_students: e.target.value }))} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Sort order</Label>
                  <Input type="number" placeholder="0" value={planForm.sort_order}
                    onChange={(e) => setPlanForm((f) => ({ ...f, sort_order: e.target.value }))} />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={planForm.is_active as boolean}
                  onChange={(e) => setPlanForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-input"
                />
                Active plan
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog((d) => ({ ...d, open: false }))}>Cancel</Button>
            <Button onClick={submitPlan} disabled={updateMut.isPending || !planForm.name}>
              {updateMut.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
