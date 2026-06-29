<?php

namespace App\Services;

class SubscriptionTransitionPolicy
{
    public const ANNUAL_TO_MONTHLY_BLOCKED = 'ANNUAL_TO_MONTHLY_BLOCKED';
    public const POLICY_CODE = 'ONE_WAY_ANNUAL_CYCLE';

    public function transitionPolicy(?array $activeSubscription): array
    {
        $isAnnual = $activeSubscription !== null
            && ($activeSubscription['status'] ?? null) === 'active'
            && ($activeSubscription['billing_cycle'] ?? null) === 'annual';

        return [
            'canSwitchToAnnual'  => !$isAnnual,
            'canSwitchToMonthly' => !$isAnnual,
            'canChangeTier'      => $activeSubscription !== null,
            'blockedReason'      => $isAnnual
                ? 'Annual subscriptions cannot be converted to monthly. You may change plan tier within the annual cycle.'
                : null,
        ];
    }

    public function canTransition(?array $activeSubscription, string $targetBillingCycle): array
    {
        if ($activeSubscription === null) {
            return ['allowed' => true];
        }

        if (($activeSubscription['billing_cycle'] ?? null) === 'annual' && $targetBillingCycle === 'monthly') {
            return [
                'allowed' => false,
                'code'    => self::ANNUAL_TO_MONTHLY_BLOCKED,
                'message' => 'Annual subscriptions cannot be converted to monthly billing.',
                'errors'  => [
                    'code'         => self::ANNUAL_TO_MONTHLY_BLOCKED,
                    'billingCycle' => 'Once a tenant is on annual billing, only annual tier changes are allowed within the active cycle.',
                ],
            ];
        }

        return ['allowed' => true];
    }

    public function changeType(?array $activeSubscription, array $currentPlan, array $targetPlan, string $targetBillingCycle): string
    {
        if ($activeSubscription === null) {
            return 'new_subscription';
        }

        if (($activeSubscription['billing_cycle'] ?? null) === 'monthly' && $targetBillingCycle === 'annual') {
            return 'monthly_to_annual';
        }

        $currentSort = (int) ($currentPlan['sort_order'] ?? 0);
        $targetSort  = (int) ($targetPlan['sort_order'] ?? 0);

        if ($targetSort > $currentSort) {
            return $targetBillingCycle === 'annual' ? 'annual_tier_upgrade' : 'tier_upgrade';
        }

        if ($targetSort < $currentSort) {
            return $targetBillingCycle === 'annual' ? 'annual_tier_downgrade' : 'tier_downgrade';
        }

        return 'renewal';
    }
}
