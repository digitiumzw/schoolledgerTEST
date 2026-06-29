import { useState } from "react";
import { Download, RotateCcw, ClipboardList, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuditLogs, useExportAuditLog, type AuditLogFilters } from "@/admin/hooks/useAuditLogs";

type AuditEntry = {
  id: number;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  created_at: string;
};

const PER_PAGE = 50;

export function AuditLogsTab() {
  const [draft, setDraft] = useState<AuditLogFilters>({});
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [page, setPage] = useState(1);

  const q   = useAuditLogs(filters, page, PER_PAGE);
  const exp = useExportAuditLog();

  const data = q.data as { items: AuditEntry[]; total: number; page: number; per_page: number } | undefined;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const hasActiveFilters = Object.values(filters).some(Boolean);

  function apply() { setFilters(draft); setPage(1); }
  function reset() { setDraft({}); setFilters({}); setPage(1); }

  return (
    <div className="space-y-5">
      {/* Filter card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Search className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Filter events</CardTitle>
              <CardDescription className="text-xs">Narrow the audit log by date range, actor, action, or target.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-5">
          <div className="mb-4 grid gap-1.5">
            <Label htmlFor="filter-search" className="text-xs font-medium">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filter-search"
                className="pl-9"
                value={draft.search ?? ''}
                placeholder="Search across actor, action, target, or IP…"
                onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') apply(); }}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="grid gap-1.5">
              <Label htmlFor="filter-from" className="text-xs font-medium">From</Label>
              <Input
                id="filter-from"
                type="date"
                value={draft.from_date ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, from_date: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-to" className="text-xs font-medium">To</Label>
              <Input
                id="filter-to"
                type="date"
                value={draft.to_date ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, to_date: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-actor" className="text-xs font-medium">Actor email</Label>
              <Input
                id="filter-actor"
                value={draft.actor_email ?? ''}
                placeholder="admin@example.com"
                onChange={(e) => setDraft((d) => ({ ...d, actor_email: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-action" className="text-xs font-medium">Action contains</Label>
              <Input
                id="filter-action"
                value={draft.action ?? ''}
                placeholder="platform.tenant.suspend"
                onChange={(e) => setDraft((d) => ({ ...d, action: e.target.value }))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="filter-target" className="text-xs font-medium">Target type</Label>
              <Input
                id="filter-target"
                value={draft.target_type ?? ''}
                placeholder="tenant"
                onChange={(e) => setDraft((d) => ({ ...d, target_type: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={apply} size="sm" className="gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Apply filters
            </Button>
            <Button onClick={reset} size="sm" variant="outline" className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </Button>
            {hasActiveFilters && (
              <Badge variant="secondary" className="text-xs">Filters active</Badge>
            )}
            <div className="ml-auto">
              <Button
                onClick={() => exp.mutate(filters)}
                size="sm"
                variant="outline"
                disabled={exp.isPending}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                {exp.isPending ? "Exporting…" : "Export CSV"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results card */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardList className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Audit log</CardTitle>
                <CardDescription className="text-xs">
                  {total > 0 ? `${total.toLocaleString()} event${total !== 1 ? 's' : ''}` : 'No events found'}
                </CardDescription>
              </div>
            </div>
            {total > 0 && (
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
            )}
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {q.isLoading ? (
            <div className="space-y-px p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">No audit entries found</p>
              <p className="text-xs text-muted-foreground">Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">When</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Actor</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Action</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Target</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((e) => (
                    <tr key={e.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium">{e.actor_name ?? '—'}</div>
                        <div className="text-xs text-muted-foreground">{e.actor_email ?? ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{e.action}</code>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {e.target_type ? (
                          <span>
                            <span className="font-medium text-foreground">{e.target_type}</span>
                            {e.target_id ? <span className="text-muted-foreground">#{e.target_id}</span> : null}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                        {e.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <>
              <Separator />
              <div className="flex items-center justify-between px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Showing {((page - 1) * PER_PAGE) + 1}–{Math.min(page * PER_PAGE, total)} of {total.toLocaleString()}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2 text-xs font-medium tabular-nums">
                    {page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
