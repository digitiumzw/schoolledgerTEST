/**
 * Step: Optional password change.
 *
 * Per FR-013a, this step is optional — the admin may skip it entirely. The
 * temporary password is invalidated regardless of whether the admin sets a new
 * password here (already handled server-side at first login).
 *
 * Feature: 043-school-creation-onboarding
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useChangeOnboardingPassword, useSaveStep } from '@/hooks/useOnboarding';
import { toast } from 'sonner';

interface Props {
  onAdvance: () => void;
}

export function StepPasswordChange({ onAdvance }: Props) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const changeMut = useChangeOnboardingPassword();
  const saveStep = useSaveStep();

  async function markStepComplete() {
    // Always mark this step done in progress so it shows as completed
    await saveStep.mutateAsync({ step: 'password', data: {} });
    onAdvance();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error('Password must be at least 8 characters.');
      return;
    }
    if (pw !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }
    try {
      await changeMut.mutateAsync({ newPassword: pw, confirmPassword: confirm });
      toast.success('Password updated.');
      await markStepComplete();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to change password');
    }
  }

  async function handleSkip() {
    await markStepComplete();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold">Set a new password</h2>
        <p className="text-sm text-muted-foreground">
          You logged in with a temporary password from the welcome email. You can set a permanent
          password now, or skip this step and change it later from your account settings.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="new-pw">New password</Label>
        <Input id="new-pw" type="password" autoComplete="new-password"
          value={pw} onChange={(e) => setPw(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="confirm-pw">Confirm new password</Label>
        <Input id="confirm-pw" type="password" autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={changeMut.isPending || saveStep.isPending}>
          {changeMut.isPending ? 'Saving…' : 'Save password and continue'}
        </Button>
        <Button type="button" variant="outline" disabled={saveStep.isPending} onClick={handleSkip}>
          Skip for now
        </Button>
      </div>
    </form>
  );
}
