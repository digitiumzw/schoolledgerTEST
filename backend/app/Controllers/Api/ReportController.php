<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;

/**
 * ReportController — Payment and ledger report endpoints.
 *
 * All endpoints:
 * - Require JWT auth (enforced by JWTAuthFilter in Routes.php)
 * - Require role: bursar | admin | super_admin
 * - Filter all data by tenant_id from JWT (never from request body)
 */
class ReportController extends BaseApiController
{
    protected $db;

    public function initController(\CodeIgniter\HTTP\RequestInterface $request, \CodeIgniter\HTTP\ResponseInterface $response, \Psr\Log\LoggerInterface $logger)
    {
        parent::initController($request, $response, $logger);
        $this->db = Config::connect();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/reports/payment-collection?termId=X
    // ──────────────────────────────────────────────────────────────────────────

    public function paymentCollection()
    {
        if ($err = $this->requireRole('bursar', 'admin', 'super_admin')) {
            return $err;
        }

        $tenantId = $this->getTenantId();
        $termId   = $this->request->getGet('termId');

        if (!$termId) {
            return $this->error('termId is required', 400);
        }

        $data = (new \App\Services\LedgerService($this->db))
            ->getPaymentCollectionReport($tenantId, $termId);

        return $this->success($data);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/reports/aged-balances?termId=X
    // ──────────────────────────────────────────────────────────────────────────

    public function agedBalances()
    {
        if ($err = $this->requireRole('bursar', 'admin', 'super_admin')) {
            return $err;
        }

        $tenantId = $this->getTenantId();
        $termId   = $this->request->getGet('termId');

        if (!$termId) {
            return $this->error('termId is required', 400);
        }

        $data = (new \App\Services\LedgerService($this->db))
            ->getAgedBalances($tenantId, $termId);

        return $this->success($data);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/reports/revenue-by-category?termId=X&category=Y
    // ──────────────────────────────────────────────────────────────────────────

    public function revenueByCategory()
    {
        if ($err = $this->requireRole('bursar', 'admin', 'super_admin')) {
            return $err;
        }

        $tenantId        = $this->getTenantId();
        $termId          = $this->request->getGet('termId');
        $categoryFilter  = $this->request->getGet('category');

        if (!$termId) {
            return $this->error('termId is required', 400);
        }

        // Single query: charges LEFT JOIN payments by (student_id, category) for the term
        $sql = "
            SELECT
                c.category,
                SUM(c.amount)                                              AS totalCharged,
                COALESCE(SUM(p.paid_per_category), 0)                     AS totalCollected
            FROM charges c
            LEFT JOIN (
                SELECT student_id, category, SUM(amount) AS paid_per_category
                FROM payments
                WHERE tenant_id = ?
                GROUP BY student_id, category
            ) p ON p.student_id = c.student_id AND p.category = c.category
            WHERE c.tenant_id = ?
              AND c.term_id = ?
              AND c.deleted_at IS NULL
        ";

        $params = [$tenantId, $tenantId, $termId];

        if ($categoryFilter) {
            $sql    .= ' AND c.category = ?';
            $params[] = $categoryFilter;
        }

        $sql .= ' GROUP BY c.category ORDER BY c.category';

        $rows = $this->db->query($sql, $params)->getResultArray();

        $categories = array_map(function (array $row): array {
            $charged     = (float) $row['totalCharged'];
            $collected   = (float) $row['totalCollected'];
            $outstanding = max(0.0, $charged - $collected);
            $rate        = $charged > 0 ? round(($collected / $charged) * 100, 1) : 0.0;

            return [
                'category'       => $row['category'],
                'totalCharged'   => $charged,
                'totalCollected' => $collected,
                'collectionRate' => $rate,
                'outstanding'    => $outstanding,
            ];
        }, $rows);

        return $this->success([
            'termId'     => $termId,
            'categories' => $categories,
        ]);
    }
}
