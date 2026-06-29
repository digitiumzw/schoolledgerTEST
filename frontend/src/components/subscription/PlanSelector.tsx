import { PlanCard } from "./PlanCard";
import type { SubscriptionPlan, SchoolSubscription, SubscriptionTransitionPolicy } from "@/api/api";

interface PlanSelectorProps {
  plans: SubscriptionPlan[];
  selectedCycle: 'monthly' | 'annual';
  onCycleChange: (cycle: 'monthly' | 'annual') => void;
  recommendedPlanId: string;
  currentSubscription: SchoolSubscription | null;
  transitionPolicy?: SubscriptionTransitionPolicy;
  onSubscribe: (planId: string, cycle: 'monthly' | 'annual') => void;
  loadingPlanId?: string | null;
  studentCount?: number;
}

export function PlanSelector({
  plans,
  selectedCycle,
  onCycleChange,
  recommendedPlanId,
  currentSubscription,
  transitionPolicy,
  onSubscribe,
  loadingPlanId,
  studentCount = 0,
}: PlanSelectorProps) {
  const currentPlanSortOrder = currentSubscription
    ? plans.find(p => p.id === currentSubscription.planId)?.sortOrder ?? 0
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => onCycleChange('monthly')}
          disabled={transitionPolicy?.canSwitchToMonthly === false}
          className={`rounded-l-full px-5 py-2 text-sm font-medium border transition-colors ${
            selectedCycle === 'monthly'
              ? 'bg-primary text-primary-foreground border-primary'
              : transitionPolicy?.canSwitchToMonthly === false
              ? 'bg-muted text-muted-foreground border-border opacity-60 cursor-not-allowed'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => onCycleChange('annual')}
          className={`rounded-r-full px-5 py-2 text-sm font-medium border transition-colors ${
            selectedCycle === 'annual'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          }`}
        >
          Annual <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300">Save ~17%</span>
        </button>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map(plan => (
          <PlanCard
            key={plan.id}
            plan={plan}
            selectedCycle={selectedCycle}
            isRecommended={plan.id === recommendedPlanId}
            currentSubscription={currentSubscription}
            currentPlanSortOrder={currentPlanSortOrder}
            transitionPolicy={transitionPolicy}
            onSelect={onSubscribe}
            isLoading={loadingPlanId === plan.id}
            studentCount={studentCount}
          />
        ))}
      </div>
    </div>
  );
}
