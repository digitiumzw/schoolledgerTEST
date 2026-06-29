import { memo } from 'react';
import { AlertCircle, Bus, ClipboardCheck, CreditCard, DollarSign, LucideIcon, UserCheck, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardAggregatedWidget } from '@/api/api';

interface AggregatedMetricCardProps {
  widget: DashboardAggregatedWidget;
  onDrillDown: (widget: DashboardAggregatedWidget) => void;
}

const iconMap: Record<string, LucideIcon> = {
  users: Users,
  'clipboard-check': ClipboardCheck,
  'dollar-sign': DollarSign,
  'credit-card': CreditCard,
  bus: Bus,
  'user-check': UserCheck,
};

export const AggregatedMetricCard = memo(function AggregatedMetricCard({ widget, onDrillDown }: AggregatedMetricCardProps) {
  const Icon = widget.icon ? iconMap[widget.icon] ?? AlertCircle : AlertCircle;
  const isClickable = Boolean(widget.drillDown?.url);

  return (
    <Card
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={isClickable ? 'cursor-pointer transition-shadow hover:shadow-md' : undefined}
      onClick={() => isClickable && onDrillDown(widget)}
      onKeyDown={(event) => {
        if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onDrillDown(widget);
        }
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{widget.title}</CardTitle>
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-bold">{widget.metricLabel}</div>
        {widget.description && <p className="text-xs text-muted-foreground">{widget.description}</p>}
        <div className="flex items-center justify-between gap-2">
          <Badge variant={widget.isFresh ? 'secondary' : 'destructive'}>
            {widget.isFresh ? 'Fresh' : 'Stale'}
          </Badge>
          {widget.lastUpdated && (
            <span className="text-xs text-muted-foreground">
              {new Date(widget.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
