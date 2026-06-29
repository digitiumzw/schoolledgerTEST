<?php

namespace App\Models;

use CodeIgniter\Model;

class UserTutorialProgressModel extends Model
{
    protected $table = 'user_tutorial_progress';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $useTimestamps = true;
    protected $createdField = 'created_at';
    protected $updatedField = 'updated_at';

    protected $allowedFields = [
        'tenant_id',
        'user_id',
        'status',
        'started_at',
        'completed_at',
        'dismissed_at',
        'last_seen_step',
        'seen_module_keys',
    ];

    public function getForUser(string $tenantId, string $userId): ?array
    {
        $row = $this->where('tenant_id', $tenantId)
            ->where('user_id', $userId)
            ->first();

        return $row ?: null;
    }

    public function ensureForUser(string $tenantId, string $userId): array
    {
        $existing = $this->getForUser($tenantId, $userId);
        if ($existing) {
            return $existing;
        }

        $this->insert([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'status' => 'not_started',
            'seen_module_keys' => json_encode([]),
        ]);

        return $this->getForUser($tenantId, $userId) ?? [];
    }

    public function decodeSeenModuleKeys(?array $row): array
    {
        if (!$row || empty($row['seen_module_keys'])) {
            return [];
        }

        return json_decode($row['seen_module_keys'], true) ?: [];
    }
}
