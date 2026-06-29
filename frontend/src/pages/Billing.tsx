import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import { useSubscription } from "@/hooks/useSubscription";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/api";
import type { SubscriptionPlan } from "@/api/api";
import { PlanSelector } from "@/components/subscription/PlanSelector";
import { StudentCapacityCard } from "@/components/subscription/StudentCapacityCard";
import { InvoiceList } from "@/components/subscription/InvoiceList";
import { SubscribeConfirmDialog } from "@/components/subscription/SubscribeConfirmDialog";
import { PlanChangeModal } from "@/components/subscription/PlanChangeModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ContextualHelpLink from "@/components/help/ContextualHelpLink";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Crown, AlertCircle, AlertTriangle, CheckCircle2, Clock, Loader2, Ban, GraduationCap, HelpCircle } from "lucide-react";

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

type ActionLabel = 'Subscribe' | 'Upgrade';

interface PendingPlan {
  planId: string;
  cycle: 'monthly' | 'annual';
  actionLabel: ActionLabel;
  planName: string;
  price: string;
}

function deriveActionLabel(
  selectedPlan: SubscriptionPlan,
  currentPlanSortOrder: number,
  hasSubscription: boolean,
): ActionLabel {
  if (!hasSubscription) return 'Subscribe';
  if (selectedPlan.sortOrder > currentPlanSortOrder) return 'Upgrade';
  return 'Subscribe'; // same plan = renewal
}

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { resolvedTheme } = useTheme();
  const paynowBadge = resolvedTheme === 'dark'
    ? '/Paynow Badge-vector-hires LIGHT.svg'
    : '/Paynow Badge-vector-hires DARK.svg';

  const paymentComplete = searchParams.get('payment') === 'complete';
  const txIdParam        = searchParams.get('txId') ?? '';

  type PollState = 'idle' | 'polling' | 'paid' | 'pending' | 'cancelled' | 'error';
  const [pollState, setPollState] = useState<PollState>('idle');
  const [pendingPlan, setPendingPlan] = useState<PendingPlan | null>(null);

  interface PlanChangeModalState {
    planId: string;
    cycle: 'monthly' | 'annual';
    actionLabel: 'Upgrade';
  }
  const [planChangeModal, setPlanChangeModal] = useState<PlanChangeModalState | null>(null);

  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("billing-onboarding-dismissed");
    if (!dismissed) {
      setOnboardingOpen(true);
    }
  }, []);

  const handleDismissOnboarding = () => {
    if (dontShowAgain) {
      localStorage.setItem("billing-onboarding-dismissed", "true");
    }
    setOnboardingOpen(false);
    setDontShowAgain(false);
  };

  useEffect(() => {
    if (!paymentComplete) return;

    const cleanUrl = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('payment');
      next.delete('sandbox');
      next.delete('ref');
      next.delete('txId');
      setSearchParams(next, { replace: true });
    };

    if (!txIdParam) {
      queryClient.invalidateQueries({ queryKey: ['subscription-current'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-history'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-invoices'] });
      setPollState('paid');
      cleanUrl();
      return;
    }

    setPollState('polling');
    api.pollSubscriptionStatus(txIdParam)
      .then((result) => {
        if (result.paid) {
          setPollState('paid');
        } else if (result.paynowStatus?.toLowerCase() === 'cancelled') {
          setPollState('cancelled');
        } else {
          setPollState('pending');
        }
      })
      .catch(() => setPollState('error'))
      .finally(() => {
        queryClient.invalidateQueries({ queryKey: ['subscription-current'] });
        queryClient.invalidateQueries({ queryKey: ['subscription-history'] });
        queryClient.invalidateQueries({ queryKey: ['subscription-invoices'] });
        cleanUrl();
      });
  }, []);

  const {
    plans,
    subscription,
    studentCount,
    maxStudents,
    capacityPercent,
    remainingSlots,
    isNearCapacity,
    recommendedPlanId,
    isExpired,
    isOverLimit,
    daysUntilExpiry,
    transitionPolicy,
    selectedCycle,
    setSelectedCycle,
    isLoadingPlans,
    isLoadingCurrent,
    loadingPlanId,
    initiatePaidSubscription,
  } = useSubscription();

  const effectiveSelectedCycle =
    selectedCycle === 'monthly' && transitionPolicy.canSwitchToMonthly === false ? 'annual' : selectedCycle;

  const { data: invoices, isLoading: isLoadingInvoices } = useQuery({
    queryKey: ['subscription-invoices'],
    queryFn: api.getInvoices,
  });

  const handleSubscribe = (planId: string, cycle: 'monthly' | 'annual') => {
    const selectedPlan = plans.find((p) => p.id === planId);
    if (!selectedPlan) return;

    const currentPlanSortOrder = subscription
      ? plans.find((p) => p.id === subscription.planId)?.sortOrder ?? 0
      : 0;

    if (cycle === 'monthly' && transitionPolicy.canSwitchToMonthly === false) {
      return;
    }

    const actionLabel = deriveActionLabel(selectedPlan, currentPlanSortOrder, subscription !== null);

    // Upgrades go through the proration modal.
    if (actionLabel === 'Upgrade') {
      setPlanChangeModal({ planId, cycle, actionLabel });
      return;
    }

    // New subscription or same-plan renewal — show simple confirm dialog.
    const priceAmount =
      cycle === 'annual' ? selectedPlan.annualPriceCents : selectedPlan.monthlyPriceCents;
    const priceStr = `${formatCents(priceAmount, selectedPlan.currency)}/${cycle === 'annual' ? 'year' : 'month'}`;

    setPendingPlan({
      planId,
      cycle,
      actionLabel,
      planName: selectedPlan.name,
      price: priceStr,
    });
  };

  const handleConfirmSubscribe = () => {
    if (!pendingPlan) return;
    initiatePaidSubscription(pendingPlan.planId, pendingPlan.cycle);
    setPendingPlan(null);
  };

  const handleCancelDialog = () => setPendingPlan(null);

  const statusColor: Record<string, string> = {
    active:    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    expired:   'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    superseded:'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    pending:   'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Billing &amp; Subscription</h1>
            <p className="text-sm text-muted-foreground">Manage your SchoolLedger subscription plan</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ContextualHelpLink sectionId="billing-workflow" label="Billing Workflow Help" />
          <Button variant="ghost" size="sm" onClick={() => setOnboardingOpen(true)} className="hidden sm:flex">
            <HelpCircle className="h-4 w-4 mr-2" />
            Billing guide
          </Button>
        </div>
      </div>

      {/* Payment return banners */}
      {pollState === 'polling' && (
        <Alert variant="info">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Verifying Payment</AlertTitle>
          <AlertDescription>Checking your payment status with Paynow…</AlertDescription>
        </Alert>
      )}
      {pollState === 'paid' && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle>Payment Confirmed</AlertTitle>
          <AlertDescription>Your payment was successful. Your subscription is now active.</AlertDescription>
        </Alert>
      )}
      {pollState === 'cancelled' && (
        <Alert variant="warning">
          <Ban className="h-4 w-4" />
          <AlertTitle>Transaction Cancelled</AlertTitle>
          <AlertDescription>Your payment was not completed. No changes have been made to your subscription.</AlertDescription>
        </Alert>
      )}
      {pollState === 'pending' && (
        <Alert variant="warning">
          <Clock className="h-4 w-4" />
          <AlertTitle>Payment Processing</AlertTitle>
          <AlertDescription>Your payment is being processed. Your subscription will activate automatically once confirmed.</AlertDescription>
        </Alert>
      )}
      {pollState === 'error' && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Could Not Verify Payment</AlertTitle>
          <AlertDescription>We couldn't confirm your payment status. Your subscription will activate once Paynow confirms the payment.</AlertDescription>
        </Alert>
      )}

      {/* Subscription status alerts */}
      {isExpired && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Subscription Expired</AlertTitle>
          <AlertDescription>Your subscription has expired. Select a plan below to renew access.</AlertDescription>
        </Alert>
      )}
      {isOverLimit && !isExpired && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Student Limit Reached</AlertTitle>
          <AlertDescription>You've reached your plan's student limit. Upgrade to add more students.</AlertDescription>
        </Alert>
      )}
      {!isExpired && !isOverLimit && isNearCapacity && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Approaching Student Capacity</AlertTitle>
          <AlertDescription>
            You are using {capacityPercent}% of your plan&apos;s student limit ({studentCount} of {maxStudents}). Upgrade your plan to avoid disruption.
          </AlertDescription>
        </Alert>
      )}
      {!isExpired && !isOverLimit && daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
        <Alert variant="warning">
          <Clock className="h-4 w-4" />
          <AlertTitle>Expiring Soon</AlertTitle>
          <AlertDescription>
            Your subscription expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''}. Renew now to avoid interruption.
          </AlertDescription>
        </Alert>
      )}
      {transitionPolicy.canSwitchToMonthly === false && transitionPolicy.blockedReason && (
        <Alert variant="info" className="py-2 text-xs">
          <Ban className="h-3 w-3" />
          <AlertTitle className="text-xs font-medium mb-0">Annual Billing Locked In</AlertTitle>
          <AlertDescription className="text-xs">{transitionPolicy.blockedReason}</AlertDescription>
        </Alert>
      )}

      {/* Student capacity widget */}
      {(subscription !== null || isLoadingCurrent) && (
        <StudentCapacityCard
          studentCount={studentCount}
          maxStudents={maxStudents}
          capacityPercent={capacityPercent}
          remainingSlots={remainingSlots}
          isLoading={isLoadingCurrent}
        />
      )}

      {/* Current subscription card */}
      <Card className="border-2 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold">Current Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingCurrent ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          ) : subscription ? (
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Plan</span>
                <div className="font-semibold">{subscription.planName}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <div>
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${statusColor[subscription.status] ?? ''}`}>
                    {subscription.status}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Billing</span>
                <div className="font-semibold capitalize">{subscription.billingCycle}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Expires</span>
                <div className="font-semibold">{formatDate(subscription.expiresAt)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Students</span>
                <div className="font-semibold">{studentCount}</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              No active subscription — choose a plan below to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan selector */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Choose a Plan</h2>
        {isLoadingPlans ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : (
          <PlanSelector
            plans={plans}
            selectedCycle={effectiveSelectedCycle}
            onCycleChange={setSelectedCycle}
            recommendedPlanId={recommendedPlanId}
            currentSubscription={subscription}
            transitionPolicy={transitionPolicy}
            onSubscribe={handleSubscribe}
            loadingPlanId={loadingPlanId}
            studentCount={studentCount}
          />
        )}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <img
            src={paynowBadge}
            alt="Payments powered by Paynow"
            className="h-15 object-contain"
          />
        </div>
      </div>

      {/* Invoices */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Invoices</h2>
        {isLoadingInvoices ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : (
          <InvoiceList invoices={invoices?.invoices ?? []} />
        )}
      </div>

      {/* Paynow redirect confirmation dialog (new subscription / renewal) */}
      {pendingPlan && (
        <SubscribeConfirmDialog
          open={pendingPlan !== null}
          planName={pendingPlan.planName}
          price={pendingPlan.price}
          cycle={pendingPlan.cycle}
          actionLabel={pendingPlan.actionLabel}
          isLoading={loadingPlanId !== null}
          onConfirm={handleConfirmSubscribe}
          onCancel={handleCancelDialog}
        />
      )}

      {/* Proration modal (upgrade / downgrade) */}
      {planChangeModal && (
        <PlanChangeModal
          key={`${planChangeModal.planId}-${planChangeModal.cycle}`}
          open={true}
          onClose={() => setPlanChangeModal(null)}
          initialPlanId={planChangeModal.planId}
          initialCycle={planChangeModal.cycle}
          plans={plans}
          currentSubscription={subscription}
          recommendedPlanId={recommendedPlanId}
          studentCount={studentCount}
        />
      )}

      <Dialog open={onboardingOpen} onOpenChange={setOnboardingOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Getting Started with Billing &amp; Subscription
            </DialogTitle>
            <DialogDescription>
              How to manage your SchoolLedger plan, payments, and invoices.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {[
              ["1", "Choose a Plan", "Select from Starter, Growth, or Enterprise tiers based on your student count and feature needs. Each plan unlocks different module access.", Crown],
              ["2", "Monthly vs Annual", "Annual plans offer better value but block switching to monthly later. Monthly plans provide flexibility with a higher per-month cost.", Clock],
              ["3", "Student Capacity", "Every plan has a student limit. You can monitor current usage and upgrade before hitting the cap to avoid service interruption.", AlertTriangle],
              ["4", "Pay with Paynow", "Subscribe or renew using Paynow. After redirect, your payment is verified automatically and your subscription activates immediately.", CheckCircle2],
              ["5", "View Invoices", "Access your full invoice history with amounts, statuses, and due dates. Download PDF receipts for accounting and reconciliation.", AlertCircle],
            ].map(([step, title, detail, Icon]) => (
              <div key={step} className="flex items-start gap-3 border-b py-2.5 last:border-0">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary mt-0.5">
                  {step}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold">{title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter className="flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="bi-dont-show-again"
                checked={dontShowAgain}
                onCheckedChange={(checked) => setDontShowAgain(checked === true)}
              />
              <Label htmlFor="bi-dont-show-again" className="text-sm cursor-pointer">
                Don&apos;t show this again
              </Label>
            </div>
            <Button onClick={handleDismissOnboarding}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
