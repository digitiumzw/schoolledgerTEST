import { DollarSign, Calendar, Clock, UserPlus, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityItem } from "@/hooks/useDashboardStats";
import { formatActivityTime } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/studentUtils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

interface ActivityFeedProps {
  activities: ActivityItem[];
  loading: boolean;
}

export function ActivityFeed({ activities, loading }: ActivityFeedProps) {
  const navigate = useNavigate();
  // Tick every 60s to refresh relative/pretty times without refetching
  const [, setNow] = useState<number>(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sortedActivities = [...activities].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-center" aria-live="polite">
        <Clock className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">No recent activity</p>
        <p className="text-xs text-muted-foreground">Events like payments, enrollments, and status changes will appear here.</p>
      </div>
    );
  }

  return (
    <div role="feed" aria-label="Recent activity">
      <div className="space-y-4">
        {sortedActivities.map((activity) => {
          let Icon = Clock;
          let bgColor = "bg-muted dark:bg-muted/20";
          let iconColor = "text-muted-foreground";

          switch (activity.type) {
            case "payment":
              Icon = DollarSign;
              bgColor = "bg-green-100 dark:bg-green-900/20";
              iconColor = "text-green-600 dark:text-green-400";
              break;
            case "leave":
              Icon = Calendar;
              bgColor = "bg-orange-100 dark:bg-orange-900/20";
              iconColor = "text-orange-600 dark:text-orange-400";
              break;
            case "enrollment":
              Icon = UserPlus;
              bgColor = "bg-blue-100 dark:bg-blue-900/20";
              iconColor = "text-blue-600 dark:text-blue-400";
              break;
            case "status_change":
              Icon = RefreshCw;
              bgColor = "bg-purple-100 dark:bg-purple-900/20";
              iconColor = "text-purple-600 dark:text-purple-400";
              break;
          }

          return (
            <article
              key={`${activity.type}-${activity.id}`}
              className="flex items-start gap-4 pb-4 border-b last:border-0"
              aria-label={activity.description}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                  bgColor
                )}
                aria-hidden="true"
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    iconColor
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{activity.description}</p>
                <p className="text-xs text-muted-foreground truncate">{activity.detail}</p>
                {activity.type === "payment" && activity.amount != null && (
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 mt-0.5">
                    {formatCurrency(activity.amount)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  {formatActivityTime(activity.timestamp)}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="flex gap-2 mt-4 pt-4 border-t">
        <Button
          variant="link"
          className="flex-1"
          onClick={() => navigate("/payments")}
          aria-label="View all payments"
        >
          View Payments
        </Button>
      </div>
    </div>
  );
}
