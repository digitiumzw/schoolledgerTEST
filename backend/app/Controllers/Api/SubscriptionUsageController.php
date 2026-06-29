<?php

namespace App\Controllers\Api;

use App\Models\SchoolSubscriptionModel;
use App\Models\SubscriptionGraceUsageModel;

/**
 * SubscriptionUsageController
 *
 * Manages the 5-minute-per-hour grace usage window for tenants whose
 * subscription has expired. When a subscription expires the system retains
 * the plan record (status = 'expired') and permits limited access instead of
 * an immediate hard lock.
 *
 * Grace window rules:
 *  - 300 seconds (5 minutes) of access per clock hour.
 *  - Usage is tracked in subscription_grace_usage (one row per tenant per hour).
 *  - The frontend heartbeats every 30 s; each heartbeat adds 30 s to used_seconds.
 *  - When used_seconds >= 300 the response carries allowed = false and the
 *    frontend renders a blur overlay with a renewal CTA.
 */
class SubscriptionUsageController extends BaseApiController
{
    private const GRACE_SECONDS = 300; // 5 minutes per clock hour
    private const HEARTBEAT_SECONDS = 30;

    private SchoolSubscriptionModel $subModel;
    private SubscriptionGraceUsageModel $usageModel;

    public function __construct()
    {
        $this->subModel   = new SchoolSubscriptionModel();
        $this->usageModel = new SubscriptionGraceUsageModel();
    }

    // ─── Public endpoints ────────────────────────────────────────────────────

    /**
     * GET /api/subscription/usage/status
     *
     * Returns the tenant's grace usage state for the current clock hour.
     * Safe to call frequently — does NOT record usage.
     */
    public function status()
    {
        $tenantId = $this->getTenantId();

        if (!$this->isExpiredSubscription($tenantId)) {
            return $this->success($this->activeSubscriptionPayload());
        }

        $bucket = SubscriptionGraceUsageModel::currentBucket();
        $row    = $this->usageModel->getOrCreate($tenantId, $bucket);

        return $this->success($this->buildPayload((int) $row['used_seconds']));
    }

    /**
     * POST /api/subscription/usage/heartbeat
     *
     * Records 30 seconds of usage for the current clock hour and returns the
     * updated state. Called by the frontend every 30 s while the app is active.
     */
    public function heartbeat()
    {
        $tenantId = $this->getTenantId();

        if (!$this->isExpiredSubscription($tenantId)) {
            return $this->success($this->activeSubscriptionPayload());
        }

        $bucket     = SubscriptionGraceUsageModel::currentBucket();
        $row        = $this->usageModel->getOrCreate($tenantId, $bucket);
        $usedBefore = (int) $row['used_seconds'];

        // Only accumulate time while there is remaining allowance
        if ($usedBefore < self::GRACE_SECONDS) {
            $now = date('Y-m-d H:i:s');
            $this->usageModel->addSeconds($row['id'], self::HEARTBEAT_SECONDS, $now);
            $usedSeconds = min(self::GRACE_SECONDS, $usedBefore + self::HEARTBEAT_SECONDS);
        } else {
            $usedSeconds = $usedBefore;
        }

        return $this->success($this->buildPayload($usedSeconds));
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    /**
     * Determines whether the tenant currently has an expired subscription.
     * Handles both DB-synced 'expired' status and stale 'active' records that
     * have passed their expires_at timestamp.
     */
    private function isExpiredSubscription(string $tenantId): bool
    {
        $latest = $this->subModel->getLatestForTenant($tenantId);

        if ($latest === null) {
            return false;
        }

        if ($latest['status'] === 'expired') {
            return true;
        }

        if ($latest['status'] === 'active' && $latest['expires_at'] !== null) {
            return strtotime($latest['expires_at']) < time();
        }

        return false;
    }

    /**
     * Builds the grace usage response payload from the given used_seconds value.
     */
    private function buildPayload(int $usedSeconds): array
    {
        $remainingSeconds = max(0, self::GRACE_SECONDS - $usedSeconds);

        return [
            'gracePeriod'      => true,
            'allowed'          => $remainingSeconds > 0,
            'usedSeconds'      => $usedSeconds,
            'remainingSeconds' => $remainingSeconds,
            'totalSeconds'     => self::GRACE_SECONDS,
            'nextHourAt'       => $this->nextHourTimestamp(),
        ];
    }

    /**
     * Payload returned when the subscription is active (no grace tracking needed).
     */
    private function activeSubscriptionPayload(): array
    {
        return [
            'gracePeriod'      => false,
            'allowed'          => true,
            'usedSeconds'      => 0,
            'remainingSeconds' => null,
            'totalSeconds'     => self::GRACE_SECONDS,
            'nextHourAt'       => null,
        ];
    }

    /**
     * ISO 8601 timestamp for the start of the next clock hour.
     */
    private function nextHourTimestamp(): string
    {
        $nextHour = mktime(date('G') + 1, 0, 0, (int) date('n'), (int) date('j'), (int) date('Y'));
        return date('c', $nextHour);
    }
}
