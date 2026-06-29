import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PlayCircle,
  RotateCcw,
  Users,
} from "lucide-react";

import { FeeRuleGenerationResult } from "@/api/api";
import { UseFeeRulesResult } from "@/hooks/useFeeRules";
import { useAuth } from "@/contexts/AuthContext";

interface FeeRuleGenerationPanelProps {
  feeRules: UseFeeRulesResult;
}

function formatAmount(amount: number) {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function FeeRuleGenerationPanel({ feeRules }: FeeRuleGenerationPanelProps) {
  const { user } = useAuth();
  const canGenerate =
    user?.role === "admin" || user?.role === "super_admin" || user?.role === "bursar";

  const {
    rules,
    billingMeta,
    unbilledAlert,
    generating,
    generate,
    rollbackLoading,
    rollbackVoiding,
    latestRollbackBatch,
    rollbackError,
    fetchLatestRollbackBatch,
    voidLatestRollbackBatch,
  } = feeRules;

  const [period, setPeriod] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState("");
  const [lastResult, setLastResult] = useState<FeeRuleGenerationResult | null>(null);

  // Initialise period to current once meta arrives
  useEffect(() => {
    if (billingMeta && !period) {
      setPeriod(billingMeta.currentPeriod);
    }
  }, [billingMeta, period]);

  const activeRules = useMemo(() => rules.filter((r) => r.isActive), [rules]);
  const cycleLabel  = billingMeta?.structureType === "monthly" ? "month" : "term";
  const cycleDisplay = billingMeta?.structureType === "monthly"
    ? "Monthly"
    : billingMeta?.structureType === "termly"
      ? "Termly"
      : "Not configured";
  const selectedPeriodLabel = billingMeta?.availablePeriods.find((p) => p.value === period)?.label ?? (period || "Select period");
  const unbilledCount = unbilledAlert?.unbilledStudentCount ?? 0;
  const hasUnbilled = Boolean(unbilledAlert && unbilledAlert.unbilledStudentCount > 0);

  const handleGenerate = async () => {
    setConfirmOpen(false);
    if (!period) return;
    const result = await generate({ billingPeriod: period });
    if (result) setLastResult(result);
  };

  const handleOpenRollback = async () => {
    const batch = await fetchLatestRollbackBatch();
    if (batch) setRollbackOpen(true);
  };

  const handleVoidRollback = async () => {
    const result = await voidLatestRollbackBatch(rollbackReason.trim() || undefined);
    if (result) {
      setRollbackOpen(false);
      setRollbackReason("");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <PlayCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Tuition Charge Generation</CardTitle>
              <CardDescription>
                Creates a charge on each eligible student's ledger for the selected billing period, based on your active tuition rules. Duplicate charges for the same student and period are skipped automatically.
              </CardDescription>
            </div>
          </div>

          {hasUnbilled ? (
            <Badge variant="destructive" className="flex items-center gap-1 shrink-0">
              <AlertCircle className="h-3.5 w-3.5" />
              {unbilledCount} student{unbilledCount !== 1 ? "s" : ""} unbilled
            </Badge>
          ) : (
            <Badge variant="outline" className="w-fit bg-background shrink-0">
              {unbilledAlert ? "All students billed" : "Checking…"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-6">
        {/* Period picker + action row */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1 space-y-2 max-w-md">
            <Label htmlFor="fee-rule-billing-period">Billing period</Label>
            <Select value={period} onValueChange={setPeriod} disabled={!billingMeta || generating}>
              <SelectTrigger id="fee-rule-billing-period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {billingMeta?.availablePeriods.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Billing cycle: <span className="font-medium">{cycleDisplay}</span>
              {billingMeta && " · change this under Tuition Structure → Billing Configuration"}
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={!canGenerate || rollbackLoading || rollbackVoiding}
              onClick={handleOpenRollback}
              title="Void (undo) the most recently generated fee-rule charge batch"
            >
              {rollbackLoading || rollbackVoiding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              Rollback latest
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={!canGenerate || !period || activeRules.length === 0 || generating}
              onClick={() => setConfirmOpen(true)}
              title="Generate charges for all eligible students under the active tuition rules"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="h-4 w-4 mr-2" />
              )}
              Generate charges
            </Button>
          </div>
        </div>

        {!canGenerate && (
          <p className="text-xs text-muted-foreground">
            Your role ({user?.role}) can view billing information but only admins and bursars can generate or rollback charges.
          </p>
        )}

        {rollbackError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {rollbackError}
          </div>
        )}

        {activeRules.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">No active tuition rules</p>
            <p className="mt-0.5 text-xs">Go to <strong>Tuition Structure → Tuition Rules</strong> and activate at least one rule before generating charges.</p>
          </div>
        )}

        {/* Unbilled alert summary */}
        {unbilledAlert && (
          <div
            className={
              hasUnbilled
                ? "rounded-xl border border-destructive/20 bg-destructive/5 p-4 flex items-center gap-3"
                : "rounded-xl border border-green-200 bg-green-50/70 p-4 flex items-center gap-3 dark:border-green-800 dark:bg-green-950/20"
            }
          >
            <Users className={hasUnbilled ? "h-5 w-5 text-destructive shrink-0" : "h-5 w-5 text-green-700 dark:text-green-400 shrink-0"} />
            <div className="text-sm">
              {hasUnbilled ? (
                <>
                  <span className="font-medium text-destructive">{unbilledAlert.unbilledStudentCount}</span> of{" "}
                  <span className="font-medium">{unbilledAlert.eligibleStudentCount}</span> active students have not been charged for the current {cycleLabel}{" "}
                  <span className="text-muted-foreground">({unbilledAlert.billingPeriod || "—"})</span>. Select that period above and click <strong>Generate charges</strong>.
                </>
              ) : (
                <>
                  All <span className="font-medium">{unbilledAlert.eligibleStudentCount}</span> active students have been charged for the current {cycleLabel}{" "}
                  <span className="text-muted-foreground">({unbilledAlert.billingPeriod || "—"})</span>.
                </>
              )}
            </div>
          </div>
        )}

        {/* Result table */}
        {lastResult && (
          <div className="rounded-xl border border-green-200 bg-green-50/70 p-4 dark:border-green-800 dark:bg-green-950/20">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-400 mt-0.5" />
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    Fee-rule billing completed for {lastResult.billingPeriod}
                  </p>
                  {lastResult.descriptionLabel && (
                    <p className="mt-1 text-xs text-muted-foreground">{lastResult.descriptionLabel}</p>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg bg-background/80 p-3">
                    <p className="text-xs text-muted-foreground">Charges created</p>
                    <p className="text-lg font-semibold tabular-nums">{lastResult.generatedCount}</p>
                  </div>
                  <div className="rounded-lg bg-background/80 p-3">
                    <p className="text-xs text-muted-foreground">Duplicates skipped</p>
                    <p className="text-lg font-semibold tabular-nums">{lastResult.skippedDuplicateCount}</p>
                  </div>
                  <div className="rounded-lg bg-background/80 p-3">
                    <p className="text-xs text-muted-foreground">Total billed</p>
                    <p className="text-lg font-semibold tabular-nums">{formatAmount(lastResult.totalAmount)}</p>
                  </div>
                </div>

                {lastResult.perRule.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Rule</TableHead>
                          <TableHead className="text-right">Students charged</TableHead>
                          <TableHead className="text-right">Total amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lastResult.perRule.map((row) => (
                          <TableRow key={row.feeRuleId}>
                            <TableCell>{row.name}</TableCell>
                            <TableCell className="text-right tabular-nums">{row.studentsCharged}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatAmount(row.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate charges for {selectedPeriodLabel}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This will add a charge to the ledger of every eligible student covered by your{" "}
                  {activeRules.length} active tuition rule{activeRules.length === 1 ? "" : "s"}.
                  Students who already have a charge for this period and rule will be skipped — this action is safe to re-run.
                </p>
                <p className="text-xs text-muted-foreground">
                  If charge proration is enabled in Tuition Structure, students who enrolled mid-period receive a reduced charge proportional to their remaining days in the period.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate}>Generate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rollbackOpen} onOpenChange={setRollbackOpen}>
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Void latest tuition rule charge batch?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {latestRollbackBatch ? (
                <span className="space-y-2 block">
                  <span className="block font-medium text-foreground">{latestRollbackBatch.descriptionLabel}</span>
                  <span className="block">
                    This will void {latestRollbackBatch.chargeCount} charge
                    {latestRollbackBatch.chargeCount === 1 ? "" : "s"} for {latestRollbackBatch.affectedStudentCount} student
                    {latestRollbackBatch.affectedStudentCount === 1 ? "" : "s"}, totaling{" "}
                    {latestRollbackBatch.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
                  </span>
                </span>
              ) : (
                "No latest tuition rule charge batch is loaded."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fee-rule-rollback-reason">Rollback reason</Label>
            <Input
              id="fee-rule-rollback-reason"
              value={rollbackReason}
              onChange={(event) => setRollbackReason(event.target.value)}
              placeholder="Reason for rollback"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollbackVoiding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!latestRollbackBatch || rollbackVoiding}
              onClick={handleVoidRollback}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {rollbackVoiding ? "Voiding…" : "Void latest batch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
