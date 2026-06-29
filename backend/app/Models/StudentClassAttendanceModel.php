<?php

namespace App\Models;

use CodeIgniter\Model;

class StudentClassAttendanceModel extends Model
{
    protected $table            = 'student_attendance_events';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $allowedFields    = [
        'id', 'tenant_id', 'student_id', 'class_instance_id', 'class_id',
        'academic_session', 'date', 'period_key', 'status', 'is_effective',
        'submitted_by', 'submitted_at', 'remarks', 'created_at',
    ];

    /**
     * Fetch all effective records for a class on a given date.
     * When periodKey is provided, filters to that period only.
     * When periodKey is null, returns all effective rows for the date (all periods or per-day).
     */
    public function getEffectiveForClassDate(
        string  $tenantId,
        string  $classId,
        string  $date,
        ?string $periodKey = null
    ): array {
        $builder = $this->db->table('student_attendance_events sae')
            ->select('sae.*, s.first_name, s.last_name')
            ->join('students s', 's.id = sae.student_id')
            ->where('sae.tenant_id', $tenantId)
            ->where('sae.class_id', $classId)
            ->where('sae.date', $date)
            ->where('sae.is_effective', 1);

        if ($periodKey !== null) {
            $builder->where('sae.period_key', $periodKey);
        }

        return $builder->orderBy('s.last_name', 'ASC')
                       ->orderBy('s.first_name', 'ASC')
                       ->get()
                       ->getResultArray();
    }

    /**
     * Return ALL events (effective + superseded) for a given
     * student/class/date tuple — used by the audit log endpoint.
     */
    public function getAuditLog(
        string  $tenantId,
        string  $studentId,
        string  $classId,
        string  $date,
        ?string $periodKey = null
    ): array {
        $builder = $this->db->table('student_attendance_events')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('class_id', $classId)
            ->where('date', $date);

        if ($periodKey !== null) {
            $builder->where('period_key', $periodKey);
        } else {
            $builder->where('period_key IS NULL', null, false);
        }

        return $builder->orderBy('submitted_at', 'ASC')->get()->getResultArray();
    }

    /**
     * Mark all currently-effective rows for the given tuple as superseded
     * (is_effective = 0). Called within a DB transaction before inserting a
     * corrected row.
     */
    public function cascadeIsEffective(
        string  $tenantId,
        string  $studentId,
        string  $classId,
        string  $date,
        ?string $periodKey = null
    ): void {
        $builder = $this->db->table('student_attendance_events')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('class_id', $classId)
            ->where('date', $date)
            ->where('is_effective', 1);

        if ($periodKey !== null) {
            $builder->where('period_key', $periodKey);
        } else {
            $builder->where('period_key IS NULL', null, false);
        }

        $builder->update(['is_effective' => 0]);
    }

    /**
     * Aggregate attendance counts per student for a class over a date range.
     * Returns one row per student with status counts and attendance rate.
     * Only includes students with ACTIVE enrollment in the class and ACTIVE student status.
     */
    public function aggregateByClass(
        string  $tenantId,
        string  $classId,
        string  $startDate,
        string  $endDate,
        ?string $search = null
    ): array {
        $sql = "
            SELECT
                s.id                                                             AS student_id,
                CONCAT(s.first_name, ' ', s.last_name)                          AS student_name,
                s.admission_number,
                COALESCE(SUM(CASE WHEN sae.status = 'present'  THEN 1 ELSE 0 END), 0) AS present_days,
                COALESCE(SUM(CASE WHEN sae.status = 'absent'   THEN 1 ELSE 0 END), 0) AS absent_days,
                COALESCE(SUM(CASE WHEN sae.status = 'late'     THEN 1 ELSE 0 END), 0) AS late_days,
                COALESCE(SUM(CASE WHEN sae.status = 'excused'  THEN 1 ELSE 0 END), 0) AS excused_days,
                COALESCE(SUM(CASE WHEN sae.status = 'half_day' THEN 1 ELSE 0 END), 0) AS half_day_days,
                COUNT(sae.id)                                                    AS total_days
            FROM students s
            LEFT JOIN student_attendance_events sae
                ON  sae.student_id = s.id
                AND sae.tenant_id  = s.tenant_id
                AND sae.class_id  = ?
                AND sae.date BETWEEN ? AND ?
                AND sae.is_effective = 1
            WHERE s.tenant_id = ?
              AND s.status    = 'active'
              AND EXISTS (
                  SELECT 1 FROM enrollments e
                  WHERE e.student_id = s.id
                    AND e.tenant_id  = ?
                    AND e.status     = 'ACTIVE'
                    AND e.class_id   = ?
              )
        ";
        $bindings = [$classId, $startDate, $endDate, $tenantId, $tenantId, $classId];

        if ($search !== null && trim($search) !== '') {
            $like = '%' . trim($search) . '%';
            $sql .= " AND (s.first_name LIKE ? OR s.last_name LIKE ?
                          OR CONCAT(s.first_name,' ',s.last_name) LIKE ?
                          OR s.admission_number LIKE ?)";
            array_push($bindings, $like, $like, $like, $like);
        }

        $sql .= ' GROUP BY s.id, s.first_name, s.last_name, s.admission_number
                  ORDER BY s.last_name, s.first_name';

        return $this->db->query($sql, $bindings)->getResultArray();
    }

    /**
     * Aggregate attendance counts per student for a given academic session.
     * Optionally filter by a date range within the session.
     */
    public function aggregateByStudentSession(
        string  $tenantId,
        string  $studentId,
        string  $academicSession,
        ?string $startDate = null,
        ?string $endDate   = null
    ): array {
        $sql = "
            SELECT
                sae.class_instance_id,
                sae.class_id,
                c.name                                                          AS class_name,
                sae.academic_session                                            AS academic_year,
                COALESCE(SUM(CASE WHEN sae.status = 'present'  THEN 1 ELSE 0 END), 0) AS present_days,
                COALESCE(SUM(CASE WHEN sae.status = 'absent'   THEN 1 ELSE 0 END), 0) AS absent_days,
                COALESCE(SUM(CASE WHEN sae.status = 'late'     THEN 1 ELSE 0 END), 0) AS late_days,
                COALESCE(SUM(CASE WHEN sae.status = 'excused'  THEN 1 ELSE 0 END), 0) AS excused_days,
                COALESCE(SUM(CASE WHEN sae.status = 'half_day' THEN 1 ELSE 0 END), 0) AS half_day_days,
                COUNT(sae.id)                                                    AS total_days
            FROM student_attendance_events sae
            LEFT JOIN classes c ON c.id = sae.class_id
            WHERE sae.tenant_id        = ?
              AND sae.student_id       = ?
              AND sae.academic_session = ?
              AND sae.is_effective     = 1
        ";
        $bindings = [$tenantId, $studentId, $academicSession];

        if ($startDate !== null) {
            $sql .= ' AND sae.date >= ?';
            $bindings[] = $startDate;
        }
        if ($endDate !== null) {
            $sql .= ' AND sae.date <= ?';
            $bindings[] = $endDate;
        }

        $sql .= ' GROUP BY sae.class_instance_id, sae.class_id, c.name, sae.academic_session';

        return $this->db->query($sql, $bindings)->getResultArray();
    }

    /**
     * Session-level rollup: one row per class for the given academic session.
     */
    public function aggregateBySession(string $tenantId, string $academicSession): array
    {
        return $this->db->query("
            SELECT
                sae.class_instance_id,
                sae.class_id,
                c.name                                                                AS class_name,
                sae.academic_session                                                  AS academic_year,
                COUNT(DISTINCT sae.student_id)                                        AS total_students,
                COUNT(sae.id)                                                          AS total_days_recorded,
                COALESCE(SUM(CASE WHEN sae.status IN ('present','late') THEN 1 ELSE 0 END), 0) AS attended_days
            FROM student_attendance_events sae
            LEFT JOIN classes c ON c.id = sae.class_id
            WHERE sae.tenant_id        = ?
              AND sae.academic_session = ?
              AND sae.is_effective     = 1
            GROUP BY sae.class_instance_id, sae.class_id, c.name, sae.academic_session
            ORDER BY c.name
        ", [$tenantId, $academicSession])->getResultArray();
    }
}
