import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { api } from "@/api/api";
import { Student } from "@/types/dashboard";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface DeleteStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student | null;
  onSuccess?: () => void;
  onChangeStatus?: (student: Student) => void;
}

export function DeleteStudentModal({
  open,
  onOpenChange,
  student,
  onSuccess,
  onChangeStatus,
}: DeleteStudentModalProps) {
  const [loading, setLoading] = useState(false);
  const [financialRecordsError, setFinancialRecordsError] = useState(false);

  const handleDelete = async () => {
    if (!student) return;

    try {
      setLoading(true);
      setFinancialRecordsError(false);
      await api.deleteStudent(student.id);
      toast.success("Student deleted successfully");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      // Check for the specific financial records guard code
      const code = error?.response?.data?.code ?? error?.code;
      if (code === "FINANCIAL_RECORDS_EXIST") {
        setFinancialRecordsError(true);
      } else {
        toast.error("Failed to delete student");
        console.error("Error deleting student:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (value: boolean) => {
    if (!loading) {
      setFinancialRecordsError(false);
      onOpenChange(value);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Student</AlertDialogTitle>
          {financialRecordsError ? (
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-sm text-destructive font-medium">
                  This student cannot be deleted because they have financial records (charges or payments) on file.
                </p>
                <p className="text-sm text-muted-foreground">
                  To remove them from active lists, change their status to <strong>Transferred</strong> or <strong>Withdrawn</strong> instead. Their financial history will remain accessible.
                </p>
              </div>
            </AlertDialogDescription>
          ) : (
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {student?.firstName} {student?.lastName}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {financialRecordsError ? (
            <>
              <AlertDialogCancel disabled={loading}>Close</AlertDialogCancel>
              {onChangeStatus && student && (
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    onChangeStatus(student);
                  }}
                >
                  Change Status Instead
                </Button>
              )}
            </>
          ) : (
            <>
              <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={loading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
