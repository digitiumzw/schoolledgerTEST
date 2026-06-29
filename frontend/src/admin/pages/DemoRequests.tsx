import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, RefreshCw, MoreHorizontal, Mail, CheckCircle2,
  Building2, Users, MapPin, Trash2, StickyNote, ExternalLink,
} from "lucide-react";
import { PageHeader } from "../components/admin/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import { QueryErrorState } from "@/components/ui/query-error-state";
import {
  getDemoRequests, updateDemoRequest, deleteDemoRequest, createTenant,
  DemoRequest,
} from "@/api/platform";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  new:       { label: "New",       className: "bg-blue-50 text-blue-700 border-blue-200" },
  contacted: { label: "Contacted", className: "bg-amber-50 text-amber-700 border-amber-200" },
  converted: { label: "Converted", className: "bg-green-50 text-green-700 border-green-200" },
  dismissed: { label: "Dismissed", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function DemoRequests() {
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("all");
  const [query,        setQuery]        = useState("");
  const [page,         setPage]         = useState(1);

  const [selected,         setSelected]         = useState<DemoRequest | null>(null);
  const [notesDialogOpen,  setNotesDialogOpen]  = useState(false);
  const [notesValue,       setNotesValue]       = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget,     setDeleteTarget]     = useState<DemoRequest | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", email: "" });
  const [convertTarget, setConvertTarget] = useState<DemoRequest | null>(null);

  const params = useMemo(() => ({
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    page,
    limit: 25,
    sortBy: "created_at",
    sortDir: "desc" as const,
  }), [statusFilter, page]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["platform-demo-requests", params],
    queryFn:  () => getDemoRequests(params).then((r: any) => r.data?.data ?? r.data),
  });

  const requests: DemoRequest[] = data?.data ?? [];
  const meta                    = data?.meta;

  const filtered = useMemo(() => {
    if (!query.trim()) return requests;
    const q = query.toLowerCase();
    return requests.filter(
      (r) =>
        r.school_name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.school_address.toLowerCase().includes(q)
    );
  }, [requests, query]);

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ["platform-demo-requests"] });
  }

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; notes?: string } }) =>
      updateDemoRequest(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-demo-requests"] });
      toast.success("Demo request updated.");
      setNotesDialogOpen(false);
      setSelected((prev) => prev ? { ...prev, ...updateMut.variables?.data } as DemoRequest : prev);
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteDemoRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-demo-requests"] });
      toast.success("Demo request deleted.");
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setSelected(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const createMut = useMutation({
    mutationFn: (payload: { name: string; email: string }) => createTenant(payload as any),
    onSuccess: (_, vars) => {
      toast.success("School created. Welcome email sent to admin.");
      setCreateOpen(false);
      setCreateForm({ name: "", email: "" });
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      if (convertTarget) {
        updateMut.mutate({ id: convertTarget.id, data: { status: "converted" } });
        setConvertTarget(null);
      }
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? "Failed to create school"),
  });

  function openCreateFromRequest(req: DemoRequest) {
    setConvertTarget(req);
    setCreateForm({ name: req.school_name, email: req.email });
    setCreateOpen(true);
  }

  function openNotesDialog(req: DemoRequest) {
    setSelected(req);
    setNotesValue(req.notes ?? "");
    setNotesDialogOpen(true);
  }

  function openDeleteDialog(req: DemoRequest) {
    setDeleteTarget(req);
    setDeleteDialogOpen(true);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Demo Requests"
        description={`${meta?.total ?? "…"} submissions from the landing page.${meta?.new_count ? ` ${meta.new_count} new.` : ""}`}
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      <Card className="shadow-card">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search by school, email, or address…"
              className="h-9 pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="dismissed">Dismissed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : isError ? (
          <QueryErrorState error={error} onRetry={handleRefresh} />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Mail className="h-10 w-10 opacity-30" />
            <p className="text-sm">No demo requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Est. Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((req) => (
                  <TableRow
                    key={req.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setSelected(req)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                          {req.school_name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[180px]">{req.school_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{req.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm truncate max-w-[200px]">{req.school_address}</TableCell>
                    <TableCell className="text-right font-medium">{req.estimated_students.toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={req.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{formatDate(req.created_at)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => updateMut.mutate({ id: req.id, data: { status: "contacted" } })}>
                            <Mail className="mr-2 h-4 w-4" /> Mark Contacted
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openCreateFromRequest(req)}>
                            <Plus className="mr-2 h-4 w-4" /> Create School
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openNotesDialog(req)}>
                            <StickyNote className="mr-2 h-4 w-4" /> Add / Edit Notes
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => updateMut.mutate({ id: req.id, data: { status: "dismissed" } })} className="text-muted-foreground">
                            <ExternalLink className="mr-2 h-4 w-4" /> Dismiss
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openDeleteDialog(req)} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {meta && meta.pages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm text-muted-foreground">
              Page {meta.page} of {meta.pages} ({meta.total} total)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={meta.page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={meta.page >= meta.pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                    {selected.school_name.slice(0, 2).toUpperCase()}
                  </div>
                  <span>{selected.school_name}</span>
                </SheetTitle>
                <SheetDescription>
                  <StatusBadge status={selected.status} />
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="font-medium">{selected.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Address</p>
                    <p className="font-medium">{selected.school_address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Estimated Students</p>
                    <p className="font-medium">{selected.estimated_students.toLocaleString()}</p>
                  </div>
                </div>
                {selected.notes && (
                  <div className="rounded-lg border bg-muted/40 p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{selected.notes}</p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Submitted {formatDate(selected.created_at)}</p>
              </div>

              <div className="mt-6 grid gap-2">
                <Button
                  className="w-full"
                  onClick={() => openCreateFromRequest(selected)}
                  disabled={selected.status === "converted"}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {selected.status === "converted" ? "Already Converted" : "Create School from This Request"}
                </Button>
                {selected.status !== "contacted" && selected.status !== "converted" && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => updateMut.mutate({ id: selected.id, data: { status: "contacted" } })}
                    disabled={updateMut.isPending}
                  >
                    <Mail className="mr-2 h-4 w-4" /> Mark as Contacted
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={() => openNotesDialog(selected)}>
                  <StickyNote className="mr-2 h-4 w-4" /> {selected.notes ? "Edit Notes" : "Add Notes"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => openDeleteDialog(selected)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Request
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes — {selected?.school_name}</DialogTitle>
            <DialogDescription>Internal notes about this demo request.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Notes</Label>
            <Textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="e.g. Spoke with principal on 15 Jun…"
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={updateMut.isPending}
              onClick={() => selected && updateMut.mutate({ id: selected.id, data: { notes: notesValue } })}
            >
              {updateMut.isPending ? "Saving…" : "Save Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Demo Request</DialogTitle>
            <DialogDescription>
              Permanently delete the request from <strong>{deleteTarget?.school_name}</strong>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMut.isPending}
              onClick={() => deleteTarget && deleteMut.mutate(deleteTarget.id)}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create School Dialog (pre-filled from demo request) */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setConvertTarget(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create School</DialogTitle>
            <DialogDescription>
              Pre-filled from the demo request. The admin will receive a welcome email with login instructions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>School name</Label>
              <Input
                placeholder="e.g. Pinecrest College Prep"
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Admin email</Label>
              <Input
                type="email"
                placeholder="admin@school.edu"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            {convertTarget && (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p><strong>Address:</strong> {convertTarget.school_address}</p>
                <p><strong>Est. Students:</strong> {convertTarget.estimated_students.toLocaleString()}</p>
                <p className="pt-1 text-primary font-medium">Creating this school will mark the demo request as Converted.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setConvertTarget(null); }}>Cancel</Button>
            <Button
              disabled={createMut.isPending || !createForm.name || !createForm.email}
              onClick={() => createMut.mutate(createForm)}
            >
              {createMut.isPending ? "Creating…" : "Create School"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
