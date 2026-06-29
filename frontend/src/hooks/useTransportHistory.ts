import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/api";

/**
 * Feature 054 / US4: Student transport history hook.
 *
 * Returns the chronological list of transport assignments for a student,
 * including the currently active assignment (if any) and summary statistics.
 */

export interface TransportHistoryEntry {
  id: string;
  routeId: string;
  routeName: string | null;
  monthlyFee: number | null;
  stopId: string | null;
  stopName: string | null;
  direction: "both" | "inbound" | "outbound";
  startDate: string | null;
  endDate: string | null;
  status: "active" | "inactive";
  academicYear: string | null;
  notes: string | null;
  assignedDate: string | null;
  endedDate: string | null;
}

export interface TransportHistoryResponse {
  studentId: string;
  studentName: string;
  currentAssignment: TransportHistoryEntry | null;
  history: TransportHistoryEntry[];
  summary: {
    totalAssignments: number;
    activeAssignments: number;
    currentRoute: string | null;
    earliestAssignment: string | null;
  };
  filterOptions?: {
    months: number[];
    years: number[];
  };
}

export function useTransportHistory(
  studentId: string | undefined,
  filters?: { month?: string; year?: string }
) {
  const query = useQuery<TransportHistoryResponse>({
    queryKey: ["student-transport-history", studentId, filters?.month, filters?.year],
    queryFn: () => api.getStudentTransportHistory(studentId!, filters),
    enabled: !!studentId,
    staleTime: 30_000,
  });

  return {
    data: query.data,
    history: query.data?.history ?? [],
    currentAssignment: query.data?.currentAssignment ?? null,
    summary: query.data?.summary,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
