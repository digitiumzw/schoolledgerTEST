import { useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { CalendarIcon, Tag, Loader2, ChevronDown } from "lucide-react";
import { api } from "@/api/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/studentUtils";

const toIso = (date: Date): string => format(date, "yyyy-MM-dd");

interface DateFieldProps {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
}

function DateField({ label, value, onChange, disabled }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}:</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 justify-start font-normal text-xs" disabled={disabled}>
            <CalendarIcon className="mr-1.5 h-3 w-3" />
            {format(value, "MMM dd, yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              if (date) {
                onChange(date);
                setOpen(false);
              }
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function PaymentsByCategoryPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date>(() => startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(() => endOfMonth(new Date()));

  const isInvalidRange = dateFrom > dateTo;

  const isoFrom = toIso(dateFrom);
  const isoTo = toIso(dateTo);

  const totalsQuery = useQuery({
    queryKey: ["payment-category-totals", isoFrom, isoTo],
    queryFn: () => api.getPaymentCategoryTotals(isoFrom, isoTo),
    enabled: !isInvalidRange,
    placeholderData: keepPreviousData,
  });

  const data = totalsQuery.data;
  const isLoading = totalsQuery.isLoading;
  const isFetching = totalsQuery.isFetching;

  const grandTotal = useMemo(() => data?.grandTotal ?? 0, [data]);

  return (
    <Card className="no-print">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between gap-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-auto gap-2 p-0 hover:bg-transparent">
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  Payments by Category
                </CardTitle>
                {!isOpen && !isLoading && data && (
                  <span className="text-xs text-muted-foreground">
                    — {formatCurrency(grandTotal)} ({data.grandCount} payments)
                  </span>
                )}
                {isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </Button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              <DateField label="From" value={dateFrom} onChange={setDateFrom} disabled={isFetching} />
              <DateField label="To" value={dateTo} onChange={setDateTo} disabled={isFetching} />
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="px-4 pb-3 pt-0">
            {isInvalidRange ? (
              <p className="py-3 text-center text-xs text-destructive">
                "From" date must be before or equal to the "To" date.
              </p>
            ) : isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-2/3" />
              </div>
            ) : totalsQuery.isError ? (
              <p className="py-3 text-center text-xs text-destructive">
                Failed to load category totals. Please try again.
              </p>
            ) : (data?.byCategory.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No payments recorded in this period.
              </p>
            ) : (
              <div className={isFetching ? "opacity-70 transition-opacity" : "transition-opacity"}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="h-7 text-xs">Category</TableHead>
                      <TableHead className="h-7 text-xs text-right">Count</TableHead>
                      <TableHead className="h-7 text-xs text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.byCategory.map((row) => (
                      <TableRow key={row.label}>
                        <TableCell className="py-1.5 text-xs font-medium">
                          <Badge variant="secondary" className="text-xs">{row.label}</Badge>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs text-right text-muted-foreground">{row.count}</TableCell>
                        <TableCell className="py-1.5 text-xs text-right font-semibold text-primary">
                          {formatCurrency(row.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="py-1.5 text-xs font-semibold">Grand Total</TableCell>
                      <TableCell className="py-1.5 text-xs text-right font-semibold">{data?.grandCount ?? 0}</TableCell>
                      <TableCell className="py-1.5 text-xs text-right font-bold text-primary">
                        {formatCurrency(grandTotal)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
