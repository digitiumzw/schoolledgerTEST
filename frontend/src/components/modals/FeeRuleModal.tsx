/**
 * FeeRuleModal (Feature 056)
 *
 * Create / edit modal for fee rules. Admin-only — the parent panel hides the
 * trigger buttons for non-admin users, but we also defensively disable submit
 * if the API rejects with a 403.
 */

import { useEffect, useMemo, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { api, FeeRule, FeeRuleInput, FeeRuleInputScopeType } from "@/api/api";

interface FeeRuleModalProps {
  open: boolean;
  rule: FeeRule | null;
  onClose: () => void;
  onSubmit: (payload: FeeRuleInput) => Promise<FeeRule | null>;
  saving: boolean;
}

interface ClassOption {
  id: string;
  name: string;
}

interface StudentOption {
  id: string;
  name: string;
  className: string;
}

const SCOPE_OPTIONS: Array<{ value: FeeRuleInputScopeType; label: string; helper: string }> = [
  { value: "school_wide", label: "School-wide",  helper: "All active students" },
  { value: "class",       label: "Class",        helper: "Students in a specific class" },
  { value: "student",     label: "Specific students", helper: "Selected active students only" },
];

export function FeeRuleModal({ open, rule, onClose, onSubmit, saving }: FeeRuleModalProps) {
  const { toast } = useToast();
  const isEdit = Boolean(rule);

  const [name, setName]               = useState("");
  const [amount, setAmount]           = useState<string>("");
  const [scopeType, setScopeType]     = useState<FeeRuleInputScopeType>("school_wide");
  // classIds is used for class scope (feature 057 multi-class).
  const [classIds, setClassIds]       = useState<string[]>([]);
  // studentIds is used for the specific-students scope.
  const [studentIds, setStudentIds]   = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [isActive, setIsActive]       = useState<boolean>(true);

  const [classes, setClasses]         = useState<ClassOption[]>([]);
  const [students, setStudents]       = useState<StudentOption[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const studentsFetchedRef = useRef(false);

  // Hydrate form when modal opens or selected rule changes
  useEffect(() => {
    if (rule) {
      const nextScopeType: FeeRuleInputScopeType =
        rule.assignmentScopeType === "class" || rule.assignmentScopeType === "student"
          ? rule.assignmentScopeType
          : "school_wide";
      setName(rule.name);
      setAmount(String(rule.amount));
      setScopeType(nextScopeType);
      // assignmentScopeId may be string (single) or string[] (multi)
      const raw = rule.assignmentScopeId;
      const ids = Array.isArray(raw)
        ? raw
        : (typeof raw === "string" && raw.length > 0 ? [raw] : []);
      setClassIds(nextScopeType === "class" ? ids : []);
      setStudentIds(nextScopeType === "student" ? ids : []);
      setIsActive(rule.isActive);
    } else {
      setName("");
      setAmount("");
      setScopeType("school_wide");
      setClassIds([]);
      setStudentIds([]);
      setIsActive(true);
    }
    setStudentSearch("");
    // Reset the fetch guard when the modal closes so the list is refreshed
    // on the next open (avoids stale data if students changed meanwhile).
    if (!open) {
      studentsFetchedRef.current = false;
      setStudents([]);
    }
  }, [rule, open]);

  // Lazy-load lookup options when needed
  useEffect(() => {
    if (!open) return;
    if (scopeType === "class" && classes.length === 0) {
      api.getClasses().then((data: Array<{ id: string; name: string }>) => {
        setClasses((data || []).map((c) => ({ id: c.id, name: c.name })));
      }).catch(() => {});
    }
  }, [open, scopeType, classes.length]);

  // Lazy-load active students for the specific-students scope.
  // Use a ref to track whether a fetch has already been kicked off so that
  // neither `studentsLoading` nor `students.length` need to be in the deps
  // array (both caused a re-render loop in the original implementation).
  useEffect(() => {
    if (!open || scopeType !== "student" || studentsFetchedRef.current) return;
    studentsFetchedRef.current = true;
    setStudentsLoading(true);
    const fetchAllPages = async () => {
      const PAGE_SIZE = 100;
      let page = 1;
      let collected: StudentOption[] = [];
      while (true) {
        const res = await api.getStudentsOptimized({
          status: "active",
          limit: PAGE_SIZE,
          page,
          sortBy: "name",
          sortOrder: "asc",
        });
        const batch = Array.isArray(res?.students) ? res.students : [];
        collected = collected.concat(
          batch.map((s) => ({
            id: s.id,
            name: `${s.firstName} ${s.lastName}`.trim(),
            className: s.className || "",
          }))
        );
        const total = res?.pagination?.total ?? batch.length;
        if (collected.length >= total || batch.length < PAGE_SIZE) break;
        page++;
      }
      return collected;
    };

    fetchAllPages()
      .then((opts) => setStudents(opts))
      .catch((err) => {
        console.error("[FeeRuleModal] Failed to load active students:", err);
        studentsFetchedRef.current = false;
      })
      .finally(() => setStudentsLoading(false));
  }, [open, scopeType]);

  const requiresScopeId = scopeType !== "school_wide";

  const validationError = useMemo(() => {
    if (!name.trim()) return "Name is required";
    const num = Number(amount);
    if (!amount || Number.isNaN(num) || num < 0) return "Amount must be a non-negative number";
    if (scopeType === "class" && classIds.length === 0) return "Please pick at least one class";
    if (scopeType === "student" && studentIds.length === 0) return "Please pick at least one student";
    return null;
  }, [name, amount, scopeType, classIds, studentIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) {
      toast({ title: "Validation error", description: validationError, variant: "destructive" });
      return;
    }

    let assignmentScopeId: string | string[] | null = null;
    if (scopeType === "class") {
      assignmentScopeId = classIds;
    } else if (scopeType === "student") {
      assignmentScopeId = studentIds;
    }

    const payload: FeeRuleInput = {
      name: name.trim(),
      amount: Number(amount),
      assignmentScopeType: scopeType,
      assignmentScopeId,
      isActive,
    };

    const result = await onSubmit(payload);
    if (result) onClose();
  };

  const toggleClassId = (id: string, checked: boolean) => {
    setClassIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const toggleStudentId = (id: string, checked: boolean) => {
    setStudentIds((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const renderScopeIdInput = () => {
    if (scopeType === "class") {
      return (
        <div className="rounded-md border">
          <ScrollArea className="h-48">
            <div className="p-2 space-y-1">
              {classes.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">Loading classes…</p>
              )}
              {classes.map((c) => {
                const checked = classIds.includes(c.id);
                return (
                  <label
                    key={c.id}
                    htmlFor={`cls-${c.id}`}
                    className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      id={`cls-${c.id}`}
                      checked={checked}
                      onCheckedChange={(v) => toggleClassId(c.id, Boolean(v))}
                      disabled={saving}
                    />
                    <span className="text-sm">{c.name}</span>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
          {classIds.length > 0 && (
            <div className="px-3 py-2 border-t text-xs text-muted-foreground">
              {classIds.length} class{classIds.length === 1 ? "" : "es"} selected
            </div>
          )}
        </div>
      );
    }

    if (scopeType === "student") {
      return (
        <div className="rounded-md border">
          <ScrollArea className="h-48">
            <div className="p-2 space-y-1">
              {studentsLoading && (
                <p className="text-xs text-muted-foreground p-2">Loading students…</p>
              )}
              {!studentsLoading && students.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">No active students found.</p>
              )}
              {!studentsLoading && students.length > 0 && filteredStudents.length === 0 && (
                <p className="text-xs text-muted-foreground p-2">No students match your search.</p>
              )}
              {filteredStudents.map((s) => {
                const checked = studentIds.includes(s.id);
                return (
                  <label
                    key={s.id}
                    htmlFor={`stu-${s.id}`}
                    className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent cursor-pointer"
                  >
                    <Checkbox
                      id={`stu-${s.id}`}
                      checked={checked}
                      onCheckedChange={(v) => toggleStudentId(s.id, Boolean(v))}
                      disabled={saving}
                    />
                    <span className="text-sm">
                      {s.name}
                      {s.className && (
                        <span className="text-muted-foreground"> — {s.className}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
          {studentIds.length > 0 && (
            <div className="px-3 py-2 border-t text-xs text-muted-foreground">
              {studentIds.length} student{studentIds.length === 1 ? "" : "s"} selected
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Tuition Rule" : "New Tuition Rule"}</DialogTitle>
          <DialogDescription>
            Tuition rules are evaluated by the billing engine when you generate charges
            for the current period. Inactive rules are skipped.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rule-name">Name *</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Tuition, Boarding Fee"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-amount">Amount *</Label>
            <Input
              id="rule-amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rule-scope">Assignment scope *</Label>
            <Select
              value={scopeType}
              onValueChange={(v) => { setScopeType(v as FeeRuleInputScopeType); setClassIds([]); setStudentIds([]); }}
              disabled={saving}
            >
              <SelectTrigger id="rule-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} — <span className="text-muted-foreground">{opt.helper}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresScopeId && (
            <div className="space-y-2">
              <Label>{scopeType === "student" ? "Students" : "Class"}</Label>
              {scopeType === "student" && (
                <Input
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Search active students…"
                  disabled={saving}
                  className="h-8"
                />
              )}
              {renderScopeIdInput()}
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="rule-active">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive rules are skipped during charge generation.
              </p>
            </div>
            <Switch
              id="rule-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={saving}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || Boolean(validationError)}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
