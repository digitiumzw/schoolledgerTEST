import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/api";
import { toast } from "sonner";

export function useCancelReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, reason }: { paymentId: string; reason: string }) => {
      return api.cancelPayment(paymentId, reason);
    },
    onSuccess: (data) => {
      toast.success(`Receipt ${data.receiptNumber ?? data.paymentId} canceled successfully.`);
      queryClient.invalidateQueries({ queryKey: ["payments-with-students"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      if (data.studentId) {
        queryClient.invalidateQueries({ queryKey: ["student-balance", data.studentId] });
        queryClient.invalidateQueries({ queryKey: ["student-payment-history", data.studentId] });
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to cancel receipt.");
    },
  });
}
