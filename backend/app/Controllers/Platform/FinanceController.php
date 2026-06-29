<?php

namespace App\Controllers\Platform;

use App\Services\InvoiceService;

class FinanceController extends BasePlatformController
{
    public function summary()
    {
        if (!$this->canViewFinance($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $db = \Config\Database::connect();
        $status = $this->request->getGet('status');
        $tenantId = $this->request->getGet('tenant_id');
        $from = $this->request->getGet('from');
        $to = $this->request->getGet('to');

        $summaryStart = $from ? $from . ' 00:00:00' : date('Y-m-01 00:00:00');
        $summaryEnd   = $to ? $to . ' 23:59:59' : date('Y-m-t 23:59:59');

        $windowStart = new \DateTimeImmutable($summaryStart);
        $windowEnd = new \DateTimeImmutable($summaryEnd);
        $windowDays = max(1, (int) $windowStart->diff($windowEnd)->days + 1);
        $previousWindowStart = $windowStart->modify('-' . $windowDays . ' days')->format('Y-m-d H:i:s');
        $previousWindowEnd = $windowStart->modify('-1 second')->format('Y-m-d H:i:s');

        $applyFilters = function ($builder) use ($status, $tenantId, $summaryStart, $summaryEnd) {
            if ($status) {
                $builder->where('spt.status', $status);
            }
            if ($tenantId) {
                $builder->where('si.tenant_id', $tenantId);
            }
            $builder->where('si.issued_at >=', $summaryStart);
            $builder->where('si.issued_at <=', $summaryEnd);
            return $builder;
        };

        $totalRevenue = (float) ($applyFilters($db->table('subscription_invoices si')
            ->select('SUM(si.amount_cents) / 100 AS total')
            ->join('subscription_payment_transactions spt', 'spt.id = si.transaction_id', 'left'))
            ->get()->getRow()->total ?? 0);

        $pendingAmount = (float) ($applyFilters($db->table('subscription_invoices si')
            ->select('SUM(si.amount_cents) / 100 AS total')
            ->join('subscription_payment_transactions spt', 'spt.id = si.transaction_id', 'left')
            ->where('spt.status', 'initiated'))
            ->get()->getRow()->total ?? 0);

        $failedAmount = (float) ($applyFilters($db->table('subscription_invoices si')
            ->select('SUM(si.amount_cents) / 100 AS total')
            ->join('subscription_payment_transactions spt', 'spt.id = si.transaction_id', 'left')
            ->where('spt.status', 'failed'))
            ->get()->getRow()->total ?? 0);

        $invoiceCount = (int) ($applyFilters($db->table('subscription_invoices si')
            ->join('subscription_payment_transactions spt', 'spt.id = si.transaction_id', 'left'))
            ->countAllResults(false));

        $outstandingBuilder = $db->table('subscription_invoices si')
            ->select('COUNT(*) AS cnt', false)
            ->join('subscription_payment_transactions spt', 'spt.id = si.transaction_id', 'left')
            ->where("COALESCE(spt.status, 'pending') <>", 'completed')
            ->where('si.issued_at >=', $summaryStart)
            ->where('si.issued_at <=', $summaryEnd);
        if ($status) {
            $outstandingBuilder->where('spt.status', $status);
        }
        if ($tenantId) {
            $outstandingBuilder->where('si.tenant_id', $tenantId);
        }
        $outstandingInvoicesCount = (int) ($outstandingBuilder->get()->getRow()->cnt ?? 0);

        $mrr = (float) ($db->query("
            SELECT SUM(
                CASE WHEN ss.billing_cycle = 'annual'
                     THEN sp.annual_price_cents / 12
                     ELSE sp.monthly_price_cents
                END
            ) / 100 AS mrr
            FROM school_subscriptions ss
            JOIN subscription_plans sp ON sp.id = ss.plan_id
            WHERE ss.status = 'active'
        ")->getRow()->mrr ?? 0);

        $currentMonthRevenue = (float) ($db->query("
            SELECT SUM(si.amount_cents) / 100 AS total
            FROM subscription_invoices si
            LEFT JOIN subscription_payment_transactions spt ON spt.id = si.transaction_id
            WHERE si.issued_at BETWEEN ? AND ?
              " . ($status ? " AND spt.status = ?" : "") . "
              " . ($tenantId ? " AND si.tenant_id = ?" : "") . "
        ", array_values(array_filter([$summaryStart, $summaryEnd, $status, $tenantId], fn($v) => $v !== null && $v !== '')))->getRow()->total ?? 0);

        $previousMonthRevenue = (float) ($db->query("
            SELECT SUM(si.amount_cents) / 100 AS total
            FROM subscription_invoices si
            LEFT JOIN subscription_payment_transactions spt ON spt.id = si.transaction_id
            WHERE si.issued_at BETWEEN ? AND ?
              " . ($status ? " AND spt.status = ?" : "") . "
              " . ($tenantId ? " AND si.tenant_id = ?" : "") . "
        ", array_values(array_filter([$previousWindowStart, $previousWindowEnd, $status, $tenantId], fn($v) => $v !== null && $v !== '')))->getRow()->total ?? 0);

        $growthRate = $previousMonthRevenue > 0
            ? round((($currentMonthRevenue - $previousMonthRevenue) / $previousMonthRevenue) * 100, 2)
            : ($currentMonthRevenue > 0 ? 100.0 : 0.0);

        $failedPaymentsCount = (int) ($db->query("
            SELECT COUNT(DISTINCT ss.id) AS cnt
            FROM school_subscriptions ss
            WHERE ss.status = 'active'
            AND (
                SELECT spt.status
                FROM subscription_payment_transactions spt
                WHERE spt.subscription_id = ss.id
                ORDER BY spt.created_at DESC
                LIMIT 1
            ) = 'failed'
        ")->getRow()->cnt ?? 0);

        $renewalsDueCount = (int) $db->table('school_subscriptions')
            ->where('status', 'active')
            ->where('expires_at IS NOT NULL')
            ->where('expires_at >=', date('Y-m-d H:i:s'))
            ->where('expires_at <=', date('Y-m-d H:i:s', strtotime('+30 days')))
            ->countAllResults();

        $recentSubscriptions = $db->query("
            SELECT
                ss.id,
                COALESCE(t.name, 'Unknown school') AS tenant_name,
                sp.name AS plan_name,
                ss.billing_cycle,
                ss.status,
                ss.created_at,
                (
                    SELECT spt.created_at
                    FROM subscription_payment_transactions spt
                    WHERE spt.subscription_id = ss.id
                    ORDER BY spt.created_at DESC
                    LIMIT 1
                ) AS last_payment_at
            FROM school_subscriptions ss
            LEFT JOIN tenants t ON t.id = ss.tenant_id
            LEFT JOIN subscription_plans sp ON sp.id = ss.plan_id
            ORDER BY ss.created_at DESC
            LIMIT 5
        ")->getResultArray();

        $activeSchoolsCount = (int) ($db->query("
            SELECT COUNT(*) AS cnt FROM school_subscriptions WHERE status = 'active'
        ")->getRow()->cnt ?? 0);

        return $this->success([
            'total_revenue'          => round($totalRevenue, 2),
            'pending_amount'         => round($pendingAmount, 2),
            'failed_amount'          => round($failedAmount, 2),
            'invoice_count'          => $invoiceCount,
            'mrr'                    => round($mrr, 2),
            'failed_payments_count'  => $failedPaymentsCount,
            'renewals_due_count'     => $renewalsDueCount,
            'growth_rate'            => round($growthRate, 2),
            'net_revenue'            => round($totalRevenue - $failedAmount, 2),
            'outstanding_invoices_count' => $outstandingInvoicesCount,
            'active_schools_count'   => $activeSchoolsCount,
            'recent_subscriptions'   => $recentSubscriptions,
        ]);
    }

    public function invoices()
    {
        if (!$this->canViewFinance($this->getPlatformRole())) {
            return $this->forbidden();
        }

        [$page, $limit, $offset] = $this->getPaginationParams(25, 100);
        $db = \Config\Database::connect();

        // subscription_invoices already stores school_name and plan_name as snapshots
        $builder = $db->table('subscription_invoices si')
            ->select('si.id, si.invoice_number, si.school_name, si.plan_name,
                      si.billing_cycle, (si.amount_cents / 100) AS amount,
                      si.currency, si.issued_at, si.pdf_path,
                      spt.status AS payment_status', false)
            ->join('subscription_payment_transactions spt', 'spt.id = si.transaction_id', 'left');

        $status   = $this->request->getGet('status');
        $paymentStatus = $this->request->getGet('payment_status');
        $tenantId = $this->request->getGet('tenant_id');
        $from     = $this->request->getGet('from');
        $to       = $this->request->getGet('to');

        if ($status)   $builder->where('spt.status', $status);
        if ($paymentStatus) $builder->where('spt.status', $paymentStatus);
        if ($tenantId) $builder->where('si.tenant_id', $tenantId);
        if ($from)     $builder->where('si.issued_at >=', $from . ' 00:00:00');
        if ($to)       $builder->where('si.issued_at <=', $to . ' 23:59:59');

        $total    = $builder->countAllResults(false);
        $invoices = $builder->orderBy('si.issued_at', 'DESC')->limit($limit, $offset)->get()->getResultArray();

        return $this->success($invoices, 'OK', 200, $this->buildPaginationMeta($total, $page, $limit));
    }

    public function invoicePdf($id)
    {
        if (!$this->canViewFinance($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $db      = \Config\Database::connect();
        $invoice = $db->table('subscription_invoices si')
            ->select('si.*, spt.status AS payment_status')
            ->join('subscription_payment_transactions spt', 'spt.id = si.transaction_id', 'left')
            ->where('si.id', $id)
            ->get()
            ->getRowArray();

        if (!$invoice) {
            return $this->notFound('Invoice not found.');
        }

        $invoiceService = new InvoiceService();
        $pdfBytes       = $invoiceService->generatePdf($invoice);
        $fileName       = 'invoice-' . $invoice['invoice_number'] . '.pdf';

        return $this->response
            ->setHeader('Content-Type', 'application/pdf')
            ->setHeader('Content-Disposition', 'attachment; filename="' . $fileName . '"')
            ->setHeader('Content-Length', (string) strlen($pdfBytes))
            ->setBody($pdfBytes);
    }

    public function exportInvoices()
    {
        if (!$this->canExportFinance($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $db   = \Config\Database::connect();
        $body = $this->getRequestBody();

        $builder = $db->table('subscription_invoices si')
            ->select('si.invoice_number, si.school_name, si.plan_name,
                      (si.amount_cents / 100) AS amount, si.currency,
                      spt.status AS payment_status, si.issued_at', false)
            ->join('subscription_payment_transactions spt', 'spt.id = si.transaction_id', 'left');

        $status   = $body['status']    ?? null;
        $paymentStatus = $body['payment_status'] ?? null;
        $tenantId = $body['tenant_id'] ?? null;
        $from     = $body['from']      ?? null;
        $to       = $body['to']        ?? null;

        if ($status)   $builder->where('spt.status', $status);
        if ($paymentStatus) $builder->where('spt.status', $paymentStatus);
        if ($tenantId) $builder->where('si.tenant_id', $tenantId);
        if ($from)     $builder->where('si.issued_at >=', $from . ' 00:00:00');
        if ($to)       $builder->where('si.issued_at <=', $to . ' 23:59:59');

        $invoices = $builder->orderBy('si.issued_at', 'DESC')->get()->getResultArray();

        $output = fopen('php://temp', 'r+');
        fputcsv($output, ['Invoice Number', 'School', 'Plan', 'Amount', 'Currency', 'Status', 'Date']);

        foreach ($invoices as $row) {
            $safe = array_map(fn($v) => preg_replace('/^[=+\-@]/', "'$0", (string) $v), $row);
            fputcsv($output, $safe);
        }

        rewind($output);
        $csv = stream_get_contents($output) ?: '';
        fclose($output);

        return $this->response
            ->setHeader('Content-Type', 'text/csv')
            ->setHeader('Content-Disposition', 'attachment; filename="invoices-export.csv"')
            ->setBody($csv);
    }
}
