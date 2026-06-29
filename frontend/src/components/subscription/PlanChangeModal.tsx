import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import type { SubscriptionPlan, SchoolSubscription } from '@/api/api';
import { useProration } from '@/hooks/useProration';
import { ProrationBreakdown } from './ProrationBreakdown';
import { ProrationSkeleton } from './ProrationSkeleton';
import { PlanSelector } from './PlanSelector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PlanChangeModalProps {
  open: boolean;
  onClose: () => void;
  initialPlanId: string;
  initialCycle: 'monthly' | 'annual';
  plans: SubscriptionPlan[];
  currentSubscription: SchoolSubscription | null;
  recommendedPlanId: string;
  studentCount?: number;
}

export function PlanChangeModal({
  open,
  onClose,
  initialPlanId,
  initialCycle,
  plans,
  currentSubscription,
  recommendedPlanId,
  studentCount = 0,
}: PlanChangeModalProps) {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'annual'>(initialCycle);

  const {
    calculation,
    isLoading,
    error,
    calculateProration,
    initiateUpgrade,
    clearCalculation,
  } = useProration();

  // Kick off the calculation as soon as the modal opens with a pre-selected plan.
  useEffect(() => {
    if (open && initialPlanId) {
      setSelectedCycle(initialCycle);
      calculateProration(initialPlanId, initialCycle);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    clearCalculation();
    onClose();
  };

  const handlePlanSelect = (planId: string, cycle: 'monthly' | 'annual') => {
    setSelectedCycle(cycle);
    calculateProration(planId, cycle);
  };

  const handleConfirm = async () => {
    try {
      const result = await initiateUpgrade('paynow');
      handleClose();
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        // Zero-amount or downgrade — activated immediately without a payment redirect.
        await queryClient.invalidateQueries({ queryKey: ['subscription-current'] });
        await queryClient.invalidateQueries({ queryKey: ['subscription-history'] });
        await queryClient.invalidateQueries({ queryKey: ['subscription-invoices'] });
        navigate('/billing?payment=complete');
      }
    } catch {
      // error is already surfaced via the hook's error state
    }
  };

  const title = 'Upgrade Plan';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{calculation ? 'Plan Change Summary' : title}</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error.message}
                </AlertDescription>
          </Alert>
        )}

        <div className="mt-2">
          {isLoading && !calculation ? (
            <ProrationSkeleton />
          ) : calculation ? (
            <ProrationBreakdown
              calculation={calculation}
              onConfirm={handleConfirm}
              onCancel={clearCalculation}
              isLoading={isLoading}
            />
          ) : (
            <PlanSelector
              plans={plans}
              selectedCycle={selectedCycle}
              onCycleChange={setSelectedCycle}
              recommendedPlanId={recommendedPlanId}
              currentSubscription={currentSubscription}
              transitionPolicy={{
                canSwitchToAnnual: currentSubscription?.billingCycle !== 'annual',
                canSwitchToMonthly: currentSubscription?.billingCycle !== 'annual',
                canChangeTier: currentSubscription !== null,
                blockedReason: currentSubscription?.billingCycle === 'annual'
                  ? 'Annual subscriptions cannot be converted to monthly. You can change annual plan tiers while keeping your renewal date.'
                  : null,
              }}
              onSubscribe={handlePlanSelect}
              loadingPlanId={isLoading ? initialPlanId : null}
              studentCount={studentCount}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
