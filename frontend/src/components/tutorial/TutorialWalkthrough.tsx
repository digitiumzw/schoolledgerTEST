import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, HelpCircle, Lightbulb, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUpdateTutorialProgress } from '@/hooks/useTutorial';
import type { TutorialResponse } from '@/types/dashboard';
import { toast } from 'sonner';

interface Props {
  tutorial: TutorialResponse;
  forceOpen?: boolean;
  onClose?: () => void;
}

export function TutorialWalkthrough({ tutorial, forceOpen = false, onClose }: Props) {
  const navigate = useNavigate();
  const updateProgress = useUpdateTutorialProgress();
  const [index, setIndex] = useState(0);
  const isVisible = forceOpen || tutorial.should_show;
  const modules = useMemo(() => [...tutorial.modules].sort((a, b) => a.order - b.order), [tutorial.modules]);
  const current = modules[index];
  const isFirst = index === 0;
  const isLast = index === modules.length - 1;

  if (!isVisible) {
    return null;
  }

  async function update(status: 'in_progress' | 'completed' | 'dismissed', close = false) {
    try {
      await updateProgress.mutateAsync({
        status,
        last_seen_step: current?.module_key ?? null,
        seen_module_keys: current ? modules.slice(0, index + 1).map((module) => module.module_key) : [],
      });
      if (close) onClose?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update tutorial progress.');
    }
  }

  async function next() {
    if (index < modules.length - 1) {
      await update('in_progress');
      setIndex((value) => value + 1);
      return;
    }

    await update('completed', true);
    toast.success('Tutorial completed. You can restart it from the sidebar any time.');
  }

  async function prev() {
    if (index > 0) {
      setIndex((value) => value - 1);
    }
  }

  async function dismiss() {
    await update('dismissed', true);
  }

  if (!current) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Your workspace is ready</CardTitle>
            <CardDescription>No tutorial modules are available for your current access level.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={dismiss}>Close</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progressPercent = Math.round(((index + 1) / modules.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <Badge variant="outline">Step {index + 1} of {modules.length}</Badge>
            </div>
            <CardTitle className="text-xl">{current.module_name}</CardTitle>
            <CardDescription className="mt-1.5 leading-relaxed">{current.summary}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={dismiss} disabled={updateProgress.isPending} className="shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {isFirst && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              Welcome! This quick walkthrough introduces each module of SchoolLedger. You can open any module
              directly from here, navigate with the buttons below, or skip and return later from the sidebar.
            </div>
          )}

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">{progressPercent}%</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-semibold">What you&apos;ll find here</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {current.contains.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-semibold">What you can do</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {current.primary_actions.map((item) => (
                  <li key={item} className="flex gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {current.tips && current.tips.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 dark:border-amber-400/30 dark:bg-amber-400/10">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
                <Lightbulb className="h-4 w-4" />
                Tips
              </h3>
              <ul className="space-y-2 text-sm text-amber-950/90 dark:text-amber-100/90">
                {current.tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="mt-0.5 shrink-0">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => navigate(current.route)}>
              Open {current.module_name}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={dismiss} disabled={updateProgress.isPending}>Skip tutorial</Button>
              {!isFirst && (
                <Button variant="outline" onClick={prev} disabled={updateProgress.isPending}>
                  <ArrowLeft className="mr-1 h-3 w-3" />
                  Back
                </Button>
              )}
              <Button onClick={next} disabled={updateProgress.isPending}>
                {isLast ? 'Finish tutorial' : 'Next'}
                {!isLast && <ArrowRight className="ml-1 h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
