import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/api/api";
import type { ReceiptListResponse } from "@/api/api";

export function useReceiptList(
  studentId: string | undefined,
  page: number = 1,
  limit: number = 20,
) {
  return useQuery<ReceiptListResponse>({
    queryKey: ["receiptList", studentId, page, limit],
    queryFn: () => api.getReceiptList(studentId!, page, limit),
    enabled: !!studentId,
    placeholderData: keepPreviousData,
  });
}
