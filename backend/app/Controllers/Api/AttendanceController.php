<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;
use App\Models\AttendanceModel;
use App\Services\StaffAttendanceService;
use DateTime;

class AttendanceController extends BaseApiController
{
    protected $db;
    protected AttendanceModel $attendanceModel;
    protected StaffAttendanceService $attendanceService;

    public function __construct()
    {
        $this->db               = Config::connect();
        $this->attendanceModel  = new AttendanceModel();
        $this->attendanceService = new StaffAttendanceService();
    }

    // ─────────────────────────────────────────────────────────────────
    // NEW ENDPOINTS (035-staff-attendance-filters)
    // ─────────────────────────────────────────────────────────────────

    /**
     * GET /api/attendance/summary?month=YYYY-MM
     * Monthly attendance summary for all active staff.
     */
    public function summary()
    {
        $tenantId = $this->getTenantId();

        $month = $this->request->getGet('month') ?? date('Y-m');

        // Validate YYYY-MM format
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
            return $this->error('Invalid month format. Use YYYY-MM', 400);
        }

        // Validate the month value itself (month 01-12)
        [$year, $mon] = explode('-', $month);
        if ((int)$mon < 1 || (int)$mon > 12) {
            return $this->error('Invalid month format. Use YYYY-MM', 400);
        }

        $records = $this->attendanceModel->getMonthlySummary($month, $tenantId);

        return $this->success([
            'month'   => $month,
            'records' => $records,
        ]);
    }

    /**
     * GET /api/attendance/today
     * Today's attendance status for all active staff, including unchecked.
     * Staff on approved leave are NOT counted as unchecked - they show as "on_leave".
     */
    public function today()
    {
        $tenantId = $this->getTenantId();
        $today    = date('Y-m-d');

        $rows = $this->attendanceModel->getTodayAttendance($tenantId);

        // Get all approved leave covering today
        $approvedLeave = $this->db->table('leave_requests')
            ->where('tenant_id', $tenantId)
            ->where('status', 'approved')
            ->where('start_date <=', $today)
            ->where('end_date >=', $today)
            ->get()
            ->getResultArray();

        // Build lookup map: staff_id => leave_type
        $onLeaveMap = [];
        foreach ($approvedLeave as $leave) {
            $onLeaveMap[$leave['staff_id']] = $leave['leave_type'];
        }

        $staff = [];
        $uncheckedCount = 0;

        foreach ($rows as $row) {
            $staffId   = $row['staff_id'];
            $hasRecord = $row['attendance_id'] !== null;
            $isOnLeave = isset($onLeaveMap[$staffId]);

            // Staff on approved leave are NOT "unchecked" - treat them as accounted for
            if (!$hasRecord && !$isOnLeave) {
                $uncheckedCount++;
            }

            $staff[] = [
                'staff_id'       => $staffId,
                'first_name'     => $row['first_name'],
                'last_name'      => $row['last_name'],
                'department'     => $row['department'],
                'status'         => $row['status'], // DB status (may be null)
                'check_in_time'  => $row['check_in_time'],
                'check_out_time' => $row['check_out_time'],
                'comment'        => $row['comment'],
                'has_record'     => $hasRecord || $isOnLeave, // On-leave staff don't need a record
                'is_on_leave'    => $isOnLeave,
                'leave_type'     => $isOnLeave ? $onLeaveMap[$staffId] : null,
            ];
        }

        return $this->success([
            'date'            => $today,
            'unchecked_count' => $uncheckedCount,
            'staff'           => $staff,
        ]);
    }

    public function classSummary()
    {
        $tenantId = $this->getTenantId();

        $classId = $this->request->getGet('classId');
        $startDate = $this->request->getGet('startDate');
        $endDate = $this->request->getGet('endDate');

        if (!$classId || !$startDate || !$endDate) {
            return $this->error('classId, startDate, and endDate are required.', 400);
        }

        if (!$this->isValidDateString($startDate) || !$this->isValidDateString($endDate)) {
            return $this->error('Invalid date. Use YYYY-MM-DD with a valid calendar date.', 400);
        }

        $sortBy = (string) ($this->request->getGet('sortBy') ?? 'name');
        if (!in_array($sortBy, ['name', 'presentDays', 'attendancePercentage'], true)) {
            $sortBy = 'name';
        }

        $sortOrder = strtolower((string) ($this->request->getGet('sortOrder') ?? 'asc'));
        if (!in_array($sortOrder, ['asc', 'desc'], true)) {
            $sortOrder = 'asc';
        }

        $summary = $this->attendanceModel->getClassAttendanceSummary(
            $tenantId,
            (string) $classId,
            (string) $startDate,
            (string) $endDate,
            $this->request->getGet('search') ? (string) $this->request->getGet('search') : null,
            $sortBy,
            $sortOrder
        );

        return $this->success([
            'summary' => $summary,
            'meta' => [
                'classId' => $classId,
                'startDate' => $startDate,
                'endDate' => $endDate,
                'total' => count($summary),
            ],
        ]);
    }

    /**
     * POST /api/attendance/{staffId}/status
     * Mark a staff member as absent or excused for today.
     */
    public function updateStatus($staffId = null)
    {
        $tenantId = $this->getTenantId();

        if (!$staffId) {
            return $this->error('Staff ID is required', 400);
        }

        // Role check — admin/super_admin/hr may update status
        if ($guard = $this->requireRole('admin', 'super_admin', 'hr')) {
            return $guard;
        }

        $body = $this->getRequestBody();

        $status  = $body['status']  ?? null;
        $comment = $body['comment'] ?? null;

        if (!in_array($status, ['absent', 'excused'], true)) {
            return $this->error("Invalid status. Must be 'absent' or 'excused'", 400);
        }

        if ($comment !== null && strlen($comment) > 500) {
            return $this->error('Comment must not exceed 500 characters', 400);
        }

        // Verify the staff member exists within this tenant
        $staffMember = $this->db->table('staff')
            ->where('id', $staffId)
            ->where('tenant_id', $tenantId)
            ->get()->getRow();

        if (!$staffMember) {
            return $this->notFound('Staff member not found');
        }

        // Cannot override a staff member who has already checked in (status = present)
        $today = date('Y-m-d');
        $existing = $this->db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('staff_id', $staffId)
            ->where('date', $today)
            ->get()->getRow();

        if ($existing && $existing->status === 'present') {
            return $this->error(
                'Cannot modify status for staff who has already checked in',
                409
            );
        }

        $saved = $this->attendanceModel->updateStatus(
            $staffId,
            $status,
            $comment !== '' ? $comment : null,
            $tenantId
        );

        return $this->success([
            'attendance_id' => $saved['id'],
            'staff_id'      => $staffId,
            'date'          => $today,
            'status'        => $status,
            'comment'       => $saved['comment'],
            'updated_at'    => $saved['updated_at'],
        ]);
    }

    /**
     * GET /api/staff-attendance/filter-metadata
     * Returns dynamic filter options based on actual attendance data.
     * Includes years, departments, staff members, months, and statuses.
     */
    public function filterMetadata()
    {
        $tenantId = $this->getTenantId();

        $metadata = $this->attendanceModel->getFilterMetadata($tenantId);

        return $this->success($metadata);
    }

    // ─────────────────────────────────────────────────────────────────
    // EXISTING METHODS
    // ─────────────────────────────────────────────────────────────────

    public function studentIndex()
    {
        $tenantId   = $this->getTenantId();
        $studentId  = $this->request->getGet('studentId');
        $classId    = $this->request->getGet('classId');
        $date       = $this->request->getGet('date');
        $recordedBy = $this->request->getGet('recordedBy');
        $startDate  = $this->request->getGet('start_date');
        $endDate    = $this->request->getGet('end_date');

        $builder = $this->db->table('student_attendance')->where('tenant_id', $tenantId);

        if ($studentId)  $builder->where('student_id', $studentId);
        if ($classId)    $builder->where('class_id', $classId);
        if ($date)       $builder->where('date', $date);
        if ($recordedBy) $builder->where('recorded_by', $recordedBy);
        if ($startDate)  $builder->where('date >=', $startDate);
        if ($endDate)    $builder->where('date <=', $endDate);

        $records = $builder->orderBy('date', 'DESC')->get()->getResultArray();

        $formatted = array_map(fn($r) => [
            'id' => $r['id'],
            'studentId' => $r['student_id'],
            'classId' => $r['class_id'],
            'date' => $r['date'],
            'status' => $r['status'],
            'remarks' => $r['remarks'] ?? '',
            'recordedBy' => $r['recorded_by'],
        ], $records);

        return $this->success($formatted);
    }

    public function saveStudentAttendance()
    {
        $tenantId = $this->getTenantId();
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $records = $data['records'] ?? [$data];
        $saved = 0;

        foreach ($records as $record) {
            $existingId = $this->db->table('student_attendance')
                ->where('tenant_id', $tenantId)
                ->where('student_id', $record['studentId'])
                ->where('date', $record['date'])
                ->get()->getRow();

            $attendanceData = [
                'tenant_id' => $tenantId,
                'student_id' => $record['studentId'],
                'class_id' => $record['classId'],
                'date' => $record['date'],
                'status' => $record['status'],
                'remarks' => $record['remarks'] ?? '',
                'updated_at' => date('Y-m-d H:i:s'),
            ];

            if ($existingId) {
                $this->db->table('student_attendance')->where('id', $existingId->id)->update($attendanceData);
            } else {
                $attendanceData['id'] = $this->generateId('a');
                $attendanceData['created_at'] = date('Y-m-d H:i:s');
                $attendanceData['recorded_by'] = $record['recordedBy'] ?? 'system';
                $this->db->table('student_attendance')->insert($attendanceData);
            }
            $saved++;
        }

        return $this->success(['saved' => $saved]);
    }

    public function studentSummary($studentId = null)
    {
        $tenantId = $this->getTenantId();
        $records = $this->db->table('student_attendance')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->get()->getResultArray();

        $summary = [
            'totalDays' => count($records),
            'present' => 0,
            'absent' => 0,
            'late' => 0,
            'excused' => 0,
        ];

        foreach ($records as $r) {
            if (isset($summary[$r['status']])) {
                $summary[$r['status']]++;
            }
        }

        $summary['attendanceRate'] = $summary['totalDays'] > 0 
            ? round(($summary['present'] + $summary['late']) / $summary['totalDays'] * 100, 1) 
            : 0;

        return $this->success($summary);
    }

    public function staffIndex()
    {
        $tenantId = $this->getTenantId();
        $staffId  = $this->request->getGet('staffId');
        $date     = $this->request->getGet('date');

        // Legacy single-staff / single-day lookup (DailyAttendanceTab, staff profile).
        if ($staffId || $date) {
            $builder = $this->db->table('staff_attendance sa')
                ->select("sa.id, sa.staff_id, sa.date, sa.check_in, sa.check_out, sa.status, sa.work_hours, sa.overtime_hours, sa.remarks, sa.comment, CONCAT(s.first_name, ' ', s.last_name) AS staff_name, s.department")
                ->join('staff s', 's.id = sa.staff_id AND s.tenant_id = sa.tenant_id', 'left')
                ->where('sa.tenant_id', $tenantId);
            if ($staffId) $builder->where('sa.staff_id', $staffId);
            if ($date)    $builder->where('sa.date', $date);
            $records = $builder->orderBy('sa.date', 'DESC')->get()->getResultArray();
            $formatted = array_map(fn($r) => [
                'id'        => $r['id'],
                'staffId'   => $r['staff_id'],
                'staffName' => $r['staff_name'] ?? 'Unknown',
                'date'      => $r['date'],
                'checkIn'   => $r['check_in'],
                'checkOut'  => $r['check_out'],
                'status'    => $r['status'],
                'workHours' => $r['work_hours'] ? (float) $r['work_hours'] : null,
                'overtimeHours' => $r['overtime_hours'] ? (float) $r['overtime_hours'] : null,
                'remarks'   => $r['remarks'] ?? '',
                'comment'   => $r['comment']  ?? null,
            ], $records);
            return $this->success($formatted);
        }

        $pagination = $this->normalisePaginationParams(20, 20);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $sort = $this->normaliseSortParams(['date', 'staffName', 'status', 'workHours', 'overtimeHours'], 'date', 'desc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $search     = $this->sanitiseString($this->request->getGet('search'));
        $status     = $this->request->getGet('status') ?: 'all';
        $staffId    = $this->request->getGet('staffId');
        $department = $this->request->getGet('department');
        $startDate  = $this->request->getGet('start_date');
        $endDate    = $this->request->getGet('end_date');
        $validStatuses = ['all', 'present', 'absent', 'late', 'on_leave', 'half_day', 'early_departure'];

        if (!in_array($status, $validStatuses, true)) {
            return $this->error('Invalid status value.', 400);
        }

        $dateRange = $this->normaliseDateRange($startDate, $endDate, 'start_date', 'end_date');
        if (isset($dateRange['error'])) {
            return $this->error($dateRange['error'], 400);
        }

        $builder = $this->db->table('staff_attendance sa')
            ->select("sa.id, sa.staff_id, sa.date, sa.check_in, sa.check_out, sa.status, sa.work_hours, sa.overtime_hours, sa.remarks, CONCAT(s.first_name, ' ', s.last_name) AS staff_name, s.department")
            ->join('staff s', 's.id = sa.staff_id AND s.tenant_id = sa.tenant_id', 'left')
            ->where('sa.tenant_id', $tenantId);

        if ($status !== 'all')    $builder->where('sa.status', $status);
        if ($staffId)             $builder->where('sa.staff_id', $staffId);
        if ($department)          $builder->where('s.department', $department);
        if ($startDate)           $builder->where('sa.date >=', $startDate);
        if ($endDate)             $builder->where('sa.date <=', $endDate);
        if ($search !== '') {
            $builder->groupStart()
                ->like('s.first_name', $search)
                ->orLike('s.last_name', $search)
                ->orLike("CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))", $search, 'both', null, true)
                ->groupEnd();
        }

        $total    = $builder->countAllResults(false);
        $sortColumns = [
            'date' => 'sa.date',
            'staffName' => 'staff_name',
            'status' => 'sa.status',
            'workHours' => 'sa.work_hours',
            'overtimeHours' => 'sa.overtime_hours',
        ];
        $records  = $builder
            ->orderBy($sortColumns[$sort['sortBy']], strtoupper($sort['sortOrder']))
            ->orderBy('sa.created_at', 'DESC')
            ->limit($pagination['limit'], $pagination['offset'])
            ->get()
            ->getResultArray();

        $formatted = array_map(fn($r) => [
            'id'        => $r['id'],
            'staffId'   => $r['staff_id'],
            'staffName' => $r['staff_name'] ?? 'Unknown',
            'date'      => $r['date'],
            'checkIn'   => $r['check_in'],
            'checkOut'  => $r['check_out'],
            'status'    => $r['status'],
            'workHours' => $r['work_hours'] ? (float) $r['work_hours'] : null,
            'overtimeHours' => $r['overtime_hours'] ? (float) $r['overtime_hours'] : null,
            'remarks'   => $r['remarks'] ?? '',
            'comment'   => null,
        ], $records);

        $filters = [
            'search'     => $search,
            'status'     => $status,
            'staffId'    => $staffId ?: null,
            'department' => $department ?: null,
            'startDate'  => $startDate ?: null,
            'endDate'    => $endDate ?: null,
        ];

        return $this->success([
            'records'    => $formatted,
            'summary'    => $this->attendanceModel->getFilteredRecordsSummary($tenantId, $filters),
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
            'filters'    => $filters,
            'sort'       => $sort,
        ]);
    }

    public function checkIn()
    {
        $tenantId = $this->getTenantId();
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        if (empty($data['staffId'])) {
            return $this->error('staffId is required', 400);
        }

        // Validate time format (HH:MM)
        $checkInTime = $data['checkIn'] ?? date('H:i');
        if (!preg_match('/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/', $checkInTime)) {
            return $this->error('Invalid time format. Please use HH:MM format.');
        }

        // Guard: only active staff may check in
        $staffMember = $this->db->table('staff')
            ->where('id', $data['staffId'])
            ->where('tenant_id', $tenantId)
            ->get()->getRow();

        if (!$staffMember) {
            return $this->notFound('Staff member not found');
        }

        if ($staffMember->employment_status !== 'active') {
            return $this->error('Cannot record attendance for an inactive staff member', 422);
        }

        $date = $data['date'] ?? date('Y-m-d');
        $force = !empty($data['force']);

        // Guard: warn if approved leave exists for this date (unless force=true)
        if (!$force) {
            $leaveConflict = $this->db->table('leave_requests')
                ->where('tenant_id', $tenantId)
                ->where('staff_id', $data['staffId'])
                ->where('status', 'approved')
                ->where('start_date <=', $date)
                ->where('end_date >=', $date)
                ->get()->getRow();

            if ($leaveConflict) {
                return $this->error(
                    'Approved leave exists for this date; pass force=true to override',
                    409
                );
            }
        }

        // Derive status via service
        $workConfig = $this->attendanceService->getWorkHoursConfig($tenantId);
        $status = $this->attendanceService->classifyStatus(
            $checkInTime,
            null,
            $workConfig['startTime'],
            $workConfig['endTime'],
            $workConfig['standardHours']
        );

        // Upsert: update existing record or insert new one
        $existing = $this->db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('staff_id', $data['staffId'])
            ->where('date', $date)
            ->get()->getRow();

        if ($existing) {
            $this->db->table('staff_attendance')
                ->where('id', $existing->id)
                ->update([
                    'check_in'   => $checkInTime,
                    'status'     => $status,
                    'source'     => 'manual',
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
            return $this->success(['id' => $existing->id, 'checkIn' => $checkInTime, 'status' => $status]);
        }

        $attendanceId = $this->generateId('sa');
        $this->db->table('staff_attendance')->insert([
            'id'         => $attendanceId,
            'tenant_id'  => $tenantId,
            'staff_id'   => $data['staffId'],
            'date'       => $date,
            'check_in'   => $checkInTime,
            'status'     => $status,
            'source'     => 'manual',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return $this->success(['id' => $attendanceId, 'checkIn' => $checkInTime, 'status' => $status]);
    }

    public function checkOut()
    {
        $tenantId = $this->getTenantId();
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        // Use provided check-out time or current time as fallback
        $checkOutTime = $data['checkOut'] ?? date('H:i');

        // Validate time format (HH:MM)
        if (!preg_match('/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/', $checkOutTime)) {
            return $this->error('Invalid time format. Please use HH:MM format.');
        }

        $record = $this->db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('staff_id', $data['staffId'])
            ->where('date', $data['date'] ?? date('Y-m-d'))
            ->get()->getRow();

        if ($record) {
            if (empty($record->check_in)) {
                return $this->error('No check-in time found for this record', 400);
            }

            $checkInSecs  = strtotime($record->check_in);
            $checkOutSecs = strtotime($checkOutTime);

            if ($checkOutSecs <= $checkInSecs) {
                return $this->error('Check-out time must be after check-in time', 400);
            }

            $workHours = round(($checkOutSecs - $checkInSecs) / 3600, 2);

            // Re-classify status with full check-in + check-out context
            $workConfig    = $this->attendanceService->getWorkHoursConfig($tenantId);
            $status        = $this->attendanceService->classifyStatus(
                $record->check_in,
                $checkOutTime,
                $workConfig['startTime'],
                $workConfig['endTime'],
                $workConfig['standardHours']
            );
            $overtimeHours = $this->attendanceService->calculateOvertimeHours(
                $workHours,
                $workConfig['standardHours']
            );

            $this->db->table('staff_attendance')->where('id', $record->id)->update([
                'check_out'     => $checkOutTime,
                'work_hours'    => $workHours,
                'overtime_hours' => $overtimeHours,
                'status'        => $status,
                'source'        => 'manual',
                'updated_at'    => date('Y-m-d H:i:s'),
            ]);

            return $this->success([
                'checkOut'      => $checkOutTime,
                'workHours'     => $workHours,
                'overtimeHours' => $overtimeHours,
                'status'        => $status,
            ]);
        }

        return $this->error('No check-in record found for today', 400);
    }

    public function recordStaffAttendance()
    {
        $tenantId = $this->getTenantId();
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        if (empty($data['staffId']) || empty($data['date']) || empty($data['status'])) {
            return $this->error('staffId, date, and status are required', 400);
        }

        // Validate check_out > check_in when both are provided
        if (!empty($data['checkIn']) && !empty($data['checkOut'])) {
            if (strtotime($data['checkOut']) <= strtotime($data['checkIn'])) {
                return $this->error('Check-out time must be after check-in time', 400);
            }
        }

        // Validate status value
        $validStatuses = ['present', 'absent', 'late', 'on_leave', 'half_day', 'early_departure', 'excused'];
        if (!in_array($data['status'], $validStatuses, true)) {
            return $this->error('Invalid status value. Allowed: ' . implode(', ', $validStatuses), 400);
        }

        // Compute work hours from check-in/check-out if not provided
        $workHours = $data['workHours'] ?? null;
        if ($workHours === null && !empty($data['checkIn']) && !empty($data['checkOut'])) {
            $workHours = round((strtotime($data['checkOut']) - strtotime($data['checkIn'])) / 3600, 2);
        }

        // Compute overtime when both check-in/check-out provided
        $overtimeHours = null;
        if ($workHours !== null) {
            $workConfig    = $this->attendanceService->getWorkHoursConfig($tenantId);
            $overtimeHours = $this->attendanceService->calculateOvertimeHours(
                (float) $workHours,
                $workConfig['standardHours']
            );
        }

        // Upsert: update if a record already exists for this staff-date
        $existing = $this->db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('staff_id', $data['staffId'])
            ->where('date', $data['date'])
            ->get()->getRow();

        if ($existing) {
            $this->db->table('staff_attendance')
                ->where('id', $existing->id)
                ->update([
                    'check_in'      => $data['checkIn'] ?? $existing->check_in,
                    'check_out'     => $data['checkOut'] ?? $existing->check_out,
                    'status'        => $data['status'],
                    'work_hours'    => $workHours ?? $existing->work_hours,
                    'overtime_hours' => $overtimeHours,
                    'remarks'       => $data['remarks'] ?? $existing->remarks,
                    'updated_at'    => date('Y-m-d H:i:s'),
                ]);
            return $this->success(['id' => $existing->id]);
        }

        $attendanceId = $this->generateId('sa');
        $this->db->table('staff_attendance')->insert([
            'id'             => $attendanceId,
            'tenant_id'      => $tenantId,
            'staff_id'       => $data['staffId'],
            'date'           => $data['date'],
            'check_in'       => $data['checkIn'] ?? null,
            'check_out'      => $data['checkOut'] ?? null,
            'status'         => $data['status'],
            'work_hours'     => $workHours,
            'overtime_hours' => $overtimeHours,
            'remarks'        => $data['remarks'] ?? '',
            'source'         => 'manual',
            'created_at'     => date('Y-m-d H:i:s'),
            'updated_at'     => date('Y-m-d H:i:s'),
        ]);

        return $this->created(['id' => $attendanceId]);
    }

    public function staffSummary($staffId = null)
    {
        $tenantId = $this->getTenantId();
        $month = $this->request->getGet('month') ?? date('Y-m');
        $includeTrend = $this->request->getGet('includeTrend') === 'true';

        $records = $this->db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('staff_id', $staffId)
            ->where('DATE_FORMAT(date, "%Y-%m") =', $month)
            ->get()->getResultArray();

        // Count actual recorded days for this staff member
        $totalRecordedDays = count($records);
        
        $summary = [
            'totalDays'          => $totalRecordedDays,
            'present'            => 0,
            'absent'             => 0,
            'late'               => 0,
            'onLeave'            => 0,
            'halfDay'            => 0,
            'earlyDeparture'     => 0,
            'totalWorkHours'     => 0,
            'totalOvertimeHours' => 0,
            'attendanceRate'     => 0,
        ];

        foreach ($records as $r) {
            $status = $r['status'];
            if ($status === 'present')         $summary['present']++;
            elseif ($status === 'absent')      $summary['absent']++;
            elseif ($status === 'late')        $summary['late']++;
            elseif ($status === 'on_leave')    $summary['onLeave']++;
            elseif ($status === 'half_day')    $summary['halfDay']++;
            elseif ($status === 'early_departure') $summary['earlyDeparture']++;

            $summary['totalWorkHours']     += (float) ($r['work_hours']     ?? 0);
            $summary['totalOvertimeHours'] += (float) ($r['overtime_hours'] ?? 0);
        }

        // Calculate attendance rate (present + late) / total working days
        $attendedDays = $summary['present'] + $summary['late'];
        $summary['attendanceRate'] = $summary['totalDays'] > 0
            ? round(($attendedDays / $summary['totalDays']) * 100, 1)
            : 0;

        // Add month-over-month trend if requested
        if ($includeTrend) {
            $previousMonth = date('Y-m', strtotime($month . '-01 -1 month'));
            $previousSummary = $this->getStaffMonthSummary($staffId, $previousMonth, $tenantId);
            
            $summary['trend'] = [
                'previousMonth' => [
                    'month' => $previousMonth,
                    'attendanceRate' => $previousSummary['attendanceRate'],
                    'present' => $previousSummary['present'],
                    'late' => $previousSummary['late'],
                    'onLeave' => $previousSummary['onLeave'],
                ],
                'change' => [
                    'attendanceRate' => $summary['attendanceRate'] - $previousSummary['attendanceRate'],
                    'present' => $summary['present'] - $previousSummary['present'],
                    'late' => $summary['late'] - $previousSummary['late'],
                    'onLeave' => $summary['onLeave'] - $previousSummary['onLeave'],
                ]
            ];
        }

        return $this->success($summary);
    }

    /**
     * GET /api/staff-attendance/report
     * Per-staff aggregation over a configurable date range.
     * Optional: department, staff_id query params.
     * Role: admin / super_admin
     */
    public function periodReport()
    {
        $tenantId = $this->getTenantId();

        if ($guard = $this->requireRole('admin', 'super_admin', 'hr')) {
            return $guard;
        }

        $pagination = $this->normalisePaginationParams(20, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $sort = $this->normaliseSortParams(['staffName', 'departmentName', 'attendanceRate', 'presentDays', 'lateDays', 'totalOvertimeHours'], 'staffName', 'asc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $startDate  = $this->request->getGet('start_date') ?: $this->request->getGet('startDate');
        $endDate    = $this->request->getGet('end_date') ?: $this->request->getGet('endDate');
        $department = $this->request->getGet('department') ?: $this->request->getGet('departmentId') ?: null;
        $staffId    = $this->request->getGet('staff_id') ?: $this->request->getGet('staffId') ?: null;
        $search     = $this->sanitiseString($this->request->getGet('search'));

        if (!$startDate || !$endDate) {
            return $this->error('start_date and end_date are required', 400);
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            return $this->error('Invalid date format. Use YYYY-MM-DD', 400);
        }

        if (strtotime($endDate) < strtotime($startDate)) {
            return $this->error('end_date must not be before start_date', 400);
        }

        $workingDays = count($this->attendanceService->getWorkingDaysExcludingHolidays($tenantId, $startDate, $endDate));
        $staff       = $this->attendanceModel->getPeriodReport($tenantId, $startDate, $endDate, $department, $staffId, $workingDays);
        if ($search !== '') {
            $needle = strtolower($search);
            $staff = array_values(array_filter($staff, static fn(array $row): bool =>
                str_contains(strtolower(trim(($row['firstName'] ?? '') . ' ' . ($row['lastName'] ?? ''))), $needle)
                || str_contains(strtolower((string) ($row['department'] ?? '')), $needle)
            ));
        }

        usort($staff, static function (array $a, array $b) use ($sort): int {
            $valuesA = [
                'staffName' => trim(($a['firstName'] ?? '') . ' ' . ($a['lastName'] ?? '')),
                'departmentName' => $a['department'] ?? '',
                'attendanceRate' => $a['attendanceRate'] ?? 0,
                'presentDays' => $a['present'] ?? 0,
                'lateDays' => $a['late'] ?? 0,
                'totalOvertimeHours' => $a['totalOvertimeHours'] ?? 0,
            ];
            $valuesB = [
                'staffName' => trim(($b['firstName'] ?? '') . ' ' . ($b['lastName'] ?? '')),
                'departmentName' => $b['department'] ?? '',
                'attendanceRate' => $b['attendanceRate'] ?? 0,
                'presentDays' => $b['present'] ?? 0,
                'lateDays' => $b['late'] ?? 0,
                'totalOvertimeHours' => $b['totalOvertimeHours'] ?? 0,
            ];
            $comparison = $valuesA[$sort['sortBy']] <=> $valuesB[$sort['sortBy']];
            return $sort['sortOrder'] === 'desc' ? -$comparison : $comparison;
        });

        $total = count($staff);
        $pagedStaff = array_slice($staff, $pagination['offset'], $pagination['limit']);
        $totalLateDays = array_sum(array_column($staff, 'late'));
        $totalOvertimeHours = array_sum(array_column($staff, 'totalOvertimeHours'));
        $averageAttendanceRate = $total > 0 ? round(array_sum(array_column($staff, 'attendanceRate')) / $total, 1) : 0.0;

        return $this->success([
            'period' => [
                'startDate'   => $startDate,
                'endDate'     => $endDate,
                'workingDays' => $workingDays,
            ],
            'staff' => $pagedStaff,
            'summary' => [
                'workingDays' => $workingDays,
                'staffCount' => $total,
                'averageAttendanceRate' => $averageAttendanceRate,
                'totalLateDays' => (int) $totalLateDays,
                'totalOvertimeHours' => (float) $totalOvertimeHours,
            ],
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
            'filters' => [
                'startDate' => $startDate,
                'endDate' => $endDate,
                'department' => $department,
                'staffId' => $staffId,
                'search' => $search,
            ],
            'sort' => $sort,
        ]);
    }

    /**
     * GET /api/staff-attendance/departments
     * Department-level attendance rollup over a configurable date range.
     * Role: admin / super_admin
     */
    public function departmentReport()
    {
        $tenantId = $this->getTenantId();

        if ($guard = $this->requireRole('admin', 'super_admin', 'hr')) {
            return $guard;
        }

        $startDate = $this->request->getGet('start_date');
        $endDate   = $this->request->getGet('end_date');

        if (!$startDate || !$endDate) {
            return $this->error('start_date and end_date are required', 400);
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $startDate) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $endDate)) {
            return $this->error('Invalid date format. Use YYYY-MM-DD', 400);
        }

        if (strtotime($endDate) < strtotime($startDate)) {
            return $this->error('end_date must not be before start_date', 400);
        }

        $workingDays = count($this->attendanceService->getWorkingDaysExcludingHolidays($tenantId, $startDate, $endDate));
        $departments = $this->attendanceModel->getDepartmentReport($tenantId, $startDate, $endDate, $workingDays);

        return $this->success([
            'period'      => ['startDate' => $startDate, 'endDate' => $endDate, 'workingDays' => $workingDays],
            'departments' => $departments,
        ]);
    }

    public function deleteStaffAttendance($id = null)
    {
        $tenantId = $this->getTenantId();
        
        if (!$id) {
            return $this->error('Attendance record ID is required');
        }

        $record = $this->db->table('staff_attendance')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->get()->getRow();

        if (!$record) {
            return $this->error('Attendance record not found', 404);
        }

        $this->db->table('staff_attendance')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->delete();

        return $this->success(['message' => 'Attendance record deleted successfully']);
    }

    public function updateStaffAttendance($id = null)
    {
        $tenantId = $this->getTenantId();
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        
        if (!$id) {
            return $this->error('Attendance record ID is required');
        }

        $record = $this->db->table('staff_attendance')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->get()->getRow();

        if (!$record) {
            return $this->error('Attendance record not found', 404);
        }

        $validStatuses = ['present', 'absent', 'late', 'on_leave', 'half_day', 'early_departure', 'excused'];
        if (isset($data['status']) && !in_array($data['status'], $validStatuses, true)) {
            return $this->error('Invalid status value. Allowed: ' . implode(', ', $validStatuses), 400);
        }

        $updateData = [
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        // Allow updating specific fields
        if (isset($data['checkIn'])) $updateData['check_in'] = $data['checkIn'];
        if (isset($data['checkOut'])) $updateData['check_out'] = $data['checkOut'];
        if (isset($data['status'])) $updateData['status'] = $data['status'];
        if (isset($data['workHours'])) $updateData['work_hours'] = $data['workHours'];
        if (isset($data['remarks'])) $updateData['remarks'] = $data['remarks'];

        $this->db->table('staff_attendance')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->update($updateData);

        return $this->success(['message' => 'Attendance record updated successfully']);
    }

    /**
     * Calculate working days in a month (excluding weekends)
     */
    private function calculateWorkingDays($month)
    {
        $date = new DateTime($month . '-01');
        $year = (int)$date->format('Y');
        $monthNum = (int)$date->format('m');
        
        $workingDays = 0;
        $totalDays = cal_days_in_month(CAL_GREGORIAN, $monthNum, $year);
        
        for ($day = 1; $day <= $totalDays; $day++) {
            $dayOfWeek = date('N', strtotime("$year-$monthNum-$day"));
            // Monday (1) to Friday (5) are working days
            if ($dayOfWeek <= 5) {
                $workingDays++;
            }
        }
        
        return $workingDays;
    }

    /**
     * Get staff attendance summary for a specific month
     */
    private function getStaffMonthSummary($staffId, $month, $tenantId)
    {
        $records = $this->db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('staff_id', $staffId)
            ->where('DATE_FORMAT(date, "%Y-%m") =', $month)
            ->get()->getResultArray();

        // Count actual recorded days for this staff member
        $totalRecordedDays = count($records);
        
        $summary = [
            'present' => 0,
            'late' => 0,
            'onLeave' => 0,
            'attendanceRate' => 0,
        ];

        foreach ($records as $r) {
            $status = $r['status'];
            if ($status === 'present') $summary['present']++;
            elseif ($status === 'late') $summary['late']++;
            elseif ($status === 'on_leave') $summary['onLeave']++;
        }

        $attendedDays = $summary['present'] + $summary['late'];
        $summary['attendanceRate'] = $totalRecordedDays > 0 
            ? round(($attendedDays / $totalRecordedDays) * 100, 1) 
            : 0;

        return $summary;
    }
}
