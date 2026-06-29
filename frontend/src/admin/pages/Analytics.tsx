import { useMemo, useState } from "react";
import {
  BarChart2,
  Building2,
  CalendarRange,
  DollarSign,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "../components/admin/PageHeader";
import { StatCard } from "../components/admin/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getGrowthAnalytics, getLeaderboard,
  type PlatformGrowthAnalyticsResponse, type PlatformLeaderboardItem,
} from "@/api/platform";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

type LeaderMetric = "mrr" | "students" | "revenue";

const MEDAL: Record<number, { bg: string; text: string; label: string }> = {
  0: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-600 dark:text-yellow-400", label: "🥇" },
  1: { bg: "bg-slate-100 dark:bg-slate-800",      text: "text-slate-500 dark:text-slate-400",   label: "🥈" },
  2: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-600 dark:text-orange-400", label: "🥉" },
};

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);
}
function fmtMoney(n: number): string {
  return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n ?? 0);
}
function fmtCompact(n: number): string {
  return "$" + new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n ?? 0);
}

export default function Analytics() {
  const [leaderMetric, setLeaderMetric] = useState<LeaderMetric>("mrr");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const queryClient = useQueryClient();

  const growthParams = useMemo(() => ({ from: from || undefined, to: to || undefined }), [from, to]);

  const growthQ = useQuery({
    queryKey: ["platform-analytics-growth", growthParams],
    queryFn: async (): Promise<PlatformGrowthAnalyticsResponse> =>
      (await getGrowthAnalytics(growthParams)).data.data,
  });

  const leaderQ = useQuery({
    queryKey: ["platform-leaderboard", leaderMetric],
    queryFn: async (): Promise<PlatformLeaderboardItem[]> =>
      (await getLeaderboard({ metric: leaderMetric })).data.data,
  });

  const growthData = growthQ.data ?? { tenant_growth: [], revenue_growth: [] };
  const tenantGrowth = growthData.tenant_growth ?? growthData.tenantGrowth ?? [];
  const revenueGrowth = growthData.revenue_growth ?? growthData.revenueGrowth ?? [];
  const summary = growthQ.data?.summary;
  const leaderData = leaderQ.data ?? [];

  const leaderLabels: Record<LeaderMetric, string> = { mrr: "MRR", students: "Students", revenue: "Revenue" };

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["platform-analytics-growth"] });
    queryClient.invalidateQueries({ queryKey: ["platform-leaderboard"] });
  }

  const isFetching = growthQ.isFetching || leaderQ.isFetching;
  const isLoading  = growthQ.isLoading;

  const tooltipStyle = {
    borderRadius: 8,
    border: "1px solid hsl(var(--border))",
    background: "hsl(var(--card))",
    fontSize: 12,
    boxShadow: "0 4px 12px rgba(0,0,0,.08)",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Platform-wide growth, revenue trends, and school engagement."
        actions={(
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        )}
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Total Schools"
              value={summary?.totalTenants ?? summary?.total_tenants ?? 0}
              format="number"
              subtitle="Cumulative registered tenants"
              icon={Building2}
              tone="primary"
            />
            <StatCard
              label="Active Schools"
              value={summary?.activeTenants ?? summary?.active_tenants ?? 0}
              format="number"
              subtitle="Currently active subscriptions"
              icon={Users}
              tone="success"
            />
            <StatCard
              label="New This Month"
              value={summary?.newThisMonth ?? summary?.new_this_month ?? 0}
              format="number"
              subtitle="Schools joined this month"
              icon={Sparkles}
              tone="info"
            />
            <StatCard
              label="Total Revenue"
              value={summary?.totalRevenue ?? summary?.total_revenue ?? 0}
              format="currency"
              subtitle="In the selected date window"
              icon={DollarSign}
              tone="warning"
            />
          </>
        )}
      </div>

      {/* Date Range Filter */}
      <Card className="shadow-card border-border/60">
        <CardContent className="flex flex-wrap items-end gap-3 py-3">
          <div className="flex items-center gap-2 self-end pb-1.5 text-sm font-medium text-foreground">
            <CalendarRange className="h-4 w-4 text-primary" />
            Date range
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">From</p>
            <Input
              type="date"
              className="h-8 w-40 text-sm"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">To</p>
            <Input
              type="date"
              className="h-8 w-40 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          {(from || to) && (
            <Button variant="ghost" size="sm" className="h-8 self-end text-xs" onClick={() => { setFrom(""); setTo(""); }}>
              Clear
            </Button>
          )}
          <p className="self-end pb-0.5 text-xs text-muted-foreground">
            Filters apply to growth chart and revenue trend.
          </p>
        </CardContent>
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview">
        <TabsList className="mb-2">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-1.5">
            <BarChart2 className="h-3.5 w-3.5" /> Revenue
          </TabsTrigger>
          <TabsTrigger value="schools" className="flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" /> Top Schools
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ──────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <Card className="shadow-card border-border/60">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base">School growth</CardTitle>
              <p className="text-xs text-muted-foreground">
                Cumulative tenant count vs new signups per month.
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              {growthQ.isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : tenantGrowth.length === 0 ? (
                <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
                  <Building2 className="h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm font-medium text-muted-foreground">No growth data yet.</p>
                  <p className="text-xs text-muted-foreground">Data will appear once schools start signing up.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={tenantGrowth} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="monthLabel"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={36}
                      tickFormatter={(v) => fmt(Number(v))}
                    />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="cumulativeTenants"
                      name="Cumulative"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="newTenants"
                      name="New this month"
                      stroke="hsl(var(--info))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Mini summary strip */}
          {!isLoading && summary && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: "Months tracked", value: (summary.monthsTracked ?? 0).toString() },
                { label: "Avg revenue / school", value: fmtMoney(summary.avgRevenuePerTenant ?? summary.avg_revenue_per_tenant ?? 0) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Revenue Tab ───────────────────────────────────────── */}
        <TabsContent value="revenue" className="mt-0">
          <Card className="shadow-card border-border/60">
            <CardHeader className="border-b pb-4">
              <CardTitle className="text-base">Monthly revenue trend</CardTitle>
              <p className="text-xs text-muted-foreground">
                Subscription invoice revenue per month.
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              {growthQ.isLoading ? (
                <Skeleton className="h-[320px] w-full" />
              ) : revenueGrowth.length === 0 ? (
                <div className="flex h-[320px] flex-col items-center justify-center gap-2 text-center">
                  <DollarSign className="h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm font-medium text-muted-foreground">No revenue data yet.</p>
                  <p className="text-xs text-muted-foreground">Revenue will appear here once invoices are issued.</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={revenueGrowth} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="monthLabel"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={56}
                        tickFormatter={(v) => fmtCompact(Number(v))}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v: number, name: string) => {
                          if (name === "revenue") return [fmtMoney(Number(v)), "Revenue"];
                          if (name === "deltaPercent") return [`${v}%`, "MoM change"];
                          return [v, name];
                        }}
                      />
                      <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Revenue summary row */}
                  <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-xl border border-border/60">
                    {(() => {
                      const totRev = revenueGrowth.reduce((s, r) => s + Number(r.revenue ?? 0), 0);
                      const avgRev = revenueGrowth.length > 0 ? totRev / revenueGrowth.length : 0;
                      const lastRev = revenueGrowth.length > 0 ? revenueGrowth[revenueGrowth.length - 1] : null;
                      return [
                        { label: "Total (window)", value: fmtMoney(totRev) },
                        { label: "Monthly avg", value: fmtMoney(avgRev) },
                        { label: "Last month Δ", value: lastRev ? `${lastRev.deltaPercent > 0 ? "+" : ""}${lastRev.deltaPercent}%` : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="px-4 py-3 text-center">
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="mt-0.5 text-base font-bold tabular-nums">{value}</p>
                        </div>
                      ));
                    })()}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Top Schools Tab ───────────────────────────────────── */}
        <TabsContent value="schools" className="mt-0">
          <Card className="shadow-card border-border/60">
            <CardHeader className="border-b pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    Top Schools
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Ranked by {leaderLabels[leaderMetric].toLowerCase()}.
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {(["mrr", "students", "revenue"] as const).map((m) => (
                    <Button
                      key={m}
                      variant={leaderMetric === m ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => setLeaderMetric(m)}
                    >
                      {leaderLabels[m]}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {leaderQ.isLoading ? (
                <div className="divide-y divide-border">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3">
                      <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-2/3" />
                        <Skeleton className="h-2 w-full" />
                      </div>
                      <Skeleton className="h-4 w-14 shrink-0" />
                    </div>
                  ))}
                </div>
              ) : leaderData.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                  <Trophy className="h-10 w-10 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">No data yet.</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {leaderData.map((s, i) => {
                    const medal = MEDAL[i];
                    return (
                      <li key={s.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
                        <div className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          medal ? `${medal.bg} ${medal.text}` : "bg-muted text-muted-foreground",
                        )}>
                          {medal ? medal.label : i + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{s.name ?? s.id}</p>
                          <Progress value={s.progressPercent} className="mt-1.5 h-1.5" />
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {s.displayValue}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
