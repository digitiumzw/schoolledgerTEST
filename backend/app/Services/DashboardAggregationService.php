<?php

namespace App\Services;

use App\Models\DashboardKpiMetricModel;
use Config\Database;
use App\Services\LedgerService;

/**
 * DashboardAggregationService — Pre-aggregated KPI metrics for dashboard display.
 *
 * Feature 094 (Multi-Currency): All SUM(amount) queries on charges/payments
 * in this service automatically aggregate in the tenant's base currency because
 * the `amount` column always holds the base-currency equivalent (computed
 * immutably at transaction creation by CurrencyService). No conversion logic
 * is needed here — the same principle as LedgerService applies. See the
 * LedgerService class docblock for the full multi-currency design rationale.
 */
class DashboardAggregationService
{
    private DashboardKpiMetricModel $metricModel;

    public function __construct()
    {
        $this->metricModel = new DashboardKpiMetricModel();
    }

    public function getDashboard(string $tenantId, string $role, string $userId, bool $refresh = false): array
    {
        if ($refresh) {
            $this->aggregateTenant($tenantId);
        }

        $metricKeys = $this->snapshotMetricKeys();
        $metrics = $this->metricModel->getLatestForTenant($tenantId, $metricKeys);

        if ($this->hasMissingMetrics($metricKeys, $metrics)) {
            $this->aggregateTenant($tenantId);
            $metrics = $this->metricModel->getLatestForTenant($tenantId, $metricKeys);
        }

        return [
            'stats' => $this->formatStatsSnapshot($tenantId, $metrics),
            'enrollmentByClass' => $this->enrollmentByClass($tenantId),
            'notifications' => $this->dashboardNotifications($tenantId, $role, $metrics),
            'lastRefresh' => $this->latestRefresh($metrics),
        ];
    }

    public function aggregateTenant(string $tenantId): int
    {
        $metrics = $this->computeMetrics($tenantId);
        foreach ($metrics as $metric) {
            $this->metricModel->upsertMetric($tenantId, $metric);
        }

        return count($metrics);
    }

    public function aggregateAllTenants(): array
    {
        $db = Database::connect();
        $tenants = $db->table('tenants')->select('id')->get()->getResultArray();
        $results = [];

        foreach ($tenants as $tenant) {
            $tenantId = (string) $tenant['id'];
            $results[$tenantId] = $this->aggregateTenant($tenantId);
        }

        return $results;
    }

    public function cleanupExpired(): int
    {
        return $this->metricModel->deleteExpired(date('Y-m-d H:i:s', strtotime('-1 day')));
    }

    public function getMetricHistory(string $tenantId, string $metricKey, int $days = 30): array
    {
        return $this->metricModel
            ->where('tenant_id', $tenantId)
            ->where('metric_key', $metricKey)
            ->where('period_start >=', date('Y-m-d', strtotime("-{$days} days")))
            ->orderBy('period_start', 'ASC')
            ->findAll();
    }

    private function computeMetrics(string $tenantId): array
    {
        $today = date('Y-m-d');
        $weekStart = date('Y-m-d', strtotime('monday this week'));
        $weekEnd = date('Y-m-d', strtotime('sunday this week'));
        $monthStart = date('Y-m-01');
        $monthEnd = date('Y-m-t');
        $currentTerm = $this->currentTerm($tenantId, $today);
        $termStart = $currentTerm['start'] ?? date('Y-m-d', strtotime('-90 days'));
        $termEnd = $currentTerm['end'] ?? $today;
        $financial = $this->financialStatusCounts($tenantId, $currentTerm);
        $classes = $this->classSummary($tenantId);
        $overCapacity = $this->overCapacityClasses($tenantId);
        $activeTransportRoutes = $this->activeTransportRoutes($tenantId);
        $teachingStaff = $this->teachingStaff($tenantId);
        $totalStaff = $this->totalStaff($tenantId);
        $allActiveStaff = $this->allActiveStaff($tenantId);
        $staffOnLeaveToday = $this->staffOnLeaveToday($tenantId, $today);

        return [
            $this->metric('total_students', $this->activeStudents($tenantId), $today, $today, 'number'),
            $this->metric('graduated_students', $this->graduatedStudents($tenantId), $today, $today, 'number'),
            $this->metric('active_enrollment', $this->activeEnrollment($tenantId), $today, $today, 'number'),
            $this->metric('new_enrollments_today', $this->newEnrollments($tenantId, $today, $today), $today, $today, 'number'),
            $this->metric('new_enrollments_week', $this->newEnrollments($tenantId, $weekStart, $weekEnd), $weekStart, $weekEnd, 'number'),
            $this->metric('new_enrollments_month', $this->newEnrollments($tenantId, $monthStart, $monthEnd), $monthStart, $monthEnd, 'number'),
            $this->metric('attendance_rate_today', $this->studentAttendanceRate($tenantId, $today, $today), $today, $today, 'percent'),
            $this->metric('attendance_rate_week', $this->studentAttendanceRate($tenantId, $weekStart, $weekEnd), $weekStart, $weekEnd, 'percent'),
            $this->metric('attendance_rate_month', $this->studentAttendanceRate($tenantId, $monthStart, $monthEnd), $monthStart, $monthEnd, 'percent'),
            $this->metric('present_today', $this->studentAttendanceCount($tenantId, $today, 'present'), $today, $today, 'number'),
            $this->metric('absent_today', $this->studentAttendanceCount($tenantId, $today, 'absent'), $today, $today, 'number'),
            $this->metric('late_today', $this->studentAttendanceCount($tenantId, $today, 'late'), $today, $today, 'number'),
            $this->metric('outstanding_payments', $this->outstandingPayments($tenantId), $today, $today, 'currency'),
            $this->metric('paid_in_full_students', $financial['paidInFull'], $today, $today, 'number'),
            $this->metric('outstanding_balance_students', $financial['withOutstanding'], $today, $today, 'number'),
            $this->metric('students_on_bursary_count', $financial['studentsOnBursary'], $today, $today, 'number'),
            $this->metric('total_revenue_this_term', $this->paymentsCollectedEligible($tenantId, $termStart, $termEnd), $termStart, $termEnd, 'currency'),
            $this->metric('payments_collected_today', $this->paymentsCollected($tenantId, $today, $today), $today, $today, 'currency'),
            $this->metric('payments_collected_week', $this->paymentsCollected($tenantId, $weekStart, $weekEnd), $weekStart, $weekEnd, 'currency'),
            $this->metric('payments_collected_month', $this->paymentsCollected($tenantId, $monthStart, $monthEnd), $monthStart, $monthEnd, 'currency'),
            $this->metric('payment_collection_rate', $this->paymentCollectionRate($tenantId, $currentTerm), $today, $today, 'percent'),
            $this->metric('active_transport_students', $this->activeTransportStudents($tenantId), $today, $today, 'number'),
            $this->metric('active_transport_routes', $activeTransportRoutes, $today, $today, 'number'),
            $this->metric('transport_utilization_rate', $this->transportUtilizationRate($tenantId), $today, $today, 'percent'),
            $this->metric('transport_revenue_month', $this->transportRevenue($tenantId, $monthStart, $monthEnd), $monthStart, $monthEnd, 'currency'),
            $this->metric('active_classes', $classes['activeClasses'], $today, $today, 'number'),
            $this->metric('avg_class_size', $classes['avgClassSize'], $today, $today, 'number'),
            $this->metric('low_attendance_students', $this->lowAttendanceStudents($tenantId, $termStart, $termEnd, $currentTerm !== null), $today, $today, 'number'),
            $this->metric('over_capacity_classes', $overCapacity['count'], $today, $today, 'number'),
            $this->metric('total_staff', $totalStaff, $today, $today, 'number'),
            $this->metric('all_active_staff', $allActiveStaff, $today, $today, 'number'),
            $this->metric('teaching_staff_count', $teachingStaff, $today, $today, 'number'),
            $this->metric('non_teaching_staff_count', $this->nonTeachingStaff($tenantId), $today, $today, 'number'),
            $this->metric('pending_leave_count', $this->pendingLeaveRequests($tenantId), $today, $today, 'number'),
            $this->metric('staff_on_leave_today', $staffOnLeaveToday, $today, $today, 'number'),
            $this->metric('staff_present_today', $this->staffPresentToday($tenantId, $today), $today, $today, 'number'),
            $this->metric('staff_attendance_rate', $this->staffAttendanceRate($tenantId, $today, $allActiveStaff, $staffOnLeaveToday), $today, $today, 'percent'),
        ];
    }

    private function metric(string $key, float $value, string $periodStart, string $periodEnd, string $format): array
    {
        $now = date('Y-m-d H:i:s');
        return [
            'metric_key' => $key,
            'metric_value' => $value,
            'metric_label' => $this->formatMetricLabel($value, $format),
            'period_start' => $periodStart,
            'period_end' => $periodEnd,
            'computed_at' => $now,
            'expires_at' => date('Y-m-d H:i:s', strtotime('+5 minutes')),
        ];
    }

    private function snapshotMetricKeys(): array
    {
        return [
            'total_students',
            'graduated_students',
            'active_enrollment',
            'outstanding_payments',
            'paid_in_full_students',
            'outstanding_balance_students',
            'students_on_bursary_count',
            'total_revenue_this_term',
            'payment_collection_rate',
            'active_transport_students',
            'active_transport_routes',
            'active_classes',
            'avg_class_size',
            'low_attendance_students',
            'over_capacity_classes',
            'total_staff',
            'all_active_staff',
            'teaching_staff_count',
            'non_teaching_staff_count',
            'pending_leave_count',
            'staff_on_leave_today',
            'staff_attendance_rate',
        ];
    }

    private function metricValue(array $metrics, string $key): float
    {
        return isset($metrics[$key]) ? (float) $metrics[$key]['metric_value'] : 0.0;
    }

    private function formatStatsSnapshot(string $tenantId, array $metrics): array
    {
        $today = date('Y-m-d');
        $currentTerm = $this->currentTerm($tenantId, $today);
        $overCapacity = $this->overCapacityClasses($tenantId);
        $totalStaff = (int) $this->metricValue($metrics, 'total_staff');
        $allActiveStaff = (int) $this->metricValue($metrics, 'all_active_staff');
        $teachingStaff = (int) $this->metricValue($metrics, 'teaching_staff_count');
        $outstandingStudents = $this->outstandingBalanceStudentsCount($tenantId);
        $staffOnLeaveToday = (int) $this->metricValue($metrics, 'staff_on_leave_today');
        $activeClasses = (int) $this->metricValue($metrics, 'active_classes');
        $avgClassSize = $this->metricValue($metrics, 'avg_class_size');

        return [
            'totalStudents' => (int) $this->metricValue($metrics, 'total_students'),
            'graduatedStudents' => (int) $this->metricValue($metrics, 'graduated_students'),
            'paidInFull' => (int) $this->metricValue($metrics, 'paid_in_full_students'),
            'withOutstanding' => $outstandingStudents,
            'partialOrOverdue' => 0,
            'totalOutstanding' => $this->metricValue($metrics, 'outstanding_payments'),
            'totalRevenueThisTerm' => $this->metricValue($metrics, 'total_revenue_this_term'),
            'collectionRate' => $this->metricValue($metrics, 'payment_collection_rate'),
            'studentsOnBursary' => (int) $this->metricValue($metrics, 'students_on_bursary_count'),
            'totalBursarySavings' => 0,
            'currentTermName' => $currentTerm['name'] ?? null,
            'totalClasses' => $activeClasses,
            'activeEnrollment' => (int) $this->metricValue($metrics, 'active_enrollment'),
            'activeClasses' => $activeClasses,
            'averageClassSize' => $avgClassSize,
            'avgClassSize' => $avgClassSize,
            'totalStaff' => $totalStaff,
            'teachingStaff' => $teachingStaff,
            'nonTeachingStaff' => (int) $this->metricValue($metrics, 'non_teaching_staff_count'),
            'allActiveStaff' => $allActiveStaff,
            'staffOnLeave' => $staffOnLeaveToday,
            'staffOnLeaveToday' => $staffOnLeaveToday,
            'staffAttendanceRate' => $this->metricValue($metrics, 'staff_attendance_rate'),
            'activeTransportRoutes' => (int) $this->metricValue($metrics, 'active_transport_routes'),
            'studentsUsingTransport' => (int) $this->metricValue($metrics, 'active_transport_students'),
            'lowAttendanceStudents' => (int) $this->metricValue($metrics, 'low_attendance_students'),
            'highOverdueBalances' => 0,
            'pendingLeaveRequests' => (int) $this->metricValue($metrics, 'pending_leave_count'),
            'overCapacityClasses' => (int) $this->metricValue($metrics, 'over_capacity_classes'),
            'outstandingBalanceStudents' => $outstandingStudents,
            'overCapacityClassNames' => $overCapacity['names'],
            'teachingStaffWithClasses' => 0,
        ];
    }

    private function dashboardNotifications(string $tenantId, string $role, array $metrics): array
    {
        $today = date('Y-m-d');
        $currentTerm = $this->currentTerm($tenantId, $today);
        $notifications = [];

        if ($currentTerm === null) {
            $notifications[] = $this->notification(
                'calendar-no-active-term',
                'calendar',
                'warning',
                'No active term configured',
                'Some dashboard KPIs and billing workflows require an active academic term.',
                '/settings/calendar',
                'Update calendar',
                100
            );
        }

        foreach ($this->upcomingCalendarNotices($tenantId, $today) as $notice) {
            $notifications[] = $notice;
        }

        if (in_array($role, ['admin', 'super_admin', 'bursar'], true)) {
            $unbilled = $this->unbilledStudentsAlert($tenantId);
            if (($unbilled['unbilledStudentCount'] ?? 0) > 0) {
                $notifications[] = $this->notification(
                    'billing-unbilled-students',
                    'billing',
                    'critical',
                    'Students not yet billed',
                    "{$unbilled['unbilledStudentCount']} of {$unbilled['eligibleStudentCount']} active students have no charges for {$unbilled['billingPeriod']}.",
                    '/settings/fee-structure',
                    'Generate charges',
                    95,
                    (int) $unbilled['unbilledStudentCount']
                );
            }
        }

        if (in_array($role, ['admin', 'super_admin'], true)) {
            $pendingLeaves = (int) $this->metricValue($metrics, 'pending_leave_count');
            if ($pendingLeaves > 0) {
                $notifications[] = $this->notification(
                    'staff-pending-leave',
                    'staff',
                    'warning',
                    'Pending leave requests',
                    "{$pendingLeaves} leave request" . ($pendingLeaves === 1 ? ' is' : 's are') . ' awaiting review.',
                    '/staff-attendance',
                    'Review requests',
                    90,
                    $pendingLeaves
                );
            }
        }

        $outstandingStudents = (int) $this->metricValue($metrics, 'outstanding_balance_students');
        if ($outstandingStudents > 0 && in_array($role, ['admin', 'super_admin', 'bursar'], true)) {
            $notifications[] = $this->notification(
                'billing-outstanding-balances',
                'billing',
                'warning',
                'Outstanding student balances',
                "{$outstandingStudents} student" . ($outstandingStudents === 1 ? ' has' : 's have') . ' an outstanding balance.',
                '/students',
                'View students',
                70,
                $outstandingStudents
            );
        }

        $lowAttendance = (int) $this->metricValue($metrics, 'low_attendance_students');
        if ($lowAttendance > 0) {
            $notifications[] = $this->notification(
                'attendance-low-students',
                'attendance',
                'warning',
                'Low attendance students',
                "{$lowAttendance} student" . ($lowAttendance === 1 ? ' is' : 's are') . ' below the attendance threshold.',
                '/attendance',
                'View attendance',
                60,
                $lowAttendance
            );
        }

        $overCapacity = (int) $this->metricValue($metrics, 'over_capacity_classes');
        if ($overCapacity > 0) {
            $notifications[] = $this->notification(
                'classes-over-capacity',
                'classes',
                'info',
                'Classes over capacity',
                $overCapacity === 1 ? '1 class exceeds configured capacity.' : "{$overCapacity} classes exceed configured capacity.",
                '/classes',
                'View classes',
                50,
                $overCapacity
            );
        }

        if (in_array($role, ['admin', 'super_admin'], true)) {
            $unassignedStudents = $this->unassignedStudentsCount($tenantId);
            if ($unassignedStudents > 0) {
                $notifications[] = $this->notification(
                    'classes-unassigned-students',
                    'classes',
                    'warning',
                    'Unassigned students',
                    "{$unassignedStudents} active student" . ($unassignedStudents === 1 ? ' is' : 's are') . ' not assigned to any class.',
                    '/classes/unassigned',
                    'View & Assign',
                    85,
                    $unassignedStudents
                );
            }
        }

        usort($notifications, static fn(array $a, array $b): int => $b['priority'] <=> $a['priority']);

        return array_values(array_map(static function (array $notification): array {
            unset($notification['priority']);
            return $notification;
        }, array_slice($notifications, 0, 8)));
    }

    private function notification(
        string $id,
        string $category,
        string $severity,
        string $title,
        string $message,
        ?string $actionUrl,
        ?string $actionLabel,
        int $priority,
        ?int $count = null
    ): array {
        return [
            'id' => $id,
            'category' => $category,
            'severity' => $severity,
            'title' => $title,
            'message' => $message,
            'actionUrl' => $actionUrl,
            'actionLabel' => $actionLabel,
            'count' => $count,
            'createdAt' => date('c'),
            'priority' => $priority,
        ];
    }

    private function upcomingCalendarNotices(string $tenantId, string $today): array
    {
        $tenant = Database::connect()->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        $calendar = json_decode($tenant['academic_calendar'] ?? '{}', true);
        $terms = is_array($calendar) ? ($calendar['terms'] ?? []) : [];
        $notices = [];

        foreach ($terms as $term) {
            $name = (string) ($term['name'] ?? 'Academic term');
            $start = (string) ($term['start'] ?? '');
            $end = (string) ($term['end'] ?? '');

            if ($start !== '') {
                $daysUntilStart = (int) floor((strtotime($start) - strtotime($today)) / 86400);
                if ($daysUntilStart >= 0 && $daysUntilStart <= 14) {
                    $notices[] = $this->notification(
                        'calendar-term-start-' . ($term['id'] ?? md5($start . $name)),
                        'calendar',
                        $daysUntilStart <= 3 ? 'warning' : 'info',
                        "{$name} starts soon",
                        $daysUntilStart === 0 ? "{$name} starts today." : "{$name} starts in {$daysUntilStart} day" . ($daysUntilStart === 1 ? '.' : 's.'),
                        '/settings/calendar',
                        'View calendar',
                        80 - $daysUntilStart
                    );
                }
            }

            if ($end !== '') {
                $daysUntilEnd = (int) floor((strtotime($end) - strtotime($today)) / 86400);
                if ($daysUntilEnd >= 0 && $daysUntilEnd <= 14) {
                    $notices[] = $this->notification(
                        'calendar-term-end-' . ($term['id'] ?? md5($end . $name)),
                        'calendar',
                        $daysUntilEnd <= 3 ? 'warning' : 'info',
                        "{$name} ends soon",
                        $daysUntilEnd === 0 ? "{$name} ends today." : "{$name} ends in {$daysUntilEnd} day" . ($daysUntilEnd === 1 ? '.' : 's.'),
                        '/settings/calendar',
                        'View calendar',
                        75 - $daysUntilEnd
                    );
                }
            }
        }

        return $notices;
    }

    private function unbilledStudentsAlert(string $tenantId): array
    {
        try {
            return (new FeeRuleBillingService())->getUnbilledAlert($tenantId);
        } catch (\Throwable $e) {
            log_message('warning', 'Dashboard unbilled alert failed: ' . $e->getMessage());
            return [
                'billingPeriod' => '',
                'eligibleStudentCount' => 0,
                'unbilledStudentCount' => 0,
            ];
        }
    }

    private function currentTerm(string $tenantId, string $today): ?array
    {
        $tenant = Database::connect()->table('tenants')->where('id', $tenantId)->get()->getRow();
        $academicCalendar = json_decode($tenant->academic_calendar ?? '{}', true);
        return (new AcademicCalendarService())->getCurrentTerm(is_array($academicCalendar) ? $academicCalendar : [], $today);
    }

    private function financialStatusCounts(string $tenantId, ?array $currentTerm): array
    {
        $db = Database::connect();
        $hasAdjustments = $db->tableExists('ledger_adjustments');
        $eligibleChargeTypes = LedgerService::eligibleChargeTypeSqlList();
        $eligiblePaymentCategories = LedgerService::eligiblePaymentCategorySqlList();

        if ($currentTerm) {
            $chargesWhere = "tenant_id = ? AND deleted_at IS NULL AND voided_at IS NULL AND charge_type IN ({$eligibleChargeTypes}) AND (term_id = ? OR (term_id IS NULL AND date_generated BETWEEN ? AND ?))";
            $paymentsWhere = "tenant_id = ? AND date >= ? AND date <= ? AND fee_campaign_id IS NULL AND voided_at IS NULL AND category IN ({$eligiblePaymentCategories})";
            $bindings = [$tenantId, $currentTerm['id'], $currentTerm['start'], $currentTerm['end'], $tenantId, $currentTerm['start'], $currentTerm['end']];
        } else {
            $chargesWhere = "tenant_id = ? AND deleted_at IS NULL AND voided_at IS NULL AND charge_type IN ({$eligibleChargeTypes})";
            $paymentsWhere = "tenant_id = ? AND fee_campaign_id IS NULL AND voided_at IS NULL AND category IN ({$eligiblePaymentCategories})";
            $bindings = [$tenantId, $tenantId];
        }

        $sql = "
            SELECT
                COALESCE(SUM(CASE WHEN balance <= 0 THEN 1 ELSE 0 END), 0) AS paid_in_full,
                COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) AS with_outstanding,
                COALESCE(SUM(CASE WHEN balance > 100 THEN 1 ELSE 0 END), 0) AS high_overdue,
                COALESCE(SUM(CASE WHEN bursary_status IS NOT NULL AND bursary_status != 'none' THEN 1 ELSE 0 END), 0) AS students_on_bursary
            FROM (
                SELECT
                    s.id,
                    s.bursary_status,
                    COALESCE(charges.total, 0)
                        + COALESCE(debits.total, 0)
                        - COALESCE(payments.total, 0)
                        - COALESCE(credits.total, 0) AS balance
                FROM students s
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM charges
                    WHERE {$chargesWhere}
                    GROUP BY student_id
                ) charges ON charges.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM payments
                    WHERE {$paymentsWhere}
                    GROUP BY student_id
                ) payments ON payments.student_id = s.id
        ";

        if ($hasAdjustments) {
            $sql .= "
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM ledger_adjustments
                    WHERE tenant_id = ? AND adjustment_type = 'debit' AND status = 'approved'
                    GROUP BY student_id
                ) debits ON debits.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM ledger_adjustments
                    WHERE tenant_id = ? AND adjustment_type = 'credit' AND status = 'approved'
                    GROUP BY student_id
                ) credits ON credits.student_id = s.id
            ";
            $bindings[] = $tenantId;
            $bindings[] = $tenantId;
        } else {
            $sql .= "
                LEFT JOIN (SELECT NULL AS student_id, 0 AS total WHERE 1=0) debits ON debits.student_id = s.id
                LEFT JOIN (SELECT NULL AS student_id, 0 AS total WHERE 1=0) credits ON credits.student_id = s.id
            ";
        }

        $sql .= "
                WHERE s.tenant_id = ? AND s.status = 'active'
            ) balances
        ";
        $bindings[] = $tenantId;

        $row = $db->query($sql, $bindings)->getRow();
        return [
            'paidInFull' => $this->paidInFullAllTime($tenantId),
            'withOutstanding' => $this->outstandingBalanceStudentsCount($tenantId),
            'highOverdueBalances' => (int) ($row->high_overdue ?? 0),
            'studentsOnBursary' => (int) ($row->students_on_bursary ?? 0),
        ];
    }

    /**
     * Count active students whose all-time outstanding balance is exactly zero.
     * Always all-time — never scoped to a single term.
     */
    private function paidInFullAllTime(string $tenantId): int
    {
        $db = Database::connect();
        $hasAdjustments = $db->tableExists('ledger_adjustments');
        $eligibleChargeTypes = LedgerService::eligibleChargeTypeSqlList();
        $eligiblePaymentCategories = LedgerService::eligiblePaymentCategorySqlList();

        $bindings = [
            $tenantId,  // charges
            $tenantId,  // payments
        ];

        $sql = "
            SELECT COUNT(*) AS paid_in_full
            FROM (
                SELECT
                    s.id,
                    COALESCE(charges.total, 0)
                        + COALESCE(debits.total, 0)
                        - COALESCE(payments.total, 0)
                        - COALESCE(credits.total, 0) AS balance
                FROM students s
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM charges
                    WHERE tenant_id = ? AND deleted_at IS NULL AND voided_at IS NULL
                      AND charge_type IN ({$eligibleChargeTypes})
                    GROUP BY student_id
                ) charges ON charges.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM payments
                    WHERE tenant_id = ? AND fee_campaign_id IS NULL
                      AND voided_at IS NULL
                      AND category IN ({$eligiblePaymentCategories})
                    GROUP BY student_id
                ) payments ON payments.student_id = s.id
        ";

        if ($hasAdjustments) {
            $sql .= "
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM ledger_adjustments
                    WHERE tenant_id = ? AND adjustment_type = 'debit' AND status = 'approved'
                    GROUP BY student_id
                ) debits ON debits.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM ledger_adjustments
                    WHERE tenant_id = ? AND adjustment_type = 'credit' AND status = 'approved'
                    GROUP BY student_id
                ) credits ON credits.student_id = s.id
            ";
            $bindings[] = $tenantId;
            $bindings[] = $tenantId;
        } else {
            $sql .= "
                LEFT JOIN (SELECT NULL AS student_id, 0 AS total WHERE 1=0) debits ON debits.student_id = s.id
                LEFT JOIN (SELECT NULL AS student_id, 0 AS total WHERE 1=0) credits ON credits.student_id = s.id
            ";
        }

        $sql .= "
                WHERE s.tenant_id = ? AND s.status = 'active'
            ) balances
            WHERE balance <= 0
        ";
        $bindings[] = $tenantId;

        $row = $db->query($sql, $bindings)->getRow();
        return (int) ($row->paid_in_full ?? 0);
    }

    private function outstandingBalanceStudentsCount(string $tenantId): int
    {
        $db = Database::connect();
        $eligibleChargeTypes = LedgerService::eligibleChargeTypeSqlList();
        $eligiblePaymentCategories = LedgerService::eligiblePaymentCategorySqlList();
        $sql = "
            SELECT COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) AS total
            FROM (
                SELECT
                    s.id,
                    COALESCE(charges.total, 0)
                        + COALESCE(debits.total, 0)
                        - COALESCE(payments.total, 0)
                        - COALESCE(credits.total, 0) AS balance
                FROM students s
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM charges
                    WHERE tenant_id = ?
                      AND deleted_at IS NULL
                      AND voided_at IS NULL
                      AND charge_type IN ({$eligibleChargeTypes})
                    GROUP BY student_id
                ) charges ON charges.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM payments
                    WHERE tenant_id = ?
                      AND fee_campaign_id IS NULL
                      AND voided_at IS NULL
                      AND category IN ({$eligiblePaymentCategories})
                    GROUP BY student_id
                ) payments ON payments.student_id = s.id
        ";
        $bindings = [$tenantId, $tenantId];

        if ($db->tableExists('ledger_adjustments')) {
            $sql .= "
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM ledger_adjustments
                    WHERE tenant_id = ? AND adjustment_type = 'debit' AND status = 'approved'
                    GROUP BY student_id
                ) debits ON debits.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM ledger_adjustments
                    WHERE tenant_id = ? AND adjustment_type = 'credit' AND status = 'approved'
                    GROUP BY student_id
                ) credits ON credits.student_id = s.id
            ";
            $bindings[] = $tenantId;
            $bindings[] = $tenantId;
        } else {
            $sql .= "
                LEFT JOIN (SELECT NULL AS student_id, 0 AS total WHERE 1=0) debits ON debits.student_id = s.id
                LEFT JOIN (SELECT NULL AS student_id, 0 AS total WHERE 1=0) credits ON credits.student_id = s.id
            ";
        }

        $sql .= "
                WHERE s.tenant_id = ?
            ) balances
        ";
        $bindings[] = $tenantId;

        return (int) ($db->query($sql, $bindings)->getRow()->total ?? 0);
    }

    private function activeEnrollment(string $tenantId): int
    {
        return (int) (Database::connect()->table('enrollments e')
            ->select('COUNT(DISTINCT e.student_id) AS total', false)
            ->join('students s', 's.id = e.student_id')
            ->where('e.tenant_id', $tenantId)
            ->where('s.tenant_id', $tenantId)
            ->where('s.status', 'active')
            ->where('e.status', 'ACTIVE')
            ->get()
            ->getRow()
            ->total ?? 0);
    }

    private function classSummary(string $tenantId): array
    {
        $activeClasses = (int) Database::connect()->table('classes')
            ->where('tenant_id', $tenantId)
            ->where('archived_at', null)
            ->countAllResults();
        $avgClassSize = $activeClasses > 0 ? round($this->activeStudents($tenantId) / $activeClasses, 1) : 0.0;
        return ['activeClasses' => $activeClasses, 'avgClassSize' => $avgClassSize];
    }

    private function enrollmentByClass(string $tenantId): array
    {
        $rows = Database::connect()->query(
            "SELECT c.id AS class_id, c.name AS class_name,
                    COUNT(s.id) AS total,
                    SUM(CASE WHEN s.gender = 'male' THEN 1 ELSE 0 END) AS male,
                    SUM(CASE WHEN s.gender = 'female' THEN 1 ELSE 0 END) AS female,
                    SUM(CASE WHEN s.id IS NOT NULL AND (s.gender NOT IN ('male','female') OR s.gender IS NULL) THEN 1 ELSE 0 END) AS other
             FROM classes c
             LEFT JOIN students s ON s.class_id = c.id AND s.tenant_id = ? AND s.status = 'active'
             WHERE c.tenant_id = ? AND c.archived_at IS NULL
             GROUP BY c.id, c.name
             ORDER BY c.name ASC",
            [$tenantId, $tenantId]
        )->getResultArray();

        return array_map(static fn(array $row): array => [
            'classId' => $row['class_id'],
            'className' => $row['class_name'],
            'level' => 0,
            'total' => (int) $row['total'],
            'male' => (int) $row['male'],
            'female' => (int) $row['female'],
            'other' => (int) $row['other'],
        ], $rows);
    }

    private function overCapacityClasses(string $tenantId): array
    {
        $rows = Database::connect()->query(
            "SELECT c.name, c.capacity, COUNT(s.id) AS total
             FROM classes c
             LEFT JOIN students s ON s.class_id = c.id AND s.tenant_id = ? AND s.status = 'active'
             WHERE c.tenant_id = ? AND c.archived_at IS NULL
             GROUP BY c.id, c.name, c.capacity
             HAVING c.capacity IS NOT NULL AND c.capacity > 0 AND total >= c.capacity",
            [$tenantId, $tenantId]
        )->getResultArray();

        return ['count' => count($rows), 'names' => array_values(array_map(static fn(array $row): string => (string) $row['name'], $rows))];
    }

    private function activeTransportRoutes(string $tenantId): int
    {
        $db = Database::connect();
        if (!$db->tableExists('transport_routes')) {
            return 0;
        }
        return (int) $db->table('transport_routes')->where('tenant_id', $tenantId)->where('status', 'active')->countAllResults();
    }

    private function lowAttendanceStudents(string $tenantId, string $termStart, string $termEnd, bool $hasActiveTerm): int
    {
        if (!$hasActiveTerm) {
            return 0;
        }
        $db = Database::connect();
        $table = $db->tableExists('student_attendance_events') ? 'student_attendance_events' : 'student_attendance';
        $effectiveWhere = $table === 'student_attendance_events' ? 'AND a.is_effective = 1' : '';
        $row = $db->query(
            "SELECT COUNT(*) AS cnt
             FROM (
                SELECT a.student_id,
                       SUM(CASE WHEN a.status IN ('present', 'late', 'half_day') THEN 1 ELSE 0 END) * 100.0 / COUNT(*) AS pct
                FROM {$table} a
                INNER JOIN students s ON s.id = a.student_id AND s.tenant_id = a.tenant_id AND s.status = 'active'
                WHERE a.tenant_id = ? AND a.date >= ? AND a.date <= ? {$effectiveWhere}
                GROUP BY a.student_id
                HAVING pct < 75
             ) low_attendance",
            [$tenantId, $termStart, $termEnd]
        )->getRow();
        return (int) ($row->cnt ?? 0);
    }

    private function teachingStaff(string $tenantId): int
    {
        return (int) Database::connect()->table('staff')
            ->where('tenant_id', $tenantId)
            ->where('is_teaching', true)
            ->where('employment_status', 'active')
            ->countAllResults();
    }

    private function pendingLeaveRequests(string $tenantId): int
    {
        $db = Database::connect();
        if (!$db->tableExists('leave_requests')) {
            return 0;
        }
        return (int) $db->table('leave_requests')->where('tenant_id', $tenantId)->where('status', 'pending')->countAllResults();
    }

    private function staffOnLeaveToday(string $tenantId, string $date): int
    {
        $db = Database::connect();
        if (!$db->tableExists('leave_requests')) {
            return 0;
        }
        return (int) ($db->table('leave_requests lr')
            ->select('COUNT(DISTINCT lr.staff_id) AS total', false)
            ->join('staff s', 's.id = lr.staff_id AND s.tenant_id = lr.tenant_id')
            ->where('lr.tenant_id', $tenantId)
            ->where('lr.status', 'approved')
            ->where('lr.start_date <=', $date)
            ->where('lr.end_date >=', $date)
            ->where('s.employment_status', 'active')
            ->get()
            ->getRow()
            ->total ?? 0);
    }

    private function teachingStaffWithClasses(string $tenantId): int
    {
        $db = Database::connect();
        if (!$db->fieldExists('teacher_id', 'classes')) {
            return 0;
        }
        return (int) ($db->table('staff s')
            ->select('COUNT(DISTINCT s.id) AS total', false)
            ->join('classes c', 'c.teacher_id = s.id AND c.tenant_id = s.tenant_id')
            ->where('s.tenant_id', $tenantId)
            ->where('s.is_teaching', true)
            ->where('s.employment_status', 'active')
            ->where('c.archived_at', null)
            ->get()
            ->getRow()
            ->total ?? 0);
    }

    private function activeStudents(string $tenantId): int
    {
        return (int) Database::connect()->table('students')->where('tenant_id', $tenantId)->where('status', 'active')->countAllResults();
    }

    private function graduatedStudents(string $tenantId): int
    {
        return (int) Database::connect()->table('students')->where('tenant_id', $tenantId)->where('status', 'graduated')->countAllResults();
    }

    private function newEnrollments(string $tenantId, string $start, string $end): int
    {
        return (int) Database::connect()->table('students')
            ->where('tenant_id', $tenantId)
            ->where('enrollment_date >=', $start)
            ->where('enrollment_date <=', $end)
            ->countAllResults();
    }

    private function studentAttendanceRate(string $tenantId, string $start, string $end): float
    {
        $db = Database::connect();
        $table = $db->tableExists('student_attendance_events') ? 'student_attendance_events' : 'student_attendance';
        $builder = $db->table($table)->where('tenant_id', $tenantId);

        if ($table === 'student_attendance_events') {
            $builder->where('is_effective', 1);
        }

        $rows = $builder->where('date >=', $start)->where('date <=', $end)->get()->getResultArray();
        if (empty($rows)) {
            return 0.0;
        }

        $attended = 0;
        foreach ($rows as $row) {
            if (in_array($row['status'], ['present', 'late', 'half_day'], true)) {
                $attended++;
            }
        }

        return round($attended / count($rows) * 100, 1);
    }

    private function studentAttendanceCount(string $tenantId, string $date, string $status): int
    {
        $db = Database::connect();
        $table = $db->tableExists('student_attendance_events') ? 'student_attendance_events' : 'student_attendance';
        $builder = $db->table($table)->where('tenant_id', $tenantId)->where('date', $date)->where('status', $status);

        if ($table === 'student_attendance_events') {
            $builder->where('is_effective', 1);
        }

        return (int) $builder->countAllResults();
    }

    private function outstandingPayments(string $tenantId): float
    {
        $db = Database::connect();
        $eligibleChargeTypes = LedgerService::eligibleChargeTypeSqlList();
        $eligiblePaymentCategories = LedgerService::eligiblePaymentCategorySqlList();
        $sql = "
            SELECT COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS total
            FROM (
                SELECT
                    s.id,
                    COALESCE(charges.total, 0)
                        + COALESCE(debits.total, 0)
                        - COALESCE(payments.total, 0)
                        - COALESCE(credits.total, 0) AS balance
                FROM students s
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM charges
                    WHERE tenant_id = ?
                      AND deleted_at IS NULL
                      AND voided_at IS NULL
                      AND charge_type IN ({$eligibleChargeTypes})
                    GROUP BY student_id
                ) charges ON charges.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM payments
                    WHERE tenant_id = ?
                      AND fee_campaign_id IS NULL
                      AND voided_at IS NULL
                      AND category IN ({$eligiblePaymentCategories})
                    GROUP BY student_id
                ) payments ON payments.student_id = s.id
        ";
        $bindings = [$tenantId, $tenantId];

        if ($db->tableExists('ledger_adjustments')) {
            $sql .= "
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM ledger_adjustments
                    WHERE tenant_id = ? AND adjustment_type = 'debit' AND status = 'approved'
                    GROUP BY student_id
                ) debits ON debits.student_id = s.id
                LEFT JOIN (
                    SELECT student_id, SUM(amount) AS total
                    FROM ledger_adjustments
                    WHERE tenant_id = ? AND adjustment_type = 'credit' AND status = 'approved'
                    GROUP BY student_id
                ) credits ON credits.student_id = s.id
            ";
            $bindings[] = $tenantId;
            $bindings[] = $tenantId;
        } else {
            $sql .= "
                LEFT JOIN (SELECT NULL AS student_id, 0 AS total WHERE 1=0) debits ON debits.student_id = s.id
                LEFT JOIN (SELECT NULL AS student_id, 0 AS total WHERE 1=0) credits ON credits.student_id = s.id
            ";
        }

        $sql .= "
                WHERE s.tenant_id = ?
            ) balances
        ";
        $bindings[] = $tenantId;

        return (float) ($db->query($sql, $bindings)->getRow()->total ?? 0);
    }

    private function paymentsCollected(string $tenantId, string $start, string $end): float
    {
        return (float) (Database::connect()->table('payments')
            ->select('COALESCE(SUM(amount), 0) AS total', false)
            ->where('tenant_id', $tenantId)
            ->where('date >=', $start)
            ->where('date <=', $end)
            ->where('voided_at', null)
            ->get()
            ->getRow()
            ->total ?? 0);
    }

    private function paymentsCollectedEligible(string $tenantId, string $start, string $end): float
    {
        $eligiblePaymentCategories = LedgerService::eligiblePaymentCategorySqlList();
        $sql = "
            SELECT COALESCE(SUM(amount), 0) AS total
            FROM payments
            WHERE tenant_id = ?
              AND date >= ?
              AND date <= ?
              AND fee_campaign_id IS NULL
              AND voided_at IS NULL
              AND category IN ({$eligiblePaymentCategories})
        ";
        return (float) (Database::connect()->query($sql, [$tenantId, $start, $end])->getRow()->total ?? 0);
    }

    private function paymentCollectionRate(string $tenantId, ?array $currentTerm): float
    {
        if ($currentTerm === null) {
            return 0.0;
        }
        $db = Database::connect();
        $eligibleChargeTypes = LedgerService::eligibleChargeTypeSqlList();
        $eligiblePaymentCategories = LedgerService::eligiblePaymentCategorySqlList();
        $charges = (float) ($db->query(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM charges
             WHERE tenant_id = ? AND deleted_at IS NULL AND voided_at IS NULL
               AND charge_type IN ({$eligibleChargeTypes})
               AND (term_id = ? OR (term_id IS NULL AND date_generated BETWEEN ? AND ?))",
            [$tenantId, $currentTerm['id'], $currentTerm['start'], $currentTerm['end']]
        )->getRow()->total ?? 0);
        if ($charges <= 0) {
            return 0.0;
        }
        $payments = (float) ($db->query(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM payments
             WHERE tenant_id = ? AND date >= ? AND date <= ?
               AND fee_campaign_id IS NULL AND voided_at IS NULL AND category IN ({$eligiblePaymentCategories})",
            [$tenantId, $currentTerm['start'], $currentTerm['end']]
        )->getRow()->total ?? 0);
        return round(min(100.0, $payments / $charges * 100), 1);
    }

    private function activeTransportStudents(string $tenantId): int
    {
        $db = Database::connect();
        if (!$db->tableExists('transport_student_allocations')) {
            return 0;
        }
        return (int) ($db->table('transport_student_allocations tsa')
            ->select('COUNT(DISTINCT tsa.student_id) AS total', false)
            ->join('students s', 's.id = tsa.student_id')
            ->join('transport_routes r', 'r.id = tsa.route_id AND r.tenant_id = tsa.tenant_id')
            ->where('tsa.tenant_id', $tenantId)
            ->where('tsa.status', 'active')
            ->where('s.status', 'active')
            ->get()
            ->getRow()
            ->total ?? 0);
    }

    private function transportUtilizationRate(string $tenantId): float
    {
        $db = Database::connect();
        if (!$db->tableExists('transport_student_allocations') || !$db->tableExists('transport_vehicles')) {
            return 0.0;
        }
        $activeStudents = $this->activeTransportStudents($tenantId);
        $capacity = (int) ($db->table('transport_vehicles')->select('COALESCE(SUM(capacity), 0) AS total', false)->where('tenant_id', $tenantId)->where('status', 'active')->get()->getRow()->total ?? 0);
        return $capacity > 0 ? round($activeStudents / $capacity * 100, 1) : 0.0;
    }

    private function transportRevenue(string $tenantId, string $start, string $end): float
    {
        return (float) (Database::connect()->table('payments')
            ->select('COALESCE(SUM(amount), 0) AS total', false)
            ->where('tenant_id', $tenantId)
            ->where('date >=', $start)
            ->where('date <=', $end)
            ->where('voided_at', null)
            ->groupStart()
            ->where('category', 'Transport')
            ->orWhere('category', 'Transport Fee')
            ->orWhere('category', 'Transport + Fees')
            ->groupEnd()
            ->get()
            ->getRow()
            ->total ?? 0);
    }

    private function totalStaff(string $tenantId): int
    {
        return (int) Database::connect()->table('staff')->where('tenant_id', $tenantId)->countAllResults();
    }

    private function allActiveStaff(string $tenantId): int
    {
        return (int) Database::connect()->table('staff')->where('tenant_id', $tenantId)->where('employment_status', 'active')->countAllResults();
    }

    private function nonTeachingStaff(string $tenantId): int
    {
        return (int) Database::connect()->table('staff')->where('tenant_id', $tenantId)->where('is_teaching', false)->countAllResults();
    }

    private function staffPresentToday(string $tenantId, string $date): int
    {
        $db = Database::connect();
        if (!$db->tableExists('staff_attendance')) {
            return 0;
        }
        return (int) $db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('date', $date)
            ->whereIn('status', ['present', 'late', 'half_day'])
            ->countAllResults();
    }

    private function staffAttendanceRate(string $tenantId, string $date, int $allActiveStaff, int $staffOnLeaveToday): float
    {
        $denominator = $allActiveStaff - $staffOnLeaveToday;
        if ($denominator <= 0) {
            return 0.0;
        }
        return round($this->staffPresentToday($tenantId, $date) / $denominator * 100, 1);
    }

    private function formatMetricLabel(float $value, string $format): string
    {
        if ($format === 'percent') {
            return number_format($value, 1) . '%';
        }
        if ($format === 'currency') {
            return '$' . number_format($value, 2);
        }
        return number_format($value);
    }

    private function hasMissingMetrics(array $metricKeys, array $metrics): bool
    {
        foreach ($metricKeys as $key) {
            if (!isset($metrics[$key])) {
                return true;
            }
        }
        return false;
    }

    private function latestRefresh(array $metrics): ?string
    {
        $latest = null;
        foreach ($metrics as $metric) {
            if ($latest === null || strtotime($metric['computed_at']) > strtotime($latest)) {
                $latest = $metric['computed_at'];
            }
        }
        return $latest;
    }

    private function unassignedStudentsCount(string $tenantId): int
    {
        return (int) Database::connect()->table('students')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->groupStart()
                ->where('class_id IS NULL', null, false)
                ->orWhere('class_id', '')
            ->groupEnd()
            ->countAllResults();
    }
}
