import { useQuery, useMutation, keepPreviousData } from '@tanstack/react-query';
import { getAuditLog, exportAuditLog } from '@/api/platform';
import { useToast } from '@/hooks/use-toast';

export type AuditLogFilters = {
  from_date?: string;
  to_date?: string;
  actor_email?: string;
  action?: string;
  target_type?: string;
  search?: string;
};

export function useAuditLogs(filters: AuditLogFilters, page: number, perPage = 50) {
  return useQuery({
    queryKey: ['platform', 'audit', { ...filters, page, perPage }],
    queryFn: () =>
      getAuditLog({ ...filters, page, per_page: perPage }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useExportAuditLog() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (filters: AuditLogFilters) => {
      const res = await exportAuditLog(filters);
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data as BlobPart], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast({ title: 'Audit log exported' }),
    onError: () => toast({ title: 'Export failed', variant: 'destructive' }),
  });
}
