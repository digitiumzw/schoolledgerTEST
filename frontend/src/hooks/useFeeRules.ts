/**
 * useFeeRules Hook (Feature 056 — Fee Structure & Billing Engine)
 *
 * Manages CRUD for fee rules plus the charge-generation and unbilled-alert
 * actions exposed by `/api/fee-rules/*`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  FeeRule,
  FeeRuleBillingMeta,
  FeeRuleGenerateInput,
  FeeRuleGenerationResult,
  FeeRuleInput,
  FeeRuleUnbilledAlert,
  ChargeBatchSummary,
  ChargeBatchVoidResult,
} from "@/api/api";
import { useToast } from "@/hooks/use-toast";

export interface UseFeeRulesResult {
  rules: FeeRule[];
  billingMeta: FeeRuleBillingMeta | null;
  unbilledAlert: FeeRuleUnbilledAlert | null;

  loading: boolean;
  saving: boolean;
  generating: boolean;
  rollbackLoading: boolean;
  rollbackVoiding: boolean;
  latestRollbackBatch: ChargeBatchSummary | null;
  rollbackError: string | null;

  loadAll: () => Promise<void>;
  refreshAlert: () => Promise<void>;

  createRule: (payload: FeeRuleInput) => Promise<FeeRule | null>;
  updateRule: (id: string, payload: Partial<FeeRuleInput>) => Promise<FeeRule | null>;
  deleteRule: (id: string) => Promise<boolean>;

  generate: (input: FeeRuleGenerateInput) => Promise<FeeRuleGenerationResult | null>;
  fetchLatestRollbackBatch: () => Promise<ChargeBatchSummary | null>;
  voidLatestRollbackBatch: (reason?: string) => Promise<ChargeBatchVoidResult | null>;
}

export function useFeeRules(): UseFeeRulesResult {
  const [rules, setRules] = useState<FeeRule[]>([]);
  const [billingMeta, setBillingMeta] = useState<FeeRuleBillingMeta | null>(null);
  const [unbilledAlert, setUnbilledAlert] = useState<FeeRuleUnbilledAlert | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rollbackLoading, setRollbackLoading] = useState(false);
  const [rollbackVoiding, setRollbackVoiding] = useState(false);
  const [latestRollbackBatch, setLatestRollbackBatch] = useState<ChargeBatchSummary | null>(null);
  const [rollbackError, setRollbackError] = useState<string | null>(null);

  const { toast } = useToast();

  // ── Loaders ──────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [rulesRes, metaRes, alertRes] = await Promise.all([
        api.getFeeRules(),
        api.getFeeRuleBillingMeta(),
        api.getFeeRuleUnbilledAlert().catch(() => null),
      ]);
      setRules(rulesRes);
      setBillingMeta(metaRes);
      if (alertRes) setUnbilledAlert(alertRes);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load fee rules";
      toast({ title: "Load failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const refreshAlert = useCallback(async () => {
    try {
      const alert = await api.getFeeRuleUnbilledAlert();
      setUnbilledAlert(alert);
    } catch {
      // Soft-fail: alert is non-critical UI.
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const createRule = useCallback(
    async (payload: FeeRuleInput): Promise<FeeRule | null> => {
      try {
        setSaving(true);
        const created = await api.createFeeRule(payload);
        setRules((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
        toast({ title: "Fee rule created", description: created.name });
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to create fee rule";
        toast({ title: "Create failed", description: message, variant: "destructive" });
        return null;
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  const updateRule = useCallback(
    async (id: string, payload: Partial<FeeRuleInput>): Promise<FeeRule | null> => {
      try {
        setSaving(true);
        const updated = await api.updateFeeRule(id, payload);
        setRules((prev) =>
          prev
            .map((r) => (r.id === id ? updated : r))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        toast({ title: "Fee rule updated", description: updated.name });
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update fee rule";
        toast({ title: "Update failed", description: message, variant: "destructive" });
        return null;
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  const deleteRule = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setSaving(true);
        await api.deleteFeeRule(id);
        setRules((prev) => prev.filter((r) => r.id !== id));
        toast({ title: "Fee rule deleted" });
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete fee rule";
        toast({ title: "Delete failed", description: message, variant: "destructive" });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [toast],
  );

  // ── Generation ───────────────────────────────────────────────────────────

  const generate = useCallback(
    async (input: FeeRuleGenerateInput): Promise<FeeRuleGenerationResult | null> => {
      try {
        setGenerating(true);
        const result = await api.generateFeeRuleCharges(input);
        const created = result.generatedCount;
        const skipped = result.skippedDuplicateCount;
        toast({
          title: "Charges generated",
          description: `${created} created · ${skipped} skipped (duplicate)`,
        });
        // Refresh alert so the badge updates immediately.
        refreshAlert();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate charges";
        toast({ title: "Generation failed", description: message, variant: "destructive" });
        return null;
      } finally {
        setGenerating(false);
      }
    },
    [toast, refreshAlert],
  );

  const fetchLatestRollbackBatch = useCallback(async (): Promise<ChargeBatchSummary | null> => {
    try {
      setRollbackLoading(true);
      setRollbackError(null);
      const batch = await api.getLatestFeeRuleChargeBatch();
      setLatestRollbackBatch(batch);
      return batch;
    } catch (err) {
      const message = err instanceof Error ? err.message : "No active fee rule charge batch exists";
      setLatestRollbackBatch(null);
      setRollbackError(message);
      return null;
    } finally {
      setRollbackLoading(false);
    }
  }, []);

  const voidLatestRollbackBatch = useCallback(
    async (reason?: string): Promise<ChargeBatchVoidResult | null> => {
      try {
        setRollbackVoiding(true);
        setRollbackError(null);
        const result = await api.voidLatestFeeRuleChargeBatch({ reason });
        setLatestRollbackBatch(null);
        toast({
          title: "Fee rule charge batch voided",
          description: `${result.chargeCount} charges · ${result.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        });
        await refreshAlert();
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to void latest fee rule charge batch";
        setRollbackError(message);
        toast({ title: "Rollback failed", description: message, variant: "destructive" });
        return null;
      } finally {
        setRollbackVoiding(false);
      }
    },
    [refreshAlert, toast],
  );

  // ── Memoised return ──────────────────────────────────────────────────────

  return useMemo(
    () => ({
      rules,
      billingMeta,
      unbilledAlert,
      loading,
      saving,
      generating,
      rollbackLoading,
      rollbackVoiding,
      latestRollbackBatch,
      rollbackError,
      loadAll,
      refreshAlert,
      createRule,
      updateRule,
      deleteRule,
      generate,
      fetchLatestRollbackBatch,
      voidLatestRollbackBatch,
    }),
    [
      rules,
      billingMeta,
      unbilledAlert,
      loading,
      saving,
      generating,
      rollbackLoading,
      rollbackVoiding,
      latestRollbackBatch,
      rollbackError,
      loadAll,
      refreshAlert,
      createRule,
      updateRule,
      deleteRule,
      generate,
      fetchLatestRollbackBatch,
      voidLatestRollbackBatch,
    ],
  );
}
