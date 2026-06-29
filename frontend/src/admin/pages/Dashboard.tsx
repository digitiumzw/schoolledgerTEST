import { useState } from "react";
import {
  Building2, CreditCard, DollarSign, TrendingDown, ArrowUpRight, AlertTriangle,
  UserPlus, XCircle, RefreshCw, Activity, Clock, AlertCircle, Power, PowerOff,
  Trash2, Settings, FileText, LogIn, ShieldAlert, Ban, CheckCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "../components/admin/PageHeader";
import { StatCard } from "../components/admin/StatCard";
import { StatusBadge } from "../components/admin/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getDashboardKpis,
  getDashboardRevenue,
  getDashboardPlans,
  getDashboardActivity,
} from "@/api/platform";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend,
  Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis,
} from "recharts";

const PIE_COLORS = [
  "hsl(var(--muted-foreground))",
  "hsl(var(--info))",
  "hsl(var(--primary))",
  "hsl(215 28% 17%)",   // deep slate for enterprise tier
];

const actionIconMap: Record<string, { icon: typeof UserPlus; tone: string; label: string }> = {
  // Tenant operations
  "platform.tenant.provision":         { icon: Building2,      tone: "bg-success-soft text-success",         label: "School provisioned" },
  "platform.tenant.create":            { icon: UserPlus,        tone: "bg-success-soft text-success",         label: "New school signed up" },
  "platform.tenant.suspend":           { icon: Ban,             tone: "bg-warning-soft text-warning",         label: "School suspended" },
  "platform.tenant.reactivate":        { icon: CheckCircle,     tone: "bg-success-soft text-success",         label: "School reactivated" },
  "platform.tenant.delete":            { icon: Trash2,          tone: "bg-destructive/10 text-destructive",   label: "School deleted" },
  "platform.tenant.delete_refused":    { icon: ShieldAlert,     tone: "bg-warning-soft text-warning",         label: "School deletion blocked" },
  // Subscription operations
  "platform.subscription.assign":      { icon: CreditCard,       tone: "bg-primary/10 text-primary",           label: "Subscription assigned" },
  "platform.subscription.change_plan": { icon: ArrowUpRight,    tone: "bg-primary/10 text-primary",           label: "Plan changed" },
  "platform.subscription.cancel":      { icon: XCircle,         tone: "bg-muted text-muted-foreground",       label: "Subscription cancelled" },
  // Plan operations
  "platform.plan.create":              { icon: FileText,         tone: "bg-info-soft text-info",               label: "Pricing plan created" },
  "platform.plan.update":              { icon: Settings,         tone: "bg-info-soft text-info",               label: "Pricing plan updated" },
  "platform.plan.delete":              { icon: Trash2,           tone: "bg-destructive/10 text-destructive",   label: "Pricing plan deleted" },
  // Authentication & admin
  "platform.login":                    { icon: LogIn,            tone: "bg-muted text-muted-foreground",       label: "Admin login" },
  "platform.impersonate":              { icon: ShieldAlert,     tone: "bg-warning-soft text-warning",         label: "Impersonation started" },
  "platform.stop_impersonation":       { icon: ShieldAlert,     tone: "bg-muted text-muted-foreground",       label: "Impersonation ended" },
};

function formatMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("default", { month: "short" });
}

function timeAgo(iso: string) {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return "unknown time";

  const diff = Date.now() - timestamp;
  const min  = Math.floor(diff / 60000);
  if (min < 1)   return "just now";
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {hint && <span className="hidden text-xs text-muted-foreground/70 sm:inline">{hint}</span>}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function CustomRevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-md">
      <p className="font-semibold">{label}</p>
      <p className="text-primary">Revenue: <span className="font-bold">${payload[0].value.toLocaleString()}</span></p>
    </div>
  );
}

function PlanTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card p-3 text-sm shadow-md">
      <p className="font-semibold">{name}</p>
      <p className="text-muted-foreground">{value} active tenant{value !== 1 ? "s" : ""}</p>
    </div>
  );
}

export default function Dashboard() {
  const kpis     = useQuery({ queryKey: ["platform-kpis"],       queryFn: () => getDashboardKpis().then((r: any) => r.data.data) });
  const revenue  = useQuery({ queryKey: ["platform-revenue"],    queryFn: () => getDashboardRevenue().then((r: any) => r.data.data) });
  const plans    = useQuery({ queryKey: ["platform-plans-dist"], queryFn: () => getDashboardPlans().then((r: any) => r.data.data) });
  const activity = useQuery({ queryKey: ["platform-activity"],   queryFn: () => getDashboardActivity().then((r: any) => r.data.data) });

  const revenueData  = (Array.isArray(revenue.data) ? revenue.data : []).map((r: any) => ({ month: formatMonth(r.month), revenue: parseFloat(r.revenue) }));
  const plansData    = (Array.isArray(plans.data) ? plans.data : []).map((p: any) => ({ name: p.name, value: parseInt(p.subscriber_count) })).filter((p: any) => p.value > 0);
  const activityData = Array.isArray(activity.data) ? activity.data : [];

  const kd = kpis.data;

  // Derive a simple health score from KPI data
  const totalTenants    = kd?.total_tenants     ?? 0;
  const activeTenants   = kd?.active_tenants    ?? 0;
  const suspendedCount  = kd?.suspended_tenants ?? 0;
  const activeRatio     = totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 0;

  const [refreshing, setRefreshing] = useState(false);
  async function refetchAll() {
    setRefreshing(true);
    try {
      await Promise.all([kpis.refetch(), revenue.refetch(), plans.refetch(), activity.refetch()]);
    } catch (error: unknown) {
      toast.error((error as { message?: string })?.message ?? "Failed to refresh dashboard");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Snapshot of platform health, revenue and tenant activity."
        actions={
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      {/* KPI stat cards */}
      <section className="space-y-3">
      <SectionLabel title="Key metrics" hint="Live platform snapshot" />
      <TooltipProvider>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div><StatCard
                    label="Schools Ever Registered"
                    value={(kd?.total_tenants ?? 0).toString()}
                    subtitle="Lifetime registered schools"
                    icon={Building2}
                    tone="primary"
                  /></div>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Cumulative total of every school tenant ever registered on the platform, including active, inactive, suspended, trialing, cancelled, and deleted tenants.</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div><StatCard
                    label="Active Subscriptions"
                    value={(kd?.active_tenants ?? 0).toString()}
                    subtitle={totalTenants > 0 ? `${activeRatio}% of all tenants` : "No tenants yet"}
                    icon={CreditCard}
                    tone="info"
                  /></div>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Schools with a currently active subscription. Excludes trialing, suspended, and cancelled tenants.</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div><StatCard
                    label="MRR"
                    value={`$${(kd?.mrr ?? 0).toLocaleString()}`}
                    subtitle="Monthly recurring revenue"
                    icon={DollarSign}
                    tone="success"
                  /></div>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Monthly Recurring Revenue from all active subscriptions. Annual plans are divided by 12.</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div><StatCard
                    label="Suspended"
                    value={(kd?.suspended_tenants ?? 0).toString()}
                    subtitle={suspendedCount > 0 ? "Needs attention" : "All clear"}
                    icon={TrendingDown}
                    tone={suspendedCount > 0 ? "danger" : "warning"}
                  /></div>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Schools whose access has been suspended, typically due to non-payment or admin action.</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div><StatCard
                    label="Total Revenue"
                    value={`$${(kd?.total_revenue ?? 0).toLocaleString()}`}
                    subtitle="Lifetime paid invoices"
                    icon={Activity}
                    tone="info"
                  /></div>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">Total lifetime revenue from all paid subscription invoices across all tenants.</p></TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </TooltipProvider>
      </section>

      {/* Charts row */}
      <section className="space-y-3">
      <SectionLabel title="Revenue & plans" hint="Trends over the last 12 months" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Revenue trend</CardTitle>
              <p className="text-xs text-muted-foreground">Monthly invoiced revenue — last 12 months</p>
            </div>
          </CardHeader>
          <CardContent>
            {revenue.isLoading ? (
              <Skeleton className="h-[280px] w-full" />
            ) : revenueData.length === 0 ? (
              <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
                <DollarSign className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No revenue recorded yet</p>
                <p className="text-xs text-muted-foreground">Revenue will appear here once subscriptions are billed.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueData} margin={{ left: -10, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <RechartsTooltip content={<CustomRevenueTooltip />} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plan distribution</CardTitle>
            <p className="text-xs text-muted-foreground">Active tenants by subscription tier</p>
          </CardHeader>
          <CardContent>
            {plans.isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : plansData.length === 0 ? (
              <div className="flex h-[240px] flex-col items-center justify-center gap-2 text-center">
                <CreditCard className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No active subscriptions</p>
                <p className="text-xs text-muted-foreground">Plan data will appear once schools subscribe.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={plansData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {plansData.map((_: any, i: number) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<PlanTooltip />} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      </section>

      {/* Health summary + Activity */}
      <section className="space-y-3">
      <SectionLabel title="Operations" hint="Health & recent events" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Platform health indicators */}
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Platform health</CardTitle>
            <p className="text-xs text-muted-foreground">At-a-glance operational status</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {kpis.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
            ) : (
              <TooltipProvider>
                {[
                  {
                    icon: Building2,
                    label: "Active rate",
                    value: `${activeRatio}%`,
                    sub: `${activeTenants} of ${totalTenants} tenants active`,
                    ok: activeRatio >= 80,
                  },
                  {
                    icon: AlertCircle,
                    label: "Suspended tenants",
                    value: suspendedCount.toString(),
                    sub: suspendedCount === 0 ? "No suspended tenants" : "Require review",
                    ok: suspendedCount === 0,
                  },
                  {
                    icon: DollarSign,
                    label: "ARR (est.)",
                    value: `$${((kd?.mrr ?? 0) * 12).toLocaleString()}`,
                    sub: "Based on current MRR × 12",
                    ok: true,
                  },
                  {
                    icon: Clock,
                    label: "Trial tenants",
                    value: (kd?.trialing_tenants ?? kd?.trial_tenants ?? "—").toString(),
                    sub: "Currently in trial period",
                    ok: true,
                  },
                ].map(({ icon: Icon, label, value, sub, ok }) => (
                  <Tooltip key={label}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40 cursor-default">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-sm font-semibold leading-tight">{value}</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <p className="text-xs">{sub}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </TooltipProvider>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div>
              <CardTitle className="text-base">Recent activity</CardTitle>
              <p className="text-xs text-muted-foreground">Latest platform events</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
              <Link to="/platform-control-panel/settings">View audit log <ArrowUpRight className="h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
            ) : activityData.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No activity recorded yet</p>
                <p className="text-xs text-muted-foreground">Events like sign-ups, plan changes and payment failures will appear here.</p>
              </div>
            ) : (
              activityData.map((a: any) => {
                const action = typeof a?.action === "string" && a.action.trim() ? a.action : "platform.activity";
                const meta  = actionIconMap[action] ?? { icon: ArrowUpRight, tone: "bg-muted text-muted-foreground", label: action.replace(/platform\./g, "").replace(/\./g, " ") };
                const Icon  = meta.icon;
                const actor = a.actor_name ?? "System";
                const target = a.target_name ?? a.target_id ?? "";
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {meta.label}
                        {target && <span className="text-muted-foreground"> — {target}</span>}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">by {actor}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{a.created_at_human ?? timeAgo(a.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
      </section>

      {/* Monthly revenue bar chart */}
      <section className="space-y-3">
      <SectionLabel title="Revenue breakdown" hint="Per-month invoice totals" />
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly revenue breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">Discrete invoice totals per month — use for spotting anomalies</p>
        </CardHeader>
        <CardContent>
          {revenue.isLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : revenueData.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No revenue data to display.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueData} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <RechartsTooltip content={<CustomRevenueTooltip />} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
      </section>
    </div>
  );
}
