/**
 * ReconciliationTab
 * 
 * Main tab for managing financial reconciliation:
 * - Balance adjustments (credits/debits)
 * - Refund processing
 * - Audit trail viewing
 * - Summary dashboard
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Loader2,
  Plus,
  ArrowUpCircle,
  ArrowDownCircle,
  RotateCcw,
  History,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  ShieldCheck,
  GraduationCap,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import { SettingsCardSkeleton } from "./SettingsCardSkeleton";
import { CreateAdjustmentModal } from "./CreateAdjustmentModal";
import { CreateRefundModal } from "./CreateRefundModal";
import { AuditLogViewer } from "./AuditLogViewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Adjustment {
  id: string;
  studentId: string;
  studentName: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  adjustmentType: 'credit' | 'debit';
  category: string;
  amount: number;
  reason: string;
  referenceType: string;
  referenceId: string | null;
  effectiveDate: string;
  status: string;
  createdByName: string;
  createdAt: string;
}

interface Refund {
  id: string;
  studentId: string;
  studentName: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  refundType: string;
  amount: number;
  reason: string;
  refundMethod: string;
  status: string;
  originalPaymentId: string | null;
  originalChargeId: string | null;
  createdByName: string;
  createdAt: string;
}

interface Summary {
  period: { from: string; to: string };
  adjustmentsByCategory: Array<{ category: string; adjustment_type: string; count: number; total: number }>;
  refundsByStatus: Array<{ status: string; count: number; total: number }>;
  auditActionCount: number;
  pendingRefunds: number;
}


function formatAmount(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function StudentNameCell({
  name,
  id,
  firstName,
  lastName,
}: {
  name?: string;
  id: string;
  firstName?: string;
  lastName?: string;
}) {
  const composedName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  const trimmedName = name?.trim();
  const displayName = trimmedName && trimmedName !== id ? trimmedName : composedName;

  return (
    <div className="flex flex-col">
      <span className="font-medium break-words whitespace-normal">{displayName || "Unknown student"}</span>
      {!displayName && (
        <span className="text-xs text-muted-foreground">ID: {id}</span>
      )}
    </div>
  );
}

export function ReconciliationTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("adjustments");
  const dataLoadedRef = useRef(false);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("reconciliation-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("reconciliation-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };
  
  // Adjustments state
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [adjustmentFilter, setAdjustmentFilter] = useState({ category: "", status: "" });
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  
  // Refunds state
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [refundFilter, setRefundFilter] = useState({ status: "" });
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  
  // Summary state
  const [summary, setSummary] = useState<Summary | null>(null);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");

  const loadAdjustments = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (adjustmentFilter.category) params.category = adjustmentFilter.category;
      if (adjustmentFilter.status) params.status = adjustmentFilter.status;
      const data = await api.getAdjustments(params);
      setAdjustments(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load adjustments.",
        variant: "destructive",
      });
    }
  }, [adjustmentFilter, toast]);

  const loadRefunds = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (refundFilter.status) params.status = refundFilter.status;
      const data = await api.getRefunds(params);
      setRefunds(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load refunds.",
        variant: "destructive",
      });
    }
  }, [refundFilter, toast]);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.getReconciliationSummary();
      setSummary(data);
    } catch (error) {
      console.error("Failed to load summary:", error);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadAdjustments(), loadRefunds(), loadSummary()]);
    dataLoadedRef.current = true;
    setLoading(false);
  }, [loadAdjustments, loadRefunds, loadSummary]);

  useEffect(() => {
    if (dataLoadedRef.current) return;
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (dataLoadedRef.current) {
      loadAdjustments();
    }
  }, [loadAdjustments]);

  useEffect(() => {
    if (dataLoadedRef.current) {
      loadRefunds();
    }
  }, [loadRefunds]);

  const handleVoidAdjustment = async (id: string) => {
    const reason = prompt("Enter reason for voiding this adjustment:");
    if (!reason) return;

    try {
      await api.voidAdjustment(id, reason);
      toast({
        title: "Adjustment Voided",
        description: "The adjustment has been voided successfully.",
      });
      loadAdjustments();
      loadSummary();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to void adjustment.",
        variant: "destructive",
      });
    }
  };

  const handleProcessRefund = async (id: string) => {
    const referenceNumber = prompt("Enter reference number (optional):");

    try {
      await api.processRefund(id, referenceNumber || undefined);
      toast({
        title: "Refund Processed",
        description: "The refund has been marked as processed.",
      });
      loadRefunds();
      loadSummary();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process refund.",
        variant: "destructive",
      });
    }
  };

  const handleCompleteRefund = async (id: string) => {
    try {
      await api.completeRefund(id);
      toast({
        title: "Refund Completed",
        description: "The refund has been marked as completed.",
      });
      loadRefunds();
      loadSummary();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to complete refund.",
        variant: "destructive",
      });
    }
  };

  const handleCancelRefund = async (id: string) => {
    const reason = prompt("Enter reason for cancelling this refund:");
    if (!reason) return;

    try {
      await api.cancelRefund(id, reason);
      toast({
        title: "Refund Cancelled",
        description: "The refund has been cancelled.",
      });
      loadRefunds();
      loadSummary();
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel refund.",
        variant: "destructive",
      });
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    return "bg-muted text-foreground";
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, LucideIcon> = {
      approved: CheckCircle,
      pending: Clock,
      rejected: XCircle,
      voided: AlertCircle,
      processed: RefreshCw,
      completed: CheckCircle,
      cancelled: XCircle,
    };
    const Icon = config[status] || Clock;
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-foreground border">
        <Icon className="h-3 w-3" />
        <span className="capitalize">{status.replace(/_/g, ' ')}</span>
      </div>
    );
  };

  const filteredAdjustments = adjustments.filter(adj =>
    searchQuery === "" ||
    adj.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    adj.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRefunds = refunds.filter(ref =>
    searchQuery === "" ||
    ref.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ref.reason.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const creditTotal = summary?.adjustmentsByCategory
    ?.filter(a => a.adjustment_type === 'credit')
    .reduce((sum, a) => sum + parseFloat(String(a.total || 0)), 0) ?? 0;
  const debitTotal = summary?.adjustmentsByCategory
    ?.filter(a => a.adjustment_type === 'debit')
    .reduce((sum, a) => sum + parseFloat(String(a.total || 0)), 0) ?? 0;
  const activeAdjustmentCount = adjustments.filter(adj => adj.status !== 'voided').length;
  const pendingRefundCount = summary?.pendingRefunds ?? refunds.filter(ref => ref.status === 'pending').length;
  const auditActionCount = summary?.auditActionCount ?? 0;
  const summaryPeriod = summary?.period?.from && summary?.period?.to
    ? `${summary.period.from} → ${summary.period.to}`
    : "Current reporting window";

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCardSkeleton rows={4} />
        <SettingsCardSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)}>
          <HelpCircle className="h-4 w-4 mr-2" />
          Reconciliation guide
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Adjustments"
          value={`${adjustments.length}`}
          sub={`${activeAdjustmentCount} active this period`}
          icon={RotateCcw}
        />
        <StatCard
          label="Pending Refunds"
          value={`${pendingRefundCount}`}
          sub="Awaiting processing"
          icon={Clock}
        />
        <StatCard
          label="Total Credits"
          value={formatAmount(creditTotal)}
          sub={summaryPeriod}
          icon={ArrowDownCircle}
        />
        <StatCard
          label="Total Debits"
          value={formatAmount(debitTotal)}
          sub={summaryPeriod}
          icon={ArrowUpCircle}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 px-6 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">Adjustments &amp; Refunds</CardTitle>
                  <CardDescription className="mt-1">
                    Manage balance corrections and refund requests
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by student or reason..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Button variant="outline" size="icon" onClick={loadData} title="Refresh data">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="border-b bg-muted/20 px-6 pt-4">
                  <TabsList className="bg-transparent p-0 gap-1">
                    <TabsTrigger
                      value="adjustments"
                      className="gap-2 rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Adjustments
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {filteredAdjustments.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger
                      value="refunds"
                      className="gap-2 rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-2"
                    >
                      <ArrowDownCircle className="h-4 w-4" />
                      Refunds
                      <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                        {filteredRefunds.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger
                      value="audit"
                      className="gap-2 rounded-b-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:shadow-none px-4 py-2"
                    >
                      <History className="h-4 w-4" />
                      Audit Log
                    </TabsTrigger>
                  </TabsList>
                </div>
                <div className="p-6">
                  <TabsContent value="adjustments" className="space-y-4 mt-0">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2">
                      <Select
                        value={adjustmentFilter.category || "all"}
                        onValueChange={(value) => setAdjustmentFilter(prev => ({ ...prev, category: value === "all" ? "" : value }))}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          <SelectItem value="correction">Correction</SelectItem>
                          <SelectItem value="refund">Refund</SelectItem>
                          <SelectItem value="write_off">Write Off</SelectItem>
                          <SelectItem value="fee_waiver">Fee Waiver</SelectItem>
                          <SelectItem value="late_fee">Late Fee</SelectItem>
                          <SelectItem value="penalty">Penalty</SelectItem>
                          <SelectItem value="discount">Discount</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={adjustmentFilter.status || "all"}
                        onValueChange={(value) => setAdjustmentFilter(prev => ({ ...prev, status: value === "all" ? "" : value }))}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="All Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="voided">Voided</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => setAdjustmentModalOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      New Adjustment
                    </Button>
                  </div>

                  <div className="rounded-xl border bg-background overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[100px]">Date</TableHead>
                          <TableHead className="w-[140px]">Student</TableHead>
                          <TableHead className="w-[80px]">Type</TableHead>
                          <TableHead className="w-[110px]">Category</TableHead>
                          <TableHead className="text-right w-[100px]">Amount</TableHead>
                          <TableHead className="w-[180px]">Reason</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="w-[80px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAdjustments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                              <div className="flex flex-col items-center gap-2">
                                <RotateCcw className="h-8 w-8 opacity-40" />
                                <p>No adjustments found</p>
                                <p className="text-sm opacity-60">Try adjusting your filters or create a new adjustment</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAdjustments.map((adj) => (
                            <TableRow key={adj.id} className={adj.status === 'voided' ? 'opacity-50 bg-muted/20' : ''}>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {adj.effectiveDate}
                              </TableCell>
                              <TableCell>
                                <StudentNameCell
                                  name={adj.studentName}
                                  id={adj.studentId}
                                  firstName={adj.firstName ?? adj.first_name}
                                  lastName={adj.lastName ?? adj.last_name}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-muted border">
                                  {adj.adjustmentType === 'credit' ? (
                                    <ArrowDownCircle className="h-3 w-3" />
                                  ) : (
                                    <ArrowUpCircle className="h-3 w-3" />
                                  )}
                                  {adj.adjustmentType}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${getCategoryBadgeColor(adj.category)}`}>
                                  {adj.category.replace(/_/g, ' ')}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">
                                {adj.adjustmentType === 'credit' ? '-' : '+'}${adj.amount.toFixed(2)}
                              </TableCell>
                              <TableCell className="max-w-[180px]">
                                <p className="truncate text-sm" title={adj.reason}>{adj.reason}</p>
                              </TableCell>
                              <TableCell>{getStatusBadge(adj.status)}</TableCell>
                              <TableCell className="text-right">
                                {adj.status === 'approved' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleVoidAdjustment(adj.id)}
                                  >
                                    Void
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="refunds" className="space-y-4 mt-0">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <Select
                      value={refundFilter.status || "all"}
                      onValueChange={(value) => setRefundFilter({ status: value === "all" ? "" : value })}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="processed">Processed</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => setRefundModalOpen(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      New Refund
                    </Button>
                  </div>

                  <div className="rounded-xl border bg-background overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="w-[100px]">Date</TableHead>
                          <TableHead className="w-[140px]">Student</TableHead>
                          <TableHead className="w-[80px]">Type</TableHead>
                          <TableHead className="text-right w-[100px]">Amount</TableHead>
                          <TableHead className="w-[100px]">Method</TableHead>
                          <TableHead className="w-[160px]">Reason</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="w-[140px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRefunds.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                              <div className="flex flex-col items-center gap-2">
                                <ArrowDownCircle className="h-8 w-8 opacity-40" />
                                <p>No refunds found</p>
                                <p className="text-sm opacity-60">Try adjusting your filters or create a new refund</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRefunds.map((ref) => (
                            <TableRow key={ref.id} className={ref.status === 'cancelled' ? 'opacity-50 bg-muted/20' : ''}>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {ref.createdAt?.split(' ')[0]}
                              </TableCell>
                              <TableCell>
                                <StudentNameCell
                                  name={ref.studentName}
                                  id={ref.studentId}
                                  firstName={ref.firstName ?? ref.first_name}
                                  lastName={ref.lastName ?? ref.last_name}
                                />
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted border">
                                  {ref.refundType}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">
                                ${ref.amount.toFixed(2)}
                              </TableCell>
                              <TableCell className="capitalize text-sm text-muted-foreground">
                                {ref.refundMethod?.replace(/_/g, ' ')}
                              </TableCell>
                              <TableCell className="max-w-[160px]">
                                <p className="truncate text-sm" title={ref.reason}>{ref.reason}</p>
                              </TableCell>
                              <TableCell>{getStatusBadge(ref.status)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {ref.status === 'pending' && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleProcessRefund(ref.id)}
                                      >
                                        Process
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCancelRefund(ref.id)}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                  {ref.status === 'processed' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleCompleteRefund(ref.id)}
                                    >
                                      Complete
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="audit" className="mt-0">
                  <div className="rounded-xl border bg-background overflow-hidden">
                    <div className="border-b bg-muted/30 px-4 py-3 flex items-center gap-3">
                      <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-medium">Audit Trail</h3>
                        <p className="text-xs text-muted-foreground">
                          Review reconciliation actions and charge rollback events
                        </p>
                      </div>
                    </div>
                    <div className="p-4">
                      <AuditLogViewer />
                    </div>
                  </div>
                </TabsContent>
              </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-primary/5 to-primary/10 border-b px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="rounded-lg bg-primary/10 p-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                </div>
                Guardrails
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Best practices for balance corrections
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {[
                ["Verify", "Confirm student, transaction, and reason before proceeding."],
                ["Separate", "Use refunds for money returned; adjustments for ledger corrections."],
                ["Audit", "Keep reasons clear for finance review and compliance."],
                ["Void", "Void approved adjustments instead of deleting records."],
              ].map(([title, detail], i, arr) => (
                <div key={title} className={`px-5 py-3 ${i !== arr.length - 1 ? 'border-b' : ''} hover:bg-muted/30 transition-colors`}>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 border-b px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="rounded-lg bg-slate-200 dark:bg-slate-700 p-1.5">
                  <History className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                </div>
                Activity Summary
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Current period overview
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {([
                { label: "Audit actions", value: auditActionCount, icon: FileText },
                { label: "Active adjustments", value: filteredAdjustments.filter(a => a.status !== 'voided').length, icon: RotateCcw },
                { label: "Pending refunds", value: refunds.filter(r => r.status === 'pending').length, icon: Clock },
              ] as { label: string; value: number; icon: LucideIcon }[]).map(({ label, value, icon: Icon }, i, arr) => (
                <div key={label} className={`flex items-center justify-between px-5 py-3 ${i !== arr.length - 1 ? 'border-b' : ''} hover:bg-muted/30 transition-colors`}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{label}</span>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Getting Started with Reconciliation
            </DialogTitle>
            <DialogDescription>
              How to manage balance adjustments, refunds, and the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "Balance Adjustments", "Create credit or debit adjustments to correct a student ledger. Credits reduce what a student owes; debits increase it. Always include a clear reason.", ArrowDownCircle],
              ["2", "When to Adjust", "Use adjustments for corrections, waivers, penalties, or write-offs. Use refunds only when money is actually being returned to a payer.", ShieldCheck],
              ["3", "Refund Workflow", "Request a refund, then process it and mark it complete as the money moves through your channels. Cancelled refunds remain visible for audit.", ArrowUpCircle],
              ["4", "Voiding Adjustments", "Approved adjustments can be voided with a reason. This preserves the audit trail instead of erasing history.", RotateCcw],
              ["5", "Audit Log", "The Audit trail records every reconciliation action and charge-batch rollback. Use it to review changes and trace financial events across time.", History],
            ].map(([step, title, detail, Icon]) => (
              <div key={step} className="flex items-start gap-3 border-b py-2.5 last:border-0">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                  {step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold">{title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="rec-dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="rec-dont-show-again" className="text-sm cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
            <Button onClick={handleDismissOnboarding}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <CreateAdjustmentModal
        open={adjustmentModalOpen}
        onOpenChange={setAdjustmentModalOpen}
        onSuccess={() => {
          loadAdjustments();
          loadSummary();
        }}
      />

      <CreateRefundModal
        open={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        onSuccess={() => {
          loadRefunds();
          loadSummary();
        }}
      />
    </div>
  );
}
