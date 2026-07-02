<?php

namespace App\Services;

use Dompdf\Dompdf;
use Dompdf\Options;

/**
 * FinancialReportService — Assembles financial report data and generates a PDF.
 *
 * Constitution compliance:
 *   I.   All queries filter by $tenantId from JWT (never from request params).
 *   V.   Uses LedgerService::ELIGIBLE_CHARGE_TYPES and ELIGIBLE_PAYMENT_CATEGORIES
 *         to ensure report totals match dashboard figures exactly.
 *   VII. Single-responsibility; one public entry point: generateReport().
 */
class FinancialReportService
{
    private $db;

    /** Maximum transactions to include in detailed table before truncation warning */
    private const MAX_TRANSACTIONS = 5000;

    /** Chunk size for processing large datasets to avoid memory exhaustion */
    private const CHUNK_SIZE = 1000;

    public function __construct($db)
    {
        $this->db = $db;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Generate a financial report PDF and return the raw bytes.
     *
     * @param string $tenantId   Tenant ID from JWT payload.
     * @param array  $filters    Keys: termId, month, year, classId, method, category.
     * @return string            Raw PDF bytes.
     * @throws \RuntimeException When the period cannot be resolved.
     */
    public function generateReport(string $tenantId, array $filters): string
    {
        $period = $this->resolvePeriodDates($tenantId, $filters['termId'] ?? null, $filters['month'] ?? null, $filters['year'] ?? null);

        $startDate   = $period['startDate'];
        $endDate     = $period['endDate'];
        $periodLabel = $period['label'];

        $tenant    = $this->fetchTenant($tenantId);
        $schoolName = $tenant['name'] ?? 'School';

        // Multi-currency: resolve base and reporting currency (Feature 094)
        $currencyService = new \App\Services\CurrencyService($this->db);
        $baseCurrency = $currencyService->getBaseCurrency($tenantId);
        $reportingCurrency = $filters['reportingCurrency'] ?? $baseCurrency;

        // Validate reporting currency is enabled
        if ($reportingCurrency !== $baseCurrency) {
            if (!$currencyService->isCurrencyEnabled($tenantId, $reportingCurrency)) {
                throw new \InvalidArgumentException("{$reportingCurrency} is not an enabled currency for this tenant");
            }
        }

        $currency = $reportingCurrency;

        $logoDataUri = '';
        $logoPath = FCPATH . '1765028860800.jpg';
        if (is_file($logoPath)) {
            $logoDataUri = 'data:image/jpeg;base64,' . base64_encode(file_get_contents($logoPath));
        }

        // Fetch aggregates first (lightweight) — these always complete even with large datasets
        $totals = $this->fetchAggregates($tenantId, $startDate, $endDate, $filters);
        $totalExpectedFees     = $totals['totalExpectedFees'];
        $totalPaymentsReceived = $totals['totalPaymentsReceived'];
        $totalAdjustments      = $totals['totalAdjustments'];
        $outstandingBalance    = max(0, $totalExpectedFees - $totalPaymentsReceived + $totalAdjustments);
        $collectionRate        = $totalExpectedFees > 0 ? ($totalPaymentsReceived / $totalExpectedFees) * 100 : 0.0;

        // Multi-currency: convert totals to reporting currency if different from base (Feature 094)
        if ($reportingCurrency !== $baseCurrency) {
            $reportRate = $currencyService->getRateForDate($tenantId, $reportingCurrency, $endDate);
            if ($reportRate !== null) {
                $convRate = (float) $reportRate['rate_to_base'];
                $totalExpectedFees     = round($totalExpectedFees * $convRate, 2);
                $totalPaymentsReceived = round($totalPaymentsReceived * $convRate, 2);
                $totalAdjustments      = round($totalAdjustments * $convRate, 2);
                $outstandingBalance    = round($outstandingBalance * $convRate, 2);
            }
        }

        // Fetch detailed data with limits to prevent memory exhaustion
        $charges      = $this->fetchCharges($tenantId, $startDate, $endDate, $filters);
        $payments     = $this->fetchPayments($tenantId, $startDate, $endDate, $filters);
        $adjustments  = $this->fetchAdjustments($tenantId, $startDate, $endDate, $filters);

        $methodBreakdown = $this->getMethodBreakdown($payments);
        $chargesSummary  = $this->getChargesSummary($charges);

        // Truncate transactions if too large for PDF rendering
        $transactionCount   = count($payments);
        $isTruncated        = $transactionCount > self::MAX_TRANSACTIONS;
        $displayPayments    = $isTruncated ? array_slice($payments, 0, self::MAX_TRANSACTIONS) : $payments;
        $transactions       = $this->formatTransactions($displayPayments);

        $data = [
            'schoolName'            => $schoolName,
            'logoDataUri'           => $logoDataUri,
            'reportTitle'           => 'Financial Summary Report',
            'periodLabel'           => $periodLabel,
            'generatedAt'           => date('d M Y, H:i'),
            'currency'              => $currency,
            'baseCurrency'          => $baseCurrency,
            'totalExpectedFees'     => $totalExpectedFees,
            'totalPaymentsReceived' => $totalPaymentsReceived,
            'outstandingBalance'    => $outstandingBalance,
            'totalAdjustments'      => $totalAdjustments,
            'collectionRate'        => $collectionRate,
            'methodBreakdown'       => $methodBreakdown,
            'chargesSummary'        => $chargesSummary,
            'transactions'          => $transactions,
            'isTruncated'           => $isTruncated,
            'totalTransactionCount' => $transactionCount,
        ];

        return $this->renderPdf($data, $periodLabel);
    }

    /**
     * Resolve period start/end dates and human-readable label.
     *
     * @param string      $tenantId
     * @param string|null $termId
     * @param mixed       $month    1-12 or null
     * @param mixed       $year     e.g. 2026 or null
     * @return array{startDate: string, endDate: string, label: string}
     * @throws \RuntimeException When the period cannot be determined.
     */
    public function resolvePeriodDates(string $tenantId, ?string $termId, $month, $year): array
    {
        if ($termId !== null && $termId !== '') {
            return $this->resolveTerm($tenantId, $termId, $month, $year);
        }

        if ($month !== null && $year !== null) {
            return $this->resolveMonth((int) $month, (int) $year);
        }

        throw new \RuntimeException('Either termId or month+year is required.');
    }

    /**
     * Group non-voided payments by method.
     *
     * @return array<array{method: string, count: int, total: float}>
     */
    public function getMethodBreakdown(array $payments): array
    {
        $groups = [];
        foreach ($payments as $p) {
            if (!empty($p['voided_at'])) {
                continue;
            }
            $method = $p['method'] ?? 'Unknown';
            if (!isset($groups[$method])) {
                $groups[$method] = ['method' => $method, 'count' => 0, 'total' => 0.0];
            }
            $groups[$method]['count']++;
            $groups[$method]['total'] += (float) $p['amount'];
        }
        usort($groups, fn($a, $b) => $b['total'] <=> $a['total']);
        return array_values($groups);
    }

    /**
     * Group charges by category.
     *
     * @return array<array{category: string, total: float}>
     */
    public function getChargesSummary(array $charges): array
    {
        $groups = [];
        foreach ($charges as $c) {
            $cat = $c['category'] ?? 'Uncategorized';
            if (!isset($groups[$cat])) {
                $groups[$cat] = ['category' => $cat, 'total' => 0.0];
            }
            $groups[$cat]['total'] += (float) $c['amount'];
        }
        usort($groups, fn($a, $b) => $b['total'] <=> $a['total']);
        return array_values($groups);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    private function resolveTerm(string $tenantId, string $termId, $month, $year): array
    {
        $tenant   = $this->fetchTenant($tenantId);
        $calendar = isset($tenant['academic_calendar']) ? json_decode($tenant['academic_calendar'], true) : null;
        $terms    = $calendar['terms'] ?? [];

        $termStart = null;
        $termEnd   = null;
        $termName  = null;

        foreach ($terms as $t) {
            if (($t['id'] ?? '') === $termId) {
                $termStart = $t['start'];
                $termEnd   = $t['end'];
                $termName  = $t['name'] ?? $termId;
                break;
            }
        }

        if ($termStart === null || $termEnd === null) {
            throw new \RuntimeException('Term not found in academic calendar.');
        }

        if ($month !== null && $year !== null) {
            $monthRange  = $this->resolveMonth((int) $month, (int) $year);
            $startDate   = max($termStart, $monthRange['startDate']);
            $endDate     = min($termEnd, $monthRange['endDate']);
            if ($startDate > $endDate) {
                throw new \RuntimeException('The selected month falls outside the selected term dates.');
            }
            $label = $termName . ' — ' . date('F Y', mktime(0, 0, 0, (int) $month, 1, (int) $year));
        } else {
            $startDate = $termStart;
            $endDate   = $termEnd;
            $label     = $termName;
        }

        return ['startDate' => $startDate, 'endDate' => $endDate, 'label' => $label];
    }

    private function resolveMonth(int $month, int $year): array
    {
        if ($month < 1 || $month > 12) {
            throw new \RuntimeException('Invalid month. Must be between 1 and 12.');
        }
        if ($year < 1900 || $year > 2200) {
            throw new \RuntimeException('Invalid year.');
        }
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate   = date('Y-m-t', mktime(0, 0, 0, $month, 1, $year));
        $label     = date('F Y', mktime(0, 0, 0, $month, 1, $year));
        return ['startDate' => $startDate, 'endDate' => $endDate, 'label' => $label];
    }

    private function fetchTenant(string $tenantId): array
    {
        $row = $this->db->table('tenants')
            ->where('id', $tenantId)
            ->get()
            ->getRowArray();
        return $row ?? [];
    }

    /**
     * Fetch eligible charges for the period (matching LedgerService eligible filters).
     * Constitution V: uses ELIGIBLE_CHARGE_TYPES, excludes fee_campaign charges, excludes voided/deleted.
     */
    private function fetchCharges(string $tenantId, string $startDate, string $endDate, array $filters): array
    {
        $eligibleTypes = LedgerService::ELIGIBLE_CHARGE_TYPES;

        $builder = $this->db->table('charges c')
            ->select('c.id, c.amount, c.category, c.charge_type, c.student_id, c.date_generated,
                      TRIM(CONCAT(s.first_name, " ", s.last_name)) AS student_name,
                      cl.name AS class_name, s.class_id')
            ->join('students s', 's.id = c.student_id AND s.tenant_id = c.tenant_id', 'left')
            ->join('classes cl', 'cl.id = s.class_id AND cl.tenant_id = c.tenant_id', 'left')
            ->where('c.tenant_id', $tenantId)
            ->whereIn('c.charge_type', $eligibleTypes)
            ->where('c.voided_at', null)
            ->where('c.deleted_at', null)
            ->where('c.date_generated >=', $startDate)
            ->where('c.date_generated <=', $endDate);

        if (!empty($filters['classId'])) {
            $builder->where('s.class_id', $filters['classId']);
        }
        if (!empty($filters['category'])) {
            $builder->where('c.category', $filters['category']);
        }

        $builder->orderBy('c.date_generated', 'DESC');

        // Add limit to prevent memory exhaustion on very large datasets
        $builder->limit(10000);

        return $builder->get()->getResultArray();
    }

    /**
     * Fetch payments for the period.
     * Includes voided payments so they appear in the transactions table with a VOID badge;
     * voided rows are excluded from totals in PHP.
     */
    private function fetchPayments(string $tenantId, string $startDate, string $endDate, array $filters): array
    {
        $eligiblePaymentCategories = LedgerService::ELIGIBLE_PAYMENT_CATEGORIES;

        $builder = $this->db->table('payments p')
            ->select('p.id, p.amount, p.date, p.method, p.category, p.receipt_number,
                      p.voided_at, p.is_general_payment, p.student_id,
                      p.currency_code, p.original_amount, p.exchange_rate,
                      TRIM(CONCAT(s.first_name, " ", s.last_name)) AS student_name,
                      cl.name AS class_name, s.class_id')
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->join('classes cl', 'cl.id = s.class_id AND cl.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId)
            ->where('p.date >=', $startDate)
            ->where('p.date <=', $endDate)
            ->where('p.is_general_payment', 0)
            ->where('p.fee_campaign_id', null)
            ->whereIn('p.category', $eligiblePaymentCategories);

        if (!empty($filters['classId'])) {
            $builder->where('s.class_id', $filters['classId']);
        }
        if (!empty($filters['method'])) {
            $builder->where('p.method', $filters['method']);
        }
        if (!empty($filters['category'])) {
            $builder->where('p.category', $filters['category']);
        }

        $builder->orderBy('p.date', 'DESC')
                ->orderBy('p.receipt_number', 'ASC');

        // Add limit to prevent memory exhaustion on very large datasets
        $builder->limit(10000);

        return $builder->get()->getResultArray();
    }

    /**
     * Fetch aggregate totals using lightweight SQL SUM queries (no full table scan into PHP memory).
     * This ensures summary statistics are accurate even when detailed data is truncated.
     */
    private function fetchAggregates(string $tenantId, string $startDate, string $endDate, array $filters): array
    {
        $eligibleTypes = LedgerService::ELIGIBLE_CHARGE_TYPES;
        $eligiblePaymentCategories = LedgerService::ELIGIBLE_PAYMENT_CATEGORIES;

        // Total expected fees (charges)
        $chargesBuilder = $this->db->table('charges c')
            ->selectSum('c.amount', 'total')
            ->join('students s', 's.id = c.student_id AND s.tenant_id = c.tenant_id', 'left')
            ->where('c.tenant_id', $tenantId)
            ->whereIn('c.charge_type', $eligibleTypes)
            ->where('c.voided_at', null)
            ->where('c.deleted_at', null)
            ->where('c.date_generated >=', $startDate)
            ->where('c.date_generated <=', $endDate);

        if (!empty($filters['classId'])) {
            $chargesBuilder->where('s.class_id', $filters['classId']);
        }
        if (!empty($filters['category'])) {
            $chargesBuilder->where('c.category', $filters['category']);
        }
        $totalExpectedFees = (float) ($chargesBuilder->get()->getRow()->total ?? 0);

        // Total payments received (non-voided only)
        $paymentsBuilder = $this->db->table('payments p')
            ->selectSum('p.amount', 'total')
            ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
            ->where('p.tenant_id', $tenantId)
            ->where('p.date >=', $startDate)
            ->where('p.date <=', $endDate)
            ->where('p.voided_at', null)
            ->where('p.is_general_payment', 0)
            ->where('p.fee_campaign_id', null)
            ->whereIn('p.category', $eligiblePaymentCategories);

        if (!empty($filters['classId'])) {
            $paymentsBuilder->where('s.class_id', $filters['classId']);
        }
        if (!empty($filters['method'])) {
            $paymentsBuilder->where('p.method', $filters['method']);
        }
        if (!empty($filters['category'])) {
            $paymentsBuilder->where('p.category', $filters['category']);
        }
        $totalPaymentsReceived = (float) ($paymentsBuilder->get()->getRow()->total ?? 0);

        // Total adjustments (net: debits increase balance, credits decrease)
        $debitsBuilder = $this->db->table('ledger_adjustments la')
            ->selectSum('la.amount', 'total')
            ->join('students s', 's.id = la.student_id AND s.tenant_id = la.tenant_id', 'left')
            ->where('la.tenant_id', $tenantId)
            ->where('la.status', 'approved')
            ->where('la.adjustment_type', 'debit')
            ->where('la.created_at >=', $startDate . ' 00:00:00')
            ->where('la.created_at <=', $endDate . ' 23:59:59');

        $creditsBuilder = $this->db->table('ledger_adjustments la')
            ->selectSum('la.amount', 'total')
            ->join('students s', 's.id = la.student_id AND s.tenant_id = la.tenant_id', 'left')
            ->where('la.tenant_id', $tenantId)
            ->where('la.status', 'approved')
            ->where('la.adjustment_type', 'credit')
            ->where('la.created_at >=', $startDate . ' 00:00:00')
            ->where('la.created_at <=', $endDate . ' 23:59:59');

        if (!empty($filters['classId'])) {
            $debitsBuilder->where('s.class_id', $filters['classId']);
            $creditsBuilder->where('s.class_id', $filters['classId']);
        }

        $totalDebits  = (float) ($debitsBuilder->get()->getRow()->total ?? 0);
        $totalCredits = (float) ($creditsBuilder->get()->getRow()->total ?? 0);
        $totalAdjustments = $totalDebits - $totalCredits;

        return [
            'totalExpectedFees'     => $totalExpectedFees,
            'totalPaymentsReceived' => $totalPaymentsReceived,
            'totalAdjustments'      => $totalAdjustments,
        ];
    }

    /**
     * Fetch approved ledger adjustments for the period.
     */
    private function fetchAdjustments(string $tenantId, string $startDate, string $endDate, array $filters): array
    {
        $builder = $this->db->table('ledger_adjustments la')
            ->select('la.id, la.amount, la.adjustment_type, la.student_id, la.created_at')
            ->join('students s', 's.id = la.student_id AND s.tenant_id = la.tenant_id', 'left')
            ->where('la.tenant_id', $tenantId)
            ->where('la.status', 'approved')
            ->where('la.created_at >=', $startDate . ' 00:00:00')
            ->where('la.created_at <=', $endDate . ' 23:59:59');

        if (!empty($filters['classId'])) {
            $builder->where('s.class_id', $filters['classId']);
        }

        return $builder->get()->getResultArray();
    }

    /**
     * Compute the net adjustment impact on the balance.
     * Debit adjustments increase the balance; credit adjustments decrease it.
     */
    private function computeAdjustmentTotal(array $adjustments): float
    {
        $net = 0.0;
        foreach ($adjustments as $adj) {
            $amount = (float) $adj['amount'];
            $net += ($adj['adjustment_type'] === 'debit') ? $amount : -$amount;
        }
        return $net;
    }

    private function formatTransactions(array $payments): array
    {
        return array_map(fn($p) => [
            'date'          => $p['date'],
            'studentName'   => $p['student_name'] ?? '—',
            'className'     => $p['class_name'] ?? '—',
            'amount'        => (float) $p['amount'],
            'method'        => $p['method'] ?? '—',
            'category'      => $p['category'] ?? '—',
            'receiptNumber' => $p['receipt_number'] ?? null,
            'isVoided'      => !empty($p['voided_at']),
            'currencyCode'       => $p['currency_code'] ?? null,
            'originalAmount'     => isset($p['original_amount']) ? (float) $p['original_amount'] : null,
            'exchangeRate'       => isset($p['exchange_rate']) ? (float) $p['exchange_rate'] : null,
        ], $payments);
    }

    private function renderPdf(array $data, string $periodLabel): string
    {
        $html = view('reports/financial_report_template', $data, ['saveData' => false]);

        $options = new Options();
        $options->set('isHtml5ParserEnabled', true);
        $options->set('isRemoteEnabled', false);
        $options->set('defaultFont', 'DejaVu Sans');

        $dompdf = new Dompdf($options);
        $dompdf->loadHtml($html);
        $dompdf->setPaper('A4', 'portrait');
        $dompdf->render();

        return $dompdf->output();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHUNKED/INCREMENTAL DATA FETCHING (Memory-efficient for large datasets)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fetch payments in chunks using a generator to maintain flat memory usage.
     * This is memory-efficient for datasets with 10,000+ records.
     *
     * @return \Generator<int, array> Yields chunks of payment records
     */
    private function fetchPaymentsChunked(string $tenantId, string $startDate, string $endDate, array $filters): \Generator
    {
        $eligiblePaymentCategories = LedgerService::ELIGIBLE_PAYMENT_CATEGORIES;
        $offset = 0;
        $chunkSize = self::CHUNK_SIZE;

        while (true) {
            $builder = $this->db->table('payments p')
                ->select('p.id, p.amount, p.date, p.method, p.category, p.receipt_number,
                          p.voided_at, p.is_general_payment, p.student_id,
                          p.currency_code, p.original_amount, p.exchange_rate,
                          TRIM(CONCAT(s.first_name, " ", s.last_name)) AS student_name,
                          cl.name AS class_name, s.class_id')
                ->join('students s', 's.id = p.student_id AND s.tenant_id = p.tenant_id', 'left')
                ->join('classes cl', 'cl.id = s.class_id AND cl.tenant_id = p.tenant_id', 'left')
                ->where('p.tenant_id', $tenantId)
                ->where('p.date >=', $startDate)
                ->where('p.date <=', $endDate)
                ->where('p.is_general_payment', 0)
                ->where('p.fee_campaign_id', null)
                ->whereIn('p.category', $eligiblePaymentCategories)
                ->orderBy('p.date', 'DESC')
                ->orderBy('p.receipt_number', 'ASC')
                ->limit($chunkSize, $offset);

            if (!empty($filters['classId'])) {
                $builder->where('s.class_id', $filters['classId']);
            }
            if (!empty($filters['method'])) {
                $builder->where('p.method', $filters['method']);
            }
            if (!empty($filters['category'])) {
                $builder->where('p.category', $filters['category']);
            }

            $chunk = $builder->get()->getResultArray();

            if (empty($chunk)) {
                break;
            }

            yield $chunk;

            if (count($chunk) < $chunkSize) {
                break; // Last chunk
            }

            $offset += $chunkSize;

            // Safety: stop at MAX_TRANSACTIONS to prevent runaway queries
            if ($offset >= self::MAX_TRANSACTIONS) {
                break;
            }
        }
    }

    /**
     * Fetch charges in chunks using a generator for memory-efficient processing.
     *
     * @return \Generator<int, array> Yields chunks of charge records
     */
    private function fetchChargesChunked(string $tenantId, string $startDate, string $endDate, array $filters): \Generator
    {
        $eligibleTypes = LedgerService::ELIGIBLE_CHARGE_TYPES;
        $offset = 0;
        $chunkSize = self::CHUNK_SIZE;

        while (true) {
            $builder = $this->db->table('charges c')
                ->select('c.id, c.amount, c.category, c.charge_type, c.student_id, c.date_generated,
                          TRIM(CONCAT(s.first_name, " ", s.last_name)) AS student_name,
                          cl.name AS class_name, s.class_id')
                ->join('students s', 's.id = c.student_id AND s.tenant_id = c.tenant_id', 'left')
                ->join('classes cl', 'cl.id = s.class_id AND cl.tenant_id = c.tenant_id', 'left')
                ->where('c.tenant_id', $tenantId)
                ->whereIn('c.charge_type', $eligibleTypes)
                ->where('c.voided_at', null)
                ->where('c.deleted_at', null)
                ->where('c.date_generated >=', $startDate)
                ->where('c.date_generated <=', $endDate)
                ->orderBy('c.date_generated', 'DESC')
                ->limit($chunkSize, $offset);

            if (!empty($filters['classId'])) {
                $builder->where('s.class_id', $filters['classId']);
            }
            if (!empty($filters['category'])) {
                $builder->where('c.category', $filters['category']);
            }

            $chunk = $builder->get()->getResultArray();

            if (empty($chunk)) {
                break;
            }

            yield $chunk;

            if (count($chunk) < $chunkSize) {
                break;
            }

            $offset += $chunkSize;

            // Safety limit for charges (typically fewer than payments)
            if ($offset >= 5000) {
                break;
            }
        }
    }
}
