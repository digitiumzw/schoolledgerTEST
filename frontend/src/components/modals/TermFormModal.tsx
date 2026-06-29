import { useState, useEffect, useMemo } from "react";
import { Term } from "@/types/dashboard";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { generateTermId } from "@/utils/academicCalendar";

interface TermFormModalProps {
  term?: Term;           // undefined = add mode, provided = edit mode
  otherTerms?: Term[];
  open: boolean;
  onClose: () => void;
  onSuccess: (term: Term) => void;
}

export function TermFormModal({ term, otherTerms = [], open, onClose, onSuccess }: TermFormModalProps) {
  const isEdit = !!term;

  const [formData, setFormData] = useState({ name: '', start: '', end: '' });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setFormData({
        name:  term?.name  ?? '',
        start: term?.start ?? '',
        end:   term?.end   ?? '',
      });
    }
  }, [open, term]);

  const overlapWarning = useMemo(() => {
    if (!formData.start || !formData.end || otherTerms.length === 0) return null;
    const newStart = new Date(formData.start);
    const newEnd   = new Date(formData.end);
    for (const other of otherTerms) {
      if (!other.start || !other.end) continue;
      const otherStart = new Date(other.start);
      const otherEnd   = new Date(other.end);
      if (newStart <= otherEnd && newEnd >= otherStart) {
        return `These dates overlap with "${other.name}" (${format(otherStart, 'MMM d')} – ${format(otherEnd, 'MMM d')})`;
      }
    }
    return null;
  }, [formData.start, formData.end, otherTerms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast({ title: "Validation Error", description: "Term name is required.", variant: "destructive" });
      return;
    }
    if (!formData.start || !formData.end) {
      toast({ title: "Validation Error", description: "Please fill in both start and end dates.", variant: "destructive" });
      return;
    }
    if (new Date(formData.end) <= new Date(formData.start)) {
      toast({ title: "Validation Error", description: "End date must be after start date.", variant: "destructive" });
      return;
    }
    if (overlapWarning) {
      toast({ title: "Validation Error", description: overlapWarning, variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      const result: Term = {
        id:    generateTermId(formData.name, formData.start),
        name:  formData.name.trim(),
        start: formData.start,
        end:   formData.end,
      };
      toast({
        title: isEdit ? "Term Updated" : "Term Added",
        description: isEdit
          ? `${result.name} updated. Remember to save the calendar.`
          : `${result.name} added. Remember to save the calendar.`,
      });
      onSuccess(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${term!.name}` : 'Add Term'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Update the name and dates for ${term!.name}.` : 'Enter a name and dates for the new term.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="term-name">Term name *</Label>
            <Input
              id="term-name"
              placeholder="e.g. Term 1"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="start">Start date *</Label>
            <Input
              id="start"
              type="date"
              value={formData.start}
              onChange={e => setFormData({ ...formData, start: e.target.value })}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="end">End date *</Label>
            <Input
              id="end"
              type="date"
              value={formData.end}
              onChange={e => setFormData({ ...formData, end: e.target.value })}
              disabled={loading}
              min={formData.start}
            />
          </div>

          {overlapWarning && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">{overlapWarning}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !!overlapWarning}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Save Changes' : 'Add Term'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
