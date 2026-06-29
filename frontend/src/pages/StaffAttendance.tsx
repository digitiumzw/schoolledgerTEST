import { useEffect, useState } from "react";
import { SubscriptionGuard } from "@/components/subscription/SubscriptionGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Calendar, ClipboardList, BarChart2, Users, GraduationCap, HelpCircle } from "lucide-react";
import DailyAttendanceTab from "@/components/staff-attendance/DailyAttendanceTab";
import AttendanceRecordsTab from "@/components/staff-attendance/AttendanceRecordsTab";
import MonthlySummaryTab from "@/components/staff-attendance/MonthlySummaryTab";
import LeaveManagementTab from "@/components/staff-attendance/LeaveManagementTab";
import { AttendancePeriodReport } from "@/components/staff-attendance/AttendancePeriodReport";
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
import { Button } from "@/components/ui/button";
import ContextualHelpLink from "@/components/help/ContextualHelpLink";

export default function StaffAttendance() {
  const [activeTab, setActiveTab] = useState("daily");

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("staff-attendance-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("staff-attendance-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };

  return (
    <SubscriptionGuard>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Staff Attendance</h1>
          <p className="text-muted-foreground">
            Manage staff check-in/check-out times and leave requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ContextualHelpLink sectionId="reports-analytics" label="Attendance Reports Help" />
          <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)} className="hidden sm:flex">
            <HelpCircle className="h-4 w-4 mr-2" />
            Attendance guide
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="w-full overflow-x-auto pb-0.5">
          <TabsList className="flex flex-nowrap w-max sm:w-full sm:grid sm:grid-cols-5">
            <TabsTrigger value="daily" className="flex items-center gap-1.5 whitespace-nowrap">
              <Clock className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Daily Attendance</span>
              <span className="sm:hidden">Daily</span>
            </TabsTrigger>
            <TabsTrigger value="records" className="flex items-center gap-1.5 whitespace-nowrap">
              <ClipboardList className="h-4 w-4 shrink-0" />
              Records
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex items-center gap-1.5 whitespace-nowrap">
              <Users className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Monthly Summary</span>
              <span className="sm:hidden">Monthly</span>
            </TabsTrigger>
            <TabsTrigger value="leave" className="flex items-center gap-1.5 whitespace-nowrap">
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Leave Management</span>
              <span className="sm:hidden">Leave</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1.5 whitespace-nowrap">
              <BarChart2 className="h-4 w-4 shrink-0" />
              Reports
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="daily">
          <DailyAttendanceTab />
        </TabsContent>

        <TabsContent value="records">
          <AttendanceRecordsTab />
        </TabsContent>

        <TabsContent value="monthly">
          <MonthlySummaryTab />
        </TabsContent>

        <TabsContent value="leave">
          <LeaveManagementTab />
        </TabsContent>

        <TabsContent value="reports">
          <AttendancePeriodReport />
        </TabsContent>
      </Tabs>

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Getting Started with Staff Attendance
            </DialogTitle>
            <DialogDescription>
              How to track staff presence, hours, and leave.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "Daily Attendance", "Record check-in and check-out events for each staff member. The system auto-classifies status as present, late, half-day, or early departure based on configured working hours.", Clock],
              ["2", "Records", "View the full attendance log with filters by staff, department, date range, and status. Use this to verify entries or investigate patterns.", ClipboardList],
              ["3", "Monthly Summary", "See aggregated metrics per staff member including days present, late arrivals, on-leave days, half-days, and overtime hours for any month.", Users],
              ["4", "Leave Management", "Submit, review, and approve leave requests. Approved leave auto-creates attendance events for working days and can be cancelled if plans change.", Calendar],
              ["5", "Reports", "Generate period and department reports with attendance rates, working-day denominators, and late-arrival counts. Holidays are excluded from working-day totals.", BarChart2],
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
                id="sa-dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="sa-dont-show-again" className="text-sm cursor-pointer">
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
}
