import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Student } from "@/types/dashboard";
import { api } from "@/api/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface StatusChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  onSuccess: () => void;
}

const statusOptions = [
  { value: "active",      label: "Active",      color: "text-green-600" },
  { value: "inactive",    label: "Inactive",    color: "text-gray-600" },
  { value: "transferred", label: "Transferred", color: "text-blue-600" },
  { value: "dropped_out", label: "Dropped Out", color: "text-red-600" },
  { value: "graduated",   label: "Graduated",   color: "text-purple-600" },
];

export function StatusChangeModal({ open, onOpenChange, student, onSuccess }: StatusChangeModalProps) {
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = !!selectedStatus && !!effectiveDate && reason.trim().length >= 3;

  const handleSubmit = async () => {
    if (!student || !canSubmit) return;

    setLoading(true);
    try {
      await api.changeStudentStatus(student.id, selectedStatus, effectiveDate, reason.trim());

      toast({
        title: "Success",
        description: `Student status changed to ${statusOptions.find(s => s.value === selectedStatus)?.label}`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to change student status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedStatus("");
      setEffectiveDate(new Date().toISOString().split("T")[0]);
      setReason("");
      onOpenChange(false);
    }
  };

  const currentStatusOption = statusOptions.find(s => s.value === student?.status);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Change Student Status</DialogTitle>
          <DialogDescription>
            Update the status for {student?.firstName} {student?.lastName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Status</Label>
            <div className={`font-medium ${currentStatusOption?.color}`}>
              {currentStatusOption?.label || student?.status}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">New Status *</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className={option.color}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="effectiveDate">Effective Date *</Label>
            <Input
              id="effectiveDate"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              placeholder="Enter reason for status change (required)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            {reason.trim().length > 0 && reason.trim().length < 3 && (
              <p className="text-xs text-destructive">Reason must be at least 3 characters</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Changing..." : "Change Status"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
