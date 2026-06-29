import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/api";

/**
 * Feature 054 / US5: Missing transport charge alerts.
 *
 * Returns students with active transport assignments who lack a transport
 * charge for the given month (default: current month, YYYY-MM).
 */

export interface MissingChargeStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  admissionNumber: string | null;
  className: string | null;
  monthlyFee: number;
  assignmentDate: string | null;
  academicYear: string | null;
}

export interface MissingChargeRouteGroup {
  routeId: string;
  routeName: string | null;
  monthlyFee: number;
  missingCount: number;
  students: MissingChargeStudent[];
}

export interface MissingChargesResponse {
  month: string;
  totalMissing: number;
  byRoute: MissingChargeRouteGroup[];
}

export interface MissingChargesFilters {
  month?: string;
  routeId?: string;
  academicYear?: string;
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function useMissingChargeAlerts(filters: MissingChargesFilters = {}) {
  const month = filters.month ?? currentMonth();

  const query = useQuery<MissingChargesResponse>({
    queryKey: ["missing-transport-charges", month, filters.routeId ?? null, filters.academicYear ?? null],
    queryFn: () =>
      api.getMissingTransportCharges({
        month,
        routeId: filters.routeId,
        academicYear: filters.academicYear,
      }),
    staleTime: 60_000,
  });

  return {
    data: query.data,
    totalMissing: query.data?.totalMissing ?? 0,
    byRoute: query.data?.byRoute ?? [],
    month: query.data?.month ?? month,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
