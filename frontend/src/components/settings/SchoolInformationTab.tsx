import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Info } from "lucide-react";
import { SettingsCardSkeleton } from "./SettingsCardSkeleton";
import { SchoolInfoForm } from "./SchoolInfoForm";
import { useSettingsForm } from "./useSettingsForm";

export function SchoolInformationTab() {
  const { settings, setSettings, loading, saving, hasUnsavedChanges, loadData, handleSave } = useSettingsForm();

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
    </div>
  );
}
