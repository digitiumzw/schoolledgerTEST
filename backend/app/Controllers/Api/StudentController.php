<?php

namespace App\Controllers\Api;

use App\Models\StudentModel;
use App\Models\ClassModel;
use App\Models\EnrollmentModel;
use App\Models\SubscriptionPlanModel;
use App\Models\SchoolSubscriptionModel;
use App\Services\AcademicSessionService;
use App\Services\StudentReconciliationService;
use App\Services\StudentIdentityService;
use App\Services\StudentSnapshotService;
use App\Services\StudentStatusService;
use App\Services\TransportAssignmentService;
use App\Services\EmailService;
use App\Models\UserModel;
use App\Models\TenantModel;

class StudentController extends BaseApiController
{
    protected StudentModel $studentModel;
    protected ClassModel $classModel;
    protected EnrollmentModel $enrollmentModel;
    protected AcademicSessionService $sessionService;
    protected StudentSnapshotService $snapshotService;
    protected StudentIdentityService $identityService;
    protected StudentReconciliationService $reconciliationService;
    protected StudentStatusService $studentStatusService;
    protected TransportAssignmentService $transportAssignmentService;

    public function __construct()
    {
        $this->studentModel    = new StudentModel();
        $this->classModel      = new ClassModel();
        $this->enrollmentModel = new EnrollmentModel();
        $this->sessionService        = new AcademicSessionService();
        $this->snapshotService       = new StudentSnapshotService();
        $this->identityService       = new StudentIdentityService();
        $this->reconciliationService = new StudentReconciliationService($this->snapshotService);
        $this->studentStatusService       = new StudentStatusService();
        $this->transportAssignmentService = new TransportAssignmentService();
    }

    /**
     * GET /api/students
     * Returns all students with ledger-based balance calculation and statistics
     * Query parameters: classId, search, balanceOnly, page, limit
     */
    public function index()
    {
        $tenantId = $this->getTenantId();

        $pagination = $this->normalisePaginationParams(50, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $sort = $this->normaliseSortParams(['name', 'class', 'balance', 'status', 'admissionNumber'], 'name', 'asc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $classId = $this->request->getGet('classId');
        $status = $this->request->getGet('status') ?: null;
        $search = $this->sanitiseString($this->request->getGet('search'));
        $balanceOnly = $this->request->getGet('balanceOnly') === 'true';
        $validStatuses = ['all', 'active', 'inactive', 'graduated', 'transferred', 'dropped_out'];

        if ($status !== null && !in_array($status, $validStatuses, true)) {
            return $this->error('Invalid status value.', 400);
        }

        if ($classId) {
            $class = $this->classModel->where('id', $classId)->where('tenant_id', $tenantId)->first();
            if (!$class) {
                return $this->notFound('Class not found');
            }
        }
        
        // Get paginated students directly from database
        $students = $this->studentModel->getFilteredStudents(
            $tenantId,
            $classId ?: null,
            $status,
            $search !== '' ? $search : null,
            $balanceOnly,
            $sort['sortBy'],
            $sort['sortOrder'],
            $pagination['limit'],
            $pagination['offset']
        );
        
        // Get total count for pagination
        $totalCount = $this->studentModel->getFilteredStudentsCount(
            $tenantId,
            $classId ?: null,
            $status,
            $search !== '' ? $search : null,
            $balanceOnly
        );
        
        // Format students for API
        $formattedStudents = array_map(
            fn($s) => $this->studentModel->formatForApi($s),
            $students
        );
        
        // Get enrollment data for students (batch query)
        if (!empty($formattedStudents)) {
            $studentIds = array_column($formattedStudents, 'id');
            $enrollments = $this->enrollmentModel->getBatchCurrentEnrollments($studentIds);
            
            // Map enrollments to students
            foreach ($formattedStudents as &$student) {
                $enrollment = $enrollments[$student['id']] ?? null;
                $student['currentEnrollment'] = $enrollment ? $this->enrollmentModel->formatForApi($enrollment) : null;
            }
        }

        // Calculate accurate statistics across ALL filtered students (not just current page)
        $stats = $this->calculateAggregateStats($tenantId, $classId ?: null, $status, $search !== '' ? $search : null);

        return $this->success([
            'students' => $formattedStudents,
            'stats' => $stats,
            'pagination' => $this->buildPaginationMeta($totalCount, $pagination['page'], $pagination['limit']),
            'filters' => [
                'classId' => $classId ?: null,
                'status' => $status ?? 'active',
                'search' => $search,
                'balanceOnly' => $balanceOnly,
            ],
            'sort' => $sort,
        ]);
    }

    /**
     * GET /api/students/:id
     */
    public function show($id = null)
    {
        $tenantId = $this->getTenantId();
        $student = $this->studentModel->where('id', $id)->where('tenant_id', $tenantId)->first();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        return $this->success($this->studentModel->formatForApi($student));
    }

    public function identity($id = null)
    {
        if (!$id) {
            return $this->error('Student ID is required', 400);
        }

        $data = $this->identityService->getIdentity($this->getTenantId(), $id);
        if (!$data) {
            return $this->notFound('Student not found');
        }

        return $this->success($data, 'Student identity retrieved');
    }

    public function timeline($id = null)
    {
        if (!$id) {
            return $this->error('Student ID is required', 400);
        }

        try {
            $data = $this->identityService->getTimeline($this->getTenantId(), $id, [
                'from' => $this->request->getGet('from'),
                'to' => $this->request->getGet('to'),
                'academicYear' => $this->request->getGet('academicYear'),
                'types' => $this->request->getGet('types'),
                'limit' => $this->request->getGet('limit'),
                'page' => $this->request->getGet('page'),
            ]);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 400);
        }

        if (!$data) {
            return $this->notFound('Student not found');
        }

        return $this->success($data, 'Student timeline retrieved');
    }

    public function getProfileHistory($id = null)
    {
        if (!$id) {
            return $this->error('Student ID is required', 400);
        }

        try {
            $data = $this->identityService->getProfileHistory($this->getTenantId(), $id, [
                'fieldName' => $this->request->getGet('fieldName'),
                'from' => $this->request->getGet('from'),
                'to' => $this->request->getGet('to'),
            ]);
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 400);
        }

        if (!$data) {
            return $this->notFound('Student not found');
        }

        return $this->success($data, 'Profile history retrieved');
    }

    public function recordProfileHistory($id = null)
    {
        if ($guard = $this->requireRole('admin', 'super_admin')) {
            return $guard;
        }
        if (!$id) {
            return $this->error('Student ID is required', 400);
        }

        $user = $this->getCurrentUser();

        try {
            $data = $this->identityService->recordProfileChange(
                $this->getTenantId(),
                $id,
                $this->getRequestBody(),
                $user->id ?? 'system'
            );
        } catch (\InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        } catch (\RuntimeException $e) {
            $code = (int) $e->getCode();
            return $this->error($e->getMessage(), $code >= 400 && $code < 600 ? $code : 500);
        }

        return $this->created($data, 'Student profile change recorded');
    }

    /**
     * GET /api/students/:id/profile
     * Get complete student profile data in one call
     */
    public function getProfile($id = null)
    {
        if (!$id) {
            return $this->error('Student ID is required');
        }

        $tenantId = $this->getTenantId();
        
        // Get student
        $student = $this->studentModel->where('id', $id)
                                      ->where('tenant_id', $tenantId)
                                      ->first();
        
        if (!$student) {
            return $this->notFound('Student not found');
        }

        // Get all related data in parallel
        $db = \Config\Database::connect();
        
        // Get class info with teacher name and student count
        $class = $db->table('classes')
                    ->where('id', $student['class_id'])
                    ->get()
                    ->getRowArray();
        
        // Get teacher name if class exists
        $teacherName = 'Unassigned';
        if ($class && $class['teacher_id']) {
            $teacher = $db->table('staff')
                          ->where('id', $class['teacher_id'])
                          ->get()
                          ->getRowArray();
            if ($teacher) {
                $teacherName = $teacher['first_name'] . ' ' . $teacher['last_name'];
            }
        }
        
        // Get student count for this class
        $classStudentCount = 0;
        if ($class) {
            $classStudentCount = $db->table('students s')
                ->join('enrollments e', 'e.id = s.current_enrollment_id')
                ->where('s.class_id', $class['id'])
                ->where('s.status', 'active')
                ->where('e.status', EnrollmentModel::STATUS_ACTIVE)
                ->countAllResults();
        }
        
        // Add teacher name and student count to class data
        if ($class) {
            $class['teacherName'] = $teacherName;
            $class['studentCount'] = $classStudentCount;
        }

        // Get payments (all, ordered newest first)
        $payments = $db->table('payments')
                       ->where('student_id', $id)
                       ->where('tenant_id', $tenantId)
                       ->orderBy('date', 'DESC')
                       ->get()
                       ->getResultArray();

        // Get charges — exclude soft-deleted (undone) charges
        $charges = $db->table('charges')
                      ->where('student_id', $id)
                      ->where('tenant_id', $tenantId)
                      ->where('deleted_at', null)
                      ->orderBy('date_generated', 'DESC')
                      ->get()
                      ->getResultArray();

        $attendanceMonth = $this->validatedMonth($this->request->getGet('attendanceMonth'));
        $attendanceYear = $this->validatedYear($this->request->getGet('attendanceYear'));
        $classMonth = $this->validatedMonth($this->request->getGet('classMonth'));
        $classYear = $this->validatedYear($this->request->getGet('classYear'));

        if (($this->request->getGet('attendanceMonth') !== null && $attendanceMonth === null)
            || ($this->request->getGet('attendanceYear') !== null && $attendanceYear === null)
            || ($this->request->getGet('classMonth') !== null && $classMonth === null)
            || ($this->request->getGet('classYear') !== null && $classYear === null)) {
            return $this->error('Invalid month or year filter', 400);
        }

        $attendanceRecords = $db->table('student_attendance')
            ->where('student_id', $id)
            ->get()
            ->getResultArray();

        $attendanceSummary = [
            'total' => count($attendanceRecords),
            'present' => 0,
            'absent' => 0,
            'late' => 0,
            'excused' => 0,
        ];

        foreach ($attendanceRecords as $record) {
            if (isset($attendanceSummary[$record['status']])) {
                $attendanceSummary[$record['status']]++;
            }
        }

        // Calculate attendance rate
        $attendanceSummary['attendanceRate'] = $attendanceSummary['total'] > 0 
            ? round(($attendanceSummary['present'] + $attendanceSummary['late']) / $attendanceSummary['total'] * 100, 1) 
            : 0;

        $recentAttendanceBuilder = $db->table('student_attendance')
            ->where('student_id', $id);
        $this->applyMonthYearFilter($recentAttendanceBuilder, 'date', $attendanceMonth, $attendanceYear);
        $recentAttendance = $recentAttendanceBuilder
            ->orderBy('date', 'DESC')
            ->limit(100)
            ->get()
            ->getResultArray();
        $attendanceFilterOptions = $this->availableMonthYearOptions('student_attendance', 'date', $id, $tenantId);

        // Get balance data using LedgerService — single authoritative source of truth
        $balanceData = (new \App\Services\LedgerService($db))->getStudentBalance($id, $tenantId);

        // Get current enrollment
        $currentEnrollment = $this->enrollmentModel->getCurrentEnrollment($id);

        $enrollmentHistory = $this->enrollmentModel->getStudentHistory($id);
        $classFilterOptions = $this->availableMonthYearOptions('enrollments', 'enrollment_date', $id, $tenantId);
        if ($classMonth !== null || $classYear !== null) {
            $enrollmentHistory = array_values(array_filter($enrollmentHistory, function ($entry) use ($classMonth, $classYear) {
                $date = $entry['enrollment_date'] ?? null;
                if (!$date) {
                    return false;
                }
                $time = strtotime($date);
                if ($time === false) {
                    return false;
                }
                if ($classMonth !== null && (int) date('n', $time) !== $classMonth) {
                    return false;
                }
                if ($classYear !== null && (int) date('Y', $time) !== $classYear) {
                    return false;
                }
                return true;
            }));
        }

        // Get active transport allocation for this student (new normalized system)
        $transportAllocation = $db->table('transport_student_allocations tsa')
            ->select('tsa.id, tsa.student_id, tsa.route_id, tsa.stop_id, tsa.direction, tsa.academic_year, tsa.start_date, tsa.end_date, tsa.status, tsa.notes, ts.name AS stop_name')
            ->join('transport_stops ts', 'ts.id = tsa.stop_id', 'left')
            ->where('tsa.student_id', $id)
            ->where('tsa.status', 'active')
            ->orderBy('tsa.created_at', 'DESC')
            ->limit(1)
            ->get()
            ->getRowArray();

        $transportRouteRaw = null;
        $currentPeriod     = null;
        if ($transportAllocation) {
            $transportRouteRaw = $db->table('transport_routes')
                ->where('id', $transportAllocation['route_id'])
                ->get()
                ->getRowArray();

            $currentPeriod = $db->table('transport_route_periods rp')
                ->select('rp.id AS period_id, rp.academic_year, v.id AS vehicle_id, v.name AS vehicle_name, v.reg_number, v.type AS vehicle_type, v.capacity, d.id AS driver_id, d.name AS driver_name, d.phone AS driver_phone')
                ->join('transport_vehicles v', 'v.id = rp.vehicle_id')
                ->join('transport_drivers d', 'd.id = rp.driver_id', 'left')
                ->where('rp.route_id', $transportAllocation['route_id'])
                ->where('rp.status', 'active')
                ->orderBy('rp.created_at', 'DESC')
                ->limit(1)
                ->get()
                ->getRowArray();
        }

        $transportRoute = $transportRouteRaw ? [
            'id'          => $transportRouteRaw['id'],
            'tenantId'    => $transportRouteRaw['tenant_id'],
            'routeName'   => $transportRouteRaw['route_name'],
            'monthlyFee'  => (float) ($transportRouteRaw['monthly_fee'] ?? 0),
            'status'      => $transportRouteRaw['status'],
            'stops'       => [],
            'stopCount'   => 0,
            'vehicle'     => $currentPeriod ? [
                'id'        => $currentPeriod['vehicle_id'],
                'name'      => $currentPeriod['vehicle_name'],
                'regNumber' => $currentPeriod['reg_number'] ?? null,
                'type'      => $currentPeriod['vehicle_type'],
                'capacity'  => (int) ($currentPeriod['capacity'] ?? 0),
            ] : null,
            'driver'      => ($currentPeriod && $currentPeriod['driver_id']) ? [
                'id'    => $currentPeriod['driver_id'],
                'name'  => $currentPeriod['driver_name'],
                'phone' => $currentPeriod['driver_phone'] ?? null,
            ] : null,
            'periodId'    => $currentPeriod['period_id'] ?? null,
            'academicYear' => $currentPeriod['academic_year'] ?? null,
        ] : null;

        $transportAllocationFormatted = $transportAllocation ? [
            'id'           => $transportAllocation['id'],
            'studentId'    => $transportAllocation['student_id'],
            'studentName'  => '',
            'studentClass' => '',
            'routeId'      => $transportAllocation['route_id'],
            'routeName'    => $transportRouteRaw['route_name'] ?? '',
            'stopId'       => $transportAllocation['stop_id'] ?? null,
            'stopName'     => $transportAllocation['stop_name'] ?? null,
            'direction'    => $transportAllocation['direction'],
            'academicYear' => $transportAllocation['academic_year'],
            'startDate'    => $transportAllocation['start_date'] ?? null,
            'endDate'      => $transportAllocation['end_date'] ?? null,
            'status'       => $transportAllocation['status'],
            'notes'        => $transportAllocation['notes'] ?? null,
        ] : null;

        // Fetch status history for the profile response
        $statusHistoryRows = $db->table('student_status_history ssh')
            ->select('ssh.*, u.name as changed_by_name_raw')
            ->join('users u', 'u.id = ssh.changed_by_user_id', 'left')
            ->where('ssh.student_id', $id)
            ->where('ssh.tenant_id', $tenantId)
            ->orderBy('ssh.created_at', 'DESC')
            ->get()
            ->getResultArray();

        $statusHistory = array_map(fn($r) => [
            'id'             => $r['id'],
            'studentId'      => $r['student_id'],
            'previousStatus' => $r['previous_status'],
            'newStatus'      => $r['new_status'],
            'effectiveDate'  => $r['effective_date'],
            'reason'         => $r['reason'],
            'changedByUserId' => $r['changed_by_user_id'],
            'changedByName'  => $r['changed_by_name_raw'] ?? 'System',
            'createdAt'      => $r['created_at'],
        ], $statusHistoryRows);

        // Format and return data
        return $this->success([
            'student' => $this->studentModel->formatForApi($student),
            'class' => $class,
            'payments' => array_map(fn($p) => [
                'id'          => $p['id'],
                'amount'      => (float) $p['amount'],
                'date'        => $p['date'],
                'method'      => $p['method'],
                'category'    => $p['category'] ?? '',
                'description' => $p['description'] ?? '',
                'routeId'     => $p['route_id'] ?? null,
            ], $payments),
            'charges' => array_map(fn($c) => [
                'id'              => $c['id'],
                'amount'          => (float) $c['amount'],
                'dateGenerated'   => $c['date_generated'],
                'dueDate'         => $c['due_date'] ?? null,
                'category'        => $c['category'],
                'chargeType'      => $c['charge_type'] ?? 'fee_structure',
                'status'          => $c['status'] ?? 'pending',
                'description'     => $c['description'] ?? '',
                'termId'          => $c['term_id'] ?? null,
                'isOpeningBalance' => (bool) ($c['is_opening_balance'] ?? false),
                'generationBatchId' => $c['generation_batch_id'] ?? null,
            ], $charges),
            'attendanceSummary' => $attendanceSummary,
            'recentAttendance' => array_map(fn($a) => [
                'id'      => $a['id'],
                'date'    => $a['date'],
                'status'  => $a['status'],
                'remarks' => $a['remarks'] ?? '',
            ], $recentAttendance),
            'filterOptions' => [
                'attendance' => $attendanceFilterOptions,
                'classHistory' => $classFilterOptions,
            ],
            'balanceData' => $balanceData,
            'transportAllocation' => $transportAllocationFormatted,
            'transportRoute'      => $transportRoute,
            'currentEnrollment'   => $currentEnrollment,
            'enrollmentHistory'   => array_map([$this->enrollmentModel, 'formatForApi'], $enrollmentHistory),
            'statusHistory'       => $statusHistory,
        ]);
    }

    /**
     * POST /api/students
     */
    public function create()
    {
        $data     = $this->getRequestBody();
        $tenantId = $this->getTenantId();

        // Subscription enforcement: block add if over student limit
        $subModel  = new SchoolSubscriptionModel();
        $activeSub = $subModel->getActiveForTenant($tenantId);
        if ($activeSub) {
            $planModel = new SubscriptionPlanModel();
            $plan      = $planModel->getPlanById($activeSub['plan_id']);
            if ($plan && $plan['max_students'] !== null) {
                $currentCount = $this->studentModel->where('tenant_id', $tenantId)
                                                   ->where('status', 'active')
                                                   ->countAllResults();
                if ($currentCount >= (int) $plan['max_students']) {
                    $this->notifyAdminsStudentLimitReached($tenantId, $plan['name'], (int) $plan['max_students'], $currentCount);
                    return $this->error(
                        'Student limit reached for your current plan. Please upgrade to add more students.',
                        403
                    );
                }
            }
        } else {
            $currentCount = $this->studentModel->where('tenant_id', $tenantId)
                                               ->where('status', 'active')
                                               ->countAllResults();
            if ($currentCount >= 49) {
                $this->notifyAdminsStudentLimitReached($tenantId, 'Free Tier', 49, $currentCount);
                return $this->error(
                    'No active subscription found. Please subscribe to a plan to add more students.',
                    403
                );
            }
        }

        // Validate required fields
        $firstName = trim($data['firstName'] ?? '');
        $lastName  = trim($data['lastName']  ?? '');
        $classId   = trim($data['classId']   ?? '');

        if ($firstName === '') {
            return $this->error('First name is required', 400);
        }
        if ($lastName === '') {
            return $this->error('Last name is required', 400);
        }
        if ($classId === '') {
            return $this->error('Class is required', 400);
        }

        // Verify the class belongs to this tenant
        $classExists = \Config\Database::connect()
            ->table('classes')
            ->where('id', $classId)
            ->where('tenant_id', $tenantId)
            ->countAllResults();

        if (!$classExists) {
            return $this->error('Class not found or does not belong to your organisation', 404);
        }

        $studentId   = $this->generateId('s');
        $studentData = $this->studentModel->formatFromApi($data, $tenantId);
        $studentData['id'] = $studentId;

        // Resolve admission number: use provided value or auto-generate
        if (empty($studentData['admission_number'])) {
            $studentData['admission_number'] = $this->studentModel->generateAdmissionNumber($tenantId);
        } else {
            // Validate uniqueness of the provided admission number
            $existing = \Config\Database::connect()
                ->table('students')
                ->where('tenant_id', $tenantId)
                ->where('admission_number', $studentData['admission_number'])
                ->countAllResults();
            if ($existing > 0) {
                return $this->error(
                    'Admission number ' . $studentData['admission_number'] . ' is already in use at this school.',
                    422
                );
            }
        }

        if (!$this->studentModel->insert($studentData)) {
            return $this->error('Failed to create student', 500, $this->studentModel->errors());
        }

        // Record initial enrollment status history
        $user = $this->getCurrentUser();
        $this->studentModel->recordStatusHistory(
            $tenantId,
            $studentId,
            null,
            'active',
            $studentData['enrollment_date'],
            'Initial enrollment',
            $user->id ?? 'system'
        );

        // Create initial enrollment record
        $currentSession = $data['academicSession'] ?? $this->sessionService->getCurrentSession($tenantId);
        $this->enrollmentModel->enrollStudent([
            'tenant_id' => $tenantId,
            'student_id' => $studentId,
            'class_id' => $studentData['class_id'],
            'academic_session' => $currentSession,
            'status' => EnrollmentModel::STATUS_ACTIVE,
            'enrollment_date' => date('Y-m-d'),
            'remarks' => 'Initial enrollment'
        ]);

        // Snapshot derives from the new ACTIVE enrollment.
        $this->snapshotService->syncFromActiveEnrollment($studentId);

        // Handle opening balance if provided
        if (!empty($data['openingBalance']) && $data['openingBalance'] > 0) {
            $this->createOpeningBalanceCharge($studentId, $data['openingBalance'], $data['balanceReason'] ?? 'Opening balance');
        }

        $student = $this->studentModel->find($studentId);
        return $this->created($this->studentModel->formatForApi($student));
    }

    /**
     * Create opening balance charge for new student as a fee rule charge
     * 
     * Opening balances represent money owed before the system went live.
     * They are now created as proper fee rule charges to ensure consistency
     * with the fee structure billing system.
     */
    private function createOpeningBalanceCharge(string $studentId, float $amount, string $reason)
    {
        $db = \Config\Database::connect();
        $tenantId = $this->getTenantId();
        $user = $this->getCurrentUser();
        
        // Get or create the "Opening Balance" fee rule
        $feeRuleId = $this->getOrCreateOpeningBalanceFeeRule($tenantId, $user->id ?? 'system');
        
        $chargeData = [
            'id'                  => $this->generateId('c'),
            'tenant_id'           => $tenantId,
            'student_id'          => $studentId,
            'fee_rule_id'         => $feeRuleId,
            'category'            => 'Opening Balance',
            'charge_type'         => 'fee_structure',  // counts in fee-structure balance
            'status'              => 'pending',         // will be updated by FIFO on payment
            'amount'              => $amount,
            'description'         => $reason ?: 'Balance brought forward from previous system',
            'date_generated'      => date('Y-m-d'),
            'due_date'            => null,
            'billing_period'      => null,  // Opening balances are not tied to billing periods
            'is_opening_balance'  => 1,
            'created_by'          => $user->id ?? 'system',
            'created_at'          => date('Y-m-d H:i:s'),
            'updated_at'          => date('Y-m-d H:i:s'),
        ];
        
        $db->table('charges')->insert($chargeData);
        
        log_message('info', "Opening balance fee rule charge created for student {$studentId}: {$amount} - {$reason}");
    }

    /**
     * Get existing "Opening Balance" fee rule or create one if it doesn't exist
     */
    private function getOrCreateOpeningBalanceFeeRule(string $tenantId, string $createdBy): string
    {
        $db = \Config\Database::connect();
        
        // Check if opening balance fee rule already exists
        $existingRule = $db->table('fee_rules')
            ->where('tenant_id', $tenantId)
            ->where('name', 'Opening Balance')
            ->where('is_active', 1)
            ->get()
            ->getRowArray();
            
        if ($existingRule) {
            return $existingRule['id'];
        }
        
        // Create the opening balance fee rule
        $feeRuleId = $this->generateId('frl_');
        $ruleData = [
            'id'                    => $feeRuleId,
            'tenant_id'             => $tenantId,
            'name'                  => 'Opening Balance',
            'amount'                => 0,  // Amount varies per student
            'assignment_scope_type' => 'school_wide',
            'assignment_scope_id'   => null,
            'is_active'             => 1,
            'created_by'            => $createdBy,
            'created_at'            => date('Y-m-d H:i:s'),
            'updated_at'            => date('Y-m-d H:i:s'),
        ];
        
        $db->table('fee_rules')->insert($ruleData);
        
        log_message('info', "Opening Balance fee rule created for tenant {$tenantId}: {$feeRuleId}");
        
        return $feeRuleId;
    }

    /**
     * PUT /api/students/:id
     * Admin-only: edit student profile fields.
     */
    public function update($id = null)
    {
        // Enforce admin-only access
        if ($guard = $this->requireRole('admin', 'super_admin')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();
        $student = $this->studentModel->where('id', $id)->where('tenant_id', $tenantId)->first();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $updateData = $this->studentModel->formatFromApi($data, $student['tenant_id']);

        if (
            (isset($data['status']) && ($data['status'] ?? null) !== ($student['status'] ?? null)) ||
            (isset($data['studentStatus']) && ($data['studentStatus'] ?? null) !== ($student['status'] ?? null))
        ) {
            return $this->error('Student status changes must use the dedicated status-change workflow', 409);
        }

        $requestedClassId = $data['classId'] ?? $data['class_id'] ?? null;
        $classChanged = $requestedClassId !== null && $requestedClassId !== ($student['class_id'] ?? null);
        if ($classChanged) {
            $targetClass = $this->classModel->where('id', $requestedClassId)->where('tenant_id', $tenantId)->first();
            if (!$targetClass) {
                return $this->error('Selected class was not found', 422);
            }
        }

        unset($updateData['class_id'], $updateData['current_enrollment_id'], $updateData['status']);

        $profileHistoryUpdates = [];
        foreach ($updateData as $field => $value) {
            if ($this->identityService->normaliseFieldName($field) === $field && in_array($field, \App\Models\StudentProfileHistoryModel::MUTABLE_FIELDS, true)) {
                $currentValue = $student[$field] ?? null;
                $newValue = $value === null ? null : (string) $value;
                $oldValue = $currentValue === null ? null : (string) $currentValue;
                if ($oldValue !== $newValue) {
                    $profileHistoryUpdates[$field] = $value;
                }
            }
        }

        if (!empty($profileHistoryUpdates) && empty($data['profileChangeReason'])) {
            return $this->error('profileChangeReason is required when updating historical profile fields', 422);
        }

        // Validate admission number uniqueness if it is being changed
        if (!empty($updateData['admission_number']) && $updateData['admission_number'] !== $student['admission_number']) {
            $existing = \Config\Database::connect()
                ->table('students')
                ->where('tenant_id', $tenantId)
                ->where('admission_number', $updateData['admission_number'])
                ->where('id !=', $id)
                ->countAllResults();
            if ($existing > 0) {
                return $this->error(
                    'Admission number ' . $updateData['admission_number'] . ' is already in use at this school.',
                    422
                );
            }
        }

        $db = \Config\Database::connect();
        $db->transStart();

        if (!empty($profileHistoryUpdates)) {
            try {
                $user = $this->getCurrentUser();
                foreach ($profileHistoryUpdates as $field => $value) {
                    $this->identityService->recordProfileChange($tenantId, $id, [
                        'fieldName' => $field,
                        'newValue' => $value,
                        'changeType' => $data['profileChangeType'] ?? 'historical_change',
                        'effectiveDate' => $data['profileChangeEffectiveDate'] ?? date('Y-m-d'),
                        'reason' => $data['profileChangeReason'],
                    ], $user->id ?? 'system');
                    unset($updateData[$field]);
                }
            } catch (\InvalidArgumentException $e) {
                $db->transRollback();
                return $this->error($e->getMessage(), 422);
            } catch (\Exception $e) {
                $db->transRollback();
                return $this->error('Failed to record profile history: ' . $e->getMessage(), 500);
            }
        }

        if (!empty($updateData)) {
            if (!$this->studentModel->update($id, $updateData)) {
                $db->transRollback();
                return $this->error('Failed to update student', 500, $this->studentModel->errors());
            }
        }

        if ($classChanged) {
            $previousStatus = $student['status'] ?? 'active';
            if ($previousStatus !== 'active') {
                if (!$this->studentModel->update($id, [
                    'status' => 'active',
                    'updated_at' => date('Y-m-d H:i:s'),
                ])) {
                    $db->transRollback();
                    return $this->error('Failed to activate student for class assignment', 500, $this->studentModel->errors());
                }

                $user = $this->getCurrentUser();
                $this->studentModel->recordStatusHistory(
                    $tenantId,
                    $id,
                    $previousStatus,
                    'active',
                    date('Y-m-d'),
                    'Automatically activated after class assignment via Edit Student modal',
                    $user->id ?? 'system'
                );

                $this->studentStatusService->handleStatusChange(
                    $tenantId,
                    $id,
                    $previousStatus,
                    'active',
                    date('Y-m-d')
                );
            }

            $currentEnrollment = $this->enrollmentModel->getCurrentEnrollment($id);
            if ($currentEnrollment) {
                $this->enrollmentModel->update($currentEnrollment['id'], [
                    'status' => EnrollmentModel::STATUS_TRANSFERRED,
                    'completion_date' => date('Y-m-d'),
                    'remarks' => 'Transferred to class via Edit Student modal',
                ]);
            }

            $newEnrollmentId = $this->enrollmentModel->enrollStudent([
                'tenant_id' => $tenantId,
                'student_id' => $id,
                'class_id' => $requestedClassId,
                'academic_session' => $this->sessionService->getCurrentSession($tenantId),
                'status' => EnrollmentModel::STATUS_ACTIVE,
                'enrollment_date' => date('Y-m-d'),
                'remarks' => 'Assigned to class via Edit Student modal',
            ]);

            $this->studentModel->update($id, ['current_enrollment_id' => $newEnrollmentId]);
            $this->snapshotService->syncFromActiveEnrollment($id);
        }

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->error('Failed to update student', 500);
        }

        $updated = $this->studentModel->find($id);
        return $this->success($this->studentModel->formatForApi($updated));
    }

    /**
     * DELETE /api/students/:id
     */
    public function delete($id = null)
    {
        $student = $this->studentModel->find($id);
        
        if (!$student) {
            return $this->notFound('Student not found');
        }

        try {
            $this->studentModel->delete($id);
        } catch (\RuntimeException $e) {
            return $this->setCorsHeaders($this->respond([
                'success' => false,
                'message' => $e->getMessage(),
                'code'    => 'FINANCIAL_RECORDS_EXIST',
            ], 422));
        }

        return $this->success(['success' => true, 'id' => $id], 'Student deleted successfully');
    }

    /**
     * GET /api/students/search
     * Search students
     */
    public function search()
    {
        $tenantId = $this->getTenantId();
        $query    = $this->request->getGet('query')   ?? '';
        $classId  = $this->request->getGet('classId') ?? '';
        $limit    = max(1, min(50, (int) ($this->request->getGet('limit') ?? 20)));

        // Get students
        $students = $this->studentModel->search($tenantId, $query, $classId, $limit);
        
        // Format for API response
        $formatted = array_map(
            fn($s) => [
                'id'              => $s['id'],
                'studentId'       => $s['id'],
                'firstName'       => $s['first_name'] ?? '',
                'lastName'        => $s['last_name'] ?? '',
                'studentName'     => trim(($s['first_name'] ?? '') . ' ' . ($s['last_name'] ?? '')),
                'admissionNumber' => $s['admission_number'] ?? '',
                'classId'         => $s['class_id'] ?? '',
                'className'       => $s['class_name'] ?? '',
                'studentClass'    => $s['class_name'] ?? '',
                'status'          => $s['status'] ?? 'active',
                'balance'         => 0,
            ],
            $students
        );

        return $this->success($formatted, 'Success', 200, [
            'total'   => count($formatted),
            'page'    => 1,
            'limit'   => $limit,
            'hasMore' => false,
        ]);
    }

    /**
     * GET /api/students/count
     * Query parameters: status (default: 'active'), classId (optional)
     */
    public function count()
    {
        $tenantId = $this->getTenantId();
        $status = $this->request->getGet('status') ?? 'active';
        $classId = $this->request->getGet('classId');

        $db = \Config\Database::connect();
        $builder = $db->table('students')
            ->where('tenant_id', $tenantId);

        if ($status) {
            $builder->where('status', $status);
        }

        if ($classId) {
            $builder->where('class_id', $classId);
        }

        $count = $builder->countAllResults();

        return $this->success(['count' => $count]);
    }

    /**
     * GET /api/students/by-class/:classId
     *
     * Returns students in a class. By default only active students are
     * returned (?status=active). Pass ?status=all to include every record
     * regardless of status, or any specific status value to filter by it.
     */
    public function byClass($classId = null)
    {
        $status = $this->request->getGet('status') ?? 'active';
        $students = $this->studentModel->getByClass($classId, $status);

        $formatted = array_map(
            fn($s) => $this->studentModel->formatForApi($s),
            $students
        );

        return $this->success($formatted);
    }

    /**
     * POST /api/students/promote
     * Backend-driven promotion: Automatically promotes students to next sequential class
     * 
     * Request body options:
     * 1. Promote all eligible students from specific classes:
     *    { "classIds": ["class1", "class2"], "academicSession": "2024/2025" }
     * 2. Promote specific students:
     *    { "studentIds": ["student1", "student2"], "academicSession": "2024/2025" }
     * 3. Promote all eligible students from all classes:
     *    { "academicSession": "2024/2025" } or {} for current session (defaults to YYYY/YYYY+1 based on current year)
     */
    public function promote()
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $tenantId = $this->getTenantId();
        
        // Determine academic session - use provided or current year (always YYYY/YYYY+1)
        $academicSession = $data['academicSession'] ?? $this->getCurrentAcademicSession();
        $nextSession = $this->getNextAcademicSession($academicSession);
        
        $results = [
            'promoted' => 0,
            'graduated' => 0,
            'skipped' => 0,
            'errors' => [],
            'promotionDetails' => [],
            'academicSession' => $academicSession,
            'nextSession' => $nextSession
        ];

        try {
            // Get all classes sorted by name
            $allClasses = $this->classModel->getByTenantSortedByName($tenantId);
            
            // Determine which classes to process
            $classesToProcess = [];
            
            if (!empty($data['classIds'])) {
                // Process specific classes
                foreach ($data['classIds'] as $classId) {
                    $class = $this->findClassInArray($allClasses, $classId);
                    if ($class) {
                        $classesToProcess[] = $class;
                    } else {
                        $results['errors'][] = "Class not found: $classId";
                    }
                }
            } elseif (!empty($data['studentIds'])) {
                // Process specific students - group them by current class
                $studentsToPromote = [];
                foreach ($data['studentIds'] as $studentId) {
                    $student = $this->studentModel->find($studentId);
                    if ($student && $student['tenant_id'] === $tenantId) {
                        $studentsToPromote[] = $student;
                    } else {
                        $results['errors'][] = "Student not found: $studentId";
                    }
                }
                
                // Group students by class
                $studentsByClass = [];
                foreach ($studentsToPromote as $student) {
                    $classId = $student['class_id'];
                    if (!isset($studentsByClass[$classId])) {
                        $studentsByClass[$classId] = [];
                    }
                    $studentsByClass[$classId][] = $student;
                }
                
                // Get unique classes to process
                foreach ($studentsByClass as $classId => $students) {
                    $class = $this->findClassInArray($allClasses, $classId);
                    if ($class) {
                        $class['studentsToPromote'] = $students;
                        $classesToProcess[] = $class;
                    } else {
                        // Class is archived/deleted/in another tenant — students cannot
                        // be promoted from a class the system no longer recognises.
                        // Surface this rather than silently dropping them.
                        $count = count($students);
                        $results['skipped'] += $count;
                        $results['errors'][] = sprintf(
                            'Skipped %d student(s) whose class (%s) is archived or no longer exists',
                            $count,
                            $classId
                        );
                    }
                }
            } else {
                // Process all classes
                $classesToProcess = $allClasses;
            }

            // Snapshot eligible students for every class BEFORE the loop starts.
            // Without this, students promoted from class A to class B would be
            // re-queried as eligible when the loop later processes class B, causing
            // a double-promotion cascade (e.g. 1.1→2.1→3.1 in a single run).
            $specificStudentIds = $data['studentIds'] ?? null;
            $preloadedStudents  = [];
            foreach ($classesToProcess as $class) {
                if ($specificStudentIds) {
                    // When specific IDs are supplied, resolve them per class now.
                    $studentsForClass = [];
                    foreach ($specificStudentIds as $studentId) {
                        $student = $this->studentModel->find($studentId);
                        if ($student && $student['class_id'] === $class['id'] && $student['tenant_id'] === $tenantId) {
                            $studentsForClass[] = $student;
                        }
                    }
                    $preloadedStudents[$class['id']] = $studentsForClass;
                } else {
                    $preloadedStudents[$class['id']] = $this->classModel->getStudentsForPromotion($class['id'], $academicSession);
                }
            }

            // Each promoteStudent/graduateStudent call manages its own transaction.
            // Do NOT wrap in an outer transaction here — nested transStart/transRollback
            // in those methods would reset transDepth and corrupt the outer transaction.
            foreach ($classesToProcess as $class) {
                try {
                    $promotionResult = $this->promoteStudentsFromClass(
                        $class,
                        $academicSession,
                        $nextSession,
                        $preloadedStudents[$class['id']]
                    );

                    $results['promoted']  += $promotionResult['promoted'];
                    $results['graduated'] += $promotionResult['graduated'] ?? 0;
                    $results['skipped']   += $promotionResult['skipped'];
                    $results['promotionDetails'][] = $promotionResult;

                    if (!empty($promotionResult['errors'])) {
                        $results['errors'] = array_merge($results['errors'], $promotionResult['errors']);
                    }
                } catch (\Exception $e) {
                    $results['errors'][] = "Failed to process class {$class['name']}: " . $e->getMessage();
                    $results['skipped']  += count($preloadedStudents[$class['id']]);
                }
            }

            $message = "Promoted {$results['promoted']} student(s)";
            if ($results['graduated'] > 0) {
                $message .= ", graduated {$results['graduated']} student(s)";
            }
            if ($results['skipped'] > 0) {
                $message .= ", {$results['skipped']} skipped";
            }

            if (($results['promoted'] + $results['graduated']) > 0) {
                $this->sessionService->setCurrentSession($tenantId, $nextSession);
                $results['activeSessionAdvancedTo'] = $nextSession;
                $message .= ". Active session advanced to {$nextSession}";
            }

            return $this->success($results, $message);
            
        } catch (\Exception $e) {
            return $this->error('Promotion failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Promote students from a specific class to the next class
     */
    /**
     * @param array $preloadedStudents Students already fetched before the promotion loop started,
     *                                  preventing double-promotion when processing multiple classes.
     */
    private function promoteStudentsFromClass(array $class, string $academicSession, string $nextSession, array $preloadedStudents): array
    {
        $result = [
            'classId' => $class['id'],
            'className' => $class['name'],
            'promoted' => 0,
            'skipped' => 0,
            'graduated' => 0,
            'errors' => [],
            'nextClass' => null
        ];

        $studentsToPromote = $preloadedStudents;

        if (empty($studentsToPromote)) {
            return $result;
        }

        // Get next class using the next_class_id field
        $nextClass    = $this->classModel->getNextClass($class['id']);
        $isFinalClass = $this->classModel->isFinalClass($class['id']);

        // Set next class info for result
        if (!$isFinalClass && $nextClass) {
            $result['nextClass'] = [
                'id' => $nextClass['id'],
                'name' => $nextClass['name']
            ];
        }

        // Process each student
        foreach ($studentsToPromote as $student) {
            try {
                if ($isFinalClass) {
                    // Graduate students from final class
                    $this->enrollmentModel->graduateStudent(
                        $student['id'],
                        $class['id'],
                        [
                            'tenant_id' => $student['tenant_id'],
                            'remarks' => 'Graduated from ' . $class['name'] . ' (' . $academicSession . ')'
                        ]
                    );
                    $result['graduated']++;
                } elseif ($nextClass) {
                    // Promote students to next class without capacity constraints
                    $newEnrollmentId = $this->enrollmentModel->promoteStudent(
                        $student['id'],
                        $nextClass['id'],
                        $nextSession,
                        [
                            'tenant_id' => $student['tenant_id'],
                            'remarks' => 'Promoted from ' . $class['name'] . ' to ' . $nextClass['name'] . ' (' . $academicSession . ' → ' . $nextSession . ')'
                        ]
                    );
                    
                    $result['promoted']++;
                } else {
                    // No next class configured and not marked as final — skip with actionable message
                    $result['skipped']++;
                    $result['errors'][] = "No next class configured for {$class['name']} — set next_class_id or mark the class as final to graduate students";
                }
            } catch (\Exception $e) {
                $result['errors'][] = "Failed to promote student {$student['id']}: " . $e->getMessage();
                $result['skipped']++;
            }
        }

        return $result;
    }

    /**
     * Helper method to find class in array by ID
     */
    private function findClassInArray(array $classes, string $classId): ?array
    {
        foreach ($classes as $class) {
            if ($class['id'] === $classId) {
                return $class;
            }
        }
        return null;
    }

    /**
     * Get current academic session.
     *
     * Reads from tenants.settings.activeAcademicSession via AcademicSessionService
     * — falling back to legacy academicYear or date('Y') only when no session is
     * configured. This is the single source of truth.
     */
    private function getCurrentAcademicSession(): string
    {
        return $this->sessionService->getCurrentSession($this->getTenantId());
    }

    /**
     * Get next academic session based on current session.
     */
    private function getNextAcademicSession(string $currentSession): string
    {
        return $this->sessionService->getNextSession($currentSession);
    }

    /**
     * POST /api/students/reconcile
     *
     * Repair drift between students.class_id / current_enrollment_id and the
     * underlying enrollments table. Pass { "dryRun": true } to preview without
     * writing. Admin-only.
     */
    public function reconcile()
    {
        if ($resp = $this->requireRole('admin', 'super_admin')) {
            return $resp;
        }

        $data   = $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
        $dryRun = !empty($data['dryRun']);

        try {
            $summary = $this->reconciliationService->reconcileTenant(
                $this->getTenantId(),
                $dryRun
            );

            $msg = $dryRun
                ? sprintf(
                    'Dry-run: %d would be repaired, %d already in sync, %d need manual review',
                    $summary['repaired'], $summary['synced'], $summary['needsManualReview']
                )
                : sprintf(
                    'Reconciled %d student(s): %d repaired, %d already in sync, %d need manual review',
                    $summary['total'], $summary['repaired'], $summary['synced'], $summary['needsManualReview']
                );

            return $this->success($summary, $msg);
        } catch (\Throwable $e) {
            log_message('error', '[students/reconcile] ' . $e->getMessage());
            return $this->error('Reconciliation failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/students/promotion-preview
     * Preview what would happen during promotion without actually promoting
     */
    public function promotionPreview()
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $tenantId = $this->getTenantId();
        
        // Determine academic session
        $academicSession = $data['academicSession'] ?? $this->getCurrentAcademicSession();
        
        $preview = [
            'classes' => [],
            'totalStudents' => 0,
            'academicSession' => $academicSession
        ];

        try {
            $allClasses = $this->classModel->getByTenantSortedByName($tenantId);
            
            // Determine which classes to preview
            $classesToPreview = [];
            if (!empty($data['classIds'])) {
                foreach ($data['classIds'] as $classId) {
                    $class = $this->findClassInArray($allClasses, $classId);
                    if ($class) {
                        $classesToPreview[] = $class;
                    }
                }
            } else {
                $classesToPreview = $allClasses;
            }

            foreach ($classesToPreview as $class) {
                $nextClass    = $this->classModel->getNextClass($class['id']);
                $isFinal      = $this->classModel->isFinalClass($class['id']);
                $studentsToPromote = $this->classModel->getStudentsForPromotion($class['id'], $academicSession);

                if ($isFinal) {
                    $status = 'final';
                    $action = 'graduate';
                } elseif ($nextClass) {
                    $status = 'promotable';
                    $action = 'promote';
                } else {
                    $status = 'unconfigured';
                    $action = 'skip';
                }

                $classPreview = [
                    'id'               => $class['id'],
                    'name'             => $class['name'],
                    'isFinalClass'     => $isFinal,
                    'status'           => $status,
                    'action'           => $action,
                    'studentsToPromote' => count($studentsToPromote),
                    'nextClass'        => $nextClass ? ['id' => $nextClass['id'], 'name' => $nextClass['name']] : null,
                ];

                $preview['classes'][] = $classPreview;
                $preview['totalStudents'] += count($studentsToPromote);
            }

            return $this->success($preview);
            
        } catch (\Exception $e) {
            return $this->error('Preview failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/students/migration-preview
     * Preview migration details for the frontend modal
     */
    public function migrationPreview()
    {
        $tenantId = $this->getTenantId();
        
        // Determine academic session
        $academicSession = $this->getCurrentAcademicSession();
        $nextSession = $this->getNextAcademicSession($academicSession);
        
        $migrations = [];
        $summary = [
            'totalStudents'    => 0,
            'promotedCount'    => 0,
            'graduatedCount'   => 0,
            'repeatingCount'   => 0,
            'noNextClassCount' => 0,
        ];

        try {
            $allClasses = $this->classModel->getByTenantSortedByName($tenantId);

            foreach ($allClasses as $class) {
                $nextClass    = $this->classModel->getNextClass($class['id']);
                $isFinalClass = $this->classModel->isFinalClass($class['id']);

                // Students eligible for promotion (active, non-repeating status,
                // and enrolled in the current academic session)
                $studentsToPromote  = $this->classModel->getStudentsForPromotion($class['id'], $academicSession);
                $promotableCount    = count($studentsToPromote);

                // Students who will stay back (status = 'repeating')
                $repeatingCount = $this->classModel->getRepeatingStudentCount($class['id']);

                $classTotal = $promotableCount + $repeatingCount;
                if ($classTotal === 0) {
                    continue; // Skip empty classes
                }

                if ($repeatingCount > 0) {
                    $migrations[] = [
                        'fromClass'    => $class['name'],
                        'toClass'      => $class['name'] . ' (staying)',
                        'studentCount' => $repeatingCount,
                        'isGraduation' => false,
                        'isRepeating'  => true,
                    ];
                    $summary['repeatingCount'] += $repeatingCount;
                }

                if ($promotableCount === 0) {
                    $summary['totalStudents'] += $repeatingCount;
                    continue;
                }

                if ($isFinalClass) {
                    $migrations[] = [
                        'fromClass'    => $class['name'],
                        'toClass'      => 'Graduated',
                        'studentCount' => $promotableCount,
                        'isGraduation' => true,
                    ];
                    $summary['graduatedCount'] += $promotableCount;
                } elseif ($nextClass) {
                    $migrations[] = [
                        'fromClass'    => $class['name'],
                        'toClass'      => $nextClass['name'],
                        'studentCount' => $promotableCount,
                        'isGraduation' => false,
                    ];
                    $summary['promotedCount'] += $promotableCount;
                } else {
                    // No next class — distinct from "repeating". This is a config
                    // problem (admin needs to set next_class_id or mark as final).
                    // Surface separately so the UI can call it out.
                    $migrations[] = [
                        'fromClass'    => $class['name'],
                        'toClass'      => 'No next class set',
                        'studentCount' => $promotableCount,
                        'isGraduation' => false,
                        'isNoNextClass' => true,
                    ];
                    $summary['noNextClassCount'] += $promotableCount;
                }

                $summary['totalStudents'] += $classTotal;
            }

            // Surface snapshot drift so admins can reconcile before promoting.
            // Drift students will silently produce "0 promoted" if not repaired.
            $driftCount = $this->reconciliationService->getDriftCount($tenantId);

            $preview = [
                'academicSession'      => $academicSession,
                'nextSession'          => $nextSession,
                'migrations'           => $migrations,
                'summary'              => $summary,
                'reconciliationNeeded' => $driftCount,
            ];

            return $this->success($preview);
            
        } catch (\Exception $e) {
            return $this->error('Migration preview failed: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/students/:id/balance
     * Get ledger-based balance for a specific student.
     * Delegates to LedgerService — single authoritative source of truth.
     */
    public function balance($id = null)
    {
        $tenantId = $this->getTenantId();
        $student = $this->studentModel->where('id', $id)->where('tenant_id', $tenantId)->first();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        $db = \Config\Database::connect();
        $ledgerService = new \App\Services\LedgerService($db);
        $balance = $ledgerService->getStudentBalance($id, $tenantId);

        return $this->success($balance);
    }

    /**
     * PUT /api/students/:id/status/**
     * Change student status with audit logging
     */
    public function changeStatus($id = null)
    {
        $tenantId = $this->getTenantId();
        $student = $this->studentModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        
        if (!$student) {
            return $this->notFound('Student not found');
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $newStatus    = $data['status'] ?? null;
        $effectiveDate = trim($data['effectiveDate'] ?? '');
        $reason       = trim($data['reason'] ?? '');

        // All three fields required
        if (empty($effectiveDate)) {
            return $this->error('effectiveDate is required', 422);
        }
        if (empty($reason)) {
            return $this->error('reason is required', 422);
        }

        // Validate status
        $validStatuses = ['active', 'inactive', 'transferred', 'dropped_out', 'graduated'];
        if (!in_array($newStatus, $validStatuses)) {
            return $this->error('Invalid status. Valid statuses are: ' . implode(', ', $validStatuses), 400);
        }

        $previousStatus = $student['status'];
        if ($previousStatus === $newStatus) {
            return $this->error('Student already has this status', 422);
        }

        // Start transaction for atomic updates
        $db = \Config\Database::connect();
        $db->transStart();

        try {
            // Update student status
            $updateData = [
                'status' => $newStatus,
                'updated_at' => date('Y-m-d H:i:s')
            ];
            
            // Handle enrollment updates based on status change
            switch ($newStatus) {
                case 'graduated':
                    // Complete current enrollment as graduated
                    $this->enrollmentModel->graduateStudent($id, null, ['remarks' => $reason]);
                    break;
                    
                case 'transferred':
                    // Complete current enrollment as transferred
                    $this->enrollmentModel->transferStudent($id, null, ['remarks' => $reason]);
                    // Note: Keep class_id for potential reactivation
                    $updateData['current_enrollment_id'] = null;
                    break;
                    
                case 'dropped_out':
                    // Complete current enrollment as dropped out
                    $this->enrollmentModel->dropOutStudent($id, null, ['remarks' => $reason]);
                    // Note: Keep class_id for potential reactivation
                    $updateData['current_enrollment_id'] = null;
                    break;
                    
                case 'inactive':
                    // Keep enrollment but mark as inactive
                    $currentEnrollment = $this->enrollmentModel->getCurrentEnrollment($id);
                    if ($currentEnrollment) {
                        $this->enrollmentModel->update($currentEnrollment['id'], [
                            'status' => EnrollmentModel::STATUS_INACTIVE,
                            'remarks' => $reason ? 'Status changed to inactive: ' . $reason : 'Status changed to inactive'
                        ]);
                    }
                    break;
                    
                case 'active':
                    // If reactivating, create new enrollment if student doesn't have one
                    $existingEnrollment = $this->enrollmentModel->getCurrentEnrollment($id);
                    
                    if (!$existingEnrollment) {
                        // Check if student has a class assigned
                        if (!$student['class_id']) {
                            $db->transRollback();
                            return $this->error('Cannot reactivate student without a class assignment. Please assign a class first.', 400);
                        }
                        
                        // Create new enrollment for reactivated student
                        $currentSession = date('Y') . '/' . (date('Y') + 1);
                        $enrollmentId = $this->enrollmentModel->enrollStudent([
                            'tenant_id' => $student['tenant_id'],
                            'student_id' => $id,
                            'class_id' => $student['class_id'],
                            'academic_session' => $currentSession,
                            'status' => EnrollmentModel::STATUS_ACTIVE,
                            'enrollment_date' => date('Y-m-d'),
                            'remarks' => $reason ? 'Re-enrolled: ' . $reason : 'Re-enrolled in school'
                        ]);
                        $updateData['current_enrollment_id'] = $enrollmentId;
                    } else {
                        // If enrollment exists but is not active, update it to active
                        if ($existingEnrollment['status'] !== EnrollmentModel::STATUS_ACTIVE) {
                            $this->enrollmentModel->update($existingEnrollment['id'], [
                                'status' => EnrollmentModel::STATUS_ACTIVE,
                                'remarks' => $reason ? 'Reactivated enrollment: ' . $reason : 'Reactivated enrollment'
                            ]);
                        }
                    }
                    break;
            }

            // Update student record
            if (!$this->studentModel->update($id, $updateData)) {
                $db->transRollback();
                return $this->error('Failed to update student status', 500, $this->studentModel->errors());
            }

            $user = $this->getCurrentUser();
            $this->studentModel->recordStatusHistory(
                $student['tenant_id'],
                $id,
                $previousStatus,
                $newStatus,
                $effectiveDate,
                $reason,
                $user->id ?? 'system'
            );

            // Feature 054: Auto-deallocate transport when leaving 'active' status.
            $this->studentStatusService->handleStatusChange(
                $student['tenant_id'],
                $id,
                $previousStatus,
                $newStatus,
                $effectiveDate
            );

            $db->transComplete();

            if ($db->transStatus() === false) {
                return $this->error('Transaction failed while updating student status', 500);
            }

            $updated = $this->studentModel->find($id);
            return $this->success($this->studentModel->formatForApi($updated), 'Student status updated successfully');

        } catch (\Exception $e) {
            $db->transRollback();
            return $this->error('Failed to update student status: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /api/students/bulk-status
     * Bulk status update (e.g., graduate an entire cohort).
     */
    public function bulkChangeStatus()
    {
        if ($guard = $this->requireRole('admin', 'super_admin')) {
            return $guard;
        }

        $tenantId = $this->getTenantId();
        $data     = $this->request->getJSON(true) ?? $this->request->getPost();

        $studentIds    = $data['studentIds'] ?? [];
        $newStatus     = $data['status'] ?? null;
        $effectiveDate = trim($data['effectiveDate'] ?? '');
        $reason        = trim($data['reason'] ?? '');

        if (empty($studentIds) || !is_array($studentIds)) {
            return $this->error('studentIds array is required', 422);
        }
        if (empty($effectiveDate)) {
            return $this->error('effectiveDate is required', 422);
        }
        if (empty($reason)) {
            return $this->error('reason is required', 422);
        }

        $validStatuses = ['active', 'inactive', 'transferred', 'dropped_out', 'graduated'];
        if (!in_array($newStatus, $validStatuses)) {
            return $this->error('Invalid status', 422);
        }

        $user    = $this->getCurrentUser();
        $updated = 0;
        $failed  = [];

        foreach ($studentIds as $sid) {
            $student = $this->studentModel->where('id', $sid)->where('tenant_id', $tenantId)->first();
            if (!$student) {
                $failed[] = $sid;
                continue;
            }
            $previousStatus = $student['status'];
            if ($previousStatus === $newStatus) {
                continue;
            }
            if (!$this->studentModel->update($sid, ['status' => $newStatus, 'updated_at' => date('Y-m-d H:i:s')])) {
                $failed[] = $sid;
                continue;
            }
            $this->studentModel->recordStatusHistory(
                $tenantId,
                $sid,
                $previousStatus,
                $newStatus,
                $effectiveDate,
                $reason,
                $user->id ?? 'system'
            );

            // Feature 054: Auto-deallocate transport when leaving 'active' status.
            $this->studentStatusService->handleStatusChange(
                $tenantId,
                $sid,
                $previousStatus,
                $newStatus,
                $effectiveDate
            );

            $updated++;
        }

        return $this->success([
            'updated' => $updated,
            'failed'  => $failed,
        ], "{$updated} students updated to {$newStatus}");
    }

    /**
     * GET /api/students/:id/status-history
     * Returns the immutable audit trail of status changes for a student.
     */
    public function getStatusHistory($id = null)
    {
        $tenantId = $this->getTenantId();
        $student  = $this->studentModel->where('id', $id)->where('tenant_id', $tenantId)->first();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        $pagination = $this->normalisePaginationParams(10, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $month = $this->validatedMonth($this->request->getGet('month'));
        $year = $this->validatedYear($this->request->getGet('year'));
        if (($this->request->getGet('month') !== null && $month === null)
            || ($this->request->getGet('year') !== null && $year === null)) {
            return $this->error('Invalid month or year filter', 400);
        }

        $db = \Config\Database::connect();
        $builder = $db->table('student_status_history ssh')
            ->select('ssh.*, u.name as changed_by_name_raw')
            ->join('users u', 'u.id = ssh.changed_by_user_id', 'left')
            ->where('ssh.student_id', $id)
            ->where('ssh.tenant_id', $tenantId);
        $this->applyMonthYearFilter($builder, 'ssh.effective_date', $month, $year);
        $total = $builder->countAllResults(false);
        $rows = $builder
            ->orderBy('ssh.created_at', 'DESC')
            ->limit($pagination['limit'], $pagination['offset'])
            ->get()
            ->getResultArray();

        $formatted = array_map(fn($r) => [
            'id'             => $r['id'],
            'studentId'      => $r['student_id'],
            'previousStatus' => $r['previous_status'],
            'newStatus'      => $r['new_status'],
            'effectiveDate'  => $r['effective_date'],
            'reason'         => $r['reason'],
            'changedByUserId' => $r['changed_by_user_id'],
            'changedByName'  => $r['changed_by_name_raw'] ?? 'System',
            'createdAt'      => $r['created_at'],
        ], $rows);

        return $this->success([
            'data' => $formatted,
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
            'filterOptions' => $this->availableMonthYearOptions('student_status_history', 'effective_date', $id, $tenantId),
        ]);
    }

    public function getClassHistory($id = null)
    {
        $tenantId = $this->getTenantId();
        $student = $this->studentModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$student) {
            return $this->notFound('Student not found');
        }

        $pagination = $this->normalisePaginationParams(10, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $month = $this->validatedMonth($this->request->getGet('month'));
        $year = $this->validatedYear($this->request->getGet('year'));
        if (($this->request->getGet('month') !== null && $month === null)
            || ($this->request->getGet('year') !== null && $year === null)) {
            return $this->error('Invalid month or year filter', 400);
        }

        $db = \Config\Database::connect();
        $builder = $db->table('enrollments e')
            ->select('e.*, c.name as class_name, COALESCE(ci.academic_year, e.academic_session) as academic_year_resolved', false)
            ->join('classes c', 'c.id = e.class_id AND c.tenant_id = e.tenant_id', 'left')
            ->join('class_instances ci', 'ci.id = e.class_instance_id', 'left')
            ->where('e.student_id', $id)
            ->where('e.tenant_id', $tenantId);
        $this->applyMonthYearFilter($builder, 'e.enrollment_date', $month, $year);
        $total = $builder->countAllResults(false);
        $rows = $builder
            ->orderBy('e.enrollment_date', 'DESC')
            ->orderBy('e.created_at', 'DESC')
            ->limit($pagination['limit'], $pagination['offset'])
            ->get()
            ->getResultArray();

        return $this->success([
            'data' => array_map(fn($row) => $this->enrollmentModel->formatForApi($row), $rows),
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
            'filterOptions' => $this->availableMonthYearOptions('enrollments', 'enrollment_date', $id, $tenantId),
        ]);
    }

    public function getAdjustmentsHistory($id = null)
    {
        $tenantId = $this->getTenantId();
        $student = $this->studentModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$student) {
            return $this->notFound('Student not found');
        }

        $db = \Config\Database::connect();
        $pagination = $this->normalisePaginationParams(10, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        if (!$db->tableExists('ledger_adjustments')) {
            return $this->success([
                'data' => [],
                'pagination' => $this->buildPaginationMeta(0, $pagination['page'], $pagination['limit']),
                'summary' => ['creditAdjustments' => 0, 'debitAdjustments' => 0, 'netAdjustments' => 0],
                'filterOptions' => ['months' => [], 'years' => []],
            ]);
        }

        $month = $this->validatedMonth($this->request->getGet('month'));
        $year = $this->validatedYear($this->request->getGet('year'));
        if (($this->request->getGet('month') !== null && $month === null)
            || ($this->request->getGet('year') !== null && $year === null)) {
            return $this->error('Invalid month or year filter', 400);
        }

        $summaryBuilder = $db->table('ledger_adjustments')
            ->select("COALESCE(SUM(CASE WHEN adjustment_type = 'credit' THEN amount ELSE 0 END), 0) AS credit_total, COALESCE(SUM(CASE WHEN adjustment_type = 'debit' THEN amount ELSE 0 END), 0) AS debit_total", false)
            ->where('student_id', $id)
            ->where('tenant_id', $tenantId)
            ->where('status', 'approved');
        $this->applyMonthYearFilter($summaryBuilder, 'effective_date', $month, $year);
        $summary = $summaryBuilder->get()->getRowArray();

        $builder = $db->table('ledger_adjustments')
            ->where('student_id', $id)
            ->where('tenant_id', $tenantId)
            ->where('status', 'approved');
        $this->applyMonthYearFilter($builder, 'effective_date', $month, $year);
        $total = $builder->countAllResults(false);
        $rows = $builder
            ->orderBy('effective_date', 'DESC')
            ->orderBy('created_at', 'DESC')
            ->limit($pagination['limit'], $pagination['offset'])
            ->get()
            ->getResultArray();

        return $this->success([
            'data' => array_map(fn($a) => [
                'id' => $a['id'],
                'adjustmentType' => $a['adjustment_type'],
                'category' => $a['category'] ?? '',
                'amount' => (float) $a['amount'],
                'paidAmount' => (float) ($a['paid_amount'] ?? 0),
                'paymentStatus' => $a['payment_status'] ?? (($a['adjustment_type'] ?? '') === 'credit' ? 'paid' : 'unpaid'),
                'paidAt' => $a['paid_at'] ?? null,
                'reason' => $a['reason'] ?? '',
                'effectiveDate' => $a['effective_date'],
                'createdAt' => $a['created_at'],
            ], $rows),
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
            'summary' => [
                'creditAdjustments' => round((float) ($summary['credit_total'] ?? 0), 2),
                'debitAdjustments' => round((float) ($summary['debit_total'] ?? 0), 2),
                'netAdjustments' => round((float) ($summary['debit_total'] ?? 0) - (float) ($summary['credit_total'] ?? 0), 2),
            ],
            'filterOptions' => $this->availableMonthYearOptions('ledger_adjustments', 'effective_date', $id, $tenantId),
        ]);
    }

    public function getFinanceSummary($id = null)
    {
        return $this->getFeeStatement($id);
    }

    public function getChargesHistory($id = null)
    {
        return $this->getFeeStatement($id);
    }

    /**
     * GET /api/students/:id/transport-history
     *
     * Returns the complete chronological transport-assignment history for a
     * student (Feature 054 / US4). Each row joins route + stop names and
     * includes derived current-assignment + summary metadata.
     *
     * Tenant isolation is enforced; cross-tenant access returns 404.
     */
    public function getTransportHistory($id = null)
    {
        if (!$id) {
            return $this->error('Student ID is required', 400);
        }

        $tenantId = $this->getTenantId();
        $student  = $this->studentModel->where('id', $id)->where('tenant_id', $tenantId)->first();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        $month = $this->validatedMonth($this->request->getGet('month'));
        $year = $this->validatedYear($this->request->getGet('year'));
        if (($this->request->getGet('month') !== null && $month === null)
            || ($this->request->getGet('year') !== null && $year === null)) {
            return $this->error('Invalid month or year filter', 400);
        }

        $db = \Config\Database::connect();
        $filterOptions = $this->availableMonthYearOptions('transport_student_allocations', 'start_date', $id, $tenantId);
        $builder = $db->table('transport_student_allocations tsa')
            ->select(
                'tsa.id, tsa.route_id, tsa.stop_id, tsa.direction, tsa.start_date, ' .
                'tsa.end_date, tsa.status, tsa.academic_year, tsa.notes, ' .
                'tsa.created_at, tsa.updated_at, ' .
                'r.route_name, r.monthly_fee, ' .
                'ts.name AS stop_name'
            )
            ->join('transport_routes r', 'r.id = tsa.route_id', 'left')
            ->join('transport_stops ts', 'ts.id = tsa.stop_id', 'left')
            ->where('tsa.student_id', $id)
            ->where('tsa.tenant_id', $tenantId);

        $this->applyMonthYearFilter($builder, 'tsa.start_date', $month, $year);

        $rows = $builder
            ->orderBy('tsa.start_date', 'DESC')
            ->orderBy('tsa.created_at', 'DESC')
            ->get()
            ->getResultArray();

        $history = array_map(static function ($r) {
            return [
                'id'           => $r['id'],
                'routeId'      => $r['route_id'],
                'routeName'    => $r['route_name'] ?? null,
                'monthlyFee'   => isset($r['monthly_fee']) ? (float) $r['monthly_fee'] : null,
                'stopId'       => $r['stop_id'] ?? null,
                'stopName'     => $r['stop_name'] ?? null,
                'direction'    => $r['direction'] ?? 'both',
                'startDate'    => $r['start_date'] ?? null,
                'endDate'      => $r['end_date'] ?? null,
                'status'       => $r['status'] ?? 'inactive',
                'academicYear' => $r['academic_year'] ?? null,
                'notes'        => $r['notes'] ?? null,
                'assignedDate' => $r['created_at'] ?? null,
                'endedDate'    => ($r['status'] === 'inactive') ? ($r['updated_at'] ?? null) : null,
            ];
        }, $rows);

        // Derive current (active) assignment + summary.
        $current = null;
        foreach ($history as $h) {
            if ($h['status'] === 'active') {
                $current = $h;
                break;
            }
        }

        $earliestStart = null;
        $activeCount   = 0;
        foreach ($history as $h) {
            if ($h['startDate'] !== null) {
                if ($earliestStart === null || $h['startDate'] < $earliestStart) {
                    $earliestStart = $h['startDate'];
                }
            }
            if ($h['status'] === 'active') {
                $activeCount++;
            }
        }

        $summary = [
            'totalAssignments'   => count($history),
            'activeAssignments'  => $activeCount,
            'currentRoute'       => $current['routeName'] ?? null,
            'earliestAssignment' => $earliestStart,
        ];

        return $this->success([
            'studentId'         => $id,
            'studentName'       => trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')),
            'currentAssignment' => $current,
            'history'           => $history,
            'summary'           => $summary,
            'filterOptions'     => $filterOptions,
        ], 'Transport history retrieved');
    }

    /**
     * GET /api/students/:id/enrollment-history
     * Get student's complete enrollment history
     */
    public function getEnrollmentHistory($id = null)
    {
        $student = $this->studentModel->find($id);
        
        if (!$student) {
            return $this->notFound('Student not found');
        }
        
        $history = $this->enrollmentModel->getStudentHistory($id);
        $formattedHistory = array_map([$this->enrollmentModel, 'formatForApi'], $history);
        
        return $this->success($formattedHistory);
    }
    
    /**
     * POST /api/students/:id/promote
     * Manually promote a student to next class
     */
    public function promoteStudent($id = null)
    {
        $student = $this->studentModel->find($id);
        
        if (!$student) {
            return $this->notFound('Student not found');
        }
        
        if ($student['status'] !== 'active') {
            return $this->error('Only active students can be promoted', 400);
        }
        
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $newClassId = $data['classId'] ?? null;
        $academicSession = $data['academicSession'] ?? date('Y') . '/' . (date('Y') + 1);
        $remarks = $data['remarks'] ?? 'Manual promotion';
        
        if (!$newClassId) {
            // Auto-promote: check if the student's current class is a final/graduation class
            if ($this->classModel->isFinalClass($student['class_id'])) {
                try {
                    $this->enrollmentModel->graduateStudent(
                        $id,
                        $student['class_id'],
                        [
                            'tenant_id' => $student['tenant_id'],
                            'remarks'   => $remarks ?: 'Graduated from final class'
                        ]
                    );
                    $updated = $this->studentModel->find($id);
                    return $this->success(
                        $this->studentModel->formatForApi($updated),
                        'Student graduated successfully'
                    );
                } catch (\Exception $e) {
                    return $this->error('Graduation failed: ' . $e->getMessage(), 500);
                }
            }

            $nextClass = $this->classModel->getNextClass($student['class_id']);
            if (!$nextClass) {
                return $this->error(
                    'No next class configured for this class — set next_class_id or mark the class as final to graduate students',
                    400
                );
            }
            $newClassId = $nextClass['id'];
        }

        try {
            // Promote student
            $newEnrollmentId = $this->enrollmentModel->promoteStudent(
                $id,
                $newClassId,
                $academicSession,
                [
                    'tenant_id' => $student['tenant_id'],
                    'remarks' => $remarks
                ]
            );

            // Update student
            $this->studentModel->update($id, [
                'class_id' => $newClassId,
                'current_enrollment_id' => $newEnrollmentId
            ]);

            $updated = $this->studentModel->find($id);
            return $this->success(
                $this->studentModel->formatForApi($updated),
                'Student promoted successfully'
            );

        } catch (\Exception $e) {
            return $this->error('Promotion failed: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * POST /api/students/:id/repeat
     * Repeat student in current class
     */
    public function repeatStudent($id = null)
    {
        $student = $this->studentModel->find($id);
        
        if (!$student) {
            return $this->notFound('Student not found');
        }
        
        if ($student['status'] !== 'active') {
            return $this->error('Only active students can be repeated', 400);
        }
        
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $academicSession = $data['academicSession'] ?? date('Y') . '/' . (date('Y') + 1);
        $remarks = $data['remarks'] ?? 'Repeated class';
        
        try {
            // Repeat student
            $newEnrollmentId = $this->enrollmentModel->repeatStudent(
                $id,
                $student['class_id'],
                $academicSession,
                [
                    'tenant_id' => $student['tenant_id'],
                    'remarks' => $remarks
                ]
            );
            
            // Update student
            $this->studentModel->update($id, [
                'current_enrollment_id' => $newEnrollmentId
            ]);
            
            $updated = $this->studentModel->find($id);
            return $this->success(
                $this->studentModel->formatForApi($updated),
                'Student repeated successfully'
            );
            
        } catch (\Exception $e) {
            return $this->error('Failed to repeat student: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * GET /api/students/:id/fee-statement
     *
     * Returns a comprehensive, production-grade fee statement for a single student:
     *   - summary (total charged, total paid, balance, adjustments)
     *   - charges[] with status, type, term, and opening-balance flag
     *   - payments[] ordered newest first
     *   - termBreakdown{} keyed by termId with charged/paid/balance per term
     */
    public function getFeeStatement($id = null)
    {
        if (!$id) {
            return $this->error('Student ID is required', 400);
        }

        $tenantId = $this->getTenantId();
        $db = \Config\Database::connect();

        $paymentMonth = $this->validatedMonth($this->request->getGet('paymentMonth'));
        $paymentYear = $this->validatedYear($this->request->getGet('paymentYear'));
        $chargeMonth = $this->validatedMonth($this->request->getGet('chargeMonth'));
        $chargeYear = $this->validatedYear($this->request->getGet('chargeYear'));
        $paymentsPage = max(1, (int) ($this->request->getGet('paymentsPage') ?? 1));
        $paymentsLimit = min(100, max(1, (int) ($this->request->getGet('paymentsLimit') ?? 10)));
        $chargesPage = max(1, (int) ($this->request->getGet('chargesPage') ?? 1));
        $chargesLimit = min(100, max(1, (int) ($this->request->getGet('chargesLimit') ?? 10)));

        if (($this->request->getGet('paymentMonth') !== null && $paymentMonth === null)
            || ($this->request->getGet('paymentYear') !== null && $paymentYear === null)
            || ($this->request->getGet('chargeMonth') !== null && $chargeMonth === null)
            || ($this->request->getGet('chargeYear') !== null && $chargeYear === null)) {
            return $this->error('Invalid month or year filter', 400);
        }

        // Verify student belongs to this tenant
        $student = $this->studentModel
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->first();

        if (!$student) {
            return $this->notFound('Student not found');
        }

        // ── Charges (active only, oldest first for ledger ordering) ─────────
        $charges = $db->table('charges')
            ->where('student_id', $id)
            ->where('tenant_id', $tenantId)
            ->whereIn('charge_type', \App\Services\LedgerService::ELIGIBLE_CHARGE_TYPES)
            ->where('deleted_at', null)
            ->where('voided_at', null)
            ->orderBy('date_generated', 'ASC')
            ->get()->getResultArray();

        // ── Payments (active only, newest first) ────────────────────────────
        // Feature 085: voided payments are excluded from all ledger totals.
        $payments = $db->table('payments')
            ->where('student_id', $id)
            ->where('tenant_id', $tenantId)
            ->where('voided_at', null)
            ->orderBy('date', 'DESC')
            ->get()->getResultArray();

        $displayPaymentsBuilder = $db->table('payments')
            ->where('student_id', $id)
            ->where('tenant_id', $tenantId)
            ->where('voided_at', null);
        $this->applyMonthYearFilter($displayPaymentsBuilder, 'date', $paymentMonth, $paymentYear);
        $paymentsTotal = $displayPaymentsBuilder->countAllResults(false);
        $paymentsTotalPages = max(1, (int) ceil($paymentsTotal / $paymentsLimit));
        $paymentsPage = min($paymentsPage, $paymentsTotalPages);
        $displayPayments = $displayPaymentsBuilder
            ->orderBy('date', 'DESC')
            ->limit($paymentsLimit, ($paymentsPage - 1) * $paymentsLimit)
            ->get()
            ->getResultArray();

        $ledgerPayments = array_values(array_filter(
            $payments,
            fn($p) => empty($p['fee_campaign_id'])
                && empty($p['voided_at'])
                && in_array($p['category'] ?? '', \App\Services\LedgerService::ELIGIBLE_PAYMENT_CATEGORIES, true)
        ));

        // ── Ledger adjustments ────────────────────────────────────────────────
        $creditAdjustments = 0.0;
        $debitAdjustments  = 0.0;
        $adjustmentRows    = [];
        if ($db->tableExists('ledger_adjustments')) {
            $cr = $db->table('ledger_adjustments')
                ->selectSum('amount')
                ->where('student_id', $id)
                ->where('tenant_id', $tenantId)
                ->where('adjustment_type', 'credit')
                ->where('status', 'approved')
                ->get()->getRow();
            $creditAdjustments = (float) ($cr->amount ?? 0);

            $dr = $db->table('ledger_adjustments')
                ->selectSum('amount')
                ->where('student_id', $id)
                ->where('tenant_id', $tenantId)
                ->where('adjustment_type', 'debit')
                ->where('status', 'approved')
                ->get()->getRow();
            $debitAdjustments = (float) ($dr->amount ?? 0);

            // Fetch individual adjustment records for the dedicated section
            $adjustmentRows = $db->table('ledger_adjustments')
                ->where('student_id', $id)
                ->where('tenant_id', $tenantId)
                ->where('status', 'approved')
                ->orderBy('effective_date', 'DESC')
                ->get()->getResultArray();
        }

        // ── Totals (all charges and payments for this student) ──────────────
        $totalFeeCharges  = array_sum(array_map(fn($c) => (float) $c['amount'], $charges));
        $totalFeePayments = array_sum(array_map(fn($p) => (float) $p['amount'], $ledgerPayments));
        $feeChargesTotal = array_sum(array_map(
            fn($c) => ($c['charge_type'] ?? 'fee_structure') === 'fee_structure' ? (float) $c['amount'] : 0.0,
            $charges
        ));
        $transportChargesTotal = array_sum(array_map(
            fn($c) => ($c['charge_type'] ?? '') === 'transport' ? (float) $c['amount'] : 0.0,
            $charges
        ));
        // Preserve legacy totals for term-level FIFO breakdown.
        $feePaymentsTotal = array_sum(array_map(
            fn($p) => in_array($p['category'] ?? '', \App\Services\LedgerService::ELIGIBLE_FEE_PAYMENT_CATEGORIES, true) ? (float) $p['amount'] : 0.0,
            $ledgerPayments
        ));
        $transportPaymentsTotal = array_sum(array_map(
            fn($p) => in_array($p['category'] ?? '', \App\Services\LedgerService::ELIGIBLE_TRANSPORT_PAYMENT_CATEGORIES, true) ? (float) $p['amount'] : 0.0,
            $ledgerPayments
        ));
        // Split ledger payments by category for independent balance calculation.
        // Mirrors LedgerService::getStudentBalance allocation logic.
        $feePaymentsOnly = array_sum(array_map(
            fn($p) => ($p['category'] ?? '') === 'Fees' ? (float) $p['amount'] : 0.0,
            $ledgerPayments
        ));
        $transportFeesPayments = array_sum(array_map(
            fn($p) => ($p['category'] ?? '') === 'Transport + Fees' ? (float) $p['amount'] : 0.0,
            $ledgerPayments
        ));
        $transportPaymentsOnly = array_sum(array_map(
            fn($p) => in_array($p['category'] ?? '', \App\Services\LedgerService::ELIGIBLE_TRANSPORT_PAYMENT_CATEGORIES, true) ? (float) $p['amount'] : 0.0,
            $ledgerPayments
        ));

        // Dynamic allocation: 'Transport + Fees' covers outstanding fee charges first,
        // then any surplus spills into the transport pool.
        $outstandingFeeCharges = max(0.0, $feeChargesTotal - $feePaymentsOnly);
        $transportFeesToFee    = min($transportFeesPayments, $outstandingFeeCharges);
        $transportFeesToTransport = max(0.0, $transportFeesPayments - $transportFeesToFee);

        $feePayments      = $feePaymentsOnly + $transportFeesToFee;
        $transportPayments = $transportPaymentsOnly + $transportFeesToTransport;

        $balance = $totalFeeCharges + $debitAdjustments - $feePayments - $transportPayments - $creditAdjustments;
        $feeBalance       = $feeChargesTotal + $debitAdjustments - $feePayments - $creditAdjustments;
        $transportBalance = $transportChargesTotal - $transportPayments;

        // ── Build term-level breakdown ────────────────────────────────────────
        // Load academic calendar for term names
        $tenant = $db->table('tenants')->where('id', $tenantId)->get()->getRow();
        $termNames = [];
        if ($tenant && isset($tenant->academic_calendar)) {
            $cal = json_decode($tenant->academic_calendar, true);
            foreach ($cal['terms'] ?? [] as $t) {
                $termNames[$t['id']] = $this->formatAcademicTermLabel($t);
            }
        }

        $termBreakdown = [];
        foreach ($charges as $c) {
            $isOpeningBalance = (bool) ($c['is_opening_balance'] ?? false);
            $tKey = $c['term_id'] ?? ($isOpeningBalance ? 'opening' : ($c['term'] ?? $c['billing_period'] ?? 'unassigned'));
            if (!isset($termBreakdown[$tKey])) {
                $termBreakdown[$tKey] = [
                    'termId'   => $tKey,
                    'termName' => $isOpeningBalance
                        ? 'Opening Balance'
                        : ($c['term'] ?? $c['billing_period'] ?? $termNames[$tKey] ?? $tKey),
                    'charged'  => 0.0,
                    'paid'     => 0.0,
                    'balance'  => 0.0,
                ];
            }
            $termBreakdown[$tKey]['charged'] += (float) $c['amount'];
        }

        // Allocate payments to terms FIFO (oldest charge first)
        foreach ($adjustmentRows as $a) {
            $tKey = $a['term_id'] ?? 'adjustments';
            if (!isset($termBreakdown[$tKey])) {
                $termBreakdown[$tKey] = [
                    'termId'   => $tKey,
                    'termName' => $tKey === 'adjustments' ? 'Adjustments' : ($termNames[$tKey] ?? $tKey),
                    'charged'  => 0.0,
                    'paid'     => 0.0,
                    'balance'  => 0.0,
                ];
            }

            if (($a['adjustment_type'] ?? '') === 'debit') {
                $termBreakdown[$tKey]['charged'] += (float) $a['amount'];
            } elseif (($a['adjustment_type'] ?? '') === 'credit') {
                $termBreakdown[$tKey]['paid'] += (float) $a['amount'];
            }
        }

        $remainingFeeCredit = $feePaymentsTotal + $creditAdjustments;
        foreach (array_filter($charges, fn($c) => ($c['charge_type'] ?? 'fee_structure') === 'fee_structure') as $c) {
            $isOpeningBalance = (bool) ($c['is_opening_balance'] ?? false);
            $tKey        = $c['term_id'] ?? ($isOpeningBalance ? 'opening' : ($c['term'] ?? $c['billing_period'] ?? 'unassigned'));
            $chargeAmt   = (float) $c['amount'];
            $applied     = min($remainingFeeCredit, $chargeAmt);
            $termBreakdown[$tKey]['paid'] += $applied;
            $remainingFeeCredit -= $applied;
            if ($remainingFeeCredit <= 0) break;
        }

        foreach (array_filter($adjustmentRows, fn($a) => ($a['adjustment_type'] ?? '') === 'debit') as $a) {
            $tKey        = $a['term_id'] ?? 'adjustments';
            $chargeAmt   = (float) $a['amount'];
            $applied     = min($remainingFeeCredit, $chargeAmt);
            $termBreakdown[$tKey]['paid'] += $applied;
            $remainingFeeCredit -= $applied;
            if ($remainingFeeCredit <= 0) break;
        }

        $remainingTransportCredit = $transportPaymentsTotal + max($remainingFeeCredit, 0.0);
        foreach (array_filter($charges, fn($c) => ($c['charge_type'] ?? '') === 'transport') as $c) {
            $tKey        = $c['term_id'] ?? ($c['term'] ?? $c['billing_period'] ?? 'unassigned');
            $chargeAmt   = (float) $c['amount'];
            $applied     = min($remainingTransportCredit, $chargeAmt);
            $termBreakdown[$tKey]['paid'] += $applied;
            $remainingTransportCredit -= $applied;
            if ($remainingTransportCredit <= 0) break;
        }

        foreach ($termBreakdown as &$t) {
            $t['balance'] = round($t['charged'] - $t['paid'], 2);
            $t['charged'] = round($t['charged'], 2);
            $t['paid']    = round($t['paid'], 2);
        }
        unset($t);

        // ── Effective charge statuses (computed on-the-fly) ──────────────────
        // Mirrors LedgerService::allocatePaymentToCharges so the fee statement
        // is always accurate even when charges were generated after the last
        // payment (allocation is only re-run when a payment is recorded).
        //
        // Pool definitions — must stay in sync with LedgerService:
        //   fee/general pool  : route_id IS NULL AND category != 'Transport'
        //   transport pool    : route_id IS NOT NULL  OR  category = 'Transport'
        //   overflow rule     : fee surplus after all fee charges flows into transport pool

        $feePool       = 0.0;
        $transportPool = 0.0;
        foreach ($ledgerPayments as $p) {
            if (in_array($p['category'] ?? '', \App\Services\LedgerService::ELIGIBLE_TRANSPORT_PAYMENT_CATEGORIES, true)) {
                $transportPool += (float) $p['amount'];
            } elseif (in_array($p['category'] ?? '', \App\Services\LedgerService::ELIGIBLE_FEE_PAYMENT_CATEGORIES, true)) {
                $feePool += (float) $p['amount'];
            }
        }
        $feePool += $creditAdjustments;

        // Separate active charges by type (maintain date_generated ASC order)
        $feeChargesActive       = array_values(array_filter($charges,
            fn($c) => !in_array($c['status'] ?? '', ['waived', 'cancelled'], true)
                   && ($c['charge_type'] ?? 'fee_structure') === 'fee_structure'
        ));
        $transportChargesActive = array_values(array_filter($charges,
            fn($c) => !in_array($c['status'] ?? '', ['waived', 'cancelled'], true)
                   && ($c['charge_type'] ?? 'fee_structure') === 'transport'
        ));

        $effectiveStatus = [];
        $feeCredit       = $feePool;

        $debitAdjustmentActive = array_values(array_filter($adjustmentRows, fn($a) => ($a['adjustment_type'] ?? '') === 'debit'));
        $feeLedgerItems = [];
        foreach ($feeChargesActive as $c) {
            $feeLedgerItems[] = [
                'kind' => 'charge',
                'id' => $c['id'],
                'amount' => (float) $c['amount'],
                'date' => $c['date_generated'] ?? $c['created_at'] ?? '',
            ];
        }
        foreach ($debitAdjustmentActive as $a) {
            $feeLedgerItems[] = [
                'kind' => 'adjustment',
                'id' => $a['id'],
                'amount' => (float) $a['amount'],
                'date' => $a['effective_date'] ?? $a['created_at'] ?? '',
            ];
        }
        usort($feeLedgerItems, static fn (array $a, array $b): int => strcmp((string) $a['date'], (string) $b['date']));

        $effectiveAdjustmentStatus = [];
        $effectiveAdjustmentPaidAmount = [];
        foreach ($feeLedgerItems as $item) {
            $amt = (float) $item['amount'];
            $applied = min($feeCredit, $amt);
            $status = $applied >= $amt ? 'paid' : ($applied > 0 ? 'partial' : 'pending');

            if ($item['kind'] === 'charge') {
                $effectiveStatus[$item['id']] = $status;
            } else {
                $effectiveAdjustmentStatus[$item['id']] = $status === 'pending' ? 'unpaid' : $status;
                $effectiveAdjustmentPaidAmount[$item['id']] = $applied;
            }

            $feeCredit -= $applied;
            if ($feeCredit <= 0) {
                $feeCredit = 0.0;
            }
        }

        // Fee surplus overflows into transport pool (handles 'Transport + Fees' payments)
        $transportCredit = $transportPool + $feeCredit;

        foreach ($transportChargesActive as $c) {
            $amt = (float) $c['amount'];
            if ($transportCredit >= $amt) {
                $effectiveStatus[$c['id']] = 'paid';
                $transportCredit -= $amt;
            } elseif ($transportCredit > 0) {
                $effectiveStatus[$c['id']] = 'partial';
                $transportCredit = 0.0;
            } else {
                $effectiveStatus[$c['id']] = 'pending';
            }
        }

        $displayChargesBuilder = $db->table('charges')
            ->where('student_id', $id)
            ->where('tenant_id', $tenantId)
            ->whereIn('charge_type', \App\Services\LedgerService::ELIGIBLE_CHARGE_TYPES)
            ->where('deleted_at', null)
            ->where('voided_at', null);
        $this->applyMonthYearFilter($displayChargesBuilder, 'date_generated', $chargeMonth, $chargeYear);
        $chargesTotal = $displayChargesBuilder->countAllResults(false);
        $chargesTotalPages = max(1, (int) ceil($chargesTotal / $chargesLimit));
        $chargesPage = min($chargesPage, $chargesTotalPages);
        $displayChargeRows = $displayChargesBuilder
            ->orderBy('date_generated', 'DESC')
            ->limit($chargesLimit, ($chargesPage - 1) * $chargesLimit)
            ->get()
            ->getResultArray();

        // ── Format charges for response ───────────────────────────────────────
        $displayCharges = array_map(function ($c) use ($termNames, $effectiveStatus) {
            $dbStatus = $c['status'] ?? 'pending';
            // Preserve terminal statuses; use computed status for everything else
            $status = in_array($dbStatus, ['waived', 'cancelled'], true)
                ? $dbStatus
                : ($effectiveStatus[$c['id']] ?? $dbStatus);
            $chargeType = $c['charge_type'] ?? 'fee_structure';
            $isOpeningBalance = (bool) ($c['is_opening_balance'] ?? false);
            $termName = $chargeType === 'transport'
                ? ($c['term'] ?? 'Transport charge')
                : ($isOpeningBalance
                    ? 'Opening Balance'
                    : ($c['term'] ?? $c['billing_period'] ?? (isset($c['term_id']) ? ($termNames[$c['term_id']] ?? $c['term_id']) : '')));
            return [
                'id'               => $c['id'],
                'category'         => $c['category'],
                'chargeType'       => $chargeType,
                'amount'           => (float) $c['amount'],
                'status'           => $status,
                'dateGenerated'    => $c['date_generated'],
                'dueDate'          => $c['due_date'] ?? null,
                'termId'           => $c['term_id'] ?? null,
                'termName'         => $termName,
                'description'      => $c['description'] ?? '',
                'isOpeningBalance' => $isOpeningBalance,
            ];
        }, $displayChargeRows);

        // ── Format payments for response ──────────────────────────────────────
        $formattedPayments = array_map(fn($p) => [
            'id'             => $p['id'],
            'amount'         => (float) $p['amount'],
            'date'           => $p['date'],
            'method'         => $p['method'],
            'category'       => $p['category'] ?? '',
            'description'    => $p['description'] ?? '',
            'routeId'        => $p['route_id'] ?? null,
        ], $displayPayments);

        // ── Format adjustments for response ─────────────────────────────────
        $formattedAdjustments = array_map(fn($a) => [
            'id'             => $a['id'],
            'adjustmentType' => $a['adjustment_type'],
            'category'       => $a['category'] ?? '',
            'amount'         => (float) $a['amount'],
            'paidAmount'     => (float) ($effectiveAdjustmentPaidAmount[$a['id']] ?? $a['paid_amount'] ?? 0),
            'paymentStatus'  => $effectiveAdjustmentStatus[$a['id']] ?? $a['payment_status'] ?? (($a['adjustment_type'] ?? '') === 'credit' ? 'paid' : 'unpaid'),
            'paidAt'         => $a['paid_at'] ?? null,
            'reason'         => $a['reason'] ?? '',
            'effectiveDate'  => $a['effective_date'],
            'createdAt'      => $a['created_at'],
        ], $adjustmentRows);
        $paymentFilterOptions = $this->availableMonthYearOptions('payments', 'date', $id, $tenantId);
        $chargeFilterOptions = $this->availableMonthYearOptions('charges', 'date_generated', $id, $tenantId);

        return $this->success([
            'student' => [
                'id'        => $student['id'],
                'name'      => trim($student['first_name'] . ' ' . $student['last_name']),
                'classId'   => $student['class_id'],
            ],
            'summary' => [
                'totalCharged'       => round($totalFeeCharges, 2),
                'totalPaid'          => round($totalFeePayments, 2),
                'creditAdjustments'  => round($creditAdjustments, 2),
                'debitAdjustments'   => round($debitAdjustments, 2),
                'balance'            => round($balance, 2),
                'feeBalance'         => round($feeBalance, 2),
                'transportBalance'   => round($transportBalance, 2),
            ],
            'charges'       => $displayCharges,
            'chargesPagination' => [
                'page'       => $chargesPage,
                'limit'      => $chargesLimit,
                'total'      => $chargesTotal,
                'totalPages' => $chargesTotalPages,
            ],
            'payments'      => $formattedPayments,
            'paymentsPagination' => [
                'page'       => $paymentsPage,
                'limit'      => $paymentsLimit,
                'total'      => $paymentsTotal,
                'totalPages' => $paymentsTotalPages,
            ],
            'adjustments'   => $formattedAdjustments,
            'termBreakdown' => array_values($termBreakdown),
            'filterOptions' => [
                'payments' => $paymentFilterOptions,
                'charges' => $chargeFilterOptions,
            ],
        ]);
    }

    /**
     * Calculate accurate statistics for all students matching filters via a single SQL query.
     * This avoids the N+1 problem and gives correct stats regardless of page size.
     */
    private function calculateAggregateStats(string $tenantId, ?string $classId, ?string $status, ?string $search): array
    {
        $db = \Config\Database::connect();
        $escapedTenantId = $db->escape($tenantId);

        // --- Query 1: Financial stats scoped to current status/class/search filter ---
        // Uses charge_type ENUM to classify fee-structure vs transport charges.
        // Counts all payments (no payment-side filter needed — every payment reduces balance).
        $filteredSql = "
            SELECT
                COUNT(*) as total_students,
                SUM(CASE WHEN (COALESCE(c.total,0) + COALESCE(d.total,0) - COALESCE(p.total,0) - COALESCE(cr.total,0)) > 0 THEN 1 ELSE 0 END) as with_outstanding,
                COALESCE(SUM(GREATEST(COALESCE(c.total,0) + COALESCE(d.total,0) - COALESCE(p.total,0) - COALESCE(cr.total,0), 0)), 0) as total_fees_owed,
                SUM(CASE WHEN s.bursary_status != 'none' THEN 1 ELSE 0 END) as with_bursary
            FROM students s
            LEFT JOIN (
                SELECT student_id, SUM(amount) as total
                FROM charges
                WHERE tenant_id = {$escapedTenantId} AND charge_type IN ('fee_structure', 'transport') AND deleted_at IS NULL AND voided_at IS NULL
                GROUP BY student_id
            ) c ON c.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) as total
                FROM payments
                WHERE tenant_id = {$escapedTenantId}
                GROUP BY student_id
            ) p ON p.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) as total
                FROM ledger_adjustments
                WHERE tenant_id = {$escapedTenantId} AND adjustment_type = 'debit' AND status = 'approved'
                GROUP BY student_id
            ) d ON d.student_id = s.id
            LEFT JOIN (
                SELECT student_id, SUM(amount) as total
                FROM ledger_adjustments
                WHERE tenant_id = {$escapedTenantId} AND adjustment_type = 'credit' AND status = 'approved'
                GROUP BY student_id
            ) cr ON cr.student_id = s.id
            WHERE s.tenant_id = ?
        ";

        $filteredParams = [$tenantId];

        if (!empty($classId)) {
            $filteredSql .= ' AND s.class_id = ?';
            $filteredParams[] = $classId;
        }

        if ($status !== null && $status !== 'all') {
            $filteredSql .= ' AND s.status = ?';
            $filteredParams[] = $status;
        } else {
            // Default to active when no status filter is supplied
            $filteredSql .= " AND s.status = 'active'";
        }

        if (!empty($search)) {
            $filteredSql .= ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.guardian_name LIKE ?)';
            $like = "%{$search}%";
            $filteredParams[] = $like;
            $filteredParams[] = $like;
            $filteredParams[] = $like;
        }

        $filteredRow = $db->query($filteredSql, $filteredParams)->getRowArray();

        // --- Query 2: Global status counts (no status filter) for the filter tabs ---
        // Class and search filters still apply so tab counts stay consistent with the view.
        $globalSql = "
            SELECT
                SUM(CASE WHEN s.status = 'active'      THEN 1 ELSE 0 END) as cnt_active,
                SUM(CASE WHEN s.status = 'inactive'    THEN 1 ELSE 0 END) as cnt_inactive,
                SUM(CASE WHEN s.status = 'graduated'   THEN 1 ELSE 0 END) as cnt_graduated,
                SUM(CASE WHEN s.status = 'transferred' THEN 1 ELSE 0 END) as cnt_transferred,
                SUM(CASE WHEN s.status = 'dropped_out' THEN 1 ELSE 0 END) as cnt_dropped_out,
                COUNT(*) as cnt_total
            FROM students s
            WHERE s.tenant_id = ?
        ";

        $globalParams = [$tenantId];

        if (!empty($classId)) {
            $globalSql .= ' AND s.class_id = ?';
            $globalParams[] = $classId;
        }

        if (!empty($search)) {
            $globalSql .= ' AND (s.first_name LIKE ? OR s.last_name LIKE ? OR s.guardian_name LIKE ?)';
            $like = "%{$search}%";
            $globalParams[] = $like;
            $globalParams[] = $like;
            $globalParams[] = $like;
        }

        $globalRow = $db->query($globalSql, $globalParams)->getRowArray();

        $total       = (int) ($filteredRow['total_students'] ?? 0);
        $withBursary = (int) ($filteredRow['with_bursary']   ?? 0);

        return [
            'totalStudents'                  => $total,
            'studentsWithOutstandingBalance' => (int)   ($filteredRow['with_outstanding'] ?? 0),
            'totalFeesOwed'                  => (float) ($filteredRow['total_fees_owed']  ?? 0),
            'studentsOnFinancialAid'         => $withBursary,
            'bursaryCoveragePercentage'      => $total > 0 ? round(($withBursary / $total) * 100) : 0,
            // Global counts (no status filter) so filter tabs always show correct totals
            'statusCounts' => [
                'active'      => (int) ($globalRow['cnt_active']      ?? 0),
                'inactive'    => (int) ($globalRow['cnt_inactive']     ?? 0),
                'graduated'   => (int) ($globalRow['cnt_graduated']    ?? 0),
                'transferred' => (int) ($globalRow['cnt_transferred']  ?? 0),
                'dropped_out' => (int) ($globalRow['cnt_dropped_out']  ?? 0),
                'total'       => (int) ($globalRow['cnt_total']        ?? 0),
            ],
        ];
    }

    private function validatedMonth($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!ctype_digit((string) $value)) {
            return null;
        }
        $month = (int) $value;
        return $month >= 1 && $month <= 12 ? $month : null;
    }

    private function validatedYear($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (!ctype_digit((string) $value)) {
            return null;
        }
        $year = (int) $value;
        return $year >= 1900 && $year <= 2100 ? $year : null;
    }

    private function applyMonthYearFilter($builder, string $column, ?int $month, ?int $year): void
    {
        if ($month !== null) {
            $builder->where("MONTH({$column})", $month);
        }
        if ($year !== null) {
            $builder->where("YEAR({$column})", $year);
        }
    }

    private function availableMonthYearOptions(string $table, string $column, string $studentId, string $tenantId): array
    {
        $db = \Config\Database::connect();
        $monthRows = $db->table($table)
            ->select("MONTH({$column}) AS month", false)
            ->where('student_id', $studentId)
            ->where('tenant_id', $tenantId)
            ->where("{$column} IS NOT NULL", null, false)
            ->groupBy("MONTH({$column})", false)
            ->orderBy("MONTH({$column})", 'ASC', false)
            ->get()
            ->getResultArray();

        $yearRows = $db->table($table)
            ->select("YEAR({$column}) AS year", false)
            ->where('student_id', $studentId)
            ->where('tenant_id', $tenantId)
            ->where("{$column} IS NOT NULL", null, false)
            ->groupBy("YEAR({$column})", false)
            ->orderBy("YEAR({$column})", 'DESC', false)
            ->get()
            ->getResultArray();

        return [
            'months' => array_values(array_map(fn($row) => (int) $row['month'], $monthRows)),
            'years' => array_values(array_map(fn($row) => (int) $row['year'], $yearRows)),
        ];
    }

    private function formatAcademicTermLabel(array $term): string
    {
        $name = $term['name'] ?? $term['id'] ?? 'Term';
        $start = $term['startDate'] ?? $term['start_date'] ?? null;
        $end = $term['endDate'] ?? $term['end_date'] ?? null;

        if (!$start || !$end) {
            return $name;
        }

        $startTime = strtotime($start);
        $endTime = strtotime($end);
        if ($startTime === false || $endTime === false) {
            return $name;
        }

        return sprintf('%s (%s - %s)', $name, date('d/m/Y', $startTime), date('d/m/Y', $endTime));
    }

    /**
     * Calculate statistics from formatted student data
     */
    private function calculateStudentStats(array $students): array
    {
        $totalStudents = count($students);
        $studentsWithOutstandingBalance = 0;
        $totalFeesOwed = 0;
        $studentsWithBursary = 0;
        $statusCounts = [
            'active' => 0,
            'inactive' => 0,
            'graduated' => 0,
            'transferred' => 0,
            'dropped_out' => 0
        ];

        foreach ($students as $student) {
            // Count students with outstanding balances
            if ($student['balance'] > 0) {
                $studentsWithOutstandingBalance++;
                $totalFeesOwed += $student['balance'];
            }

            // Count students with bursaries (full or partial)
            if ($student['bursaryStatus'] !== 'none') {
                $studentsWithBursary++;
            }
            
            // Count by status
            if (isset($student['status']) && isset($statusCounts[$student['status']])) {
                $statusCounts[$student['status']]++;
            }
        }

        $bursaryCoveragePercentage = $totalStudents > 0 
            ? round(($studentsWithBursary / $totalStudents) * 100) 
            : 0;

        return [
            'totalStudents' => $totalStudents,
            'studentsWithOutstandingBalance' => $studentsWithOutstandingBalance,
            'totalFeesOwed' => $totalFeesOwed,
            'bursaryCoveragePercentage' => $bursaryCoveragePercentage,
            'statusCounts' => $statusCounts
        ];
    }

    private function notifyAdminsStudentLimitReached(
        string $tenantId,
        string $planName,
        int    $maxStudents,
        int    $currentCount
    ): void {
        try {
            $tenantModel = new TenantModel();
            $tenant      = $tenantModel->find($tenantId);
            $schoolName  = $tenant ? $tenantModel->getSchoolName($tenant) : 'Your School';

            $userModel = new UserModel();
            $users     = $userModel->getByTenant($tenantId);
            $admins    = array_filter($users, fn($u) => in_array($u['role'], ['admin', 'super_admin']));
            if (empty($admins)) {
                $admins = $users;
            }

            $emailService = new EmailService();
            foreach ($admins as $admin) {
                $emailService->sendStudentLimitReached(
                    $admin['email'],
                    $admin['name'] ?? 'Administrator',
                    $admin['email'],
                    $schoolName,
                    $planName,
                    $maxStudents,
                    $currentCount
                );
            }
        } catch (\Throwable $e) {
            log_message('error', 'Failed to send student limit notification for tenant {tenant}: {message}', [
                'tenant'  => $tenantId,
                'message' => $e->getMessage(),
            ]);
        }
    }

}
