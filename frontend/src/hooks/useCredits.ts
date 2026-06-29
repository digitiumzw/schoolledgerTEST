import { useQuery } from '@tanstack/react-query';
import { api, Credit } from '../api/api';

export interface UseCreditsReturn {
  totalCreditsCents: number;
  credits: Credit[];
  isLoading: boolean;
  refetch: () => Promise<unknown>;
}

export function useCredits(): UseCreditsReturn {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['subscription', 'credits'],
    queryFn: () => api.getCredits(),
  });

  return {
    totalCreditsCents: data?.totalCreditsCents ?? 0,
    credits: data?.credits ?? [],
    isLoading,
    refetch,
  };
}
