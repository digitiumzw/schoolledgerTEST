import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/api';

export interface ActiveSessionResult {
  activeSession: string | null;
  isFallback: boolean;
  isLoading: boolean;
  isError: boolean;
}

export function useActiveSession(): ActiveSessionResult {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['settings'],
    queryFn: api.getSettings,
    staleTime: 5 * 60 * 1000,
  });

  const activeSession: string | null = data?.activeAcademicSession ?? null;
  const isFallback = !isLoading && !isError && data != null && data.activeAcademicSession == null;

  return { activeSession, isFallback, isLoading, isError };
}
