<?php

namespace App\Models;

use CodeIgniter\Model;

class FeeCampaignModel extends Model
{
    protected $table = 'fee_campaigns';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $allowedFields = [
        'id', 'tenant_id', 'name', 'description',
        'target_scope_type', 'target_scope_id',
        'amount', 'due_date', 'status', 'created_by',
        'created_at', 'updated_at',
    ];
    protected $useTimestamps = true;

    public function getByTenant(string $tenantId, ?string $status = null): array
    {
        $builder = $this->where('tenant_id', $tenantId);
        if ($status !== null) {
            $builder->where('status', $status);
        }
        return $builder->orderBy('created_at', 'DESC')->findAll();
    }

    public function getByIdAndTenant(string $id, string $tenantId): ?array
    {
        return $this->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->first();
    }

    /**
     * Aggregate summary for a single campaign.
     *
     * Returns student counts and financial totals from campaign_students.
     */
    public function getSummary(string $campaignId, string $tenantId): array
    {
        $row = $this->db->table('campaign_students')
            ->select("
                COUNT(*)                                          AS total_students,
                COALESCE(SUM(expected_amount), 0)                 AS total_expected,
                COALESCE(SUM(paid_amount), 0)                     AS total_collected,
                COALESCE(SUM(expected_amount - paid_amount), 0)   AS total_outstanding,
                SUM(CASE WHEN status = 'fully_paid'     THEN 1 ELSE 0 END) AS fully_paid_count,
                SUM(CASE WHEN status = 'partially_paid' THEN 1 ELSE 0 END) AS partially_paid_count,
                SUM(CASE WHEN status = 'unpaid'         THEN 1 ELSE 0 END) AS unpaid_count
            ", false)
            ->where('fee_campaign_id', $campaignId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$row) {
            return [
                'totalStudents'      => 0,
                'totalExpected'      => 0.0,
                'totalCollected'     => 0.0,
                'totalOutstanding'   => 0.0,
                'fullyPaidCount'     => 0,
                'partiallyPaidCount' => 0,
                'unpaidCount'        => 0,
            ];
        }

        return [
            'totalStudents'      => (int) $row['total_students'],
            'totalExpected'      => (float) $row['total_expected'],
            'totalCollected'     => (float) $row['total_collected'],
            'totalOutstanding'   => (float) $row['total_outstanding'],
            'fullyPaidCount'     => (int) $row['fully_paid_count'],
            'partiallyPaidCount' => (int) $row['partially_paid_count'],
            'unpaidCount'        => (int) $row['unpaid_count'],
        ];
    }

    /**
     * Batch aggregate summaries for multiple campaigns in a single GROUP BY query.
     * Replaces N separate getSummary() calls, eliminating the N+1 pattern.
     *
     * @param string[] $ids
     * @return array<string, array>  keyed by campaign id
     */
    public function getSummariesByCampaignIds(array $ids, string $tenantId): array
    {
        if (empty($ids)) {
            return [];
        }

        $rows = $this->db->table('campaign_students')
            ->select("
                fee_campaign_id,
                COUNT(*)                                          AS total_students,
                COALESCE(SUM(expected_amount), 0)                 AS total_expected,
                COALESCE(SUM(paid_amount), 0)                     AS total_collected,
                COALESCE(SUM(expected_amount - paid_amount), 0)   AS total_outstanding,
                SUM(CASE WHEN status = 'fully_paid'     THEN 1 ELSE 0 END) AS fully_paid_count,
                SUM(CASE WHEN status = 'partially_paid' THEN 1 ELSE 0 END) AS partially_paid_count,
                SUM(CASE WHEN status = 'unpaid'         THEN 1 ELSE 0 END) AS unpaid_count
            ", false)
            ->whereIn('fee_campaign_id', $ids)
            ->where('tenant_id', $tenantId)
            ->groupBy('fee_campaign_id')
            ->get()
            ->getResultArray();

        $empty = [
            'totalStudents'      => 0,
            'totalExpected'      => 0.0,
            'totalCollected'     => 0.0,
            'totalOutstanding'   => 0.0,
            'fullyPaidCount'     => 0,
            'partiallyPaidCount' => 0,
            'unpaidCount'        => 0,
        ];

        $map = [];
        foreach ($rows as $row) {
            $map[$row['fee_campaign_id']] = [
                'totalStudents'      => (int) $row['total_students'],
                'totalExpected'      => (float) $row['total_expected'],
                'totalCollected'     => (float) $row['total_collected'],
                'totalOutstanding'   => (float) $row['total_outstanding'],
                'fullyPaidCount'     => (int) $row['fully_paid_count'],
                'partiallyPaidCount' => (int) $row['partially_paid_count'],
                'unpaidCount'        => (int) $row['unpaid_count'],
            ];
        }

        $result = [];
        foreach ($ids as $id) {
            $result[$id] = $map[$id] ?? $empty;
        }
        return $result;
    }

    /**
     * Decode target_scope_id — may be a JSON array or a scalar string.
     */
    public function decodeScopeId($value)
    {
        if ($value === null || $value === '') {
            return null;
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : $value;
    }

    public function formatForApi(array $row): array
    {
        if (empty($row)) {
            return [];
        }

        return [
            'id'              => $row['id'],
            'tenantId'        => $row['tenant_id'],
            'name'            => $row['name'],
            'description'     => $row['description'] ?? null,
            'targetScopeType' => $row['target_scope_type'],
            'targetScopeId'   => $this->decodeScopeId($row['target_scope_id'] ?? null),
            'amount'          => (float) $row['amount'],
            'dueDate'         => $row['due_date'] ?? null,
            'status'          => $row['status'],
            'createdBy'       => $row['created_by'] ?? null,
            'createdAt'       => $row['created_at'] ?? null,
            'updatedAt'       => $row['updated_at'] ?? null,
        ];
    }
}
