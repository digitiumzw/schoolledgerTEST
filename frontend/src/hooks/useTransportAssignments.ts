import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/api";
import { useToast } from "@/hooks/use-toast";

/**
 * Feature 054: Transport assignment mutations.
 *
 * Provides hooks for creating, reassigning, updating, and removing student
 * transport allocations. All mutations invalidate the relevant React Query
 * caches (routes, allocations, missing-charges, transport history).
 */

export interface CreateAllocationInput {
  routeId: string;
  studentId: string;
  stopId: string;
  direction?: "both" | "inbound" | "outbound";
  notes?: string;
  academicYear?: string;
}

export interface ReassignAllocationInput {
  studentId: string;
  fromRouteId: string;
  toRouteId: string;
  toStopId: string;
  direction?: "both" | "inbound" | "outbound";
  notes?: string;
  reassignDate?: string;
  academicYear?: string;
}

export function useTransportAssignments() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateAll = (studentId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["transport-routes"] });
    queryClient.invalidateQueries({ queryKey: ["transport-allocations"] });
    queryClient.invalidateQueries({ queryKey: ["missing-transport-charges"] });
    if (studentId) {
      queryClient.invalidateQueries({
        queryKey: ["student-transport-history", studentId],
      });
    }
  };

  const assignStudent = useMutation({
    mutationFn: (input: CreateAllocationInput) =>
      api.createAllocation(input.routeId, {
        studentId: input.studentId,
        stopId: input.stopId,
        direction: input.direction,
        notes: input.notes,
      }),
    onSuccess: (_data, vars) => {
      invalidateAll(vars.studentId);
      toast({
        title: "Student assigned",
        description: "The student was added to the route.",
      });
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ??
        error?.message ??
        "Failed to assign student";
      toast({
        title: "Assignment failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const reassignStudent = useMutation({
    mutationFn: (input: ReassignAllocationInput) => api.reassignAllocation(input),
    onSuccess: (_data, vars) => {
      invalidateAll(vars.studentId);
      toast({
        title: "Student reassigned",
        description: "The student was moved to the new route.",
      });
    },
    onError: (error: any) => {
      const msg =
        error?.response?.data?.message ??
        error?.message ??
        "Failed to reassign student";
      toast({
        title: "Reassignment failed",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const removeAllocation = useMutation({
    mutationFn: (allocationId: string) => api.removeAllocation(allocationId),
    onSuccess: () => {
      invalidateAll();
      toast({
        title: "Student removed",
        description: "The student was removed from the route.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Removal failed",
        description: error?.message ?? "Failed to remove allocation",
        variant: "destructive",
      });
    },
  });

  return {
    assignStudent,
    reassignStudent,
    removeAllocation,
  };
}
