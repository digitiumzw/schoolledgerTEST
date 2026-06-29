import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Pencil, Trash2, ListChecks, Users, X, Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api, FeeRule } from "@/api/api";
import { UseFeeRulesResult } from "@/hooks/useFeeRules";
import { FeeRuleModal } from "@/components/modals/FeeRuleModal";

interface FeeRulesPanelProps {
  feeRules: UseFeeRulesResult;
}

const SCOPE_LABEL: Record<FeeRule["assignmentScopeType"], string> = {
  school_wide: "School-wide",
  class:       "Class",
  category:    "Category",
  service:     "Service",
  student:     "Specific students",
};

export function FeeRulesPanel({ feeRules }: FeeRulesPanelProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FeeRule | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FeeRule | null>(null);

  const [studentListRule, setStudentListRule] = useState<FeeRule | null>(null);
  const [studentNameMap, setStudentNameMap] = useState<Record<string, string>>({});
  const [studentNamesLoading, setStudentNamesLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [classMap, setClassMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    api.getClasses()
      .then((data: Array<{ id: string; name: string }>) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        (data || []).forEach((c) => { map[c.id] = c.name; });
        setClassMap(map);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const { rules, loading, saving, createRule, updateRule, deleteRule } = feeRules;

  // When the student list sheet opens, fetch names for all assigned student IDs.
  useEffect(() => {
    if (!studentListRule) return;
    const raw = studentListRule.assignmentScopeId;
    const ids: string[] = Array.isArray(raw) ? raw : (typeof raw === "string" && raw ? [raw] : []);
    if (ids.length === 0) return;
    const missing = ids.filter((id) => !studentNameMap[id]);
    if (missing.length === 0) return;
    setStudentNamesLoading(true);
    const PAGE_SIZE = 100;
    const fetchAll = async () => {
      let page = 1;
      const collected: Record<string, string> = {};
      while (true) {
        const res = await api.getStudentsOptimized({ status: "active", limit: PAGE_SIZE, page });
        (res?.students || []).forEach((s) => {
          collected[s.id] = `${s.firstName} ${s.lastName}`.trim();
        });
        const total = res?.pagination?.total ?? (res?.students?.length ?? 0);
        if (Object.keys(collected).length >= total || (res?.students?.length ?? 0) < PAGE_SIZE) break;
        page++;
      }
      return collected;
    };
    fetchAll()
      .then((map) => setStudentNameMap((prev) => ({ ...prev, ...map })))
      .catch(() => {})
      .finally(() => setStudentNamesLoading(false));
  }, [studentListRule]);

  const handleRemoveStudent = async (rule: FeeRule, studentId: string) => {
    const raw = rule.assignmentScopeId;
    const ids: string[] = Array.isArray(raw) ? raw : (typeof raw === "string" && raw ? [raw] : []);
    const next = ids.filter((id) => id !== studentId);
    setRemovingId(studentId);
    try {
      if (next.length === 0) {
        // Backend rejects an empty student array — switch to school_wide instead.
        await updateRule(rule.id, {
          name: rule.name,
          amount: rule.amount,
          assignmentScopeType: "school_wide",
          assignmentScopeId: null,
          isActive: rule.isActive,
        });
        setStudentListRule(null);
      } else {
        await updateRule(rule.id, {
          name: rule.name,
          amount: rule.amount,
          assignmentScopeType: "student",
          assignmentScopeId: next,
          isActive: rule.isActive,
        });
        setStudentListRule((prev) =>
          prev ? { ...prev, assignmentScopeId: next } : prev
        );
      }
    } finally {
      setRemovingId(null);
    }
  };

  const renderScopeDisplay = useMemo(() => (rule: FeeRule): string => {
    if (rule.assignmentScopeType !== "class" && rule.assignmentScopeType !== "student") {
      return rule.assignmentScopeLabel || SCOPE_LABEL[rule.assignmentScopeType];
    }
    const raw = rule.assignmentScopeId;
    const ids: string[] = Array.isArray(raw)
      ? raw
      : (typeof raw === "string" && raw.length > 0 ? [raw] : []);
    if (rule.assignmentScopeType === "student") {
      if (ids.length === 0) return "Specific students";
      return `${ids.length} student${ids.length === 1 ? "" : "s"}`;
    }
    if (ids.length === 0) return "Class";
    return ids.map((id) => classMap[id] ?? id).join(", ");
  }, [classMap]);
  const activeRuleCount = rules.filter((rule) => rule.isActive).length;

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (r: FeeRule) => { setEditing(r); setModalOpen(true); };

  const handleSubmit = async (payload: Parameters<typeof createRule>[0]) => {
    if (editing) return updateRule(editing.id, payload);
    return createRule(payload);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    await deleteRule(pendingDelete.id);
    setPendingDelete(null);
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary mt-0.5">
              <ListChecks className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Tuition Rules</CardTitle>
                <Badge variant={isAdmin ? "default" : "outline"} className="text-xs">
                  {isAdmin ? "Manageable" : "Read-only"}
                </Badge>
              </div>
              <CardDescription className="mt-1">
                Recurring billing instructions used by the charge-generation engine.
                {!loading && rules.length > 0 && (
                  <span className="ml-2 text-foreground/70">
                    {rules.length} configured &middot;{" "}
                    <span className="text-green-600">{activeRuleCount} active</span>
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" onClick={openCreate} disabled={saving} className="shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Loading rules…
          </div>
        ) : rules.length === 0 ? (
          <div className="py-14 text-center space-y-3 px-6">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">No tuition rules yet</p>
              <p className="text-sm text-muted-foreground">
                {isAdmin ? "Create one to start billing students." : "Admins can create tuition rules for this tenant."}
              </p>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first rule
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  {isAdmin && <TableHead className="w-[100px] text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow
                    key={rule.id}
                    className={rule.assignmentScopeType === "student" ? "cursor-pointer hover:bg-muted/60" : ""}
                    onClick={() => {
                      if (rule.assignmentScopeType === "student") setStudentListRule(rule);
                    }}
                  >
                    <TableCell className="font-medium">{rule.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {rule.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex flex-col">
                        <span className="text-xs text-muted-foreground">
                          {SCOPE_LABEL[rule.assignmentScopeType]}
                        </span>
                        <span className="text-sm">{renderScopeDisplay(rule)}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rule.isActive ? "default" : "secondary"}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost"
                            onClick={(e) => { e.stopPropagation(); openEdit(rule); }}
                            disabled={saving}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setPendingDelete(rule); }}
                            disabled={saving}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* ── Student list sheet ──────────────────────────────────────────── */}
      <Sheet open={studentListRule !== null} onOpenChange={(v) => { if (!v) setStudentListRule(null); }}>
        <SheetContent className="w-full sm:max-w-md flex flex-col">
          <SheetHeader className="pb-2">
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {studentListRule?.name}
            </SheetTitle>
            <SheetDescription>
              Students assigned to this rule. Remove any student to unlink them.
            </SheetDescription>
          </SheetHeader>

          {(() => {
            if (!studentListRule) return null;
            const raw = studentListRule.assignmentScopeId;
            const ids: string[] = Array.isArray(raw) ? raw : (typeof raw === "string" && raw ? [raw] : []);
            if (studentNamesLoading) {
              return (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading students…
                </div>
              );
            }
            if (ids.length === 0) {
              return (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  No students assigned to this rule.
                </div>
              );
            }
            return (
              <div className="flex-1 flex flex-col gap-2 mt-2 min-h-0">
                {ids.length === 1 && isAdmin && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    Removing the last student will switch this rule to <strong>School-wide</strong> scope.
                  </p>
                )}
                <ScrollArea className="flex-1">
                  <ul className="space-y-1 pr-2">
                    {ids.map((id) => (
                      <li key={id} className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted/60">
                        <span className="text-sm">{studentNameMap[id] ?? id}</span>
                        {isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                            disabled={removingId === id || saving}
                            onClick={() => studentListRule && handleRemoveStudent(studentListRule, id)}
                          >
                            {removingId === id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <X className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      <FeeRuleModal
        open={modalOpen}
        rule={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        saving={saving}
      />

      <AlertDialog open={pendingDelete !== null} onOpenChange={(v) => { if (!v) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-destructive" />
              Delete tuition rule?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {`This will permanently remove "${pendingDelete?.name}". Existing charges already generated from this rule are kept for audit purposes.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
