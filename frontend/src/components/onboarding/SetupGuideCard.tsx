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
        <div>
          <CardTitle>Recommended setup guide</CardTitle>
          <CardDescription>
            Follow these steps after onboarding so your school is ready for daily operations and billing.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={dismissGuide} disabled={dismiss.isPending}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {guide.steps.map((step, index) => {
            const done = step.status === 'completed' || step.status === 'skipped';
            const active = step.status === 'active';
            return (
              <div key={step.key} className={`rounded-lg border bg-background p-3 ${active ? 'border-primary shadow-sm' : ''}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {done ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                    <span>{index + 1}. {step.label}</span>
                  </div>
                  {step.optional && <Badge variant="outline">Optional</Badge>}
                </div>
                <p className="min-h-[40px] text-xs text-muted-foreground">{step.description}</p>
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
            Next recommended action: <span className="font-medium">{activeStep.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
