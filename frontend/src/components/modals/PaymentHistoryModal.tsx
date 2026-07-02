import { useState, useEffect, useCallback } from "react";
import { api, type PaymentHistoryRecord, type StudentPaymentHistoryResponse } from "@/api/api";
import { Student } from "@/types/dashboard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency, formatCurrencyForCode } from "@/lib/studentUtils";
import { useCurrencyConfig } from "@/hooks/useCurrencyConfig";
import { ChevronLeft, ChevronRight, Printer, Receipt } from "lucide-react";
import { PrintReceiptModal } from "./PrintReceiptModal";

const ITEMS_PER_PAGE = 15;

interface PaymentHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
}

export function PaymentHistoryModal({
  open,
  onOpenChange,
  student,
}: PaymentHistoryModalProps) {
  const [history, setHistory] = useState<StudentPaymentHistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const { data: currencyConfig } = useCurrencyConfig();
  const baseCurrency = currencyConfig?.baseCurrency ?? 'USD';

  useEffect(() => {
    if (student && open) {
      setCurrentPage(1);
      setHistory(null);
    }
  }, [student, open]);

  const fetchPaymentHistory = useCallback(async () => {
    if (!student) return;
    try {
      setLoading(true);
      const response = await api.getPaymentsByStudent(student.id, {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        sortBy: "date",
        sortOrder,
      });
      setHistory(response);
    } catch (error) {
      console.error("Error fetching payment history:", error);
      toast.error("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortOrder, student]);

  useEffect(() => {
    if (student && open) {
      fetchPaymentHistory();
    }
  }, [student, open, fetchPaymentHistory]);

  const payments = history?.data ?? [];
  const totalPages = history?.pagination.totalPages ?? 0;
  const totalRecords = history?.pagination.total ?? 0;
  const summary = history?.summary ?? {
    totalPaid: 0,
    totalThisTerm: 0,
    latestPaymentDate: null,
    latestPaymentAmount: null,
    daysSinceLastPayment: null,
  };
  const currentBalance = history?.student.currentBalance ?? student?.balance ?? 0;

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Payment History</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 overflow-y-auto">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : student ? (
          <div className="flex flex-col gap-6 overflow-y-auto min-h-0">
            {/* Student Info Header */}
            <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card shrink-0">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {getInitials(student.firstName, student.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-card-foreground truncate">
                  {student.firstName} {student.lastName}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {student.admissionNumber && (
                    <span className="mr-3">#{student.admissionNumber}</span>
                  )}
                  Class: {student.className || student.classId || "—"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  Current Balance
                </p>
                {(() => {
                  const bal = currentBalance;
                  return (
                    <p
                      className={`text-2xl font-bold ${
                        bal > 0 ? "text-destructive" : "text-green-600"
                      }`}
                    >
                      {formatCurrency(bal)}
                    </p>
                  );
                })()}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4 shrink-0">
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Payments
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <p className="text-2xl font-bold">{totalRecords}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Total Paid
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(summary.totalPaid)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    This Term
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  <p className="text-2xl font-bold text-primary">
                    {formatCurrency(summary.totalThisTerm)}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Last Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  {summary.latestPaymentDate ? (
                    <>
                      <p className="text-xl font-bold">
                        {formatCurrency(summary.latestPaymentAmount ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {summary.daysSinceLastPayment === 0
                          ? "Today"
                          : `${summary.daysSinceLastPayment}d ago`}
                      </p>
                    </>
                  ) : (
                    <p className="text-lg font-bold text-muted-foreground">
                      N/A
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 shrink-0 no-print">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSortOrder(sortOrder === "desc" ? "asc" : "desc")
                }
              >
                {sortOrder === "desc" ? "Newest First" : "Oldest First"}
              </Button>
              {totalRecords > 0 && (
                <span className="ml-auto self-center text-sm text-muted-foreground">
                  {totalRecords} transaction
                  {totalRecords !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Payment Records Table — scrollable area */}
            <div className="rounded-lg border border-border flex flex-col min-h-0">
              <div className="overflow-x-auto overflow-y-auto max-h-[340px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length > 0 ? (
                      payments.map((payment: PaymentHistoryRecord) => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {format(new Date(payment.date), "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell className="text-primary font-semibold whitespace-nowrap">
                            {payment.currencyCode && payment.originalAmount != null && payment.currencyCode !== baseCurrency ? (
                              <div className="flex flex-col">
                                <span>{formatCurrencyForCode(payment.originalAmount, payment.currencyCode)}</span>
                                <span className="text-xs font-normal text-muted-foreground">
                                  ≈ {formatCurrencyForCode(payment.amount, baseCurrency)}
                                </span>
                              </div>
                            ) : (
                              formatCurrencyForCode(payment.amount, baseCurrency)
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{payment.method}</Badge>
                          </TableCell>
                          <TableCell>
                            {payment.category ? (
                              <Badge variant="outline">{payment.category}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {payment.description || "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Print receipt"
                              onClick={() => setReceiptPaymentId(payment.id)}
                            >
                              <Receipt className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground py-10"
                        >
                          No payment history available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/30 shrink-0 no-print">
                  <p className="text-sm text-muted-foreground">
                    Showing{" "}
                    {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
                    {Math.min(currentPage * ITEMS_PER_PAGE, totalRecords)}{" "}
                    of {totalRecords}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.max(1, p - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    {[...Array(totalPages)].map((_, i) => {
                      const page = i + 1;
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <Button
                            key={page}
                            variant={
                              currentPage === page ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8"
                          >
                            {page}
                          </Button>
                        );
                      } else if (
                        page === currentPage - 2 ||
                        page === currentPage + 2
                      ) {
                        return (
                          <span key={page} className="px-1 text-muted-foreground">
                            …
                          </span>
                        );
                      }
                      return null;
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No student selected
          </p>
        )}
      </DialogContent>

      <PrintReceiptModal
        open={receiptPaymentId !== null}
        onOpenChange={(open) => { if (!open) setReceiptPaymentId(null); }}
        paymentId={receiptPaymentId}
      />
    </Dialog>
  );
}
