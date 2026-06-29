import { useState, useEffect } from "react";
import { useFeeStructure } from "@/hooks/useFeeStructure";
import { useFeeRules } from "@/hooks/useFeeRules";
import { SettingsCardSkeleton } from "./SettingsCardSkeleton";
import { FeeRulesPanel } from "./FeeRulesPanel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, GraduationCap, HelpCircle, Info, Loader2, Percent, Receipt, Save, Settings2 } from "lucide-react";
import { api } from "@/api/api";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Settings } from "@/types/dashboard";

export function FeeStructureTab() {
  const feeRules = useFeeRules();
  const { user } = useAuth();
  const { toast } = useToast();

  const { structure, loading, saving, saveStructure, updateBillingCycle } = useFeeStructure();

  const [prorationEnabled, setProrationEnabled] = useState(false);
  const [savedProrationEnabled, setSavedProrationEnabled] = useState(false);
  const [prorationLoading, setProrationLoading] = useState(true);
  const [prorationSaving, setProrationSaving] = useState(false);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("fee-structure-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("fee-structure-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };

  const canEdit = user?.role === 'super_admin' || user?.role === 'admin';

  useEffect(() => {
    api.getSettings()
      .then((s: Settings) => {
        const enabled = s.chargeProrationEnabled ?? false;
        setProrationEnabled(enabled);
        setSavedProrationEnabled(enabled);
      })
      .finally(() => setProrationLoading(false));
  }, []);

  const handleSaveProration = async () => {
    setProrationSaving(true);
    try {
      await api.saveSettings({ chargeProrationEnabled: prorationEnabled });
      setSavedProrationEnabled(prorationEnabled);
      toast({ title: "Saved", description: "Billiing proration setting updated." });
    } catch {
      toast({ title: "Error", description: "Failed to save setting.", variant: "destructive" });
    } finally {
      setProrationSaving(false);
    }
  };

  if (loading || prorationLoading) {
    return (
      <div className="space-y-6">
        <SettingsCardSkeleton rows={4} />
        <SettingsCardSkeleton rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)}>
          <HelpCircle className="h-4 w-4 mr-2" />
          Tuition Structure guide
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-transparent px-6 py-5">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Billing Configuration</CardTitle>
                  <CardDescription className="mt-1">
                    Configure how and when charges are generated for students
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
              {/* Billing Cycle */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-1.5">
                    <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Billing Cycle</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Choose how recurring charges are calculated and generated
                    </p>
                  </div>
                </div>

                <RadioGroup
                  value={structure?.structureType ?? 'termly'}
                  onValueChange={(value) => updateBillingCycle(value as 'termly' | 'monthly')}
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  <label
                    htmlFor="cycle-termly"
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                      structure?.structureType === 'termly'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value="termly" id="cycle-termly" className="mt-0.5" />
                    <div className="flex-1">
                      <span className="text-sm font-semibold block">Termly</span>
                      <span className="text-xs text-muted-foreground mt-1 block">
                        Bill students per academic term. Best for schools with clear term boundaries.
                      </span>
                    </div>
                  </label>
                  <label
                    htmlFor="cycle-monthly"
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
                      structure?.structureType === 'monthly'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value="monthly" id="cycle-monthly" className="mt-0.5" />
                    <div className="flex-1">
                      <span className="text-sm font-semibold block">Monthly</span>
                      <span className="text-xs text-muted-foreground mt-1 block">
                        Bill students per calendar month. Better for continuous enrollment.
                      </span>
                    </div>
                  </label>
                </RadioGroup>

                {canEdit && (
                  <div className="flex justify-end pt-2">
                    <Button size="sm" onClick={saveStructure} disabled={saving} className="gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Cycle
                    </Button>
                  </div>
                )}
              </div>

              <div className="h-px bg-border" />

              {/* Charge Proration */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-1.5">
                    <Percent className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Charge Proration</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Automatically calculate partial charges for mid-period enrollments
                    </p>
                  </div>
                </div>

                <div className={`rounded-xl border p-4 transition-colors ${prorationEnabled ? 'bg-amber-50/50 dark:bg-amber-950/10 border-amber-200 dark:border-amber-900/30' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 pr-4">
                      <Label className="text-sm font-medium">
                        {prorationEnabled ? 'Proration Enabled' : 'Enable charge proration'}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Applies to fee-rule charges and transport charges based on enrollment/allocation dates.
                      </p>
                    </div>
                    <Switch
                      checked={prorationEnabled}
                      onCheckedChange={setProrationEnabled}
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                {prorationEnabled !== savedProrationEnabled && (
                  <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                      You have unsaved changes. Click Save to apply the new proration setting.
                    </AlertDescription>
                  </Alert>
                )}

                {!canEdit && (
                  <p className="text-xs text-muted-foreground">Only administrators can update this setting.</p>
                )}

                {canEdit && (
                  <div className="flex justify-end pt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveProration}
                      disabled={prorationSaving || prorationEnabled === savedProrationEnabled}
                      className="gap-2"
                    >
                      {prorationSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Save Proration
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <FeeRulesPanel feeRules={feeRules} />
        </div>

        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-b px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="rounded-lg bg-blue-200 dark:bg-blue-800 p-1.5">
                  <Info className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                </div>
                Quick Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {[
                ["Billing Cycle", "Termly works best for traditional school calendars. Monthly offers more flexibility for rolling admissions."],
                ["Proration", "When enabled, students joining mid-term pay only for remaining days. Disabling charges full amounts regardless of start date."],
                ["Tuition Rules", "Create rules with specific scopes. School-wide rules apply to everyone; class rules target specific groups."],
              ].map(([title, detail], i, arr) => (
                <div key={title} className={`px-5 py-3 ${i !== arr.length - 1 ? 'border-b' : ''} hover:bg-muted/30 transition-colors`}>
                  <p className="text-sm font-medium text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-300 text-sm">
              Transport charge rules can be configured on the <strong>Transport</strong> page.
            </AlertDescription>
          </Alert>
        </div>
      </div>

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Getting Started with Tuition Structure
            </DialogTitle>
            <DialogDescription>
              A quick guide to billing configuration and tuition rules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "Billing Cycle", "Choose Termly or Monthly to match your school's calendar. This controls how recurring charges are grouped when you generate them.", CalendarDays],
              ["2", "Tuition Rules", "Create rules with an amount and scope them to specific classes or the entire school. Activate the ones you want to charge; inactive rules are ignored during generation.", Settings2],
              ["3", "Charge Proration", "Enable proration so students who enrol mid-term receive a partial charge based on the remaining days. This also applies to mid-month transport assignments.", Percent],
              ["4", "Transport Charges", "Route allocations and stop assignments are configured on the Transport page. Once set up, transport charges can be generated here for any selected month.", Receipt],
              ["5", "Generating Charges", "After confirming your active rules and allocations, select a billing period and click \"Generate charges\". Each eligible student will receive a ledger entry automatically.", Receipt],
            ].map(([step, title, detail, Icon]) => (
              <div key={step} className="flex items-start gap-3 border-b py-2.5 last:border-0">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                  {step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold">{title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="fee-dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="fee-dont-show-again" className="text-sm cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
            <Button onClick={handleDismissOnboarding}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
