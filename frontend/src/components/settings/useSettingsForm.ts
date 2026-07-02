import { useState, useEffect, useCallback } from "react";
import { api } from "@/api/api";
import { Settings, AcademicCalendar, Term } from "@/types/dashboard";
import { getCurrentTerm } from "@/utils/academicCalendar";
import { useToast } from "@/hooks/use-toast";

export interface UseSettingsFormResult {
  settings: Settings | null;
  setSettings: (settings: Settings) => void;
  calendar: AcademicCalendar | null;
  currentTerm: Term | null;
  loading: boolean;
  saving: boolean;
  hasUnsavedChanges: boolean;
  loadData: () => Promise<void>;
  handleSave: () => Promise<void>;
}

export function useSettingsForm(): UseSettingsFormResult {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<Settings | null>(null);
  const [calendar, setCalendar] = useState<AcademicCalendar | null>(null);
  const [currentTerm, setCurrentTerm] = useState<Term | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const hasUnsavedChanges =
    !!settings && !!originalSettings && JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsData, calendarData] = await Promise.all([
        api.getSettings(),
        api.getCalendar(),
      ]);
      setSettings(settingsData);
      setOriginalSettings(JSON.parse(JSON.stringify(settingsData)));
      setCalendar(calendarData);
      setCurrentTerm(getCurrentTerm(calendarData));
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = useCallback(async () => {
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
  }, [settings, toast]);

  return {
    settings,
    setSettings,
    calendar,
    currentTerm,
    loading,
    saving,
    hasUnsavedChanges,
    loadData,
    handleSave,
  };
}
