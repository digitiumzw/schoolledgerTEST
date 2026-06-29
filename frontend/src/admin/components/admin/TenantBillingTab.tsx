import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "./StatusBadge";
import { getTenantInvoices, downloadInvoicePdf } from "@/api/platform";

type TenantInvoice = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  issued_at: string;
  payment_status: string | null;
};

export function TenantBillingTab({ tenantId }: { tenantId: string }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const invoicesQ = useQuery({
    queryKey: ["platform", "tenant-invoices", tenantId, statusFilter],
    queryFn: () =>
      getTenantInvoices(tenantId, statusFilter !== "all" ? { status: statusFilter } : {}).then(
        (r: any) => r.data
      ),
    enabled: !!tenantId,
  });

  const invoices: TenantInvoice[] = invoicesQ.data?.data ?? [];

  async function handleDownload(inv: TenantInvoice) {
    setDownloadingId(inv.id);
    try {
      const res = await downloadInvoicePdf(inv.id);
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${inv.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to download invoice");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {invoicesQ.isLoading ? "Loading invoices…" : `${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`}
        </p>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {invoicesQ.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : invoicesQ.isError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <p className="text-sm font-medium text-destructive">Failed to load invoices</p>
          <Button variant="outline" size="sm" onClick={() => invoicesQ.refetch()}>Retry</Button>
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No invoices found for this tenant</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{inv.invoice_number}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(inv.issued_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold whitespace-nowrap">
                  {inv.currency ?? "USD"} {Number(inv.amount).toFixed(2)}
                </span>
                {inv.payment_status && <StatusBadge status={inv.payment_status} />}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={downloadingId === inv.id}
                  onClick={() => handleDownload(inv)}
                  title="Download PDF"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
