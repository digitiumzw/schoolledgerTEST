import { Link } from 'react-router-dom';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGraceUsage } from '@/hooks/useGraceUsage';
import { useSubscription } from '@/hooks/useSubscription';

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function secondsUntilNextHour(nextHourAt: string | null): number {
  if (!nextHourAt) {
    const now = new Date();
    const next = new Date(now);
    next.setHours(now.getHours() + 1, 0, 0, 0);
    return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
  }
  return Math.max(0, Math.floor((new Date(nextHourAt).getTime() - Date.now()) / 1000));
}

interface Props {
  children: React.ReactNode;
}

/**
 * Wraps the main content area and enforces the grace-period restriction for
 * tenants whose subscription has expired.
 *
 * Behaviour:
 *  - Active subscription → renders children normally (no-op).
 *  - Expired, grace time remaining → renders children normally with full access.
 *  - Expired, grace time exhausted → renders children blurred + blocking overlay
 *    with renewal CTA and countdown to the next usage window.
 */
export function ExpiredSubscriptionOverlay({ children }: Props) {
  const { isExpired, subscription, isLoadingCurrent } = useSubscription();
  const { isBlocked, nextHourAt } = useGraceUsage();

  // Not expired, still loading, or grace time still available — full access
  if (!isExpired || isLoadingCurrent || !isBlocked) {
    return <>{children}</>;
  }

  // Grace period exhausted — blur content and show renewal overlay
  const resetCountdown = secondsUntilNextHour(nextHourAt);

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Blurred, non-interactive content underneath */}
      <div
        aria-hidden="true"
        className="pointer-events-none select-none blur-sm brightness-75 flex-1"
      >
        {children}
      </div>

      {/* Blocking renewal overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-6 text-center max-w-sm w-full mx-4 rounded-2xl border bg-card p-8 shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Clock className="h-8 w-8 text-destructive" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Grace Period Used</h2>
            <p className="text-sm text-muted-foreground">
              Your{' '}
              <span className="font-semibold text-foreground">
                {subscription?.planName ?? 'subscription'}
              </span>{' '}
              plan has expired. You have used your 5-minute grace period for this
              hour.
            </p>
          </div>

          <div className="w-full rounded-xl border bg-muted/50 px-6 py-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
              Next window opens in
            </p>
            <p className="font-mono text-3xl font-bold tabular-nums">
              {formatTime(resetCountdown)}
            </p>
          </div>

          <Button asChild size="lg" className="w-full">
            <Link to="/billing">
              <RefreshCw className="mr-2 h-4 w-4" />
              Renew Subscription
            </Link>
          </Button>

          <p className="text-xs text-muted-foreground">
            Renewing now restores full access immediately.
          </p>
        </div>
      </div>
    </div>
  );
}
