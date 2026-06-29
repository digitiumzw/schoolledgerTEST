import { useQuery } from '@tanstack/react-query';
import { getGrowthAnalytics, getGeographyAnalytics, getLeaderboard } from '@/api/platform';

export function useGrowthAnalytics() {
  return useQuery({
    queryKey: ['platform', 'analytics', 'growth'],
    queryFn: () => getGrowthAnalytics().then((r) => r.data.data),
    staleTime: 300_000,
  });
}

export function useGeographyAnalytics() {
  return useQuery({
    queryKey: ['platform', 'analytics', 'geography'],
    queryFn: () => getGeographyAnalytics().then((r) => r.data.data),
    staleTime: 300_000,
  });
}

export function useLeaderboard(metric: string = 'mrr') {
  return useQuery({
    queryKey: ['platform', 'analytics', 'leaderboard', metric],
    queryFn: () => getLeaderboard({ metric }).then((r) => r.data.data),
    staleTime: 300_000,
  });
}
