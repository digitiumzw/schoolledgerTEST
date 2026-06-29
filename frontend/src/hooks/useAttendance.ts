import { useQuery } from '@tanstack/react-query';
import { attendanceApi, AttendanceSummaryResponse } from '@/api/attendance';

/**
 * React Query hook that fetches the monthly attendance summary from the API.
 * Re-fetches automatically when `month` changes.
 */
export function useAttendanceSummary(month: string) {
  return useQuery<AttendanceSummaryResponse>({
    queryKey: ['attendance-summary', month],
    queryFn: () => attendanceApi.getSummary(month),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
