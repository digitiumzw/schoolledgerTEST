import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/api";
import { StatusHistoryEntry } from "@/types/dashboard";

export function useStudentStatusHistory(studentId: string | undefined) {
  const query = useQuery<StatusHistoryEntry[]>({
    queryKey: ["student-status-history", studentId],
    queryFn: () => api.getStudentStatusHistory(studentId!),
    enabled: !!studentId,
    staleTime: 30_000,
  });

  return {
    statusHistory: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
