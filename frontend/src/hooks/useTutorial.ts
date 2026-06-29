import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { TutorialStatus } from '@/types/dashboard';

const TUTORIAL_KEY = ['tutorial'] as const;

export function useTutorial(enabled = true) {
  return useQuery({
    queryKey: TUTORIAL_KEY,
    queryFn: () => api.getTutorial(),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateTutorialProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { status: TutorialStatus; last_seen_step?: string | null; seen_module_keys?: string[] }) =>
      api.updateTutorialProgress(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TUTORIAL_KEY });
    },
  });
}

export function useRestartTutorial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.restartTutorial(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TUTORIAL_KEY });
    },
  });
}
