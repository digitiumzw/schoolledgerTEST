import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full overflow-hidden rounded-xl border px-3.5 py-3 text-sm shadow-sm transition-colors before:absolute before:inset-y-0 before:left-0 before:w-1 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-2px] [&>svg]:absolute [&>svg]:left-3.5 [&>svg]:top-3.5",
  {
    variants: {
      variant: {
        default:
          "border-border/70 bg-background text-foreground before:bg-primary/70 [&>svg]:text-primary",
        info:
          "border-blue-200/80 bg-blue-50/80 text-blue-950 before:bg-blue-500 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-100 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400",
        success:
          "border-emerald-200/80 bg-emerald-50/80 text-emerald-950 before:bg-emerald-500 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-100 [&>svg]:text-emerald-600 dark:[&>svg]:text-emerald-400",
        warning:
          "border-amber-200/90 bg-amber-50/90 text-amber-950 before:bg-amber-500 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-100 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400",
        destructive:
          "border-red-200/90 bg-red-50/90 text-red-950 before:bg-red-500 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-100 [&>svg]:text-red-600 dark:[&>svg]:text-red-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  )
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn("mb-0.5 text-sm font-semibold leading-snug tracking-tight", className)} {...props} />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm leading-snug opacity-90 [&_p]:leading-snug", className)} {...props} />
  ),
);
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
