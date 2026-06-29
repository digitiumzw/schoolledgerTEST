<?php

namespace App\Services;

/**
 * ChargeProrationHelper — stateless helper for charge proration calculations.
 *
 * Feature: 060-charge-proration-toggle
 *
 * Encapsulates the day-fraction formula so that both FeeRuleBillingService
 * and TransportController can call the same logic without duplication.
 *
 * Formula (research.md D3):
 *   effective_start  = max(period_start, student_start)
 *   remaining_days   = (period_end - effective_start) + 1  (inclusive)
 *   total_days       = (period_end - period_start) + 1
 *   prorated_amount  = floor(remaining_days / total_days × full_amount)
 *
 * Fallback rules:
 *   - If $studentStart is null/empty → return full charge (wasProrated = false).
 *   - If $studentStart ≤ $periodStart → full charge (student was present from start).
 *   - If $studentStart > $periodEnd   → zero charge (student not yet active this period).
 *   - Invalid date strings            → log warning, return full charge.
 */
class ChargeProrationHelper
{
    /**
     * Calculate a (possibly prorated) charge amount.
     *
     * @param float       $fullAmount   The standard full-period charge amount.
     * @param string      $periodStart  Period start date in 'Y-m-d' format.
     * @param string      $periodEnd    Period end date in 'Y-m-d' format.
     * @param string|null $studentStart Student's service start date in 'Y-m-d' format (or null).
     *
     * @return array{amount: float, wasProrated: bool, remainingDays: int, totalDays: int}
     */
    public static function calculate(
        float   $fullAmount,
        string  $periodStart,
        string  $periodEnd,
        ?string $studentStart
    ): array {
        $full = ['amount' => $fullAmount, 'wasProrated' => false, 'remainingDays' => 0, 'totalDays' => 0];

        if (empty($studentStart)) {
            log_message('debug', 'ChargeProrationHelper: studentStart is null/empty — returning full charge');
            return $full;
        }

        try {
            $start  = new \DateTime($periodStart);
            $end    = new \DateTime($periodEnd);
            $sStart = new \DateTime($studentStart);
        } catch (\Exception $e) {
            log_message('warning', 'ChargeProrationHelper: invalid date string — ' . $e->getMessage() . ' — returning full charge');
            return $full;
        }

        $totalDays = (int) $start->diff($end)->days + 1;

        if ($sStart <= $start) {
            $full['totalDays'] = $totalDays;
            return $full;
        }

        if ($sStart > $end) {
            return ['amount' => 0.0, 'wasProrated' => true, 'remainingDays' => 0, 'totalDays' => $totalDays];
        }

        $remainingDays   = (int) $sStart->diff($end)->days + 1;
        $proratedAmount  = (float) floor($remainingDays / $totalDays * $fullAmount);

        return [
            'amount'        => $proratedAmount,
            'wasProrated'   => $proratedAmount < $fullAmount,
            'remainingDays' => $remainingDays,
            'totalDays'     => $totalDays,
        ];
    }
}
