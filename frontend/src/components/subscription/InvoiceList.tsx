import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/api/api";
import type { SubscriptionInvoice } from "@/api/api";

interface InvoiceListProps {
  invoices: SubscriptionInvoice[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function InvoiceList({ invoices }: InvoiceListProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (invoice: SubscriptionInvoice) => {
    setDownloadingId(invoice.id);
    try {
      const blob = await api.downloadInvoice(invoice.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent — user can retry
    } finally {
      setDownloadingId(null);
    }
  };

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
        <FileText className="h-8 w-8 opacity-40" />
        <span>No invoices yet. Invoices are generated after each successful payment.</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Invoice #</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3">Cycle</th>
            <th className="px-4 py-3 text-right">Amount</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {invoices.map((inv) => (
            <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issuedAt)}</td>
              <td className="px-4 py-3 font-mono text-xs">{inv.invoiceNumber}</td>
              <td className="px-4 py-3">{inv.planName}</td>
              <td className="px-4 py-3 capitalize">{inv.billingCycle}</td>
              <td className="px-4 py-3 text-right font-medium">{formatCents(inv.amountCents, inv.currency)}</td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={downloadingId === inv.id}
                  onClick={() => handleDownload(inv)}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  {downloadingId === inv.id ? 'Downloading…' : 'Download'}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
