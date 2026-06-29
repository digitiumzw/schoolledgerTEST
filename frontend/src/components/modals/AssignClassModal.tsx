import { useState, useEffect } from "react";
import { api, SchoolClass } from "@/api/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface AssignClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentIds: string[];
  onSuccess: () => void;
}

export function AssignClassModal({
  open,
  onOpenChange,
  studentIds,
  onSuccess,
}: AssignClassModalProps) {
  const { toast } = useToast();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedClassId("");
    setLoadingClasses(true);
    api
      .getClasses(false)
      .then((list) => setClasses(list.filter((c) => !c.archivedAt)))
      .catch(() =>
        toast({ title: "Error", description: "Could not load classes.", variant: "destructive" })
      )
      .finally(() => setLoadingClasses(false));
  }, [open, toast]);

  async function handleConfirm() {
    if (!selectedClassId || studentIds.length === 0) return;
    setAssigning(true);
    try {
      const result = await api.assignStudentsToClass(selectedClassId, studentIds, false);
      const assigned = (result as { assignedCount?: number }).assignedCount ?? studentIds.length;
      toast({
        title: "Students assigned",
        description: `${assigned} student(s) assigned successfully.`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Assignment failed",
        description: error instanceof Error ? error.message : "Could not assign students.",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const seatsFree =
    selectedClass
      ? selectedClass.capacity > 0
        ? selectedClass.capacity - selectedClass.studentCount
        : null
      : null;
  const wouldExceed =
    seatsFree !== null && studentIds.length > seatsFree;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign to Class</DialogTitle>
          <DialogDescription>
            {studentIds.length === 1
              ? "Assign 1 selected student to a class."
              : `Assign ${studentIds.length} selected students to a class.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="class-select">Target Class</Label>
            <Select
              value={selectedClassId}
              onValueChange={setSelectedClassId}
              disabled={loadingClasses}
            >
              <SelectTrigger id="class-select">
                <SelectValue
                  placeholder={loadingClasses ? "Loading classes…" : "Select a class"}
                />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.capacity > 0 && (
                      <span className="ml-2 text-muted-foreground text-xs">
                        ({c.studentCount}/{c.capacity} students)
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {wouldExceed && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              This class only has {seatsFree} seat{seatsFree !== 1 ? "s" : ""} available. You are
              assigning {studentIds.length} students. The backend may enforce the capacity limit.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assigning}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedClassId || assigning || loadingClasses}
          >
            {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
