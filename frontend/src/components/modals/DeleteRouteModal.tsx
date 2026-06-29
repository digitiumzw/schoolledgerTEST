/**
 * Delete Route Modal
 * 
 * Confirmation dialog for deleting a transport route.
 * Prevents deletion if students are currently assigned to the route.
 */

import { useState } from "react";
import { api } from "@/api/api";
import { TransportRoute } from "@/types/dashboard";
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
import { toast } from "sonner";
import { Loader2, AlertTriangle, Users } from "lucide-react";

interface DeleteRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: TransportRoute | null;
  onSuccess: () => void;
}

export function DeleteRouteModal({
  open,
  onOpenChange,
  route,
  onSuccess,
}: DeleteRouteModalProps) {
  const [loading, setLoading] = useState(false);

  /**
   * Handle route deletion
   * Shows error if students are assigned to the route
   */
  const handleDelete = async () => {
    if (!route) return;

    try {
      setLoading(true);
      await api.deleteRoute(route.id);
      toast.success("Route deleted successfully");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error deleting route:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete route");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-full max-w-none sm:max-w-md mx-4 sm:mx-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Route</AlertDialogTitle>
          <AlertDialogDescription className="text-sm md:text-base">
            Are you sure you want to delete <strong>{route?.routeName}</strong>?
            This action cannot be undone.
            {route && (
              <div className="mt-3 sm:mt-2 text-sm space-y-1">
                <p>Vehicle: {route.vehicle?.name ?? '—'}</p>
                <p>Driver: {route.driver?.name ?? '—'}</p>
              </div>
            )}
            {route && (route.activeCount ?? 0) > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {route.activeCount} active student{(route.activeCount ?? 0) > 1 ? "s" : ""} assigned
                  </p>
                  <p className="mt-0.5">
                    Deleting this route will deactivate all student transport allocations for this route. Please confirm you want to proceed.
                  </p>
                </div>
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-4">
          <AlertDialogCancel 
            disabled={loading}
            className="w-full sm:w-auto h-12 min-h-[44px]"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto h-12 min-h-[44px]"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
