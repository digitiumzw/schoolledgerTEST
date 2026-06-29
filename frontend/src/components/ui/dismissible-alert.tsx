import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, type AlertProps } from "@/components/ui/alert";

interface DismissibleAlertProps extends AlertProps {
  onDismiss?: () => void;
  dismissLabel?: string;
}

const DismissibleAlert = React.forwardRef<HTMLDivElement, DismissibleAlertProps>(
  ({ className, children, onDismiss, dismissLabel = "Dismiss alert", ...props }, ref) => {
    return (
      <Alert
        ref={ref}
        className={cn("relative pr-10", className)}
        {...props}
      >
        {children}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-md text-foreground/60 transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={dismissLabel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </Alert>
    );
  }
);
DismissibleAlert.displayName = "DismissibleAlert";

export { DismissibleAlert };
