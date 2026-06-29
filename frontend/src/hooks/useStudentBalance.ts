import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/api';

interface StudentBalance {
  studentId: string;
  totalCharges: number;
  totalPayments: number;
  creditAdjustments: number;
  debitAdjustments: number;
  balance: number;
  feeBalance: number;
  transportBalance: number;
}

interface UseStudentBalanceResult {
  balance: StudentBalance | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  invalidateBalance: () => void;
}

export function useStudentBalance(studentId: string): UseStudentBalanceResult {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['student-balance', studentId],
    queryFn: async (): Promise<StudentBalance> => {
      return api.getStudentBalance(studentId);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!studentId,
  });

  // Helper function for invalidating balance after payment
  const invalidateBalance = () => {
    queryClient.invalidateQueries({ queryKey: ['student-balance', studentId] });
  };

  return {
    balance: data || null,
    isLoading,
    error,
    refetch,
    invalidateBalance,
  };
}

export type { StudentBalance, UseStudentBalanceResult };
