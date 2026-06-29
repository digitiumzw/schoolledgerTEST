import { cn } from "@/lib/utils";

type Variant = { bg: string; text: string; ring: string; dot: string };

const variants: Record<string, Variant> = {
  // lifecycle statuses
  active:     { bg: "bg-success-soft",     text: "text-success",          ring: "ring-success/20",      dot: "bg-success" },
  trialing:   { bg: "bg-info-soft",        text: "text-info",             ring: "ring-info/20",         dot: "bg-info" },
  trial:      { bg: "bg-info-soft",        text: "text-info",             ring: "ring-info/20",         dot: "bg-info" },
  suspended:  { bg: "bg-destructive/10",   text: "text-destructive",      ring: "ring-destructive/20",  dot: "bg-destructive" },
  "past due": { bg: "bg-warning-soft",     text: "text-warning",          ring: "ring-warning/20",      dot: "bg-warning" },
  past_due:   { bg: "bg-warning-soft",     text: "text-warning",          ring: "ring-warning/20",      dot: "bg-warning" },
  cancelled:   { bg: "bg-muted",            text: "text-muted-foreground", ring: "ring-border",          dot: "bg-muted-foreground" },
  canceled:    { bg: "bg-muted",            text: "text-muted-foreground", ring: "ring-border",          dot: "bg-muted-foreground" },
  expired:     { bg: "bg-muted",            text: "text-muted-foreground", ring: "ring-border",          dot: "bg-muted-foreground" },
  superseded:  { bg: "bg-muted",            text: "text-muted-foreground", ring: "ring-border",          dot: "bg-muted-foreground" },
  inactive:    { bg: "bg-muted",            text: "text-muted-foreground", ring: "ring-border",          dot: "bg-muted-foreground" },
  // payment statuses
  paid:        { bg: "bg-success-soft",     text: "text-success",          ring: "ring-success/20",      dot: "bg-success" },
  completed:   { bg: "bg-success-soft",     text: "text-success",          ring: "ring-success/20",      dot: "bg-success" },
  pending:     { bg: "bg-warning-soft",     text: "text-warning",          ring: "ring-warning/20",      dot: "bg-warning" },
  initiated:   { bg: "bg-warning-soft",     text: "text-warning",          ring: "ring-warning/20",      dot: "bg-warning" },
  failed:      { bg: "bg-destructive/10",   text: "text-destructive",      ring: "ring-destructive/20",  dot: "bg-destructive" },
  overdue:     { bg: "bg-destructive/10",   text: "text-destructive",      ring: "ring-destructive/20",  dot: "bg-destructive" },
  refunded:    { bg: "bg-muted",            text: "text-muted-foreground", ring: "ring-border",          dot: "bg-muted-foreground" },
  // plan tiers — ordered by price tier (lowest to highest)
  free:       { bg: "bg-muted",            text: "text-muted-foreground", ring: "ring-border",          dot: "bg-muted-foreground" },
  starter:    { bg: "bg-slate-100",        text: "text-slate-600",        ring: "ring-slate-200",       dot: "bg-slate-400" },
  basic:      { bg: "bg-slate-100",        text: "text-slate-600",        ring: "ring-slate-200",       dot: "bg-slate-400" },
  growth:     { bg: "bg-info-soft",        text: "text-info",             ring: "ring-info/20",         dot: "bg-info" },
  pro:        { bg: "bg-primary/10",       text: "text-primary",          ring: "ring-primary/20",      dot: "bg-primary" },
  business:   { bg: "bg-primary/10",       text: "text-primary",          ring: "ring-primary/20",      dot: "bg-primary" },
  enterprise: { bg: "bg-violet-500/10",    text: "text-violet-600",       ring: "ring-violet-500/20",   dot: "bg-violet-500" },
  none:       { bg: "bg-muted",            text: "text-muted-foreground", ring: "ring-border",          dot: "bg-muted-foreground" },
};

const fallback: Variant = { bg: "bg-muted", text: "text-muted-foreground", ring: "ring-border", dot: "bg-muted-foreground" };

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const key = (status ?? "").toLowerCase().trim();
  const v   = variants[key] ?? fallback;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        v.bg, v.text, v.ring,
        className,
      )}
    >
      <span className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", v.dot)} />
      {status}
    </span>
  );
}
