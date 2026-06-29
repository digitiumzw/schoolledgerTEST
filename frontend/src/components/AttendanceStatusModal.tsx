import { useState } from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { TodayStaffEntry } from '@/api/attendance';
import { useUpdateAttendanceStatus } from '@/hooks/useUpdateAttendanceStatus';

// ─── Validation ───────────────────────────────────────────────────────────────

const commentSchema = z
  .string()
  .max(500, 'Comment must not exceed 500 characters')
  .optional();

// ─── Component ────────────────────────────────────────────────────────────────

interface AttendanceStatusModalProps {
  staff: TodayStaffEntry;
  onClose: () => void;
  onSuccess: () => void;
}

export function AttendanceStatusModal({
  staff,
  onClose,
  onSuccess,
}: AttendanceStatusModalProps) {
  const [status, setStatus] = useState<'absent' | 'excused'>('absent');
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);

  const mutation = useUpdateAttendanceStatus();

  function handleCommentChange(value: string) {
    setComment(value);
    const result = commentSchema.safeParse(value || undefined);
    setCommentError(result.success ? null : result.error.errors[0].message);
  }

  async function handleSubmit() {
    const result = commentSchema.safeParse(comment || undefined);
    if (!result.success) {
      setCommentError(result.error.errors[0].message);
      return;
    }

    mutation.mutate(
      {
        staffId: staff.staff_id,
        status,
        comment: comment || undefined,
      },
      { onSuccess }
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Update Attendance Status</DialogTitle>
          <DialogDescription>
            Mark {staff.first_name} {staff.last_name} as absent or excused for today.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Status selection */}
          <div className="space-y-1.5">
            <Label htmlFor="status-select">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as 'absent' | 'excused')}
            >
              <SelectTrigger id="status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="excused">Excused</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Optional comment */}
          <div className="space-y-1.5">
            <Label htmlFor="comment-field">
              Comment{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="comment-field"
              placeholder="e.g. Medical appointment"
              value={comment}
              onChange={(e) => handleCommentChange(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <div className="flex justify-between items-start">
              {commentError ? (
                <p className="text-xs text-destructive">{commentError}</p>
              ) : (
                <span />
              )}
              <p className="text-xs text-muted-foreground ml-auto">
                {comment.length}/500
              </p>
            </div>
          </div>

          {mutation.isError && (
            <p className="text-sm text-destructive">
              {(mutation.error as Error)?.message ?? 'Failed to update status'}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!!commentError || mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
