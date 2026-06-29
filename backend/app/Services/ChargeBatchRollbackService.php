<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;
use RuntimeException;

class ChargeBatchRollbackService
{
    public const FEE_RULE_CHARGE_TYPE = 'fee_structure';
    public const TRANSPORT_CHARGE_TYPE = 'transport';

    private BaseConnection $db;

    public function __construct(BaseConnection $db)
    {
        $this->db = $db;
    }

    public function createBillingRun(
        string $tenantId,
        string $chargeType,
        string $periodKey,
        string $periodLabel,
        string $descriptionLabel,
        ?string $termId,
        ?string $academicYear,
        ?string $generatedBy,
        string $runPrefix = 'run_'
    ): string {
        $now = date('Y-m-d H:i:s');
        $id = $this->generateId($runPrefix);

        $row = [
            'id' => $id,
            'tenant_id' => $tenantId,
            'term_id' => $termId ?: $periodKey,
            'academic_year' => $academicYear ?? $this->extractYear($periodKey) ?? date('Y'),
            'status' => 'completed',
            'total_students' => 0,
            'total_amount' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ];

        if ($this->fieldExists('billing_runs', 'total_charges')) $row['total_charges'] = 0;
        if ($this->fieldExists('billing_runs', 'created_by')) $row['created_by'] = $generatedBy;
        if ($this->fieldExists('billing_runs', 'charge_type')) $row['charge_type'] = $chargeType;
        if ($this->fieldExists('billing_runs', 'period_key')) $row['period_key'] = $periodKey;
        if ($this->fieldExists('billing_runs', 'period_label')) $row['period_label'] = $periodLabel;
        if ($this->fieldExists('billing_runs', 'description_label')) $row['description_label'] = $descriptionLabel;
        if ($this->fieldExists('billing_runs', 'generated_by')) $row['generated_by'] = $generatedBy;
        if ($this->fieldExists('billing_runs', 'generated_at')) $row['generated_at'] = $now;
        if ($this->fieldExists('billing_runs', 'run_type')) $row['run_type'] = 'primary';

        $this->db->table('billing_runs')->insert($row);

        return $id;
    }

    public function updateBillingRunTotals(string $tenantId, string $billingRunId, int $chargeCount, int $studentCount, float $totalAmount): void
    {
        $update = [
            'total_students' => $studentCount,
            'total_amount' => $totalAmount,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($this->fieldExists('billing_runs', 'total_charges')) {
            $update['total_charges'] = $chargeCount;
        }

        $this->db->table('billing_runs')
            ->where('tenant_id', $tenantId)
            ->where('id', $billingRunId)
            ->update($update);
    }

    public function getLatestBatch(string $tenantId, string $chargeType): ?array
    {
        $run = $this->getLatestRun($tenantId, $chargeType);
        if (!$run) {
            return null;
        }

        return $this->formatBatch($run, $chargeType);
    }

    public function voidLatestBatch(string $tenantId, string $chargeType, ?string $voidedBy, ?string $reason = null): array
    {
        $this->db->transBegin();
        $rolledBack = false;

        try {
            $run = $this->getLatestRun($tenantId, $chargeType);
            if (!$run) {
                $this->db->transRollback();
                $rolledBack = true;
                throw new RuntimeException('NO_ACTIVE_BATCH');
            }

            $summary = $this->summarizeCharges((string) $run['id'], $tenantId, $chargeType);
            if ((int) $summary['charge_count'] === 0) {
                $this->db->transRollback();
                $rolledBack = true;
                throw new RuntimeException('NO_ACTIVE_BATCH');
            }

            $now = date('Y-m-d H:i:s');
            $chargeUpdate = [
                'voided_at' => $now,
                'updated_at' => $now,
            ];
            if ($this->fieldExists('charges', 'voided_by')) {
                $chargeUpdate['voided_by'] = $voidedBy;
            }

            $this->db->table('charges')
                ->where('tenant_id', $tenantId)
                ->where('billing_run_id', $run['id'])
                ->where('charge_type', $chargeType)
                ->where('deleted_at', null)
                ->where('voided_at', null)
                ->update($chargeUpdate);

            $affected = $this->db->affectedRows();
            if ($affected !== (int) $summary['charge_count']) {
                $this->db->transRollback();
                $rolledBack = true;
                throw new RuntimeException('BATCH_CHANGED');
            }

            $runUpdate = [
                'status' => 'voided',
                'voided_at' => $now,
                'voided_by' => $voidedBy,
                'void_reason' => $reason,
                'updated_at' => $now,
            ];
            if ($this->fieldExists('billing_runs', 'void_details')) {
                $runUpdate['void_details'] = json_encode([
                    'chargeType' => $chargeType,
                    'chargeCount' => (int) $summary['charge_count'],
                    'affectedStudentCount' => (int) $summary['affected_student_count'],
                    'totalAmount' => (float) $summary['total_amount'],
                    'reason' => $reason,
                ]);
            }

            $this->db->table('billing_runs')
                ->where('tenant_id', $tenantId)
                ->where('id', $run['id'])
                ->where('status !=', 'voided')
                ->update($runUpdate);

            if ($this->db->affectedRows() !== 1) {
                $this->db->transRollback();
                $rolledBack = true;
                throw new RuntimeException('BATCH_CHANGED');
            }

            $this->logAuditAction($tenantId, $run, $summary, $voidedBy, $reason, $now);

            $this->db->transCommit();

            return [
                'batchId' => $run['id'],
                'chargeType' => $chargeType,
                'periodLabel' => $this->resolveRunPeriodLabel($run, $chargeType),
                'descriptionLabel' => $this->resolveRunDescriptionLabel($run, $chargeType),
                'chargeCount' => (int) $summary['charge_count'],
                'affectedStudentCount' => (int) $summary['affected_student_count'],
                'totalAmount' => (float) $summary['total_amount'],
                'voidedAt' => $now,
            ];
        } catch (RuntimeException $e) {
            if (!$rolledBack) {
                $this->db->transRollback();
            }
            throw $e;
        } catch (\Throwable $e) {
            if (!$rolledBack) {
                $this->db->transRollback();
            }
            throw $e;
        }
    }

    public function buildFeeRuleLabels(string $billingPeriod, ?array $calendar = null): array
    {
        $year = $this->extractAcademicYear($calendar) ?? $this->extractYear($billingPeriod) ?? date('Y');
        $termNumber = $this->extractTermNumber($billingPeriod, $calendar);
        $periodLabel = sprintf('TERM-%s-%s', $termNumber, $year);

        return [
            'periodKey' => $billingPeriod,
            'periodLabel' => $periodLabel,
            'descriptionLabel' => $periodLabel . ' Tuition Charges',
            'termId' => $this->resolveTermId($billingPeriod, $calendar),
            'academicYear' => $year,
        ];
    }

    public function buildTransportLabels(string $month, ?array $calendar = null): array
    {
        $year = substr($month, 0, 4);
        $monthName = strtoupper(date('F', strtotime($month . '-01')));
        $termNumber = $this->extractTermNumber($month, $calendar);
        $periodLabel = sprintf('TERM-%s-%s-%s', $termNumber, $monthName, $year);

        return [
            'periodKey' => $month,
            'periodLabel' => $periodLabel,
            'descriptionLabel' => $periodLabel . ' Transport Charges',
            'termId' => $this->resolveTermIdForDate($month . '-01', $calendar),
            'academicYear' => $year,
        ];
    }

    private function getLatestRun(string $tenantId, string $chargeType): ?array
    {
        $builder = $this->db->table('billing_runs br')
            ->select('br.*')
            ->join('charges c', 'c.billing_run_id = br.id AND c.tenant_id = br.tenant_id', 'inner')
            ->where('br.tenant_id', $tenantId)
            ->where('br.status !=', 'voided')
            ->where('c.charge_type', $chargeType)
            ->where('c.deleted_at', null)
            ->where('c.voided_at', null)
            ->orderBy($this->fieldExists('billing_runs', 'generated_at') ? 'br.generated_at' : 'br.created_at', 'DESC')
            ->orderBy('br.created_at', 'DESC')
            ->limit(1);

        if ($this->fieldExists('billing_runs', 'charge_type')) {
            $builder->where('br.charge_type', $chargeType);
        }

        return $builder->get()->getRowArray() ?: null;
    }

    private function formatBatch(array $run, string $chargeType): array
    {
        $summary = $this->summarizeCharges((string) $run['id'], (string) $run['tenant_id'], $chargeType);
        $periodLabel = $this->resolveRunPeriodLabel($run, $chargeType);

        return [
            'id' => $run['id'],
            'chargeType' => $chargeType,
            'periodKey' => $run['period_key'] ?? ($chargeType === self::TRANSPORT_CHARGE_TYPE ? null : ($run['term_id'] ?? null)),
            'periodLabel' => $periodLabel,
            'descriptionLabel' => $this->resolveRunDescriptionLabel($run, $chargeType),
            'generatedAt' => $run['generated_at'] ?? $run['created_at'] ?? null,
            'generatedBy' => $run['generated_by'] ?? $run['created_by'] ?? null,
            'chargeCount' => (int) $summary['charge_count'],
            'affectedStudentCount' => (int) $summary['affected_student_count'],
            'totalAmount' => (float) $summary['total_amount'],
            'canVoid' => (int) $summary['charge_count'] > 0,
            'blockedReason' => null,
        ];
    }

    private function summarizeCharges(string $billingRunId, string $tenantId, string $chargeType): array
    {
        $row = $this->db->table('charges')
            ->select('COUNT(*) AS charge_count, COUNT(DISTINCT student_id) AS affected_student_count, COALESCE(SUM(amount), 0) AS total_amount')
            ->where('tenant_id', $tenantId)
            ->where('billing_run_id', $billingRunId)
            ->where('charge_type', $chargeType)
            ->where('deleted_at', null)
            ->where('voided_at', null)
            ->get()->getRowArray();

        return $row ?: ['charge_count' => 0, 'affected_student_count' => 0, 'total_amount' => 0];
    }

    private function resolveRunPeriodLabel(array $run, string $chargeType): string
    {
        if (!empty($run['period_label'])) {
            return (string) $run['period_label'];
        }

        $sample = $this->db->table('charges')
            ->where('billing_run_id', $run['id'])
            ->where('tenant_id', $run['tenant_id'])
            ->where('charge_type', $chargeType)
            ->orderBy('created_at', 'ASC')
            ->get()->getRowArray();

        if ($chargeType === self::TRANSPORT_CHARGE_TYPE && !empty($sample['academic_session'])) {
            return $this->buildTransportLabels((string) $sample['academic_session'])['periodLabel'];
        }

        return $this->buildFeeRuleLabels((string) ($sample['billing_period'] ?? $run['term_id'] ?? 'term-1'))['periodLabel'];
    }

    private function resolveRunDescriptionLabel(array $run, string $chargeType): string
    {
        if (!empty($run['description_label'])) {
            return (string) $run['description_label'];
        }

        return $this->resolveRunPeriodLabel($run, $chargeType) . ($chargeType === self::TRANSPORT_CHARGE_TYPE ? ' Transport Charges' : ' Tuition Charges');
    }

    private function logAuditAction(string $tenantId, array $run, array $summary, ?string $performedBy, ?string $reason, string $now): void
    {
        if (!$this->tableExists('reconciliation_audit_log')) {
            return;
        }

        $this->db->table('reconciliation_audit_log')->insert([
            'id' => $this->generateId('audit'),
            'tenant_id' => $tenantId,
            'action_type' => 'charge_batch_voided',
            'entity_type' => 'billing_run',
            'entity_id' => $run['id'],
            'student_id' => null,
            'amount' => (float) $summary['total_amount'],
            'balance_before' => null,
            'balance_after' => null,
            'details' => json_encode([
                'chargeType' => $run['charge_type'] ?? null,
                'periodLabel' => $this->resolveRunPeriodLabel($run, $run['charge_type'] ?? self::FEE_RULE_CHARGE_TYPE),
                'chargeCount' => (int) $summary['charge_count'],
                'affectedStudentCount' => (int) $summary['affected_student_count'],
                'reason' => $reason,
            ]),
            'ip_address' => null,
            'user_agent' => null,
            'performed_by' => $performedBy ?: 'system',
            'performed_at' => $now,
        ]);
    }

    private function extractTermNumber(string $value, ?array $calendar = null): string
    {
        if (preg_match('/term[-_ ]?(\d+)/i', $value, $matches)) {
            return $matches[1];
        }

        if ($calendar && preg_match('/^\d{4}-\d{2}$/', $value)) {
            $termId = $this->resolveTermIdForDate($value . '-01', $calendar);
            if ($termId && preg_match('/(\d+)/', $termId, $matches)) {
                return $matches[1];
            }

            $month = (int) substr($value, 5, 2);
            if ($month >= 1 && $month <= 4) {
                return '1';
            }
            if ($month >= 5 && $month <= 8) {
                return '2';
            }
            return '3';
        }

        if ($calendar && !empty($calendar['currentTerm']['name']) && preg_match('/(\d+)/', $calendar['currentTerm']['name'], $matches)) {
            return $matches[1];
        }

        if ($calendar && !empty($calendar['terms'])) {
            foreach ($calendar['terms'] as $index => $term) {
                if (($term['id'] ?? null) === $value || ($term['name'] ?? null) === $value) {
                    return (string) ($index + 1);
                }
            }
        }

        if (!preg_match('/^\d{4}-\d{2}$/', $value) && preg_match('/(\d+)/', $value, $matches)) {
            return $matches[1];
        }

        return '1';
    }

    private function resolveTermId(string $value, ?array $calendar = null): ?string
    {
        if (!$calendar || empty($calendar['terms'])) {
            return preg_match('/term/i', $value) ? $value : null;
        }

        foreach ($calendar['terms'] as $term) {
            if (($term['id'] ?? null) === $value || ($term['name'] ?? null) === $value) {
                return $term['id'] ?? null;
            }
        }

        return $calendar['currentTerm']['id'] ?? null;
    }

    private function resolveTermIdForDate(string $date, ?array $calendar = null): ?string
    {
        if (!$calendar || empty($calendar['terms'])) {
            return null;
        }

        foreach ($calendar['terms'] as $term) {
            if (!empty($term['start']) && !empty($term['end']) && $date >= $term['start'] && $date <= $term['end']) {
                return $term['id'] ?? null;
            }
        }

        return $calendar['currentTerm']['id'] ?? null;
    }

    private function extractAcademicYear(?array $calendar): ?string
    {
        foreach (['academicYear', 'currentYear', 'year'] as $key) {
            if (!empty($calendar[$key])) {
                return (string) $calendar[$key];
            }
        }

        return null;
    }

    private function extractYear(string $value): ?string
    {
        return preg_match('/(20\d{2})/', $value, $matches) ? $matches[1] : null;
    }

    private function generateId(string $prefix): string
    {
        return $prefix . time() . '_' . bin2hex(random_bytes(4));
    }

    private function fieldExists(string $table, string $field): bool
    {
        return $this->db->fieldExists($field, $table);
    }

    private function tableExists(string $table): bool
    {
        return $this->db->tableExists($table);
    }
}
