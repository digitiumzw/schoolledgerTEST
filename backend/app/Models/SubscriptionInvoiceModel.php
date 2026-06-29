<?php

namespace App\Models;

use CodeIgniter\Model;

class SubscriptionInvoiceModel extends Model
{
    protected $table            = 'subscription_invoices';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $useTimestamps    = true;
    protected $allowedFields    = [
        'id', 'tenant_id', 'subscription_id', 'transaction_id',
        'invoice_number', 'school_name', 'plan_name', 'billing_cycle',
        'amount_cents', 'currency', 'issued_at', 'pdf_path',
    ];

    public function getForTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
                    ->orderBy('issued_at', 'DESC')
                    ->findAll();
    }

    public function findByTransactionId(string $txId): ?array
    {
        return $this->where('transaction_id', $txId)->first();
    }
}
