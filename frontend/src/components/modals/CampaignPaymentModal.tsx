/**
 * CampaignPaymentModal (Feature 059 — Fee Campaigns)
 *
 * Records a payment against a specific student's campaign record.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { CampaignStudent, RecordCampaignPaymentInput } from "@/api/api";

const PAYMENT_METHODS = [
  "Cash",
  "EcoCash",
  "Bank Transfer",
  "Mukuru",
  "InnBucks",
  "OneMoney",
  "Telecash",
  "Swipe",
  "ZIPIT",
  "Other",
] as const;

interface CampaignPaymentModalProps {
  open: boolean;
  student: CampaignStudent | null;
  campaignName: string;
  onClose: () => void;
  onSubmit: (input: RecordCampaignPaymentInput) => Promise<any>;
  saving: boolean;
}

export function CampaignPaymentModal({
  open,
  student,
  campaignName,
  onClose,
  onSubmit,
  saving,
}: CampaignPaymentModalProps) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("Cash");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open && student) {
      setAmount(student.remainingAmount.toFixed(2));
      setMethod("Cash");
      setDate(new Date().toISOString().split("T")[0]);
      setDescription("");
    }
  }, [open, student]);

  const remaining = student?.remainingAmount ?? 0;
  const parsedAmount = parseFloat(amount) || 0;
  const canSubmit = parsedAmount > 0 && parsedAmount <= remaining && method && !saving;

  const handleSubmit = async () => {
    if (!student) return;
    const input: RecordCampaignPaymentInput = {
      studentId: student.studentId,
      amount: parsedAmount,
      method,
      date: date || undefined,
      description: description.trim() || undefined,
    };
    const result = await onSubmit(input);
    if (result) onClose();
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Record Campaign Payment</DialogTitle>
          <DialogDescription>
            {student?.studentName ?? "Student"} — {campaignName}
          </DialogDescription>
        </DialogHeader>

        {student && (
          <div className="space-y-4 py-2">
            {/* Summary */}
            <div className="rounded-md bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expected</span>
                <span>{formatCurrency(student.expectedAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Paid so far</span>
                <span>{formatCurrency(student.paidAmount)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Remaining</span>
                <span>{formatCurrency(remaining)}</span>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Amount ($) *</Label>
              <Input
                id="pay-amount"
                type="number"
                min="0.01"
                max={remaining}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {parsedAmount > remaining && (
                <p className="text-xs text-destructive">
                  Cannot exceed remaining balance of {formatCurrency(remaining)}
                </p>
              )}
            </div>

            {/* Method */}
            <div className="space-y-1.5">
              <Label>Payment Method *</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Date</Label>
              <Input
                id="pay-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="pay-desc">Description</Label>
              <Input
                id="pay-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
