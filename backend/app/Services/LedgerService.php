<?php

namespace App\Services;

/**
 * LedgerService — Single authoritative source for all balance calculations
 * and ledger-related report queries.
 *
 * Constitution Principle V: Balance is ALWAYS computed at query time from source
 * records. No balance is stored or cached server-side.
 *
 * Constitution Principle I: All queries accept $tenantId sourced from the JWT
 * payload (never from request body). Methods do NOT look up tenantId themselves.
 *
 * Feature 094 (Multi-Currency): The `amount` column on charges and payments
 * ALWAYS holds the base-currency equivalent, computed once and immutably at
 * transaction creation time by CurrencyService::resolveTransactionCurrency().
 * This means all SUM(amount) queries in this service automatically aggregate
 * correctly across different transaction currencies — no conversion logic is
 * needed here. Cross-currency FIFO allocation works because both charges and
 * payments are expressed in the same base currency on the `amount` column.
 * The original currency details (currency_code, original_amount, exchange_rate)
 * are preserved on each row for display/reporting transparency but do NOT
 * participate in balance arithmetic.
 *
 * Usage:
 *   $service = new \App\Services\LedgerService(\Config\Database::connect());
 *   $balance = $service->getStudentBalance($studentId, $tenantId);
 */
class LedgerService
{
    public const ELIGIBLE_CHARGE_TYPES = ['fee_structure', 'transport'];
    public const ELIGIBLE_FEE_PAYMENT_CATEGORIES = ['Fees', 'Transport + Fees'];
    public const ELIGIBLE_TRANSPORT_PAYMENT_CATEGORIES = ['Transport', 'Transport Fee'];
    public const ELIGIBLE_PAYMENT_CATEGORIES = ['Fees', 'Transport + Fees', 'Transport', 'Transport Fee'];

    private $db;

    public function __construct($db)
    {
        $this->db = $db;
    }

    public static function eligibleChargeTypeSqlList(): string
    {
        return self::quoteSqlValues(self::ELIGIBLE_CHARGE_TYPES);
    }

    public static function eligiblePaymentCategorySqlList(): string
    {
        return self::quoteSqlValues(self::ELIGIBLE_PAYMENT_CATEGORIES);
    }

    public static function eligibleFeePaymentCategorySqlList(): string
    {
        return self::quoteSqlValues(self::ELIGIBLE_FEE_PAYMENT_CATEGORIES);
    }

    public static function eligibleTransportPaymentCategorySqlList(): string
    {
        return self::quoteSqlValues(self::ELIGIBLE_TRANSPORT_PAYMENT_CATEGORIES);
    }

    private static function quoteSqlValues(array $values): string
    {
        return "'" . implode("', '", array_map(static fn ($value) => str_replace("'", "''", $value), $values)) . "'";
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BALANCE CALCULATION
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Return the full balance breakdown for a single student.
     *
     * Formula: balance = totalCharges + debitAdjustments - totalPayments - creditAdjustments
     *
     * Charge classification uses charge_type (not legacy boolean flags):
     *   fee_structure charges ↔ payments where route_id IS NULL
     *   transport charges     ↔ payments where route_id IS NOT NULL
     *
     * @return array{
     *   studentId: string,
     *   totalCharges: float,
     *   totalPayments: float,
     *   creditAdjustments: float,
     *   debitAdjustments: float,
     *   balance: float,
     *   feeBalance: float,
     *   transportBalance: float
     * }
     */
    public function getStudentBalance(string $studentId, string $tenantId): array
    {
        // ── Fee-structure charges ──────────────────────────────────────────────
        $feeCharges = (float) ($this->db->table('charges')
            ->selectSum('amount')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('charge_type', 'fee_structure')
            ->where('deleted_at', null)
            ->where('voided_at', null)
            ->get()->getRow()->amount ?? 0);

        // ── Transport charges ─────────────────────────────────────────────────
        $transportCharges = (float) ($this->db->table('charges')
            ->selectSum('amount')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('charge_type', 'transport')
            ->where('deleted_at', null)
            ->where('voided_at', null)
            ->get()->getRow()->amount ?? 0);

        $totalCharges = $feeCharges + $transportCharges;

        // ── Fee/general payments (excluding Transport + Fees for now) ──
        $feePaymentsOnly = (float) ($this->db->table('payments')
            ->selectSum('amount')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('fee_campaign_id', null)
            ->where('category', 'Fees')
            ->where('voided_at', null)
            ->get()->getRow()->amount ?? 0);

        // ── Transport + Fees payments (need dynamic allocation) ────────
        $transportFeesPayments = (float) ($this->db->table('payments')
            ->selectSum('amount')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('fee_campaign_id', null)
            ->where('category', 'Transport + Fees')
            ->where('voided_at', null)
            ->get()->getRow()->amount ?? 0);

        // ── Transport payments ───────────────────────────────────────────────
        $transportPaymentsOnly = (float) ($this->db->table('payments')
            ->selectSum('amount')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('fee_campaign_id', null)
            ->whereIn('category', self::ELIGIBLE_TRANSPORT_PAYMENT_CATEGORIES)
            ->where('voided_at', null)
            ->get()->getRow()->amount ?? 0);

        // ── Dynamic allocation for Transport + Fees ───────────────────────
        // Transport + Fees payments first cover fee charges, then overflow to transport
        $outstandingFeeCharges = max(0, $feeCharges - $feePaymentsOnly);
        $transportFeesToFee = min($transportFeesPayments, $outstandingFeeCharges);
        $transportFeesToTransport = max(0, $transportFeesPayments - $transportFeesToFee);

        // ── Final payment totals ─────────────────────────────────────────────
        $feePayments = $feePaymentsOnly + $transportFeesToFee;
        $transportPayments = $transportPaymentsOnly + $transportFeesToTransport;

        $totalPayments = $feePayments + $transportPayments;

        // ── Adjustments (only if table exists) ───────────────────────────────
        $creditAdjustments = 0.0;
        $debitAdjustments  = 0.0;

        if ($this->db->tableExists('ledger_adjustments')) {
            $creditAdjustments = (float) ($this->db->table('ledger_adjustments')
                ->selectSum('amount')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $studentId)
                ->where('adjustment_type', 'credit')
                ->where('status', 'approved')
                ->get()->getRow()->amount ?? 0);

            $debitAdjustments = (float) ($this->db->table('ledger_adjustments')
                ->selectSum('amount')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $studentId)
                ->where('adjustment_type', 'debit')
                ->where('status', 'approved')
                ->get()->getRow()->amount ?? 0);
        }

        $balance = $totalCharges + $debitAdjustments - $totalPayments - $creditAdjustments;

        // Calculate independent category balances for split-category payments:
        // Fee Balance = Fee Charges - Fee Payments (payments in ELIGIBLE_FEE_PAYMENT_CATEGORIES)
        // Transport Balance = Transport Charges - Transport Payments (payments in ELIGIBLE_TRANSPORT_PAYMENT_CATEGORIES)
        // This ensures split payments like ($10 Transport + $90 Fees) show correct independent balances.
        $feeBalance            = $feeCharges + $debitAdjustments - $feePayments - $creditAdjustments;
        $transportBalance      = $transportCharges - $transportPayments;

        return [
            'studentId'          => $studentId,
            'totalCharges'       => $totalCharges,
            'totalPayments'      => $totalPayments,
            'creditAdjustments'  => $creditAdjustments,
            'debitAdjustments'   => $debitAdjustments,
            'balance'            => $balance,
            'feeBalance'         => $feeBalance,
            'transportBalance'   => $transportBalance,
        ];
    }

    /**
     * Return balance for every active student in the tenant using a single
     * optimised SQL query (no N+1 queries).
     *
     * Preserves the getAllBalances subquery pattern required by Constitution Principle V.
     *
     * @return array<int, array{
     *   studentId: string,
     *   studentName: string,
     *   classId: string|null,
     *   totalCharges: float,
     *   totalPayments: float,
     *   creditAdjustments: float,
     *   debitAdjustments: float,
     *   balance: float,
     *   feeBalance: float,
     *   transportBalance: float
     * }>
     */
    public function getAllBalances(string $tenantId): array
    {
        $hasAdjustments = $this->db->tableExists('ledger_adjustments');

        $sql = "
            SELECT
                s.id                                                         AS studentId,
                CONCAT(s.first_name, ' ', s.last_name)                      AS studentName,
                s.class_id                                                   AS classId,
                COALESCE(fc.fee_charges,  0)                                 AS feeCharges,
                COALESCE(tc.trans_charges, 0)                                AS transportCharges,
                COALESCE(fc.fee_charges, 0) + COALESCE(tc.trans_charges, 0) AS totalCharges,
                COALESCE(fpo.fee_payments_only, 0) + 
                    LEAST(COALESCE(tfp.transport_fees_payments, 0), 
                         GREATEST(COALESCE(fc.fee_charges, 0) - COALESCE(fpo.fee_payments_only, 0), 0)) AS feePayments,
                COALESCE(tpo.transport_payments_only, 0) + 
                    GREATEST(COALESCE(tfp.transport_fees_payments, 0) - 
                         LEAST(COALESCE(tfp.transport_fees_payments, 0), 
                              GREATEST(COALESCE(fc.fee_charges, 0) - COALESCE(fpo.fee_payments_only, 0), 0)), 0) AS transportPayments,
                (COALESCE(fpo.fee_payments_only, 0) + 
                    LEAST(COALESCE(tfp.transport_fees_payments, 0), 
                         GREATEST(COALESCE(fc.fee_charges, 0) - COALESCE(fpo.fee_payments_only, 0), 0)) +
                 COALESCE(tpo.transport_payments_only, 0) + 
                    GREATEST(COALESCE(tfp.transport_fees_payments, 0) - 
                         LEAST(COALESCE(tfp.transport_fees_payments, 0), 
                              GREATEST(COALESCE(fc.fee_charges, 0) - COALESCE(fpo.fee_payments_only, 0), 0)), 0)) AS totalPayments,
                COALESCE(cr.total_credits, 0)                                AS creditAdjustments,
                COALESCE(db.total_debits,  0)                                AS debitAdjustments,
                COALESCE(fc.fee_charges, 0) + COALESCE(tc.trans_charges, 0)
                    + COALESCE(db.total_debits, 0)
                    - ((COALESCE(fpo.fee_payments_only, 0) + 
                    LEAST(COALESCE(tfp.transport_fees_payments, 0), 
                         GREATEST(COALESCE(fc.fee_charges, 0) - COALESCE(fpo.fee_payments_only, 0), 0)) +
                 COALESCE(tpo.transport_payments_only, 0) + 
                    GREATEST(COALESCE(tfp.transport_fees_payments, 0) - 
                         LEAST(COALESCE(tfp.transport_fees_payments, 0), 
                              GREATEST(COALESCE(fc.fee_charges, 0) - COALESCE(fpo.fee_payments_only, 0), 0)), 0)))
                    - COALESCE(cr.total_credits, 0)                          AS balance,
                COALESCE(fc.fee_charges, 0) + COALESCE(db.total_debits, 0) 
                    - (COALESCE(fpo.fee_payments_only, 0) + 
                    LEAST(COALESCE(tfp.transport_fees_payments, 0), 
                         GREATEST(COALESCE(fc.fee_charges, 0) - COALESCE(fpo.fee_payments_only, 0), 0))) 
                    - COALESCE(cr.total_credits, 0) AS feeBalance,
                COALESCE(tc.trans_charges, 0) 
                    - (COALESCE(tpo.transport_payments_only, 0) + 
                    GREATEST(COALESCE(tfp.transport_fees_payments, 0) - 
                         LEAST(COALESCE(tfp.transport_fees_payments, 0), 
                              GREATEST(COALESCE(fc.fee_charges, 0) - COALESCE(fpo.fee_payments_only, 0), 0)), 0)) AS transportBalance
            FROM students s
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS fee_charges
                FROM charges
                WHERE tenant_id = ? AND deleted_at IS NULL AND voided_at IS NULL AND charge_type = 'fee_structure'
                GROUP BY student_id
            ) fc ON fc.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS trans_charges
                FROM charges
                WHERE tenant_id = ? AND deleted_at IS NULL AND voided_at IS NULL AND charge_type = 'transport'
                GROUP BY student_id
            ) tc ON tc.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS fee_payments_only
                FROM payments
                WHERE tenant_id = ?
                  AND fee_campaign_id IS NULL
                  AND category = 'Fees'
                  AND voided_at IS NULL
                GROUP BY student_id
            ) fpo ON fpo.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS transport_fees_payments
                FROM payments
                WHERE tenant_id = ?
                  AND fee_campaign_id IS NULL
                  AND category = 'Transport + Fees'
                  AND voided_at IS NULL
                GROUP BY student_id
            ) tfp ON tfp.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS transport_payments_only
                FROM payments
                WHERE tenant_id = ? AND fee_campaign_id IS NULL
                  AND category IN ('Transport', 'Transport Fee')
                  AND voided_at IS NULL
                GROUP BY student_id
            ) tpo ON tpo.student_id = s.id
        ";

        if ($hasAdjustments) {
            $sql .= "
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS total_credits
                FROM ledger_adjustments
                WHERE tenant_id = ? AND adjustment_type = 'credit' AND status = 'approved'
                GROUP BY student_id
            ) cr ON cr.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) AS total_debits
                FROM ledger_adjustments
                WHERE tenant_id = ? AND adjustment_type = 'debit' AND status = 'approved'
                GROUP BY student_id
            ) db ON db.student_id = s.id
            ";
        } else {
            $sql .= "
            LEFT JOIN (SELECT NULL AS student_id, 0 AS total_credits WHERE 1=0) cr ON cr.student_id = s.id
            LEFT JOIN (SELECT NULL AS student_id, 0 AS total_debits  WHERE 1=0) db ON db.student_id = s.id
            ";
        }

        $sql .= "
            WHERE s.tenant_id = ? AND s.status = 'active'
            ORDER BY s.last_name, s.first_name
        ";

        $params = $hasAdjustments
            ? [$tenantId, $tenantId, $tenantId, $tenantId, $tenantId, $tenantId, $tenantId, $tenantId]
            : [$tenantId, $tenantId, $tenantId, $tenantId, $tenantId, $tenantId];

        $rows = $this->db->query($sql, $params)->getResultArray();

        return array_map(function (array $row): array {
            return [
                'studentId'          => $row['studentId'],
                'studentName'        => $row['studentName'],
                'classId'            => $row['classId'],
                'totalCharges'       => (float) $row['totalCharges'],
                'totalPayments'      => (float) $row['totalPayments'],
                'creditAdjustments'  => (float) $row['creditAdjustments'],
                'debitAdjustments'   => (float) $row['debitAdjustments'],
                'balance'            => (float) $row['balance'],
                'feeBalance'         => (float) $row['feeBalance'],
                'transportBalance'   => (float) $row['transportBalance'],
            ];
        }, $rows);
    }

    /**
     * Return balance for a specific set of student IDs using the same
     * optimised subquery pattern as getAllBalances().
     *
     * Returns a map keyed by studentId for fast lookup.
     *
     * @param string[] $studentIds
     * @param string   $tenantId
     * @return array<string, array{
     *   studentId: string,
     *   studentName: string,
     *   classId: string|null,
     *   totalCharges: float,
     *   totalPayments: float,
     *   creditAdjustments: float,
     *   debitAdjustments: float,
     *   balance: float,
     *   feeBalance: float,
     *   transportBalance: float
     * }>
     */
    public function getBalancesForStudentIds(array $studentIds, string $tenantId): array
    {
        if (empty($studentIds)) {
            return [];
        }

        $allBalances = $this->getAllBalances($tenantId);
        $lookup      = array_column($allBalances, null, 'studentId');

        $result = [];
        foreach ($studentIds as $id) {
            if (isset($lookup[$id])) {
                $result[(string) $id] = $lookup[$id];
            }
        }

        return $result;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PAYMENT ALLOCATION
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * FIFO charge allocation — must be called inside an active database transaction.
     *
     * Re-applies all of a student's payments to their outstanding charges,
     * oldest charge first (FIFO).
     *
     * Allocation pools (feature 057 US4 FR-013–016):
     *  • Transport pool — payments where route_id IS NOT NULL  OR  category = 'Transport'.
     *  • Fee/general pool — all other payments (Fees, Transport + Fees, user-defined, empty).
     *
     * Overflow rule: any fee/general credit that remains after ALL fee-structure charges
     * are fully settled spills into the transport pool. This ensures that 'Transport + Fees'
     * payments reduce transport charges after fees are cleared.
     *
     * @param string $studentId
     * @param string $tenantId
     * @param mixed  $db        Active CodeIgniter database connection
     */
    public function allocatePaymentToCharges(string $studentId, string $tenantId, $db): void
    {
        $now = date('Y-m-d H:i:s');
        $hasAdjustmentTracking = $db->tableExists('ledger_adjustments')
            && $db->fieldExists('paid_amount', 'ledger_adjustments')
            && $db->fieldExists('payment_status', 'ledger_adjustments')
            && $db->fieldExists('paid_at', 'ledger_adjustments');

        // ── Fee/general payment pool ──────────────────────────────────────────
        // Payments where route_id IS NULL AND category != 'Transport'.
        // Covers: 'Fees', 'Transport + Fees', user-defined, and empty/null category.
        $feePaymentsRow = $db->table('payments')
            ->selectSum('amount')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('fee_campaign_id', null)
            ->whereIn('category', self::ELIGIBLE_FEE_PAYMENT_CATEGORIES)
            ->where('voided_at', null)
            ->get()->getRow();

        $feeCredit = (float) ($feePaymentsRow->amount ?? 0);

        if ($hasAdjustmentTracking) {
            $creditAdjustmentsRow = $db->table('ledger_adjustments')
                ->selectSum('amount')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $studentId)
                ->where('adjustment_type', 'credit')
                ->where('status', 'approved')
                ->get()->getRow();

            $feeCredit += (float) ($creditAdjustmentsRow->amount ?? 0);

            $db->table('ledger_adjustments')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $studentId)
                ->where('adjustment_type', 'credit')
                ->where('status', 'approved')
                ->update([
                    'paid_amount' => new \CodeIgniter\Database\RawSql('amount'),
                    'payment_status' => 'paid',
                    'paid_at' => $now,
                    'updated_at' => $now,
                ]);
        }

        $feeCharges = $db->table('charges')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('charge_type', 'fee_structure')
            ->whereIn('status', ['pending', 'partial', 'paid'])
            ->where('deleted_at', null)
            ->where('voided_at', null)
            ->orderBy('date_generated', 'ASC')
            ->get()->getResultArray();

        $debitAdjustments = [];
        if ($hasAdjustmentTracking) {
            $debitAdjustments = $db->table('ledger_adjustments')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $studentId)
                ->where('adjustment_type', 'debit')
                ->where('status', 'approved')
                ->orderBy('effective_date', 'ASC')
                ->orderBy('created_at', 'ASC')
                ->get()->getResultArray();
        }

        $feeLedgerItems = [];
        foreach ($feeCharges as $charge) {
            $feeLedgerItems[] = [
                'kind' => 'charge',
                'id' => $charge['id'],
                'amount' => (float) $charge['amount'],
                'date' => $charge['date_generated'] ?? $charge['created_at'] ?? '',
            ];
        }
        foreach ($debitAdjustments as $adjustment) {
            $feeLedgerItems[] = [
                'kind' => 'debit_adjustment',
                'id' => $adjustment['id'],
                'amount' => (float) $adjustment['amount'],
                'date' => $adjustment['effective_date'] ?? $adjustment['created_at'] ?? '',
            ];
        }
        usort($feeLedgerItems, static fn (array $a, array $b): int => strcmp((string) $a['date'], (string) $b['date']));

        foreach ($feeLedgerItems as $item) {
            $itemAmount = (float) $item['amount'];
            $applied = min($feeCredit, $itemAmount);
            $status = $applied >= $itemAmount ? 'paid' : ($applied > 0 ? 'partial' : 'pending');

            if ($item['kind'] === 'charge') {
                $db->table('charges')->where('id', $item['id'])
                    ->update(['status' => $status, 'updated_at' => $now]);
            } elseif ($hasAdjustmentTracking) {
                $db->table('ledger_adjustments')->where('id', $item['id'])
                    ->update([
                        'paid_amount' => round($applied, 2),
                        'payment_status' => $status === 'pending' ? 'unpaid' : $status,
                        'paid_at' => $status === 'paid' ? $now : null,
                        'updated_at' => $now,
                    ]);
            }

            $feeCredit -= $applied;
            if ($feeCredit <= 0) {
                $feeCredit = 0.0;
            }
        }
        // $feeCredit now holds the surplus (overpayment beyond all fee-structure charges).
        // This surplus overflows into the transport pool below.

        // ── Transport payment pool ────────────────────────────────────────────
        $transportCredit = (float) ($db->table('payments')
            ->selectSum('amount')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('fee_campaign_id', null)
            ->whereIn('category', self::ELIGIBLE_TRANSPORT_PAYMENT_CATEGORIES)
            ->where('voided_at', null)
            ->get()->getRow()->amount ?? 0);
        $transportCredit += $feeCredit;

        $transportCharges = $db->table('charges')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('charge_type', 'transport')
            ->whereIn('status', ['pending', 'partial', 'paid'])
            ->where('deleted_at', null)
            ->where('voided_at', null)
            ->orderBy('date_generated', 'ASC')
            ->get()->getResultArray();

        foreach ($transportCharges as $charge) {
            $chargeAmount = (float) $charge['amount'];
            if ($transportCredit >= $chargeAmount) {
                $db->table('charges')->where('id', $charge['id'])
                    ->update(['status' => 'paid', 'updated_at' => $now]);
                $transportCredit -= $chargeAmount;
            } elseif ($transportCredit > 0) {
                $db->table('charges')->where('id', $charge['id'])
                    ->update(['status' => 'partial', 'updated_at' => $now]);
                $transportCredit = 0.0;
            } else {
                $db->table('charges')->where('id', $charge['id'])
                    ->update(['status' => 'pending', 'updated_at' => $now]);
            }
        }
    }

    public function allocateAdjustmentsForStudent(string $studentId, string $tenantId): void
    {
        if (! $this->db->tableExists('ledger_adjustments')) {
            return;
        }

        if (! $this->db->fieldExists('paid_amount', 'ledger_adjustments')
            || ! $this->db->fieldExists('payment_status', 'ledger_adjustments')
            || ! $this->db->fieldExists('paid_at', 'ledger_adjustments')) {
            return;
        }

        $this->allocatePaymentToCharges($studentId, $tenantId, $this->db);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // BILLING RUN HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Determine whether a billing run can be safely voided.
     *
     * A billing run is voidable only if no student who received a charge from
     * that run has subsequently made any payment.
     *
     * @return bool true = safe to void; false = payments exist, cannot void
     */
    public function isBillingRunVoidable(string $billingRunId, string $tenantId): bool
    {
        // Get all charges in this billing run
        $charges = $this->db->table('charges')
            ->select('student_id, date_generated')
            ->where('billing_run_id', $billingRunId)
            ->where('tenant_id', $tenantId)
            ->where('deleted_at', null)
            ->get()->getResultArray();

        if (empty($charges)) {
            return true; // nothing to block void
        }

        // Get unique students and the earliest charge date in this run
        $studentIds = array_unique(array_column($charges, 'student_id'));
        $earliestDate = min(array_column($charges, 'date_generated'));

        // Check if any payment exists for these students on or after the earliest charge date
        $paymentCount = $this->db->table('payments')
            ->whereIn('student_id', $studentIds)
            ->where('tenant_id', $tenantId)
            ->where('date >=', $earliestDate)
            ->where('voided_at', null)
            ->countAllResults();

        return $paymentCount === 0;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // REPORTS
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Payment collection report for a given term.
     *
     * Returns aggregate totals plus a per-student breakdown of charges vs payments.
     *
     * @return array{
     *   termId: string,
     *   totalCharged: float,
     *   totalCollected: float,
     *   collectionRate: float,
     *   studentsFullyPaid: int,
     *   studentsWithBalance: int,
     *   studentsNotPaid: int,
     *   byStudent: array
     * }
     */
    public function getPaymentCollectionReport(string $tenantId, string $termId): array
    {
        // Aggregate charges per student for this term
        $chargeRows = $this->db->query("
            SELECT
                c.student_id,
                SUM(c.amount) AS total_charged,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.class_id
            FROM charges c
            INNER JOIN students s ON s.id = c.student_id
            WHERE c.tenant_id = ?
              AND c.term_id = ?
              AND c.deleted_at IS NULL
              AND c.voided_at IS NULL
            GROUP BY c.student_id, s.first_name, s.last_name, s.class_id
        ", [$tenantId, $termId])->getResultArray();

        if (empty($chargeRows)) {
            return [
                'termId'             => $termId,
                'totalCharged'       => 0.0,
                'totalCollected'     => 0.0,
                'collectionRate'     => 0.0,
                'studentsFullyPaid'  => 0,
                'studentsWithBalance'=> 0,
                'studentsNotPaid'    => 0,
                'byStudent'          => [],
            ];
        }

        $studentIds = array_column($chargeRows, 'student_id');

        // Aggregate all payments for these students (all time — payments aren't
        // term-scoped in the current schema, so we use total payments vs term charges)
        $paymentRows = $this->db->table('payments')
            ->select('student_id, SUM(amount) AS total_paid')
            ->where('tenant_id', $tenantId)
            ->whereIn('student_id', $studentIds)
            ->where('voided_at', null)
            ->groupBy('student_id')
            ->get()->getResultArray();

        $paymentMap = [];
        foreach ($paymentRows as $row) {
            $paymentMap[$row['student_id']] = (float) $row['total_paid'];
        }

        $totalCharged   = 0.0;
        $totalCollected = 0.0;
        $fullyPaid      = 0;
        $withBalance    = 0;
        $notPaid        = 0;
        $byStudent      = [];

        foreach ($chargeRows as $row) {
            $charged   = (float) $row['total_charged'];
            $paid      = $paymentMap[$row['student_id']] ?? 0.0;
            $balance   = max(0, $charged - $paid); // outstanding only (credit shown as 0)

            $totalCharged   += $charged;
            $totalCollected += min($paid, $charged); // cap at charged amount

            if ($balance <= 0) {
                $fullyPaid++;
                $status = 'paid';
            } elseif ($paid > 0) {
                $withBalance++;
                $status = 'partial';
            } else {
                $notPaid++;
                $status = 'unpaid';
            }

            $byStudent[] = [
                'studentId'    => $row['student_id'],
                'name'         => $row['student_name'],
                'class'        => $row['class_id'],
                'totalCharged' => $charged,
                'totalPaid'    => $paid,
                'balance'      => $balance,
                'status'       => $status,
            ];
        }

        $collectionRate = $totalCharged > 0
            ? round(($totalCollected / $totalCharged) * 100, 1)
            : 0.0;

        return [
            'termId'             => $termId,
            'totalCharged'       => $totalCharged,
            'totalCollected'     => $totalCollected,
            'collectionRate'     => $collectionRate,
            'studentsFullyPaid'  => $fullyPaid,
            'studentsWithBalance'=> $withBalance,
            'studentsNotPaid'    => $notPaid,
            'byStudent'          => $byStudent,
        ];
    }

    /**
     * Aged balance report — groups students by how overdue their oldest
     * outstanding charge is.
     *
     * Buckets: current (≤0 days), 1–30, 31–60, 61–90, 90+ days overdue.
     *
     * @return array{
     *   termId: string,
     *   generatedAt: string,
     *   summary: array,
     *   students: array
     * }
     */
    public function getAgedBalances(string $tenantId, string $termId): array
    {
        $today = date('Y-m-d');

        // Find minimum due_date per student for unpaid/partial charges in this term
        $rows = $this->db->query("
            SELECT
                c.student_id,
                CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                s.class_id,
                MIN(c.due_date) AS oldest_due_date,
                SUM(c.amount)   AS total_charged
            FROM charges c
            INNER JOIN students s ON s.id = c.student_id
            WHERE c.tenant_id = ?
              AND c.term_id = ?
              AND c.deleted_at IS NULL
              AND c.voided_at IS NULL
              AND c.status IN ('pending', 'partial')
            GROUP BY c.student_id, s.first_name, s.last_name, s.class_id
        ", [$tenantId, $termId])->getResultArray();

        $summary = [
            'current'    => ['count' => 0, 'totalBalance' => 0.0],
            'days1to30'  => ['count' => 0, 'totalBalance' => 0.0],
            'days31to60' => ['count' => 0, 'totalBalance' => 0.0],
            'days61to90' => ['count' => 0, 'totalBalance' => 0.0],
            'days90plus' => ['count' => 0, 'totalBalance' => 0.0],
        ];

        $students = [];

        foreach ($rows as $row) {
            $dueDate     = $row['oldest_due_date'];
            $balance     = (float) $row['total_charged'];
            $daysOverdue = (int) floor((strtotime($today) - strtotime($dueDate)) / 86400);

            $bucket = match (true) {
                $daysOverdue <= 0   => 'current',
                $daysOverdue <= 30  => 'days1to30',
                $daysOverdue <= 60  => 'days31to60',
                $daysOverdue <= 90  => 'days61to90',
                default             => 'days90plus',
            };

            $summary[$bucket]['count']++;
            $summary[$bucket]['totalBalance'] += $balance;

            $students[] = [
                'studentId'          => $row['student_id'],
                'name'               => $row['student_name'],
                'class'              => $row['class_id'],
                'oldestDueDate'      => $dueDate,
                'daysOverdue'        => max(0, $daysOverdue),
                'bucket'             => $bucket,
                'outstandingBalance' => $balance,
            ];
        }

        return [
            'termId'      => $termId,
            'generatedAt' => date('c'),
            'summary'     => $summary,
            'students'    => $students,
        ];
    }
}
