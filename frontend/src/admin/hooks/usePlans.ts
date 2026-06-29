import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPlans, getPlan, createPlan, updatePlan, deletePlan } from '@/api/platform';
import { useToast } from '@/hooks/use-toast';

export function usePlans() {
  return useQuery({
    queryKey: ['platform', 'plans'],
    queryFn: () => getPlans().then((r) => r.data.data),
    staleTime: 60_000,
  });
}

export function usePlan(id: number) {
  return useQuery({
    queryKey: ['platform', 'plans', id],
    queryFn: () => getPlan(id).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createPlan(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'plans'] });
      toast({ title: 'Plan created' });
    },
    onError: () => toast({ title: 'Failed to create plan', variant: 'destructive' }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      updatePlan(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'plans'] });
      toast({ title: 'Plan updated' });
    },
    onError: () => toast({ title: 'Failed to update plan', variant: 'destructive' }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => deletePlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'plans'] });
      toast({ title: 'Plan deleted' });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to delete plan',
        variant: 'destructive',
      }),
  });
}
