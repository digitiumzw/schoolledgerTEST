/**
 * FeeCampaignDetail Page (Feature 059 — Fee Campaigns)
 *
 * Shows campaign summary, student list with payment status, and actions
 * (record payment, add/remove student, close campaign).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  DollarSign,
  Users,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  UserPlus,
  UserMinus,
  Lock,
  Loader2,
  Search,
  Pencil,
  Archive,
  Ban,
  Receipt,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import {
  api,
  FeeCampaign,
  CampaignStudent,
  CampaignStudentStatus,
  CampaignPaymentRecord,
  RecordCampaignPaymentInput,
} from "@/api/api";
import { CampaignPaymentModal } from "@/components/modals/CampaignPaymentModal";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";

export default function FeeCampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [campaign, setCampaign] = useState<FeeCampaign | null>(null);
  const [students, setStudents] = useState<CampaignStudent[]>([]);
  const [payments, setPayments] = useState<CampaignPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Void payment dialog
  const [voidPayment, setVoidPayment] = useState<CampaignPaymentRecord | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // Payment modal
  const [payStudent, setPayStudent] = useState<CampaignStudent | null>(null);

  // Edit campaign dialog
  const [showEditCampaign, setShowEditCampaign] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");

  // Add student dialog
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; firstName: string; lastName: string; className?: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!showAddStudent) {
      setStudentSearch("");
      setSearchResults([]);
      return;
    }
    if (studentSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const results = await api.searchStudents(studentSearch, undefined, 10);
        setSearchResults(Array.isArray(results) ? results : results?.students ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, [studentSearch, showAddStudent]);

  const openEditDialog = () => {
    if (!campaign) return;
    setEditName(campaign.name);
    setEditDescription(campaign.description ?? "");
    setEditDueDate(campaign.dueDate ? campaign.dueDate.slice(0, 10) : "");
    setShowEditCampaign(true);
  };

  const handleEditCampaign = async () => {
    if (!id) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      setSaving(true);
      const updated = await api.updateFeeCampaign(id, {
        name: trimmed,
        description: editDescription.trim() || undefined,
        dueDate: editDueDate || null,
      });
      setCampaign((prev) => prev ? { ...prev, ...updated } : updated);
      setShowEditCampaign(false);
      toast({ title: "Campaign updated" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Could not update campaign",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddStudent = async (studentId: string) => {
    if (!id) return;
    try {
      setSaving(true);
      await api.addCampaignStudent(id, studentId);
      toast({ title: "Student added to campaign" });
      setShowAddStudent(false);
      await loadData();
    } catch (err) {
      toast({
        title: "Add failed",
        description: err instanceof Error ? err.message : "Could not add student",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const loadData = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [c, s, p] = await Promise.all([
        api.getFeeCampaign(id),
        api.getCampaignStudents(id),
        api.getCampaignPayments(id),
      ]);
      setCampaign(c);
      setStudents(s);
      setPayments(p);
    } catch (err) {
      toast({
        title: "Failed to load campaign",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredStudents =
    statusFilter === "all" ? students : students.filter((s) => s.status === statusFilter);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const progress =
    campaign?.summary && campaign.summary.totalExpected > 0
      ? Math.round((campaign.summary.totalCollected / campaign.summary.totalExpected) * 100)
      : 0;

  const handleRecordPayment = async (input: RecordCampaignPaymentInput) => {
    if (!id) return null;
    try {
      setSaving(true);
      const result = await api.recordCampaignPayment(id, input);
      toast({ title: "Payment recorded", description: `${formatCurrency(input.amount)} received` });
      await loadData();
      return result;
    } catch (err) {
      toast({
        title: "Payment failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStudent = async (studentId: string, hasPaid: boolean) => {
    if (!id) return;
    try {
      setSaving(true);
      await api.removeCampaignStudent(id, studentId, hasPaid);
      toast({ title: "Student removed" });
      await loadData();
    } catch (err) {
      toast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVoidPayment = async () => {
    if (!id || !voidPayment) return;
    const reason = voidReason.trim();
    if (!reason) return;
    try {
      setSaving(true);
      await api.voidCampaignPayment(id, voidPayment.id, reason);
      toast({ title: "Payment voided", description: `${formatCurrency(voidPayment.amount)} reversed` });
      setVoidPayment(null);
      setVoidReason("");
      await loadData();
    } catch (err) {
      toast({
        title: "Void failed",
        description: err instanceof Error ? err.message : "Could not void payment",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseCampaign = async (force: boolean) => {
    if (!id) return;
    try {
      setSaving(true);
      await api.closeFeeCampaign(id, force);
      toast({ title: "Campaign closed" });
      await loadData();
    } catch (err) {
      toast({
        title: "Close failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const scopeLabel = (c: FeeCampaign): string => {
    switch (c.targetScopeType) {
      case "school_wide": return "School-wide";
      case "class": {
        const ids = Array.isArray(c.targetScopeId) ? c.targetScopeId : c.targetScopeId ? [c.targetScopeId] : [];
        return ids.length > 1 ? `${ids.length} classes` : "By Class";
      }
      case "students": {
        const ids = Array.isArray(c.targetScopeId) ? c.targetScopeId : c.targetScopeId ? [c.targetScopeId] : [];
        return `Individual (${ids.length} student${ids.length !== 1 ? "s" : ""})`;
      }
      default: return c.targetScopeType;
    }
  };

  const statusBadge = (status: CampaignStudentStatus) => {
    switch (status) {
      case "fully_paid":
        return (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Paid
          </Badge>
        );
      case "partially_paid":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" /> Partial
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-red-600 border-red-300">
            <XCircle className="h-3 w-3 mr-1" /> Unpaid
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Campaign not found</p>
        <Button variant="link" onClick={() => navigate("/fee-campaigns")}>
          Back to campaigns
        </Button>
      </div>
    );
  }

  const s = campaign.summary;
  const isActive = campaign.status === "active";
  const closedAt = !isActive && campaign.updatedAt
    ? new Date(campaign.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <SubscriptionGuard>
    <div className="space-y-6">
      {/* Closed campaign banner */}
      {!isActive && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-900">
          <Archive className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <span className="font-medium">This campaign is closed.</span> This is a read-only historical snapshot.
            {closedAt && <span className="ml-1">Closed on {closedAt}.</span>}
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/fee-campaigns")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold flex flex-wrap items-center gap-2">
              <span className="truncate">{campaign.name}</span>
              <Badge variant={isActive ? "default" : "secondary"}>
                {campaign.status}
              </Badge>
            </h1>
            {campaign.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{campaign.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              Scope: {scopeLabel(campaign)}
            </p>
          </div>
        </div>

        {isActive && (
          <div className="flex items-center gap-2 shrink-0 pl-12 sm:pl-0">
            <Button variant="outline" size="sm" onClick={openEditDialog} disabled={saving}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
            <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={saving}>
                <Lock className="mr-2 h-4 w-4" /> Close Campaign
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Close Campaign?</AlertDialogTitle>
                <AlertDialogDescription>
                  {s && s.unpaidCount + s.partiallyPaidCount > 0
                    ? `${s.unpaidCount + s.partiallyPaidCount} student(s) still have outstanding balances. This action cannot be undone.`
                    : "All students are fully paid. This action cannot be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleCloseCampaign(true)}>
                  Close Campaign
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Users className="h-4 w-4" /> Students
            </div>
            <p className="text-2xl font-bold mt-1">{s?.totalStudents ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" /> Collected
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(s?.totalCollected ?? 0)}</p>
            <p className="text-xs text-muted-foreground">
              of {formatCurrency(s?.totalExpected ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <DollarSign className="h-4 w-4" /> Outstanding
            </div>
            <p className="text-2xl font-bold mt-1 text-red-600">
              {formatCurrency(s?.totalOutstanding ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="h-4 w-4" /> Due Date
            </div>
            <p className="text-2xl font-bold mt-1">
              {campaign.dueDate
                ? new Date(campaign.dueDate).toLocaleDateString()
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-sm mb-2">
            <span>Collection Progress</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1 text-green-600">
              <CheckCircle2 className="h-3 w-3" /> {s?.fullyPaidCount ?? 0} fully paid
            </span>
            <span className="flex items-center gap-1 text-yellow-600">
              <Clock className="h-3 w-3" /> {s?.partiallyPaidCount ?? 0} partial
            </span>
            <span className="flex items-center gap-1 text-red-600">
              <XCircle className="h-3 w-3" /> {s?.unpaidCount ?? 0} unpaid
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Students / Payments */}
      <Tabs defaultValue="students">
        <TabsList>
          <TabsTrigger value="students"><Users className="h-3.5 w-3.5 mr-1.5" />Students</TabsTrigger>
          <TabsTrigger value="payments"><Receipt className="h-3.5 w-3.5 mr-1.5" />Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="students">
      {/* Student table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">Students</CardTitle>
              {isActive && (
                <Button size="sm" variant="outline" onClick={() => setShowAddStudent(true)} disabled={saving}>
                  <UserPlus className="h-3.5 w-3.5 mr-1" /> Add Student
                </Button>
              )}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partially_paid">Partial</SelectItem>
                <SelectItem value="fully_paid">Fully Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No students found</p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((cs) => (
                  <TableRow key={cs.id}>
                    <TableCell className="font-medium">{cs.studentName ?? cs.studentId}</TableCell>
                    <TableCell>{cs.className ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cs.expectedAmount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cs.paidAmount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(cs.remainingAmount)}</TableCell>
                    <TableCell>{statusBadge(cs.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {isActive && cs.status !== "fully_paid" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPayStudent(cs)}
                            disabled={saving}
                          >
                            <DollarSign className="h-3.5 w-3.5 mr-1" /> Pay
                          </Button>
                        )}
                        {isActive && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={saving}>
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Student?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {cs.paidAmount > 0
                                    ? "This student has existing payments. Payment records will be preserved but the student will be removed from the campaign."
                                    : "Remove this student from the campaign?"}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleRemoveStudent(cs.studentId, cs.paidAmount > 0)
                                  }
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        {/* ── Payment History Tab ── */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment History</CardTitle>
              <p className="text-xs text-muted-foreground">
                All payments including voided records. Void a payment to reverse it and update the student's balance.
              </p>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No payments recorded yet</p>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      {isActive && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id} className={p.isVoided ? "opacity-50" : ""}>
                        <TableCell>
                          <div className="font-medium">{p.studentName ?? p.studentId}</div>
                          {p.className && <div className="text-xs text-muted-foreground">{p.className}</div>}
                        </TableCell>
                        <TableCell className="text-sm">{p.date}</TableCell>
                        <TableCell className="text-sm">{p.method}</TableCell>
                        <TableCell className="text-xs font-mono">{p.receiptNumber ?? "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={p.isVoided ? "line-through text-muted-foreground" : ""}>
                            {formatCurrency(p.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {p.isVoided ? (
                            <div>
                              <Badge variant="outline" className="text-red-600 border-red-300 text-xs">
                                <Ban className="h-3 w-3 mr-1" /> Voided
                              </Badge>
                              {p.voidReason && (
                                <p className="text-xs text-muted-foreground mt-0.5 max-w-[180px] truncate" title={p.voidReason}>
                                  {p.voidReason}
                                </p>
                              )}
                            </div>
                          ) : (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Active
                            </Badge>
                          )}
                        </TableCell>
                        {isActive && (
                          <TableCell className="text-right">
                            {!p.isVoided && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => { setVoidPayment(p); setVoidReason(""); }}
                                disabled={saving}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1" /> Void
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Campaign Dialog */}
      <Dialog open={showEditCampaign} onOpenChange={(v) => !v && setShowEditCampaign(false)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Edit Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name <span className="text-red-500">*</span></Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Campaign name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-due-date">Due Date</Label>
              <Input
                id="edit-due-date"
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditCampaign(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleEditCampaign} disabled={saving || !editName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Payment Dialog */}
      <Dialog open={!!voidPayment} onOpenChange={(v) => !v && setVoidPayment(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Void Payment</DialogTitle>
          </DialogHeader>
          {voidPayment && (
            <div className="space-y-4 py-2">
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student</span>
                  <span className="font-medium">{voidPayment.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium text-red-700">{formatCurrency(voidPayment.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt</span>
                  <span className="font-mono text-xs">{voidPayment.receiptNumber ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span>{voidPayment.date}</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Voiding this payment will reverse the amount and update the student's campaign balance. The original record is preserved for audit purposes.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="void-reason">Reason <span className="text-red-500">*</span></Label>
                <Textarea
                  id="void-reason"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Explain why this payment is being voided..."
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidPayment(null)} disabled={saving}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleVoidPayment}
              disabled={saving || !voidReason.trim()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
              Void Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={showAddStudent} onOpenChange={(v) => !v && setShowAddStudent(false)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add Student to Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                autoFocus
              />
            </div>
            {searchLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
            {!searchLoading && searchResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-56 overflow-y-auto">
                {searchResults.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                    onClick={() => handleAddStudent(s.id)}
                    disabled={saving}
                  >
                    <span className="font-medium">{s.firstName} {s.lastName}</span>
                    {s.className && <span className="text-xs text-muted-foreground">{s.className}</span>}
                  </button>
                ))}
              </div>
            )}
            {!searchLoading && studentSearch.trim().length >= 2 && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">No students found</p>
            )}
            {studentSearch.trim().length < 2 && (
              <p className="text-xs text-muted-foreground">Type at least 2 characters to search</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddStudent(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment modal */}
      <CampaignPaymentModal
        open={!!payStudent}
        student={payStudent}
        campaignName={campaign.name}
        onClose={() => setPayStudent(null)}
        onSubmit={handleRecordPayment}
        saving={saving}
      />
    </div>
    </SubscriptionGuard>
  );
}
