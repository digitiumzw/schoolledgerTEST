/**
 * CreateRefundModal
 * 
 * Modal for creating refund requests.
 * Supports full and partial refunds with optional linking to original payments/charges.
 */

import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Search, CreditCard, Banknote, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/api/api";

interface Student {
  id: string;
  studentId?: string;
  studentName: string;
  studentClass?: string;
  firstName?: string;
  lastName?: string;
  className?: string;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
  category: string;
  method: string;
}

interface CreateRefundModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preselectedStudentId?: string;
  preselectedPaymentId?: string;
}

export function CreateRefundModal({
  open,
  onOpenChange,
  onSuccess,
  preselectedStudentId,
  preselectedPaymentId,
}: CreateRefundModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [formData, setFormData] = useState({
    studentId: preselectedStudentId || "",
    refundType: "partial" as "full" | "partial",
    amount: "",
    reason: "",
    originalPaymentId: preselectedPaymentId || "",
    refundMethod: "credit_note" as "cash" | "bank_transfer" | "check" | "credit_note" | "other",
    referenceNumber: "",
  });

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (preselectedStudentId) {
      setFormData(prev => ({ ...prev, studentId: preselectedStudentId }));
      loadStudentPayments(preselectedStudentId);
    }
    if (preselectedPaymentId) {
      setFormData(prev => ({ ...prev, originalPaymentId: preselectedPaymentId }));
    }
  }, [preselectedStudentId, preselectedPaymentId]);

  useEffect(() => {
    if (!open) {
      // Reset form when modal closes
      setFormData({
        studentId: preselectedStudentId || "",
        refundType: "partial",
        amount: "",
        reason: "",
        originalPaymentId: preselectedPaymentId || "",
        refundMethod: "credit_note",
        referenceNumber: "",
      });
      setSelectedStudent(null);
      setSelectedPayment(null);
      setSearchQuery("");
      setStudents([]);
      setPayments([]);
    }
  }, [open, preselectedStudentId, preselectedPaymentId]);

  const searchStudents = async (query: string) => {
    if (query.length < 2) {
      setStudents([]);
      return;
    }

    setSearching(true);
    try {
      const result = await api.searchStudents(query);
      setStudents(result || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const loadStudentPayments = async (studentId: string) => {
    setLoadingPayments(true);
    try {
      const result = await api.getPaymentsByStudent(studentId);
      setPayments(result || []);
    } catch (error) {
      console.error("Failed to load payments:", error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setFormData(prev => ({ ...prev, studentId: student.id, originalPaymentId: "" }));
    // Handle both data formats
    const displayName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim();
    setSearchQuery(displayName);
    setStudents([]);
    setSelectedPayment(null);
    loadStudentPayments(student.id);
  };

  const handlePaymentSelect = (paymentId: string) => {
    if (paymentId === "none") {
      setSelectedPayment(null);
      setFormData(prev => ({ ...prev, originalPaymentId: "", amount: prev.refundType === "full" ? "" : prev.amount }));
      return;
    }
    const payment = payments.find(p => p.id === paymentId);
    setSelectedPayment(payment || null);
    setFormData(prev => ({
      ...prev,
      originalPaymentId: paymentId,
      amount: formData.refundType === "full" && payment ? payment.amount.toString() : prev.amount,
    }));
  };

  const handleRefundTypeChange = (type: "full" | "partial") => {
    setFormData(prev => ({
      ...prev,
      refundType: type,
      amount: type === "full" && selectedPayment ? selectedPayment.amount.toString() : "",
    }));
  };

  const handleSubmit = async () => {
    if (!formData.studentId) {
      toast({
        title: "Error",
        description: "Please select a student.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid refund amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for this refund.",
        variant: "destructive",
      });
      return;
    }

    // Validate amount against original payment if linked
    if (selectedPayment && parseFloat(formData.amount) > selectedPayment.amount) {
      toast({
        title: "Error",
        description: `Refund amount cannot exceed original payment of $${selectedPayment.amount.toFixed(2)}.`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await api.createRefund({
        studentId: formData.studentId,
        refundType: formData.refundType,
        amount: parseFloat(formData.amount),
        reason: formData.reason,
        originalPaymentId: formData.originalPaymentId || undefined,
        refundMethod: formData.refundMethod,
        referenceNumber: formData.referenceNumber || undefined,
      });

      toast({
        title: "Refund Created",
        description: `Refund of $${parseFloat(formData.amount).toFixed(2)} created successfully. New balance: $${result.balanceAfter?.toFixed(2)}`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create refund.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case "cash":
        return <Banknote className="h-4 w-4" />;
      case "bank_transfer":
      case "check":
        return <CreditCard className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Refund</DialogTitle>
          <DialogDescription>
            Process a full or partial refund for a student. The refund will create
            a debit adjustment to increase their balance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Student Search */}
          <div className="space-y-2">
            <Label>Student *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground z-10" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchStudents(e.target.value);
                }}
                className="pl-9"
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
              )}
              {students.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-auto bg-background border rounded-md shadow-lg">
                  {students.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className="w-full px-3 py-2 text-left hover:bg-muted flex justify-between items-center"
                      onClick={() => handleStudentSelect(student)}
                    >
                      <span>{student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim()}</span>
                      {(student.studentClass || student.className) && (
                        <span className="text-sm text-muted-foreground">{student.studentClass || student.className}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedStudent && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedStudent.studentName || `${selectedStudent.firstName || ''} ${selectedStudent.lastName || ''}`.trim()}
              </p>
            )}
          </div>

          {/* Original Payment (Optional) */}
          {formData.studentId && (
            <div className="space-y-2">
              <Label>Link to Original Payment (Optional)</Label>
              {loadingPayments ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading payments...
                </div>
              ) : payments.length > 0 ? (
                <Select
                  value={formData.originalPaymentId || "none"}
                  onValueChange={handlePaymentSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a payment to refund..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked payment</SelectItem>
                    {payments.map((payment) => (
                      <SelectItem key={payment.id} value={payment.id}>
                        {payment.date} - ${payment.amount.toFixed(2)} ({payment.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">No payments found for this student.</p>
              )}
            </div>
          )}

          {/* Refund Type */}
          <div className="space-y-2">
            <Label>Refund Type *</Label>
            <RadioGroup
              value={formData.refundType}
              onValueChange={(value) => handleRefundTypeChange(value as "full" | "partial")}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="cursor-pointer">
                  Partial Refund
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full" id="full" disabled={!selectedPayment} />
                <Label htmlFor="full" className="cursor-pointer">
                  Full Refund {!selectedPayment && "(requires linked payment)"}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Refund Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={selectedPayment?.amount}
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                className="pl-7"
                disabled={formData.refundType === "full" && selectedPayment !== null}
              />
            </div>
            {selectedPayment && (
              <p className="text-sm text-muted-foreground">
                Maximum refundable: ${selectedPayment.amount.toFixed(2)}
              </p>
            )}
          </div>

          {/* Refund Method */}
          <div className="space-y-2">
            <Label>Refund Method *</Label>
            <Select
              value={formData.refundMethod}
              onValueChange={(value) => setFormData(prev => ({ ...prev, refundMethod: value as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credit_note">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Credit Note (Apply to balance)
                  </div>
                </SelectItem>
                <SelectItem value="cash">
                  <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4" />
                    Cash
                  </div>
                </SelectItem>
                <SelectItem value="bank_transfer">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Bank Transfer
                  </div>
                </SelectItem>
                <SelectItem value="check">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Check
                  </div>
                </SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reference Number (Optional) */}
          {formData.refundMethod !== "credit_note" && (
            <div className="space-y-2">
              <Label>Reference Number (Optional)</Label>
              <Input
                placeholder="Check number, transfer ID, etc."
                value={formData.referenceNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
              />
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              placeholder="Provide a detailed reason for this refund (required for audit)"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
