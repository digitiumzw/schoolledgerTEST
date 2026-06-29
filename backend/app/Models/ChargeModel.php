<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * ChargeModel - Handles fee charges/levies for students
 * 
 * Charges represent fees levied against student accounts (tuition, levies, etc.)
 * Student balance = Total Charges - Total Payments (ledger-based calculation)
 */
class ChargeModel extends Model
{
    protected $table = 'charges';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $allowedFields = [
        'id', 'tenant_id', 'student_id', 'category', 'charge_type', 'status',
        'amount', 'date_generated', 'due_date', 'academic_session', 'term',
        'description', 'generation_batch_id', 'created_by', 'deleted_at', 
        'deletion_reason', 'created_at', 'updated_at', 'route_id', 'term_id',
        'billing_run_id', 'academic_year', 'fee_rule_id', 'billing_period', 'voided_at',
        'voided_by'
    ];
    protected $useTimestamps = true;
    protected $useSoftDeletes = true;
    protected $deletedField = 'deleted_at';

    /**
     * Get all charges for a tenant (excluding soft-deleted)
     */
    public function getByTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('deleted_at IS NULL')
            ->orderBy('date_generated', 'DESC')
            ->findAll();
    }

    /**
     * Get all charges for a specific student
     */
    public function getByStudent(string $studentId): array
    {
        return $this->where('student_id', $studentId)
            ->where('deleted_at IS NULL')
            ->orderBy('date_generated', 'DESC')
            ->findAll();
    }

    /**
     * Get total charges for a tenant (sum of all active charges)
     */
    public function getTotalChargesByTenant(string $tenantId): float
    {
        $result = $this->select('SUM(amount) as total')
            ->where('tenant_id', $tenantId)
            ->where('deleted_at IS NULL')
            ->where('voided_at', null)
            ->first();

        return (float) ($result['total'] ?? 0);
    }

    /**
     * Get total charges for a specific student
     */
    public function getTotalChargesByStudent(string $studentId): float
    {
        $result = $this->select('SUM(amount) as total')
            ->where('student_id', $studentId)
            ->where('deleted_at IS NULL')
            ->where('voided_at', null)
            ->first();

        return (float) ($result['total'] ?? 0);
    }

    /**
     * Get transport charges for a specific student (optionally filtered by route)
     */
    public function getTransportChargesByStudent(string $studentId, string $routeId = null): array
    {
        $builder = $this->where('student_id', $studentId)
            ->where('charge_type', 'transport')
            ->where('deleted_at IS NULL');

        if ($routeId) {
            $builder->where('route_id', $routeId);
        }

        return $builder->orderBy('date_generated', 'DESC')->findAll();
    }

    /**
     * Get total transport charges for a specific student (optionally filtered by route)
     */
    public function getTotalTransportChargesByStudent(string $studentId, string $routeId = null): float
    {
        $builder = $this->select('SUM(amount) as total')
            ->where('student_id', $studentId)
            ->where('charge_type', 'transport')
            ->where('deleted_at IS NULL');

        if ($routeId) {
            $builder->where('route_id', $routeId);
        }

        $result = $builder->first();
        return (float) ($result['total'] ?? 0);
    }

    /**
     * Get charges by status
     */
    public function getByStatus(string $tenantId, string $status): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('status', $status)
            ->where('deleted_at IS NULL')
            ->orderBy('date_generated', 'DESC')
            ->findAll();
    }

    /**
     * Get pending charges for a student
     */
    public function getPendingChargesByStudent(string $studentId): array
    {
        return $this->where('student_id', $studentId)
            ->whereIn('status', ['pending', 'partial'])
            ->where('deleted_at IS NULL')
            ->orderBy('date_generated', 'ASC')
            ->findAll();
    }

    /**
     * Get overdue charges (past due_date and not fully paid)
     */
    public function getOverdueCharges(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('due_date <', date('Y-m-d'))
            ->whereIn('status', ['pending', 'partial'])
            ->where('deleted_at IS NULL')
            ->orderBy('due_date', 'ASC')
            ->findAll();
    }

    /**
     * Update charge status
     */
    public function updateStatus(string $chargeId, string $status): bool
    {
        return $this->update($chargeId, ['status' => $status]);
    }

    /**
     * Get charges by academic session
     */
    public function getByAcademicSession(string $tenantId, string $academicSession): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('academic_session', $academicSession)
            ->where('deleted_at IS NULL')
            ->orderBy('date_generated', 'DESC')
            ->findAll();
    }

    /**
     * Get charges grouped by student for balance calculation
     * Returns: [student_id => total_charges]
     */
    public function getChargesByStudentGrouped(string $tenantId): array
    {
        $results = $this->select('student_id, SUM(amount) as total_charges')
            ->where('tenant_id', $tenantId)
            ->where('deleted_at IS NULL')
            ->where('voided_at', null)
            ->groupBy('student_id')
            ->findAll();

        $grouped = [];
        foreach ($results as $row) {
            $grouped[$row['student_id']] = (float) $row['total_charges'];
        }
        return $grouped;
    }

    /**
     * Format charge for API response (snake_case to camelCase)
     */
    public function formatForApi(array $charge): array
    {
        return [
            'id'                => $charge['id'],
            'tenantId'          => $charge['tenant_id'],
            'studentId'         => $charge['student_id'],
            'category'          => $charge['category'],
            'chargeType'        => $charge['charge_type'] ?? 'other',
            'status'            => $charge['status'] ?? 'pending',
            'amount'            => (float) $charge['amount'],
            'dateGenerated'     => $charge['date_generated'],
            'dueDate'           => $charge['due_date'] ?? null,
            'academicSession'   => $charge['academic_session'] ?? null,
            'term'              => $charge['term'] ?? null,
            'termId'            => $charge['term_id'] ?? null,
            'description'       => $charge['description'] ?? '',
            'generationBatchId' => $charge['generation_batch_id'] ?? null,
            'createdBy'         => $charge['created_by'] ?? null,
            'deletedAt'         => $charge['deleted_at'] ?? null,
            'deletionReason'    => $charge['deletion_reason'] ?? null,
            'routeId'           => $charge['route_id'] ?? null,
            'feeRuleId'         => $charge['fee_rule_id'] ?? null,
            'billingPeriod'     => $charge['billing_period'] ?? null,
        ];
    }

    /**
     * Format API request data for database (camelCase to snake_case)
     */
    public function formatFromApi(array $data, string $tenantId): array
    {
        return [
            'tenant_id'           => $tenantId,
            'student_id'          => $data['studentId'] ?? '',
            'category'            => $data['category'] ?? '',
            'charge_type'         => $data['chargeType'] ?? 'other',
            'status'              => $data['status'] ?? 'pending',
            'amount'              => $data['amount'] ?? 0,
            'date_generated'      => $data['dateGenerated'] ?? date('Y-m-d'),
            'due_date'            => $data['dueDate'] ?? null,
            'academic_session'    => $data['academicSession'] ?? null,
            'term'                => $data['term'] ?? null,
            'term_id'             => $data['termId'] ?? null,
            'description'         => $data['description'] ?? null,
            'generation_batch_id' => $data['generationBatchId'] ?? null,
            'created_by'          => $data['createdBy'] ?? null,
            'route_id'            => $data['routeId'] ?? null,
            'fee_rule_id'         => $data['feeRuleId'] ?? null,
            'billing_period'      => $data['billingPeriod'] ?? null,
        ];
    }
}
