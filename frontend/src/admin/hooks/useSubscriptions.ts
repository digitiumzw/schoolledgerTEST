import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSubscriptions, changePlan, cancelSubscription } from '@/api/platform';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionsParams {
  page?: number;
  limit?: number;
  status?: string;
}

export function useSubscriptions(params: SubscriptionsParams = {}) {
  return useQuery({
    queryKey: ['platform', 'subscriptions', params],
    queryFn: () => getSubscriptions(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useChangePlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, planId }: { id: number; planId: number }) => changePlan(id, planId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'subscriptions'] });
      toast({ title: 'Plan changed successfully' });
    },
    onError: () => toast({ title: 'Failed to change plan', variant: 'destructive' }),
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => cancelSubscription(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'subscriptions'] });
      toast({ title: 'Subscription cancelled' });
    },
    onError: () => toast({ title: 'Failed to cancel subscription', variant: 'destructive' }),
  });
}
