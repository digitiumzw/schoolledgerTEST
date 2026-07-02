import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Bus,
  CheckCircle2,
  HelpCircle,
  Loader2,
  Receipt,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/api/api";
import { useFeeRules } from "@/hooks/useFeeRules";
import { useChargeBatchRollback } from "@/hooks/useChargeBatchRollback";
import { useCurrencyConfig } from "@/hooks/useCurrencyConfig";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeeRuleGenerationPanel } from "./FeeRuleGenerationPanel";

type TransportGenerationResult = {
  created: number;
  skipped: number;
  month: string;
  descriptionLabel?: string;
  totalAmount?: number;
};

function formatMonthLabel(month: string) {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    return "Select month";
  }

  return new Date(year, monthIndex, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function formatAmount(amount?: number | null) {
  if (typeof amount !== "number") return "—";

  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function BillingTab() {
  const { toast } = useToast();
  const feeRules = useFeeRules();
  const transportRollback = useChargeBatchRollback("transport");

  const [transportMonth, setTransportMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [transportRunning, setTransportRunning] = useState(false);
  const [transportResult, setTransportResult] = useState<TransportGenerationResult | null>(null);
  const [transportRollbackOpen, setTransportRollbackOpen] = useState(false);
  const [transportRollbackReason, setTransportRollbackReason] = useState("");

  // Multi-currency (Feature 094)
  const { data: currencyConfig } = useCurrencyConfig();
  const [transportCurrency, setTransportCurrency] = useState<string>('');

  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("billing-workflow-dismissed");
    if (!dismissed) {
      setWorkflowOpen(true);
    }
  }, []);

  const handleDismissWorkflow = () => {
    if (dontShowAgain) {
      localStorage.setItem("billing-workflow-dismissed", "true");
    }
    setWorkflowOpen(false);
    setDontShowAgain(false);
  };

  const activeFeeRuleCount = feeRules.rules.filter((rule) => rule.isActive).length;
  const totalFeeRuleCount = feeRules.rules.length;
  const billingCycleLabel = feeRules.billingMeta?.structureType === "monthly"
    ? "Monthly"
    : feeRules.billingMeta?.structureType === "termly"
      ? "Termly"
      : "Loading";
  const currentPeriodLabel = feeRules.billingMeta?.availablePeriods.find(
    (period) => period.value === feeRules.billingMeta?.currentPeriod,
  )?.label ?? feeRules.billingMeta?.currentPeriod ?? "—";
  const unbilledCount = feeRules.unbilledAlert?.unbilledStudentCount;
  const transportMonthLabel = formatMonthLabel(transportMonth);
  const transportRollbackBusy = transportRollback.loading || transportRollback.voiding;

  const handleGenerateTransportCharges = async () => {
    setTransportRunning(true);
    setTransportResult(null);
    try {
      const result = await api.generateTransportCharges(
        transportMonth,
        transportCurrency && transportCurrency !== currencyConfig?.baseCurrency ? transportCurrency : undefined,
      );
      setTransportResult(result);
      toast({
        title: "Transport charges generated",
        description: `${result.created} charge${result.created !== 1 ? 's' : ''} created, ${result.skipped} already existed.`,
      });
    } catch (error: unknown) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate transport charges.",
        variant: "destructive",
      });
    } finally {
      setTransportRunning(false);
    }
  };

  const handleOpenTransportRollback = async () => {
    const batch = await transportRollback.fetchLatestBatch();
    if (batch) setTransportRollbackOpen(true);
  };

  const handleVoidTransportRollback = async () => {
    const result = await transportRollback.voidLatestBatch(transportRollbackReason.trim() || undefined);
    if (result) {
      setTransportRollbackOpen(false);
      setTransportRollbackReason("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={() => setWorkflowOpen(true)}>
          <HelpCircle className="h-4 w-4 mr-2" />
          Workflow guide
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <FeeRuleGenerationPanel feeRules={feeRules} />

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Bus className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Transport Charges</CardTitle>
                    <CardDescription>
                      Creates a monthly charge on each student's ledger for their assigned transport route. Run this once per month after confirming route allocations are up to date.
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 bg-background">Monthly</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="space-y-2">
                <Label htmlFor="transport-month">Charge month</Label>
                <Input
                  id="transport-month"
                  type="month"
                  value={transportMonth}
                  onChange={(event) => {
                    setTransportMonth(event.target.value);
                    setTransportResult(null);
                  }}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Select the month you want to bill. Students already charged for this month are skipped — safe to re-run.
                </p>
              </div>

              {/* Multi-currency selector (Feature 094) */}
              {currencyConfig && currencyConfig.enabledCurrencies.length > 1 && (
                <div className="space-y-1 max-w-[180px]">
                  <Label className="text-xs">Currency</Label>
                  <Select value={transportCurrency || currencyConfig.baseCurrency} onValueChange={setTransportCurrency} disabled={transportRunning}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyConfig.enabledCurrencies.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}{c === currencyConfig.baseCurrency ? ' (base)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  onClick={handleGenerateTransportCharges}
                  disabled={transportRunning || !transportMonth || transportRollback.voiding}
                  className="w-full"
                  title="Add transport charges to every student with an active route allocation for the selected month"
                >
                  {transportRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Receipt className="h-4 w-4 mr-2" />
                      Generate charges
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenTransportRollback}
                  disabled={transportRollbackBusy || transportRunning}
                  className="w-full"
                  title="Void (undo) the most recently generated transport charge batch"
                >
                  {transportRollbackBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Rollback latest
                    </>
                  )}
                </Button>
              </div>

              {transportRollback.error && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                  {transportRollback.error}
                </div>
              )}

              {transportResult && (
                <div className="rounded-xl border border-green-200 bg-green-50/80 p-4 text-sm dark:border-green-800 dark:bg-green-950/20">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-700 dark:text-green-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div>
                        <p className="font-medium text-green-900 dark:text-green-100">
                          Transport billing completed for {formatMonthLabel(transportResult.month)}
                        </p>
                        {transportResult.descriptionLabel && (
                          <p className="mt-1 text-xs text-muted-foreground">{transportResult.descriptionLabel}</p>
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="rounded-lg bg-background/80 p-3">
                          <p className="text-xs text-muted-foreground">Charges created</p>
                          <p className="text-lg font-semibold tabular-nums">{transportResult.created}</p>
                        </div>
                        <div className="rounded-lg bg-background/80 p-3">
                          <p className="text-xs text-muted-foreground">Already existed</p>
                          <p className="text-lg font-semibold tabular-nums">{transportResult.skipped}</p>
                        </div>
                        <div className="rounded-lg bg-background/80 p-3">
                          <p className="text-xs text-muted-foreground">Total billed</p>
                          <p className="text-lg font-semibold tabular-nums">{formatAmount(transportResult.totalAmount)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      <Dialog open={workflowOpen} onOpenChange={setWorkflowOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Recommended Workflow
            </DialogTitle>
            <DialogDescription>
              Keep charge generation predictable and auditable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "Review tuition rules", "Go to Tuition Structure → Tuition Rules. Confirm the right rules are active and scoped to the correct classes or students."],
              ["2", "Generate tuition charges", "Select the current billing period and click \"Generate charges\". Charges are added to each eligible student's ledger."],
              ["3", "Generate transport charges", "Pick the current month and click \"Generate charges\" in the Transport card. Only students with active route allocations are billed."],
              ["4", "Rollback if something is wrong", "Click \"Rollback latest\" on the relevant card to void the most recent batch. Only the latest batch can be undone at a time."],
            ].map(([step, title, detail]) => (
              <div key={step} className="flex items-start gap-3 border-b py-2.5 last:border-0">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                  {step}
                </div>
                <div>
                  <p className="text-xs font-semibold">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="dont-show-again" className="text-sm cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
            <Button onClick={handleDismissWorkflow}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={transportRollbackOpen} onOpenChange={setTransportRollbackOpen}>
        <AlertDialogContent className="sm:max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Void latest transport charge batch?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {transportRollback.latestBatch ? (
                <span className="space-y-2 block">
                  <span className="block font-medium text-foreground">{transportRollback.latestBatch.descriptionLabel}</span>
                  <span className="block">
                    This will void {transportRollback.latestBatch.chargeCount} charge
                    {transportRollback.latestBatch.chargeCount === 1 ? "" : "s"} for {transportRollback.latestBatch.affectedStudentCount} student
                    {transportRollback.latestBatch.affectedStudentCount === 1 ? "" : "s"}, totaling{" "}
                    {transportRollback.latestBatch.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
                  </span>
                </span>
              ) : (
                "No latest transport charge batch is loaded."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="transport-rollback-reason">Rollback reason</Label>
            <Input
              id="transport-rollback-reason"
              value={transportRollbackReason}
              onChange={(event) => setTransportRollbackReason(event.target.value)}
              placeholder="Reason for rollback"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={transportRollback.voiding}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!transportRollback.latestBatch || transportRollback.voiding}
              onClick={handleVoidTransportRollback}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {transportRollback.voiding ? "Voiding…" : "Void latest batch"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
