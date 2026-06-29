<?php

namespace App\Models;

use CodeIgniter\Model;

class SubscriptionPlanModel extends Model
{
    protected $table          = 'subscription_plans';
    protected $primaryKey     = 'id';
    protected $useAutoIncrement = false;
    protected $useTimestamps  = true;
    protected $allowedFields  = [
        'id', 'name', 'description', 'max_students',
        'monthly_price_cents', 'annual_price_cents', 'annual_discount_pct', 'currency',
        'is_active', 'sort_order',
    ];

    public function getActivePlans(): array
    {
        return $this->where('is_active', 1)
                    ->orderBy('sort_order', 'ASC')
                    ->findAll();
    }

    public function getPlanById(string $id): ?array
    {
        return $this->where('id', $id)->where('is_active', 1)->first();
    }
}
