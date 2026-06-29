<?php

namespace App\Controllers\Platform;

class AnalyticsController extends BasePlatformController
{
    public function growth()
    {
        if (!$this->canViewAnalytics($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $db = \Config\Database::connect();
        $status = $this->request->getGet('status');
        $tenantId = $this->request->getGet('tenant_id');
        $from = $this->request->getGet('from');
        $to = $this->request->getGet('to');

        $start = $from ? $from . ' 00:00:00' : date('Y-m-d H:i:s', strtotime('-12 months'));
        $end = $to ? $to . ' 23:59:59' : date('Y-m-d H:i:s');

        $tenantGrowth = $db->query("
            SELECT
                DATE_FORMAT(created_at, '%Y-%m') AS month,
                COUNT(*) AS new_tenants,
                SUM(COUNT(*)) OVER (ORDER BY DATE_FORMAT(created_at, '%Y-%m')) AS cumulative_tenants
            FROM tenants
            WHERE created_at BETWEEN ? AND ?
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month ASC
        ", [$start, $end])->getResultArray();

        $revenueGrowth = $db->query("
            SELECT
                DATE_FORMAT(issued_at, '%Y-%m') AS month,
                SUM(subscription_invoices.amount_cents) / 100 AS revenue
            FROM subscription_invoices
            LEFT JOIN subscription_payment_transactions spt ON spt.id = subscription_invoices.transaction_id
            WHERE issued_at BETWEEN ? AND ?
              " . ($status ? " AND spt.status = ?" : "") . "
              " . ($tenantId ? " AND subscription_invoices.tenant_id = ?" : "") . "
            GROUP BY DATE_FORMAT(issued_at, '%Y-%m')
            ORDER BY month ASC
        ", array_values(array_filter([$start, $end, $status, $tenantId], fn($v) => $v !== null && $v !== '')))->getResultArray();

        $tenantGrowth = array_map(static function (array $row): array {
            $month = (string) ($row['month'] ?? '');
            $date = $month !== '' ? \DateTimeImmutable::createFromFormat('Y-m', $month) : false;

            return [
                'month' => $month,
                'monthLabel' => $date instanceof \DateTimeImmutable ? $date->format('M Y') : $month,
                'new_tenants' => (int) ($row['new_tenants'] ?? 0),
                'newTenants' => (int) ($row['new_tenants'] ?? 0),
                'cumulative_tenants' => (int) ($row['cumulative_tenants'] ?? 0),
                'cumulativeTenants' => (int) ($row['cumulative_tenants'] ?? 0),
            ];
        }, $tenantGrowth);

        $totalRevenue = (float) ($db->query("
            SELECT SUM(si.amount_cents) / 100 AS total
            FROM subscription_invoices si
            LEFT JOIN subscription_payment_transactions spt ON spt.id = si.transaction_id
            WHERE si.issued_at BETWEEN ? AND ?
        ", [$start, $end])->getRow()->total ?? 0);

        $activeTenantCount = (int) ($db->query("
            SELECT COUNT(DISTINCT ss.tenant_id) AS cnt
            FROM school_subscriptions ss
            WHERE ss.status = 'active'
        ")->getRow()->cnt ?? 0);

        $lastTenantGrowth = !empty($tenantGrowth) ? $tenantGrowth[array_key_last($tenantGrowth)] : null;
        $totalTenants = (int) ($lastTenantGrowth['cumulativeTenants'] ?? 0);
        $summary = [
            'totalTenants'          => $totalTenants,
            'total_tenants'         => $totalTenants,
            'monthsTracked'         => count($tenantGrowth),
            'months_tracked'        => count($tenantGrowth),
            'newThisMonth'          => (int) ($lastTenantGrowth['newTenants'] ?? 0),
            'new_this_month'        => (int) ($lastTenantGrowth['newTenants'] ?? 0),
            'totalRevenue'          => round($totalRevenue, 2),
            'total_revenue'         => round($totalRevenue, 2),
            'activeTenants'         => $activeTenantCount,
            'active_tenants'        => $activeTenantCount,
            'avgRevenuePerTenant'   => $totalTenants > 0 ? round($totalRevenue / $totalTenants, 2) : 0.0,
            'avg_revenue_per_tenant'=> $totalTenants > 0 ? round($totalRevenue / $totalTenants, 2) : 0.0,
        ];

        $revenueGrowth = array_map(function (array $row, int $index) use ($revenueGrowth) {
            $comparisonValue = $index > 0 ? (float) ($revenueGrowth[$index - 1]['revenue'] ?? 0) : 0.0;
            $revenue = (float) ($row['revenue'] ?? 0);
            $month = (string) ($row['month'] ?? '');
            $date = $month !== '' ? \DateTimeImmutable::createFromFormat('Y-m', $month) : false;

            return [
                'month' => $month,
                'monthLabel' => $date instanceof \DateTimeImmutable ? $date->format('M Y') : $month,
                'revenue' => round($revenue, 2),
                'displayValue' => '$' . number_format($revenue, 2, '.', ','),
                'comparisonValue' => round($comparisonValue, 2),
                'deltaPercent' => $comparisonValue > 0 ? round((($revenue - $comparisonValue) / $comparisonValue) * 100, 2) : 0.0,
            ];
        }, $revenueGrowth, array_keys($revenueGrowth));

        return $this->success([
            'summary' => $summary,
            'tenant_growth'  => $tenantGrowth,
            'tenantGrowth'   => $tenantGrowth,
            'revenue_growth' => $revenueGrowth,
            'revenueGrowth'  => $revenueGrowth,
        ]);
    }

    public function geography()
    {
        if (!$this->canViewAnalytics($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $db = \Config\Database::connect();

        // Extract country from settings JSON if a country field exists, otherwise group as Unknown
        $rows = $db->query("
            SELECT
                COALESCE(
                    JSON_UNQUOTE(JSON_EXTRACT(t.settings, '$.country')),
                    'Unknown'
                ) AS country,
                COUNT(DISTINCT t.id) AS tenant_count,
                COUNT(s.id) AS student_count
            FROM tenants t
            LEFT JOIN students s ON s.tenant_id = t.id
            GROUP BY country
            ORDER BY tenant_count DESC
            LIMIT 20
        ")->getResultArray();

        return $this->success($rows);
    }

    public function leaderboard()
    {
        if (!$this->canViewAnalytics($this->getPlatformRole())) {
            return $this->forbidden();
        }

        $metric = $this->request->getGet('metric') ?? 'mrr';
        $db     = \Config\Database::connect();

        $rows = match ($metric) {
            'revenue' => $db->query("
                SELECT t.id, t.name, SUM(si.amount_cents) / 100 AS value
                FROM tenants t
                JOIN subscription_invoices si ON si.tenant_id = t.id
                GROUP BY t.id, t.name
                ORDER BY value DESC
                LIMIT 10
            ")->getResultArray(),

            'students' => $db->query("
                SELECT t.id, t.name, COUNT(s.id) AS value
                FROM tenants t
                LEFT JOIN students s ON s.tenant_id = t.id
                GROUP BY t.id, t.name
                ORDER BY value DESC
                LIMIT 10
            ")->getResultArray(),

            default => $db->query("
                SELECT t.id, t.name,
                       SUM(CASE WHEN ss.billing_cycle = 'annual'
                                THEN sp.annual_price_cents / 12
                                ELSE sp.monthly_price_cents
                           END) / 100 AS value
                FROM tenants t
                JOIN school_subscriptions ss ON ss.tenant_id = t.id AND ss.status = 'active'
                JOIN subscription_plans sp ON sp.id = ss.plan_id
                GROUP BY t.id, t.name
                ORDER BY value DESC
                LIMIT 10
            ")->getResultArray(),
        };

        $maxValue = 1.0;
        foreach ($rows as $row) {
            $maxValue = max($maxValue, (float) ($row['value'] ?? 0));
        }

        $rows = array_map(static function (array $row) use ($metric, $maxValue): array {
            $value = (float) ($row['value'] ?? 0);

            return [
                'id' => $row['id'],
                'name' => $row['name'],
                'value' => round($value, 2),
                'displayValue' => $metric === 'students'
                    ? number_format((int) round($value))
                    : '$' . number_format($value, 2, '.', ','),
                'progressPercent' => round(($value / $maxValue) * 100, 2),
            ];
        }, $rows);

        return $this->success($rows);
    }
}
