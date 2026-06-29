import { Link } from "react-router-dom";
import { Ban } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const { hasActivePlan, isLoadingCurrent } = useSubscription();

  if (isLoadingCurrent) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!hasActivePlan) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="h-7 w-7 text-destructive" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">No Active Subscription</h2>
            <p className="text-sm text-muted-foreground">
              Subscribe to a plan to unlock this feature.
            </p>
          </div>
          <Button asChild>
            <Link to="/billing">Subscribe Now</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
