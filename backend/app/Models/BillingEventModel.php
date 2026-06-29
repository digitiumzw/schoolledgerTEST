<?php

namespace App\Models;

use CodeIgniter\Model;

class BillingEventModel extends Model
{
    protected $table            = 'billing_events';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $useTimestamps    = true;
    protected $allowedFields    = [
        'id', 'tenant_id', 'event_type', 'plan_name', 'billing_cycle',
        'amount_cents', 'currency', 'subscription_id', 'transaction_id',
        'occurred_at',
    ];

    private const ALLOWED_TYPES = [
        'payment_confirmed',
        'plan_activated',
        'plan_upgraded',
        'plan_downgraded',
        'subscription_renewed',
        'subscription_expired',
        'billing_cycle_change_blocked',
        'billing_cycle_changed',
        'upgrade_failed',
    ];

    public function getPaginatedForTenant(string $tenantId, int $page, int $perPage): array
    {
        $offset = ($page - 1) * $perPage;

        $events = $this->where('tenant_id', $tenantId)
                       ->whereIn('event_type', self::ALLOWED_TYPES)
                       ->orderBy('occurred_at', 'DESC')
                       ->limit($perPage, $offset)
                       ->findAll();

        $total = $this->where('tenant_id', $tenantId)
                      ->whereIn('event_type', self::ALLOWED_TYPES)
                      ->countAllResults();

        return [
            'events' => $events,
            'total'  => $total,
        ];
    }
}
