import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, HelpCircle, X } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              <Badge variant="outline">Step {index + 1} of {modules.length}</Badge>
            </div>
            <CardTitle>{current.module_name}</CardTitle>
            <CardDescription>{current.summary}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={dismiss} disabled={updateProgress.isPending}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 text-sm font-semibold">What this module contains</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {current.contains.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border p-4">
              <h3 className="mb-2 text-sm font-semibold">What you can do here</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {current.primary_actions.map((item) => (
                  <li key={item} className="flex gap-2">
                    <ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" onClick={() => navigate(current.route)}>
              Open {current.module_name}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={dismiss} disabled={updateProgress.isPending}>Skip tutorial</Button>
              <Button onClick={next} disabled={updateProgress.isPending}>
                {index < modules.length - 1 ? 'Next module' : 'Finish tutorial'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
