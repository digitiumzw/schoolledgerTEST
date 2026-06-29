/**
 * useFeeStructure Hook
 *
 * Manages billing-cycle state (structureType / termsPerYear).
 * Default fees and class overrides have been removed — use Fee Rules instead.
 */

import { useState, useCallback, useEffect } from "react";
import { api } from "@/api/api";
import { FeeStructure } from "@/types/dashboard";
import { useToast } from "@/hooks/use-toast";

export interface UseFeeStructureResult {
  structure: FeeStructure | null;
  loading: boolean;
  saving: boolean;
  loadStructure: () => Promise<void>;
  saveStructure: () => Promise<boolean>;
  updateBillingCycle: (cycle: 'termly' | 'monthly') => void;
}

export function useFeeStructure(): UseFeeStructureResult {
  const [structure, setStructure] = useState<FeeStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadStructure = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getFeeStructure();
      setStructure({
        structureType: data.structureType || 'termly',
        termsPerYear: data.termsPerYear || 3,
        defaultFees: {},
        classOverrides: {},
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to load fee structure.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadStructure();
  }, [loadStructure]);

  const saveStructure = useCallback(async (): Promise<boolean> => {
    if (!structure) return false;
    try {
      setSaving(true);
      await api.saveFeeStructure({
        structureType: structure.structureType,
        termsPerYear: structure.termsPerYear,
      });
      toast({ title: "Saved", description: "Billing cycle updated." });
      return true;
    } catch {
      toast({
        title: "Error",
        description: "Failed to save billing cycle.",
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }, [structure, toast]);

  const updateBillingCycle = useCallback((cycle: 'termly' | 'monthly') => {
    if (!structure) return;
    setStructure({ ...structure, structureType: cycle });
  }, [structure]);

  return {
    structure,
    loading,
    saving,
    loadStructure,
    saveStructure,
    updateBillingCycle,
  };
}
