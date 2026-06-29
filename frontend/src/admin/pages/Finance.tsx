import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Building2,
  CalendarClock,
  Download,
  Filter,
  RefreshCw,
  DollarSign,
  Repeat2,
} from "lucide-react";
import { PageHeader } from "../components/admin/PageHeader";
import { StatCard } from "../components/admin/StatCard";
import { StatusBadge } from "../components/admin/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { downloadInvoicePdf } from "@/api/platform";
import { useExportInvoices, useFinanceGrowth, useFinanceSummary, useInvoices } from "../hooks/useFinance";
import type {
  PlatformFinanceFilters,
  PlatformFinanceInvoiceRow,
  PlatformRecentSubscription,
} from "@/api/platform";

function formatMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split("-");
  return new Date(parseInt(y), parseInt(m) - 1, 1).toLocaleString("default", { month: "short" });
}

function formatMoney(amount: number, currency = "USD") {
  const normalized = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount ?? 0);
  return currency === "USD" ? `$${normalized}` : `${currency} ${normalized}`;
}

function formatCompactMoney(amount: number, currency = "USD") {
  const normalized = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(amount ?? 0);
  return currency === "USD" ? `$${normalized}` : `${currency} ${normalized}`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRelativeTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} ${diffMin === 1 ? "minute" : "minutes"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} ${diffHr === 1 ? "hour" : "hours"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 5) return `${diffWk} ${diffWk === 1 ? "week" : "weeks"} ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo} ${diffMo === 1 ? "month" : "months"} ago`;
  return formatDate(value);
}

function cycleLabel(cycle: string) {
  if (cycle === "annual") return "Annual";
  if (cycle === "monthly") return "Monthly";
  return cycle;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Finance() {
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [filters, setFilters] = useState<PlatformFinanceFilters>({ limit: 25 });

  const queryClient = useQueryClient();
  const exportMutation = useExportInvoices();

  const activeFilters = useMemo(() => ({
    ...filters,
    page,
    limit: 25,
  }), [filters, page]);

  const summaryQ = useFinanceSummary(filters);
  const growthQ = useFinanceGrowth(filters);
  const invoicesQ = useInvoices(activeFilters);

  const summary = summaryQ.data;
  const invoices = invoicesQ.data?.data ?? [];
  const meta = invoicesQ.data?.meta;

  const revenueChart = useMemo(() => (
    (growthQ.data?.revenue_growth ?? []).map((row) => ({
      month: formatMonth(row.month),
      revenue: Number(row.revenue ?? 0),
    }))
  ), [growthQ.data]);

  const recentSubscriptions: PlatformRecentSubscription[] = summary?.recent_subscriptions ?? [];
  const isFetching = summaryQ.isFetching || growthQ.isFetching || invoicesQ.isFetching;

  useEffect(() => {
    setPage(1);
  }, [filters.status, filters.from, filters.to, filters.tenant_id]);

  async function handleDownloadPdf(id: string, invoiceNumber: string) {
    setDownloadingId(id);
    try {
      const res = await downloadInvoicePdf(id);
      const content = (res as { data: Blob }).data;
      const blob = content instanceof Blob
        ? content
        : new Blob([content], { type: "application/pdf" });
      triggerDownload(blob, `${invoiceNumber}.pdf`);
      toast.success("Invoice downloaded");
    } catch {
      toast.error("Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  }

  function updateFilter<K extends keyof PlatformFinanceFilters>(key: K, value: PlatformFinanceFilters[K]) {
    setFilters((current) => ({
      ...current,
      [key]: value === "" || value === undefined || value === null ? undefined : value,
    }));
  }

  function clearFilters() {
    setFilters({ limit: 25 });
    setPage(1);
  }

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["platform", "finance"] });
  }

  function handleExport() {
    exportMutation.mutate({
      status: filters.status,
      from: filters.from,
      to: filters.to,
      tenant_id: filters.tenant_id,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance Control Center"
        description="Revenue, invoicing, and subscription activity across the platform."
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={handleExport} disabled={exportMutation.isPending}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </>
        )}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryQ.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              label="Net Revenue"
              value={summary?.net_revenue ?? 0}
              format="currency"
              delta={summary?.growth_rate ?? 0}
              subtitle="Current reporting window"
              icon={Banknote}
              tone="success"
            />
            <StatCard
              label="Monthly Recurring Revenue"
              value={summary?.mrr ?? 0}
              format="currency"
              subtitle="Across all active subscriptions"
              icon={Repeat2}
              tone="primary"
            />
            <StatCard
              label="Active Schools"
              value={summary?.active_schools_count ?? 0}
              format="number"
              subtitle="Currently active subscriptions"
              icon={Building2}
              tone="info"
            />
            <StatCard
              label="Renewals Due"
              value={summary?.renewals_due_count ?? 0}
              format="number"
              subtitle="Expiring within 30 days"
              icon={CalendarClock}
              tone="warning"
            />
          </>
        )}
      </div>

      {/* Chart + Recent Subscriptions */}
      <div className="grid gap-6 xl:grid-cols-[2fr,1fr]">
        <Card className="shadow-card border-border/60">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Monthly revenue trend</CardTitle>
            <p className="text-xs text-muted-foreground">Month-aligned revenue totals across the platform.</p>
          </CardHeader>
          <CardContent className="pt-6">
            {growthQ.isLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : revenueChart.length === 0 ? (
              <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-center">
                <DollarSign className="h-10 w-10 text-muted-foreground/25" />
                <p className="text-sm font-medium text-muted-foreground">No revenue data yet</p>
                <p className="text-xs text-muted-foreground">Monthly revenue will appear here once invoices are issued.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueChart} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
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
                    tickFormatter={(value) => formatCompactMoney(Number(value))}
                    width={56}
                  />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      fontSize: 12,
                      boxShadow: "0 4px 12px rgba(0,0,0,.08)",
                    }}
                    formatter={(value: number) => [formatMoney(Number(value)), "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card border-border/60">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-base">Recent Subscriptions</CardTitle>
            <p className="text-xs text-muted-foreground">Latest subscription activity across tenants.</p>
          </CardHeader>
          <CardContent className="p-0">
            {summaryQ.isLoading ? (
              <div className="space-y-0 divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentSubscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                <Building2 className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No subscriptions yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recentSubscriptions.map((sub) => (
                  <li key={sub.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-5">
                        {sub.tenant_name ?? "Unknown school"}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          {sub.plan_name ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground/50">·</span>
                        <span className={cn(
                          "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          sub.billing_cycle === "annual"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground",
                        )}>
                          {cycleLabel(sub.billing_cycle)}
                        </span>
                        <StatusBadge status={sub.status} />
                      </div>
                    </div>
                    <span className="shrink-0 text-right text-xs text-muted-foreground">
                      {formatRelativeTime(sub.last_payment_at ?? sub.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reporting Filters */}
      <Card className="shadow-card border-border/60">
        <CardHeader className="border-b py-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Reporting filters
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 py-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">From</p>
            <Input type="date" className="h-8 text-sm" value={filters.from ?? ""} onChange={(e) => updateFilter("from", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">To</p>
            <Input type="date" className="h-8 text-sm" value={filters.to ?? ""} onChange={(e) => updateFilter("to", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Payment status</p>
            <Select value={filters.status ?? "all"} onValueChange={(value) => updateFilter("status", value === "all" ? undefined : value)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="initiated">Initiated</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card className="shadow-card border-border/60">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Invoices</CardTitle>
              <p className="text-xs text-muted-foreground">
                {meta?.total !== undefined ? `${meta.total} invoices` : "Loading…"} in the selected window.
              </p>
            </div>
            {isFetching && (
              <span className="text-xs text-muted-foreground">Refreshing…</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="pl-4">Invoice #</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-12 pr-4"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoicesQ.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-14 text-center text-muted-foreground">
                    No invoices match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv: PlatformFinanceInvoiceRow) => (
                  <TableRow key={inv.id} className="hover:bg-muted/20">
                    <TableCell className="pl-4 font-mono text-xs font-medium">{inv.invoice_number}</TableCell>
                    <TableCell className="font-medium">{inv.school_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{inv.plan_name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{formatMoney(Number(inv.amount ?? 0), inv.currency ?? "USD")}</TableCell>
                    <TableCell><StatusBadge status={inv.payment_status ?? "unknown"} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(inv.issued_at)}</TableCell>
                    <TableCell className="pr-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        disabled={downloadingId === inv.id}
                        onClick={() => handleDownloadPdf(inv.id, inv.invoice_number)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          <div className="flex flex-col gap-3 border-t px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{meta ? `Showing ${invoices.length} of ${meta.total}` : "Loading…"}</span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-3 text-xs" disabled={!meta || page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
