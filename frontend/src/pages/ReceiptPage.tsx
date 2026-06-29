import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "@/api/api";
import { ReceiptDocument, ReceiptData } from "@/components/receipt/ReceiptDocument";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, List } from "lucide-react";

export default function ReceiptPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const receiptUrl = `${window.location.origin}/receipt/${id}`;

  const handlePrint = () => {
    // Wait for any images (QR data URL) to finish loading before printing.
    const images = document.querySelectorAll<HTMLImageElement>("#receipt-document img");
    const pending = Array.from(images).filter((img) => !img.complete);
    if (pending.length === 0) {
      window.print();
      return;
    }
    let loaded = 0;
    pending.forEach((img) => {
      img.addEventListener("load", () => {
        loaded++;
        if (loaded === pending.length) window.print();
      }, { once: true });
    });
  };

  useEffect(() => {
    if (!id) return;
    api
      .getReceipt(id)
      .then((data) => setReceiptData(data))
      .catch(() => setError("Receipt not found or may have been removed."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-10 px-4">
      <div className="w-full max-w-sm space-y-4">
        {/* Top bar — buttons centered */}
        {receiptData && (
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => {
                const sid = receiptData.student?.id;
                if (sid) navigate(`/receipts/student/${sid}`);
              }}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-900 transition-colors"
            >
              <List className="h-3.5 w-3.5" />
              All Receipts
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-gray-900 transition-colors print:hidden"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3 bg-white rounded-xl border p-6">
            <Skeleton className="h-6 w-40 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-px w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-24 mx-auto" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border p-8 text-center">
            <p className="text-destructive font-medium">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Check that you have the correct receipt link.
            </p>
          </div>
        ) : receiptData ? (
          <div className="flex justify-center">
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <ReceiptDocument data={receiptData} receiptUrl={receiptUrl} />
            </div>
          </div>
        ) : null}

        <p className="text-center text-xs text-gray-400 print:hidden">
          Powered by SchoolLedger
        </p>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-document, #receipt-document * { visibility: visible; }
          #receipt-document { position: fixed; top: 0; left: 0; }
        }
      `}</style>
    </div>
  );
}
