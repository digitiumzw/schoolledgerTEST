import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSettings, updateSettings,
  getTeam, inviteTeamMember, removeTeamMember, changeTeamMemberRole,
  resendTeamInvite, deactivateTeamMember,
  updateAccount, updatePassword,
  getLoginHistory,
} from '@/api/platform';
import { useToast } from '@/hooks/use-toast';

export function useSettings() {
  return useQuery({
    queryKey: ['platform', 'settings'],
    queryFn: () => getSettings().then((r) => r.data.data),
    staleTime: 60_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => updateSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'settings'] });
      toast({ title: 'Settings saved' });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast({ title: err.response?.data?.message ?? 'Failed to save settings', variant: 'destructive' }),
  });
}

export function useTeam() {
  return useQuery({
    queryKey: ['platform', 'team'],
    queryFn: () => getTeam().then((r) => r.data.data),
    staleTime: 60_000,
  });
}

export function useInviteTeamMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => inviteTeamMember(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'team'] });
      toast({ title: 'Invitation sent' });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast({
        title: 'Error',
        description: err.response?.data?.message || 'Failed to invite team member',
        variant: 'destructive',
      }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => removeTeamMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'team'] });
      toast({ title: 'Team member removed' });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast({ title: err.response?.data?.message ?? 'Failed to remove team member', variant: 'destructive' }),
  });
}

export function useChangeTeamMemberRole() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => changeTeamMemberRole(id, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'team'] });
      toast({ title: 'Role updated' });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast({ title: err.response?.data?.message ?? 'Failed to update role', variant: 'destructive' }),
  });
}

export function useDeactivateTeamMember() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => deactivateTeamMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'team'] });
      toast({ title: 'Team member deactivated' });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast({ title: err.response?.data?.message ?? 'Failed to deactivate', variant: 'destructive' }),
  });
}

export function useResendInvite() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (id: number) => resendTeamInvite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'team'] });
      toast({ title: 'Invitation resent' });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast({ title: err.response?.data?.message ?? 'Failed to resend invite', variant: 'destructive' }),
  });
}

// ─── Account ────────────────────────────────────────────────────────────────

export function useUpdateAccount() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: { name: string; email: string }) => updateAccount(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform', 'me'] });
      toast({ title: 'Profile updated' });
    },
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast({ title: err.response?.data?.message ?? 'Failed to update profile', variant: 'destructive' }),
  });
}

export function useUpdatePassword() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string; new_password_confirmation: string }) =>
      updatePassword(data),
    onSuccess: () => toast({ title: 'Password changed' }),
    onError: (err: { response?: { data?: { message?: string } } }) =>
      toast({ title: err.response?.data?.message ?? 'Failed to change password', variant: 'destructive' }),
  });
}

export function useLoginHistory() {
  return useQuery({
    queryKey: ['platform', 'login-history'],
    queryFn: () => getLoginHistory().then((r) => r.data.data),
    staleTime: 60_000,
  });
}
