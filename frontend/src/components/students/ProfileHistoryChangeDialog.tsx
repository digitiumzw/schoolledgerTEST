import { useState } from "react";
import { api, ApiError } from "@/api/api";
import type { StudentProfileHistoryInput } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  studentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const PROFILE_FIELDS = [
  { value: "address", label: "Address" },
  { value: "email", label: "Student Email" },
  { value: "guardian_name", label: "Guardian Name" },
  { value: "guardian_phone", label: "Guardian Phone" },
  { value: "guardian_email", label: "Guardian Email" },
  { value: "guardian_relationship", label: "Guardian Relationship" },
  { value: "guardian2_name", label: "Second Guardian Name" },
  { value: "guardian2_phone", label: "Second Guardian Phone" },
  { value: "guardian2_relationship", label: "Second Guardian Relationship" },
];

export function ProfileHistoryChangeDialog({ studentId, open, onOpenChange, onSuccess }: Props) {
  const [fieldName, setFieldName] = useState("address");
  const [newValue, setNewValue] = useState("");
  const [changeType, setChangeType] = useState<StudentProfileHistoryInput["changeType"]>("historical_change");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError("Reason is required");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await api.recordStudentProfileHistory(studentId, {
        fieldName,
        newValue,
        changeType,
        effectiveDate,
        reason,
      });
      setNewValue("");
      setReason("");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record profile history");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Profile Change</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label>Field</Label>
            <Select value={fieldName} onValueChange={setFieldName}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_FIELDS.map((field) => (
                  <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>New Value</Label>
            <Input value={newValue} onChange={(event) => setNewValue(event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Change Type</Label>
              <Select value={changeType} onValueChange={(value) => setChangeType(value as StudentProfileHistoryInput["changeType"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="historical_change">Historical change</SelectItem>
                  <SelectItem value="correction">Correction</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Effective Date</Label>
              <Input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Save Change"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
