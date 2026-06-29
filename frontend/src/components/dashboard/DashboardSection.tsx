import { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DashboardSectionProps {
  title: string;
  description?: string;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  children: ReactNode;
  skeleton?: ReactNode;
}

export function DashboardSection({
  title,
  description,
  loading,
  error,
  onRetry,
  children,
  skeleton,
}: DashboardSectionProps) {
  return (
    <section aria-labelledby={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}>
      <div className="mb-3 flex flex-col gap-0.5">
        <h3
          id={`section-${title.replace(/\s+/g, "-").toLowerCase()}`}
          className="text-base sm:text-lg font-semibold tracking-tight"
        >
          {title}
        </h3>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load {title.toLowerCase()} data.</span>
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="ml-2 h-auto p-1"
                aria-label={`Retry loading ${title}`}
              >
                <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                Retry
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : loading ? (
        skeleton ?? null
      ) : (
        children
      )}
    </section>
  );
}
