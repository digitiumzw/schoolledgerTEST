export function ProrationSkeleton() {
  return (
    <div
      className="w-full space-y-4 animate-pulse"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading proration details"
    >
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-3/4" />
      </div>
      <div className="h-px bg-border" />
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
      <div className="h-px bg-border" />
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-full" />
      </div>
      <div className="h-px bg-border" />
      <div className="h-6 bg-muted rounded w-full" />
      <div className="flex gap-3 pt-2">
        <div className="h-10 bg-muted rounded flex-1" />
        <div className="h-10 bg-muted rounded flex-1" />
      </div>
    </div>
  );
}
