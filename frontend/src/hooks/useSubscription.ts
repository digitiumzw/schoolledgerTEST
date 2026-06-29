import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { SubscriptionPlan, SchoolSubscription, CurrentSubscriptionResponse, SubscriptionTransitionPolicy } from '@/api/api';

export interface UseSubscriptionReturn {
  plans: SubscriptionPlan[];
  subscription: SchoolSubscription | null;
  studentCount: number;
  maxStudents: number | null;
  capacityPercent: number | null;
  remainingSlots: number | null;
  isNearCapacity: boolean;
  hasActivePlan: boolean;
  recommendedPlanId: string;
  isExpired: boolean;
  isOverLimit: boolean;
  daysUntilExpiry: number | null;
  transitionPolicy: SubscriptionTransitionPolicy;
  selectedCycle: 'monthly' | 'annual';
  setSelectedCycle: (cycle: 'monthly' | 'annual') => void;
  isLoadingPlans: boolean;
  isLoadingCurrent: boolean;
  loadingPlanId: string | null;
  initiatePaidSubscription: (planId: string, cycle: 'monthly' | 'annual') => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const queryClient = useQueryClient();
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const { data: plans = [], isLoading: isLoadingPlans } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: api.getSubscriptionPlans,
    staleTime: 10 * 60 * 1000,
  });

  const { data: currentData, isLoading: isLoadingCurrent } = useQuery<CurrentSubscriptionResponse>({
    queryKey: ['subscription-current'],
    queryFn: api.getCurrentSubscription,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const initiateMutation = useMutation({
    mutationFn: ({ planId, cycle }: { planId: string; cycle: 'monthly' | 'annual' }) =>
      api.initiateSubscription(planId, cycle),
    onSuccess: (data) => {
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    },
  });

  const initiatePaidSubscription = async (planId: string, cycle: 'monthly' | 'annual') => {
    setLoadingPlanId(planId);
    try {
      await initiateMutation.mutateAsync({ planId, cycle });
    } finally {
      setLoadingPlanId(null);
    }
  };

  const subscription    = currentData?.subscription ?? null;
  const studentCount    = currentData?.studentCount  ?? 0;
  const isExpired       = currentData?.isExpired     ?? false;
  const isOverLimit     = currentData?.isOverLimit   ?? false;
  const transitionPolicy = currentData?.transitionPolicy ?? {
    canSwitchToAnnual: true,
    canSwitchToMonthly: true,
    canChangeTier: subscription !== null,
    blockedReason: null,
  };

  const maxStudents: number | null =
    plans.find((p) => p.id === subscription?.planId)?.maxStudents ?? null;

  const capacityPercent: number | null =
    maxStudents !== null ? Math.round((studentCount / maxStudents) * 100) : null;

  const remainingSlots: number | null =
    maxStudents !== null ? maxStudents - studentCount : null;

  const isNearCapacity: boolean =
    capacityPercent !== null && capacityPercent >= 75 && !isOverLimit && !isExpired;

  const hasActivePlan: boolean =
    subscription !== null && subscription.status === 'active';

  const sortedPlans = [...plans].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const recommendedPlan =
    sortedPlans.find((p) => p.maxStudents === null || p.maxStudents > studentCount) ??
    sortedPlans[sortedPlans.length - 1];
  const recommendedPlanId = recommendedPlan?.id ?? '';

  return {
    plans,
    subscription,
    studentCount,
    maxStudents,
    capacityPercent,
    remainingSlots,
    isNearCapacity,
    hasActivePlan,
    recommendedPlanId,
    isExpired,
    isOverLimit,
    daysUntilExpiry:      currentData?.daysUntilExpiry    ?? null,
    transitionPolicy,
    selectedCycle,
    setSelectedCycle,
    isLoadingPlans,
    isLoadingCurrent,
    loadingPlanId,
    initiatePaidSubscription,
  };
}
