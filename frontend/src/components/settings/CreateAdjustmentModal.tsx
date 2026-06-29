/**
 * CreateAdjustmentModal
 * 
 * Modal for creating balance adjustments (credits/debits).
 * Supports linking to original charges/payments for audit trail.
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
import { Loader2, ArrowDownCircle, ArrowUpCircle, Search } from "lucide-react";
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

interface CreateAdjustmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  preselectedStudentId?: string;
}

export function CreateAdjustmentModal({
  open,
  onOpenChange,
  onSuccess,
  preselectedStudentId,
}: CreateAdjustmentModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    studentId: preselectedStudentId || "",
    adjustmentType: "credit" as "credit" | "debit",
    category: "correction",
    amount: "",
    reason: "",
    referenceType: "none" as "charge" | "payment" | "none",
    referenceId: "",
    effectiveDate: new Date().toISOString().split("T")[0],
  });

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    if (preselectedStudentId) {
      setFormData(prev => ({ ...prev, studentId: preselectedStudentId }));
    }
  }, [preselectedStudentId]);

  useEffect(() => {
    if (!open) {
      // Reset form when modal closes
      setFormData({
        studentId: preselectedStudentId || "",
        adjustmentType: "credit",
        category: "correction",
        amount: "",
        reason: "",
        referenceType: "none",
        referenceId: "",
        effectiveDate: new Date().toISOString().split("T")[0],
      });
      setSelectedStudent(null);
      setSearchQuery("");
      setStudents([]);
    }
  }, [open, preselectedStudentId]);

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

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setFormData(prev => ({ ...prev, studentId: student.id }));
    // Handle both data formats
    const displayName = student.studentName || `${student.firstName || ''} ${student.lastName || ''}`.trim();
    setSearchQuery(displayName);
    setStudents([]);
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
        description: "Please enter a valid amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for this adjustment.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await api.createAdjustment({
        studentId: formData.studentId,
        adjustmentType: formData.adjustmentType,
        category: formData.category as any,
        amount: parseFloat(formData.amount),
        reason: formData.reason,
        referenceType: formData.referenceType,
        referenceId: formData.referenceId || undefined,
        effectiveDate: formData.effectiveDate,
      });

      toast({
        title: "Adjustment Created",
        description: `Balance ${formData.adjustmentType === 'credit' ? 'reduced' : 'increased'} by $${parseFloat(formData.amount).toFixed(2)}. New balance: $${result.balanceAfter?.toFixed(2)}`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create adjustment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Balance Adjustment</DialogTitle>
          <DialogDescription>
            Create a credit or debit adjustment to correct a student's balance.
            This will not modify original records.
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

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label>Adjustment Type *</Label>
            <RadioGroup
              value={formData.adjustmentType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, adjustmentType: value as "credit" | "debit" }))}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="credit" id="credit" />
                <Label htmlFor="credit" className="flex items-center gap-1 cursor-pointer">
                  <ArrowDownCircle className="h-4 w-4 text-green-600" />
                  Credit (Reduce Balance)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="debit" id="debit" />
                <Label htmlFor="debit" className="flex items-center gap-1 cursor-pointer">
                  <ArrowUpCircle className="h-4 w-4 text-red-600" />
                  Debit (Increase Balance)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="correction">Correction</SelectItem>
                <SelectItem value="write_off">Write Off</SelectItem>
                <SelectItem value="fee_waiver">Fee Waiver</SelectItem>
                <SelectItem value="late_fee">Late Fee</SelectItem>
                <SelectItem value="penalty">Penalty</SelectItem>
                <SelectItem value="discount">Discount</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Amount *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                className="pl-7"
              />
            </div>
          </div>

          {/* Effective Date */}
          <div className="space-y-2">
            <Label>Effective Date</Label>
            <Input
              type="date"
              value={formData.effectiveDate}
              onChange={(e) => setFormData(prev => ({ ...prev, effectiveDate: e.target.value }))}
            />
          </div>

          {/* Reference (Optional) */}
          <div className="space-y-2">
            <Label>Reference (Optional)</Label>
            <div className="flex gap-2">
              <Select
                value={formData.referenceType}
                onValueChange={(value) => setFormData(prev => ({ ...prev, referenceType: value as any }))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="charge">Charge</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                </SelectContent>
              </Select>
              {formData.referenceType !== "none" && (
                <Input
                  placeholder={`${formData.referenceType} ID`}
                  value={formData.referenceId}
                  onChange={(e) => setFormData(prev => ({ ...prev, referenceId: e.target.value }))}
                  className="flex-1"
                />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Link this adjustment to an original charge or payment for better audit trail.
            </p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason *</Label>
            <Textarea
              placeholder="Provide a detailed reason for this adjustment (required for audit)"
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
            Create Adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
