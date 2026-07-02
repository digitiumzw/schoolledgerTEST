import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { ExchangeRate, ExchangeRateLookupResult } from '@/types/dashboard';
import { useToast } from '@/hooks/use-toast';

export const EXCHANGE_RATES_QUERY_KEY = 'exchange-rates';

export function useExchangeRates(currency: string | null) {
  return useQuery<ExchangeRate[]>({
    queryKey: [EXCHANGE_RATES_QUERY_KEY, currency],
    queryFn: () => api.getExchangeRates(currency!),
    enabled: Boolean(currency),
    staleTime: 60_000,
  });
}

export function useExchangeRateLookup(currency: string | null, date: string | null) {
  return useQuery<ExchangeRateLookupResult>({
    queryKey: ['exchange-rate-lookup', currency, date],
    queryFn: () => api.lookupExchangeRate(currency!, date!),
    enabled: Boolean(currency) && Boolean(date),
    staleTime: 30_000,
  });
}

export function useCreateExchangeRate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { currency: string; rateToBase: number; effectiveDate: string }) =>
      api.createExchangeRate(data),
    onSuccess: (_data, variables) => {
      toast({
        title: 'Exchange rate created',
        description: `${variables.currency} @ ${variables.rateToBase} effective ${variables.effectiveDate}`,
      });
      queryClient.invalidateQueries({ queryKey: [EXCHANGE_RATES_QUERY_KEY] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to create exchange rate';
      toast({ title: 'Create failed', description: message, variant: 'destructive' });
    },
  });
}

export function useUpdateExchangeRate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, rateToBase }: { id: string; rateToBase: number }) =>
      api.updateExchangeRate(id, { rateToBase }),
    onSuccess: () => {
      toast({ title: 'Exchange rate updated' });
      queryClient.invalidateQueries({ queryKey: [EXCHANGE_RATES_QUERY_KEY] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to update exchange rate';
      toast({ title: 'Update failed', description: message, variant: 'destructive' });
    },
  });
}
