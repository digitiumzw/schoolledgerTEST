<?php

namespace App\Controllers\Api;

use App\Services\StudentClassAttendanceService;

class StudentClassAttendanceController extends BaseApiController
{
    protected StudentClassAttendanceService $service;

    public function __construct()
    {
        $this->service = new StudentClassAttendanceService();
    }

    // ─────────────────────────────────────────────────────────────────
    // POST /api/class-attendance
    // US1: Submit batch attendance for a class
    // ─────────────────────────────────────────────────────────────────

    public function submit()
    {
        $tenantId = $this->getTenantId();

        if ($guard = $this->requireRole('admin', 'super_admin', 'teacher')) {
            return $guard;
        }

        $user = $this->getCurrentUser();
        $body = $this->getRequestBody();

        $classId   = $body['classId']   ?? null;
        $date      = $body['date']      ?? null;
        $periodKey = $body['periodKey'] ?? null;
        $records   = $body['records']   ?? null;

        if (!$classId || !$date) {
            return $this->error('classId and date are required', 400);
        }

        if (!is_array($records)) {
            return $this->error('records must be an array', 422);
        }

        try {
            $result = $this->service->submitBatch(
                $tenantId,
                (string) $classId,
                (string) $date,
                $periodKey !== null ? (string) $periodKey : null,
                $records,
                (string) $user->id
            );
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), $e->getCode() >= 400 ? $e->getCode() : 422);
        } catch (\RuntimeException $e) {
            $code = $e->getCode();
            if ($code === 404) return $this->notFound($e->getMessage());
            return $this->error($e->getMessage(), $code >= 400 ? $code : 500);
        }

        return $this->created($result, 'Attendance recorded');
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/class-attendance?classId=&date=[&periodKey=]
    // US1: Fetch effective register
    // ─────────────────────────────────────────────────────────────────

    public function index()
    {
        $tenantId = $this->getTenantId();

        if ($guard = $this->requireRole('admin', 'super_admin', 'teacher', 'bursar')) {
            return $guard;
        }

        $classId   = $this->request->getGet('classId');
        $date      = $this->request->getGet('date');
        $periodKey = $this->request->getGet('periodKey') ?: null;
        $pagination = $this->normalisePaginationParams(50, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $sort = $this->normaliseSortParams(['studentName', 'status', 'submittedAt'], 'studentName', 'asc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $search = $this->sanitiseString($this->request->getGet('search'));
        $status = $this->request->getGet('status') ?: 'all';
        $validStatuses = ['all', 'present', 'absent', 'late', 'excused', 'half_day'];

        if (!in_array($status, $validStatuses, true)) {
            return $this->error('Invalid status value.', 400);
        }

        if (!$classId || !$date) {
            return $this->error('classId and date are required', 400);
        }

        if (!$this->isValidDateString($date)) {
            return $this->error('Invalid date. Use YYYY-MM-DD with a valid calendar date', 400);
        }

        try {
            $result = $this->service->getEffectiveRegister($tenantId, $classId, $date, $periodKey);
        } catch (\RuntimeException $e) {
            $code = $e->getCode();
            if ($code === 404) return $this->notFound($e->getMessage());
            return $this->error($e->getMessage(), $code >= 400 ? $code : 500);
        }

        $records = $result['records'] ?? [];
        if ($search !== '') {
            $needle = strtolower($search);
            $records = array_values(array_filter($records, static fn(array $row): bool =>
                str_contains(strtolower((string) ($row['studentName'] ?? '')), $needle)
            ));
        }

        if ($status !== 'all') {
            $records = array_values(array_filter($records, static fn(array $row): bool => ($row['status'] ?? '') === $status));
        }

        usort($records, static function (array $a, array $b) use ($sort): int {
            $valuesA = [
                'studentName' => $a['studentName'] ?? '',
                'status' => $a['status'] ?? '',
                'submittedAt' => $a['submittedAt'] ?? '',
            ];
            $valuesB = [
                'studentName' => $b['studentName'] ?? '',
                'status' => $b['status'] ?? '',
                'submittedAt' => $b['submittedAt'] ?? '',
            ];
            $comparison = $valuesA[$sort['sortBy']] <=> $valuesB[$sort['sortBy']];
            return $sort['sortOrder'] === 'desc' ? -$comparison : $comparison;
        });

        $total = count($records);
        $pagedRecords = array_slice($records, $pagination['offset'], $pagination['limit']);
        $counts = array_count_values(array_column($records, 'status'));
        $result['records'] = $pagedRecords;
        $result['totalStudents'] = $total;
        $result['presentCount'] = (int) ($counts['present'] ?? 0);
        $result['absentCount'] = (int) ($counts['absent'] ?? 0);
        $result['lateCount'] = (int) ($counts['late'] ?? 0);
        $result['excusedCount'] = (int) ($counts['excused'] ?? 0);
        $result['halfDayCount'] = (int) ($counts['half_day'] ?? 0);
        $result['summary'] = [
            'totalStudents' => $total,
            'presentCount' => $result['presentCount'],
            'absentCount' => $result['absentCount'],
            'lateCount' => $result['lateCount'],
            'excusedCount' => $result['excusedCount'],
            'halfDayCount' => $result['halfDayCount'],
        ];
        $result['pagination'] = $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']);
        $result['filters'] = ['classId' => $classId, 'date' => $date, 'periodKey' => $periodKey, 'search' => $search, 'status' => $status];
        $result['sort'] = $sort;

        return $this->success($result);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/class-attendance/summary/student/:studentId
    // US3: Per-student aggregation
    // ─────────────────────────────────────────────────────────────────

    public function studentSummary($studentId = null)
    {
        $tenantId = $this->getTenantId();

        if ($guard = $this->requireRole('admin', 'super_admin', 'teacher', 'bursar')) {
            return $guard;
        }

        $academicSession = $this->request->getGet('sessionId');
        $startDate       = $this->request->getGet('startDate') ?: null;
        $endDate         = $this->request->getGet('endDate')   ?: null;

        if (!$studentId) {
            return $this->error('studentId is required', 400);
        }

        if (!$academicSession) {
            return $this->error('sessionId is required', 400);
        }

        if ($startDate && !$this->isValidDateString($startDate)) {
            return $this->error('Invalid startDate. Use YYYY-MM-DD with a valid calendar date', 400);
        }

        if ($endDate && !$this->isValidDateString($endDate)) {
            return $this->error('Invalid endDate. Use YYYY-MM-DD with a valid calendar date', 400);
        }

        try {
            $result = $this->service->getStudentSummary($tenantId, $studentId, $academicSession, $startDate, $endDate);
        } catch (\RuntimeException $e) {
            $code = $e->getCode();
            if ($code === 404) return $this->notFound($e->getMessage());
            return $this->error($e->getMessage(), $code >= 400 ? $code : 500);
        }

        return $this->success($result);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/class-attendance/summary/class/:classId
    // US3: Class-level summary
    // ─────────────────────────────────────────────────────────────────

    public function classSummary($classId = null)
    {
        $tenantId = $this->getTenantId();

        if ($guard = $this->requireRole('admin', 'super_admin', 'teacher', 'bursar')) {
            return $guard;
        }

        $startDate = $this->request->getGet('startDate');
        $endDate   = $this->request->getGet('endDate');
        $search    = $this->request->getGet('search') ?: null;

        if (!$classId) {
            return $this->error('classId is required', 400);
        }

        if (!$startDate || !$endDate) {
            return $this->error('startDate and endDate are required', 400);
        }

        if (!$this->isValidDateString($startDate) || !$this->isValidDateString($endDate)) {
            return $this->error('Invalid date. Use YYYY-MM-DD with a valid calendar date', 400);
        }

        if ($endDate < $startDate) {
            return $this->error('endDate must not be before startDate', 400);
        }

        try {
            $result = $this->service->getClassSummary($tenantId, $classId, $startDate, $endDate, $search);
        } catch (\RuntimeException $e) {
            $code = $e->getCode();
            if ($code === 404) return $this->notFound($e->getMessage());
            return $this->error($e->getMessage(), $code >= 400 ? $code : 500);
        }

        return $this->success($result);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/class-attendance/summary/session
    // US3: Session-level rollup
    // ─────────────────────────────────────────────────────────────────

    public function sessionSummary()
    {
        $tenantId = $this->getTenantId();

        if ($guard = $this->requireRole('admin', 'super_admin')) {
            return $guard;
        }

        $academicSession = $this->request->getGet('academicSession');

        if (!$academicSession) {
            return $this->error('academicSession is required', 400);
        }

        $result = $this->service->getSessionSummary($tenantId, (string) $academicSession);

        return $this->success($result);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /api/class-attendance/audit
    // US4: Full audit log for a student/class/date
    // ─────────────────────────────────────────────────────────────────

    public function auditLog()
    {
        $tenantId = $this->getTenantId();

        if ($guard = $this->requireRole('admin', 'super_admin')) {
            return $guard;
        }

        $studentId = $this->request->getGet('studentId');
        $classId   = $this->request->getGet('classId');
        $date      = $this->request->getGet('date');
        $periodKey = $this->request->getGet('periodKey') ?: null;

        if (!$studentId || !$classId || !$date) {
            return $this->error('studentId, classId, and date are required', 400);
        }

        if (!$this->isValidDateString($date)) {
            return $this->error('Invalid date. Use YYYY-MM-DD with a valid calendar date', 400);
        }

        // Verify student belongs to tenant
        $student = \Config\Database::connect()
            ->table('students')
            ->where('id', $studentId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        // Verify class belongs to tenant
        $class = \Config\Database::connect()
            ->table('classes')
            ->where('id', $classId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$class) {
            return $this->notFound('Class not found');
        }

        $result = $this->service->getAuditLog($tenantId, $studentId, $classId, $date, $periodKey);

        return $this->success($result);
    }
}
