<?php

namespace App\Models;

use App\Services\LedgerService;
use CodeIgniter\Model;

class PaymentModel extends Model
{
    protected $table = 'payments';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $allowedFields = [
        'id', 'student_id', 'tenant_id', 'amount', 'date', 'method',
        'description', 'category', 'month', 'route_id', 'fee_campaign_id',
        'balance_after_payment', 'receipt_number', 'snapshot',
        'is_general_payment', 'payment_group_id',
        'voided_at', 'void_reason', 'voided_by',
        'created_at', 'updated_at',
        'currency_code', 'original_amount', 'exchange_rate', 'rate_manual_override',
    ];
    protected $useTimestamps = true;

    public function getByTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->orderBy('date', 'DESC')
            ->findAll();
    }

    public function getFilteredWithStudents(string $tenantId, array $filters, int $limit, int $offset): array
    {
        $builder = $this->basePaymentHistoryBuilder($tenantId);

        $this->applyFilteredPaymentConditions($builder, $filters);
        $this->applyPaymentTransactionDisplayCondition($builder);
        $this->applyPaymentOrdering($builder, $filters);

        return $builder
            ->limit($limit, $offset)
            ->get()
            ->getResultArray();
    }

    public function getFilteredCount(string $tenantId, array $filters): int
    {
        $builder = $this->db->table('payments p')
            ->select('COUNT(DISTINCT COALESCE(p.payment_group_id, p.id)) AS total', false)
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId);

        $this->applyFilteredPaymentConditions($builder, $filters);

        $row = $builder->get()->getRowArray();
        return (int) ($row['total'] ?? 0);
    }

    public function getFilteredSummary(string $tenantId, array $filters): array
    {
        $totalBuilder = $this->db->table('payments p')
            ->select('COUNT(DISTINCT COALESCE(p.payment_group_id, p.id)) AS total_count, COALESCE(SUM(p.amount), 0) AS total_amount', false)
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId);
        $this->applyFilteredPaymentConditions($totalBuilder, $filters);
        $totals = $totalBuilder->get()->getRowArray();

        $monthBuilder = $this->db->table('payments p')
            ->select('COALESCE(SUM(p.amount), 0) AS total')
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId)
            ->where('p.date >=', date('Y-m-01'))
            ->where('p.date <=', date('Y-m-t'));
        $this->applyFilteredPaymentConditions($monthBuilder, $filters);
        $thisMonth = $monthBuilder->get()->getRowArray();

        $todayBuilder = $this->db->table('payments p')
            ->select('COUNT(DISTINCT COALESCE(p.payment_group_id, p.id)) AS total', false)
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId)
            ->where('p.date', date('Y-m-d'));
        $this->applyFilteredPaymentConditions($todayBuilder, $filters);
        $today = $todayBuilder->get()->getRowArray();

        $methodBuilder = $this->db->table('payments p')
            ->select("COALESCE(NULLIF(p.method, ''), 'Unspecified') AS label, COUNT(DISTINCT COALESCE(p.payment_group_id, p.id)) AS count, COALESCE(SUM(p.amount), 0) AS total", false)
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId)
            ->groupBy("COALESCE(NULLIF(p.method, ''), 'Unspecified')", false)
            ->orderBy('total', 'DESC');
        $this->applyFilteredPaymentConditions($methodBuilder, $filters);

        $categoryBuilder = $this->db->table('payments p')
            ->select("COALESCE(NULLIF(p.category, ''), 'Uncategorized') AS label, COUNT(DISTINCT COALESCE(p.payment_group_id, p.id)) AS count, COALESCE(SUM(p.amount), 0) AS total", false)
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId)
            ->groupBy("COALESCE(NULLIF(p.category, ''), 'Uncategorized')", false)
            ->orderBy('total', 'DESC');
        $this->applyFilteredPaymentConditions($categoryBuilder, $filters);

        $stats = $this->getStatsForTenant($tenantId);

        return [
            'totalAmount' => (float) ($totals['total_amount'] ?? 0),
            'totalCount' => (int) ($totals['total_count'] ?? 0),
            'totalThisMonth' => (float) ($thisMonth['total'] ?? 0),
            'paymentsToday' => (int) ($today['total'] ?? 0),
            'totalOutstanding' => (float) ($stats['totalOutstanding'] ?? 0),
            'byMethod' => array_map(fn($row) => [
                'label' => $row['label'],
                'count' => (int) $row['count'],
                'total' => (float) $row['total'],
            ], $methodBuilder->get()->getResultArray()),
            'byCategory' => array_map(fn($row) => [
                'label' => $row['label'],
                'count' => (int) $row['count'],
                'total' => (float) $row['total'],
            ], $categoryBuilder->get()->getResultArray()),
        ];
    }

    public function getStatsForTenant(string $tenantId): array
    {
        $thisMonth = $this->db->table('payments')
            ->select('COALESCE(SUM(amount), 0) AS total')
            ->where('tenant_id', $tenantId)
            ->where('voided_at', null)
            ->where('MONTH(date)', (int) date('n'))
            ->where('YEAR(date)', (int) date('Y'))
            ->get()
            ->getRowArray();

        $today = $this->db->table('payments')
            ->select('COUNT(*) AS total')
            ->where('tenant_id', $tenantId)
            ->where('voided_at', null)
            ->where('date', date('Y-m-d'))
            ->get()
            ->getRowArray();

        $eligibleChargeTypes = LedgerService::eligibleChargeTypeSqlList();
        $eligiblePaymentCategories = LedgerService::eligiblePaymentCategorySqlList();
        $hasAdjustments = $this->db->tableExists('ledger_adjustments');

        $sql = "
            SELECT
                COALESCE(charges.total_charges, 0)
                    + COALESCE(debits.total_debits, 0)
                    - COALESCE(payments.total_payments, 0)
                    - COALESCE(credits.total_credits, 0) AS total_outstanding
            FROM (SELECT 1) base
            LEFT JOIN (
                SELECT COALESCE(SUM(c.amount), 0) AS total_charges
                FROM charges c
                INNER JOIN students s ON s.id = c.student_id AND s.tenant_id = c.tenant_id
                WHERE c.tenant_id = ?
                  AND s.status = 'active'
                  AND c.deleted_at IS NULL
                  AND c.voided_at IS NULL
                  AND c.charge_type IN ({$eligibleChargeTypes})
            ) charges ON 1 = 1
            LEFT JOIN (
                SELECT COALESCE(SUM(p.amount), 0) AS total_payments
                FROM payments p
                INNER JOIN students s ON s.id = p.student_id AND s.tenant_id = p.tenant_id
                WHERE p.tenant_id = ?
                  AND s.status = 'active'
                  AND p.fee_campaign_id IS NULL
                  AND p.category IN ({$eligiblePaymentCategories})
                  AND p.voided_at IS NULL
            ) payments ON 1 = 1
        ";

        $bindings = [$tenantId, $tenantId];

        if ($hasAdjustments) {
            $sql .= "
            LEFT JOIN (
                SELECT COALESCE(SUM(la.amount), 0) AS total_credits
                FROM ledger_adjustments la
                INNER JOIN students s ON s.id = la.student_id AND s.tenant_id = la.tenant_id
                WHERE la.tenant_id = ?
                  AND s.status = 'active'
                  AND la.adjustment_type = 'credit'
                  AND la.status = 'approved'
            ) credits ON 1 = 1
            LEFT JOIN (
                SELECT COALESCE(SUM(la.amount), 0) AS total_debits
                FROM ledger_adjustments la
                INNER JOIN students s ON s.id = la.student_id AND s.tenant_id = la.tenant_id
                WHERE la.tenant_id = ?
                  AND s.status = 'active'
                  AND la.adjustment_type = 'debit'
                  AND la.status = 'approved'
            ) debits ON 1 = 1
            ";
            $bindings[] = $tenantId;
            $bindings[] = $tenantId;
        } else {
            $sql .= "
            LEFT JOIN (SELECT 0 AS total_credits) credits ON 1 = 1
            LEFT JOIN (SELECT 0 AS total_debits) debits ON 1 = 1
            ";
        }

        $outstanding = $this->db->query($sql, $bindings)->getRowArray();

        return [
            'totalThisMonth' => (float) ($thisMonth['total'] ?? 0),
            'paymentsToday' => (int) ($today['total'] ?? 0),
            'totalOutstanding' => max(0, (float) ($outstanding['total_outstanding'] ?? 0)),
        ];
    }

    public function getFilterOptions(string $tenantId): array
    {
        $methodRows = $this->db->table('payments')
            ->select('method')
            ->where('tenant_id', $tenantId)
            ->where('method IS NOT NULL', null, false)
            ->where('method !=', '')
            ->groupBy('method')
            ->orderBy('method', 'ASC')
            ->get()
            ->getResultArray();

        $categoryRows = $this->db->table('payments')
            ->select('category')
            ->where('tenant_id', $tenantId)
            ->where('category IS NOT NULL', null, false)
            ->where('category !=', '')
            ->groupBy('category')
            ->orderBy('category', 'ASC')
            ->get()
            ->getResultArray();

        $classRows = $this->db->table('payments p')
            ->select('c.id, c.name')
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'inner')
            ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'inner')
            ->where('p.tenant_id', $tenantId)
            ->groupBy('c.id, c.name')
            ->orderBy('c.name', 'ASC')
            ->get()
            ->getResultArray();

        $monthRows = $this->db->table('payments')
            ->select('MONTH(date) AS month', false)
            ->where('tenant_id', $tenantId)
            ->where('date IS NOT NULL', null, false)
            ->groupBy('MONTH(date)', false)
            ->orderBy('MONTH(date)', 'ASC', false)
            ->get()
            ->getResultArray();

        $yearRows = $this->db->table('payments')
            ->select('YEAR(date) AS year', false)
            ->where('tenant_id', $tenantId)
            ->where('date IS NOT NULL', null, false)
            ->groupBy('YEAR(date)', false)
            ->orderBy('YEAR(date)', 'DESC', false)
            ->get()
            ->getResultArray();

        return [
            'methods' => array_values(array_map(fn($row) => (string) $row['method'], $methodRows)),
            'categories' => array_values(array_map(fn($row) => (string) $row['category'], $categoryRows)),
            'classes' => array_map(fn($row) => [
                'id' => (string) $row['id'],
                'name' => (string) $row['name'],
            ], $classRows),
            'months' => array_values(array_map(fn($row) => (int) $row['month'], $monthRows)),
            'years' => array_values(array_map(fn($row) => (int) $row['year'], $yearRows)),
        ];
    }

    private function basePaymentHistoryBuilder(string $tenantId)
    {
        return $this->db->table('payments p')
            ->select('p.*')
            ->select(
                "CASE
                    WHEN p.payment_group_id IS NOT NULL THEN (
                        SELECT COALESCE(SUM(pg.amount), 0)
                        FROM payments pg
                        WHERE pg.tenant_id = p.tenant_id
                          AND pg.payment_group_id = p.payment_group_id
                    )
                    ELSE p.amount
                END AS amount",
                false
            )
            ->select(
                "CASE
                    WHEN p.payment_group_id IS NOT NULL THEN (
                        SELECT GROUP_CONCAT(pg.category ORDER BY pg.created_at ASC, pg.id ASC SEPARATOR ', ')
                        FROM payments pg
                        WHERE pg.tenant_id = p.tenant_id
                          AND pg.payment_group_id = p.payment_group_id
                    )
                    ELSE p.category
                END AS category",
                false
            )
            ->select(
                's.id AS student_id_joined, s.first_name AS student_first_name, s.last_name AS student_last_name, ' .
                's.admission_number AS student_admission_number, s.class_id AS student_class_id, c.name AS student_class_name, ' .
                'CONCAT(COALESCE(s.first_name, \'\'), \' \', COALESCE(s.last_name, \'\')) AS student_full_name',
                false
            )
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId);
    }

    public function applyFilteredPaymentConditions($builder, array $filters): void
    {
        if (empty($filters['includeVoided'])) {
            $builder->where('p.voided_at', null);
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $builder->groupStart()
                ->like('s.first_name', $search)
                ->orLike('s.last_name', $search)
                ->orLike("CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))", $search, 'both', null, true)
                ->orLike('s.admission_number', $search)
                ->orLike('p.receipt_number', $search)
                ->orLike('p.description', $search)
                ->orLike('p.method', $search)
                ->orLike('p.category', $search)
                ->orLike('p.date', $search)
                ->groupEnd();
        }

        if (!empty($filters['method']) && $filters['method'] !== 'all') {
            $builder->where('p.method', $filters['method']);
        }

        if (array_key_exists('category', $filters) && $filters['category'] !== null && $filters['category'] !== 'all') {
            if ($filters['category'] === '') {
                $builder->groupStart()
                    ->where('p.category', '')
                    ->orWhere('p.category IS NULL', null, false)
                    ->orWhere(
                        "EXISTS (
                            SELECT 1
                            FROM payments pc
                            WHERE pc.tenant_id = p.tenant_id
                              AND pc.payment_group_id = p.payment_group_id
                              AND (pc.category = '' OR pc.category IS NULL)
                        )",
                        null,
                        false
                    )
                    ->groupEnd();
            } else {
                $category = $this->db->escape($filters['category']);
                $builder->groupStart()
                    ->where('p.category', $filters['category'])
                    ->orWhere(
                        "EXISTS (
                            SELECT 1
                            FROM payments pc
                            WHERE pc.tenant_id = p.tenant_id
                              AND pc.payment_group_id = p.payment_group_id
                              AND pc.category = {$category}
                        )",
                        null,
                        false
                    )
                    ->groupEnd();
            }
        }

        if (!empty($filters['classId']) && $filters['classId'] !== 'all') {
            $builder->where('s.class_id', $filters['classId']);
        }

        if (!empty($filters['month']) && (int) $filters['month'] >= 1 && (int) $filters['month'] <= 12) {
            $builder->where('MONTH(p.date)', (int) $filters['month']);
        }

        if (!empty($filters['year']) && (int) $filters['year'] > 0) {
            $builder->where('p.date >=', sprintf('%04d-01-01', (int) $filters['year']));
            $builder->where('p.date <=', sprintf('%04d-12-31', (int) $filters['year']));
        }

        if (!empty($filters['dateFrom'])) {
            $builder->where('p.date >=', $filters['dateFrom']);
        }

        if (!empty($filters['dateTo'])) {
            $builder->where('p.date <=', $filters['dateTo']);
        }

        if (!empty($filters['studentId'])) {
            $builder->where('p.student_id', $filters['studentId']);
        }

        if (!empty($filters['paymentType']) && $filters['paymentType'] !== 'all') {
            switch ($filters['paymentType']) {
                case 'general':
                    $builder->where('COALESCE(p.is_general_payment, 0) = 1', null, false);
                    break;
                case 'system':
                    $builder->where('COALESCE(p.is_general_payment, 0) = 0', null, false);
                    $builder->where('p.fee_campaign_id IS NULL', null, false);
                    break;
                case 'campaign':
                    $builder->where('p.fee_campaign_id IS NOT NULL', null, false);
                    break;
                case 'grouped':
                    $builder->where('p.payment_group_id IS NOT NULL', null, false);
                    break;
            }
        }
    }

    private function applyPaymentTransactionDisplayCondition($builder): void
    {
        $builder->groupStart()
            ->where('p.payment_group_id IS NULL', null, false)
            ->orWhere(
                'p.id = (
                    SELECT MIN(pr.id)
                    FROM payments pr
                    WHERE pr.tenant_id = p.tenant_id
                      AND pr.payment_group_id = p.payment_group_id
                )',
                null,
                false
            )
            ->groupEnd();
    }

    public function applyPaymentOrdering($builder, array $filters): void
    {
        $sortBy = $filters['sortBy'] ?? 'date';
        $sortOrder = strtolower($filters['sortOrder'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
        $sortColumns = [
            'date' => 'p.date',
            'amount' => 'amount',
            'studentName' => 'student_full_name',
            'method' => 'p.method',
            'category' => 'category',
            'receiptNumber' => 'p.receipt_number',
        ];
        $sortColumn = $sortColumns[$sortBy] ?? 'p.date';

        if ($sortColumn === 'student_full_name') {
            $builder->orderBy("CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))", $sortOrder, false);
        } else {
            $builder->orderBy($sortColumn, $sortOrder);
        }

        $builder->orderBy('p.created_at', 'DESC')
            ->orderBy('p.id', 'DESC');
    }

    public function getByStudent(string $studentId, string $tenantId): array
    {
        return $this->where('student_id', $studentId)
            ->where('tenant_id', $tenantId)
            ->orderBy('date', 'DESC')
            ->findAll();
    }

    /**
     * Get a paginated list of receipt summaries for a single student.
     * Reuses basePaymentHistoryBuilder for multi-category grouping and
     * applyPaymentTransactionDisplayCondition for deduplication.
     *
     * @param string $studentId The student ID (globally unique)
     * @param string $tenantId  The tenant ID resolved from the student record
     * @param int    $limit     Page size
     * @param int    $offset    Offset for pagination
     * @return array List of receipt summary rows
     */
    public function getReceiptListForStudent(string $studentId, string $tenantId, int $limit, int $offset): array
    {
        $builder = $this->basePaymentHistoryBuilder($tenantId);
        $builder->where('p.student_id', $studentId);
        $this->applyPaymentTransactionDisplayCondition($builder);
        $builder->orderBy('p.date', 'DESC');
        $builder->orderBy('p.created_at', 'DESC');
        $builder->orderBy('p.id', 'DESC');
        $rows = $builder->limit($limit, $offset)->get()->getResultArray();

        return array_map(fn($row) => $this->formatReceiptListEntry($row), $rows);
    }

    /**
     * Count distinct receipt transactions for a student (grouped payments count as 1).
     *
     * @param string $studentId The student ID
     * @param string $tenantId  The tenant ID
     * @return int Total distinct transaction count
     */
    public function getReceiptListCountForStudent(string $studentId, string $tenantId): int
    {
        $builder = $this->db->table('payments p')
            ->select('COUNT(DISTINCT COALESCE(p.payment_group_id, p.id)) AS total', false)
            ->where('p.tenant_id', $tenantId)
            ->where('p.student_id', $studentId);
        $row = $builder->get()->getRowArray();
        return (int) ($row['total'] ?? 0);
    }

    /**
     * Format a receipt list entry from a raw payment row (camelCase, view-ready).
     */
    private function formatReceiptListEntry(array $row): array
    {
        return [
            'id'               => $row['id'],
            'amount'           => (float) $row['amount'],
            'date'             => $row['date'],
            'method'           => $row['method'] ?? '',
            'category'         => $row['category'] ?? '',
            'description'      => $row['description'] ?? '',
            'receiptNumber'    => $row['receipt_number'] ?? null,
            'isGeneralPayment' => isset($row['is_general_payment']) ? (bool) $row['is_general_payment'] : false,
            'paymentGroupId'   => $row['payment_group_id'] ?? null,
            'isVoided'         => !empty($row['voided_at']),
            'voidedAt'         => $row['voided_at'] ?? null,
            'voidReason'       => $row['void_reason'] ?? null,
        ];
    }

    public function getStudentPaymentHistory(string $tenantId, string $studentId, array $filters, int $limit, int $offset, ?string $termStart = null, ?string $termEnd = null): array
    {
        $filters['studentId'] = $studentId;

        $paymentsBuilder = $this->basePaymentHistoryBuilder($tenantId);
        $this->applyFilteredPaymentConditions($paymentsBuilder, $filters);
        $this->applyPaymentTransactionDisplayCondition($paymentsBuilder);
        $this->applyPaymentOrdering($paymentsBuilder, $filters);
        $payments = $paymentsBuilder
            ->limit($limit, $offset)
            ->get()
            ->getResultArray();

        $countBuilder = $this->db->table('payments p')
            ->select('COUNT(DISTINCT COALESCE(p.payment_group_id, p.id)) AS total, COALESCE(SUM(p.amount), 0) AS total_paid', false)
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId);
        $this->applyFilteredPaymentConditions($countBuilder, $filters);
        $totals = $countBuilder->get()->getRowArray();

        $latestBuilder = $this->db->table('payments p')
            ->select(
                "p.date,
                CASE
                    WHEN p.payment_group_id IS NOT NULL THEN (
                        SELECT COALESCE(SUM(pg.amount), 0)
                        FROM payments pg
                        WHERE pg.tenant_id = p.tenant_id
                          AND pg.payment_group_id = p.payment_group_id
                    )
                    ELSE p.amount
                END AS amount",
                false
            )
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId);
        $this->applyFilteredPaymentConditions($latestBuilder, $filters);
        $this->applyPaymentTransactionDisplayCondition($latestBuilder);
        $latest = $latestBuilder
            ->orderBy('p.date', 'DESC')
            ->orderBy('p.created_at', 'DESC')
            ->limit(1)
            ->get()
            ->getRowArray();

        $termTotal = 0.0;
        if ($termStart && $termEnd) {
            $termFilters = $filters;
            unset($termFilters['dateFrom'], $termFilters['dateTo'], $termFilters['month'], $termFilters['year']);
            $termBuilder = $this->db->table('payments p')
                ->select('COALESCE(SUM(p.amount), 0) AS total')
                ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
                ->join('classes c', 'c.id = s.class_id AND c.tenant_id = p.tenant_id', 'left')
                ->where('p.tenant_id', $tenantId)
                ->where('p.date >=', $termStart)
                ->where('p.date <=', $termEnd);
            $this->applyFilteredPaymentConditions($termBuilder, $termFilters);
            $termRow = $termBuilder->get()->getRowArray();
            $termTotal = (float) ($termRow['total'] ?? 0);
        }

        $latestDate = $latest['date'] ?? null;

        return [
            'data' => $payments,
            'pagination' => [
                'total' => (int) ($totals['total'] ?? 0),
            ],
            'summary' => [
                'totalPaid' => (float) ($totals['total_paid'] ?? 0),
                'totalThisTerm' => $termTotal,
                'latestPaymentDate' => $latestDate,
                'latestPaymentAmount' => isset($latest['amount']) ? (float) $latest['amount'] : null,
                'daysSinceLastPayment' => $latestDate ? max(0, (int) floor((strtotime(date('Y-m-d')) - strtotime($latestDate)) / 86400)) : null,
            ],
        ];
    }

    public function getRecent(string $tenantId, int $limit = 10): array
    {
        return $this->where('tenant_id', $tenantId)
            ->orderBy('date', 'DESC')
            ->limit($limit)
            ->findAll();
    }

    public function getRevenueByCategory(string $tenantId): array
    {
        return $this->select('category, SUM(amount) as total')
            ->where('tenant_id', $tenantId)
            ->groupBy('category')
            ->findAll();
    }

    /**
     * Total payment amount grouped by category within an inclusive date range.
     * Excludes voided payments. Grouped (multi-category) payments are counted
     * per category row, with counts de-duplicated by payment group.
     */
    public function getCategoryTotals(string $tenantId, string $dateFrom, string $dateTo): array
    {
        $rows = $this->db->table('payments p')
            ->select("COALESCE(NULLIF(p.category, ''), 'Uncategorized') AS label, COUNT(DISTINCT COALESCE(p.payment_group_id, p.id)) AS count, COALESCE(SUM(p.amount), 0) AS total", false)
            ->where('p.tenant_id', $tenantId)
            ->where('p.voided_at', null)
            ->where('p.date >=', $dateFrom)
            ->where('p.date <=', $dateTo)
            ->groupBy("COALESCE(NULLIF(p.category, ''), 'Uncategorized')", false)
            ->orderBy('total', 'DESC')
            ->get()
            ->getResultArray();

        $byCategory = array_map(fn($row) => [
            'label' => (string) $row['label'],
            'count' => (int) $row['count'],
            'total' => (float) $row['total'],
        ], $rows);

        $totalsRow = $this->db->table('payments p')
            ->select('COUNT(DISTINCT COALESCE(p.payment_group_id, p.id)) AS grand_count, COALESCE(SUM(p.amount), 0) AS grand_total', false)
            ->where('p.tenant_id', $tenantId)
            ->where('p.voided_at', null)
            ->where('p.date >=', $dateFrom)
            ->where('p.date <=', $dateTo)
            ->get()
            ->getRowArray();

        return [
            'dateFrom'   => $dateFrom,
            'dateTo'     => $dateTo,
            'grandTotal' => (float) ($totalsRow['grand_total'] ?? 0),
            'grandCount' => (int) ($totalsRow['grand_count'] ?? 0),
            'byCategory' => $byCategory,
        ];
    }

    /**
     * Get total payments for a tenant
     */
    public function getTotalPaymentsByTenant(string $tenantId): float
    {
        $result = $this->select('SUM(amount) as total')
            ->where('tenant_id', $tenantId)
            ->first();
        
        return (float) ($result['total'] ?? 0);
    }

    /**
     * Get total payments for a specific student
     */
    public function getTotalPaymentsByStudent(string $studentId): float
    {
        $result = $this->select('SUM(amount) as total')
            ->where('student_id', $studentId)
            ->first();
        
        return (float) ($result['total'] ?? 0);
    }

    /**
     * Get total payments for a student within a date range
     */
    public function getTotalByStudentAndDateRange(string $studentId, string $startDate, string $endDate, string $tenantId): float
    {
        $result = $this->select('SUM(amount) as total')
            ->where('student_id', $studentId)
            ->where('tenant_id', $tenantId)
            ->where('date >=', $startDate)
            ->where('date <=', $endDate)
            ->first();
        
        return (float) ($result['total'] ?? 0);
    }

    /**
     * Get payments grouped by student for balance calculation
     * Returns: [student_id => total_payments]
     */
    public function getPaymentsByStudentGrouped(string $tenantId): array
    {
        $results = $this->select('student_id, SUM(amount) as total_payments')
            ->where('tenant_id', $tenantId)
            ->groupBy('student_id')
            ->findAll();
        
        $grouped = [];
        foreach ($results as $row) {
            $grouped[$row['student_id']] = (float) $row['total_payments'];
        }
        return $grouped;
    }

    /**
     * Get total revenue for a specific term
     */
    public function getRevenueByTerm(string $tenantId, string $termId): float
    {
        // Since term_id is no longer used, return 0 or remove this method
        return 0;
    }

    /**
     * Format payment for API response (snake_case to camelCase)
     */
    public function formatForApi(array $payment): array
    {
        if (empty($payment)) {
            return [];
        }

        // Derive month from date instead of using database month field
        $monthDerived = null;
        if (!empty($payment['date'])) {
            $monthDerived = date('n', strtotime($payment['date'])); // Returns 1-12 without leading zeros
        }
        
        $balanceAfter = $payment['balance_after_payment'] ?? null;
        $feeBalanceAfter = $payment['fee_balance_after_payment'] ?? null;
        $transportBalanceAfter = $payment['transport_balance_after_payment'] ?? null;

        // Decode snapshot JSON (feature 057 US5)
        $snapshot = null;
        if (!empty($payment['snapshot'])) {
            $decoded = json_decode($payment['snapshot'], true);
            $snapshot = is_array($decoded) ? $decoded : null;
        }

        return [
            'id'                   => $payment['id'],
            'tenantId'             => $payment['tenant_id'],
            'studentId'            => $payment['student_id'],
            'amount'               => (float) $payment['amount'],
            'date'                 => $payment['date'],
            'method'               => $payment['method'],
            'description'          => $payment['description'] ?? '',
            'category'             => $payment['category'] ?? '',
            'month'                => $monthDerived,
            'routeId'              => $payment['route_id'] ?? null,
            'feeCampaignId'        => $payment['fee_campaign_id'] ?? null,
            'balanceAfterPayment'  => $balanceAfter !== null ? (float) $balanceAfter : null,
            'feeBalanceAfterPayment' => $feeBalanceAfter !== null ? (float) $feeBalanceAfter : null,
            'transportBalanceAfterPayment' => $transportBalanceAfter !== null ? (float) $transportBalanceAfter : null,
            'receiptNumber'        => $payment['receipt_number'] ?? null,
            'snapshot'             => $snapshot,
            'isGeneralPayment'     => isset($payment['is_general_payment']) ? (bool) $payment['is_general_payment'] : false,
            'paymentGroupId'       => $payment['payment_group_id'] ?? null,
            'isVoided'             => !empty($payment['voided_at']),
            'voidedAt'             => $payment['voided_at'] ?? null,
            'voidReason'           => $payment['void_reason'] ?? null,
            'voidedBy'             => $payment['voided_by'] ?? null,
            'currencyCode'         => $payment['currency_code'] ?? null,
            'originalAmount'       => isset($payment['original_amount']) ? (float) $payment['original_amount'] : null,
            'exchangeRate'         => isset($payment['exchange_rate']) ? (float) $payment['exchange_rate'] : null,
            'rateManualOverride'   => isset($payment['rate_manual_override']) ? (bool) $payment['rate_manual_override'] : false,
        ];
    }

    /**
     * Format API request data for database (camelCase to snake_case)
     */
    public function formatFromApi(array $data, string $tenantId): array
    {
        // Derive month from date for consistency
        $date = $data['date'] ?? date('Y-m-d');
        $monthDerived = date('n', strtotime($date)); // Returns 1-12 without leading zeros
        
        return [
            'tenant_id' => $tenantId,
            'student_id' => $data['studentId'] ?? null,
            'amount' => $data['amount'] ?? 0,
            'date' => $date,
            'method' => $data['method'] ?? 'Cash',
            'description' => $data['description'] ?? '',
            'category' => $data['category'] ?? '',
            'month' => $monthDerived,
            'route_id' => $data['routeId'] ?? null,
        ];
    }
}
