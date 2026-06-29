import { useState, useEffect, useRef } from "react";
import { api } from "@/api/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, ExternalLink, Trash2 } from "lucide-react";
import { ReceiptDocument, ReceiptData } from "@/components/receipt/ReceiptDocument";

interface PrintReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paymentId: string | null;
  onCancel?: (paymentId: string, receiptNumber: string | null) => void;
}

export function PrintReceiptModal({
  open,
  onOpenChange,
  paymentId,
  onCancel,
}: PrintReceiptModalProps) {
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const receiptUrl = paymentId
    ? `${window.location.origin}/receipt/${paymentId}`
    : "";

  useEffect(() => {
    if (!open || !paymentId) return;
    setReceiptData(null);
    setError(null);
    setLoading(true);
    api
      .getReceipt(paymentId)
      .then((data) => setReceiptData(data))
      .catch(() => setError("Failed to load receipt data."))
      .finally(() => setLoading(false));
  }, [open, paymentId]);

  const handlePrint = () => {
    const el = document.getElementById("receipt-document");
    if (!el) return;

    const printWindow = window.open("", "_blank", "width=420,height=750");
    if (!printWindow) return;

    // Clone the node so we can mutate it freely without touching the live DOM.
    const clone = el.cloneNode(true) as HTMLElement;
    // The id is only needed for the ReceiptPage's print CSS; remove it from
    // the clone so it doesn't create a duplicate id in the print document.
    clone.removeAttribute("id");

    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Payment Receipt</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background: #fff;
        display: flex;
        justify-content: center;
        padding: 20px;
        font-family: Arial, Helvetica, sans-serif;
      }
      @media print {
        @page { margin: 0; size: 80mm auto; }
        body { padding: 0; }
      }
    </style>
  </head>
  <body>${clone.outerHTML}</body>
</html>`);
    printWindow.document.close();

    // Wait for images (QR data URL) to render before triggering the print dialog.
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      // Give the dialog time to open before closing the helper window.
      setTimeout(() => printWindow.close(), 500);
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Payment Receipt</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive text-center py-6">{error}</p>
        ) : receiptData ? (
          <div className="flex-1 flex flex-col min-h-0 gap-4" ref={containerRef}>
            {/* Receipt preview — scrollable */}
            <div className="flex-1 flex justify-center overflow-y-auto min-h-0">
              <div className="border border-border rounded-lg overflow-hidden shadow-sm">
                <ReceiptDocument data={receiptData} receiptUrl={receiptUrl} />
              </div>
            </div>

            {/* Actions — compact inline links */}
            <div className="flex items-center justify-center gap-4 text-sm">
              {!receiptData.payment.isVoided && onCancel && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-destructive hover:underline font-medium"
                  onClick={() => onCancel(receiptData.payment.id, receiptData.payment.receiptNumber ?? null)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="inline-flex items-center gap-1 text-foreground hover:underline font-medium"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline font-medium"
                onClick={() => window.open(receiptUrl, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Online
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
