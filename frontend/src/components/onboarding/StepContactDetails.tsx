/**
 * Step: School contact email + physical address.
 *
 * Feature: 043-school-creation-onboarding
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSaveStep } from '@/hooks/useOnboarding';
import { toast } from 'sonner';

interface Props {
  initial?: { contact_email?: string; address?: string };
  onAdvance: () => void;
}

export function StepContactDetails({ initial, onAdvance }: Props) {
  const [email, setEmail] = useState(initial?.contact_email ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const save = useSaveStep();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      toast.error('Please enter a valid contact email.');
      return;
    }
    if (address.trim().length < 5) {
      toast.error('Address must be at least 5 characters.');
      return;
    }
    try {
      await save.mutateAsync({
        step: 'contact',
        data: { contact_email: email.trim(), address: address.trim() },
      });
      onAdvance();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save contact details');
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold">School contact details</h2>
        <p className="text-sm text-muted-foreground">
          These details appear on receipts, invoices, and outgoing communications.
        </p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contact-email">School contact email</Label>
        <Input id="contact-email" type="email" placeholder="info@yourschool.edu"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">Physical address</Label>
        <Textarea id="address" placeholder="Street, city, country"
          rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Continue'}
      </Button>
    </form>
  );
}
