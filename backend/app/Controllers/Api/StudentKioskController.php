<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;
use App\Models\StudentClassAttendanceModel;

/**
 * StudentKioskController
 *
 * Handles public kiosk endpoints for student attendance marking by teachers.
 * These endpoints are intentionally exempt from JWTAuthFilter because the
 * kiosk page must be accessible without an authenticated session.
 *
 * Security model:
 * - All requests must supply a valid kiosk_code. The kiosk_code is an opaque
 *   10-character alphanumeric token stored in tenants.settings — it does not
 *   expose the internal tenant UUID.
 * - Write actions additionally require the teacher's employee_id, which must
 *   belong to an active, teaching staff member in the resolved tenant.
 * - Kiosk mode must be enabled in tenant settings for any data to be returned.
 * - Error messages for invalid employee IDs deliberately avoid distinguishing
 *   "not found" from "inactive" or "non-teaching" to prevent staff enumeration.
 *
 * Constitution Principle III justified exception — same pattern as the staff
 * kiosk (specs/006, 010). See specs/011-student-kiosk-attendance/plan.md
 * Complexity Tracking for documentation.
 */
class StudentKioskController extends BaseApiController
{
    protected $db;

    public function __construct()
    {
        $this->db = Config::connect();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/kiosk/student-attendance/status/:code
    // ──────────────────────────────────────────────────────────────────────────

    public function status($code = null)
    {
        $tenant = $this->resolveTenant($code);

        if ($tenant === null) {
            return $this->notFound('Kiosk not found');
        }

        $settings     = json_decode($tenant['settings'] ?? '{}', true) ?? [];
        $kioskEnabled = (bool) ($settings['studentKioskModeEnabled'] ?? false);
        $schoolName   = $settings['schoolName'] ?? '';

        return $this->success([
            'kioskEnabled' => $kioskEnabled,
            'schoolName'   => $schoolName,
            'date'         => date('Y-m-d'),
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/kiosk/student-attendance/validate-teacher
    // ──────────────────────────────────────────────────────────────────────────

    public function validateTeacher()
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        $kioskCode  = $data['kiosk_code']   ?? null;
        $employeeId = $data['employee_id']  ?? null;

        if (empty($kioskCode)) {
            return $this->error('kiosk_code is required', 400);
        }
        if (empty($employeeId)) {
            return $this->error('employee_id is required', 400);
        }

        $tenant = $this->resolveTenant($kioskCode);
        if ($tenant === null) {
            return $this->forbidden('Employee ID not recognized');
        }

        $tenantId     = $tenant['id'];
        $settings     = json_decode($tenant['settings'] ?? '{}', true) ?? [];
        $kioskEnabled = (bool) ($settings['studentKioskModeEnabled'] ?? false);

        if (!$kioskEnabled) {
            return $this->forbidden('Kiosk mode is not enabled for this school');
        }

        // Validate teacher: active + is_teaching
        $staff = $this->db->table('staff')
            ->where('employee_id', $employeeId)
            ->where('tenant_id', $tenantId)
            ->where('employment_status', 'active')
            ->where('is_teaching', 1)
            ->get()->getRowArray();

        // Unified 403 for not found, inactive, or non-teaching — prevents enumeration
        if (!$staff) {
            return $this->forbidden('Employee ID not recognized');
        }

        $staffId     = $staff['id'];
        $teacherName = trim($staff['first_name'] . ' ' . $staff['last_name']);
        $today       = date('Y-m-d');

        // Get assigned classes (non-archived)
        $classes = $this->db->table('classes')
            ->where('teacher_id', $staffId)
            ->where('tenant_id', $tenantId)
            ->where('archived_at IS NULL')
            ->orderBy('name', 'ASC')
            ->get()->getResultArray();

        // Build class list with student counts and attendance-recorded flags
        $classList = [];
        foreach ($classes as $class) {
            $classId = $class['id'];

            // Count active students
            $studentCount = (int) ($this->db->table('students s')
                ->select('COUNT(*) as cnt')
                ->join('enrollments e', 'e.id = s.current_enrollment_id')
                ->where('s.class_id', $classId)
                ->where('s.tenant_id', $tenantId)
                ->where('s.status', 'active')
                ->where('e.status', 'active')
                ->get()->getRow()->cnt ?? 0);

            // Check if attendance has been recorded today for this class (effective events)
            $attendanceCount = (int) ($this->db->table('student_attendance_events')
                ->select('COUNT(DISTINCT student_id) as cnt')
                ->where('class_id', $classId)
                ->where('tenant_id', $tenantId)
                ->where('date', $today)
                ->where('is_effective', 1)
                ->get()->getRow()->cnt ?? 0);

            $classList[] = [
                'id'                 => $classId,
                'name'               => $class['name'],
                'studentCount'       => $studentCount,
                'attendanceRecorded' => $attendanceCount > 0,
            ];
        }

        return $this->success([
            'teacherName' => $teacherName,
            'employeeId'  => $employeeId,
            'classes'      => $classList,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/kiosk/student-attendance/class-students/:code
    // ──────────────────────────────────────────────────────────────────────────

    public function classStudents($code = null)
    {
        $employeeId = $this->request->getGet('employee_id');
        $classId    = $this->request->getGet('class_id');

        if (empty($employeeId) || empty($classId)) {
            return $this->error('employee_id and class_id are required', 400);
        }

        $tenant = $this->resolveTenant($code);
        if ($tenant === null) {
            return $this->notFound('Kiosk not found');
        }

        $tenantId     = $tenant['id'];
        $settings     = json_decode($tenant['settings'] ?? '{}', true) ?? [];
        $kioskEnabled = (bool) ($settings['studentKioskModeEnabled'] ?? false);

        if (!$kioskEnabled) {
            return $this->forbidden('Kiosk mode is not enabled for this school');
        }

        // Re-validate teacher
        $staff = $this->db->table('staff')
            ->where('employee_id', $employeeId)
            ->where('tenant_id', $tenantId)
            ->where('employment_status', 'active')
            ->where('is_teaching', 1)
            ->get()->getRowArray();

        if (!$staff) {
            return $this->forbidden('Employee ID not recognized');
        }

        // Verify class belongs to this teacher
        $class = $this->db->table('classes')
            ->where('id', $classId)
            ->where('tenant_id', $tenantId)
            ->where('teacher_id', $staff['id'])
            ->where('archived_at IS NULL')
            ->get()->getRowArray();

        if (!$class) {
            return $this->forbidden('Access denied');
        }

        $today = date('Y-m-d');

        // Get active students with today's effective attendance pre-fill
        $students = $this->db->table('students s')
            ->select('s.id, s.first_name, s.last_name, sae.status AS attendance_status')
            ->join('enrollments e', 'e.id = s.current_enrollment_id')
            ->join('student_attendance_events sae', "sae.student_id = s.id AND sae.date = '{$today}' AND sae.tenant_id = '{$tenantId}' AND sae.class_id = '{$classId}' AND sae.is_effective = 1", 'left')
            ->where('s.class_id', $classId)
            ->where('s.tenant_id', $tenantId)
            ->where('s.status', 'active')
            ->where('e.status', 'active')
            ->orderBy('s.last_name', 'ASC')
            ->orderBy('s.first_name', 'ASC')
            ->get()->getResultArray();

        $studentList = [];
        foreach ($students as $student) {
            $studentList[] = [
                'id'            => $student['id'],
                'firstName'     => $student['first_name'],
                'lastName'      => $student['last_name'],
                'currentStatus' => $student['attendance_status'] ?? null,
            ];
        }

        return $this->success([
            'classId'   => $class['id'],
            'className' => $class['name'],
            'date'      => $today,
            'students'  => $studentList,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/kiosk/student-attendance/submit
    // ──────────────────────────────────────────────────────────────────────────

    public function submit()
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        $kioskCode  = $data['kiosk_code']   ?? null;
        $employeeId = $data['employee_id']  ?? null;
        $classId    = $data['class_id']     ?? null;
        $date       = $data['date']         ?? date('Y-m-d');
        $records    = $data['records']      ?? [];

        if (empty($kioskCode) || empty($employeeId) || empty($classId)) {
            return $this->error('kiosk_code, employee_id, and class_id are required', 400);
        }

        if (empty($records) || !is_array($records)) {
            return $this->error('At least one attendance record is required', 400);
        }

        $tenant = $this->resolveTenant($kioskCode);
        if ($tenant === null) {
            return $this->forbidden('Employee ID not recognized');
        }

        $tenantId     = $tenant['id'];
        $settings     = json_decode($tenant['settings'] ?? '{}', true) ?? [];
        $kioskEnabled = (bool) ($settings['studentKioskModeEnabled'] ?? false);

        if (!$kioskEnabled) {
            return $this->forbidden('Kiosk mode is not enabled for this school');
        }

        // Re-validate teacher
        $staff = $this->db->table('staff')
            ->where('employee_id', $employeeId)
            ->where('tenant_id', $tenantId)
            ->where('employment_status', 'active')
            ->where('is_teaching', 1)
            ->get()->getRowArray();

        if (!$staff) {
            return $this->forbidden('Employee ID not recognized');
        }

        // Verify class belongs to this teacher
        $class = $this->db->table('classes')
            ->where('id', $classId)
            ->where('tenant_id', $tenantId)
            ->where('teacher_id', $staff['id'])
            ->where('archived_at IS NULL')
            ->get()->getRowArray();

        if (!$class) {
            return $this->forbidden('Access denied');
        }

        // Get tenant settings for academic session
        $settings = $this->db->table('tenants')->where('id', $tenantId)->get()->getRowArray();
        $tenantSettings = json_decode($settings['settings'] ?? '{}', true) ?? [];
        $academicSession = $tenantSettings['academicYear'] ?? date('Y') . '/' . (date('Y') + 1);

        // Validate and deduplicate records
        $validStatuses = ['present', 'absent', 'late', 'excused', 'half_day'];
        $seenStudentIds = [];
        $toInsert = [];

        foreach ($records as $record) {
            $studentId = $record['studentId'] ?? null;
            $status    = $record['status']    ?? null;
            $remarks   = $record['remarks']   ?? null;

            if (empty($studentId) || empty($status)) {
                continue;
            }

            if (!in_array($status, $validStatuses, true)) {
                continue;
            }

            // Check for duplicates within the batch
            if (isset($seenStudentIds[$studentId])) {
                continue;
            }
            $seenStudentIds[$studentId] = true;

            // Verify active enrollment and student status
            $enrollment = $this->db->table('enrollments')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $studentId)
                ->where('status', 'ACTIVE')
                ->where('class_id', $classId)
                ->get()->getRowArray();

            $student = $this->db->table('students')
                ->where('id', $studentId)
                ->where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->get()->getRowArray();

            if (!$enrollment || !$student) {
                continue;
            }

            $toInsert[] = [
                'studentId' => $studentId,
                'status'    => $status,
                'remarks'   => isset($remarks) ? substr((string) $remarks, 0, 500) : null,
            ];
        }

        $saved = 0;
        $now = date('Y-m-d H:i:s');

        if (!empty($toInsert)) {
            $model = new StudentClassAttendanceModel();

            $this->db->transStart();

            foreach ($toInsert as $item) {
                // Cascade prior effective row for this student/class/date
                $model->cascadeIsEffective($tenantId, $item['studentId'], $classId, $date, null);

                // Insert new immutable event
                $model->insert([
                    'id'                => 'sae_' . time() . '_' . bin2hex(random_bytes(4)),
                    'tenant_id'         => $tenantId,
                    'student_id'        => $item['studentId'],
                    'class_instance_id' => null, // Kiosk uses class_id directly
                    'class_id'          => $classId,
                    'academic_session'  => $academicSession,
                    'date'              => $date,
                    'period_key'        => null, // Kiosk is per-day only
                    'status'            => $item['status'],
                    'is_effective'      => 1,
                    'submitted_by'      => $staff['id'], // Use staff.id, not employeeId
                    'submitted_at'      => $now,
                    'remarks'           => $item['remarks'],
                    'created_at'        => $now,
                ]);

                $saved++;
            }

            $this->db->transComplete();

            if (!$this->db->transStatus()) {
                return $this->error('Failed to save attendance records', 500);
            }
        }

        return $this->success([
            'classId'       => $class['id'],
            'className'     => $class['name'],
            'date'          => $date,
            'totalStudents' => count($records),
            'saved'         => $saved,
            'submittedBy'   => $employeeId,
        ], 'Attendance saved successfully');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Resolve a tenant from an opaque kiosk code.
     * Returns the tenant row array or null if not found.
     */
    private function resolveTenant(?string $code): ?array
    {
        if (empty($code)) {
            return null;
        }

        $tenant = $this->db->query(
            "SELECT * FROM tenants
              WHERE JSON_UNQUOTE(JSON_EXTRACT(settings, '$.kiosk_code')) = ?",
            [$code]
        )->getRowArray();

        return $tenant ?: null;
    }
}
