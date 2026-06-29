import { useIsFetching, useQueryClient } from '@tanstack/react-query';

export interface UseGlobalRefreshReturn {
  isRefreshing: boolean;
  refreshAll: () => void;
}

export function useGlobalRefresh(): UseGlobalRefreshReturn {
  const queryClient = useQueryClient();
  const fetchingCount = useIsFetching();
  const isRefreshing = fetchingCount > 0;

  const refreshAll = () => {
    if (isRefreshing) return;
    queryClient.refetchQueries({ type: 'active' });
  };

  return { isRefreshing, refreshAll };
}
