<?php

namespace App\Models;

use CodeIgniter\Model;

class CampaignStudentModel extends Model
{
    protected $table = 'campaign_students';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $allowedFields = [
        'id', 'tenant_id', 'fee_campaign_id', 'student_id',
        'expected_amount', 'paid_amount', 'status',
        'created_at', 'updated_at',
    ];
    protected $useTimestamps = true;

    public function getByCampaign(string $campaignId, string $tenantId, ?string $status = null): array
    {
        $builder = $this->where('fee_campaign_id', $campaignId)
            ->where('tenant_id', $tenantId);
        if ($status !== null) {
            $builder->where('status', $status);
        }
        return $builder->orderBy('created_at', 'ASC')->findAll();
    }

    public function getByStudentAndTenant(string $studentId, string $tenantId): array
    {
        return $this->where('student_id', $studentId)
            ->where('tenant_id', $tenantId)
            ->orderBy('created_at', 'DESC')
            ->findAll();
    }

    public function getByCampaignAndStudent(string $campaignId, string $studentId): ?array
    {
        return $this->where('fee_campaign_id', $campaignId)
            ->where('student_id', $studentId)
            ->first();
    }

    public function formatForApi(array $row): array
    {
        if (empty($row)) {
            return [];
        }

        $expected  = (float) ($row['expected_amount'] ?? 0);
        $paid      = (float) ($row['paid_amount'] ?? 0);

        return [
            'id'              => $row['id'],
            'tenantId'        => $row['tenant_id'],
            'feeCampaignId'   => $row['fee_campaign_id'],
            'studentId'       => $row['student_id'],
            'expectedAmount'  => $expected,
            'paidAmount'      => $paid,
            'remainingAmount' => max(0, $expected - $paid),
            'status'          => $row['status'],
            'createdAt'       => $row['created_at'] ?? null,
            'updatedAt'       => $row['updated_at'] ?? null,
        ];
    }
}
