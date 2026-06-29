import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useTenantDeletionStatus, useRequestDeletion, useUndoDeletion } from '@/hooks/useTenantDeletion';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, Loader2, Trash2, RotateCcw, Clock, Shield } from 'lucide-react';

export function AccountDeletionCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: status, isLoading } = useTenantDeletionStatus();
  const requestDeletion = useRequestDeletion();
  const undoDeletion = useUndoDeletion();

  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showUndoDialog, setShowUndoDialog] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);

  // Restrict deletion functionality to super_admin only
  if (user?.role !== 'super_admin') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account Deletion
          </CardTitle>
          <CardDescription>
            Account deletion is restricted to Super Admin users only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Access Restricted</AlertTitle>
            <AlertDescription>
              Only Super Admin users can request account deletion. Please contact your Super Admin for assistance with account management.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isPendingDeletion = status?.deletionRequested ?? false;
  const remainingDays = status?.remainingDays ?? 0;
  const canUndo = status?.canUndo ?? false;

  const handleRequestDeletion = async () => {
    if (!confirmDelete) {
      toast({
        title: 'Confirmation Required',
        description: 'Please check the confirmation box to proceed.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await requestDeletion.mutateAsync({ confirmDelete: true });
      setShowRequestDialog(false);
      setConfirmDelete(false);
      toast({
        title: 'Deletion Requested',
        description: `Your account will be deleted in 7 days. You can undo this in Settings → Account.`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request account deletion.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleUndoDeletion = async () => {
    if (!confirmUndo) {
      toast({
        title: 'Confirmation Required',
        description: 'Please check the confirmation box to proceed.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await undoDeletion.mutateAsync({ confirmUndo: true });
      setShowUndoDialog(false);
      setConfirmUndo(false);
      toast({
        title: 'Deletion Canceled',
        description: 'Your account has been restored and is now fully active.',
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to undo deletion request.';
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Account Deletion
          </CardTitle>
          <CardDescription>Loading account status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show pending deletion warning
  if (isPendingDeletion) {
    return (
      <>
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Account Scheduled for Deletion
            </CardTitle>
            <CardDescription>
              Your account is scheduled to be permanently deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <Clock className="h-4 w-4" />
              <AlertTitle>Deletion in {remainingDays} day{remainingDays !== 1 ? 's' : ''}</AlertTitle>
              <AlertDescription>
                Your account <strong>{status?.tenantName}</strong> will be permanently deleted on{' '}
                <strong>{status?.expiresAt ? new Date(status.expiresAt).toLocaleDateString() : 'N/A'}</strong>.
                All data including students, payments, and records will be permanently removed.
              </AlertDescription>
            </Alert>

            {canUndo && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  Changed your mind? You can cancel the deletion request and restore your account immediately.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowUndoDialog(true)}
                  disabled={undoDeletion.isPending}
                >
                  {undoDeletion.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Undo Account Deletion
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Undo Confirmation Dialog */}
        <Dialog open={showUndoDialog} onOpenChange={setShowUndoDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Account Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel the deletion of your account? This will restore full access immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="confirm-undo"
                  checked={confirmUndo}
                  onCheckedChange={(checked) => setConfirmUndo(checked === true)}
                />
                <label
                  htmlFor="confirm-undo"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  I confirm that I want to cancel the account deletion and restore my account.
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUndoDialog(false)} disabled={undoDeletion.isPending}>
                Cancel
              </Button>
              <Button onClick={handleUndoDeletion} disabled={undoDeletion.isPending || !confirmUndo}>
                {undoDeletion.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Restore Account'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Show request deletion option
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Account Deletion
          </CardTitle>
          <CardDescription>
            Request deletion of your SchoolLedger account and all associated data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important Notice</AlertTitle>
            <AlertDescription>
              Deleting your account will permanently remove all data including students, classes,
              payments, attendance records, and settings. This action cannot be undone after the
              7-day grace period.
            </AlertDescription>
          </Alert>

          <Button
            variant="destructive"
            className="w-full"
            onClick={() => setShowRequestDialog(true)}
            disabled={requestDeletion.isPending}
          >
            {requestDeletion.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Request Account Deletion
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Request Deletion Confirmation Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Account Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your SchoolLedger account? You will have 7 days to undo this request.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                All data will be permanently deleted after 7 days, including:
                <ul className="list-disc list-inside mt-2">
                  <li>Student records and enrollment history</li>
                  <li>Payment and billing data</li>
                  <li>Attendance records</li>
                  <li>Class and grade information</li>
                  <li>Staff and user accounts</li>
                </ul>
              </AlertDescription>
            </Alert>
            <div className="flex items-start space-x-2">
              <Checkbox
                id="confirm-delete"
                checked={confirmDelete}
                onCheckedChange={(checked) => setConfirmDelete(checked === true)}
              />
              <label
                htmlFor="confirm-delete"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I understand that my account will be permanently deleted after 7 days and this action cannot be undone.
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRequestDialog(false);
                setConfirmDelete(false);
              }}
              disabled={requestDeletion.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRequestDeletion}
              disabled={requestDeletion.isPending || !confirmDelete}
            >
              {requestDeletion.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Request Deletion'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
