import React, { useState, useCallback } from "react";
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
import { Archive, Trash2 } from "lucide-react";

interface Class {
  id: string;
  name: string;
}

interface ArchiveClassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData: Class;
  onSuccess: () => void;
}

export function ArchiveClassModal({
  open,
  onOpenChange,
  classData,
  onSuccess,
}: ArchiveClassModalProps) {
  const [loading, setLoading] = useState(false);
  const [checkingHistory, setCheckingHistory] = useState(false);
  const [hasHistory, setHasHistory] = useState<boolean | null>(null);
  const { toast } = useToast();

  // Check if class has any historical data
  const checkClassHistory = useCallback(async () => {
    try {
      setCheckingHistory(true);
      const result = await api.getClassEnrollmentHistory(classData.id);
      setHasHistory(result.hasEnrollments);
    } catch (error) {
      // Default to assuming it has history to be safe
      setHasHistory(true);
    } finally {
      setCheckingHistory(false);
    }
  }, [classData.id]);

  // Check history when modal opens
  React.useEffect(() => {
    if (open) {
      setHasHistory(null);
      checkClassHistory();
    }
  }, [open, checkClassHistory]);

  const handleArchive = async () => {
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

  const handlePermanentDelete = async () => {
    try {
      setLoading(true);
      await api.deleteClassPermanently(classData.id);
      toast({ title: "Success", description: `Class "${classData.name}" has been permanently deleted` });
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Cannot Delete Class",
        description: error instanceof Error ? error.message : "Failed to delete class. Please try again.",
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
          <AlertDialogTitle>
            {hasHistory === false ? "Delete Class Permanently?" : "Archive Class?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {checkingHistory ? (
              "Checking class history..."
            ) : hasHistory === false ? (
              <>
                This class <strong>{classData.name}</strong> has no enrollment history. 
                You can permanently delete it instead of archiving.
                <br /><br />
                <strong className="text-destructive">Warning:</strong> This action cannot be undone. 
                The class will be permanently removed from the system.
              </>
            ) : (
              <>
                This will archive the class <strong>{classData.name}</strong>. 
                The class will be hidden from the main view but all historical data will be preserved.
                You can restore this class later if needed.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading || checkingHistory}
          >
            Cancel
          </Button>
          {hasHistory === false ? (
            <Button
              variant="destructive"
              onClick={handlePermanentDelete}
              disabled={loading || checkingHistory}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {loading ? "Deleting..." : "Delete Permanently"}
            </Button>
          ) : (
            <Button
              variant="default"
              onClick={handleArchive}
              disabled={loading || checkingHistory}
            >
              <Archive className="mr-2 h-4 w-4" />
              {loading ? "Archiving..." : "Archive Class"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
