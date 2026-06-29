<?php

namespace App\Controllers\Api;

use App\Services\DashboardAggregationService;

class DashboardController extends BaseApiController
{
    public function index()
    {
        if (!$this->userHasRole('admin', 'super_admin', 'bursar')) {
            return $this->error('Insufficient permissions', 403);
        }

        $tenantId = $this->getTenantId();
        $user = $this->getCurrentUser();
        $refresh = filter_var($this->request->getGet('refresh') ?? false, FILTER_VALIDATE_BOOLEAN);

        $service = new DashboardAggregationService();

        return $this->success(
            $service->getDashboard($tenantId, $user->role, (string) $user->id, $refresh),
            'Dashboard loaded successfully'
        );
    }

    public function metric(string $metricKey)
    {
        if (!$this->userHasRole('admin', 'super_admin', 'bursar')) {
            return $this->error('Insufficient permissions', 403);
        }

        $period = (string) ($this->request->getGet('period') ?? 'month');
        $days = $period === 'week' ? 7 : ($period === 'quarter' ? 90 : 30);
        $service = new DashboardAggregationService();
        $history = $service->getMetricHistory($this->getTenantId(), $metricKey, $days);

        if (empty($history)) {
            return $this->notFound('Metric not found');
        }

        $latest = $history[array_key_last($history)];

        return $this->success([
            'metricKey' => $metricKey,
            'currentValue' => (float) $latest['metric_value'],
            'currentLabel' => $latest['metric_label'],
            'historicalData' => array_map(static fn(array $row): array => [
                'date' => $row['period_start'],
                'value' => (float) $row['metric_value'],
                'label' => $row['metric_label'],
            ], $history),
            'lastUpdated' => $latest['computed_at'],
        ], 'Metric retrieved successfully');
    }

    public function refresh()
    {
        if (!$this->userHasRole('admin', 'super_admin')) {
            return $this->error('Only administrators can trigger metric refresh', 403);
        }

        $service = new DashboardAggregationService();
        $count = $service->aggregateTenant($this->getTenantId());

        return $this->success([
            'refreshId' => 'refresh_' . time(),
            'status' => 'completed',
            'metricsQueued' => $count,
            'estimatedCompletion' => date('c'),
        ], 'Refresh completed successfully');
    }

    /**
     * GET /api/dashboard/activity?limit=5
     * Returns a reverse-chronological feed of the most recent tenant activities.
     */
    public function activity()
    {
        $tenantId = $this->getTenantId();
        $limit    = min(20, max(1, (int) ($this->request->getGet('limit') ?? 5)));

        $db = \Config\Database::connect();
        $activities = [];

        // 1. Payments
        $payments = $db->table('payments p')
            ->select("p.id, p.amount, p.date AS event_date, p.method, p.category,
                      CONCAT(s.first_name, ' ', s.last_name) AS student_name")
            ->join('students s', 's.id = p.student_id', 'left')
            ->where('p.tenant_id', $tenantId)
            ->orderBy('p.date', 'DESC')
            ->limit($limit)
            ->get()
            ->getResultArray();

        foreach ($payments as $p) {
            $isoTime = null;
            if (!empty($p['event_date'])) {
                try {
                    $dt = new \DateTimeImmutable($p['event_date']);
                    $isoTime = $dt->setTimezone(new \DateTimeZone(app_timezone()))->format(DATE_ATOM);
                } catch (\Throwable $e) {
                    $isoTime = null;
                }
            }
            $activities[] = [
                'id'          => 'pay_' . $p['id'],
                'type'        => 'payment',
                'description' => 'Payment received',
                'detail'      => trim($p['student_name'] ?? 'Unknown') . ' — ' . ($p['category'] ?: $p['method'] ?: 'General'),
                'amount'      => (float) ($p['amount'] ?? 0),
                'timestamp'   => $isoTime,
            ];
        }

        // 2. Enrollments
        if ($db->tableExists('enrollments')) {
            $enrollments = $db->table('enrollments e')
                ->select("e.id, e.enrollment_date AS event_date,
                          CONCAT(s.first_name, ' ', s.last_name) AS student_name,
                          c.name AS class_name")
                ->join('students s', 's.id = e.student_id', 'left')
                ->join('classes c', 'c.id = e.class_id', 'left')
                ->where('e.tenant_id', $tenantId)
                ->orderBy('e.enrollment_date', 'DESC')
                ->limit($limit)
                ->get()
                ->getResultArray();

            foreach ($enrollments as $e) {
                $isoTime = null;
                if (!empty($e['event_date'])) {
                    try {
                        $dt = new \DateTimeImmutable($e['event_date']);
                        $isoTime = $dt->setTimezone(new \DateTimeZone(app_timezone()))->format(DATE_ATOM);
                    } catch (\Throwable $e2) {
                        $isoTime = null;
                    }
                }
                $activities[] = [
                    'id'          => 'enr_' . $e['id'],
                    'type'        => 'enrollment',
                    'description' => 'Student enrolled',
                    'detail'      => trim($e['student_name'] ?? 'Unknown') . ($e['class_name'] ? ' — ' . $e['class_name'] : ''),
                    'amount'      => null,
                    'timestamp'   => $isoTime,
                ];
            }
        }

        // 3. Student Status Changes
        if ($db->tableExists('student_status_history')) {
            $statusChanges = $db->table('student_status_history ssh')
                ->select("ssh.id, ssh.new_status AS status, ssh.reason, ssh.created_at AS event_date,
                          CONCAT(s.first_name, ' ', s.last_name) AS student_name")
                ->join('students s', 's.id = ssh.student_id', 'left')
                ->where('ssh.tenant_id', $tenantId)
                ->orderBy('ssh.created_at', 'DESC')
                ->limit($limit)
                ->get()
                ->getResultArray();

            foreach ($statusChanges as $s) {
                $isoTime = null;
                if (!empty($s['event_date'])) {
                    try {
                        $dt = new \DateTimeImmutable($s['event_date']);
                        $isoTime = $dt->setTimezone(new \DateTimeZone(app_timezone()))->format(DATE_ATOM);
                    } catch (\Throwable $e3) {
                        $isoTime = null;
                    }
                }
                $activities[] = [
                    'id'          => 'stat_' . $s['id'],
                    'type'        => 'status_change',
                    'description' => 'Student status changed to ' . $s['status'],
                    'detail'      => trim($s['student_name'] ?? 'Unknown') . ($s['reason'] ? ' — Reason: ' . $s['reason'] : ''),
                    'amount'      => null,
                    'timestamp'   => $isoTime,
                ];
            }
        }

        // 4. Leave Requests
        if ($db->tableExists('leave_requests')) {
            $leaveRequests = $db->table('leave_requests lr')
                ->select("lr.id, lr.status, lr.leave_type, lr.updated_at AS event_date,
                          CONCAT(st.first_name, ' ', st.last_name) AS staff_name")
                ->join('staff st', 'st.id = lr.staff_id', 'left')
                ->where('lr.tenant_id', $tenantId)
                ->whereIn('lr.status', ['approved', 'rejected'])
                ->orderBy('lr.updated_at', 'DESC')
                ->limit($limit)
                ->get()
                ->getResultArray();

            foreach ($leaveRequests as $l) {
                $isoTime = null;
                if (!empty($l['event_date'])) {
                    try {
                        $dt = new \DateTimeImmutable($l['event_date']);
                        $isoTime = $dt->setTimezone(new \DateTimeZone(app_timezone()))->format(DATE_ATOM);
                    } catch (\Throwable $e4) {
                        $isoTime = null;
                    }
                }
                $activities[] = [
                    'id'          => 'lv_' . $l['id'],
                    'type'        => 'leave',
                    'description' => 'Leave request ' . $l['status'],
                    'detail'      => trim($l['staff_name'] ?? 'Unknown') . ' — ' . str_replace('_', ' ', $l['leave_type']),
                    'amount'      => null,
                    'timestamp'   => $isoTime,
                ];
            }
        }

        // Sort by timestamp DESC
        usort($activities, function ($a, $b) {
            $ta = !empty($a['timestamp']) ? strtotime($a['timestamp']) : 0;
            $tb = !empty($b['timestamp']) ? strtotime($b['timestamp']) : 0;
            return $tb <=> $ta;
        });

        // Slice to limit
        $activities = array_slice($activities, 0, $limit);

        return $this->success(['activities' => $activities]);
    }
}
