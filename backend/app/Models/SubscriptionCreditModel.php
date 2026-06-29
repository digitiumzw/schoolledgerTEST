<?php

namespace App\Models;

use CodeIgniter\Model;

class SubscriptionCreditModel extends Model
{
    protected $table            = 'subscription_credits';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $useTimestamps    = true;
    protected $allowedFields    = [
        'id', 'tenant_id', 'proration_calculation_id', 'subscription_id',
        'initial_amount_cents', 'remaining_amount_cents', 'currency',
        'reason', 'status', 'expires_at',
    ];

    public function getActiveForTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
                    ->where('status', 'active')
                    ->orderBy('created_at', 'DESC')
                    ->findAll();
    }

    public function getTotalForTenant(string $tenantId): int
    {
        $result = $this->selectSum('remaining_amount_cents')
                       ->where('tenant_id', $tenantId)
                       ->where('status', 'active')
                       ->first();

        return (int) ($result['remaining_amount_cents'] ?? 0);
    }
}
