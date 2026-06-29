import { useQuery } from '@tanstack/react-query';
import { attendanceApi, TodayAttendanceResponse } from '@/api/attendance';

/**
 * React Query hook for today's attendance data, including unchecked staff count.
 * Refetches every 5 minutes automatically.
 */
export function useTodayAttendance() {
  return useQuery<TodayAttendanceResponse>({
    queryKey: ['attendance-today'],
    queryFn: () => attendanceApi.getToday(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });
}
