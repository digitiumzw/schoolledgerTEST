/**
 * useFeeCampaigns Hook (Feature 059 — Fee Campaigns)
 * Refactored for Feature 084 — backend-driven architecture.
 *
 * Manages list, CRUD, payment, and lifecycle actions for fee campaigns.
 */

import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import {
  api,
  FeeCampaign,
  CampaignStudent,
  CreateCampaignInput,
  RecordCampaignPaymentInput,
  CampaignStatus,
  CampaignStudentStatus,
} from "@/api/api";
import { useToast } from "@/hooks/use-toast";
import type { PaginatedResponse } from "@/types/dashboard";

export const FEE_CAMPAIGNS_QUERY_KEY = "fee-campaigns";

export interface UseFeeCampaignsParams {
  status?: CampaignStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface UseFeeCampaignsResult {
  campaigns: FeeCampaign[];
  pagination: PaginatedResponse<FeeCampaign>["pagination"] | undefined;
  loading: boolean;
  isError: boolean;
  saving: boolean;

  loadCampaigns: (status?: CampaignStatus) => void;
  refetch: () => void;
  createCampaign: (input: CreateCampaignInput) => Promise<FeeCampaign | null>;
  closeCampaign: (id: string, force?: boolean) => Promise<boolean>;

  getCampaignStudents: (campaignId: string, status?: CampaignStudentStatus) => Promise<CampaignStudent[]>;
  addStudent: (campaignId: string, studentId: string) => Promise<CampaignStudent | null>;
  removeStudent: (campaignId: string, studentId: string, force?: boolean) => Promise<boolean>;

  recordPayment: (campaignId: string, input: RecordCampaignPaymentInput) => Promise<any>;
  isPending: boolean;
}

export function useFeeCampaigns(params: UseFeeCampaignsParams = {}): UseFeeCampaignsResult {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryResult = useQuery<PaginatedResponse<FeeCampaign>>({
    queryKey: [FEE_CAMPAIGNS_QUERY_KEY, params],
    queryFn: () => api.getFeeCampaigns(params),
    placeholderData: keepPreviousData,
  });

  const campaigns = queryResult.data?.data ?? [];
  const pagination = queryResult.data?.pagination;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [FEE_CAMPAIGNS_QUERY_KEY] });

  const loadCampaigns = useCallback(
    (_status?: CampaignStatus) => {
      invalidate();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const createMutation = useMutation({
    mutationFn: (input: CreateCampaignInput) => api.createFeeCampaign(input),
    onSuccess: (result, input) => {
      toast({
        title: "Campaign created",
        description: `${input.name} — ${result.assignedCount} student(s) assigned`,
      });
      invalidate();
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to create campaign";
      toast({ title: "Create failed", description: message, variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) =>
      api.closeFeeCampaign(id, force),
    onSuccess: () => {
      toast({ title: "Campaign closed" });
      invalidate();
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to close campaign";
      toast({ title: "Close failed", description: message, variant: "destructive" });
    },
  });

  const addStudentMutation = useMutation({
    mutationFn: ({ campaignId, studentId }: { campaignId: string; studentId: string }) =>
      api.addCampaignStudent(campaignId, studentId),
    onSuccess: () => {
      toast({ title: "Student added to campaign" });
      invalidate();
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to add student";
      toast({ title: "Add failed", description: message, variant: "destructive" });
    },
  });

  const removeStudentMutation = useMutation({
    mutationFn: ({ campaignId, studentId, force }: { campaignId: string; studentId: string; force: boolean }) =>
      api.removeCampaignStudent(campaignId, studentId, force),
    onSuccess: () => {
      toast({ title: "Student removed from campaign" });
      invalidate();
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to remove student";
      toast({ title: "Remove failed", description: message, variant: "destructive" });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: ({ campaignId, input }: { campaignId: string; input: RecordCampaignPaymentInput }) =>
      api.recordCampaignPayment(campaignId, input),
    onSuccess: (_data, { input }) => {
      toast({
        title: "Payment recorded",
        description: `$${input.amount.toFixed(2)} received`,
      });
      invalidate();
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : "Failed to record payment";
      toast({ title: "Payment failed", description: message, variant: "destructive" });
    },
  });

  const isPending =
    createMutation.isPending ||
    closeMutation.isPending ||
    addStudentMutation.isPending ||
    removeStudentMutation.isPending ||
    recordPaymentMutation.isPending;

  const createCampaign = useCallback(
    async (input: CreateCampaignInput): Promise<FeeCampaign | null> => {
      const result = await createMutation.mutateAsync(input).catch(() => null);
      return result ? result.campaign : null;
    },
    [createMutation],
  );

  const closeCampaign = useCallback(
    async (id: string, force = false): Promise<boolean> => {
      try {
        await closeMutation.mutateAsync({ id, force });
        return true;
      } catch {
        return false;
      }
    },
    [closeMutation],
  );

  const getCampaignStudents = useCallback(
    async (campaignId: string, status?: CampaignStudentStatus): Promise<CampaignStudent[]> => {
      try {
        return await api.getCampaignStudents(campaignId, status);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load students";
        toast({ title: "Load failed", description: message, variant: "destructive" });
        return [];
      }
    },
    [toast],
  );

  const addStudent = useCallback(
    async (campaignId: string, studentId: string): Promise<CampaignStudent | null> => {
      return addStudentMutation.mutateAsync({ campaignId, studentId }).catch(() => null);
    },
    [addStudentMutation],
  );

  const removeStudent = useCallback(
    async (campaignId: string, studentId: string, force = false): Promise<boolean> => {
      try {
        await removeStudentMutation.mutateAsync({ campaignId, studentId, force });
        return true;
      } catch {
        return false;
      }
    },
    [removeStudentMutation],
  );

  const recordPayment = useCallback(
    async (campaignId: string, input: RecordCampaignPaymentInput) => {
      return recordPaymentMutation.mutateAsync({ campaignId, input }).catch(() => null);
    },
    [recordPaymentMutation],
  );

  return {
    campaigns,
    pagination,
    loading: queryResult.isLoading,
    isError: queryResult.isError,
    saving: isPending,
    isPending,
    loadCampaigns,
    refetch: queryResult.refetch,
    createCampaign,
    closeCampaign,
    getCampaignStudents,
    addStudent,
    removeStudent,
    recordPayment,
  };
}
