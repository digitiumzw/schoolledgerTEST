import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Info } from "lucide-react";
import { SettingsCardSkeleton } from "./SettingsCardSkeleton";
import { KioskModeCard } from "./KioskModeCard";
import { useSettingsForm } from "./useSettingsForm";

export function KioskSettingsTab() {
  const { settings, setSettings, loading, saving, hasUnsavedChanges, handleSave } = useSettingsForm();

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsCardSkeleton rows={4} />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {hasUnsavedChanges && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            You have unsaved changes. Click Save.
          </AlertDescription>
        </Alert>
      )}

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
