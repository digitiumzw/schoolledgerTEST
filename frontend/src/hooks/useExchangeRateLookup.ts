import { useQuery } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { ExchangeRateLookupResult } from '@/types/dashboard';

/**
 * useExchangeRateLookup — Live exchange rate preview for transaction entry.
 *
 * Feature 094: Used by RecordPaymentModal and charge generation panels to
 * preview the conversion before submit. Only enabled when a non-base currency
 * is selected and a date is provided. The backend performs the lookup; the
 * frontend only renders the result (Constitution Principle XI).
 */
export function useExchangeRateLookup(currency: string | null, date: string | null) {
  return useQuery<ExchangeRateLookupResult>({
    queryKey: ['exchange-rate-lookup', currency, date],
    queryFn: () => api.lookupExchangeRate(currency!, date!),
    enabled: Boolean(currency) && Boolean(date),
    staleTime: 30_000,
  });
}
