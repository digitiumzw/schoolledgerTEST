<?php

namespace App\Models;

use CodeIgniter\Model;

class UserDashboardPreferenceModel extends Model
{
    protected $table            = 'user_dashboard_preferences';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useTimestamps    = true;
    protected $allowedFields    = [
        'user_id', 'tenant_id', 'widget_key', 'is_visible',
        'position_x', 'position_y', 'width', 'height', 'custom_config',
    ];

    public function getForUser(string $tenantId, string $userId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->orderBy('position_y', 'ASC')
            ->orderBy('position_x', 'ASC')
            ->findAll();
    }
}
