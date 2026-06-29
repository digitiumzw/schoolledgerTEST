<?php

namespace App\Models;

use CodeIgniter\Model;

class SetupGuideProgressModel extends Model
{
    protected $table = 'setup_guide_progress';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $useTimestamps = true;
    protected $createdField = 'created_at';
    protected $updatedField = 'updated_at';

    protected $allowedFields = [
        'tenant_id',
        'current_step',
        'step_statuses',
        'dismissed_at',
        'completed_at',
    ];

    public function getForTenant(string $tenantId): ?array
    {
        $row = $this->where('tenant_id', $tenantId)->first();
        return $row ?: null;
    }

    public function upsertForTenant(string $tenantId, ?string $currentStep, array $stepStatuses, ?string $dismissedAt = null, ?string $completedAt = null): void
    {
        $existing = $this->getForTenant($tenantId);
        $payload = [
            'tenant_id' => $tenantId,
            'current_step' => $currentStep,
            'step_statuses' => json_encode($stepStatuses),
            'dismissed_at' => $dismissedAt,
            'completed_at' => $completedAt,
        ];

        if ($existing) {
            $this->update($existing['id'], $payload);
            return;
        }

        $this->insert($payload);
    }

    public function decodeStepStatuses(?array $row): array
    {
        if (!$row || empty($row['step_statuses'])) {
            return [];
        }

        return json_decode($row['step_statuses'], true) ?: [];
    }
}
