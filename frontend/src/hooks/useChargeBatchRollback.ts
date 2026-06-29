import { useCallback, useState } from "react";
import { toast } from "sonner";

import { api, ApiError, ChargeBatchSummary, ChargeBatchType, ChargeBatchVoidResult } from "@/api/api";

export interface UseChargeBatchRollbackResult {
  latestBatch: ChargeBatchSummary | null;
  loading: boolean;
  voiding: boolean;
  error: string | null;
  fetchLatestBatch: () => Promise<ChargeBatchSummary | null>;
  voidLatestBatch: (reason?: string) => Promise<ChargeBatchVoidResult | null>;
  resetLatestBatch: () => void;
}

export function useChargeBatchRollback(type: ChargeBatchType): UseChargeBatchRollbackResult {
  const [latestBatch, setLatestBatch] = useState<ChargeBatchSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = type === "transport" ? "transport" : "fee rule";

  const fetchLatestBatch = useCallback(async (): Promise<ChargeBatchSummary | null> => {
    setLoading(true);
    setError(null);
    try {
      const batch = type === "transport"
        ? await api.getLatestTransportChargeBatch()
        : await api.getLatestFeeRuleChargeBatch();
      setLatestBatch(batch);
      return batch;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setLatestBatch(null);
        setError(`No active ${label} charge batch exists.`);
        return null;
      }
      const message = err instanceof Error ? err.message : `Failed to load latest ${label} charge batch`;
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [label, type]);

  const voidLatestBatch = useCallback(async (reason?: string): Promise<ChargeBatchVoidResult | null> => {
    setVoiding(true);
    setError(null);
    try {
      const result = type === "transport"
        ? await api.voidLatestTransportChargeBatch({ reason })
        : await api.voidLatestFeeRuleChargeBatch({ reason });
      setLatestBatch(null);
      toast.success(`${label === "transport" ? "Transport" : "Fee rule"} charge batch voided`);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to void latest ${label} charge batch`;
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setVoiding(false);
    }
  }, [label, type]);

  const resetLatestBatch = useCallback(() => {
    setLatestBatch(null);
    setError(null);
  }, []);

  return {
    latestBatch,
    loading,
    voiding,
    error,
    fetchLatestBatch,
    voidLatestBatch,
    resetLatestBatch,
  };
}
