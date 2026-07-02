import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { CurrencyConfiguration } from '@/types/dashboard';
import { useToast } from '@/hooks/use-toast';

export const CURRENCY_CONFIG_QUERY_KEY = 'currency-config';

export function useCurrencyConfig() {
  return useQuery<CurrencyConfiguration>({
    queryKey: [CURRENCY_CONFIG_QUERY_KEY],
    queryFn: () => api.getCurrencyConfig(),
    staleTime: 60_000,
  });
}

export function useUpdateCurrencyConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { baseCurrency?: string; enabledCurrencies?: string[]; multiCurrencyEnabled?: boolean }) =>
      api.updateCurrencyConfig(data),
    onSuccess: (config) => {
      toast({
        title: 'Currency configuration updated',
        description: `Base: ${config.baseCurrency} · Enabled: ${config.enabledCurrencies.join(', ')}`,
      });
      queryClient.invalidateQueries({ queryKey: [CURRENCY_CONFIG_QUERY_KEY] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to update currency configuration';
      toast({ title: 'Update failed', description: message, variant: 'destructive' });
    },
  });
}
