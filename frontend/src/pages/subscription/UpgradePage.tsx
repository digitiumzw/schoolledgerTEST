import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, SubscriptionPlan, SchoolSubscription } from '../../api/api';
import { useProration } from '../../hooks/useProration';
import { ProrationBreakdown } from '../../components/subscription/ProrationBreakdown';
import { ProrationSkeleton } from '../../components/subscription/ProrationSkeleton';
import { PlanSelector } from '../../components/subscription/PlanSelector';

export default function UpgradePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'annual'>('monthly');

  const { data: plans = [] } = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: () => api.getSubscriptionPlans(),
  });

  const { data: currentData } = useQuery({
    queryKey: ['subscription', 'current'],
    queryFn: () => api.getCurrentSubscription(),
  });

  const {
    calculation,
    isLoading,
    error,
    calculateProration,
    initiateUpgrade,
    clearCalculation,
  } = useProration();

  // Auto-trigger calculation when redirected from Billing with planId + cycle params.
  useEffect(() => {
    const planId = searchParams.get('planId');
    const cycle  = searchParams.get('cycle') as 'monthly' | 'annual' | null;
    if (planId && (cycle === 'monthly' || cycle === 'annual')) {
      setSelectedCycle(cycle);
      calculateProration(planId, cycle);
    }
  }, []); // run once on mount

  const handlePlanSelect = async (planId: string, cycle: 'monthly' | 'annual') => {
    setSelectedCycle(cycle);
    await calculateProration(planId, cycle);
  };

  const handleConfirm = async () => {
    try {
      const result = await initiateUpgrade('paynow');
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        // Zero-amount plan change (downgrade credit or $0 proration): activated immediately.
        navigate('/billing?payment=complete');
      }
    } catch {
      // error is set in hook state
    }
  };

  const subscription: SchoolSubscription | null = currentData?.subscription ?? null;
  const recommendedPlanId = currentData?.recommendedPlanId ?? '';

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <div className="mb-6">
        <button
          type="button"
          className="text-sm text-blue-600 hover:underline"
          onClick={() => navigate('/billing')}
        >
          &larr; Back to Billing
        </button>
        <h1 className="text-2xl font-bold mt-2">Change Plan</h1>
        <p className="text-gray-500 text-sm mt-1">
          Select a new plan to see your proration breakdown before confirming.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 mb-6">
          <p className="text-sm text-red-800 font-medium">{error.message}</p>
          {error.code === 'DOWNGRADE_BLOCKED' && error.details && (
            <p className="text-xs text-red-600 mt-1">
              Current students: {String(error.details.studentCount)}, Plan limit: {String(error.details.planLimit)}
            </p>
          )}
          {error.code === 'PRORATION_CALCULATION_EXPIRED' && (
            <button
              type="button"
              className="mt-2 text-xs text-red-700 underline"
              onClick={clearCalculation}
            >
              Recalculate
            </button>
          )}
        </div>
      )}

      {isLoading && !calculation ? (
        <div className="flex justify-center">
          <ProrationSkeleton />
        </div>
      ) : calculation ? (
        <div className="flex justify-center">
          <ProrationBreakdown
            calculation={calculation}
            onConfirm={handleConfirm}
            onCancel={clearCalculation}
            isLoading={isLoading}
          />
        </div>
      ) : (
        <PlanSelector
          plans={plans}
          selectedCycle={selectedCycle}
          onCycleChange={setSelectedCycle}
          recommendedPlanId={recommendedPlanId}
          currentSubscription={subscription}
          onSubscribe={handlePlanSelect}
          loadingPlanId={isLoading ? 'loading' : null}
        />
      )}
    </div>
  );
}
