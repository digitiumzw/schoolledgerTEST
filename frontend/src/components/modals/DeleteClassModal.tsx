import { useState } from "react";
import { api } from "@/api/api";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface Class {
  id: string;
  name: string;
}

interface DeleteClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: Class;
  onSuccess: () => void;
}

export function DeleteClassModal({
  open,
  onOpenChange,
  classData,
  onSuccess,
}: DeleteClassModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      setLoading(true);
      await api.archiveClass(classData.id);
      toast({ title: "Success", description: "Class archived successfully" });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Cannot Archive Class",
        description: error instanceof Error ? error.message : "Failed to archive class. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive Class?</AlertDialogTitle>
          <AlertDialogDescription>
            This will archive the class <strong>{classData.name}</strong>. The class will be
            hidden from the main view but all historical data will be preserved. You can
            restore this class later if needed. Active students must be removed first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Archiving..." : "Archive Class"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
