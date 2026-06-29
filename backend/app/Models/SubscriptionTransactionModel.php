<?php

namespace App\Models;

use CodeIgniter\Model;

class SubscriptionTransactionModel extends Model
{
    protected $table            = 'subscription_payment_transactions';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $useTimestamps    = true;
    protected $allowedFields    = [
        'id', 'tenant_id', 'subscription_id', 'paynow_reference',
        'paynow_poll_url', 'our_reference', 'amount_cents', 'currency',
        'status', 'paynow_status_raw', 'paynow_hash_verified',
        'webhook_payload', 'initiated_at', 'completed_at',
    ];

    public function findByOurReference(string $ref): ?array
    {
        return $this->where('our_reference', $ref)->first();
    }

    public function findByPaynowReference(string $ref): ?array
    {
        return $this->where('paynow_reference', $ref)->first();
    }

    public function getForSubscription(string $subscriptionId): array
    {
        return $this->where('subscription_id', $subscriptionId)
                    ->orderBy('created_at', 'DESC')
                    ->findAll();
    }

    public function cancelInitiatedForTenant(string $tenantId): void
    {
        $now = date('Y-m-d H:i:s');
        $this->where('tenant_id', $tenantId)
             ->where('status', 'initiated')
             ->set(['status' => 'cancelled', 'completed_at' => $now, 'updated_at' => $now])
             ->update();
    }

    public function getAllForTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
                    ->orderBy('created_at', 'DESC')
                    ->findAll();
    }
}
