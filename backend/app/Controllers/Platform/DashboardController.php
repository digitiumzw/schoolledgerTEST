<?php

namespace App\Controllers\Platform;

class DashboardController extends BasePlatformController
{
    public function kpis()
    {
        $db = \Config\Database::connect();

        // Single aggregation query for all tenant status counts + active subscription count.
        $counts = $db->query("
            SELECT
                COUNT(t.id)                                                       AS total_tenants,
                SUM(t.status = 'suspended')                                       AS suspended_tenants,
                SUM(t.status = 'trialing')                                        AS trialing_tenants,
                COUNT(DISTINCT CASE WHEN ss.status = 'active' THEN t.id END)      AS active_tenants
            FROM tenants t
            LEFT JOIN school_subscriptions ss ON ss.tenant_id = t.id AND ss.status = 'active'
        ")->getRow();

        $totalTenants     = (int) ($counts->total_tenants     ?? 0);
        $suspendedTenants = (int) ($counts->suspended_tenants ?? 0);
        $trialTenants     = (int) ($counts->trialing_tenants  ?? 0);
        $activeTenants    = (int) ($counts->active_tenants    ?? 0);

        $historicalTenants = (int) ($db->query(
            "SELECT COUNT(DISTINCT target_id) AS cnt FROM platform_audit WHERE action = 'platform.tenant.provision' AND target_type = 'tenant' AND target_id IS NOT NULL"
        )->getRow()->cnt ?? 0);

        $totalTenants = max($totalTenants, $historicalTenants);

        // Single query for MRR and total revenue.
        $finance = $db->query("
            SELECT
                (SELECT SUM(
                    CASE WHEN ss2.billing_cycle = 'annual'
                         THEN sp2.annual_price_cents / 12
                         ELSE sp2.monthly_price_cents
                    END
                ) / 100
                FROM school_subscriptions ss2
                JOIN subscription_plans sp2 ON sp2.id = ss2.plan_id
                WHERE ss2.status = 'active') AS mrr,
                (SELECT SUM(amount_cents) / 100 FROM subscription_invoices) AS total_revenue
        ")->getRow();

        $mrr          = (float) ($finance->mrr           ?? 0);
        $totalRevenue = (float) ($finance->total_revenue ?? 0);

        return $this->success([
            'total_tenants'     => $totalTenants,
            'active_tenants'    => $activeTenants,
            'trial_tenants'     => $trialTenants,
            'trialing_tenants'  => $trialTenants,
            'suspended_tenants' => $suspendedTenants,
            'mrr'               => round($mrr, 2),
            'total_revenue'     => round($totalRevenue, 2),
        ]);
    }

    public function revenue()
    {
        $db = \Config\Database::connect();

        $rows = $db->query("
            SELECT
                DATE_FORMAT(issued_at, '%Y-%m') AS month,
                SUM(amount_cents) / 100          AS revenue
            FROM subscription_invoices
            WHERE issued_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY DATE_FORMAT(issued_at, '%Y-%m')
            ORDER BY month ASC
        ")->getResultArray();

        return $this->success($rows);
    }

    public function plans()
    {
        $db = \Config\Database::connect();

        $rows = $db->query("
            SELECT
                sp.name,
                COUNT(ss.id) AS subscriber_count
            FROM subscription_plans sp
            LEFT JOIN school_subscriptions ss ON ss.plan_id = sp.id AND ss.status = 'active'
            GROUP BY sp.id, sp.name
            ORDER BY subscriber_count DESC
        ")->getResultArray();

        return $this->success($rows);
    }

    public function activity()
    {
        $db = \Config\Database::connect();

        $rows = $db->table('platform_audit pa')
            ->select('pa.*, pu.name AS actor_name, pu.email AS actor_email')
            ->join('platform_users pu', 'pu.id = pa.actor_user_id', 'left')
            ->like('pa.action', 'platform.', 'after')
            ->orderBy('pa.created_at', 'DESC')
            ->limit(10)
            ->get()
            ->getResultArray();

        $rows = array_map(function ($row) {
            $details = json_decode($row['details'] ?? '{}', true) ?: [];

            return [
                'id'               => $row['id'],
                'action'           => $row['action'],
                'target_type'      => $row['target_type'],
                'target_id'        => $row['target_id'],
                'target_name'      => $details['target_name'] ?? null,
                'actor_user_id'    => $row['actor_user_id'],
                'actor_name'       => $row['actor_name'],
                'actor_email'      => $row['actor_email'],
                'ip_address'       => $row['ip_address'],
                'created_at'       => $row['created_at'],
                'created_at_human' => $this->formatActivityTimestamp($row['created_at'] ?? null),
                'details'          => $details,
            ];
        }, $rows);

        return $this->success($rows);
    }

    /**
     * Convert a MySQL datetime string to a human-readable activity timestamp.
     */
    private function formatActivityTimestamp(?string $datetime): string
    {
        if ($datetime === null || trim($datetime) === '') {
            return 'unknown time';
        }

        $timestamp = strtotime($datetime);

        if ($timestamp === false) {
            return 'unknown time';
        }

        return date('M j, Y g:i A', $timestamp);
    }
}
