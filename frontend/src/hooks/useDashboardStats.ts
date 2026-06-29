import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/api";
import { DashboardStats } from "@/types/dashboard";

const STATS_QUERY_KEY = ["dashboard", "stats"] as const;
const ACTIVITY_QUERY_KEY = ["dashboard", "activity"] as const;
const ENROLLMENT_BY_CLASS_QUERY_KEY = ["dashboard", "enrollmentByClass"] as const;

export interface ActivityItem {
  id: string;
  type: "payment" | "leave" | "enrollment" | "status_change";
  description: string;
  detail: string;
  amount?: number | null;
  timestamp: string;
}

export interface ClassEnrollment {
  classId: string;
  className: string;
  level: number;
  total: number;
  male: number;
  female: number;
  other: number;
}

export function useDashboardStats(options: { includeStats?: boolean; includeEnrollmentByClass?: boolean } = {}) {
  const queryClient = useQueryClient();
  const includeStats = options.includeStats ?? true;
  const includeEnrollmentByClass = options.includeEnrollmentByClass ?? true;

  const statsQuery = useQuery<DashboardStats>({
    queryKey: STATS_QUERY_KEY,
    queryFn: () => api.getDashboardStats(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled: includeStats,
  });

  const activityQuery = useQuery<{ activities: ActivityItem[] }>({
    queryKey: ACTIVITY_QUERY_KEY,
    queryFn: () => api.getDashboardActivity(5),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const enrollmentByClassQuery = useQuery<{ classes: ClassEnrollment[] }>({
    queryKey: ENROLLMENT_BY_CLASS_QUERY_KEY,
    queryFn: () => api.getDashboardEnrollmentByClass(),
    staleTime: 60_000,
    refetchInterval: 120_000,
    enabled: includeEnrollmentByClass,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: STATS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ACTIVITY_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ENROLLMENT_BY_CLASS_QUERY_KEY });
  };

  return {
    stats: statsQuery.data ?? null,
    statsLoading: includeStats ? statsQuery.isLoading : false,
    statsError: includeStats ? statsQuery.error : null,
    activities: activityQuery.data?.activities ?? [],
    activitiesLoading: activityQuery.isLoading,
    enrollmentByClass: enrollmentByClassQuery.data?.classes ?? [],
    enrollmentByClassLoading: includeEnrollmentByClass ? enrollmentByClassQuery.isLoading : false,
    enrollmentByClassError: includeEnrollmentByClass ? enrollmentByClassQuery.error : null,
    refetch: invalidate,
  };
}
