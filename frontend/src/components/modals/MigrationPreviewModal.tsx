import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, Users, GraduationCap, AlertTriangle, Loader2, ShieldAlert, Wrench, AlertCircle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Shape returned by GET /api/classes/promotion-preview
interface ClassPromotionPreviewItem {
  class: {
    id: string;
    name: string;
    isFinalClass: boolean;
  };
  studentsToPromote: number;
  nextClass: { id: string; name: string } | null;
  isFinalClass: boolean;
}

interface MigrationPreview {
  academicSession: string;
  nextSession: string;
  migrations: {
    fromClass: string;
    toClass: string;
    studentCount: number;
    isGraduation?: boolean;
    isNoNextClass?: boolean;
    isRepeating?: boolean;
  }[];
  summary: {
    totalStudents: number;
    promotedCount: number;
    graduatedCount: number;
    repeatingCount: number;
    noNextClassCount?: number;
  };
  reconciliationNeeded?: number;
}

interface MigrationPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function MigrationPreviewModal({
  open,
  onOpenChange,
  onConfirm,
}: MigrationPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [classPreview, setClassPreview] = useState<ClassPromotionPreviewItem[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchPreview();
    }
    // fetchPreview is stable — defined inline, no external deps that change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      // Fetch both previews in parallel
      const [migPreview, classItems] = await Promise.allSettled([
        api.getMigrationPreview(),
        api.getClassPromotionPreview(),
      ]);

      if (migPreview.status === "fulfilled") {
        setPreview(migPreview.value);
      } else {
        // Migration preview is the primary signal — surface its failure even
        // when the secondary classPreview happened to succeed.
        toast({
          title: "Preview Partially Loaded",
          description:
            migPreview.reason instanceof Error
              ? migPreview.reason.message
              : "Failed to load migration summary.",
          variant: "destructive",
        });
      }

      if (classItems.status === "fulfilled") {
        setClassPreview(classItems.value ?? []);
      } else if (migPreview.status === "fulfilled") {
        // Only warn about the secondary call when the primary succeeded —
        // otherwise the user already saw the error above.
        toast({
          title: "Class Breakdown Unavailable",
          description:
            classItems.reason instanceof Error
              ? classItems.reason.message
              : "Failed to load class breakdown.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load promotion preview. Please try again.",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    try {
      setReconciling(true);
      const result = await api.reconcileStudents(false);
      toast({
        title: "Reconciliation Complete",
        description:
          `Repaired ${result.repaired} student(s). ` +
          (result.needsManualReview > 0
            ? `${result.needsManualReview} still need manual review.`
            : "All student records are now in sync."),
      });
      // Re-fetch preview so the drift banner clears (or updates).
      await fetchPreview();
    } catch (error) {
      toast({
        title: "Reconciliation Failed",
        description: error instanceof Error ? error.message : "Could not reconcile students.",
        variant: "destructive",
      });
    } finally {
      setReconciling(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading migration preview...</span>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (!preview) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Unable to Load Preview</AlertDialogTitle>
            <AlertDialogDescription>
              Could not load the promotion preview. Please close and try again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Migration Summary – {preview.academicSession} → {preview.nextSession}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Review the details below before confirming. Only students enrolled in the current
            session are shown.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-6 py-4">
          {/* Session scope banner — always shown when a session is configured */}
          {preview.academicSession ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Only students actively enrolled in{" "}
                <strong>{preview.academicSession}</strong> will be promoted to{" "}
                <strong>{preview.nextSession}</strong>.
              </AlertDescription>
            </Alert>
          ) : null}

          {/* No session configured warning */}
          {!preview.academicSession && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Active Session</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4 flex-wrap mt-1">
                <span>No active academic session is configured. Set one before running a migration.</span>
                <Link
                  to="/settings/general"
                  className="shrink-0 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-2 hover:no-underline"
                  onClick={() => onOpenChange(false)}
                >
                  Go to Settings →
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Drift / reconciliation warning */}
          {(preview.reconciliationNeeded ?? 0) > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 text-sm text-red-800">
                  <strong>{preview.reconciliationNeeded} student record(s) need reconciliation.</strong>
                  <p className="mt-1">
                    Their stored class assignment disagrees with their enrollment history.
                    Promotion will silently skip these students until they are repaired.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReconcile}
                  disabled={reconciling}
                  className="shrink-0"
                >
                  {reconciling ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Repairing…
                    </>
                  ) : (
                    <>
                      <Wrench className="h-3.5 w-3.5 mr-1.5" />
                      Reconcile Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* No-next-class warning (config issue, distinct from "repeating") */}
          {(preview.summary.noNextClassCount ?? 0) > 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <strong>
                    {preview.summary.noNextClassCount} student(s) cannot be promoted.
                  </strong>{" "}
                  Their class has no next class configured. Set a next class on those classes,
                  or mark them as final classes (graduation), then re-run the migration.
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-1 text-blue-600" />
              <div className="text-2xl font-bold text-blue-600">
                {preview.summary.totalStudents}
              </div>
              <div className="text-xs text-blue-600">Total Students</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <TrendingUp className="h-6 w-6 mx-auto mb-1 text-green-600" />
              <div className="text-2xl font-bold text-green-600">
                {preview.summary.promotedCount}
              </div>
              <div className="text-xs text-green-600">Promoted</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <GraduationCap className="h-6 w-6 mx-auto mb-1 text-purple-600" />
              <div className="text-2xl font-bold text-purple-600">
                {preview.summary.graduatedCount}
              </div>
              <div className="text-xs text-purple-600">Graduated</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <AlertTriangle className="h-6 w-6 mx-auto mb-1 text-amber-600" />
              <div className="text-2xl font-bold text-amber-600">
                {preview.summary.repeatingCount}
              </div>
              <div className="text-xs text-amber-600">Repeating</div>
            </div>
          </div>

          <Separator />

          {/* Migration Details */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Migration Details
            </h4>
            <div className="space-y-2">
              {preview.migrations.map((migration, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    {migration.isGraduation ? (
                      <GraduationCap className="h-4 w-4 text-purple-600" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    )}
                    <div>
                      <div className="font-medium">
                        {migration.isGraduation ? (
                          <span className="text-purple-600">
                            🎓 {migration.fromClass} → Graduated
                          </span>
                        ) : (
                          <span className="text-green-600">
                            {migration.fromClass} → {migration.toClass}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge 
                    variant={migration.isGraduation ? "secondary" : "default"}
                    className="min-w-[60px] justify-center"
                  >
                    {migration.studentCount} students
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Class-level promotion breakdown (grade level aware) */}
          {classPreview.length > 0 && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Class Breakdown
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {classPreview
                    .filter((item) => item.studentsToPromote > 0)
                    .map((item) => (
                      <div key={item.class.id} className="rounded-md border p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {item.isFinalClass ? (
                              <GraduationCap className="h-4 w-4 text-purple-600 shrink-0" />
                            ) : (
                              <TrendingUp className="h-4 w-4 text-green-600 shrink-0" />
                            )}
                            <span className="font-medium text-sm">
                              {item.class.name}
                            </span>
                            {item.isFinalClass ? (
                              <Badge variant="secondary" className="text-xs">Graduating</Badge>
                            ) : item.nextClass ? (
                              <span className="text-xs text-muted-foreground">
                                → {item.nextClass.name}
                              </span>
                            ) : null}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {item.studentsToPromote} student{item.studentsToPromote !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Important Notice */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <strong>Important:</strong> This action cannot be undone. Students will be moved to their 
                next academic session and class assignments will be updated permanently. Capacity constraints 
                have been disabled for this migration.
              </div>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={confirming || reconciling || (preview.reconciliationNeeded ?? 0) > 0 || !preview.academicSession}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {confirming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Migrating...
              </>
            ) : (
              "Confirm Migration"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
