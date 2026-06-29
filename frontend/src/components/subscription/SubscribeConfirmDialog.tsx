import { CreditCard, Loader2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SubscribeConfirmDialogProps {
  open: boolean;
  planName: string;
  price: string;
  cycle: 'monthly' | 'annual';
  actionLabel: 'Subscribe' | 'Upgrade' | 'Downgrade';
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const PAYNOW_METHODS = [
  { name: 'Visa / Mastercard', detail: 'Card payment' },
  { name: 'EcoCash', detail: 'Via Paynow portal' },
  { name: 'OneMoney', detail: 'Via Paynow portal' },
  { name: 'Telecash', detail: 'Via Paynow portal' },
];

export function SubscribeConfirmDialog({
  open,
  planName,
  price,
  cycle,
  actionLabel,
  isLoading,
  onConfirm,
  onCancel,
}: SubscribeConfirmDialogProps) {
  const { resolvedTheme } = useTheme();
  const paynowBadge = resolvedTheme === 'dark'
    ? '/Paynow Badge-vector-hires LIGHT.svg'
    : '/Paynow Badge-vector-hires DARK.svg';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Confirm {actionLabel}
          </DialogTitle>
          <DialogDescription>
            You're about to {actionLabel.toLowerCase()} to the{' '}
            <span className="font-semibold text-foreground">{planName}</span> plan at{' '}
            <span className="font-semibold text-foreground">{price}</span> ({cycle} billing).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            You'll be redirected to <span className="font-medium text-foreground">Paynow</span> to
            complete your payment securely. The following payment methods are available:
          </p>

          <div className="rounded-lg border divide-y text-sm">
            {PAYNOW_METHODS.map((m) => (
              <div key={m.name} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-medium">{m.name}</span>
                <span className="text-muted-foreground text-xs">{m.detail}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-1">
            <img
              src={paynowBadge}
              alt="Powered by Paynow"
              className="h-9 object-contain"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Your subscription will activate automatically once payment is confirmed.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Continue to Paynow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
