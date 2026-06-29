import { useState, useEffect, useMemo } from "react";
import { api } from "@/api/api";
import { Settings, AcademicCalendar, Term } from "@/types/dashboard";
import { getCurrentTerm, getRecommendedSession } from "@/utils/academicCalendar";
import { useCalendarValidation } from "@/hooks/useCalendarValidation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle, Calendar, Info } from "lucide-react";
import { SettingsCardSkeleton } from "./SettingsCardSkeleton";
import { SchoolInfoForm } from "./SchoolInfoForm";
import { WorkHoursEditor } from "./WorkHoursEditor";
import { AcademicCalendarInfo } from "./AcademicCalendarInfo";
import { KioskModeCard } from "./KioskModeCard";

export function GeneralSettingsTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<Settings | null>(null);
  const [calendar, setCalendar] = useState<AcademicCalendar | null>(null);
  const [currentTerm, setCurrentTerm] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showNewYearAlert, setShowNewYearAlert] = useState(false);
  const { toast } = useToast();

  const systemAcademicYear = useMemo(() => new Date().getFullYear().toString(), []);
  const recommendedSession = useMemo(() => getRecommendedSession(), []);

  const calendarValidation = useCalendarValidation(calendar);
  const hasUnsavedChanges = !!settings && !!originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (calendarValidation.isNewYearDetected && !showNewYearAlert) {
      setShowNewYearAlert(true);
    }
  }, [calendarValidation.isNewYearDetected]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [settingsData, calendarData] = await Promise.all([
        api.getSettings(),
        api.getCalendar()
      ]);
      setSettings(settingsData);
      setOriginalSettings(JSON.parse(JSON.stringify(settingsData)));
      setCalendar(calendarData);
      setCurrentTerm(getCurrentTerm(calendarData));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    if (!settings.schoolName || !settings.contactEmail || !settings.contactPhone) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(settings.contactEmail)) {
      toast({ title: "Validation Error", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    if (settings.staffWorkHours && settings.staffWorkHours.startTime >= settings.staffWorkHours.endTime) {
      toast({ title: "Validation Error", description: "Staff start time must be before end time.", variant: "destructive" });
      return;
    }

    if (settings.studentWorkHours && settings.studentWorkHours.startTime >= settings.studentWorkHours.endTime) {
      toast({ title: "Validation Error", description: "Student start time must be before end time.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      await api.saveSettings(settings);
      setOriginalSettings(JSON.parse(JSON.stringify(settings)));
      window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: settings }));
      toast({ title: "Success", description: "Settings saved successfully!" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCardSkeleton rows={5} />
        <SettingsCardSkeleton rows={3} />
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
          <CardTitle>School Information</CardTitle>
          <CardDescription>
            Basic profile details for your school.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <SchoolInfoForm
            settings={settings}
            onSettingsChange={setSettings}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Kiosk Settings</CardTitle>
          <CardDescription>
            Enable shared-device kiosks for staff, students, and drivers.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="divide-y">
            <KioskModeCard
              title="Staff Attendance Kiosk"
              description="Sign-in/out screen for staff attendance on a shared tablet or computer."
              enabled={!!settings.kioskModeEnabled}
              onToggle={(enabled) => setSettings({ ...settings, kioskModeEnabled: enabled })}
              kioskCode={settings.kioskCode}
              urlPath=""
              qrFilename="staff-kiosk-qr.png"
              enableLabel="Enable Kiosk Mode"
              enableDescription="When enabled, staff can sign in and out from a dedicated kiosk page without logging in."
              urlLabel="Kiosk URL"
              qrLabel="QR Code"
              copySuccessMessage="Kiosk URL copied to clipboard."
              saving={saving}
              onSave={handleSave}
            />
            <KioskModeCard
              title="Student Attendance Kiosk"
              description="Shared tablet for teachers to mark student attendance without logging in."
              enabled={!!settings.studentKioskModeEnabled}
              onToggle={(enabled) => setSettings({ ...settings, studentKioskModeEnabled: enabled })}
              kioskCode={settings.kioskCode}
              urlPath="/students"
              qrFilename="student-kiosk-qr.png"
              enableLabel="Enable Student Attendance Kiosk"
              enableDescription="When enabled, teachers can select a class and mark student attendance using their Employee ID."
              urlLabel="Student Kiosk URL"
              qrLabel="QR Code"
              copySuccessMessage="Student kiosk URL copied to clipboard."
              saving={saving}
              onSave={handleSave}
            />
            <KioskModeCard
              title="Driver Kiosk"
              description="Shared terminal for drivers to view their route roster without logging in."
              enabled={!!settings.driverKioskModeEnabled}
              onToggle={(enabled) => setSettings({ ...settings, driverKioskModeEnabled: enabled })}
              kioskCode={settings.kioskCode}
              urlPath="/driver"
              qrFilename="driver-kiosk-qr.png"
              enableLabel="Enable Driver Kiosk"
              enableDescription="When enabled, drivers can select their route and view the student roster using their Employee ID."
              urlLabel="Driver Kiosk URL"
              qrLabel="QR Code"
              copySuccessMessage="Driver kiosk URL copied to clipboard."
              saving={saving}
              onSave={handleSave}
            />
          </div>
          <div className="flex justify-end pt-3 mt-1 border-t">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Save Kiosk Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
