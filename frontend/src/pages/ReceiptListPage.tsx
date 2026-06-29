import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useReceiptList } from "@/hooks/useReceiptList";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ChevronRight,
  Banknote,
  CreditCard,
  Building2,
  Smartphone,
  FileText,
} from "lucide-react";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/studentUtils";

const PAGE_SIZE = 20;

function MethodIcon({ method }: { method: string }) {
  const m = method.toLowerCase();
  const base = "w-9 h-9 rounded-md flex items-center justify-center shrink-0 border";
  if (m.includes("cash"))
    return <div className={`${base} bg-green-50 border-green-200`}><Banknote className="h-4 w-4 text-green-700" /></div>;
  if (m.includes("bank") || m.includes("transfer") || m.includes("rtgs") || m.includes("swipe"))
    return <div className={`${base} bg-blue-50 border-blue-200`}><Building2 className="h-4 w-4 text-blue-700" /></div>;
  if (m.includes("ecocash") || m.includes("mobile") || m.includes("innbucks") || m.includes("onemoney") || m.includes("paynow"))
    return <div className={`${base} bg-emerald-50 border-emerald-200`}><Smartphone className="h-4 w-4 text-emerald-700" /></div>;
  if (m.includes("card") || m.includes("visa") || m.includes("master") || m.includes("zimswitch"))
    return <div className={`${base} bg-indigo-50 border-indigo-200`}><CreditCard className="h-4 w-4 text-indigo-700" /></div>;
  return (
    <div className={`${base} bg-slate-50 border-slate-200`}>
      <span className="text-slate-600 text-[10px] font-bold">{method.slice(0, 2).toUpperCase()}</span>
    </div>
  );
}

export default function ReceiptListPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isFetching } = useReceiptList(studentId, page, PAGE_SIZE);

  const receipts = data?.receipts ?? [];
  const student = data?.student;
  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const currentPage = pagination?.page ?? 1;
  const total = pagination?.total ?? 0;

  const activeCount = receipts.filter((r) => !r.isVoided).length;
  const voidedCount = receipts.filter((r) => r.isVoided).length;
  const pageTotal = receipts.reduce((sum, r) => (r.isVoided ? sum : sum + r.amount), 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-4 px-2 sm:py-6 sm:px-4 print:bg-white print:py-0 print:px-0">
      <div className="w-full max-w-3xl bg-white shadow-sm border border-slate-200 rounded-lg print:shadow-none print:border-none print:rounded-none">

        {/* ─── Document Header ─── */}
        <div className="px-4 sm:px-6 md:px-8 pt-5 sm:pt-6 pb-4 sm:pb-5 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors print:hidden shrink-0"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-400 print:hidden shrink-0" />
                  <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
                    Transaction Statement
                  </h1>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isLoading
                    ? "Loading..."
                    : isError
                    ? "Could not load receipts"
                    : `${total} record${total !== 1 ? "s" : ""} total`}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Generated
              </p>
              <p className="text-sm text-slate-600 mt-0.5">
                {format(new Date(), "MMM dd, yyyy")}
              </p>
            </div>
          </div>

          {/* Student info bar */}
          {student && !isLoading && (
            <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-slate-400 text-xs">Student: </span>
                <span className="font-medium text-slate-700">
                  {student.firstName} {student.lastName}
                </span>
              </div>
              {student.admissionNumber && (
                <div>
                  <span className="text-slate-400 text-xs">Adm No: </span>
                  <span className="font-medium text-slate-700">{student.admissionNumber}</span>
                </div>
              )}
              {student.className && (
                <div>
                  <span className="text-slate-400 text-xs">Class: </span>
                  <span className="font-medium text-slate-700">{student.className}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Summary Strip ─── */}
        {!isLoading && !isError && receipts.length > 0 && (
          <div className="px-4 sm:px-6 md:px-8 py-3 bg-slate-50/70 border-b border-slate-200 print:bg-transparent">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Records (page)
                </p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{receipts.length}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Active
                </p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">{activeCount}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Voided
                </p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">
                  {voidedCount > 0 ? voidedCount : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                  Page Total
                </p>
                <p className="text-sm font-semibold text-slate-700 mt-0.5">
                  {formatCurrency(pageTotal)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── Skeleton ─── */}
        {isLoading && (
          <div className="px-4 sm:px-6 md:px-8 py-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 sm:gap-4 py-3.5 border-b border-slate-100 last:border-0">
                <Skeleton className="w-9 h-9 rounded-md shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24 sm:w-28" />
                  <Skeleton className="h-3 w-32 sm:w-40" />
                </div>
                <div className="text-right space-y-2">
                  <Skeleton className="h-3 w-16 sm:w-20 ml-auto" />
                  <Skeleton className="h-3 w-12 sm:w-16 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ─── Empty ─── */}
        {!isLoading && !isError && receipts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4">
            <FileText className="h-10 w-10 text-slate-200 mb-3" />
            <p className="text-sm text-slate-400">No receipts found for this student.</p>
          </div>
        )}

        {/* ─── Error ─── */}
        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 px-4">
            <p className="text-sm text-destructive">Failed to load receipts.</p>
          </div>
        )}

        {/* ─── Transaction Table ─── */}
        {!isLoading && receipts.length > 0 && (
          <div className="px-4 sm:px-6 md:px-8 py-4">
            {/* Table header (desktop only) */}
            <div className="hidden md:grid grid-cols-12 gap-2 pb-2 border-b border-slate-200 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              <div className="col-span-1"></div>
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Category</div>
              <div className="col-span-2">Method</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-2 text-right">Ref</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100">
              {receipts.map((receipt) => {
                const isMulti = receipt.paymentGroupId !== null && receipt.category.includes(",");
                const categoryLabel = isMulti ? "Multiple Categories" : (receipt.category || "Payment");
                const receiptRef = receipt.receiptNumber
                  ? receipt.receiptNumber.split(".").slice(-1)[0]
                    ? `Rec: ${receipt.receiptNumber}`
                    : receipt.receiptNumber
                  : `ID: ${receipt.id.slice(-6).toUpperCase()}`;
                const dateLabel = format(new Date(receipt.date), "MMM dd, yyyy");

                return (
                  <Link key={receipt.id} to={`/receipt/${receipt.id}`} className="block">
                    {/* Mobile layout: flex-based card */}
                    <div className={`md:hidden flex items-center gap-3 py-3.5 px-1 -mx-1 rounded-md hover:bg-slate-50 transition-colors ${receipt.isVoided ? "opacity-50" : ""}`}>
                      <MethodIcon method={receipt.method} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-sm font-semibold leading-tight ${receipt.isVoided ? "line-through text-slate-400" : "text-slate-900"}`}>
                            {formatCurrency(receipt.amount)}
                          </span>
                          {receipt.isVoided && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5 leading-none">
                              VOID
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{categoryLabel}</p>
                        <p className="text-xs text-slate-400 truncate">{receipt.method}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="text-right">
                          <p className="text-[11px] text-slate-400 truncate max-w-[80px]">{receiptRef}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{dateLabel}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 print:hidden" />
                      </div>
                    </div>

                    {/* Desktop layout: 12-col grid table row */}
                    <div className={`group hidden md:grid grid-cols-12 gap-2 items-center py-3.5 px-1 -mx-1 rounded-md hover:bg-slate-50 transition-colors ${receipt.isVoided ? "opacity-50" : ""}`}>
                      <div className="col-span-1 flex">
                        <MethodIcon method={receipt.method} />
                      </div>
                      <div className="col-span-2 text-sm text-slate-600">
                        {dateLabel}
                      </div>
                      <div className="col-span-3 text-sm text-slate-600 truncate">
                        {categoryLabel}
                      </div>
                      <div className="col-span-2 text-sm text-slate-500 truncate">
                        {receipt.method}
                      </div>
                      <div className="col-span-2 flex justify-end items-center gap-1.5">
                        <span className={`text-sm font-semibold tabular-nums ${receipt.isVoided ? "line-through text-slate-400" : "text-slate-900"}`}>
                          {formatCurrency(receipt.amount)}
                        </span>
                        {receipt.isVoided && (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5 leading-none">
                            VOID
                          </Badge>
                        )}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1 shrink-0">
                        <p className="text-[11px] text-slate-400 truncate">{receiptRef}</p>
                        <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 group-hover:text-slate-400 transition-colors print:hidden" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── Pagination ─── */}
        {totalPages > 1 && (
          <>
            <Separator className="bg-slate-200" />
            <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 sm:py-4 bg-slate-50/50 print:bg-transparent">
              <button
                disabled={currentPage <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="text-xs sm:text-sm font-medium text-slate-700 disabled:text-slate-300 transition-colors hover:text-slate-900 print:hidden"
              >
                ← Previous
              </button>
              <span className="text-xs text-slate-400">
                {isFetching ? "Loading…" : `Page ${currentPage} of ${totalPages}`}
              </span>
              <button
                disabled={currentPage >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="text-xs sm:text-sm font-medium text-slate-700 disabled:text-slate-300 transition-colors hover:text-slate-900 print:hidden"
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* ─── Document Footer ─── */}
        <div className="px-4 sm:px-6 md:px-8 py-4 border-t border-slate-200">
          <p className="text-center text-xs text-slate-300">
            Powered by SchoolLedger
          </p>
        </div>
      </div>
    </div>
  );
}
