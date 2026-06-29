import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star } from "lucide-react";
import type { SubscriptionPlan, SchoolSubscription, SubscriptionTransitionPolicy } from "@/api/api";

interface PlanCardProps {
  plan: SubscriptionPlan;
  selectedCycle: 'monthly' | 'annual';
  isRecommended: boolean;
  currentSubscription: SchoolSubscription | null;
  currentPlanSortOrder: number;
  transitionPolicy?: SubscriptionTransitionPolicy;
  onSelect: (planId: string, cycle: 'monthly' | 'annual') => void;
  isLoading?: boolean;
  studentCount?: number;
}

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Compare two plans across different billing cycles to determine relative tier.
 * Returns -1 if target is lower tier, 0 if same tier, 1 if higher tier.
 * When tiers are equal but billing cycles differ, this is considered equivalent (0).
 */
function comparePlanTier(
  targetPlan: SubscriptionPlan,
  targetCycle: 'monthly' | 'annual',
  currentPlanSortOrder: number,
  currentCycle: 'monthly' | 'annual'
): -1 | 0 | 1 {
  const targetSortOrder = targetPlan.sortOrder ?? 0;

  // Different tiers: use sortOrder comparison
  if (targetSortOrder < currentPlanSortOrder) return -1;
  if (targetSortOrder > currentPlanSortOrder) return 1;

  // Same tier: billing cycle change is not an upgrade/downgrade
  return 0;
}

/**
 * Get the effective annual price for comparison purposes.
 */
function getEffectiveAnnualPrice(plan: SubscriptionPlan): number {
  // Use actual annual price if available, otherwise estimate from monthly
  return plan.annualPriceCents > 0
    ? plan.annualPriceCents
    : plan.monthlyPriceCents * 12;
}

export function PlanCard({
  plan,
  selectedCycle,
  isRecommended,
  currentSubscription,
  currentPlanSortOrder,
  transitionPolicy,
  onSelect,
  isLoading = false,
  studentCount = 0,
}: PlanCardProps) {
  const isCurrentPlan = currentSubscription?.planId === plan.id;
  const isCurrentCycle = currentSubscription?.billingCycle === selectedCycle;
  const isCurrent     = isCurrentPlan && currentSubscription?.status === 'active' && isCurrentCycle;
  const price         = selectedCycle === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents;
  const annualSaving  = plan.monthlyPriceCents * 12 - plan.annualPriceCents;
  const studentLimit  = plan.maxStudents !== null ? `Up to ${plan.maxStudents} students` : 'Unlimited students';

  // A plan is ineligible when its student cap is below the tenant's current active student count.
  const isCapacityExceeded = plan.maxStudents !== null && studentCount > plan.maxStudents;

  // Determine upgrade/downgrade status using cross-cycle aware comparison
  const tierComparison = currentSubscription !== null
    ? comparePlanTier(plan, selectedCycle, currentPlanSortOrder, currentSubscription.billingCycle)
    : 0;

  const isSameTierDifferentCycle = tierComparison === 0 && !isCurrent && isCurrentPlan;
  const isDowngrade = !isCurrent && currentSubscription !== null && tierComparison === -1;
  const isUpgrade   = !isCurrent && currentSubscription !== null && tierComparison === 1;
  const isAnnualToMonthlyBlocked = selectedCycle === 'monthly' && transitionPolicy?.canSwitchToMonthly === false;

  const buttonLabel = isCurrent
    ? 'Current Plan'
    : isCapacityExceeded
    ? 'Too few seats'
    : isAnnualToMonthlyBlocked
    ? 'Annual Only'
    : isUpgrade
    ? 'Upgrade'
    : isDowngrade
    ? 'Downgrade'
    : isSameTierDifferentCycle
    ? selectedCycle === 'annual'
      ? 'Switch to Annual'
      : 'Switch to Monthly'
    : 'Subscribe';

  const buttonVariant = isCurrent || isAnnualToMonthlyBlocked || isCapacityExceeded
    ? 'outline'
    : isRecommended
    ? 'default'
    : 'secondary';

  return (
    <Card className={`relative flex flex-col transition-shadow ${isRecommended ? 'border-primary shadow-lg ring-2 ring-primary' : ''}`}>
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="flex items-center gap-1 bg-primary text-primary-foreground px-3 py-1 text-xs">
            <Star className="h-3 w-3" /> Recommended
          </Badge>
        </div>
      )}

      <CardHeader className="pb-2 pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{plan.name}</CardTitle>
          <div className="flex items-center gap-1.5">
            {isCurrent && <Badge variant="secondary">Active</Badge>}
            {isCurrentPlan && !isCurrentCycle && currentSubscription?.status === 'active' && (
              <Badge variant="outline" className="text-xs">
                Current ({currentSubscription.billingCycle})
              </Badge>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        <div>
          <div className="text-3xl font-bold">
            {formatCents(price, plan.currency)}
            <span className="text-sm font-normal text-muted-foreground">
              /{selectedCycle === 'annual' ? 'year' : 'month'}
            </span>
          </div>
          {selectedCycle === 'annual' && annualSaving > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              Save {formatCents(annualSaving, plan.currency)} vs monthly
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-primary shrink-0" />
          <span>{studentLimit}</span>
        </div>
        {isCapacityExceeded && (
          <p className="text-xs text-destructive">
            Your school has {studentCount} active students — this plan supports up to {plan.maxStudents}.
          </p>
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <Button
          className="w-full"
          variant={buttonVariant}
          disabled={isCurrent || isAnnualToMonthlyBlocked || isCapacityExceeded || isLoading}
          onClick={() => !isCurrent && !isAnnualToMonthlyBlocked && !isCapacityExceeded && onSelect(plan.id, selectedCycle)}
        >
          {isLoading ? 'Processing…' : buttonLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}
