import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  RefreshCw,
  Search,
  X,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "../components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useSystemErrors, useSystemError } from "../hooks/useSystemErrors";
import type { SystemErrorLog, SystemErrorLogFilters } from "@/api/platform";

const PER_PAGE = 50;

function relativeTime(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortClass(fqcn: string): string {
  const parts = fqcn.split("\\");
  return parts[parts.length - 1] ?? fqcn;
}

function methodBadge(method: string) {
  const colours: Record<string, string> = {
    GET: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    POST: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    PUT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    PATCH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${
        colours[method.toUpperCase()] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {method}
    </span>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────

function ErrorDetailDialog({
  correlationId,
  onClose,
}: {
  correlationId: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: log, isLoading } = useSystemError(correlationId);

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() =>
      toast({ title: `${label} copied to clipboard` })
    );
  }

  return (
    <Dialog open={!!correlationId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Error Detail
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3 py-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {log && (
          <div className="space-y-4 text-sm">
            {/* Correlation ID */}
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Correlation ID</p>
                <p className="font-mono font-semibold">{log.correlation_id}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(log.correlation_id, "Correlation ID")}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Timestamp" value={new Date(log.created_at).toLocaleString()} />
              <Field label="IP Address" value={log.ip_address} />
              <Field
                label="Request"
                value={
                  <span className="flex items-center gap-1.5">
                    {methodBadge(log.request_method)}
                    <span className="font-mono text-xs">{log.request_uri}</span>
                  </span>
                }
              />
              <Field label="Tenant" value={log.tenant_name ?? log.tenant_id ?? "—"} />
              <Field label="User ID" value={log.user_id ?? "—"} />
              <Field
                label="Exception"
                value={<span className="font-mono text-xs">{shortClass(log.exception_class)}</span>}
              />
            </div>

            {/* Message */}
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Message</p>
              <p className="rounded-md border bg-muted/30 px-3 py-2 font-mono text-xs leading-relaxed">
                {log.message}
              </p>
            </div>

            {/* Stack trace */}
            {log.stack_trace && (
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Stack Trace</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => copy(log.stack_trace!, "Stack trace")}
                  >
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                </div>
                <pre className="max-h-72 overflow-auto rounded-md border bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
                  {log.stack_trace}
                </pre>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SystemErrors() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filters: SystemErrorLogFilters = {
    search: search || undefined,
    from_date: fromDate || undefined,
    to_date: toDate || undefined,
  };

  const { data, isLoading, isError } = useSystemErrors(filters, page, PER_PAGE);

  const logs: SystemErrorLog[] = (data as { data?: SystemErrorLog[] } | undefined)?.data ?? [];
  const meta = (data as { meta?: { total: number; last_page: number } } | undefined)?.meta;

  function applySearch() {
    setSearch(draftSearch);
    setPage(1);
  }

  function clearFilters() {
    setDraftSearch("");
    setSearch("");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["platform", "system-errors"] });
    toast({ title: "Refreshed" });
  }

  const hasFilters = search || fromDate || toDate;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Error Logs"
        description="Server-side exceptions captured with correlation IDs"
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, message, URI or IP…"
                value={draftSearch}
                onChange={(e) => setDraftSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                className="pl-9"
              />
            </div>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
              className="w-[160px]"
              title="From date"
            />
            <Input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setPage(1); }}
              className="w-[160px]"
              title="To date"
            />
            <Button onClick={applySearch} size="sm">Search</Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Error Log
            {meta && (
              <Badge variant="secondary" className="ml-auto font-mono">
                {meta.total.toLocaleString()} total
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p>Failed to load error logs. Check your connection and try again.</p>
              <Button variant="outline" size="sm" onClick={refresh}>Retry</Button>
            </div>
          )}

          {!isLoading && !isError && logs.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
              <ShieldAlert className="h-8 w-8" />
              <p>{hasFilters ? "No errors match your filters." : "No system errors recorded."}</p>
            </div>
          )}

          {!isLoading && !isError && logs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Correlation ID</TableHead>
                  <TableHead>Exception</TableHead>
                  <TableHead className="max-w-[280px]">Message</TableHead>
                  <TableHead className="w-[90px]">Method</TableHead>
                  <TableHead>URI</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead className="w-[120px]">IP</TableHead>
                  <TableHead className="w-[110px]">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedId(log.correlation_id)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-destructive">
                      {log.correlation_id}
                    </TableCell>
                    <TableCell>
                      <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300">
                        {shortClass(log.exception_class)}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      <p className="truncate text-sm" title={log.message}>
                        {log.message}
                      </p>
                    </TableCell>
                    <TableCell>{methodBadge(log.request_method)}</TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="truncate font-mono text-xs" title={log.request_uri}>
                        {log.request_uri}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.tenant_name ?? (log.tenant_id ? (
                        <span className="font-mono text-xs text-muted-foreground">{log.tenant_id}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      ))}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.ip_address}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground" title={log.created_at}>
                      {relativeTime(log.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {meta.last_page} &mdash; {meta.total.toLocaleString()} errors
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.last_page}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail dialog */}
      <ErrorDetailDialog
        correlationId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
