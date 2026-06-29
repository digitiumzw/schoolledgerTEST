import { useSubscription } from "@/hooks/useSubscription";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, AlertTriangle, Clock, Ban } from "lucide-react";
import { Link } from "react-router-dom";
import { useGraceUsage } from "@/hooks/useGraceUsage";

export function SubscriptionStatusBanner() {
  const { subscription, hasActivePlan, isExpired, isOverLimit, isNearCapacity, studentCount, maxStudents, capacityPercent, daysUntilExpiry, isLoadingCurrent } = useSubscription();
  // Suppress the "expired" banner only when the blocking overlay is active —
  // the overlay already shows the renewal CTA and a countdown, so the banner
  // would be redundant (and hidden behind the blur anyway).
  const { isBlocked } = useGraceUsage();
  const graceOverlayActive = isBlocked;

  if (isLoadingCurrent) return null;
  if (!hasActivePlan && subscription === null) {
    return (
      <Alert variant="destructive" className="mb-4 rounded-none border-x-0 border-t-0">
        <Ban className="h-4 w-4" />
        <AlertDescription>
          You don't have an active subscription.{' '}
          <Link to="/billing" className="font-semibold underline underline-offset-2">
            Subscribe now
          </Link>{' '}
          to unlock all features.
        </AlertDescription>
      </Alert>
    );
  }
  // When expired, the ExpiredSubscriptionOverlay renders a countdown bar (grace
  // time available) or a full blocking overlay (grace exhausted). Either way it
  // owns the expired messaging, so we skip the banner here to avoid duplicates.
  if (!hasActivePlan && isExpired && graceOverlayActive) return null;
  if (!hasActivePlan && isExpired) {
    return (
      <Alert variant="destructive" className="mb-4 rounded-none border-x-0 border-t-0">
        <Ban className="h-4 w-4" />
        <AlertDescription>
          Your subscription has expired.{' '}
          <Link to="/billing" className="font-semibold underline underline-offset-2">
            Renew now
          </Link>{' '}
          to restore full access.
        </AlertDescription>
      </Alert>
    );
  }
  if (!hasActivePlan) return null;

  if (isExpired && graceOverlayActive) return null;
  if (isExpired) {
    return (
      <Alert variant="destructive" className="mb-4 rounded-none border-x-0 border-t-0">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Your subscription has expired.{' '}
          <Link to="/billing" className="font-semibold underline underline-offset-2">
            Renew now
          </Link>{' '}
          to restore full access.
        </AlertDescription>
      </Alert>
    );
  }

  if (isOverLimit) {
    return (
      <Alert variant="destructive" className="mb-4 rounded-none border-x-0 border-t-0">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Student limit reached.{' '}
          <Link to="/billing" className="font-semibold underline underline-offset-2">
            Upgrade your plan
          </Link>{' '}
          to add more students.
        </AlertDescription>
      </Alert>
    );
  }

  if (isNearCapacity) {
    return (
      <Alert variant="warning" className="mb-4 rounded-none border-x-0 border-t-0">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Approaching student limit ({studentCount}/{maxStudents} — {capacityPercent}% used).{' '}
          <Link to="/billing" className="font-semibold underline underline-offset-2">
            Upgrade plan
          </Link>{' '}
          soon to avoid disruption.
        </AlertDescription>
      </Alert>
    );
  }

  if (daysUntilExpiry !== null && daysUntilExpiry <= 7) {
    return (
      <Alert variant="warning" className="mb-4 rounded-none border-x-0 border-t-0">
        <Clock className="h-4 w-4" />
        <AlertDescription>
          Subscription expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}.{' '}
          <Link to="/billing" className="font-semibold underline underline-offset-2">
            Renew now
          </Link>
          .
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
