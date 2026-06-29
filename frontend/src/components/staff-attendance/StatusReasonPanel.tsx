import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle } from "lucide-react";
import { formatTime } from "@/lib/attendanceUtils";
import { WorkHours } from "@/types/dashboard";

interface StatusReasonPanelProps {
  isOpen: boolean;
  onClose: () => void;
  status: string;
  staffName: string;
  checkInTime?: string;
  workHours?: WorkHours;
  existingRemarks?: string;
  onReasonSubmit?: (reason: string) => void;
}

export function StatusReasonPanel({
  isOpen,
  onClose,
  status,
  staffName,
  checkInTime,
  workHours,
  existingRemarks,
  onReasonSubmit
}: StatusReasonPanelProps) {
  const [reason, setReason] = useState(existingRemarks || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reset reason when modal opens with new remarks
  useEffect(() => {
    if (isOpen) {
      setReason(existingRemarks || "");
    }
  }, [isOpen, existingRemarks]);

  const handleSubmit = async () => {
    if (!reason.trim() && status === 'absent') return;
    
    setIsSubmitting(true);
    try {
      if (onReasonSubmit) {
        await onReasonSubmit(reason);
      }
      onClose();
      setReason("");
    } catch (error) {
      console.error("Failed to submit reason:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateMinutesLate = () => {
    if (!checkInTime || !workHours) return 0;
    
    const [checkInHours, checkInMinutes] = checkInTime.split(':').map(Number);
    const [startHours, startMinutes] = workHours.startTime.split(':').map(Number);
    
    const checkInTotalMinutes = checkInHours * 60 + checkInMinutes;
    const startTotalMinutes = startHours * 60 + startMinutes;
    
    return Math.max(0, checkInTotalMinutes - startTotalMinutes);
  };

  const formatLateTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      if (mins > 0) {
        return `${hours}h ${mins}m`;
      }
      return `${hours}h`;
    }
    return `${mins}m`;
  };

  // Helper function to get display status
  const getDisplayStatus = (status: string): string => {
    switch (status) {
      case 'present':
        return 'PRESENT';
      case 'late':
        return 'LATE';
      case 'absent':
        return 'ABSENT';
      case 'on_leave':
        return 'ON LEAVE';
      case 'half_day':
        return 'HALF DAY';
      case 'checked_out':
        return 'PRESENT';
      case 'pending':
        return 'NOT ARRIVED';
      case 'inactive':
        return 'INACTIVE';
      default:
        return status.replace('_', ' ').toUpperCase();
    }
  };

  const renderStatusContent = () => {
    switch (status) {
      case 'pending':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-5 w-5" />
              <span className="font-medium">Not Arrived</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Staff member has not checked in yet. The status will be automatically updated to ABSENT after the cutoff time.
            </p>
            <div className="space-y-2">
              <label htmlFor="pending-reason" className="text-sm font-medium">
                Optional: Mark as absent with reason:
              </label>
              <Textarea
                id="pending-reason"
                placeholder="Enter reason for early absence marking..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
        );
        
      case 'absent':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Reason Required</span>
            </div>
            <div className="space-y-2">
              <label htmlFor="reason" className="text-sm font-medium">
                Please provide a reason for absence:
              </label>
              <Textarea
                id="reason"
                placeholder="Enter reason for absence..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[100px]"
              />
              {existingRemarks && (
                <div className="text-sm text-muted-foreground">
                  Existing Remarks: {existingRemarks}
                </div>
              )}
            </div>
          </div>
        );
        
      case 'late':
        const minutesLate = calculateMinutesLate();
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-secondary-foreground">
              <Clock className="h-5 w-5" />
              <span className="font-medium">Late Arrival Details</span>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Expected start time:</span>
                <span className="font-medium">
                  {workHours ? formatTime(workHours.startTime) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Actual check-in:</span>
                <span className="font-medium">
                  {checkInTime ? formatTime(checkInTime) : '-'}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span className="text-sm font-medium">Late by:</span>
                <Badge variant="secondary">
                  {formatLateTime(minutesLate)}
                </Badge>
              </div>
            </div>
            {minutesLate > 30 && (
              <div className="space-y-2">
                <label htmlFor="late-reason" className="text-sm font-medium">
                  Please provide a reason for being significantly late ({formatLateTime(minutesLate)}):
                </label>
                <Textarea
                  id="late-reason"
                  placeholder="Optional: Explain reason for delay..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-h-[80px]"
                />
                {existingRemarks && (
                  <div className="text-sm text-muted-foreground">
                    Existing Remarks: {existingRemarks}
                  </div>
                )}
              </div>
            )}
          </div>
        );
        
      default:
        return (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Status: {getDisplayStatus(status)}
            </p>
            {status === 'inactive' && (
              <p className="text-sm text-muted-foreground">
                This staff member is currently inactive and cannot check in or out.
              </p>
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant={status === 'absent' ? 'destructive' : status === 'late' ? 'secondary' : 'default'}>
              {getDisplayStatus(status)}
            </Badge>
            <span>{staffName}</span>
          </DialogTitle>
        </DialogHeader>
        
        {renderStatusContent()}
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {(status === 'absent' || status === 'pending' || (status === 'late' && calculateMinutesLate() > 30)) && (
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || ((status === 'absent' || status === 'pending') && !reason.trim())}
            >
              {isSubmitting ? "Submitting..." : status === 'pending' ? "Mark Absent" : "Submit"}
            </Button>
          )}
          {status === 'late' && calculateMinutesLate() <= 30 && (
            <Button onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
