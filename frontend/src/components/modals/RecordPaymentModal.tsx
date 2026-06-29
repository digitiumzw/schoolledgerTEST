import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/api";
import { Student } from "@/types/dashboard";
import { useStudentBalance } from "@/hooks/useStudentBalance";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import { CalendarIcon, Loader2, Check, ChevronsUpDown, Plus, Trash2, Bus, MapPin } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FeeCampaign, StudentCampaignMembership } from "@/api/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/studentUtils";
import { PrintReceiptModal } from "@/components/modals/PrintReceiptModal";
import { Badge } from "@/components/ui/badge";
import { MultiCategoryPaymentInput } from "@/api/api";

// Payment category interface (extended with system flag for feature 057)
interface PaymentCategory {
  id: string;
  tenantId: string;
  name: string;
  defaultAmount: number | null;
  active: boolean;
  system?: boolean;
}

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preSelectedStudent?: Student | null;
  onSuccess?: () => void;
}

export function RecordPaymentModal({
  open,
  onOpenChange,
  preSelectedStudent,
  onSuccess,
}: RecordPaymentModalProps) {
  const [paymentCategories, setPaymentCategories] = useState<PaymentCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    studentId: "",
    amount: "",
    date: new Date(),
    method: "",
    description: "",
    category: "none",
    term: "Term 3 2025",
  });
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [transportRouteWarning, setTransportRouteWarning] = useState<'loading' | 'unassigned' | null>(null);

  // Inline route assignment state
  interface RouteOption { id: string; routeName: string; }
  interface StopOption  { id: string; name: string; pickupTime?: string; }
  const [routeOptions, setRouteOptions]         = useState<RouteOption[]>([]);
  const [routesLoading, setRoutesLoading]       = useState(false);
  const [selectedRouteId, setSelectedRouteId]   = useState('');
  const [stopOptions, setStopOptions]           = useState<StopOption[]>([]);
  const [stopsLoading, setStopsLoading]         = useState(false);
  const [selectedStopId, setSelectedStopId]     = useState('');
  // Multi-category state (feature 061)
  const [multiCategory, setMultiCategory] = useState(false);
  const [categoryRows, setCategoryRows] = useState<Array<{ categoryName: string; amount: string }>>(
    [{ categoryName: "none", amount: "" }]
  );
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Fee Campaign Payment state (feature 086)
  const [campaignPaymentMode, setCampaignPaymentMode] = useState(false);
  const [campaigns, setCampaigns] = useState<FeeCampaign[]>([]);
  const [studentCampaigns, setStudentCampaigns] = useState<StudentCampaignMembership[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [hasCampaigns, setHasCampaigns] = useState(false);

  const transportCheckRef = useRef<AbortController | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const queryClient = useQueryClient();
  const { balance: studentBalance, isLoading: balanceLoading, error: balanceError, invalidateBalance } = useStudentBalance(selectedStudent?.id || "");

  // Fetch payment categories on modal open (lightweight, no students)
  useEffect(() => {
    if (open) {
      api.getPaymentCategories().then((categoriesData) => {
        const categoriesArray = Array.isArray(categoriesData)
          ? categoriesData
          : categoriesData?.data || categoriesData?.categories || [];
        // Backend now prepends system categories (feature 057 D3) — no client-side merging needed.
        const active: PaymentCategory[] = categoriesArray.filter((c: { active: boolean }) => c.active);
        setPaymentCategories(active);
      });

      if (preSelectedStudent) {
        setFormData(prev => ({ ...prev, studentId: preSelectedStudent.id }));
        setSelectedStudent(preSelectedStudent);
      }

      // Check if tenant has any active fee campaigns to decide toggle visibility
      api.getFeeCampaigns({ status: 'active', limit: 1 })
        .then(r => {
          const data = r.data;
          const list = Array.isArray(data) ? data : (data?.data ?? []);
          setHasCampaigns(list.length > 0);
        })
        .catch(() => setHasCampaigns(false));
    } else {
      setHasCampaigns(false);
    }
  }, [open, preSelectedStudent]);

  // Debounced live search — all statuses, no prefetch
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    const timer = setTimeout(async () => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsSearching(true);
      setSearchError(null);

      try {
        const results = await api.searchStudents(searchQuery.trim(), undefined, 20);
        if (!controller.signal.aborted) {
          const arr = Array.isArray(results) ? results : results?.data || [];
          setSearchResults(arr);
        }
      } catch (_err: unknown) {
        if (!controller.signal.aborted) {
          setSearchError("Search failed. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      abortControllerRef.current?.abort();
    };
  }, [searchQuery]);

  const handleStudentChange = (studentId: string) => {
    const student = searchResults.find(s => s.id === studentId);
    setFormData(prev => ({ ...prev, studentId }));
    setSelectedStudent(student || null);
    // Reset campaign selection when student changes
    if (campaignPaymentMode) {
      setSelectedCampaignId(null);
      setStudentCampaigns([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.studentId) {
      toast.error("Please select a student");
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (!formData.method) {
      toast.error("Please select a payment method");
      return;
    }
    if (campaignPaymentMode) {
      if (!selectedCampaignId) {
        toast.error("Please select a fee campaign");
        return;
      }
    } else {
      if (!multiCategory && formData.category === "none") {
        toast.error("Please select a payment category");
        return;
      }
    }

    const amount = parseFloat(formData.amount);
    if (studentBalance != null && amount > studentBalance.balance && studentBalance.balance > 0) {
      toast.warning("Payment amount exceeds student balance");
    }

    if (multiCategory) {
      const unfilled = categoryRows.some(r => r.categoryName === "none" || !r.amount || parseFloat(r.amount) <= 0);
      if (unfilled) {
        toast.error("Please fill in all category rows with a name and amount");
        return;
      }
      if (!categoryRowSumMatchesTotal) {
        toast.error(`Category amounts must sum to ${formData.amount}`);
        return;
      }
      // Require transport route selection for multi-category transport payments (if not already assigned)
      const hasTransportCategory = categoryRows.some(r => isTransportCategory(r.categoryName));
      if (hasTransportCategory && selectedStudent && transportRouteWarning === 'unassigned') {
        if (!selectedRouteId) {
          toast.error(
            `Please select a route for ${selectedStudent.firstName} ${selectedStudent.lastName} before recording this transport payment.`
          );
          return;
        }
      }
    }

    // Require transport route selection for single-category transport payments (if not already assigned)
    if (!multiCategory && activeTransportCategorySelected && selectedStudent && transportRouteWarning === 'unassigned') {
      if (!selectedRouteId) {
        toast.error(
          `Please select a route for ${selectedStudent.firstName} ${selectedStudent.lastName} before recording this transport payment.`
        );
        return;
      }
    }

    setShowConfirmDialog(true);
  };

  const executePaymentSubmission = async () => {
    if (!formData.studentId) return;

    try {
      setSubmitting(true);
      setShowConfirmDialog(false);

      const amount = parseFloat(formData.amount);

      // For transport payments with pending route assignment: create assignment first
      if (activeTransportCategorySelected && selectedStudent && transportRouteWarning === 'unassigned' && selectedRouteId) {
        try {
          await api.createAllocation(selectedRouteId, {
            studentId: selectedStudent.id,
            stopId: selectedStopId && selectedStopId !== '__none' ? selectedStopId : undefined,
            direction: 'both',
          });
          toast.info(`${selectedStudent.firstName} ${selectedStudent.lastName} assigned to route successfully.`);
          queryClient.invalidateQueries({ queryKey: ['transport-allocations'] });
        } catch (assignErr: unknown) {
          const e = assignErr as { message?: string; data?: { message?: string } };
          toast.error(e?.data?.message ?? e?.message ?? 'Failed to assign route');
          setSubmitting(false);
          return;
        }
      }

      // Auto-generate transport charges for transport payments if missing
      // This MUST complete before payment is recorded so payment applies to fresh charges
      if (activeTransportCategorySelected && selectedStudent) {
        const paymentMonth = format(formData.date, 'yyyy-MM');
        try {
          const chargeResult = await api.generateStudentTransportCharge(selectedStudent.id, paymentMonth);
          if (chargeResult?.status === 'created') {
            toast.info(`Transport charge of ${chargeResult.amount.toFixed(2)} created for ${selectedStudent.firstName} ${selectedStudent.lastName}`);
            // Wait for balance to refresh so payment uses up-to-date charges
            await queryClient.invalidateQueries({ queryKey: ['student-balance', selectedStudent.id] });
            await queryClient.invalidateQueries({ queryKey: ['student', selectedStudent.id, 'ledger'] });
          } else if (chargeResult?.status === 'exists') {
            // Charge already exists, ensure balance is fresh
            await queryClient.invalidateQueries({ queryKey: ['student-balance', selectedStudent.id] });
          }
        } catch (chargeError: unknown) {
          const err = chargeError as { response?: { status?: number }; message?: string };
          if (err?.response?.status === 404) {
            // No active transport assignment - warn user that payment will create credit/overpayment
            toast.warning(
              `${selectedStudent.firstName} ${selectedStudent.lastName} has no active transport route. ` +
              `Payment recorded as credit (no charge created). Assign route first to auto-generate charges.`,
              { duration: 6000 }
            );
          } else {
            // Log other errors
            console.debug('Transport charge generation skipped:', err?.message);
          }
        }
      }

      let saved: { id?: string };
      if (campaignPaymentMode && selectedCampaignId) {
        // Campaign payment flow (feature 086)
        // If student is not enrolled, auto-enroll first
        if (!isEnrolledInSelected) {
          const enrollResult = await api.addCampaignStudent(selectedCampaignId, formData.studentId);
          if (!enrollResult) {
            toast.error("Failed to enroll student in campaign. Payment not recorded.");
            setSubmitting(false);
            return;
          }
        }
        // Record campaign payment
        const paymentResult = await api.recordCampaignPayment(selectedCampaignId, {
          studentId: formData.studentId,
          amount,
          method: formData.method,
          date: format(formData.date, "yyyy-MM-dd"),
          description: formData.description || `Campaign: ${selectedCampaign?.name || ''}`,
        });
        if (!paymentResult) {
          toast.error("Failed to record campaign payment.");
          setSubmitting(false);
          return;
        }
        saved = { id: paymentResult.payment?.id };
      } else if (multiCategory) {
        const payload: MultiCategoryPaymentInput = {
          studentId: formData.studentId,
          amount,
          date: format(formData.date, "yyyy-MM-dd"),
          method: formData.method,
          description: formData.description,
          categories: categoryRows.map(r => ({ categoryName: r.categoryName, amount: parseFloat(r.amount) })),
        };
        saved = await api.createPayment(payload);
      } else {
        saved = await api.createPayment({
          studentId: formData.studentId,
          amount,
          date: format(formData.date, "yyyy-MM-dd"),
          method: formData.method,
          description: formData.description,
          category: formData.category === "none" ? "" : formData.category,
          term: formData.term,
        });
      }

      toast.success("Payment recorded successfully!");
      if ((saved as { warning?: string })?.warning) {
        toast.warning((saved as { warning?: string }).warning);
      }
      invalidateBalance();
      queryClient.invalidateQueries({ queryKey: ['payments-with-students'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'activity'] });
      if (campaignPaymentMode) {
        queryClient.invalidateQueries({ queryKey: ['fee-campaigns'] });
        queryClient.invalidateQueries({ queryKey: ['student-campaigns', formData.studentId] });
      }
      resetForm();
      onSuccess?.();
      onOpenChange(false);
      if (saved?.id) {
        setReceiptPaymentId(saved.id);
      }
    } catch (error: unknown) {
      const err = error as { message?: string; error?: string; data?: { message?: string } };
      const errorMessage = err?.message || err?.error || err?.data?.message || "Failed to record payment";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Transport category names that require an active route assignment
  const TRANSPORT_CATEGORY_NAMES = ['Transport', 'Transport + Fees'];

  const isTransportCategory = (name: string) => TRANSPORT_CATEGORY_NAMES.includes(name);

  const activeTransportCategorySelected = !multiCategory
    ? isTransportCategory(formData.category)
    : categoryRows.some(r => isTransportCategory(r.categoryName));

  // Check active transport allocation when student + transport category is selected
  useEffect(() => {
    if (!selectedStudent || !activeTransportCategorySelected) {
      setTransportRouteWarning(null);
      transportCheckRef.current?.abort();
      return;
    }

    transportCheckRef.current?.abort();
    const controller = new AbortController();
    transportCheckRef.current = controller;

    setTransportRouteWarning('loading');
    api.getAllocations({ studentId: selectedStudent.id, status: 'active' })
      .then((data: unknown) => {
        if (controller.signal.aborted) return;
        const list = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data ?? [];
        if (list.length === 0) {
          setTransportRouteWarning('unassigned');
          setSelectedRouteId('');
          setSelectedStopId('');
          setStopOptions([]);
        } else {
          setTransportRouteWarning(null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setTransportRouteWarning(null);
      });

    return () => { controller.abort(); };
  }, [selectedStudent?.id, activeTransportCategorySelected]);

  const resetCampaignState = () => {
    setCampaignPaymentMode(false);
    setCampaigns([]);
    setStudentCampaigns([]);
    setSelectedCampaignId(null);
    setCampaignsLoading(false);
  };

  const resetForm = () => {
    setFormData({
      studentId: "",
      amount: "",
      date: new Date(),
      method: "",
      description: "",
      category: "none",
      term: "Term 3 2025",
    });
    setSelectedStudent(null);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setMultiCategory(false);
    setCategoryRows([{ categoryName: "none", amount: "" }]);
    setTransportRouteWarning(null);
    setSelectedRouteId('');
    setSelectedStopId('');
    setStopOptions([]);
    resetCampaignState();
  };

  // Derived: total of per-category amounts (multi-category mode)
  const categoryRowTotal = categoryRows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const categoryRowSumMatchesTotal =
    !multiCategory ||
    !formData.amount ||
    Math.abs(categoryRowTotal - parseFloat(formData.amount || "0")) < 0.01;

  // Fetch campaigns and student memberships when campaign mode is active and student is selected
  useEffect(() => {
    if (!campaignPaymentMode || !selectedStudent) {
      setCampaigns([]);
      setStudentCampaigns([]);
      setSelectedCampaignId(null);
      return;
    }

    let cancelled = false;
    setCampaignsLoading(true);

    Promise.all([
      api.getFeeCampaigns({ status: 'active', limit: 100 }).then(r => r.data).catch(() => []),
      api.getStudentCampaigns(selectedStudent.id).catch(() => []),
    ]).then(([allCampaigns, memberships]) => {
      if (cancelled) return;
      setCampaigns(allCampaigns);
      setStudentCampaigns(memberships);
    }).catch(() => {
      if (!cancelled) {
        setCampaigns([]);
        setStudentCampaigns([]);
      }
    }).finally(() => {
      if (!cancelled) setCampaignsLoading(false);
    });

    return () => { cancelled = true; };
  }, [campaignPaymentMode, selectedStudent?.id]);

  // Derive enrollment status for selected campaign
  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) || null;
  const isEnrolledInSelected = studentCampaigns.some(m => m.feeCampaignId === selectedCampaignId);
  const studentCampaignMap = new Map(studentCampaigns.map(m => [m.feeCampaignId, m]));

  // Fetch routes when the inline assignment panel appears
  useEffect(() => {
    if (transportRouteWarning !== 'unassigned') return;
    setRoutesLoading(true);
    api.getRoutes()
      .then((resp: unknown) => {
        const list = (resp as { data?: RouteOption[] })?.data ?? (Array.isArray(resp) ? resp : []);
        setRouteOptions(
          list.map((r: any) => ({
            id: r.id as string,
            routeName: (r.routeName ?? r.route_name ?? r.id) as string,
          }))
        );
      })
      .catch(() => {})
      .finally(() => setRoutesLoading(false));
  }, [transportRouteWarning]);

  // Fetch stops whenever a route is chosen
  useEffect(() => {
    if (!selectedRouteId) { setStopOptions([]); setSelectedStopId(''); return; }
    setStopsLoading(true);
    api.getRouteStops(selectedRouteId)
      .then((data: unknown) => {
        const list = Array.isArray(data) ? data : [];
        setStopOptions(
          list.map((s: any) => ({
            id: s.id as string,
            name: s.name as string,
            pickupTime: s.pickupTime ?? s.pickup_time ?? undefined,
          }))
        );
        setSelectedStopId('');
      })
      .catch(() => {})
      .finally(() => setStopsLoading(false));
  }, [selectedRouteId]);

  const handleAddCategoryRow = () => {
    setCategoryRows(prev => [...prev, { categoryName: "none", amount: "" }]);
  };

  const handleRemoveCategoryRow = (idx: number) => {
    setCategoryRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCategoryRowChange = (idx: number, field: "categoryName" | "amount", value: string) => {
    setCategoryRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>
            Record a new payment for a student. The balance will be updated automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="student">Student *</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={searchOpen}
                  className="w-full justify-between"
                  disabled={!!preSelectedStudent}
                >
                  {formData.studentId && selectedStudent
                    ? (() => {
                        const liveBalance = studentBalance?.balance ?? selectedStudent?.balance ?? 0;
                        return `${selectedStudent.firstName} ${selectedStudent.lastName} - ${selectedStudent.className || "No Class"} (${formatCurrency(liveBalance)})`;
                      })()
                    : "Select a student"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full max-w-md p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search students by name or admission number..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                  />
                  <CommandList>
                    {!searchQuery.trim() && (
                      <CommandEmpty>Type a name or admission number to search.</CommandEmpty>
                    )}
                    {searchQuery.trim() && isSearching && (
                      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </div>
                    )}
                    {searchQuery.trim() && !isSearching && searchError && (
                      <div className="py-4 text-center text-sm text-destructive px-4">
                        {searchError}
                      </div>
                    )}
                    {searchQuery.trim() && !isSearching && !searchError && searchResults.length === 0 && (
                      <CommandEmpty>No student found.</CommandEmpty>
                    )}
                    {searchResults.length > 0 && (
                      <CommandGroup>
                        {searchResults.map((student) => (
                          <CommandItem
                            key={student.id}
                            value={student.id}
                            onSelect={() => {
                              handleStudentChange(student.id);
                              setSearchOpen(false);
                              setSearchQuery("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.studentId === student.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex-1">
                              <div className="font-medium">
                                {student.firstName} {student.lastName}
                                {student.admissionNumber && (
                                  <span className="ml-1 text-xs text-muted-foreground font-mono">#{student.admissionNumber}</span>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {student.className || "No Class"} • Balance: {formatCurrency(student.balance)}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedStudent && transportRouteWarning === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking transport assignment…
            </div>
          )}

          {selectedStudent && transportRouteWarning === 'unassigned' && (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <Bus className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                    No active transport route
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                    <span className="font-medium">{selectedStudent.firstName} {selectedStudent.lastName}</span> is not assigned to any route.
                    Select a route and pickup stop below. Assignment, charges, and payment will all be processed when you click 'Record Payment'.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <Bus className="h-3 w-3" /> Route <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={selectedRouteId}
                    onValueChange={setSelectedRouteId}
                    disabled={routesLoading}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-background">
                      <SelectValue placeholder={routesLoading ? 'Loading…' : 'Select route'} />
                    </SelectTrigger>
                    <SelectContent>
                      {routeOptions.length === 0 && !routesLoading && (
                        <SelectItem value="__none" disabled>No routes available</SelectItem>
                      )}
                      {routeOptions.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.routeName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-amber-800 dark:text-amber-300 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Pickup Stop
                  </Label>
                  <Select
                    value={selectedStopId}
                    onValueChange={setSelectedStopId}
                    disabled={!selectedRouteId || stopsLoading}
                  >
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-background">
                      <SelectValue placeholder={stopsLoading ? 'Loading…' : !selectedRouteId ? 'Pick route first' : 'Select stop'} />
                    </SelectTrigger>
                    <SelectContent>
                      {stopOptions.length === 0 && !stopsLoading && selectedRouteId && (
                        <SelectItem value="__no_stops" disabled>No stops on this route</SelectItem>
                      )}
                      {stopOptions.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}{s.pickupTime ? ` · ${s.pickupTime}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

            </div>
          )}

          {selectedStudent && (
            <div className="rounded-lg border border-border bg-muted/50 p-2 sm:p-3 space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Current Balance:</span>
                <BalanceDisplay
                  amount={studentBalance?.balance || 0}
                  isLoading={balanceLoading}
                  error={balanceError}
                />
              </div>
              {formData.amount && parseFloat(formData.amount) > 0 && studentBalance && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New Balance:</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(Math.max(0, studentBalance.balance - parseFloat(formData.amount)))}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? format(formData.date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.date}
                  onSelect={(date) => date && setFormData(prev => ({ ...prev, date }))}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="method">Payment Method *</Label>
            <Select
              value={formData.method}
              onValueChange={(value) => setFormData(prev => ({ ...prev, method: value }))}
            >
              <SelectTrigger id="method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="EcoCash">EcoCash</SelectItem>
                <SelectItem value="OneMoney">OneMoney</SelectItem>
                <SelectItem value="Telecash">Telecash</SelectItem>
                <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                <SelectItem value="ZIPIT">ZIPIT</SelectItem>
                <SelectItem value="Swipe">Swipe (Card)</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fee Campaign Payment toggle (feature 086) */}
          {hasCampaigns && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <Label htmlFor="campaign-mode" className="text-sm font-medium">Fee Campaign Payment</Label>
              <p className="text-xs text-muted-foreground">Record payment against a fee campaign</p>
            </div>
            <Switch
              id="campaign-mode"
              checked={campaignPaymentMode}
              onCheckedChange={(checked) => {
                setCampaignPaymentMode(checked);
                if (!checked) {
                  setSelectedCampaignId(null);
                  setCampaigns([]);
                  setStudentCampaigns([]);
                }
              }}
            />
          </div>
          )}

          {/* Campaign dropdown (feature 086) */}
          {campaignPaymentMode && selectedStudent && (
            <div className="space-y-2">
              <Label htmlFor="campaign">Fee Campaign *</Label>
              <Select
                value={selectedCampaignId || ""}
                onValueChange={(value) => {
                  setSelectedCampaignId(value || null);
                  // Auto-populate amount with remaining balance
                  const membership = studentCampaignMap.get(value);
                  const campaign = campaigns.find(c => c.id === value);
                  if (membership && membership.remainingAmount > 0) {
                    setFormData(prev => ({ ...prev, amount: String(membership.remainingAmount) }));
                  } else if (campaign && campaign.amount > 0 && !membership) {
                    setFormData(prev => ({ ...prev, amount: String(campaign.amount) }));
                  }
                }}
                disabled={campaignsLoading}
              >
                <SelectTrigger id="campaign">
                  <SelectValue placeholder={campaignsLoading ? "Loading campaigns…" : "Select a campaign"} />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0 && !campaignsLoading && (
                    <SelectItem value="__none" disabled>No active campaigns available</SelectItem>
                  )}
                  {campaigns.map(c => {
                    const membership = studentCampaignMap.get(c.id);
                    const isMember = !!membership;
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="flex items-center gap-1.5">
                          {c.name}
                          {isMember && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">Member</Badge>
                          )}
                          {membership && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({formatCurrency(membership.paidAmount)} / {formatCurrency(membership.expectedAmount)})
                            </span>
                          )}
                          {!membership && c.amount > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({formatCurrency(c.amount)})
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {selectedCampaignId && studentCampaignMap.get(selectedCampaignId) && (
                <p className="text-xs text-muted-foreground">
                  Remaining: {formatCurrency(studentCampaignMap.get(selectedCampaignId)!.remainingAmount)}
                </p>
              )}
            </div>
          )}

          {!campaignPaymentMode && !multiCategory && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="category">Category *</Label>
                <button
                  type="button"
                  onClick={() => { setMultiCategory(true); setCategoryRows([{ categoryName: "none", amount: "" }, { categoryName: "none", amount: "" }]); }}
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Split across categories
                </button>
              </div>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {paymentCategories.map(category => (
                    <SelectItem key={category.id} value={category.name}>
                      <span className="flex items-center gap-1.5">
                        {category.name}
                        {category.system && (
                          <span className="text-[10px] font-medium text-muted-foreground border rounded px-1 py-0.5 leading-none">
                            System
                          </span>
                        )}
                        {category.defaultAmount && category.defaultAmount > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (Suggested: {formatCurrency(category.defaultAmount)})
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {!campaignPaymentMode && multiCategory && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Categories *</Label>
                <button
                  type="button"
                  onClick={() => { setMultiCategory(false); setCategoryRows([{ categoryName: "none", amount: "" }]); }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Use single category
                </button>
              </div>
              <div className="space-y-2">
                {categoryRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Select
                      value={row.categoryName}
                      onValueChange={(v) => handleCategoryRowChange(idx, "categoryName", v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {paymentCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.name}>
                            <span className="flex items-center gap-1.5">
                              {cat.name}
                              {cat.system && (
                                <Badge variant="outline" className="text-[10px] px-1 py-0">
                                  System
                                </Badge>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      className="w-28"
                      value={row.amount}
                      onChange={(e) => handleCategoryRowChange(idx, "amount", e.target.value)}
                    />
                    {categoryRows.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCategoryRow(idx)}
                        className="text-destructive hover:opacity-80"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAddCategoryRow}
                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
              >
                <Plus className="h-3 w-3" /> Add category
              </button>
              {formData.amount && (
                <p className={cn("text-xs mt-1", categoryRowSumMatchesTotal ? "text-muted-foreground" : "text-destructive")}>
                  Total allocated: {formatCurrency(categoryRowTotal)}{" "}
                  {!categoryRowSumMatchesTotal && `(should be ${formatCurrency(parseFloat(formData.amount))})`}
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="e.g., Term 1 Tuition, Book Fees, etc."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              maxLength={200}
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/200 characters
            </p>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Payment</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>Please review the payment details before proceeding:</p>
              <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student</span>
                  <span className="font-medium">
                    {selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">{formatCurrency(parseFloat(formData.amount || "0"))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="font-medium">{formData.method || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{formData.date ? format(formData.date, "PPP") : "—"}</span>
                </div>
                {campaignPaymentMode && selectedCampaign && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Campaign</span>
                    <span className="font-medium">{selectedCampaign.name}</span>
                  </div>
                )}
                {!campaignPaymentMode && multiCategory && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Categories</span>
                    <span className="font-medium text-right">
                      {categoryRows.filter(r => r.categoryName !== "none").map(r => `${r.categoryName} (${formatCurrency(parseFloat(r.amount || "0"))})`).join(", ")}
                    </span>
                  </div>
                )}
                {!campaignPaymentMode && !multiCategory && formData.category !== "none" && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span className="font-medium">{formData.category}</span>
                  </div>
                )}
                {formData.description && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Description</span>
                    <span className="font-medium">{formData.description}</span>
                  </div>
                )}
                {activeTransportCategorySelected && selectedStudent && transportRouteWarning === 'unassigned' && selectedRouteId && selectedStopId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transport Route</span>
                    <span className="font-medium">
                      {routeOptions.find(r => r.id === selectedRouteId)?.routeName || "—"}
                      {" → "}
                      {stopOptions.find(s => s.id === selectedStopId)?.name || "—"}
                    </span>
                  </div>
                )}
              </div>
              <p className="text-muted-foreground">This action cannot be undone.</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting} onClick={() => setShowConfirmDialog(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              executePaymentSubmission();
            }}
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm Payment
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <PrintReceiptModal
      open={receiptPaymentId !== null}
      onOpenChange={(open) => { if (!open) setReceiptPaymentId(null); }}
      paymentId={receiptPaymentId}
    />
  </>
  );
}
