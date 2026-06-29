import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, AlertTriangle } from "lucide-react";

interface CancelReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string | null;
  receiptNumber: string | null;
  onConfirm: (paymentId: string, reason: string) => void;
  isPending: boolean;
}

export function CancelReceiptModal({
  open,
  onOpenChange,
  paymentId,
  receiptNumber,
  onConfirm,
  isPending,
}: CancelReceiptModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("A reason is required to cancel a receipt.");
      return;
    }
    if (trimmed.length > 500) {
      setError("Reason must be 500 characters or less.");
      return;
    }
    setError("");
    if (paymentId) {
      onConfirm(paymentId, trimmed);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setReason("");
      setError("");
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancel Receipt
          </DialogTitle>
          <DialogDescription>
            This will void the receipt
            {receiptNumber ? ` ${receiptNumber}` : ""} and reverse the
            associated payment from the student&apos;s ledger. This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <Label htmlFor="void-reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="void-reason"
            placeholder="e.g. Duplicate entry, payment reversed by bank"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError("");
            }}
            disabled={isPending}
            rows={3}
            className={error ? "border-destructive" : ""}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending || !reason.trim()}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Canceling…
              </>
            ) : (
              "Confirm Cancel"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
