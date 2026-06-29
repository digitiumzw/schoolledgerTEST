<?php

namespace App\Models;

use CodeIgniter\Model;

class ProrationCalculationModel extends Model
{
    protected $table            = 'proration_calculations';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $useTimestamps    = true;
    protected $allowedFields    = [
        'id', 'tenant_id', 'original_subscription_id', 'new_subscription_id',
        'original_plan_id', 'new_plan_id', 'billing_cycle', 'change_type', 'policy_code',
        'cycle_start_date', 'cycle_end_date', 'days_in_cycle', 'days_remaining',
        'original_plan_price_cents', 'new_plan_price_cents',
        'unused_value_credit_cents', 'prorated_charge_cents', 'net_amount_cents',
        'calculation_formula', 'status', 'confirmed_at', 'cancelled_at',
    ];

    public function getForTenant(string $tenantId, int $page = 1, int $perPage = 20): array
    {
        $offset = ($page - 1) * $perPage;
        $total  = $this->where('tenant_id', $tenantId)->countAllResults(false);
        $items  = $this->where('tenant_id', $tenantId)
                       ->orderBy('created_at', 'DESC')
                       ->limit($perPage, $offset)
                       ->findAll();

        return ['calculations' => $items, 'total' => $total];
    }

    public function findByTenant(string $id, string $tenantId): ?array
    {
        return $this->where('id', $id)
                    ->where('tenant_id', $tenantId)
                    ->first();
    }

    public function isExpired(array $calculation): bool
    {
        $createdAt = strtotime($calculation['created_at']);
        return (time() - $createdAt) > 1800; // 30 minutes
    }
}
