import { useState, useEffect, useMemo } from "react";
import { api } from "@/api/api";
import { AcademicCalendar, Settings, Term } from "@/types/dashboard";
import { getCurrentTerm, getRecommendedSession } from "@/utils/academicCalendar";
import { useCalendarValidation } from "@/hooks/useCalendarValidation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Edit, Loader2, AlertTriangle, Info, Calendar, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TermFormModal } from "@/components/modals/TermFormModal";
import { format } from "date-fns";

const MAX_TERMS = 3;

export function AcademicCalendarTab() {
  const [calendar, setCalendar] = useState<AcademicCalendar | null>(null);
  const [originalCalendar, setOriginalCalendar] = useState<AcademicCalendar | null>(null);
  const [currentTerm, setCurrentTerm] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Active session state
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>("__none__");
  const recommendedSession = useMemo(() => getRecommendedSession(), []);

  // undefined = modal closed, null = add mode, Term = edit mode
  const [modalTerm, setModalTerm] = useState<Term | null | undefined>(undefined);
  const showModal = modalTerm !== undefined;

  const { toast } = useToast();

  useEffect(() => {
    if (calendar && originalCalendar) {
      setHasUnsavedChanges(JSON.stringify(calendar) !== JSON.stringify(originalCalendar));
    }
  }, [calendar, originalCalendar]);

  const calendarValidation = useCalendarValidation(calendar);

  async function loadCalendar() {
    try {
      setLoading(true);
      const [data, settingsData] = await Promise.all([api.getCalendar(), api.getSettings()]);
      setCalendar(data);
      setOriginalCalendar(JSON.parse(JSON.stringify(data)));
      setHasUnsavedChanges(false);
      setCurrentTerm(getCurrentTerm(data));
      setSettings(settingsData);
      setSelectedSession(settingsData.activeAcademicSession ?? recommendedSession);
    } catch {
      toast({ title: "Error", description: "Failed to load calendar.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadCalendar(); }, []);

  const handleSave = async () => {
    if (!calendar) return;
    if (!calendarValidation.isValid) {
      toast({ title: "Validation Error", description: "Please fix the calendar errors before saving.", variant: "destructive" });
      return;
    }
    try {
      setSaving(true);
      await api.saveCalendar(calendar);
      setOriginalCalendar(JSON.parse(JSON.stringify(calendar)));
      setHasUnsavedChanges(false);
      toast({ title: "Success", description: "Calendar saved successfully." });
    } catch (error: unknown) {
      const err = error as Record<string, unknown>;
      const errorData = (err?.errors ?? err?.data ?? null) as Record<string, unknown> | null;
      if (errorData?.errorCode === 'TERM_OVERLAP' && Array.isArray(errorData.overlaps)) {
        toast({ title: "Term Dates Overlap", description: String(errorData.overlaps[0] ?? "Term dates overlap."), variant: "destructive" });
      } else {
        toast({ title: "Error", description: String(err?.message ?? "Failed to save calendar."), variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  };

  function handleTermSaved(term: Term) {
    if (!calendar) return;
    const exists = calendar.terms.some(t => t.id === term.id);
    const updatedTerms = exists
      ? calendar.terms.map(t => (t.id === term.id ? term : t))
      : [...calendar.terms, term];
    const updated = { ...calendar, terms: updatedTerms };
    setCalendar(updated);
    setCurrentTerm(getCurrentTerm(updated));
    setModalTerm(undefined);
  }

  function handleDeleteTerm(id: string) {
    if (!calendar || calendar.terms.length <= 1) return;
    const updated = { ...calendar, terms: calendar.terms.filter(t => t.id !== id) };
    setCalendar(updated);
    setCurrentTerm(getCurrentTerm(updated));
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!calendar) return null;

  const canAddTerm = calendar.terms.length < MAX_TERMS;

  return (
    <>
      <div className="space-y-6">
        {calendarValidation.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Calendar Configuration Errors</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 mt-2 space-y-1">
                {calendarValidation.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
              <p className="mt-2 font-medium">Please fix these issues before saving.</p>
            </AlertDescription>
          </Alert>
        )}

        {calendarValidation.isNewYearDetected && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <Calendar className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">Update Calendar for New Academic Year</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300 space-y-2">
              <p>Your term dates are from a previous year. Please update them for {new Date().getFullYear()}.</p>
              <p className="text-sm font-medium">Click the edit icon next to each term to set new dates.</p>
            </AlertDescription>
          </Alert>
        )}

        {calendarValidation.isOutsideAllTerms && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">Current Date Is Outside All Configured Terms</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              Today's date does not fall within any of the configured terms. You may be in a holiday or inter-term break period. Update term dates if this is unexpected.
            </AlertDescription>
          </Alert>
        )}

        {calendarValidation.warnings.length > 0 && !calendarValidation.isNewYearDetected && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Notice</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4 mt-2 space-y-1">
                {calendarValidation.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {hasUnsavedChanges && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <Info className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 dark:text-amber-200">Unsaved Changes</AlertTitle>
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              You have unsaved changes. Click Save.
            </AlertDescription>
          </Alert>
        )}

        {/* Active Academic Session — read-only compact display */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted/40 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Active Session:</span>
          <Badge variant="outline">
            {selectedSession === "__none__" ? "Not set" : selectedSession}
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Academic Calendar</CardTitle>
                <CardDescription>
                  Manage terms for the current academic year (up to {MAX_TERMS} terms).
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {hasUnsavedChanges && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">Unsaved</Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setModalTerm(null)}
                  disabled={!canAddTerm}
                  title={!canAddTerm ? `Maximum ${MAX_TERMS} terms allowed` : undefined}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add term
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Term</TableHead>
                    <TableHead>Start date</TableHead>
                    <TableHead>End date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calendar.terms.map(term => {
                    const start = new Date(term.start);
                    const end   = new Date(term.end);
                    const days  = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                    const isCurrentTerm = currentTerm?.id === term.id;
                    const hasOverlap = calendarValidation.errors.some(e => e.includes(`"${term.name}"`));

                    return (
                      <TableRow
                        key={term.id}
                        className={
                          hasOverlap    ? 'bg-red-50 dark:bg-red-950/20' :
                          isCurrentTerm ? 'bg-blue-50 dark:bg-blue-950/20' : ''
                        }
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {term.name}
                            {isCurrentTerm && <Badge variant="default" className="text-xs">Current</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>{term.start ? format(start, 'MMM dd, yyyy') : '—'}</TableCell>
                        <TableCell>{term.end   ? format(end,   'MMM dd, yyyy') : '—'}</TableCell>
                        <TableCell>
                          {term.start && term.end && days > 0
                            ? <Badge variant="outline">{days} days</Badge>
                            : <span className="text-muted-foreground text-sm">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setModalTerm(term)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={calendar.terms.length <= 1}
                              onClick={() => handleDeleteTerm(term.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={loadCalendar} disabled={saving}>
                {hasUnsavedChanges ? 'Discard Changes' : 'Refresh'}
              </Button>
              <Button onClick={handleSave} disabled={saving || !calendarValidation.isValid || !hasUnsavedChanges}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Calendar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {showModal && (
        <TermFormModal
          term={modalTerm ?? undefined}
          otherTerms={calendar.terms.filter(t => t.id !== modalTerm?.id)}
          open={showModal}
          onClose={() => setModalTerm(undefined)}
          onSuccess={handleTermSaved}
        />
      )}
    </>
  );
}
