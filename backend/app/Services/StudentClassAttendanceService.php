<?php

namespace App\Services;

use App\Models\StudentClassAttendanceModel;

class StudentClassAttendanceService
{
    protected StudentClassAttendanceModel $model;
    protected \CodeIgniter\Database\BaseConnection $db;

    public function __construct()
    {
        $this->model = new StudentClassAttendanceModel();
        $this->db    = \Config\Database::connect();
    }

    // ─────────────────────────────────────────────────────────────────
    // US1: Batch submission
    // ─────────────────────────────────────────────────────────────────

    /**
     * Submit attendance for a batch of students in a class.
     *
     * Returns:
     *   saved        int    — count of rows inserted
     *   skipped      array  — [{studentId, reason}] for non-enrolled students
     *   date         string
     *   classId      string
     *   periodKey    string|null
     */
    public function submitBatch(
        string  $tenantId,
        string  $classId,
        string  $date,
        ?string $periodKey,
        array   $records,
        string  $submittedBy
    ): array {
        // Verify class belongs to tenant
        $class = $this->db->table('classes')
            ->where('id', $classId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$class) {
            throw new \RuntimeException('Class not found', 404);
        }

        // Validate date format and calendar validity first
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new \InvalidArgumentException('Invalid date format. Use YYYY-MM-DD', 400);
        }
        [$y, $m, $d] = array_map('intval', explode('-', $date));
        if (!checkdate($m, $d, $y)) {
            throw new \InvalidArgumentException('Invalid date. Use YYYY-MM-DD with a valid calendar date', 400);
        }

        // Reject future dates
        if ($date > date('Y-m-d')) {
            throw new \InvalidArgumentException('Attendance cannot be submitted for a future date', 400);
        }

        if (empty($records)) {
            throw new \InvalidArgumentException('records array cannot be empty', 422);
        }

        if (count($records) > 200) {
            throw new \InvalidArgumentException('Batch size cannot exceed 200 records', 422);
        }

        // Fetch tenant attendance mode
        $tenant   = $this->db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        $settings = json_decode($tenant['settings'] ?? '{}', true) ?? [];
        $mode     = $settings['studentAttendanceMode'] ?? 'per_day';

        // Validate periodKey vs mode
        if ($mode === 'per_day' && $periodKey !== null) {
            throw new \InvalidArgumentException("periodKey must be null when studentAttendanceMode is 'per_day'", 400);
        }
        if ($mode === 'per_period' && $periodKey === null) {
            throw new \InvalidArgumentException("periodKey is required when studentAttendanceMode is 'per_period'", 400);
        }

        // Validate status values and check for duplicate studentIds in the batch
        $allowedStatuses = ['present', 'absent', 'late', 'excused', 'half_day'];
        $seenStudentIds  = [];
        foreach ($records as $i => $record) {
            $sid = $record['studentId'] ?? null;
            if (!$sid) {
                throw new \InvalidArgumentException("Record at index {$i} is missing studentId", 422);
            }
            if (isset($seenStudentIds[$sid])) {
                throw new \InvalidArgumentException("Duplicate studentId '{$sid}' in batch", 400);
            }
            $seenStudentIds[$sid] = true;

            $status = $record['status'] ?? null;
            if (!in_array($status, $allowedStatuses, true)) {
                throw new \InvalidArgumentException("Invalid status '{$status}' for student '{$sid}'. Allowed: " . implode(', ', $allowedStatuses), 422);
            }
        }

        // Get current academic session from settings
        $settings = $this->db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        $tenantSettings = json_decode($settings['settings'] ?? '{}', true) ?? [];
        $academicSession = $tenantSettings['academicYear'] ?? date('Y') . '/' . (date('Y') + 1);

        $now             = date('Y-m-d H:i:s');
        $saved           = 0;
        $skipped         = [];
        $toInsert        = [];

        foreach ($records as $record) {
            $studentId = $record['studentId'];

            // Verify active enrollment in this class and student is active
            $enrollment = $this->db->table('enrollments')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $studentId)
                ->where('status', 'ACTIVE')
                ->where('class_id', $classId)
                ->get()->getRowArray();

            // Also verify student status is active (not inactive, transferred, graduated, suspended, archived)
            $student = $this->db->table('students')
                ->where('id', $studentId)
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->get()->getRowArray();

            if (!$enrollment || !$student) {
                $skipped[] = ['studentId' => $studentId, 'reason' => 'not_enrolled_or_inactive'];
                continue;
            }

            $toInsert[] = [
                'studentId'  => $studentId,
                'status'     => $record['status'],
                'remarks'    => isset($record['remarks']) ? substr((string) $record['remarks'], 0, 500) : null,
            ];
        }

        if (!empty($toInsert)) {
            $this->db->transStart();

            foreach ($toInsert as $item) {
                // Cascade prior effective row for this exact tuple
                $this->model->cascadeIsEffective(
                    $tenantId,
                    $item['studentId'],
                    $classId,
                    $date,
                    $periodKey
                );

                // Insert new immutable event (class_instance_id is now nullable)
                $this->model->insert([
                    'id'                => 'sae_' . time() . '_' . bin2hex(random_bytes(4)),
                    'tenant_id'         => $tenantId,
                    'student_id'        => $item['studentId'],
                    'class_instance_id' => null, // No longer required
                    'class_id'          => $classId,
                    'academic_session'  => $academicSession,
                    'date'              => $date,
                    'period_key'        => $periodKey,
                    'status'            => $item['status'],
                    'is_effective'      => 1,
                    'submitted_by'      => $submittedBy,
                    'submitted_at'      => $now,
                    'remarks'           => $item['remarks'],
                    'created_at'        => $now,
                ]);

                $saved++;
            }

            $this->db->transComplete();

            if (!$this->db->transStatus()) {
                throw new \RuntimeException('Database transaction failed', 500);
            }
        }

        return [
            'saved'           => $saved,
            'skipped'         => $skipped,
            'date'            => $date,
            'classId'         => $classId,
            'periodKey'       => $periodKey,
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    // US1: Read effective register
    // ─────────────────────────────────────────────────────────────────

    /**
     * Return the current effective attendance register for a class on a date.
     */
    public function getEffectiveRegister(
        string  $tenantId,
        string  $classId,
        string  $date,
        ?string $periodKey = null
    ): array {
        $rows = $this->model->getEffectiveForClassDate($tenantId, $classId, $date, $periodKey);

        $records = array_map(fn(array $r): array => [
            'id'          => $r['id'],
            'studentId'   => $r['student_id'],
            'studentName' => $r['first_name'] . ' ' . $r['last_name'],
            'status'      => $r['status'],
            'remarks'     => $r['remarks'] ?? '',
            'submittedBy' => $r['submitted_by'],
            'submittedAt' => $r['submitted_at'],
        ], $rows);

        $counts = array_count_values(array_column($rows, 'status'));

        return [
            'classId'         => $classId,
            'date'            => $date,
            'periodKey'       => $periodKey,
            'records'         => $records,
            'totalStudents'   => count($records),
            'presentCount'    => (int) ($counts['present']  ?? 0),
            'absentCount'     => (int) ($counts['absent']   ?? 0),
            'lateCount'       => (int) ($counts['late']     ?? 0),
            'excusedCount'    => (int) ($counts['excused']  ?? 0),
            'halfDayCount'    => (int) ($counts['half_day'] ?? 0),
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    // US2: Per-period daily derived status helper
    // ─────────────────────────────────────────────────────────────────

    /**
     * Derive a single daily status from multiple period rows for one student.
     * Priority: absent > excused > late > half_day > present
     */
    public function getDailyDerivedStatus(array $periodRows): string
    {
        $statuses = array_column($periodRows, 'status');
        if (in_array('absent',   $statuses, true)) return 'absent';
        if (in_array('excused',  $statuses, true)) return 'excused';
        if (in_array('late',     $statuses, true)) return 'late';
        if (in_array('half_day', $statuses, true)) return 'half_day';
        return 'present';
    }

    // ─────────────────────────────────────────────────────────────────
    // US3: Aggregation
    // ─────────────────────────────────────────────────────────────────

    /**
     * Per-student attendance summary for a session (optionally date-scoped).
     */
    public function getStudentSummary(
        string  $tenantId,
        string  $studentId,
        string  $academicSession,
        ?string $startDate = null,
        ?string $endDate   = null
    ): array {
        // Verify student belongs to tenant
        $student = $this->db->table('students')
            ->select('id, first_name, last_name')
            ->where('id', $studentId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$student) {
            throw new \RuntimeException('Student not found', 404);
        }

        $rows = $this->model->aggregateByStudentSession($tenantId, $studentId, $academicSession, $startDate, $endDate);

        $totalDays = 0;
        $present   = 0;
        $absent    = 0;
        $late      = 0;
        $excused   = 0;
        $halfDay   = 0;
        $breakdown = [];

        foreach ($rows as $r) {
            $p  = (int) $r['present_days'];
            $ab = (int) $r['absent_days'];
            $l  = (int) $r['late_days'];
            $ex = (int) $r['excused_days'];
            $hd = (int) $r['half_day_days'];
            $td = (int) $r['total_days'];

            $totalDays += $td;
            $present   += $p;
            $absent    += $ab;
            $late      += $l;
            $excused   += $ex;
            $halfDay   += $hd;

            $breakdown[] = [
                'classId'         => $r['class_id'],
                'classInstanceId' => $r['class_instance_id'],
                'className'       => $r['class_name'],
                'academicYear'    => $r['academic_year'],
                'totalDays'       => $td,
                'present'         => $p,
                'absent'          => $ab,
                'late'            => $l,
                'excused'         => $ex,
                'halfDay'         => $hd,
                'attendanceRate'  => $td > 0 ? round(($p + $l) / $td * 100, 1) : 0.0,
            ];
        }

        return [
            'studentId'       => $studentId,
            'studentName'     => $student['first_name'] . ' ' . $student['last_name'],
            'academicSession' => $academicSession,
            'startDate'       => $startDate,
            'endDate'         => $endDate,
            'totalDays'       => $totalDays,
            'present'         => $present,
            'absent'          => $absent,
            'late'            => $late,
            'excused'         => $excused,
            'halfDay'         => $halfDay,
            'attendanceRate'  => $totalDays > 0 ? round(($present + $late) / $totalDays * 100, 1) : 0.0,
            'classBreakdown'  => $breakdown,
        ];
    }

    /**
     * Per-class attendance summary over a date range.
     */
    public function getClassSummary(
        string  $tenantId,
        string  $classId,
        string  $startDate,
        string  $endDate,
        ?string $search = null
    ): array {
        $class = $this->db->table('classes')
            ->select('id, name AS class_name')
            ->where('id', $classId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$class) {
            throw new \RuntimeException('Class not found', 404);
        }

        // Get current academic session for response context
        $settings = $this->db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        $tenantSettings = json_decode($settings['settings'] ?? '{}', true) ?? [];
        $academicSession = $tenantSettings['academicYear'] ?? date('Y') . '/' . (date('Y') + 1);

        $rows = $this->model->aggregateByClass($tenantId, $classId, $startDate, $endDate, $search);

        $students        = [];
        $totalRate       = 0.0;
        $studentCount    = 0;

        foreach ($rows as $r) {
            $td   = (int) $r['total_days'];
            $p    = (int) $r['present_days'];
            $l    = (int) $r['late_days'];
            $rate = $td > 0 ? round(($p + $l) / $td * 100, 1) : 0.0;

            $students[] = [
                'studentId'       => $r['student_id'],
                'studentName'     => $r['student_name'],
                'admissionNumber' => $r['admission_number'],
                'totalDays'       => $td,
                'present'         => $p,
                'absent'          => (int) $r['absent_days'],
                'late'            => $l,
                'excused'         => (int) $r['excused_days'],
                'halfDay'         => (int) $r['half_day_days'],
                'attendanceRate'  => $rate,
            ];

            $totalRate    += $rate;
            $studentCount++;
        }

        return [
            'classId'             => $classId,
            'className'           => $class['class_name'],
            'academicSession'     => $academicSession,
            'startDate'           => $startDate,
            'endDate'             => $endDate,
            'classAttendanceRate' => $studentCount > 0 ? round($totalRate / $studentCount, 1) : 0.0,
            'totalStudents'       => $studentCount,
            'students'            => $students,
        ];
    }

    /**
     * Session-level rollup: one row per class for the given academic session.
     */
    public function getSessionSummary(string $tenantId, string $academicSession): array
    {
        $rows    = $this->model->aggregateBySession($tenantId, $academicSession);
        $classes = [];

        foreach ($rows as $r) {
            $total    = (int) $r['total_days_recorded'];
            $attended = (int) $r['attended_days'];

            $classes[] = [
                'classId'            => $r['class_id'],
                'classInstanceId'    => $r['class_instance_id'],
                'className'          => $r['class_name'],
                'academicYear'       => $r['academic_year'],
                'totalStudents'      => (int) $r['total_students'],
                'totalDaysRecorded'  => $total,
                'classAttendanceRate' => $total > 0 ? round($attended / $total * 100, 1) : 0.0,
            ];
        }

        return [
            'academicSession' => $academicSession,
            'classes'         => $classes,
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    // US4: Audit log
    // ─────────────────────────────────────────────────────────────────

    /**
     * Return all events (including superseded) for a given student/class/date tuple.
     */
    public function getAuditLog(
        string  $tenantId,
        string  $studentId,
        string  $classId,
        string  $date,
        ?string $periodKey = null
    ): array {
        $rows = $this->model->getAuditLog($tenantId, $studentId, $classId, $date, $periodKey);

        return [
            'studentId'       => $studentId,
            'classId'         => $classId,
            'date'            => $date,
            'periodKey'       => $periodKey,
            'events'          => array_map(fn(array $r): array => [
                'id'          => $r['id'],
                'status'      => $r['status'],
                'isEffective' => (bool) $r['is_effective'],
                'submittedBy' => $r['submitted_by'],
                'submittedAt' => $r['submitted_at'],
                'remarks'     => $r['remarks'] ?? '',
            ], $rows),
        ];
    }
}
