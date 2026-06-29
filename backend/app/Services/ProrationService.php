<?php

namespace App\Services;

use App\Models\ProrationCalculationModel;
use App\Models\SubscriptionCreditModel;

class ProrationService
{
    private ProrationCalculationModel $calcModel;
    private SubscriptionCreditModel $creditModel;

    public function __construct()
    {
        $this->calcModel   = new ProrationCalculationModel();
        $this->creditModel = new SubscriptionCreditModel();
    }

    /**
     * Calculate proration for a plan change.
     *
     * @param array $currentSub     Active school_subscriptions record
     * @param array $originalPlan   subscription_plans record for current plan
     * @param array $newPlan        subscription_plans record for target plan
     * @param string $billingCycle  'monthly' | 'annual'
     * @return array Proration data (not persisted)
     */
    public function calculateProration(
        array $currentSub,
        array $originalPlan,
        array $newPlan,
        string $billingCycle
    ): array {
        $cycleStart = strtotime($currentSub['starts_at']);
        $cycleEnd   = $currentSub['expires_at']
            ? strtotime($currentSub['expires_at'])
            : strtotime('+1 month', $cycleStart);

        $now = time();

        // Days in full cycle (inclusive)
        $daysInCycle   = (int) ceil(($cycleEnd - $cycleStart) / 86400);
        $daysRemaining = max(0, (int) floor(($cycleEnd - $now) / 86400));

        // Clamp: remaining cannot exceed total
        $daysRemaining = min($daysRemaining, $daysInCycle);

        $originalPriceCents = $billingCycle === 'annual'
            ? (int) $originalPlan['annual_price_cents']
            : (int) $originalPlan['monthly_price_cents'];

        $newPriceCents = $billingCycle === 'annual'
            ? (int) $newPlan['annual_price_cents']
            : (int) $newPlan['monthly_price_cents'];

        // Avoid division by zero
        if ($daysInCycle <= 0) {
            $daysInCycle = 1;
        }

        // Daily rates (stored as floats for intermediate calculation, rounded to int)
        $dailyRateOriginal = $originalPriceCents / $daysInCycle;
        $dailyRateNew      = $newPriceCents / $daysInCycle;

        $isUpgrade   = (int) $newPlan['sort_order'] > (int) $originalPlan['sort_order'];
        $isDowngrade = (int) $newPlan['sort_order'] < (int) $originalPlan['sort_order'];

        $unusedValueCreditCents = (int) round($dailyRateOriginal * $daysRemaining);
        $proratedChargeCents    = (int) round($dailyRateNew * $daysRemaining);
        $netAmountCents         = $proratedChargeCents - $unusedValueCreditCents;

        if ($billingCycle === 'annual' && $isUpgrade) {
            $priceDifferenceCents = $newPriceCents - $originalPriceCents;
            $netAmountCents = (int) round(($priceDifferenceCents * $daysRemaining) / $daysInCycle);
            $proratedChargeCents = $unusedValueCreditCents + $netAmountCents;
            $formula = sprintf(
                'Annual Upgrade = (%d - %d) * %d / %d = %d cents',
                $newPriceCents,
                $originalPriceCents,
                $daysRemaining,
                $daysInCycle,
                $netAmountCents
            );
        } else {
            $formula = sprintf(
                'Unused Credit = (%d / %d) * %d = %d cents; Prorated Charge = (%d / %d) * %d = %d cents; Net = %d - %d = %d cents',
                $originalPriceCents, $daysInCycle, $daysRemaining, $unusedValueCreditCents,
                $newPriceCents, $daysInCycle, $daysRemaining, $proratedChargeCents,
                $proratedChargeCents, $unusedValueCreditCents, $netAmountCents
            );
        }

        return [
            'cycleStartDate'          => date('Y-m-d', $cycleStart),
            'cycleEndDate'            => date('Y-m-d', $cycleEnd),
            'daysInCycle'             => $daysInCycle,
            'daysRemaining'           => $daysRemaining,
            'originalPlanPriceCents'  => $originalPriceCents,
            'newPlanPriceCents'       => $newPriceCents,
            'unusedValueCreditCents'  => $unusedValueCreditCents,
            'proratedChargeCents'     => $proratedChargeCents,
            'netAmountCents'          => $netAmountCents,
            'dailyRateOriginalCents'  => (int) round($dailyRateOriginal),
            'dailyRateNewCents'       => (int) round($dailyRateNew),
            'formula'                 => $formula,
            'isUpgrade'               => $isUpgrade,
            'isDowngrade'             => $isDowngrade,
        ];
    }

    /**
     * Persist a proration calculation record.
     *
     * @param string $id           UUID for the record
     * @param string $tenantId
     * @param array  $currentSub   Active subscription record
     * @param array  $originalPlan
     * @param array  $newPlan
     * @param string $billingCycle
     * @param array  $proration    Result from calculateProration()
     * @return string              The inserted record ID
     */
    public function saveCalculation(
        string $id,
        string $tenantId,
        array $currentSub,
        array $originalPlan,
        array $newPlan,
        string $billingCycle,
        array $proration,
        ?string $changeType = null,
        ?string $policyCode = null
    ): string {
        $this->calcModel->insert([
            'id'                         => $id,
            'tenant_id'                  => $tenantId,
            'original_subscription_id'   => $currentSub['id'],
            'new_subscription_id'        => null,
            'original_plan_id'           => $originalPlan['id'],
            'new_plan_id'                => $newPlan['id'],
            'billing_cycle'              => $billingCycle,
            'change_type'                => $changeType,
            'policy_code'                => $policyCode,
            'cycle_start_date'           => $proration['cycleStartDate'],
            'cycle_end_date'             => $proration['cycleEndDate'],
            'days_in_cycle'              => $proration['daysInCycle'],
            'days_remaining'             => $proration['daysRemaining'],
            'original_plan_price_cents'  => $proration['originalPlanPriceCents'],
            'new_plan_price_cents'       => $proration['newPlanPriceCents'],
            'unused_value_credit_cents'  => $proration['unusedValueCreditCents'],
            'prorated_charge_cents'      => $proration['proratedChargeCents'],
            'net_amount_cents'           => $proration['netAmountCents'],
            'calculation_formula'        => $proration['formula'],
            'status'                     => 'calculated',
        ]);

        return $id;
    }

    /**
     * Create a credit record for a downgrade scenario.
     *
     * @param string $id           UUID
     * @param string $tenantId
     * @param string $subscriptionId  The subscription that generated the credit
     * @param string|null $calculationId  FK to proration_calculations
     * @param int    $amountCents
     * @param string $currency
     * @return string              Inserted credit ID
     */
    public function createCreditForDowngrade(
        string $id,
        string $tenantId,
        string $subscriptionId,
        ?string $calculationId,
        int $amountCents,
        string $currency
    ): string {
        $this->creditModel->insert([
            'id'                        => $id,
            'tenant_id'                 => $tenantId,
            'proration_calculation_id'  => $calculationId,
            'subscription_id'           => $subscriptionId,
            'initial_amount_cents'      => $amountCents,
            'remaining_amount_cents'    => $amountCents,
            'currency'                  => $currency,
            'reason'                    => 'downgrade_proration',
            'status'                    => 'active',
            'expires_at'                => null,
        ]);

        return $id;
    }
}
