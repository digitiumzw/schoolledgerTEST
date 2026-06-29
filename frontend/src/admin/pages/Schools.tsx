import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, MoreHorizontal, Eye, Pause, Play, LogIn, Trash2, ArrowUpDown, Building2, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { PageHeader } from "../components/admin/PageHeader";
import { StatusBadge } from "../components/admin/StatusBadge";
import { TenantBillingTab } from "../components/admin/TenantBillingTab";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { QueryErrorState } from "@/components/ui/query-error-state";
import {
  getTenants, getPlans, createTenant, suspendTenant, reactivateTenant, deleteTenant,
  platformImpersonate, resendTenantWelcome,
} from "@/api/platform";

type Tenant = {
  id: string;
  name: string;
  email: string;
  status: string;
  subscription_id: string | null;
  subscription_status: string | null;
  plan_name: string | null;
  monthly_price: number | null;
  billing_cycle: string | null;
  expires_at: string | null;
  student_count: number;
  staff_count: number;
  created_at: string;
  is_deleted: boolean;
  deleted_school_name: string | null;
  permanently_deleted_at: string | null;
};

function initials(name: string) {
  return (name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
}

// Tier-aware plan badge separate from status badges
const planTierStyles: Record<string, string> = {
  free:       "bg-muted text-muted-foreground",
  starter:    "bg-slate-100 text-slate-600",
  basic:      "bg-slate-100 text-slate-600",
  growth:     "bg-blue-50 text-blue-600",
  pro:        "bg-primary/10 text-primary",
  business:   "bg-primary/10 text-primary",
  enterprise: "bg-violet-50 text-violet-600",
};

function PlanBadge({ name }: { name: string | null }) {
  if (!name || name === "None") {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-muted-foreground/40 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        Not Subscribed
      </span>
    );
  }
  const key   = name.toLowerCase().trim();
  const style = planTierStyles[key] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${style}`}>
      {name}
    </span>
  );
}

export default function Schools() {
  const qc = useQueryClient();
  const [query,        setQuery]        = useState("");
  const [planFilter,   setPlanFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen,   setCreateOpen]   = useState(false);
  const [selected,     setSelected]     = useState<Tenant | null>(null);
  const [page,         setPage]         = useState(1);

  const [sortKey,  setSortKey]  = useState<"name" | "student_count" | "created_at" | "monthly_price">("created_at");
  const [sortDir,  setSortDir]  = useState<"asc" | "desc">("desc");
  const [form, setForm] = useState({ name: "", email: "" });

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  }

  const params = useMemo(() => ({
    ...(query        ? { q: query }           : {}),
    ...(planFilter   !== "all" ? { plan: planFilter }     : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    sortBy:  sortKey,
    sortDir: sortDir,
    page,
    limit: 25,
  }), [query, planFilter, statusFilter, sortKey, sortDir, page]);

  const tenantsQ = useQuery({
    queryKey: ["platform-tenants", params],
    queryFn:  () => getTenants(params).then((r: any) => r.data),
  });

  const plansQ = useQuery({
    queryKey: ["platform-plans"],
    queryFn:  () => getPlans().then((r: any) => r.data.data as any[]),
  });

  const tenants: Tenant[] = tenantsQ.data?.data ?? [];
  const meta               = tenantsQ.data?.meta;

  const isFetching = tenantsQ.isFetching;

  function handleRefresh() {
    qc.invalidateQueries({ queryKey: ["platform-tenants"] });
    qc.invalidateQueries({ queryKey: ["platform-plans"] });
  }

  const createMut = useMutation({
    mutationFn: (data: typeof form) => createTenant(data as any),
    onSuccess: (response: any) => {
      const emailSent = response?.data?.email_sent !== false;
      if (emailSent) {
        toast.success("School created. Welcome email sent to admin.");
      } else {
        toast.warning("School created, but the welcome email failed to send. Use Resend Welcome to retry.");
      }
      setCreateOpen(false);
      setForm({ name: "", email: "" });
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to create school"),
  });

  // US1 — Resend welcome email action for pending tenants
  const resendMut = useMutation({
    mutationFn: (tenantId: string) => resendTenantWelcome(tenantId),
    onSuccess: () => toast.success("Welcome email resent."),
    onError: (e: any) => toast.error(e?.response?.data?.message ?? e?.message ?? "Failed to resend welcome email"),
  });

  // US3 — keep detail sheet open and update selected status in-place
  const suspendMut = useMutation({
    mutationFn: (id: string) => suspendTenant(id as any),
    onSuccess: () => {
      setSelected((s) => (s ? { ...s, status: "suspended" } : s));
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast.success("Tenant suspended");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to suspend tenant — please try again"),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => reactivateTenant(id as any),
    onSuccess: () => {
      setSelected((s) => (s ? { ...s, status: "active" } : s));
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      toast.success("Tenant reactivated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to reactivate tenant — please try again"),
  });

  // US4 — delete with name-confirmation dialog and inline 409 refusal display
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteTenant(id as any),
    onSuccess: () => {
      toast.success("Tenant deleted");
      qc.invalidateQueries({ queryKey: ["platform-tenants"] });
      setDeleteDialogOpen(false);
      setDeleteConfirmName("");
      setDeleteError(null);
      setSelected(null);
    },
    onError: (e: any) => {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to delete tenant";
      if (status === 409) {
        // Show inline in dialog — refusal includes guidance
        setDeleteError(msg);
      } else {
        toast.error(msg);
      }
    },
  });

  function openDeleteDialog() {
    setDeleteConfirmName("");
    setDeleteError(null);
    setDeleteDialogOpen(true);
  }

  const [impersonating, setImpersonating] = useState<string | null>(null);

  async function handleImpersonate(tenantId: string, tenantName: string) {
    setImpersonating(tenantId);
    try {
      // Pass the UUID as-is — converting it via Number() yields NaN
      const res = await platformImpersonate(tenantId);
      const payload = (res as any).data?.data ?? {};
      const token: string | undefined = payload.token;
      const user                     = payload.user;
      if (!token || !user) throw new Error("Impersonation response was incomplete");

      // Hydrate all three localStorage keys the tenant app's AuthContext +
      // api.ts client require, otherwise ProtectedRoute will bounce to /login.
      localStorage.setItem("schoolledger_token", token);
      localStorage.setItem("schoolledger_tenant_id", user.tenantId ?? tenantId);
      localStorage.setItem("school_management_auth", JSON.stringify(user));

      toast.success(`Impersonating ${tenantName} — redirecting…`);
      setTimeout(() => { window.location.href = "/"; }, 600);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to impersonate";
      toast.error(msg);
      setImpersonating(null);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Schools"
        description={`${meta?.total ?? "…"} tenants on the platform.`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" /> Add school
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a new school</DialogTitle>
                <DialogDescription>Create a new tenant on the platform.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label>School name</Label>
                  <Input placeholder="e.g. Pinecrest College Prep" value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label>Admin email</Label>
                  <Input type="email" placeholder="admin@school.edu" value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <p className="text-xs text-muted-foreground">
                  A subdomain will be generated automatically from the school name. The admin will receive a welcome email with login instructions.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button
                  disabled={createMut.isPending || !form.name || !form.email}
                  onClick={() => createMut.mutate(form)}
                >
                  {createMut.isPending ? "Creating…" : "Create school"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
        }
      />

      <Card className="shadow-card">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Search schools…" className="h-9 pl-9" />
          </div>
          <div className="flex items-center gap-2">
            <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Plan" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                {(plansQ.data ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button className="flex items-center gap-1 font-medium hover:text-foreground transition-colors" onClick={() => toggleSort("name")}>
                  School <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>
                <button className="flex items-center gap-1 font-medium hover:text-foreground transition-colors" onClick={() => toggleSort("student_count")}>
                  Students <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <button className="flex items-center gap-1 font-medium hover:text-foreground transition-colors" onClick={() => toggleSort("monthly_price")}>
                  MRR <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>
                <button className="flex items-center gap-1 font-medium hover:text-foreground transition-colors" onClick={() => toggleSort("created_at")}>
                  Joined <ArrowUpDown className="h-3 w-3 opacity-60" />
                </button>
              </TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenantsQ.isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : tenantsQ.isError ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <QueryErrorState
                    title="Could not load schools"
                    description="Failed to fetch school data. Please check your connection."
                    onRetry={() => qc.invalidateQueries({ queryKey: ["platform-tenants"] })}
                  />
                </TableCell>
              </TableRow>
            ) : tenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                    <Building2 className="h-10 w-10 text-muted-foreground/30" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">No schools found</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {query || planFilter !== "all" || statusFilter !== "all"
                          ? "Try clearing your filters or search query."
                          : "Add your first school using the button above."}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              tenants.map((s) => {
                const isExpiringSoon = s.expires_at && (new Date(s.expires_at).getTime() - Date.now()) < 7 * 24 * 60 * 60 * 1000;
                const isDeleted = s.is_deleted || s.status === "deleted";
                return (
                  <TableRow key={s.id} className={`cursor-pointer ${isDeleted ? "opacity-60" : ""}`} onClick={() => setSelected(s)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold ${isDeleted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                          {initials(s.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className={`font-medium leading-tight ${isDeleted ? "text-muted-foreground" : ""}`}>{(s.name && s.name.trim()) || "Unnamed school"}</p>
                            {isDeleted && (
                              <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                Deleted
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{isDeleted ? (s.permanently_deleted_at ? `Deleted ${new Date(s.permanently_deleted_at).toLocaleDateString()}` : "Deleted") : ((s.email && s.email.trim()) || "No admin email")}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PlanBadge name={s.plan_name} />
                    </TableCell>
                    <TableCell className="font-medium">{s.student_count.toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    <TableCell className="font-medium">
                      {s.monthly_price ? `$${s.monthly_price}/mo` : "—"}
                    </TableCell>
                    <TableCell className={`text-xs ${isExpiringSoon ? "font-semibold text-warning" : "text-muted-foreground"}`}>
                      {s.expires_at ? new Date(s.expires_at).toLocaleDateString() : "—"}
                      {isExpiringSoon && <span className="ml-1 text-warning">⚠</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(s.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <TooltipProvider>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={() => setSelected(s)}><Eye className="h-4 w-4" /> View details</DropdownMenuItem>
                            {!isDeleted && (
                              <>
                                <DropdownMenuItem
                                  disabled={!!impersonating}
                                  onClick={() => handleImpersonate(s.id, s.name)}
                                >
                                  <LogIn className="h-4 w-4" /> {impersonating === s.id ? "Impersonating…" : "Log in as tenant"}
                                </DropdownMenuItem>
                                {s.status === "pending" && (
                                  <DropdownMenuItem
                                    disabled={resendMut.isPending}
                                    onClick={() => resendMut.mutate(s.id)}
                                  >
                                    <Info className="h-4 w-4" /> Resend welcome email
                                  </DropdownMenuItem>
                                )}
                                {s.status === "suspended" ? (
                                  <DropdownMenuItem onClick={() => setSelected(s)}>
                                    <Play className="h-4 w-4" /> Reactivate…
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onClick={() => setSelected(s)}>
                                    <Pause className="h-4 w-4" /> Suspend…
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => { setSelected(s); openDeleteDialog(); }}
                                >
                                  <Trash2 className="h-4 w-4" /> Delete tenant…
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span>
            {meta ? `Showing ${tenants.length} of ${meta.total} schools` : "Loading…"}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={!meta || page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (() => {
            const hasActiveSubscription = !!selected.subscription_id;
            const isSelectedDeleted = selected.is_deleted || selected.status === "deleted";
            return (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold ${isSelectedDeleted ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground"}`}>
                    {initials(selected.name)}
                  </div>
                  <div>
                    <SheetTitle className="text-left">{selected.name}</SheetTitle>
                    <p className="text-xs text-muted-foreground">{selected.id} · {isSelectedDeleted ? (selected.permanently_deleted_at ? `Deleted on ${new Date(selected.permanently_deleted_at).toLocaleDateString()}` : "Deleted") : ((selected.email && selected.email.trim()) || "No admin email")}</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <StatusBadge status={selected.status} />
                  {!isSelectedDeleted && <PlanBadge name={selected.plan_name} />}
                </div>
              </SheetHeader>

              {isSelectedDeleted && (
                <div className="mb-4 flex gap-2 rounded-lg border border-muted bg-muted/40 p-3 text-xs">
                  <Trash2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground">School Deleted</p>
                    <p className="mt-0.5 text-muted-foreground">
                      This school has been permanently deleted. Its name is preserved here for historical and analytics purposes. All operational data has been purged.
                    </p>
                  </div>
                </div>
              )}

              {!isSelectedDeleted && !hasActiveSubscription && (
                <div className="mb-4 flex gap-2 rounded-lg border border-amber-300/50 bg-amber-50/60 p-3 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                  <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-medium text-amber-900 dark:text-amber-200">No Active Subscription</p>
                    <p className="mt-0.5 text-amber-800/80 dark:text-amber-200/80">
                      This tenant is not currently subscribed to any plan. Plan, billing cycle, and renewal
                      fields below are unavailable. All other tenant data and actions remain accessible.
                    </p>
                  </div>
                </div>
              )}

              <Tabs defaultValue="profile">
                <div className="w-full overflow-x-auto pb-0.5">
                  <TabsList className={`flex flex-nowrap w-max sm:w-full sm:grid ${isSelectedDeleted ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}>
                    <TabsTrigger value="profile" className="whitespace-nowrap">Profile</TabsTrigger>
                    <TabsTrigger value="usage" className="whitespace-nowrap">Usage</TabsTrigger>
                    <TabsTrigger value="billing" className="whitespace-nowrap">Billing</TabsTrigger>
                    {!isSelectedDeleted && <TabsTrigger value="danger" className="whitespace-nowrap">Danger</TabsTrigger>}
                  </TabsList>
                </div>

                <TabsContent value="profile" className="mt-4 space-y-3">
                  {[
                    ["Tenant ID",     selected.id],
                    ...(isSelectedDeleted ? [] : [["Admin email", (selected.email && selected.email.trim()) || "No admin email on file"]]),
                    ["Status",        selected.status],
                    ...(isSelectedDeleted
                      ? [["Deleted on", selected.permanently_deleted_at ? new Date(selected.permanently_deleted_at).toLocaleDateString() : "—"]]
                      : [
                          ["Plan",          hasActiveSubscription ? (selected.plan_name ?? "Not Subscribed") : "Not Subscribed"],
                          ["Billing cycle", hasActiveSubscription ? (selected.billing_cycle ?? "—") : "— (no subscription)"],
                          ["Expires",       hasActiveSubscription
                                              ? (selected.expires_at ? new Date(selected.expires_at).toLocaleDateString() : "—")
                                              : "— (no subscription)"],
                        ]),
                    ["Joined",        new Date(selected.created_at).toLocaleDateString()],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b pb-2 text-sm">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-medium">{v}</span>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="usage" className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    ["Students",    selected.student_count.toLocaleString()],
                    ["Staff",       selected.staff_count.toLocaleString()],
                    ...(!isSelectedDeleted ? [
                      ["MRR",         hasActiveSubscription && selected.monthly_price ? `$${selected.monthly_price}` : "—"],
                      ["Sub. status", hasActiveSubscription ? (selected.subscription_status ?? "—") : "No Active Subscription"],
                    ] : []),
                  ].map(([k, v]) => (
                    <Card key={k} className="p-4">
                      <p className="text-xs text-muted-foreground">{k}</p>
                      <p className="mt-1 text-xl font-bold">{v}</p>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="billing" className="mt-4">
                  <TenantBillingTab tenantId={selected.id} />
                </TabsContent>

                {!isSelectedDeleted && (
                  <TabsContent value="danger" className="mt-4 space-y-3">
                    <Card className="border-destructive/30 bg-destructive/5 p-4">
                      <p className="font-medium">{selected.status === "suspended" ? "Reactivate tenant" : "Suspend tenant"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selected.status === "suspended"
                          ? "Restore access for all users."
                          : "Disable access for all users until reactivated."}
                      </p>
                      <Button
                        variant="outline" size="sm" className="mt-3"
                        disabled={suspendMut.isPending || reactivateMut.isPending}
                        onClick={() => selected.status === "suspended"
                          ? reactivateMut.mutate(selected.id)
                          : suspendMut.mutate(selected.id)
                        }
                      >
                        {selected.status === "suspended" ? "Reactivate" : "Suspend"}
                      </Button>
                    </Card>
                    <Card className="border-destructive/30 bg-destructive/5 p-4">
                      <p className="font-medium text-destructive">Delete tenant</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Permanently remove this school. Refused if any financial records exist (invoices, charges, payments, or billing events).
                      </p>
                      <Button
                        variant="destructive" size="sm" className="mt-3"
                        onClick={openDeleteDialog}
                      >
                        Delete tenant…
                      </Button>
                    </Card>
                  </TabsContent>
                )}
              </Tabs>
            </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* US4 — Delete confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(o) => {
          setDeleteDialogOpen(o);
          if (!o) {
            setDeleteConfirmName("");
            setDeleteError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected?.name}?</DialogTitle>
            <DialogDescription>
              This action is irreversible. The tenant and all of its associated data will be permanently removed.
              Type the school name exactly to confirm.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              <div>
                <p className="font-medium text-destructive">Deletion refused</p>
                <p className="mt-1 text-xs text-muted-foreground">{deleteError}</p>
              </div>
            </div>
          )}

          <div className="grid gap-2 py-1">
            <Label htmlFor="delete-confirm-name">
              Type <span className="font-mono font-semibold">{selected?.name}</span> to confirm
            </Label>
            <Input
              id="delete-confirm-name"
              autoComplete="off"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={selected?.name ?? ""}
              disabled={deleteMut.isPending}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteMut.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                !selected ||
                deleteConfirmName !== selected.name ||
                deleteMut.isPending
              }
              onClick={() => selected && deleteMut.mutate(selected.id)}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete forever"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
