import { useEffect, useState } from "react";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import ClassAttendanceTab from "@/components/attendance/ClassAttendanceTab";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { GraduationCap, HelpCircle, Calendar, Users, ClipboardList, BarChart3, BookOpen } from "lucide-react";

const Attendance = () => {
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("class-attendance-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("class-attendance-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };

  return (
    <SubscriptionGuard>
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)}>
            <HelpCircle className="h-4 w-4 mr-2" />
            Class Attendance guide
          </Button>
        </div>

        <ClassAttendanceTab />

        <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Getting Started with Class Attendance
              </DialogTitle>
              <DialogDescription>
                How to record and review attendance for your classes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              {[
                ["1", "Daily Register", "Select a date and class instance to mark each student as present, late, absent, or excused. Corrections override prior entries and cascade automatically.", ClipboardList],
                ["2", "Class Instances", "Classes are linked to academic sessions and instances. Make sure your active session is configured so the right class roster appears each day.", BookOpen],
                ["3", "Student View", "See a per-student summary of total days, late arrivals, and attendance rate. This helps identify students who need intervention.", Users],
                ["4", "Class Summary", "Review aggregated attendance stats per class — total sessions, average presence, and late counts — for quick overview of class behaviour.", BarChart3],
                ["5", "Audit Trail", "Every attendance change is logged with timestamps. Use the audit log to verify who changed what and when, ensuring data integrity.", Calendar],
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
                  id="ca-dont-show-again"
                  checked={dontShowAgain}
                  onCheckedChange={(checked) => setDontShowAgain(checked === true)}
                />
                <Label htmlFor="ca-dont-show-again" className="text-sm cursor-pointer">
                  Don&apos;t show this again
                </Label>
              </div>
              <Button onClick={handleDismissOnboarding}>Got it</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SubscriptionGuard>
  );
};

export default Attendance;
