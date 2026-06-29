import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AddStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddStudentModal({ open, onOpenChange }: AddStudentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Student</DialogTitle>
          <DialogDescription>
            Student registration form will be implemented in the next stage.
          </DialogDescription>
        </DialogHeader>
        <div className="py-6 text-center text-muted-foreground">
          <p className="mb-4">Form fields coming soon:</p>
          <ul className="text-sm space-y-2">
            <li>• Student Name</li>
            <li>• Class/Grade</li>
            <li>• Contact Information</li>
            <li>• Parent/Guardian Details</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
