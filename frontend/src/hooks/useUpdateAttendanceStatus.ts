import { useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '@/api/attendance';
import { toast } from 'sonner';

interface UpdateStatusVars {
  staffId: string;
  status: 'absent' | 'excused';
  comment?: string;
}

/** React Query mutation for updating a staff member's attendance status. */
export function useUpdateAttendanceStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ staffId, status, comment }: UpdateStatusVars) =>
      attendanceApi.updateStatus(staffId, status, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
      toast.success('Attendance status updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update attendance status');
    },
  });
}
