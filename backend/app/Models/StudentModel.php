<?php

namespace App\Models;

use App\Services\LedgerService;
use CodeIgniter\Model;

class StudentModel extends Model
{
    /**
     * Cached ledger balances for batch operations
     * Format: [studentId => balance]
     */
    protected static array $ledgerBalanceCache = [];
    protected $table = 'students';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $useSoftDeletes = false;
    protected $allowedFields = [
        'id', 'tenant_id', 'first_name', 'last_name', 'admission_number', 'gender',
        'national_id', 'class_id', 'current_enrollment_id', 'date_of_birth',
        'email', 'address', 'photo_url', 'guardian_name', 'guardian_phone',
        'guardian_email', 'guardian_relationship',
        'guardian2_name', 'guardian2_phone', 'guardian2_relationship',
        'enrollment_date', 'status',
        'bursary_status', 'bursary_percentage', 'bursary_reason',
        'created_at', 'updated_at'
    ];
    protected $useTimestamps = true;
    protected $createdField = 'created_at';
    protected $updatedField = 'updated_at';

    /**
     * Get students by tenant
     */
    public function getByTenant(string $tenantId): array
    {
        return $this->select('students.*, c.name as class_name')
            ->join('classes c', 'c.id = students.class_id', 'left')
            ->where('students.tenant_id', $tenantId)
            ->findAll();
    }


    /**
     * Get students by class.
     *
     * By default returns only active students (status = 'active') so callers
     * that just need the current roster (e.g. attendance marking) do not
     * incur the cost of loading inactive / graduated / transferred records.
     * Pass $status = 'all' to get every record regardless of status, or any
     * specific status value to filter by it.
     */
    public function getByClass(string $classId, string $status = 'active'): array
    {
        $builder = $this->where('class_id', $classId);

        if ($status !== 'all') {
            $builder = $builder->where('status', $status);
        }

        return $builder->findAll();
    }

    /**
     * Get filtered students with SQL-based pagination and balance calculation.
     *
     * SECURITY: tenant_id is scoped inside every sub-query so that balances
     * from other tenants can never bleed into this tenant's results.
     */
    public function getFilteredStudents(string $tenantId, ?string $classId = null, ?string $status = null, ?string $search = null, bool $balanceOnly = false, ?string $sortBy = 'name', ?string $sortOrder = 'asc', int $limit = 50, int $offset = 0, bool $unassignedOnly = false): array
    {
        $db = \Config\Database::connect();

        // Safely escape the tenant ID for embedding in sub-query strings.
        $escapedTenantId = $db->escape($tenantId);
        $eligibleChargeTypes = LedgerService::eligibleChargeTypeSqlList();
        $eligiblePaymentCategories = LedgerService::eligiblePaymentCategorySqlList();

        // Build the base query with balance calculation
        $builder = $db->table('students s')
            ->select('s.id, s.tenant_id, s.first_name, s.last_name, s.admission_number,
                s.gender, s.national_id, s.class_id, s.current_enrollment_id,
                s.date_of_birth, s.email, s.address, s.photo_url,
                s.guardian_name, s.guardian_phone, s.guardian_email, s.guardian_relationship,
                s.guardian2_name, s.guardian2_phone, s.guardian2_relationship,
                s.enrollment_date, s.status,
                s.bursary_status, s.bursary_percentage, s.bursary_reason,
                s.created_at, s.updated_at,
                c.name as class_name,
                COALESCE(charges.total, 0) + COALESCE(debits.total, 0) - COALESCE(payments.total, 0) - COALESCE(credits.total, 0) AS balance')
            ->join('classes c', 'c.id = s.class_id', 'left')
            ->join(
                "(SELECT student_id, SUM(amount) as total FROM charges WHERE tenant_id = {$escapedTenantId} AND charge_type IN ({$eligibleChargeTypes}) AND deleted_at IS NULL AND voided_at IS NULL GROUP BY student_id) charges",
                'charges.student_id = s.id',
                'left'
            )
            ->join(
                "(SELECT student_id, SUM(amount) as total FROM payments WHERE tenant_id = {$escapedTenantId} AND fee_campaign_id IS NULL AND category IN ({$eligiblePaymentCategories}) AND voided_at IS NULL GROUP BY student_id) payments",
                'payments.student_id = s.id',
                'left'
            )
            ->join(
                "(SELECT student_id, SUM(amount) as total FROM ledger_adjustments WHERE tenant_id = {$escapedTenantId} AND adjustment_type = 'debit' AND status = 'approved' GROUP BY student_id) debits",
                'debits.student_id = s.id',
                'left'
            )
            ->join(
                "(SELECT student_id, SUM(amount) as total FROM ledger_adjustments WHERE tenant_id = {$escapedTenantId} AND adjustment_type = 'credit' AND status = 'approved' GROUP BY student_id) credits",
                'credits.student_id = s.id',
                'left'
            )
            ->where('s.tenant_id', $tenantId);

        // Apply class filter
        if (!empty($classId)) {
            $builder->where('s.class_id', $classId);
        } elseif ($unassignedOnly) {
            $builder->groupStart()
                ->where('s.class_id IS NULL', null, false)
                ->orWhere('s.class_id', '')
            ->groupEnd();
        }

        // Apply status filter - default to 'active' if not specified
        if ($status !== null && $status !== 'all') {
            $builder->where('s.status', $status);
        } elseif ($status === null) {
            // Default to active students when no status is specified
            $builder->where('s.status', 'active');
        }

        // Apply search filter (name, guardian name, or admission number)
        if (!empty($search)) {
            $builder->groupStart()
                ->like('s.first_name', $search)
                ->orLike('s.last_name', $search)
                ->orLike('s.guardian_name', $search)
                ->orLike('s.admission_number', $search)
                ->groupEnd();
        }

        // Apply balance filter if requested
        if ($balanceOnly) {
            $builder->having('balance >', 0);
        }

        // Apply sorting
        switch ($sortBy) {
            case 'name':
                $builder->orderBy('s.first_name', $sortOrder)
                        ->orderBy('s.last_name', $sortOrder);
                break;
            case 'class':
                $builder->orderBy('c.name', $sortOrder)
                        ->orderBy('s.first_name', 'asc');
                break;
            case 'balance':
                $builder->orderBy('balance', $sortOrder);
                break;
            default:
                $builder->orderBy('s.first_name', $sortOrder)
                        ->orderBy('s.last_name', $sortOrder);
        }

        // Apply pagination at SQL level
        $students = $builder->get($limit, $offset)->getResultArray();
        
        return $students;
    }

    /**
     * Get count of filtered students
     */
    public function getFilteredStudentsCount(string $tenantId, ?string $classId = null, ?string $status = null, ?string $search = null, bool $balanceOnly = false, bool $unassignedOnly = false): int
    {
        $db = \Config\Database::connect();
        $eligibleChargeTypesSql = LedgerService::eligibleChargeTypeSqlList();
        $eligiblePaymentCategoriesSql = LedgerService::eligiblePaymentCategorySqlList();
        
        if ($balanceOnly) {
            // For balance filter, we need a more complex query.
            // SECURITY: tenant_id is scoped inside sub-queries to prevent
            // cross-tenant balance contamination.
            $sql = "SELECT COUNT(*) as count FROM (
                SELECT s.id
                FROM students s
                LEFT JOIN (
                    SELECT student_id, SUM(amount) as total
                    FROM charges
                    WHERE tenant_id = ? AND charge_type IN ({$eligibleChargeTypesSql}) AND deleted_at IS NULL AND voided_at IS NULL
                    GROUP BY student_id
                ) charges ON charges.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) as total
                    FROM payments
                    WHERE tenant_id = ? AND fee_campaign_id IS NULL AND category IN ({$eligiblePaymentCategoriesSql}) AND voided_at IS NULL
                    GROUP BY student_id
                ) payments ON payments.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) as total
                    FROM ledger_adjustments
                    WHERE tenant_id = ? AND adjustment_type = 'debit' AND status = 'approved'
                    GROUP BY student_id
                ) debits ON debits.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) as total
                    FROM ledger_adjustments
                    WHERE tenant_id = ? AND adjustment_type = 'credit' AND status = 'approved'
                    GROUP BY student_id
                ) credits ON credits.student_id = s.id
                WHERE s.tenant_id = ?";

            $params = [$tenantId, $tenantId, $tenantId, $tenantId, $tenantId];

            // Apply class filter
            if (!empty($classId)) {
                $sql .= " AND s.class_id = ?";
                $params[] = $classId;
            } elseif ($unassignedOnly) {
                $sql .= " AND (s.class_id IS NULL OR s.class_id = '')";
            }
            
            // Apply status filter
            if ($status !== null && $status !== 'all') {
                $sql .= " AND s.status = ?";
                $params[] = $status;
            } elseif ($status === null) {
                $sql .= " AND s.status = 'active'";
            }
            
            // Apply search filter
            if (!empty($search)) {
                $sql .= " AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.guardian_name LIKE ?)";
                $searchParam = "%{$search}%";
                $params[] = $searchParam;
                $params[] = $searchParam;
                $params[] = $searchParam;
            }
            
            // Apply balance filter in the inner query
            $sql .= " AND (COALESCE(charges.total, 0) + COALESCE(debits.total, 0) - COALESCE(payments.total, 0) - COALESCE(credits.total, 0)) > 0";
            $sql .= " ) AS filtered_students";
            
            $result = $db->query($sql, $params)->getRowArray();
            return (int) $result['count'];
        } else {
            // Standard count without balance filter
            $builder = $db->table('students s')
                ->where('s.tenant_id', $tenantId);

            // Apply class filter
            if (!empty($classId)) {
                $builder->where('s.class_id', $classId);
            } elseif ($unassignedOnly) {
                $builder->groupStart()
                    ->where('s.class_id IS NULL', null, false)
                    ->orWhere('s.class_id', '')
                ->groupEnd();
            }

            // Apply status filter - default to 'active' if not specified
            if ($status !== null && $status !== 'all') {
                $builder->where('s.status', $status);
            } elseif ($status === null) {
                $builder->where('s.status', 'active');
            }

            // Apply search filter
            if (!empty($search)) {
                $builder->groupStart()
                    ->like('s.first_name', $search)
                    ->orLike('s.last_name', $search)
                    ->orLike('s.guardian_name', $search)
                    ->groupEnd();
            }

            return $builder->countAllResults();
        }
    }

    /**
     * Compute tenant-wide student statistics in a single SQL query.
     * Returns counts and totals scoped to the given filters.
     * Uses the subquery pattern (Constitution V) with the full balance formula.
     *
     * Filtered stats (totalStudents, outstanding, fees, bursary) respect status/class/search.
     * statusCounts remain global (class/search only) so filter tabs always show correct totals.
     */
    public function getGlobalStats(
        string $tenantId,
        ?string $classId = null,
        ?string $status = null,
        ?string $search = null
    ): array {
        $db = \Config\Database::connect();
        $escapedTenantId = $db->escape($tenantId);
        $eligibleChargeTypes = LedgerService::eligibleChargeTypeSqlList();
        $eligiblePaymentCategories = LedgerService::eligiblePaymentCategorySqlList();

        // ── Base subquery: every student with their computed balance ─────────
        $baseSql = "
            SELECT
                s.id,
                s.status,
                s.first_name,
                s.last_name,
                s.guardian_name,
                s.class_id,
                s.bursary_status,
                COALESCE(charges.total, 0) + COALESCE(debits.total, 0)
                    - COALESCE(payments.total, 0) - COALESCE(credits.total, 0) AS balance
            FROM students s
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS total
                FROM charges
                WHERE tenant_id = {$escapedTenantId}
                  AND charge_type IN ({$eligibleChargeTypes})
                  AND deleted_at IS NULL
                  AND voided_at IS NULL
                GROUP BY student_id
            ) charges ON charges.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS total
                FROM payments
                WHERE tenant_id = {$escapedTenantId}
                  AND fee_campaign_id IS NULL
                  AND category IN ({$eligiblePaymentCategories})
                  AND voided_at IS NULL
                GROUP BY student_id
            ) payments ON payments.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS total
                FROM ledger_adjustments
                WHERE tenant_id = {$escapedTenantId}
                  AND adjustment_type = 'debit' AND status = 'approved'
                GROUP BY student_id
            ) debits ON debits.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS total
                FROM ledger_adjustments
                WHERE tenant_id = {$escapedTenantId}
                  AND adjustment_type = 'credit' AND status = 'approved'
                GROUP BY student_id
            ) credits ON credits.student_id = s.id
            WHERE s.tenant_id = {$escapedTenantId}
        ";

        // ── Filtered query (respects status, class, search) ─────────────────
        $filteredWhere = '';
        $filteredParams = [];

        if ($status !== null && $status !== '' && $status !== 'all') {
            $filteredWhere .= ' AND s.status = ?';
            $filteredParams[] = $status;
        } elseif ($status === null || $status === '') {
            $filteredWhere .= " AND s.status = 'active'";
        }
        // When status === 'all': no status filter — include all statuses

        if (!empty($classId)) {
            $filteredWhere .= ' AND s.class_id = ?';
            $filteredParams[] = $classId;
        }

        if (!empty($search)) {
            $filteredWhere .= ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.guardian_name LIKE ?)';
            $like = "%{$search}%";
            $filteredParams[] = $like;
            $filteredParams[] = $like;
            $filteredParams[] = $like;
        }

        $filteredSql = "SELECT
            COUNT(*) AS total_students,
            SUM(CASE WHEN balance > 0 THEN 1     ELSE 0 END) AS students_with_outstanding_balance,
            SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END) AS total_fees_owed,
            SUM(CASE WHEN s.bursary_status != 'none' THEN 1 ELSE 0 END) AS students_on_financial_aid
        FROM ({$baseSql}{$filteredWhere}) AS s";

        $filteredRow = $db->query($filteredSql, $filteredParams)->getRowArray();

        // ── Global status counts (class/search scoped, no status filter) ────
        $globalWhere = '';
        $globalParams = [];

        if (!empty($classId)) {
            $globalWhere .= ' AND s.class_id = ?';
            $globalParams[] = $classId;
        }

        if (!empty($search)) {
            $globalWhere .= ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.guardian_name LIKE ?)';
            $like = "%{$search}%";
            $globalParams[] = $like;
            $globalParams[] = $like;
            $globalParams[] = $like;
        }

        $globalSql = "SELECT
            COUNT(*) AS total_count,
            SUM(CASE WHEN s.status = 'active'      THEN 1 ELSE 0 END) AS active_count,
            SUM(CASE WHEN s.status = 'inactive'    THEN 1 ELSE 0 END) AS inactive_count,
            SUM(CASE WHEN s.status = 'graduated'   THEN 1 ELSE 0 END) AS graduated_count,
            SUM(CASE WHEN s.status = 'transferred' THEN 1 ELSE 0 END) AS transferred_count,
            SUM(CASE WHEN s.status = 'dropped_out' THEN 1 ELSE 0 END) AS dropped_out_count
        FROM ({$baseSql}{$globalWhere}) AS s";

        $globalRow = $db->query($globalSql, $globalParams)->getRowArray();

        $total = (int) ($filteredRow['total_students'] ?? 0);
        $studentsOnFinancialAid = (int) ($filteredRow['students_on_financial_aid'] ?? 0);

        return [
            'totalStudents'                  => $total,
            'studentsWithOutstandingBalance' => (int)   ($filteredRow['students_with_outstanding_balance'] ?? 0),
            'totalFeesOwed'                  => (float) ($filteredRow['total_fees_owed'] ?? 0),
            'studentsOnFinancialAid'         => $studentsOnFinancialAid,
            'bursaryCoveragePercentage'      => $total > 0
                ? round(($studentsOnFinancialAid / $total) * 100, 1)
                : 0,
            'statusCounts' => [
                'active'      => (int) ($globalRow['active_count']      ?? 0),
                'inactive'    => (int) ($globalRow['inactive_count']     ?? 0),
                'graduated'   => (int) ($globalRow['graduated_count']    ?? 0),
                'transferred' => (int) ($globalRow['transferred_count']  ?? 0),
                'dropped_out' => (int) ($globalRow['dropped_out_count'] ?? 0),
                'total'       => (int) ($globalRow['total_count']        ?? 0),
            ],
        ];
    }

    /**
     * Preload ledger balances for specific student IDs
     * Balance = Fee Structure Charges + Debit Adjustments - Fee Structure Payments - Credit Adjustments
     */
    private function preloadLedgerBalancesForIds(array $studentIds): void
    {
        if (empty($studentIds)) {
            return;
        }

        $db = \Config\Database::connect();
        $studentRows = $db->table('students')
            ->select('id, tenant_id')
            ->whereIn('id', $studentIds)
            ->get()
            ->getResultArray();
        $studentTenantMap = [];
        foreach ($studentRows as $studentRow) {
            $studentTenantMap[$studentRow['id']] = $studentRow['tenant_id'];
        }
        $tenantIds = array_values(array_unique($studentTenantMap));
        if (empty($tenantIds)) {
            return;
        }
        
        // Get all charges grouped by student (fee structure + transport charges)
        $chargesResults = $db->table('charges')
            ->select('student_id, SUM(amount) as total_charges')
            ->whereIn('student_id', $studentIds)
            ->whereIn('tenant_id', $tenantIds)
            ->whereIn('charge_type', LedgerService::ELIGIBLE_CHARGE_TYPES)
            ->where('deleted_at IS NULL')
            ->where('voided_at', null)
            ->groupBy('student_id')
            ->get()
            ->getResultArray();

        $chargesByStudent = [];
        foreach ($chargesResults as $row) {
            $chargesByStudent[$row['student_id']] = (float) $row['total_charges'];
        }

        // Get all payments grouped by student (fee structure + transport payments)
        $paymentsResults = $db->table('payments')
            ->select('student_id, SUM(amount) as total_payments')
            ->whereIn('student_id', $studentIds)
            ->whereIn('tenant_id', $tenantIds)
            ->where('fee_campaign_id', null)
            ->where('voided_at', null)
            ->whereIn('category', LedgerService::ELIGIBLE_PAYMENT_CATEGORIES)
            ->groupBy('student_id')
            ->get()
            ->getResultArray();

        $paymentsByStudent = [];
        foreach ($paymentsResults as $row) {
            $paymentsByStudent[$row['student_id']] = (float) $row['total_payments'];
        }

        // Get credit adjustments grouped by student (approved only)
        $creditsByStudent = [];
        $debitsByStudent = [];

        if ($db->tableExists('ledger_adjustments')) {
            $creditsResults = $db->table('ledger_adjustments')
                ->select('student_id, SUM(amount) as total_credits')
                ->whereIn('student_id', $studentIds)
                ->whereIn('tenant_id', $tenantIds)
                ->where('adjustment_type', 'credit')
                ->where('status', 'approved')
                ->groupBy('student_id')
                ->get()
                ->getResultArray();
            
            foreach ($creditsResults as $row) {
                $creditsByStudent[$row['student_id']] = (float) $row['total_credits'];
            }
            
            // Get debit adjustments grouped by student (approved only)
            $debitsResults = $db->table('ledger_adjustments')
                ->select('student_id, SUM(amount) as total_debits')
                ->whereIn('student_id', $studentIds)
                ->whereIn('tenant_id', $tenantIds)
                ->where('adjustment_type', 'debit')
                ->where('status', 'approved')
                ->groupBy('student_id')
                ->get()
                ->getResultArray();
            
            foreach ($debitsResults as $row) {
                $debitsByStudent[$row['student_id']] = (float) $row['total_debits'];
            }
        }
        
        // Calculate and cache balances
        // Balance = Charges + Debits - Payments - Credits
        foreach ($studentIds as $studentId) {
            $charges = $chargesByStudent[$studentId] ?? 0;
            $payments = $paymentsByStudent[$studentId] ?? 0;
            $credits = $creditsByStudent[$studentId] ?? 0;
            $debits = $debitsByStudent[$studentId] ?? 0;
            self::$ledgerBalanceCache[$studentId] = $charges + $debits - $payments - $credits;
        }
    }

    /**
     * Search students by name, email, guardian name, or admission number.
     */
    public function search(string $tenantId, string $query = '', string $classId = '', int $limit = 20): array
    {
        $builder = $this->select('students.*, c.name as class_name')
            ->join('classes c', 'c.id = students.class_id', 'left')
            ->where('students.tenant_id', $tenantId);

        if (!empty($query)) {
            $builder->groupStart()
                ->like('students.first_name', $query)
                ->orLike('students.last_name', $query)
                ->orLike('students.email', $query)
                ->orLike('students.guardian_name', $query)
                ->orLike('students.admission_number', $query)
                ->groupEnd();
        }

        if (!empty($classId)) {
            $builder->where('students.class_id', $classId);
        }

        return $builder->findAll($limit);
    }

    /**
     * Get active students count by tenant
     */
    public function getActiveCount(string $tenantId): int
    {
        return $this->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->countAllResults();
    }

    /**
     * Calculate ledger-based balance for a single student
     * Balance = Fee Structure Charges + Debit Adjustments - Fee Structure Payments - Credit Adjustments
     */
    public function getLedgerBalance(string $studentId): float
    {
        // Check cache first
        if (isset(self::$ledgerBalanceCache[$studentId])) {
            return self::$ledgerBalanceCache[$studentId];
        }

        $db = \Config\Database::connect();
        $student = $db->table('students')
            ->select('tenant_id')
            ->where('id', $studentId)
            ->get()
            ->getRowArray();
        if (!$student) {
            self::$ledgerBalanceCache[$studentId] = 0.0;
            return 0.0;
        }
        $tenantId = $student['tenant_id'];

        // Get total charges using charge_type ENUM
        $chargesResult = $db->table('charges')
            ->selectSum('amount')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->whereIn('charge_type', LedgerService::ELIGIBLE_CHARGE_TYPES)
            ->where('deleted_at IS NULL')
            ->where('voided_at', null)
            ->get()
            ->getRowArray();
        $totalCharges = (float) ($chargesResult['amount'] ?? 0);

        // Get total payments (all payments for this student)
        $paymentsResult = $db->table('payments')
            ->selectSum('amount')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('fee_campaign_id', null)
            ->where('voided_at', null)
            ->whereIn('category', LedgerService::ELIGIBLE_PAYMENT_CATEGORIES)
            ->get()
            ->getRowArray();
        $totalPayments = (float) ($paymentsResult['amount'] ?? 0);
        
        // Get credit adjustments (reduce balance) - approved only
        $creditAdjustments = 0;
        $debitAdjustments = 0;
        
        if ($db->tableExists('ledger_adjustments')) {
            $creditResult = $db->table('ledger_adjustments')
                ->selectSum('amount')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $studentId)
                ->where('adjustment_type', 'credit')
                ->where('status', 'approved')
                ->get()
                ->getRowArray();
            $creditAdjustments = (float) ($creditResult['amount'] ?? 0);
            
            // Get debit adjustments (increase balance) - approved only
            $debitResult = $db->table('ledger_adjustments')
                ->selectSum('amount')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $studentId)
                ->where('adjustment_type', 'debit')
                ->where('status', 'approved')
                ->get()
                ->getRowArray();
            $debitAdjustments = (float) ($debitResult['amount'] ?? 0);
        }
        
        // Balance = Charges + Debits - Payments - Credits
        $balance = $totalCharges + $debitAdjustments - $totalPayments - $creditAdjustments;
        
        // Cache the result
        self::$ledgerBalanceCache[$studentId] = $balance;
        
        return $balance;
    }

    /**
     * Pre-load ledger balances for multiple students (batch optimization)
     * Call this before formatting multiple students to avoid N+1 queries
     * Balance = Fee Structure Charges + Debit Adjustments - Fee Structure Payments - Credit Adjustments
     */
    public function preloadLedgerBalances(string $tenantId): void
    {
        $db = \Config\Database::connect();
        
        // Get all charges grouped by student using charge_type ENUM
        $chargesResults = $db->table('charges')
            ->select('student_id, SUM(amount) as total_charges')
            ->where('tenant_id', $tenantId)
            ->whereIn('charge_type', LedgerService::ELIGIBLE_CHARGE_TYPES)
            ->where('deleted_at IS NULL')
            ->where('voided_at', null)
            ->groupBy('student_id')
            ->get()
            ->getResultArray();

        $chargesByStudent = [];
        foreach ($chargesResults as $row) {
            $chargesByStudent[$row['student_id']] = (float) $row['total_charges'];
        }

        // Get all payments grouped by student
        $paymentsResults = $db->table('payments')
            ->select('student_id, SUM(amount) as total_payments')
            ->where('tenant_id', $tenantId)
            ->where('fee_campaign_id', null)
            ->where('voided_at', null)
            ->whereIn('category', LedgerService::ELIGIBLE_PAYMENT_CATEGORIES)
            ->groupBy('student_id')
            ->get()
            ->getResultArray();

        $paymentsByStudent = [];
        foreach ($paymentsResults as $row) {
            $paymentsByStudent[$row['student_id']] = (float) $row['total_payments'];
        }

        // Get credit adjustments grouped by student (approved only)
        $creditsByStudent = [];
        $debitsByStudent = [];

        if ($db->tableExists('ledger_adjustments')) {
            $creditsResults = $db->table('ledger_adjustments')
                ->select('student_id, SUM(amount) as total_credits')
                ->where('tenant_id', $tenantId)
                ->where('adjustment_type', 'credit')
                ->where('status', 'approved')
                ->groupBy('student_id')
                ->get()
                ->getResultArray();

            foreach ($creditsResults as $row) {
                $creditsByStudent[$row['student_id']] = (float) $row['total_credits'];
            }

            // Get debit adjustments grouped by student (approved only)
            $debitsResults = $db->table('ledger_adjustments')
                ->select('student_id, SUM(amount) as total_debits')
                ->where('tenant_id', $tenantId)
                ->where('adjustment_type', 'debit')
                ->where('status', 'approved')
                ->groupBy('student_id')
                ->get()
                ->getResultArray();

            foreach ($debitsResults as $row) {
                $debitsByStudent[$row['student_id']] = (float) $row['total_debits'];
            }
        }

        // Get all students for this tenant
        $students = $this->where('tenant_id', $tenantId)->findAll();
        
        // Calculate and cache balance for each student
        // Balance = Charges + Debits - Payments - Credits
        foreach ($students as $student) {
            $studentId = is_array($student) ? $student['id'] : $student->id;
            $charges = $chargesByStudent[$studentId] ?? 0;
            $payments = $paymentsByStudent[$studentId] ?? 0;
            $credits = $creditsByStudent[$studentId] ?? 0;
            $debits = $debitsByStudent[$studentId] ?? 0;
            self::$ledgerBalanceCache[$studentId] = $charges + $debits - $payments - $credits;
        }
    }

    /**
     * Clear the ledger balance cache
     */
    public function clearLedgerBalanceCache(): void
    {
        self::$ledgerBalanceCache = [];
    }

    /**
     * Auto-generate a unique admission number for a tenant.
     * Format: {YEAR}/{zero-padded-sequence} e.g. 2026/001
     */
    public function generateAdmissionNumber(string $tenantId): string
    {
        $year = date('Y');
        $db = \Config\Database::connect();

        // Find the highest existing sequence for this year/tenant
        $row = $db->table('students')
            ->select('admission_number')
            ->where('tenant_id', $tenantId)
            ->like('admission_number', $year . '/', 'after')
            ->orderBy('admission_number', 'DESC')
            ->limit(1)
            ->get()
            ->getRowArray();

        $next = 1;
        if ($row) {
            $parts = explode('/', $row['admission_number']);
            if (count($parts) === 2 && is_numeric($parts[1])) {
                $next = (int) $parts[1] + 1;
            }
        }

        return $year . '/' . str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }

    /**
     * Record a status change in the student_status_history table.
     */
    public function recordStatusHistory(
        string $tenantId,
        string $studentId,
        ?string $previousStatus,
        string $newStatus,
        string $effectiveDate,
        ?string $reason,
        string $changedByUserId
    ): void {
        $db = \Config\Database::connect();
        $db->table('student_status_history')->insert([
            'id'                  => esc(bin2hex(random_bytes(16))),
            'tenant_id'           => $tenantId,
            'student_id'          => $studentId,
            'previous_status'     => $previousStatus,
            'new_status'          => $newStatus,
            'effective_date'      => $effectiveDate,
            'reason'              => $reason,
            'changed_by_user_id'  => $changedByUserId,
            'created_at'          => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Format student data for API response
     * Uses pre-calculated balance from query to avoid additional DB calls
     */
    public function formatForApi($student): array
    {
        // Handle both array and object types
        $id = is_array($student) ? $student['id'] : $student->id;
        $tenantId = is_array($student) ? $student['tenant_id'] : $student->tenant_id;
        $firstName = is_array($student) ? $student['first_name'] : $student->first_name;
        $lastName = is_array($student) ? $student['last_name'] : $student->last_name;
        // Use the class_name from LEFT JOIN; fall back to 'No Class' for unassigned students
        $className = is_array($student) ? ($student['class_name'] ?? 'No Class') : ($student->class_name ?? 'No Class');
        $balance = is_array($student) ? (isset($student['balance']) ? (float) $student['balance'] : 0) : (isset($student->balance) ? (float) $student->balance : 0);

        $g2Name = is_array($student) ? ($student['guardian2_name'] ?? '') : ($student->guardian2_name ?? '');
        $guardian2 = null;
        if (!empty($g2Name)) {
            $guardian2 = [
                'name'         => $g2Name,
                'phone'        => is_array($student) ? ($student['guardian2_phone'] ?? '') : ($student->guardian2_phone ?? ''),
                'relationship' => is_array($student) ? ($student['guardian2_relationship'] ?? '') : ($student->guardian2_relationship ?? ''),
            ];
        }

        return [
            'id'              => $id,
            'tenantId'        => $tenantId,
            'firstName'       => $firstName,
            'lastName'        => $lastName,
            'admissionNumber' => is_array($student) ? ($student['admission_number'] ?? '') : ($student->admission_number ?? ''),
            'gender'          => is_array($student) ? ($student['gender'] ?? null) : ($student->gender ?? null),
            'nationalId'      => is_array($student) ? ($student['national_id'] ?? '') : ($student->national_id ?? ''),
            'className'       => $className,
            'classId'         => is_array($student) ? $student['class_id'] : $student->class_id,
            'balance'         => $balance,
            'dateOfBirth'     => is_array($student) ? $student['date_of_birth'] : $student->date_of_birth,
            'email'           => is_array($student) ? ($student['email'] ?? '') : ($student->email ?? ''),
            'address'         => is_array($student) ? ($student['address'] ?? '') : ($student->address ?? ''),
            'photoUrl'        => is_array($student) ? ($student['photo_url'] ?? null) : ($student->photo_url ?? null),
            'guardian'        => [
                'name'         => is_array($student) ? $student['guardian_name'] : $student->guardian_name,
                'phone'        => is_array($student) ? $student['guardian_phone'] : $student->guardian_phone,
                'email'        => is_array($student) ? ($student['guardian_email'] ?? '') : ($student->guardian_email ?? ''),
                'relationship' => is_array($student) ? $student['guardian_relationship'] : $student->guardian_relationship,
            ],
            'guardian2'       => $guardian2,
            'enrollmentDate'  => is_array($student) ? $student['enrollment_date'] : $student->enrollment_date,
            'status'          => is_array($student) ? $student['status'] : $student->status,
            'bursaryStatus'   => is_array($student) ? $student['bursary_status'] : $student->bursary_status,
            'bursaryPercentage' => is_array($student) ? (int) $student['bursary_percentage'] : (int) $student->bursary_percentage,
            'bursaryReason'   => is_array($student) ? ($student['bursary_reason'] ?? '') : ($student->bursary_reason ?? ''),
            'transport'       => [
                'hasTransport'   => false,
                'currentRouteId' => null,
                'status'         => 'none',
                'expiryDate'     => null,
                'notes'          => '',
            ],
        ];
    }

    /**
     * Override delete method to implement cascade deletion.
     * Blocks deletion when the student has any financial records (charges or payments).
     */
    public function delete($id = null, bool $purge = false)
    {
        if ($id === null) {
            return parent::delete($id, $purge);
        }

        $db = \Config\Database::connect();

        // Guard: refuse to delete students with financial records
        $chargeCount = $db->table('charges')->where('student_id', $id)->countAllResults();
        $paymentCount = $db->table('payments')->where('student_id', $id)->countAllResults();
        if ($chargeCount > 0 || $paymentCount > 0) {
            $ex = new \RuntimeException(
                'Cannot delete a student with financial records. Change the student\'s status to \'transferred\' or \'withdrawn\' instead.',
                409
            );
            // Attach a machine-readable code so the controller can return the right error shape
            throw $ex;
        }

        // Start database transaction
        $db->transStart();

        try {
            // Delete related records in proper order to avoid foreign key issues
            
            // 1. Delete transport allocations
            $db->table('transport_student_allocations')
                ->where('student_id', $id)
                ->delete();
            
            // 2. Delete student attendance records
            $db->table('student_attendance')
                ->where('student_id', $id)
                ->delete();
            
            // 3. Delete payment records
            $db->table('payments')
                ->where('student_id', $id)
                ->delete();
            
            // 4. Delete charge records
            $db->table('charges')
                ->where('student_id', $id)
                ->delete();
            
            // 5. Finally delete the student
            $result = parent::delete($id, $purge);
            
            // Commit transaction
            $db->transComplete();
            
            return $result;
            
        } catch (\Exception $e) {
            // Rollback transaction on error
            $db->transRollback();
            throw $e;
        }
    }

    /**
     * Format input from API to database format
     */
    public function formatFromApi(array $data, string $tenantId): array
    {
        $formatted = [
            'tenant_id'        => $tenantId,
            'first_name'       => $data['firstName'] ?? '',
            'last_name'        => $data['lastName'] ?? '',
            'class_id'         => $data['classId'] ?? null,
            'date_of_birth'    => $data['dateOfBirth'] ?? null,
            'gender'           => $data['gender'] ?? null,
            'national_id'      => $data['nationalId'] ?? null,
            'email'            => $data['email'] ?? '',
            'address'          => $data['address'] ?? '',
            'photo_url'        => $data['photoUrl'] ?? null,
            'enrollment_date'  => $data['enrollmentDate'] ?? date('Y-m-d'),
            'status'           => $data['status'] ?? 'active',
            'bursary_status'   => $data['bursaryStatus'] ?? 'none',
            'bursary_percentage' => $data['bursaryPercentage'] ?? 0,
            'bursary_reason'   => $data['bursaryReason'] ?? null,
        ];

        // admission_number: only set if provided; controller handles auto-generation
        if (!empty($data['admissionNumber'])) {
            $formatted['admission_number'] = $data['admissionNumber'];
        }

        // Primary guardian — support both nested object and flat keys
        if (isset($data['guardian'])) {
            $formatted['guardian_name']         = $data['guardian']['name'] ?? '';
            $formatted['guardian_phone']        = $data['guardian']['phone'] ?? '';
            $formatted['guardian_email']        = $data['guardian']['email'] ?? '';
            $formatted['guardian_relationship'] = $data['guardian']['relationship'] ?? '';
        } else {
            $formatted['guardian_name']         = $data['guardianName'] ?? '';
            $formatted['guardian_phone']        = $data['guardianPhone'] ?? '';
            $formatted['guardian_email']        = $data['guardianEmail'] ?? '';
            $formatted['guardian_relationship'] = $data['guardianRelationship'] ?? '';
        }

        // Second guardian — support both nested object and flat keys
        if (isset($data['guardian2'])) {
            $formatted['guardian2_name']         = $data['guardian2']['name'] ?? null;
            $formatted['guardian2_phone']        = $data['guardian2']['phone'] ?? null;
            $formatted['guardian2_relationship'] = $data['guardian2']['relationship'] ?? null;
        } else {
            $formatted['guardian2_name']         = $data['guardian2Name'] ?? null;
            $formatted['guardian2_phone']        = $data['guardian2Phone'] ?? null;
            $formatted['guardian2_relationship'] = $data['guardian2Relationship'] ?? null;
        }

        return $formatted;
    }
}
