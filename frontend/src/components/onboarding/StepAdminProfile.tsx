/**
 * Step: Admin profile (full name).
 *
 * Feature: 043-school-creation-onboarding
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSaveStep } from '@/hooks/useOnboarding';
import { toast } from 'sonner';

interface Props {
  initial?: { admin_name?: string; phone_number?: string };
  onAdvance: () => void;
}

export function StepAdminProfile({ initial, onAdvance }: Props) {
  const [name, setName] = useState(initial?.admin_name ?? '');
  const [phoneNumber, setPhoneNumber] = useState(initial?.phone_number ?? '');
  const save = useSaveStep();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Please enter your full name (at least 2 characters).');
      return;
    }
    const cleanedPhone = phoneNumber.trim();
    if (cleanedPhone && (!/^[0-9+()\-\s]+$/.test(cleanedPhone) || (cleanedPhone.match(/\d/g)?.length ?? 0) < 7)) {
      toast.error('Please enter a valid phone number.');
      return;
    }
    try {
      await save.mutateAsync({ step: 'profile', data: { admin_name: name.trim(), phone_number: cleanedPhone } });
      onAdvance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save profile');
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold">Tell us about yourself</h2>
        <p className="text-sm text-muted-foreground">
          Your full name will appear on receipts, reports, and the dashboard header.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="admin-name">Full name</Label>
        <Input id="admin-name" placeholder="e.g. Jane Moyo"
          value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="admin-phone">Phone number</Label>
        <Input id="admin-phone" placeholder="e.g. +263 77 123 4567"
          value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
      </div>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  );
}
