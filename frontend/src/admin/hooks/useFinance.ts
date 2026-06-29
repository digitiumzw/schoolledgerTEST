import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  exportInvoicesCsv,
  getFinanceSummary,
  getGrowthAnalytics,
  getInvoices,
  type PlatformFinanceFilters,
  type PlatformFinanceInvoicesResponse,
  type PlatformFinanceSummary,
  type PlatformGrowthAnalyticsResponse,
} from "@/api/platform";
import { useToast } from '@/hooks/use-toast';

export function useFinanceSummary(params: PlatformFinanceFilters = {}) {
  return useQuery({
    queryKey: ["platform", "finance", "summary", params],
    queryFn: () => getFinanceSummary(params).then((r) => r.data.data as PlatformFinanceSummary),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useFinanceGrowth(params: PlatformFinanceFilters = {}) {
  return useQuery({
    queryKey: ["platform", "finance", "growth", params],
    queryFn: () => getGrowthAnalytics(params).then((r) => r.data.data as PlatformGrowthAnalyticsResponse),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useInvoices(params: PlatformFinanceFilters = {}) {
  return useQuery({
    queryKey: ["platform", "finance", "invoices", params],
    queryFn: () => getInvoices(params).then((r) => r.data as PlatformFinanceInvoicesResponse),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useExportInvoices() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (params: PlatformFinanceFilters) => exportInvoicesCsv(params),
    onSuccess: (res) => {
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = "invoices-export.csv";
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export downloaded" });
    },
    onError: () => toast({ title: "Export failed", variant: "destructive" }),
  });
}

export function financeQueryKey(params: PlatformFinanceFilters = {}) {
  return ["platform", "finance", "invoices", params];
}
