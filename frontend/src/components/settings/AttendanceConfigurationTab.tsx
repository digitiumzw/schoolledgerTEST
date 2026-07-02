import { useState, useEffect, useMemo } from "react";
import { getRecommendedSession } from "@/utils/academicCalendar";
import { useCalendarValidation } from "@/hooks/useCalendarValidation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertTriangle, Calendar, Info } from "lucide-react";
import { SettingsCardSkeleton } from "./SettingsCardSkeleton";
import { WorkHoursEditor } from "./WorkHoursEditor";
import { AcademicCalendarInfo } from "./AcademicCalendarInfo";
import { useSettingsForm } from "./useSettingsForm";

export function AttendanceConfigurationTab() {
  const { settings, setSettings, calendar, currentTerm, loading, saving, hasUnsavedChanges, loadData, handleSave } =
    useSettingsForm();
  const [showNewYearAlert, setShowNewYearAlert] = useState(false);

  const systemAcademicYear = useMemo(() => new Date().getFullYear().toString(), []);
  const recommendedSession = useMemo(() => getRecommendedSession(), []);
  const calendarValidation = useCalendarValidation(calendar);

  useEffect(() => {
    if (calendarValidation.isNewYearDetected && !showNewYearAlert) {
      setShowNewYearAlert(true);
    }
  }, [calendarValidation.isNewYearDetected, showNewYearAlert]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCardSkeleton rows={5} />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* No Session Configured Alert */}
      {!settings.activeAcademicSession && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>No Academic Session Configured</AlertTitle>
          <AlertDescription>
            No active academic session has been set. Student promotion and class migration require a session.
            Go to Settings → Academic Calendar to configure the active session.
          </AlertDescription>
        </Alert>
      )}

      {/* Calendar Validation Alerts */}
      {calendarValidation.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Calendar Configuration Error</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              {calendarValidation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
            <p className="mt-2 font-medium">
              Please go to Settings → Academic Calendar to fix these issues.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* New Year Detection Alert */}
      {showNewYearAlert && calendarValidation.isNewYearDetected && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <Calendar className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">
            New Calendar Year Detected
          </AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            <p>
              Your academic calendar shows term dates from {calendarValidation.lastTermYear}, 
              but we're now in {new Date().getFullYear()}.
            </p>
            <p className="mt-2 font-medium">
              Please update your term dates in Settings → Academic Calendar to reflect the new academic year.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3 border-amber-500 text-amber-700 hover:bg-amber-100"
              onClick={() => setShowNewYearAlert(false)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Outside all terms alert */}
      {calendarValidation.isOutsideAllTerms && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200">Current Date Is Outside All Configured Terms</AlertTitle>
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            Today's date does not fall within any of the configured terms. You may be in a holiday or inter-term break period. Go to Settings → Academic Calendar to update term dates if this is unexpected.
          </AlertDescription>
        </Alert>
      )}

      {/* Warnings (non-critical) */}
      {calendarValidation.warnings.length > 0 && !calendarValidation.isNewYearDetected && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Calendar Notice</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 space-y-1">
              {calendarValidation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {hasUnsavedChanges && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            You have unsaved changes. Click Save.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Attendance Configuration</CardTitle>
          <CardDescription>
            Calendar context and work hour boundaries used for attendance tracking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <AcademicCalendarInfo
            systemAcademicYear={systemAcademicYear}
            activeAcademicSession={settings.activeAcademicSession}
            recommendedSession={recommendedSession}
            currentTerm={currentTerm}
          />
          <WorkHoursEditor
            staffWorkHours={settings.staffWorkHours}
            studentWorkHours={settings.studentWorkHours}
            onStaffWorkHoursChange={(hours) => setSettings({ ...settings, staffWorkHours: hours })}
            onStudentWorkHoursChange={(hours) => setSettings({ ...settings, studentWorkHours: hours })}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={loadData} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
