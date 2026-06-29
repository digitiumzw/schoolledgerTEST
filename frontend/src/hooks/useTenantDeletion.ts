import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { DeletionRequestInput, UndoDeletionInput } from '@/types/dashboard';

const TENANT_DELETION_KEY = ['tenant', 'deletion-status'] as const;

/**
 * Hook to get tenant deletion status
 */
export function useTenantDeletionStatus(enabled = true) {
  return useQuery({
    queryKey: TENANT_DELETION_KEY,
    queryFn: () => api.getTenantDeletionStatus(),
    enabled,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Hook to request account deletion
 */
export function useRequestDeletion() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: DeletionRequestInput) => api.requestAccountDeletion(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TENANT_DELETION_KEY });
    },
  });
}

/**
 * Hook to undo account deletion
 */
export function useUndoDeletion() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: UndoDeletionInput) => api.undoAccountDeletion(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TENANT_DELETION_KEY });
    },
  });
}
