import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';

export const DASHBOARD_AGGREGATION_QUERY_KEY = ['dashboard', 'aggregation'] as const;

const STALE_THRESHOLD_MS = 300_000; // 5 minutes

export function useDashboardAggregation(enabled = true) {
  const queryClient = useQueryClient();

  const dashboardQuery = useQuery({
    queryKey: DASHBOARD_AGGREGATION_QUERY_KEY,
    queryFn: () => api.getDashboard(false),
    enabled,
    staleTime: STALE_THRESHOLD_MS,
    refetchInterval: STALE_THRESHOLD_MS,
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.getDashboard(true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_AGGREGATION_QUERY_KEY });
    },
  });

  const lastRefresh = dashboardQuery.data?.summary?.lastRefresh ?? null;
  const dataAge = dashboardQuery.dataUpdatedAt
    ? Date.now() - dashboardQuery.dataUpdatedAt
    : null;
  const isStale =
    !dashboardQuery.isLoading &&
    !!dashboardQuery.data &&
    !refreshMutation.isPending &&
    !dashboardQuery.isFetching &&
    (dataAge !== null ? dataAge > STALE_THRESHOLD_MS : false);

  return {
    dashboard: dashboardQuery.data ?? null,
    widgets: dashboardQuery.data?.widgets ?? [],
    stats: dashboardQuery.data?.stats ?? null,
    enrollmentByClass: dashboardQuery.data?.enrollmentByClass ?? [],
    notifications: dashboardQuery.data?.notifications ?? [],
    summary: dashboardQuery.data?.summary ?? null,
    isLoading: dashboardQuery.isLoading,
    error: dashboardQuery.error,
    refetch: dashboardQuery.refetch,
    refreshNow: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending || dashboardQuery.isFetching,
    isStale,
    lastRefresh,
  };
}
