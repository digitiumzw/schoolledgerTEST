import { useState, useEffect, useMemo } from "react";
import { api } from "@/api/api";
import { TransportStop } from "@/types/dashboard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  className: string;
  routeStatus: string;
  assignedRouteName?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  routeId: string;
  routeName: string;
  stops: TransportStop[];
}

export function AllocateStudentModal({ open, onOpenChange, onSuccess, routeId, routeName, stops }: Props) {
  const [loading, setLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    studentId: "",
    stopId: "",
    direction: "both",
    notes: "",
  });

  useEffect(() => {
    if (!open) { setSearch(""); setForm(f => ({ ...f, studentId: "", stopId: "", notes: "" })); return; }

    setStudentsLoading(true);
    api.getStudentsWithRouteStatus(routeId)
      .then((data: Student[]) => {
        setStudents(
          (data ?? []).map(s => ({
            id: s.id,
            firstName: s.firstName ?? "",
            lastName: s.lastName ?? "",
            className: s.className ?? "",
            routeStatus: s.routeStatus ?? "available",
            assignedRouteName: s.assignedRouteName ?? undefined,
          }))
        );
      })
      .catch(() => { toast.error("Failed to load students"); })
      .finally(() => setStudentsLoading(false));
  }, [open, routeId]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return students.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      s.className.toLowerCase().includes(q)
    );
  }, [students, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentId) { toast.error("Select a student"); return; }

    try {
      setLoading(true);
      await api.createAllocation(routeId, {
        studentId: form.studentId,
        stopId: form.stopId || undefined,
        direction: form.direction,
        notes: form.notes || undefined,
      });
      toast.success("Student allocated to route");
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to allocate student");
    } finally {
      setLoading(false);
    }
  };

  const selectedStudent = students.find(s => s.id === form.studentId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Allocate Student to {routeName}</DialogTitle>
          <DialogDescription>Assign a student to a stop on this route.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Student picker */}
          <div className="space-y-2">
            <Label>Student *</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search students…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {studentsLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading students…
              </div>
            ) : (
              <ScrollArea className="h-40 border rounded-md">
                {filtered.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">No students found</p>
                ) : (
                  <div className="p-1">
                    {filtered.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, studentId: s.id }))}
                        className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-accent transition-colors ${
                          form.studentId === s.id ? "bg-primary/10 font-medium" : ""
                        } ${s.routeStatus === "assigned_this_route" ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={s.routeStatus === "assigned_this_route"}
                      >
                        <span className="font-medium">{s.firstName} {s.lastName}</span>
                        <span className="text-muted-foreground ml-2">{s.className}</span>
                        {s.routeStatus === "assigned_other_route" && (
                          <span className="text-xs text-amber-600 ml-2">(on {s.assignedRouteName})</span>
                        )}
                        {s.routeStatus === "assigned_this_route" && (
                          <span className="text-xs text-muted-foreground ml-2">(already on this route)</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            )}
            {selectedStudent && (
              <p className="text-xs text-primary font-medium">
                Selected: {selectedStudent.firstName} {selectedStudent.lastName} ({selectedStudent.className})
              </p>
            )}
          </div>

          {/* Stop selection */}
          {stops.length > 0 && (
            <div className="space-y-2">
              <Label>Boarding Stop</Label>
              <Select value={form.stopId || "none"} onValueChange={v => setForm({ ...form, stopId: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select stop…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No specific stop —</SelectItem>
                  {stops.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}{s.pickupTime ? ` · ${s.pickupTime}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={v => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both ways</SelectItem>
                  <SelectItem value="inbound">Inbound only</SelectItem>
                  <SelectItem value="outbound">Outbound only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.studentId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Allocate Student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
