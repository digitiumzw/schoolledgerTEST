/**
 * Step: Tuition structure — default tuition items and optional class overrides.
 *
 * Feature: 043-school-creation-onboarding
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { useSaveStep, useCompleteOnboarding } from '@/hooks/useOnboarding';
import { toast } from 'sonner';

interface Fee { name: string; amount: number | string; }
interface Props {
  initial?: { defaultFees?: Fee[]; classOverrides?: any[] };
  onComplete: (subscription: { plan_name: string; expires_at: string }) => void;
}

const EMPTY_FEE: Fee = { name: '', amount: '' };

export function StepFeeStructure({ initial, onComplete }: Props) {
  const [fees, setFees] = useState<Fee[]>(
    initial?.defaultFees && initial.defaultFees.length > 0
      ? initial.defaultFees
      : [{ name: 'Tuition', amount: '' }]
  );
  const save = useSaveStep();
  const complete = useCompleteOnboarding();

  function update(i: number, patch: Partial<Fee>) {
    setFees((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function add() {
    setFees((fs) => [...fs, { ...EMPTY_FEE }]);
  }

  function remove(i: number) {
    setFees((fs) => fs.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const f of fees) {
      if (!f.name.trim() || !(Number(f.amount) > 0)) {
        toast.error('Each fee must have a name and a positive amount.');
        return;
      }
    }
    const serialized = fees.map((f) => ({ name: f.name, amount: Number(f.amount) }));
    try {
      await save.mutateAsync({
        step: 'fee-structure',
        data: { defaultFees: serialized, classOverrides: [] },
      });
      // After saving the last step, call complete to activate the school.
      const result = await complete.mutateAsync();
      onComplete({
        plan_name: result.subscription.plan_name,
        expires_at: result.subscription.expires_at,
      });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to finalise onboarding');
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold">Tuition structure</h2>
        <p className="text-sm text-muted-foreground">
          Add the default tuition items charged to every student. You can refine class-specific
          overrides later from Settings.
        </p>
      </div>

      <div className="space-y-3">
        {fees.map((fee, i) => (
          <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-md border p-3">
            <div className="col-span-7">
              <Label>Fee name</Label>
              <Input placeholder="e.g. Tuition, Boarding"
                value={fee.name}
                onChange={(e) => update(i, { name: e.target.value })} />
            </div>
            <div className="col-span-3">
              <Label>Amount</Label>
              <Input type="number" min={0} step="0.01"
                value={fee.amount}
                onChange={(e) => update(i, { amount: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end">
              {fees.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="h-4 w-4" /> Add another fee
      </Button>

      <div className="pt-2">
        <Button type="submit" disabled={save.isPending || complete.isPending}>
          {complete.isPending
            ? 'Activating your school…'
            : save.isPending
              ? 'Saving…'
              : 'Finish & activate school'}
        </Button>
      </div>
    </form>
  );
}
