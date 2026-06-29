/**
 * Step: Academic calendar — at least one term.
 *
 * Feature: 043-school-creation-onboarding
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import { generateTermId } from '@/utils/academicCalendar';
import { useSaveStep } from '@/hooks/useOnboarding';
import { toast } from 'sonner';

// Canonical Term shape (matches frontend/src/types/dashboard.ts).
interface Term { id: string; name: string; start: string; end: string; }
interface Props {
  initial?: { terms?: Term[] };
  onAdvance: () => void;
}

const EMPTY_TERM = (name = ''): Term => ({
  id:    generateTermId(name || 'TERM', ''),
  name,
  start: '',
  end:   '',
});

const DEFAULT_TERMS: Term[] = [
  EMPTY_TERM('Term 1'),
  EMPTY_TERM('Term 2'),
  EMPTY_TERM('Term 3'),
];

export function StepAcademicCalendar({ initial, onAdvance }: Props) {
  const [terms, setTerms] = useState<Term[]>(
    initial?.terms && initial.terms.length > 0
      ? initial.terms.map((t) => ({ ...t, id: t.id ?? generateTermId(t.name, t.start) }))
      : DEFAULT_TERMS
  );
  const save = useSaveStep();

  function updateTerm(idx: number, patch: Partial<Term>) {
    setTerms((ts) => ts.map((t, i) => {
      if (i !== idx) return t;
      const merged = { ...t, ...patch };
      if ('name' in patch || 'start' in patch) {
        merged.id = generateTermId(merged.name, merged.start);
      }
      return merged;
    }));
  }

  function removeTerm(idx: number) {
    if (terms.length <= 1) return;
    setTerms((ts) => ts.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const t of terms) {
      if (!t.name.trim() || !t.start || !t.end) {
        toast.error('Each term must have a name, start date, and end date.');
        return;
      }
      if (t.start >= t.end) {
        toast.error(`"${t.name}" start date must be before its end date.`);
        return;
      }
    }
    try {
      await save.mutateAsync({
        step: 'academic-calendar',
        data: { terms },
      });
      onAdvance();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save academic calendar');
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <h2 className="text-xl font-semibold">Academic calendar</h2>
        <p className="text-sm text-muted-foreground">
          Enter the start and end dates for each term. Remove any terms your school doesn't use.
          You can adjust these later from Settings.
        </p>
      </div>

      <div className="space-y-3">
        {terms.map((term, i) => (
          <div key={term.id} className="grid grid-cols-12 items-end gap-2 rounded-md border p-3">
            <div className="col-span-4">
              <Label>Term name</Label>
              <Input value={term.name} onChange={(e) => updateTerm(i, { name: e.target.value })} />
            </div>
            <div className="col-span-3">
              <Label>Start date</Label>
              <Input type="date" value={term.start}
                onChange={(e) => updateTerm(i, { start: e.target.value })} />
            </div>
            <div className="col-span-3">
              <Label>End date</Label>
              <Input type="date" value={term.end}
                onChange={(e) => updateTerm(i, { end: e.target.value })} />
            </div>
            <div className="col-span-2 flex justify-end">
              {terms.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeTerm(i)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </form>
  );
}
