import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getSystemErrors, getSystemError, type SystemErrorLogFilters } from '@/api/platform';

export function useSystemErrors(filters: SystemErrorLogFilters, page: number, perPage = 50) {
  return useQuery({
    queryKey: ['platform', 'system-errors', { ...filters, page, perPage }],
    queryFn: () =>
      getSystemErrors({ ...filters, page, per_page: perPage }).then((r) => r.data),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useSystemError(correlationId: string | null) {
  return useQuery({
    queryKey: ['platform', 'system-error', correlationId],
    queryFn: () => getSystemError(correlationId!).then((r) => r.data.data),
    enabled: !!correlationId,
    staleTime: 60_000,
  });
}
