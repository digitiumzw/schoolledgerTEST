<?php

namespace App\Models;

use CodeIgniter\Model;

class SchoolSubscriptionModel extends Model
{
    protected $table            = 'school_subscriptions';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $useTimestamps    = true;
    protected $allowedFields    = [
        'id', 'tenant_id', 'plan_id', 'billing_cycle', 'status',
        'pending_plan_id', 'pending_change_effective_at', 'pending_change_type',
        'starts_at', 'expires_at', 'amount_paid_cents', 'currency',
        'activated_at', 'cancelled_at', 'expiration_notification_sent_at',
    ];

    public function getActiveForTenant(string $tenantId): ?array
    {
        return $this->where('tenant_id', $tenantId)
                    ->where('status', 'active')
                    ->first();
    }

    public function getLatestForTenant(string $tenantId): ?array
    {
        return $this->where('tenant_id', $tenantId)
                    ->orderBy('created_at', 'DESC')
                    ->first();
    }

    public function hasActiveSubscription(string $tenantId): bool
    {
        return $this->where('tenant_id', $tenantId)
                    ->where('status', 'active')
                    ->countAllResults() > 0;
    }

    public function hasActiveAnnualSubscription(string $tenantId): bool
    {
        return $this->where('tenant_id', $tenantId)
                    ->where('status', 'active')
                    ->where('billing_cycle', 'annual')
                    ->countAllResults() > 0;
    }

    public function getPendingChanges(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
                    ->where('status', 'active')
                    ->where('pending_plan_id IS NOT NULL')
                    ->findAll();
    }

    public function clearPendingChanges(string $tenantId): void
    {
        $this->where('tenant_id', $tenantId)
             ->where('status', 'active')
             ->set([
                 'pending_plan_id'             => null,
                 'pending_change_effective_at' => null,
                 'pending_change_type'         => null,
                 'updated_at'                  => date('Y-m-d H:i:s'),
             ])
             ->update();
    }

    public function deactivateAllForTenant(string $tenantId, string $newStatus): void
    {
        $now = date('Y-m-d H:i:s');
        $this->where('tenant_id', $tenantId)
             ->whereIn('status', ['active', 'pending'])
             ->set(['status' => $newStatus, 'updated_at' => $now])
             ->update();
    }

    public function cancelPendingForTenant(string $tenantId): void
    {
        $now = date('Y-m-d H:i:s');
        $this->where('tenant_id', $tenantId)
             ->where('status', 'pending')
             ->set(['status' => 'cancelled', 'cancelled_at' => $now, 'updated_at' => $now])
             ->update();
    }

    public function getAllForTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
                    ->orderBy('created_at', 'DESC')
                    ->findAll();
    }

    /**
     * Find active subscriptions that expire within the specified number of days
     * and haven't been notified yet.
     *
     * @param int $days Number of days threshold (default: 7)
     * @return array Array of subscription records
     */
    public function findExpiringSubscriptions(int $days = 7): array
    {
        $now = date('Y-m-d H:i:s');
        $threshold = date('Y-m-d H:i:s', strtotime("+{$days} days"));

        return $this->where('status', 'active')
                    ->where('expires_at IS NOT NULL')
                    ->where('expires_at >=', $now)
                    ->where('expires_at <=', $threshold)
                    ->where('expiration_notification_sent_at', null)
                    ->findAll();
    }
}
