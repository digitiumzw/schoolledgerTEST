/**
 * CreateCampaignModal (Feature 059 — Fee Campaigns)
 *
 * Modal form for creating a new fee campaign. Supports school-wide,
 * class-scoped, and individual-student targeting.
 */

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search } from "lucide-react";
import { api, CreateCampaignInput, CampaignScopeType } from "@/api/api";

interface ClassOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  name: string;
  className?: string;
}

interface CreateCampaignModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: CreateCampaignInput) => Promise<any>;
  saving: boolean;
}

const SCOPE_OPTIONS: Array<{ value: CampaignScopeType; label: string; helper: string }> = [
  { value: "school_wide", label: "School-wide", helper: "All active students" },
  { value: "class", label: "By Class", helper: "Students in selected class(es)" },
  { value: "students", label: "Individual Students", helper: "Specific active students" },
];

export function CreateCampaignModal({ open, onClose, onSubmit, saving }: CreateCampaignModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopeType, setScopeType] = useState<CampaignScopeType>("school_wide");
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(false);

  const [allStudents, setAllStudents] = useState<StudentOption[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");

  // Load classes when scope changes to "class"
  useEffect(() => {
    if (scopeType === "class" && classes.length === 0) {
      setLoadingClasses(true);
      api
        .getClasses()
        .then((data: any[]) => {
          setClasses(
            data
              .filter((c: any) => !c.archivedAt)
              .map((c: any) => ({ id: c.id, name: c.name }))
              .sort((a: ClassOption, b: ClassOption) => a.name.localeCompare(b.name)),
          );
        })
        .catch(() => {})
        .finally(() => setLoadingClasses(false));
    }
  }, [scopeType, classes.length]);

  // Load active students when scope changes to "students"
  useEffect(() => {
    if (scopeType === "students" && allStudents.length === 0) {
      setLoadingStudents(true);
      api
        .getStudentsOptimized({ status: "active", limit: 100, sortBy: "name", sortOrder: "asc" })
        .then((res) => {
          setAllStudents(
            (res.students ?? []).map((s) => ({
              id: s.id,
              name: `${s.firstName} ${s.lastName}`,
              className: s.className ?? undefined,
            })),
          );
        })
        .catch(() => {})
        .finally(() => setLoadingStudents(false));
    }
  }, [scopeType, allStudents.length]);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setScopeType("school_wide");
      setSelectedClassIds([]);
      setSelectedStudentIds([]);
      setAmount("");
      setDueDate("");
      setStudentSearch("");
    }
  }, [open]);

  const toggleClass = (classId: string) => {
    setSelectedClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId],
    );
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId],
    );
  };

  const filteredStudents = allStudents.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return s.name.toLowerCase().includes(q) || (s.className ?? "").toLowerCase().includes(q);
  });

  const canSubmit =
    name.trim().length > 0 &&
    parseFloat(amount) > 0 &&
    (scopeType === "school_wide" ||
      scopeType === "students" ||
      (scopeType === "class" && selectedClassIds.length > 0)) &&
    !saving;

  const handleSubmit = async () => {
    let scopeId: string | string[] | undefined;
    if (scopeType === "class") {
      scopeId = selectedClassIds.length === 1 ? selectedClassIds[0] : selectedClassIds;
    } else if (scopeType === "students") {
      scopeId = selectedStudentIds.length === 1 ? selectedStudentIds[0] : selectedStudentIds;
    }

    const input: CreateCampaignInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      targetScopeType: scopeType,
      targetScopeId: scopeId,
      amount: parseFloat(amount),
      dueDate: dueDate || undefined,
    };

    const result = await onSubmit(input);
    if (result) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Fee Campaign</DialogTitle>
          <DialogDescription>
            Create a new event-based fee and auto-assign eligible students.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Campaign Name *</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sports Day 2026"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="campaign-desc">Description</Label>
            <Textarea
              id="campaign-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details about this campaign"
              rows={2}
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="campaign-amount">Amount per Student ($) *</Label>
            <Input
              id="campaign-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <Label htmlFor="campaign-due">Due Date</Label>
            <Input
              id="campaign-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          {/* Scope */}
          <div className="space-y-1.5">
            <Label>Target Scope *</Label>
            <Select
              value={scopeType}
              onValueChange={(v) => {
                setScopeType(v as CampaignScopeType);
                setSelectedClassIds([]);
                setSelectedStudentIds([]);
                setStudentSearch("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                    <span className="ml-2 text-xs text-muted-foreground">— {opt.helper}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Class selection (only when scope = class) */}
          {scopeType === "class" && (
            <div className="space-y-1.5">
              <Label>
                Select Class(es) *{" "}
                {selectedClassIds.length > 0 && (
                  <span className="text-muted-foreground">({selectedClassIds.length} selected)</span>
                )}
              </Label>
              {loadingClasses ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading classes…
                </div>
              ) : (
                <ScrollArea className="h-40 rounded-md border px-3 py-2">
                  {classes.map((cls) => (
                    <label
                      key={cls.id}
                      className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-muted/40 rounded px-1"
                    >
                      <Checkbox
                        checked={selectedClassIds.includes(cls.id)}
                        onCheckedChange={() => toggleClass(cls.id)}
                      />
                      <span className="text-sm">{cls.name}</span>
                    </label>
                  ))}
                  {classes.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2">No classes found</p>
                  )}
                </ScrollArea>
              )}
            </div>
          )}

          {/* Individual student selection (only when scope = students) */}
          {scopeType === "students" && (
            <div className="space-y-1.5">
              <Label>
                Select Students *{" "}
                {selectedStudentIds.length > 0 && (
                  <span className="text-muted-foreground">({selectedStudentIds.length} selected)</span>
                )}
              </Label>
              {loadingStudents ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8 h-8 text-sm"
                      placeholder="Filter by name or class…"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-44 rounded-md border px-3 py-2">
                    {filteredStudents.map((stu) => (
                      <label
                        key={stu.id}
                        className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-muted/40 rounded px-1"
                      >
                        <Checkbox
                          checked={selectedStudentIds.includes(stu.id)}
                          onCheckedChange={() => toggleStudent(stu.id)}
                        />
                        <span className="text-sm flex-1">{stu.name}</span>
                        {stu.className && (
                          <span className="text-xs text-muted-foreground shrink-0">{stu.className}</span>
                        )}
                      </label>
                    ))}
                    {filteredStudents.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">
                        {studentSearch.trim() ? "No students match your search" : "No active students found"}
                      </p>
                    )}
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
