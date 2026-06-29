import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "@/api/api";
import { useToast } from "@/hooks/use-toast";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const classSchema = z.object({
  name: z.string().min(1, "Class name is required").max(100),
  teacherId: z.string().optional(),
  capacity: z.number({ invalid_type_error: "Capacity must be a number" }).int().min(1).max(999).default(30),
  nextClassId: z.string().optional(),
});

type ClassFormData = z.infer<typeof classSchema>;

interface Teacher {
  id: string;
  name: string;
}

interface AddClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  teachers: Teacher[];
  classes?: { id: string; name: string }[];
}

export function AddClassModal({
  open,
  onOpenChange,
  onSuccess,
  teachers,
  classes = [],
}: AddClassModalProps) {
  const { toast } = useToast();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClassFormData>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: "",
      teacherId: undefined,
      capacity: 30,
      nextClassId: undefined,
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const onSubmit = async (data: ClassFormData) => {
    try {
      await api.createClass({
        name: data.name.trim(),
        teacherId: data.teacherId || null,
        capacity: data.capacity,
        nextClassId: data.nextClassId || null,
      });

      toast({ title: "Success", description: "Class created successfully" });
      reset();
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Failed to create class. Please try again.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Class</DialogTitle>
          <DialogDescription>
            Create a new class and assign a homeroom teacher
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">
                Class Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., 7A or Grade 7A"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="teacher">Homeroom Teacher</Label>
              <Controller
                name="teacherId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                  >
                    <SelectTrigger id="teacher">
                      <SelectValue placeholder="Select a teacher (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No teacher assigned</SelectItem>
                      {teachers.map((teacher) => (
                        <SelectItem key={teacher.id} value={teacher.id}>
                          {teacher.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                placeholder="Enter class capacity"
                min="1"
                max="999"
                {...register("capacity", { valueAsNumber: true })}
              />
              {errors.capacity && (
                <p className="text-xs text-destructive">{errors.capacity.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nextClass">Next Class (for promotion)</Label>
              <Controller
                name="nextClassId"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}
                  >
                    <SelectTrigger id="nextClass">
                      <SelectValue placeholder="Select next class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (Final Class)</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>
                          {cls.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Students will be promoted to this class at end of year.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
