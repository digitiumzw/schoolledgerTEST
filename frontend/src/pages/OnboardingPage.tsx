/**
 * Onboarding wizard page — orchestrates the 6-step admin onboarding flow.
 *
 * Pre-fills the school name and admin email (read-only banner). Resumes from
 * the persisted current_step on mount. On completion, refreshes the auth
 * context so the dashboard guard releases and navigates to /.
 *
 * Feature: 043-school-creation-onboarding
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, GraduationCap, Mail, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useOnboardingProgress,
  useCompleteOnboarding,
  ONBOARDING_STEPS,
  STEP_LABELS,
  type OnboardingStep,
} from '@/hooks/useOnboarding';
import { StepPasswordChange } from '@/components/onboarding/StepPasswordChange';
import { StepAdminProfile } from '@/components/onboarding/StepAdminProfile';
import { StepContactDetails } from '@/components/onboarding/StepContactDetails';
import { StepWorkHours } from '@/components/onboarding/StepWorkHours';
import { StepAcademicCalendar } from '@/components/onboarding/StepAcademicCalendar';
import { api } from '@/api/api';
import { toast } from 'sonner';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const progressQ = useOnboardingProgress();
  const completeOnboarding = useCompleteOnboarding();
  const [activeStep, setActiveStep] = useState<OnboardingStep | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (progressQ.data) {
      const current = (progressQ.data.current_step as OnboardingStep) ?? 'password';
      setActiveStep(current);
      setCompleted(new Set(progressQ.data.completed_steps ?? []));
    }
  }, [progressQ.data]);

  function advanceFrom(step: OnboardingStep) {
    setCompleted((prev) => new Set(prev).add(step));
    const idx = ONBOARDING_STEPS.indexOf(step);
    const next = ONBOARDING_STEPS[idx + 1];
    if (next) setActiveStep(next);
  }

  async function handleComplete(subscription: { plan_name: string; expires_at: string }) {
    toast.success(
      `Your school is now active on the ${subscription.plan_name} trial — valid until ${subscription.expires_at.slice(0, 10)}.`
    );
    // Refresh the cached auth user so onboardingComplete flips to true and
    // ProtectedRoute releases the dashboard.
    try {
      const fresh = await api.getCurrentUser();
      localStorage.setItem('school_management_auth', JSON.stringify(fresh));
    } catch { /* ignored — page reload below restores session anyway */ }
    // Hard navigate so all queries re-fetch with the fresh user state.
    window.location.href = '/';
  }

  async function completeAfterAcademicCalendar() {
    try {
      const result = await completeOnboarding.mutateAsync();
      handleComplete(result.subscription);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete onboarding.');
    }
  }

  if (progressQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Loading your onboarding…</p>
        </div>
      </div>
    );
  }

  if (progressQ.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="max-w-md p-6 text-center">
          <p className="text-sm text-destructive">
            Failed to load onboarding progress. Please refresh or sign in again.
          </p>
          <Button variant="outline" className="mt-4" onClick={logout}>Sign out</Button>
        </Card>
      </div>
    );
  }

  const data = progressQ.data;
  if (!data || !activeStep) return null;

  const stepData = data.step_data ?? {};

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">SchoolLedger Setup</span>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[260px_1fr]">
        {/* Sidebar — step list */}
        <aside>
          <Card className="p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Setup steps
            </p>
            <ol className="space-y-1">
              {ONBOARDING_STEPS.map((step, i) => {
                const isDone   = completed.has(step);
                const isActive = step === activeStep;
                return (
                  <li key={step}>
                    <button
                      type="button"
                      // Allow jumping to completed steps and the current one
                      disabled={!isDone && !isActive}
                      onClick={() => isDone && setActiveStep(step)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                        isActive
                          ? 'bg-primary/10 font-medium text-primary'
                          : isDone
                            ? 'text-foreground hover:bg-muted'
                            : 'cursor-default text-muted-foreground'
                      }`}
                    >
                      {isDone
                        ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                        : <Circle className="h-4 w-4" />}
                      <span className="flex-1">{i + 1}. {STEP_LABELS[step]}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Card>
        </aside>

        {/* Main panel */}
        <main className="space-y-4">
          {/* Pre-filled banner */}
          <Card className="bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-primary" />
              <div className="text-sm">
                <p className="font-medium">{data.school_name || 'Your school'}</p>
                <p className="text-muted-foreground">
                  Admin email: {data.admin_email}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  School name and admin email were captured during account creation and cannot be edited here.
                </p>
              </div>
            </div>
          </Card>

          {/* Active step body */}
          <Card className="p-6">
            {activeStep === 'password' && (
              <StepPasswordChange onAdvance={() => advanceFrom('password')} />
            )}
            {activeStep === 'profile' && (
              <StepAdminProfile initial={stepData.profile} onAdvance={() => advanceFrom('profile')} />
            )}
            {activeStep === 'contact' && (
              <StepContactDetails initial={stepData.contact} onAdvance={() => advanceFrom('contact')} />
            )}
            {activeStep === 'work-hours' && (
              <StepWorkHours initial={stepData['work-hours']} onAdvance={() => advanceFrom('work-hours')} />
            )}
            {activeStep === 'academic-calendar' && (
              <StepAcademicCalendar
                initial={stepData['academic-calendar']}
                onAdvance={completeAfterAcademicCalendar}
              />
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}
