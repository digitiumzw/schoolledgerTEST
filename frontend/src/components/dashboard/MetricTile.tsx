import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricTileProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "warning" | "danger" | "success";
  onClick?: () => void;
  tooltip?: string;
}

export function MetricTile({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
  onClick,
  tooltip,
}: MetricTileProps) {
  const iconColor = {
    default: "text-primary",
    warning: "text-yellow-500",
    danger: "text-destructive",
    success: "text-green-600",
  }[variant];

  const card = (
    <Card
      className={cn("transition-all hover:shadow-md", onClick && "cursor-pointer")}
      onClick={onClick}
      aria-label={`${title}: ${value}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={cn("h-5 w-5", iconColor)} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl sm:text-3xl font-bold text-foreground">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );

  if (!tooltip) return card;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          {card}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-sm">
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
