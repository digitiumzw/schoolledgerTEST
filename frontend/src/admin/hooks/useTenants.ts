import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTenants,
  getTenant,
  createTenant,
  suspendTenant,
  reactivateTenant,
  deleteTenant,
} from '@/api/platform';
import { useToast } from '@/hooks/use-toast';

interface TenantsParams {
  page?: number;
  limit?: number;
  status?: string;
  q?: string;
  plan?: string;
}

export function useTenants(params: TenantsParams = {}) {
  return useQuery({
    queryKey: ['platform', 'tenants', params],
    queryFn: () => getTenants(params).then((r) => r.data),
    staleTime: 30_000,
  });
}

export function useTenant(id: number) {
  return useQuery({
    queryKey: ['platform', 'tenants', id],
    queryFn: () => getTenant(id).then((r) => r.data.data),
    enabled: !!id,
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Record<string, unknown>) => createTenant(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      toast({ title: 'Tenant created successfully' });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to create tenant',
        variant: 'destructive',
      });
    },
  });
}

export function useSuspendTenant() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: number) => suspendTenant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      toast({ title: 'Tenant suspended' });
    },
    onError: () => toast({ title: 'Failed to suspend tenant', variant: 'destructive' }),
  });
}

export function useReactivateTenant() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: number) => reactivateTenant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      toast({ title: 'Tenant reactivated' });
    },
    onError: () => toast({ title: 'Failed to reactivate tenant', variant: 'destructive' }),
  });
}

export function useDeleteTenant() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: number) => deleteTenant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      toast({ title: 'Tenant deleted' });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to delete tenant',
        variant: 'destructive',
      });
    },
  });
}
