import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { SetupGuideStepKey, SetupGuideStepStatus } from '@/types/dashboard';

const SETUP_GUIDE_KEY = ['setup-guide'] as const;

export function useSetupGuide(enabled = true) {
  return useQuery({
    queryKey: SETUP_GUIDE_KEY,
    queryFn: () => api.getSetupGuide(),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateSetupGuideStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ stepKey, status }: { stepKey: SetupGuideStepKey; status: Extract<SetupGuideStepStatus, 'completed' | 'skipped'> }) =>
      api.updateSetupGuideStep(stepKey, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETUP_GUIDE_KEY });
    },
  });
}

export function useDismissSetupGuide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.dismissSetupGuide(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETUP_GUIDE_KEY });
    },
  });
}
