import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { api } from '@/api/api';
import type { StaffListParams, StaffListResponse } from '@/types/dashboard';

export const STAFF_QUERY_KEY = 'staff';

export function useStaffQuery(params: StaffListParams) {
  return useQuery<StaffListResponse>({
    queryKey: [STAFF_QUERY_KEY, params],
    queryFn: () => api.getStaff(params),
    placeholderData: keepPreviousData,
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (staffData: Record<string, unknown>) => api.createStaff(staffData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_QUERY_KEY] });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      api.updateStaff(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_QUERY_KEY] });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteStaff(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STAFF_QUERY_KEY] });
    },
  });
}
