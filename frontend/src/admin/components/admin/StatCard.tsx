import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: number;
  subtitle?: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "info" | "danger";
  format?: "text" | "currency" | "number";
  compact?: boolean;
}

const toneStyles: Record<string, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info:    "bg-info-soft text-info",
  danger:  "bg-destructive/10 text-destructive",
};

function formatValue(value: string | number, format: StatCardProps["format"], compact: boolean) {
  if (typeof value === "string") return value;

  if (format === "currency") {
    const normalized = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
    return `$${normalized}`;
  }

  if (format === "number") {
    return new Intl.NumberFormat("en-US", {
      notation: compact ? "compact" : "standard",
      maximumFractionDigits: compact ? 1 : 2,
    }).format(value);
  }

  return String(value);
}

export function StatCard({ label, value, delta, subtitle, icon: Icon, tone = "primary", format = "text", compact = false }: StatCardProps) {
  const positive   = (delta ?? 0) >= 0;
  const showDelta  = delta !== undefined && delta !== 0;
  const displayValue = formatValue(value, format, compact);

  return (
    <Card className="p-5 shadow-card transition-all hover:shadow-elegant">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{displayValue}</p>
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneStyles[tone] ?? toneStyles.primary)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {showDelta ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5",
              positive ? "bg-success-soft text-success" : "bg-destructive/10 text-destructive",
            )}
          >
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {positive ? "+" : ""}
            {delta}%
          </span>
          <span className="text-muted-foreground">vs last month</span>
        </div>
      ) : subtitle ? (
        <p className="mt-3 text-xs text-muted-foreground">{subtitle}</p>
      ) : (
        <div className="mt-3 h-4" />
      )}
    </Card>
  );
}
