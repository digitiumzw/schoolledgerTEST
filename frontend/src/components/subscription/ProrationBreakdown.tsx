import { useState } from 'react';
import { ProrationCalculation } from '../../api/api';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface ProrationBreakdownProps {
  calculation: ProrationCalculation;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function formatCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  return `$${dollars.toFixed(2)}`;
}

export function ProrationBreakdown({
  calculation,
  onConfirm,
  onCancel,
  isLoading = false,
}: ProrationBreakdownProps) {
  const [showFormula, setShowFormula] = useState(false);

  const { originalPlan, newPlan, billingCycle, cycleDates, proration, breakdown } = calculation;
  const netCents   = proration.netAmountCents;
  const isDowngrade = proration.isDowngrade;
  const cycleLabel  = billingCycle === 'annual' ? '/yr' : '/mo';

  return (
    <div className="w-full space-y-4">
      {/* Plan names */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Current Plan</span>
          <span className="font-medium text-foreground">
            {originalPlan.name} ({formatCents(originalPlan.priceCents)}{cycleLabel})
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">New Plan</span>
          <span className="font-medium text-foreground">
            {newPlan.name} ({formatCents(newPlan.priceCents)}{cycleLabel})
          </span>
        </div>
      </div>

      <hr className="border-border" />

      {/* Cycle info */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Billing Cycle</span>
          <span className="text-foreground">
            {cycleDates.startDate} &ndash; {cycleDates.endDate} ({cycleDates.daysInCycle} days)
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Days Remaining</span>
          <span className="text-foreground">{cycleDates.daysRemaining} days</span>
        </div>
      </div>

      <hr className="border-border" />

      {/* Credit / charge */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Credit for unused {originalPlan.name} time
          </span>
          <span className="text-green-600 dark:text-green-400">
            -{formatCents(proration.unusedValueCreditCents)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            Charge for remaining {newPlan.name} time
          </span>
          <span className="text-foreground">+{formatCents(proration.proratedChargeCents)}</span>
        </div>
      </div>

      <hr className="border-border" />

      {/* Net total */}
      <div className="flex justify-between font-semibold text-base">
        <span className="text-foreground">
          {isDowngrade
            ? 'No refund or credit issued'
            : netCents === 0
              ? 'No additional charge today'
              : 'Net amount to charge today'}
        </span>
        <span className="text-foreground">
          {isDowngrade ? formatCents(0) : formatCents(netCents)}
        </span>
      </div>
      {isDowngrade && (
        <Alert variant="warning" className="py-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5" />
          <AlertDescription className="text-xs">
            Annual downgrades keep your current renewal date and do not issue cash refunds or account credits for unused annual time.
          </AlertDescription>
        </Alert>
      )}

      {/* Formula toggle */}
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-primary hover:underline"
        onClick={() => setShowFormula(v => !v)}
      >
        {showFormula ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        How is this calculated?
      </button>

      {showFormula && (
        <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground font-mono whitespace-pre-wrap">
          {`Daily rate (${originalPlan.name}): ${formatCents(breakdown.dailyRateOriginalCents)}/day\n`}
          {`Daily rate (${newPlan.name}): ${formatCents(breakdown.dailyRateNewCents)}/day\n`}
          {`Formula: ${breakdown.formula}`}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading
            ? 'Processing…'
            : isDowngrade
              ? 'Confirm Downgrade'
              : 'Confirm & Pay'}
        </Button>
      </div>
    </div>
  );
}
