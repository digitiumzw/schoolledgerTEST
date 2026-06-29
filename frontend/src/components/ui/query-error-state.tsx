import { CircleAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QueryErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function QueryErrorState({
  title = 'Failed to load data',
  description = 'Something went wrong. Please check your connection and try again.',
  onRetry,
  className,
}: QueryErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-14 text-center space-y-3',
        className,
      )}
    >
      <div className="rounded-full bg-destructive/10 p-3">
        <CircleAlert className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}
