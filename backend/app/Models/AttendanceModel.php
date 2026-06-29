<?php

namespace App\Models;

use CodeIgniter\Model;

class AttendanceModel extends Model
{
    protected $table      = 'staff_attendance';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $allowedFields = [
        'id', 'tenant_id', 'staff_id', 'date',
        'check_in', 'check_out', 'status', 'work_hours', 'overtime_hours',
        'remarks', 'comment', 'source', 'created_at', 'updated_at',
    ];

    /**
     * Return per-staff attendance counts for a given month (YYYY-MM).
     * Uses a LEFT JOIN so staff with zero records in the month still appear.
     */
    public function getMonthlySummary(string $yearMonth, string $tenantId): array
    {
        $startDate = $yearMonth . '-01';
        $endDate   = date('Y-m-t', strtotime($startDate)); // last day of month

        return $this->db->query("
            SELECT
                s.id           AS staff_id,
                s.first_name,
                s.last_name,
                s.department,
                COUNT(a.id)    AS total_days,
                SUM(CASE WHEN a.status = 'present'          THEN 1 ELSE 0 END) AS present_days,
                SUM(CASE WHEN a.status = 'absent'           THEN 1 ELSE 0 END) AS absent_days,
                SUM(CASE WHEN a.status = 'late'             THEN 1 ELSE 0 END) AS late_days,
                SUM(CASE WHEN a.status = 'on_leave'         THEN 1 ELSE 0 END) AS on_leave_days,
                SUM(CASE WHEN a.status = 'half_day'         THEN 1 ELSE 0 END) AS half_day_days,
                SUM(CASE WHEN a.status = 'early_departure'  THEN 1 ELSE 0 END) AS early_departure_days,
                SUM(CASE WHEN a.status = 'excused'          THEN 1 ELSE 0 END) AS excused_days,
                COALESCE(SUM(a.work_hours), 0)     AS total_work_hours,
                COALESCE(SUM(a.overtime_hours), 0) AS total_overtime_hours
            FROM staff s
            LEFT JOIN staff_attendance a
                ON  s.id        = a.staff_id
                AND a.tenant_id = s.tenant_id
                AND a.date BETWEEN ? AND ?
            WHERE s.tenant_id         = ?
              AND s.employment_status = 'active'
            GROUP BY s.id, s.first_name, s.last_name, s.department
            ORDER BY s.last_name, s.first_name
        ", [$startDate, $endDate, $tenantId])->getResultArray();
    }

    /**
     * Return all active staff with today's attendance record (if any).
     * Rows where attendance_id IS NULL represent unchecked staff.
     */
    public function getTodayAttendance(string $tenantId): array
    {
        $today = date('Y-m-d');

        return $this->db->query("
            SELECT
                s.id           AS staff_id,
                s.first_name,
                s.last_name,
                s.department,
                a.id           AS attendance_id,
                a.check_in     AS check_in_time,
                a.check_out    AS check_out_time,
                a.status,
                a.comment
            FROM staff s
            LEFT JOIN staff_attendance a
                ON  s.id        = a.staff_id
                AND a.tenant_id = s.tenant_id
                AND a.date      = ?
            WHERE s.tenant_id         = ?
              AND s.employment_status = 'active'
            ORDER BY s.department, s.last_name
        ", [$today, $tenantId])->getResultArray();
    }

    public function getClassAttendanceSummary(
        string $tenantId,
        string $classId,
        string $startDate,
        string $endDate,
        ?string $search = null,
        ?string $sortBy = 'name',
        ?string $sortOrder = 'asc'
    ): array {
        $orderColumns = [
            'name' => 'studentName',
            'presentDays' => 'presentDays',
            'attendancePercentage' => 'presentDays',
        ];
        $orderColumn = $orderColumns[$sortBy ?? 'name'] ?? 'studentName';
        $direction = strtolower($sortOrder ?? 'asc') === 'desc' ? 'DESC' : 'ASC';

        $sql = "
            SELECT
                s.id AS studentId,
                CONCAT(s.first_name, ' ', s.last_name) AS studentName,
                COALESCE(SUM(CASE WHEN sa.status = 'present' THEN 1 ELSE 0 END), 0) AS presentDays,
                COALESCE(SUM(CASE WHEN sa.status = 'absent' THEN 1 ELSE 0 END), 0) AS absentDays,
                COALESCE(SUM(CASE WHEN sa.status = 'late' THEN 1 ELSE 0 END), 0) AS lateDays,
                COALESCE(SUM(CASE WHEN sa.status = 'excused' THEN 1 ELSE 0 END), 0) AS excusedDays
            FROM students s
            LEFT JOIN student_attendance sa
                ON sa.student_id = s.id
                AND sa.tenant_id = s.tenant_id
                AND sa.date BETWEEN ? AND ?
            WHERE s.tenant_id = ?
              AND s.class_id = ?
              AND s.status = 'active'
        ";
        $bindings = [$startDate, $endDate, $tenantId, $classId];

        if ($search !== null && trim($search) !== '') {
            $sql .= "
              AND (
                s.first_name LIKE ?
                OR s.last_name LIKE ?
                OR CONCAT(s.first_name, ' ', s.last_name) LIKE ?
                OR s.admission_number LIKE ?
              )
            ";
            $searchLike = '%' . trim($search) . '%';
            array_push($bindings, $searchLike, $searchLike, $searchLike, $searchLike);
        }

        $sql .= "
            GROUP BY s.id, s.first_name, s.last_name
            ORDER BY {$orderColumn} {$direction}
        ";

        return array_map(static fn(array $row): array => [
            'studentId' => $row['studentId'],
            'studentName' => $row['studentName'],
            'presentDays' => (int) $row['presentDays'],
            'absentDays' => (int) $row['absentDays'],
            'lateDays' => (int) $row['lateDays'],
            'excusedDays' => (int) $row['excusedDays'],
        ], $this->db->query($sql, $bindings)->getResultArray());
    }

    /**
     * Per-staff attendance aggregation over a date range.
     * Optional department and staff_id filters.
     * Returns one row per staff member.
     */
    public function getPeriodReport(
        string  $tenantId,
        string  $startDate,
        string  $endDate,
        ?string $department  = null,
        ?string $staffId     = null,
        int     $workingDays = 0
    ): array {
        $sql = "
            SELECT
                s.id            AS staff_id,
                s.first_name,
                s.last_name,
                s.department,
                COUNT(a.id)     AS total_days,
                SUM(CASE WHEN a.status = 'present'         THEN 1 ELSE 0 END) AS present_days,
                SUM(CASE WHEN a.status = 'absent'          THEN 1 ELSE 0 END) AS absent_days,
                SUM(CASE WHEN a.status = 'late'            THEN 1 ELSE 0 END) AS late_days,
                SUM(CASE WHEN a.status = 'on_leave'        THEN 1 ELSE 0 END) AS on_leave_days,
                SUM(CASE WHEN a.status = 'half_day'        THEN 1 ELSE 0 END) AS half_day_days,
                SUM(CASE WHEN a.status = 'early_departure' THEN 1 ELSE 0 END) AS early_departure_days,
                COALESCE(SUM(a.work_hours), 0)     AS total_work_hours,
                COALESCE(SUM(a.overtime_hours), 0) AS total_overtime_hours,
                EXISTS(
                    SELECT 1 FROM leave_requests lr
                    WHERE lr.tenant_id  = s.tenant_id
                      AND lr.staff_id   = s.id
                      AND lr.status     = 'approved'
                      AND lr.start_date <= ?
                      AND lr.end_date   >= ?
                ) AS is_on_active_leave
            FROM staff s
            LEFT JOIN staff_attendance a
                ON  a.staff_id  = s.id
                AND a.tenant_id = s.tenant_id
                AND a.date BETWEEN ? AND ?
            WHERE s.tenant_id         = ?
              AND s.employment_status = 'active'
        ";
        $bindings = [$endDate, $startDate, $startDate, $endDate, $tenantId];

        if ($department !== null) {
            $sql .= ' AND s.department = ?';
            $bindings[] = $department;
        }
        if ($staffId !== null) {
            $sql .= ' AND s.id = ?';
            $bindings[] = $staffId;
        }

        $sql .= ' GROUP BY s.id, s.first_name, s.last_name, s.department ORDER BY s.last_name, s.first_name';

        $rows = $this->db->query($sql, $bindings)->getResultArray();

        return array_map(function (array $row) use ($workingDays) {
            $present        = (int) $row['present_days'];
            $late           = (int) $row['late_days'];
            $onLeave        = (int) $row['on_leave_days'];
            $attended       = $present + $late;
            $effectiveDays  = $workingDays > 0 ? max($workingDays - $onLeave, 1) : max((int) $row['total_days'] - $onLeave, 1);
            return [
                'staffId'            => $row['staff_id'],
                'firstName'          => $row['first_name'],
                'lastName'           => $row['last_name'],
                'department'         => $row['department'],
                'totalDays'          => (int) $row['total_days'],
                'present'            => $present,
                'absent'             => (int) $row['absent_days'],
                'late'               => $late,
                'onLeave'            => $onLeave,
                'halfDay'            => (int) $row['half_day_days'],
                'earlyDeparture'     => (int) $row['early_departure_days'],
                'totalWorkHours'     => (float) $row['total_work_hours'],
                'totalOvertimeHours' => (float) $row['total_overtime_hours'],
                'isOnActiveLeave'    => (bool) $row['is_on_active_leave'],
                'attendanceRate'     => ($workingDays > 0 || (int) $row['total_days'] > 0)
                    ? round($attended / $effectiveDays * 100, 1)
                    : 0.0,
            ];
        }, $rows);
    }

    public function getFilteredRecordsSummary(string $tenantId, array $filters): array
    {
        $builder = $this->db->table('staff_attendance sa')
            ->select("
                COUNT(sa.id) AS total_records,
                SUM(CASE WHEN sa.status = 'present' THEN 1 ELSE 0 END) AS present_count,
                SUM(CASE WHEN sa.status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
                SUM(CASE WHEN sa.status = 'late' THEN 1 ELSE 0 END) AS late_count,
                SUM(CASE WHEN sa.status = 'on_leave' THEN 1 ELSE 0 END) AS on_leave_count,
                SUM(CASE WHEN sa.status = 'early_departure' THEN 1 ELSE 0 END) AS early_departure_count,
                SUM(CASE WHEN sa.status = 'half_day' THEN 1 ELSE 0 END) AS half_day_count,
                COALESCE(SUM(sa.overtime_hours), 0) AS total_overtime_hours
            ", false)
            ->join('staff s', 's.id = sa.staff_id AND s.tenant_id = sa.tenant_id', 'left')
            ->where('sa.tenant_id', $tenantId);

        if (!empty($filters['status']) && $filters['status'] !== 'all') {
            $builder->where('sa.status', $filters['status']);
        }

        if (!empty($filters['staffId'])) {
            $builder->where('sa.staff_id', $filters['staffId']);
        }

        if (!empty($filters['department'])) {
            $builder->where('s.department', $filters['department']);
        }

        if (!empty($filters['startDate'])) {
            $builder->where('sa.date >=', $filters['startDate']);
        }

        if (!empty($filters['endDate'])) {
            $builder->where('sa.date <=', $filters['endDate']);
        }

        if (!empty($filters['search'])) {
            $builder->groupStart()
                ->like('s.first_name', $filters['search'])
                ->orLike('s.last_name', $filters['search'])
                ->orLike("CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))", $filters['search'], 'both', null, true)
                ->groupEnd();
        }

        $row = $builder->get()->getRowArray() ?? [];
        $total = (int) ($row['total_records'] ?? 0);
        $present = (int) ($row['present_count'] ?? 0);
        $late = (int) ($row['late_count'] ?? 0);

        return [
            'present' => $present,
            'absent' => (int) ($row['absent_count'] ?? 0),
            'late' => $late,
            'onLeave' => (int) ($row['on_leave_count'] ?? 0),
            'earlyDeparture' => (int) ($row['early_departure_count'] ?? 0),
            'halfDay' => (int) ($row['half_day_count'] ?? 0),
            'totalOvertimeHours' => (float) ($row['total_overtime_hours'] ?? 0),
            'attendanceRate' => $total > 0 ? round(($present + $late) / $total * 100, 1) : 0.0,
        ];
    }

    /**
     * Department-level rollup over a date range.
     * Returns one row per department.
     */
    public function getDepartmentReport(
        string $tenantId,
        string $startDate,
        string $endDate,
        int    $workingDays = 0
    ): array {
        $rows = $this->db->query("
            SELECT
                s.department,
                COUNT(DISTINCT s.id)                                            AS staff_count,
                COUNT(a.id)                                                     AS total_days,
                SUM(CASE WHEN a.status = 'present'         THEN 1 ELSE 0 END)  AS present_days,
                SUM(CASE WHEN a.status = 'absent'          THEN 1 ELSE 0 END)  AS absent_days,
                SUM(CASE WHEN a.status = 'late'            THEN 1 ELSE 0 END)  AS late_days,
                SUM(CASE WHEN a.status = 'on_leave'        THEN 1 ELSE 0 END)  AS on_leave_days,
                COALESCE(SUM(a.overtime_hours), 0)                             AS total_overtime_hours
            FROM staff s
            LEFT JOIN staff_attendance a
                ON  a.staff_id  = s.id
                AND a.tenant_id = s.tenant_id
                AND a.date BETWEEN ? AND ?
            WHERE s.tenant_id         = ?
              AND s.employment_status = 'active'
            GROUP BY s.department
            ORDER BY s.department
        ", [$startDate, $endDate, $tenantId])->getResultArray();

        return array_map(function (array $row) use ($workingDays) {
            $staffCount    = (int) $row['staff_count'];
            $present       = (int) $row['present_days'];
            $late          = (int) $row['late_days'];
            $onLeave       = (int) $row['on_leave_days'];
            $attended      = $present + $late;
            $expectedTotal = $workingDays > 0
                ? max($staffCount * $workingDays - $onLeave, 1)
                : max((int) $row['total_days'] - $onLeave, 1);
            return [
                'department'         => $row['department'],
                'staffCount'         => $staffCount,
                'totalDays'          => (int) $row['total_days'],
                'presentDays'        => $present,
                'absentDays'         => (int) $row['absent_days'],
                'lateDays'           => $late,
                'onLeaveDays'        => $onLeave,
                'totalOvertimeHours' => (float) $row['total_overtime_hours'],
                'attendanceRate'     => ($workingDays > 0 || (int) $row['total_days'] > 0)
                    ? round($attended / $expectedTotal * 100, 1)
                    : 0.0,
            ];
        }, $rows);
    }

    public function getBySource(string $tenantId, string $date, string $source): array
    {
        return $this->where('tenant_id', $tenantId)
                    ->where('date', $date)
                    ->where('source', $source)
                    ->findAll();
    }

    /**
     * Upsert an attendance record for today with the given status and comment.
     * Returns the saved row.
     */
    public function updateStatus(
        string  $staffId,
        string  $status,
        ?string $comment,
        string  $tenantId
    ): array {
        $today = date('Y-m-d');
        $now   = date('Y-m-d H:i:s');

        $existing = $this->where('tenant_id', $tenantId)
                         ->where('staff_id', $staffId)
                         ->where('date', $today)
                         ->first();

        if ($existing) {
            $this->update($existing['id'], [
                'status'     => $status,
                'comment'    => $comment,
                'updated_at' => $now,
            ]);
            return array_merge($existing, [
                'status'     => $status,
                'comment'    => $comment,
                'updated_at' => $now,
            ]);
        }

        // Build a new record ID using the same generator pattern as the controller
        $newId = 'sa' . time() . '_' . bin2hex(random_bytes(4));

        $row = [
            'id'         => $newId,
            'tenant_id'  => $tenantId,
            'staff_id'   => $staffId,
            'date'       => $today,
            'status'     => $status,
            'comment'    => $comment,
            'source'     => 'manual',
            'created_at' => $now,
            'updated_at' => $now,
        ];

        $this->insert($row);
        return $row;
    }

    /**
     * Get dynamic filter metadata for staff attendance records.
     * Returns available years, departments, staff members, months, and statuses
     * based on actual data in the database for this tenant.
     */
    public function getFilterMetadata(string $tenantId): array
    {
        // Get distinct years from attendance dates
        $years = $this->db->query("
            SELECT DISTINCT YEAR(date) AS year
            FROM staff_attendance
            WHERE tenant_id = ?
            ORDER BY year DESC
        ", [$tenantId])->getResultArray();

        // Get distinct departments from staff with attendance records
        $departments = $this->db->query("
            SELECT DISTINCT s.department
            FROM staff s
            INNER JOIN staff_attendance sa ON sa.staff_id = s.id AND sa.tenant_id = s.tenant_id
            WHERE s.tenant_id = ?
              AND s.employment_status = 'active'
            ORDER BY s.department
        ", [$tenantId])->getResultArray();

        // Get distinct staff members with attendance records
        $staff = $this->db->query("
            SELECT DISTINCT s.id, CONCAT(s.first_name, ' ', s.last_name) AS name,
                   s.department, s.first_name, s.last_name
            FROM staff s
            INNER JOIN staff_attendance sa ON sa.staff_id = s.id AND sa.tenant_id = s.tenant_id
            WHERE s.tenant_id = ?
              AND s.employment_status = 'active'
            ORDER BY s.last_name, s.first_name
        ", [$tenantId])->getResultArray();

        // Get distinct months with attendance records (as YYYY-MM)
        $months = $this->db->query("
            SELECT DISTINCT DATE_FORMAT(date, '%Y-%m') AS month
            FROM staff_attendance
            WHERE tenant_id = ?
            ORDER BY month DESC
        ", [$tenantId])->getResultArray();

        // Get distinct statuses present in the data
        $statuses = $this->db->query("
            SELECT DISTINCT status
            FROM staff_attendance
            WHERE tenant_id = ?
              AND status IS NOT NULL
            ORDER BY status
        ", [$tenantId])->getResultArray();

        return [
            'years'       => array_column($years, 'year'),
            'departments' => array_column($departments, 'department'),
            'staff'       => array_map(fn($s) => [
                'id'         => $s['id'],
                'name'       => $s['name'],
                'department' => $s['department'],
            ], $staff),
            'months'      => array_column($months, 'month'),
            'statuses'    => array_column($statuses, 'status'),
        ];
    }
}
