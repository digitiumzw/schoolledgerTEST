import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api, ProrationCalculation, UpgradeWithProrationResponse } from '../api/api';

export interface ProrationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface UseProrationReturn {
  calculation: ProrationCalculation | null;
  isLoading: boolean;
  error: ProrationError | null;
  calculateProration: (targetPlanId: string, billingCycle?: 'monthly' | 'annual') => Promise<void>;
  initiateUpgrade: (paymentMethod?: string) => Promise<UpgradeWithProrationResponse>;
  clearCalculation: () => void;
  canConfirm: boolean;
  isUpgrade: boolean;
}

export function useProration(): UseProrationReturn {
  const queryClient = useQueryClient();
  const [calculation, setCalculation] = useState<ProrationCalculation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ProrationError | null>(null);

  const calculateProration = useCallback(
    async (targetPlanId: string, billingCycle?: 'monthly' | 'annual') => {
      setIsLoading(true);
      setError(null);
      setCalculation(null);
      try {
        const result = await api.calculateProration(targetPlanId, billingCycle);
        setCalculation(result);
      } catch (err: unknown) {
        const e = err as { message?: string };
        setError({
          code: 'CALCULATION_FAILED',
          message: (e as Error)?.message ?? 'Failed to calculate proration.',
        });
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const initiateUpgrade = useCallback(
    async (paymentMethod?: string): Promise<UpgradeWithProrationResponse> => {
      if (!calculation) {
        throw new Error('No calculation available. Call calculateProration first.');
      }
      setIsLoading(true);
      setError(null);
      try {
        const result = await api.initiateUpgrade(calculation.calculationId, paymentMethod);
        // Invalidate subscription cache so UI reflects the new state after redirect
        await queryClient.invalidateQueries({ queryKey: ['subscription'] });
        return result;
      } catch (err: unknown) {
        const e = err as { status?: number; message?: string };
        const code = e?.status === 409 ? 'PRORATION_CALCULATION_EXPIRED' : 'UPGRADE_FAILED';
        const prorationError: ProrationError = {
          code,
          message: (e as Error)?.message ?? 'Failed to initiate upgrade.',
        };
        setError(prorationError);
        throw prorationError;
      } finally {
        setIsLoading(false);
      }
    },
    [calculation, queryClient]
  );

  const clearCalculation = useCallback(() => {
    setCalculation(null);
    setError(null);
  }, []);

  return {
    calculation,
    isLoading,
    error,
    calculateProration,
    initiateUpgrade,
    clearCalculation,
    canConfirm: calculation !== null && !isLoading,
    isUpgrade: calculation?.proration.isUpgrade ?? false,
  };
}
