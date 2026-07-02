import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, X, ArrowRight, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDismissSetupGuide, useUpdateSetupGuideStep } from '@/hooks/useSetupGuide';
import type { SetupGuideResponse, SetupGuideStep } from '@/types/dashboard';
import { toast } from 'sonner';

interface Props {
  guide: SetupGuideResponse;
}

export function SetupGuideCard({ guide }: Props) {
  const navigate = useNavigate();
  const updateStep = useUpdateSetupGuideStep();
  const dismiss = useDismissSetupGuide();

  if (guide.dismissed || guide.completed) {
    return null;
  }

  const activeStep = guide.steps.find((step) => step.status === 'active') ?? guide.steps.find((step) => step.key === guide.current_step);
  const completedCount = guide.steps.filter((step) => step.status === 'completed' || step.status === 'skipped').length;
  const progressPercent = Math.round((completedCount / guide.steps.length) * 100);

  async function markCompleted(step: SetupGuideStep) {
    try {
      await updateStep.mutateAsync({ stepKey: step.key, status: 'completed' });
      toast.success(`${step.label} marked complete.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update setup guide.');
    }
  }

  async function skipStep(step: SetupGuideStep) {
    try {
      await updateStep.mutateAsync({ stepKey: step.key, status: 'skipped' });
      toast.success(`${step.label} skipped.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not skip setup step.');
    }
  }

  async function dismissGuide() {
    try {
      await dismiss.mutateAsync();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not dismiss setup guide.');
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="flex-1">
          <CardTitle>Recommended setup guide</CardTitle>
          <CardDescription>
            Follow these steps after onboarding so your school is ready for daily operations and billing.
            Complete them in order — each step builds on the previous one.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={dismissGuide} disabled={dismiss.isPending} className="shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {completedCount}/{guide.steps.length} done
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {guide.steps.map((step, index) => {
            const done = step.status === 'completed' || step.status === 'skipped';
            const active = step.status === 'active';
            return (
              <div key={step.key} className={`rounded-lg border bg-background p-3 ${active ? 'border-primary shadow-sm' : ''}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
                    <span>{index + 1}. {step.label}</span>
                  </div>
                  {step.optional && <Badge variant="outline">Optional</Badge>}
                </div>
                <p className="min-h-[60px] text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant={active ? 'default' : 'outline'} onClick={() => navigate(step.route)}>
                    Open <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                  {!done && (
                    <Button size="sm" variant="outline" onClick={() => markCompleted(step)} disabled={updateStep.isPending}>
                      Done
                    </Button>
                  )}
                  {!done && step.optional && (
                    <Button size="sm" variant="ghost" onClick={() => skipStep(step)} disabled={updateStep.isPending}>
                      <SkipForward className="mr-1 h-3 w-3" /> Skip
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {activeStep && (
          <div className="rounded-md border bg-background p-3 text-sm">
            <span className="text-muted-foreground">Next recommended action: </span>
            <span className="font-medium">{activeStep.label}</span>
            <Button size="sm" variant="link" className="ml-2 h-auto p-0" onClick={() => navigate(activeStep.route)}>
              Go now <ArrowRight className="ml-0.5 h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
