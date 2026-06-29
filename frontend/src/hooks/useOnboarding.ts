/**
 * React Query hooks for the school admin onboarding wizard.
 *
 * Backend contract: see specs/043-school-creation-onboarding/contracts/school-onboarding.md
 *
 * Feature: 043-school-creation-onboarding
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';

const PROGRESS_KEY = ['onboarding', 'progress'] as const;

export function useOnboardingProgress() {
  return useQuery({
    queryKey: PROGRESS_KEY,
    queryFn: () => api.getOnboardingProgress(),
    // The wizard is the only consumer; refetch on mount is sufficient
    staleTime: 30_000,
  });
}

export function useSaveStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ step, data }: { step: string; data: Record<string, unknown> }) =>
      api.saveOnboardingStep(step, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRESS_KEY });
    },
  });
}

export function useCompleteOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.completeOnboarding(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROGRESS_KEY });
    },
  });
}

export function useChangeOnboardingPassword() {
  return useMutation({
    mutationFn: ({ newPassword, confirmPassword }: { newPassword: string; confirmPassword: string }) =>
      api.changeOnboardingPassword(newPassword, confirmPassword),
  });
}

/** Step identifiers in the wizard's display order. */
export const ONBOARDING_STEPS = [
  'password',
  'profile',
  'contact',
  'work-hours',
  'academic-calendar',
] as const;

export type OnboardingStep = typeof ONBOARDING_STEPS[number];

export const STEP_LABELS: Record<OnboardingStep, string> = {
  'password':          'Set your password',
  'profile':           'Your profile',
  'contact':           'Contact details',
  'work-hours':        'Work hours',
  'academic-calendar': 'Academic calendar',
};
