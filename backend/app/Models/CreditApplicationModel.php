<?php

namespace App\Models;

use CodeIgniter\Model;

class CreditApplicationModel extends Model
{
    protected $table            = 'credit_applications';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $useTimestamps    = false;
    protected $allowedFields    = [
        'id', 'credit_id', 'transaction_id', 'amount_applied_cents', 'applied_at',
    ];

    public function getForCredit(string $creditId): array
    {
        return $this->where('credit_id', $creditId)->findAll();
    }
}
