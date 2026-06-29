<?php

namespace App\Controllers\Api;

use App\Models\ClassModel;
use App\Models\StudentModel;
use App\Models\EnrollmentModel;
use App\Services\AcademicSessionService;

class ClassController extends BaseApiController
{
    protected ClassModel $classModel;
    protected StudentModel $studentModel;
    protected EnrollmentModel $enrollmentModel;
    protected AcademicSessionService $sessionService;

    public function __construct()
    {
        $this->classModel      = new ClassModel();
        $this->studentModel    = new StudentModel();
        $this->enrollmentModel = new EnrollmentModel();
        $this->sessionService  = new AcademicSessionService();
    }

    public function index()
    {
        $tenantId = $this->getTenantId();
        $pagination = $this->normalisePaginationParams(20, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $sort = $this->normaliseSortParams(['progressionOrder', 'name', 'studentCount', 'capacity', 'teacherName', 'createdAt'], 'progressionOrder', 'asc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $archived = $this->request->getGet('archived');
        if ($archived === null) {
            $archived = $this->request->getGet('include_archived') === 'true' ? 'all' : 'false';
        }
        $search = $this->sanitiseString($this->request->getGet('search'));
        $teacherId = $this->request->getGet('teacherId') ?: null;
        $includeTeachers = $this->request->getGet('includeTeachers') === 'true';

        if (!in_array($archived, ['true', 'false', 'all'], true)) {
            return $this->error('Invalid archived value.', 400);
        }

        $db = \Config\Database::connect();
        $teacherScopedId = null;
        if ($this->userHasRole('teacher')) {
            $user = $this->getCurrentUser();
            $staff = $db->table('staff')
                ->where('user_id', $user->id ?? '')
                ->where('tenant_id', $tenantId)
                ->get()
                ->getRowArray();

            if (!$staff) {
                return $this->success([
                    'classes' => [],
                    'summary' => ['totalStudents' => 0, 'totalCapacity' => 0, 'avgFill' => 0, 'graduatingCount' => 0, 'activeCount' => 0, 'archivedCount' => 0],
                    'pagination' => $this->buildPaginationMeta(0, $pagination['page'], $pagination['limit']),
                    'filters' => ['archived' => $archived, 'search' => $search, 'teacherId' => null],
                    'sort' => $sort,
                ]);
            }

            $teacherScopedId = $staff['id'];
        } elseif ($teacherId) {
            $teacher = $db->table('staff')
                ->where('id', $teacherId)
                ->where('tenant_id', $tenantId)
                ->get()
                ->getRowArray();
            if (!$teacher) {
                return $this->notFound('Teacher not found');
            }
        }

        $escapedTenantId = $db->escape($tenantId);
        $studentCountSql = "
            SELECT s.class_id, COUNT(*) AS student_count
            FROM students s
            INNER JOIN enrollments e ON e.id = s.current_enrollment_id
            WHERE s.tenant_id = {$escapedTenantId}
              AND s.status = 'active'
              AND e.status = '" . EnrollmentModel::STATUS_ACTIVE . "'
            GROUP BY s.class_id
        ";

        $builder = $db->table('classes c')
            ->select("c.*, CONCAT(COALESCE(t.first_name, ''), ' ', COALESCE(t.last_name, '')) AS teacher_name, COALESCE(sc.student_count, 0) AS studentCount", false)
            ->join('staff t', 't.id = c.teacher_id AND t.tenant_id = c.tenant_id', 'left')
            ->join("({$studentCountSql}) sc", 'sc.class_id = c.id', 'left')
            ->where('c.tenant_id', $tenantId);

        if ($archived === 'true') {
            $builder->where('c.archived_at IS NOT NULL', null, false);
        } elseif ($archived === 'false') {
            $builder->where('c.archived_at IS NULL', null, false);
        }

        if ($teacherScopedId || $teacherId) {
            $builder->where('c.teacher_id', $teacherScopedId ?: $teacherId);
        }

        if ($search !== '') {
            $builder->groupStart()
                ->like('c.name', $search)
                ->orLike('t.first_name', $search)
                ->orLike('t.last_name', $search)
                ->groupEnd();
        }

        $total = $builder->countAllResults(false);
        $sortColumns = [
            'name' => 'c.name',
            'studentCount' => 'studentCount',
            'capacity' => 'c.capacity',
            'teacherName' => 'teacher_name',
            'createdAt' => 'c.created_at',
        ];
        $summaryBuilder = clone $builder;
        $summaryRows = $summaryBuilder->get()->getResultArray();
        if ($sort['sortBy'] === 'progressionOrder') {
            $allClasses = $builder
                ->orderBy('c.name', 'ASC')
                ->get()
                ->getResultArray();
            $classes = array_slice(
                $this->sortClassesByProgression($allClasses, $sort['sortOrder'] === 'desc'),
                $pagination['offset'],
                $pagination['limit']
            );
        } else {
            $classes = $builder
                ->orderBy($sortColumns[$sort['sortBy']], strtoupper($sort['sortOrder']))
                ->limit($pagination['limit'], $pagination['offset'])
                ->get()
                ->getResultArray();
        }
        $nextClassIds = array_values(array_filter(array_unique(array_column($classes, 'next_class_id'))));
        $nextClassLookup = [];
        if (!empty($nextClassIds)) {
            $nextRows = $db->table('classes')
                ->select('id, name')
                ->whereIn('id', $nextClassIds)
                ->get()
                ->getResultArray();
            foreach ($nextRows as $row) {
                $nextClassLookup[$row['id']] = ['id' => $row['id'], 'name' => $row['name']];
            }
        }
        foreach ($classes as &$c) {
            $c['nextClass'] = !empty($c['next_class_id']) ? ($nextClassLookup[$c['next_class_id']] ?? null) : null;
        }
        unset($c);
        $formatted = array_map(fn($c) => $this->classModel->formatForApi($c), $classes);
        $summaryClasses = $this->classModel->where('tenant_id', $tenantId)->findAll();
        $activeCount = count(array_filter($summaryClasses, static fn(array $class): bool => empty($class['archived_at'])));
        $archivedCount = count($summaryClasses) - $activeCount;
        $totalCapacity = array_sum(array_map(static fn(array $class): int => (int) ($class['capacity'] ?? 0), $summaryRows));
        $totalStudents = array_sum(array_map(static fn(array $class): int => (int) ($class['studentCount'] ?? 0), $summaryRows));

        $response = [
            'classes' => $formatted,
            'summary' => [
                'totalStudents' => $totalStudents,
                'totalCapacity' => $totalCapacity,
                'avgFill' => $totalCapacity > 0 ? round($totalStudents / $totalCapacity * 100, 1) : 0,
                'graduatingCount' => count(array_filter($summaryClasses, static fn(array $class): bool => (bool) ($class['is_final_class'] ?? false))),
                'activeCount' => $activeCount,
                'archivedCount' => $archivedCount,
            ],
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
            'filters' => ['archived' => $archived, 'search' => $search, 'teacherId' => $teacherScopedId ?: $teacherId],
            'sort' => $sort,
        ];

        if ($includeTeachers) {
            $response['teachers'] = $db->table('staff')
                ->select("id, first_name AS firstName, last_name AS lastName, CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) AS name", false)
                ->where('tenant_id', $tenantId)
                ->where('employment_status', 'active')
                ->orderBy('last_name', 'ASC')
                ->get()
                ->getResultArray();
        }

        return $this->success($response);
    }

    public function show($id = null)
    {
        $tenantId = $this->getTenantId();
        $class    = $this->classModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$class) {
            return $this->notFound('Class not found');
        }

        // Teacher role: only allowed to view their own homeroom class
        if ($this->userHasRole('teacher')) {
            $user  = $this->getCurrentUser();
            $db    = \Config\Database::connect();
            $staff = $db->table('staff')
                ->where('user_id', $user->id ?? '')
                ->where('tenant_id', $tenantId)
                ->get()
                ->getRowArray();

            if (!$staff || $class['teacher_id'] !== $staff['id']) {
                return $this->forbidden('You are not the homeroom teacher of this class');
            }
        }

        return $this->success($this->classModel->formatForApi($class));
    }

    public function create()
    {
        $data     = $this->getRequestBody();
        $tenantId = $this->getTenantId();

        if (empty($data['name'])) {
            return $this->error('Class name is required', 400);
        }

        $classId   = $this->generateId('c');
        $classData = $this->classModel->formatFromApi($data, $tenantId);
        $classData['id'] = $classId;

        $this->classModel->insert($classData);
        $class = $this->classModel->find($classId);
        return $this->created($this->classModel->formatForApi($class));
    }

    public function update($id = null)
    {
        $tenantId = $this->getTenantId();
        $class    = $this->classModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$class) {
            return $this->notFound('Class not found');
        }

        $data = $this->getRequestBody();
        $nullCapacity = array_key_exists('capacity', $data) && $data['capacity'] === null;

        $updateData = $this->classModel->formatFromApi($data, $tenantId);
        if ($nullCapacity) {
            unset($updateData['capacity']);
        }
        $this->classModel->update($id, $updateData);

        if ($nullCapacity) {
            $this->classModel->db->query(
                'UPDATE classes SET capacity = NULL WHERE id = ? AND tenant_id = ?',
                [$id, $tenantId]
            );
        }

        $updated = $this->classModel->db->query(
            'SELECT * FROM classes WHERE id = ? AND tenant_id = ? LIMIT 1',
            [$id, $tenantId]
        )->getRowArray();
        return $this->success($this->classModel->formatForApi($updated));
    }

    public function archive($id = null)
    {
        $tenantId = $this->getTenantId();
        $class = $this->classModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$class) {
            return $this->notFound('Class not found');
        }

        // Check if class has students with active enrollment
        $db = \Config\Database::connect();
        $studentCount = $db->table('students s')
            ->select('COUNT(*) as count')
            ->join('enrollments e', 'e.id = s.current_enrollment_id')
            ->where('s.class_id', $id)
            ->where('s.status', 'active')
            ->where('e.status', EnrollmentModel::STATUS_ACTIVE)
            ->get()
            ->getRow()
            ->count ?? 0;
            
        if ($studentCount > 0) {
            return $this->error(
                "Cannot archive class with {$studentCount} active student" . ($studentCount > 1 ? 's' : '') . 
                " enrolled. Please reassign or remove all active students before archiving the class.",
                400
            );
        }

        // Soft delete by setting archived_at
        $this->classModel->update($id, ['archived_at' => date('Y-m-d H:i:s')]);
        return $this->success(['success' => true, 'id' => $id, 'message' => 'Class archived successfully']);
    }

    public function unarchive($id = null)
    {
        $tenantId = $this->getTenantId();
        $class = $this->classModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$class) {
            return $this->notFound('Class not found');
        }

        // Unarchive by setting archived_at to null
        $this->classModel->update($id, ['archived_at' => null]);
        return $this->success(['success' => true, 'id' => $id, 'message' => 'Class unarchived successfully']);
    }

    /**
     * GET /api/classes/student-counts
     * Get student counts for all classes in one call
     */
    public function getStudentCounts()
    {
        $tenantId = $this->getTenantId();
        $db = \Config\Database::connect();
        
        // Get all classes for this tenant
        $classes = $this->classModel->getByTenantSortedByName($tenantId);
        
        $counts = [];
        if (!empty($classes)) {
            $classIds = array_column($classes, 'id');
            
            // Get all student counts in a single query using GROUP BY
            $countResults = $db->table('students s')
                ->select('s.class_id, COUNT(*) as student_count')
                ->join('enrollments e', 'e.id = s.current_enrollment_id')
                ->whereIn('s.class_id', $classIds)
                ->where('s.status', 'active')
                ->where('e.status', EnrollmentModel::STATUS_ACTIVE)
                ->groupBy('s.class_id')
                ->get()
                ->getResultArray();
            
            // Convert to associative array and ensure all classes have a count (even if 0)
            foreach ($classes as $class) {
                $counts[$class['id']] = 0;
            }
            
            // Update with actual counts
            foreach ($countResults as $result) {
                $counts[$result['class_id']] = (int) $result['student_count'];
            }
        }
        
        return $this->success($counts);
    }

    public function studentCount($id = null)
    {
        $db = \Config\Database::connect();
        $count = $db->table('students s')
            ->select('COUNT(*) as count')
            ->join('enrollments e', 'e.id = s.current_enrollment_id')
            ->where('s.class_id', $id)
            ->where('s.status', 'active')
            ->where('e.status', EnrollmentModel::STATUS_ACTIVE)
            ->get()
            ->getRow()
            ->count ?? 0;
        return $this->success(['count' => $count]);
    }

    public function students($id = null)
    {
        if (!$id) {
            return $this->error('Class ID is required');
        }

        $tenantId = $this->getTenantId();
        $db = \Config\Database::connect();
        $pagination = $this->normalisePaginationParams(20, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $sort = $this->normaliseSortParams(['name', 'admissionNumber', 'status', 'gender'], 'name', 'asc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $search = $this->sanitiseString($this->request->getGet('search'));
        $status = $this->request->getGet('status') ?: 'active';
        $validStatuses = ['all', 'active', 'inactive', 'graduated', 'transferred', 'dropped_out'];

        if (!in_array($status, $validStatuses, true)) {
            return $this->error('Invalid status value.', 400);
        }

        // Verify class exists and belongs to tenant
        $class = $this->classModel->where('id', $id)
                                  ->where('tenant_id', $tenantId)
                                  ->first();

        if (!$class) {
            return $this->notFound('Class not found');
        }

        $studentsBuilder = $db->table('students s')
            ->select('s.*, e.id AS enrollment_id, c.name AS class_name')
            ->join('enrollments e', 'e.id = s.current_enrollment_id')
            ->join('classes c', 'c.id = s.class_id', 'left')
            ->where('s.class_id', $id)
            ->where('s.tenant_id', $tenantId)
            ->where('e.status', EnrollmentModel::STATUS_ACTIVE)
            ->where('e.tenant_id', $tenantId);

        if ($status !== 'all') {
            $studentsBuilder->where('s.status', $status);
        }

        if ($search !== '') {
            $studentsBuilder->groupStart()
                ->like('s.first_name', $search)
                ->orLike('s.last_name', $search)
                ->orLike('s.admission_number', $search)
                ->orLike("CONCAT(COALESCE(s.first_name, ''), ' ', COALESCE(s.last_name, ''))", $search, 'both', null, true)
                ->groupEnd();
        }

        $total = $studentsBuilder->countAllResults(false);
        $sortColumns = [
            'name' => 's.last_name',
            'admissionNumber' => 's.admission_number',
            'status' => 's.status',
            'gender' => 's.gender',
        ];
        $students = $studentsBuilder
            ->orderBy($sortColumns[$sort['sortBy']], strtoupper($sort['sortOrder']))
            ->orderBy('s.first_name', strtoupper($sort['sortOrder']))
            ->limit($pagination['limit'], $pagination['offset'])
            ->get()
            ->getResultArray();

        $formattedStudents = array_map(fn($s) => $this->studentModel->formatForApi($s), $students);
        $activeStudentCount = (int) $db->table('students s')
            ->join('enrollments e', 'e.id = s.current_enrollment_id')
            ->where('s.class_id', $id)
            ->where('s.tenant_id', $tenantId)
            ->where('s.status', 'active')
            ->where('e.status', EnrollmentModel::STATUS_ACTIVE)
            ->where('e.tenant_id', $tenantId)
            ->countAllResults();

        // Resolve teacher name in the same request — no extra round-trip on the client
        $teacherName = 'Unassigned';
        if (!empty($class['teacher_id'])) {
            $staff = $db->table('staff')
                ->select('first_name, last_name')
                ->where('id', $class['teacher_id'])
                ->where('tenant_id', $tenantId)
                ->get()
                ->getRowArray();
            if ($staff) {
                $teacherName = trim(($staff['first_name'] ?? '') . ' ' . ($staff['last_name'] ?? ''));
            }
        }

        // Resolve next class name
        $nextClass = null;
        if (!empty($class['next_class_id'])) {
            $nextRow = $db->table('classes')
                ->select('id, name')
                ->where('id', $class['next_class_id'])
                ->get()
                ->getRowArray();
            if ($nextRow) {
                $nextClass = ['id' => $nextRow['id'], 'name' => $nextRow['name']];
            }
        }

        $classDetails = [
            'id'           => $class['id'],
            'name'         => $class['name'],
            'capacity'     => (int) $class['capacity'],
            'studentCount' => $activeStudentCount,
            'teacherName'  => $teacherName,
            'teacherId'    => $class['teacher_id'],
            'nextClass'    => $nextClass,
            'isFinalClass' => (bool) ($class['is_final_class'] ?? false),
            'archivedAt'   => $class['archived_at'] ?? null,
        ];

        return $this->success([
            'class'    => $classDetails,
            'students' => $formattedStudents,
            'summary' => [
                'studentCount' => $total,
                'capacity' => (int) ($class['capacity'] ?? 0),
                'availableSeats' => max(0, (int) ($class['capacity'] ?? 0) - $activeStudentCount),
            ],
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
            'filters' => ['search' => $search, 'status' => $status],
            'sort' => $sort,
        ]);
    }

    public function assignStudents($id = null)
    {
        if (!$id) {
            return $this->error('Class ID is required');
        }

        $data     = $this->getRequestBody();
        $tenantId = $this->getTenantId();
        $force    = !empty($data['force']) && $data['force'] === true;

        // Verify class exists and belongs to tenant
        $class = $this->classModel->where('id', $id)
                                  ->where('tenant_id', $tenantId)
                                  ->first();

        if (!$class) {
            return $this->notFound('Class not found');
        }

        if (!isset($data['studentIds']) || !is_array($data['studentIds'])) {
            return $this->error('Student IDs array is required');
        }

        // ── Force-override authorization (must check before capacity) ─────────
        if ($force && !$this->userHasRole('admin', 'super_admin')) {
            return $this->forbidden('Only administrators can override capacity limits');
        }

        $db = \Config\Database::connect();

        // ── Capacity enforcement ──────────────────────────────────────────────
        $capacity = (int) $class['capacity'];

        // Count currently active enrollments in this class
        $currentEnrolled = (int) ($db->table('students s')
            ->select('COUNT(*) as count')
            ->join('enrollments e', 'e.id = s.current_enrollment_id')
            ->where('s.class_id', $id)
            ->where('s.status', 'active')
            ->where('e.status', EnrollmentModel::STATUS_ACTIVE)
            ->get()->getRow()?->count ?? 0);

        // Count students being newly added — those NOT already actively enrolled in this class
        $alreadyEnrolledInClass = array_column(
            $db->table('students s')
                ->select('s.id')
                ->join('enrollments e', 'e.id = s.current_enrollment_id')
                ->whereIn('s.id', $data['studentIds'])
                ->where('s.class_id', $id)
                ->where('s.status', 'active')
                ->where('e.status', EnrollmentModel::STATUS_ACTIVE)
                ->get()->getResultArray(),
            'id'
        );
        $newStudentsCount = count(array_diff($data['studentIds'], $alreadyEnrolledInClass));

        if (($currentEnrolled + $newStudentsCount) > $capacity && !$force) {
            return $this->respond([
                'status'  => false,
                'message' => 'Class capacity exceeded',
                'errors'  => [
                    'capacity'        => $capacity,
                    'currentEnrolled' => $currentEnrolled,
                    'attemptingToAdd' => $newStudentsCount,
                    'available'       => max(0, $capacity - $currentEnrolled),
                ],
            ], 409);
        }

        // ── Assignment transaction ────────────────────────────────────────────
        $db->transStart();

        try {
            $assignedCount  = 0;
            $currentSession = date('Y') . '/' . (date('Y') + 1);

            foreach ($data['studentIds'] as $studentId) {
                $student = $this->studentModel->where('id', $studentId)
                                              ->where('tenant_id', $tenantId)
                                              ->first();
                if (!$student) {
                    continue;
                }

                if ($student['class_id'] !== $id) {
                    // Close current enrollment as TRANSFERRED (mid-year class change)
                    $currentEnrollment = $this->enrollmentModel->getCurrentEnrollment($studentId);
                    if ($currentEnrollment) {
                        $this->enrollmentModel->update($currentEnrollment['id'], [
                            'status'          => EnrollmentModel::STATUS_TRANSFERRED,
                            'completion_date' => date('Y-m-d'),
                            'remarks'         => 'Transferred to class via Assign Students modal',
                        ]);
                    }

                    $this->enrollmentModel->enrollStudent([
                        'tenant_id'        => $tenantId,
                        'student_id'       => $studentId,
                        'class_id'         => $id,
                        'academic_session' => $currentSession,
                        'status'           => EnrollmentModel::STATUS_ACTIVE,
                        'enrollment_date'  => date('Y-m-d'),
                        'remarks'          => 'Assigned to class via Assign Students modal',
                    ]);

                    // Snapshot derives from the new ACTIVE enrollment.
                    (new \App\Services\StudentSnapshotService())->syncFromActiveEnrollment($studentId);

                    $assignedCount++;
                } else {
                    // Already in this class — ensure active enrollment exists
                    $currentEnrollment = $this->enrollmentModel->getCurrentEnrollment($studentId);
                    if (!$currentEnrollment) {
                        $this->enrollmentModel->enrollStudent([
                            'tenant_id'        => $tenantId,
                            'student_id'       => $studentId,
                            'class_id'         => $id,
                            'academic_session' => $currentSession,
                            'status'           => EnrollmentModel::STATUS_ACTIVE,
                            'enrollment_date'  => date('Y-m-d'),
                            'remarks'          => 'Enrollment created via Assign Students modal',
                        ]);
                        (new \App\Services\StudentSnapshotService())->syncFromActiveEnrollment($studentId);
                        $assignedCount++;
                    }
                }
            }

            $db->transComplete();

            if ($db->transStatus() === false) {
                return $this->error('Failed to assign students', 500);
            }

            return $this->success([
                'message'        => 'Students assigned successfully with enrollment records',
                'assignedCount'  => $assignedCount,
                'totalRequested' => count($data['studentIds']),
            ]);

        } catch (\Exception $e) {
            $db->transRollback();
            return $this->error('Failed to assign students: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/classes/final
     * Get all final classes (graduation classes)
     */
    public function getFinalClasses()
    {
        $tenantId = $this->getTenantId();
        
        $finalClasses = $this->classModel->getFinalClasses($tenantId);
        $formatted = array_map(fn($c) => $this->classModel->formatForApi($c), $finalClasses);
        
        return $this->success($formatted);
    }
    
    /**
     * PUT /api/classes/{id}/next-class
     * Set next class for a class
     */
    public function setNextClass($id = null)
    {
        $tenantId = $this->getTenantId();
        $class    = $this->classModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$class) {
            return $this->notFound('Class not found');
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $nextClassId  = $data['nextClassId'] ?? null;
        // When a next class is explicitly set, it cannot also be a final class.
        // When nextClassId is null, respect the caller's isFinalClass flag.
        $isFinalClass = $nextClassId ? false : (bool) ($data['isFinalClass'] ?? false);

        if ($nextClassId && $nextClassId === $id) {
            return $this->error('A class cannot be its own next class', 400);
        }

        if ($nextClassId) {
            $nextClass = $this->classModel->where('id', $nextClassId)->where('tenant_id', $tenantId)->first();
            if (!$nextClass) {
                return $this->notFound('Next class not found');
            }

            // Cycle detection: walk the chain from nextClassId forward
            $visited  = [$id]; // the class being updated is the starting point
            $current  = $nextClassId;
            $maxSteps = 50;
            $steps    = 0;
            while ($current !== null && $steps < $maxSteps) {
                if (in_array($current, $visited, true)) {
                    return $this->error(
                        'Setting this next class would create a circular promotion chain',
                        400
                    );
                }
                $visited[] = $current;
                $row       = $this->classModel->find($current);
                $current   = $row['next_class_id'] ?? null;
                $steps++;
            }
        }

        $updated = $this->classModel->update($id, [
            'next_class_id'  => $nextClassId,
            'is_final_class' => (int) $isFinalClass,
        ]);

        if ($updated) {
            $class = $this->classModel->find($id);
            return $this->success(
                $this->classModel->formatForApi($class),
                'Next class updated successfully'
            );
        } else {
            return $this->error('Failed to update next class', 500);
        }
    }
    
    /**
     * GET /api/classes/{id}/next-class
     * Get next class for a class
     */
    public function getNextClass($id = null)
    {
        $tenantId = $this->getTenantId();
        $class    = $this->classModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$class) {
            return $this->notFound('Class not found');
        }
        
        $nextClass = $this->classModel->getNextClass($id);
        
        if ($nextClass) {
            return $this->success($this->classModel->formatForApi($nextClass));
        } else {
            return $this->success(null, 'No next class available');
        }
    }
    
    /**
     * GET /api/classes/{id}/enrollment-history
     * Check if class has any enrollment history
     */
    public function getEnrollmentHistory($id = null)
    {
        $class = $this->classModel->find($id);
        if (!$class) {
            return $this->notFound('Class not found');
        }

        // Check if class belongs to the current tenant
        if ($class['tenant_id'] !== $this->getTenantId()) {
            return $this->error('Access denied', 403);
        }

        // Check for any enrollments (including inactive ones)
        $db = \Config\Database::connect();
        $enrollmentCount = $db->table('enrollments')
            ->where('class_id', $id)
            ->countAllResults();
        
        return $this->success([
            'classId' => $id,
            'hasEnrollments' => $enrollmentCount > 0,
            'count' => $enrollmentCount
        ]);
    }
    
    /**
     * DELETE /api/classes/{id}/permanent-delete
     * Permanently delete a class from the database
     * Only allowed if class has no historical data
     */
    public function permanentDelete($id = null)
    {
        $class = $this->classModel->find($id);
        if (!$class) {
            return $this->notFound('Class not found');
        }

        // Check if class belongs to the current tenant
        if ($class['tenant_id'] !== $this->getTenantId()) {
            return $this->error('Access denied', 403);
        }

        // Check if class has any historical data
        $db = \Config\Database::connect();
        
        // Check for any enrollments (including inactive ones)
        $enrollmentCount = $db->table('enrollments')
            ->where('class_id', $id)
            ->countAllResults();
            
        if ($enrollmentCount > 0) {
            return $this->error(
                'Cannot permanently delete class with historical enrollment data. Please archive the class instead.',
                400
            );
        }
        
        // Check for any students ever assigned to this class
        $studentHistoryCount = $db->table('students')
            ->where('class_id', $id)
            ->countAllResults();
            
        if ($studentHistoryCount > 0) {
            return $this->error(
                'Cannot permanently delete class with student history. Please archive the class instead.',
                400
            );
        }
        
        // Check if any class has this as their next class
        $referencingClasses = $db->table('classes')
            ->where('next_class_id', $id)
            ->countAllResults();
            
        if ($referencingClasses > 0) {
            return $this->error(
                'Cannot permanently delete class that is set as next class for another class. Please update the referencing classes first.',
                400
            );
        }
        
        // Start transaction for permanent deletion
        $db->transStart();
        
        try {
            // Delete the class permanently
            $this->classModel->delete($id);
            
            $db->transComplete();
            
            if ($db->transStatus() === false) {
                return $this->error('Failed to permanently delete class', 500);
            }
            
            return $this->success([
                'id' => $id,
                'message' => 'Class permanently deleted successfully'
            ]);
            
        } catch (\Exception $e) {
            $db->transRollback();
            return $this->error('Failed to permanently delete class: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * GET /api/classes/promotion-preview
     * Preview promotion for all classes
     */
    public function getPromotionPreview()
    {
        $tenantId = $this->getTenantId();

        $classes  = $this->classModel->getByTenantSortedByName($tenantId);
        $preview  = [];

        // Batch-resolve all nextClass data for the preview in one query
        $nextClassIdList = array_filter(array_unique(array_column($classes, 'next_class_id')));
        $nextClassLookup = [];
        if (!empty($nextClassIdList)) {
            $db = \Config\Database::connect();
            $nextRows = $db->table('classes')
                ->whereIn('id', $nextClassIdList)
                ->get()
                ->getResultArray();
            foreach ($nextRows as $row) {
                $nextClassLookup[$row['id']] = $row;
            }
        }

        $academicSession = $this->sessionService->getCurrentSession($tenantId);

        foreach ($classes as $class) {
            $studentsToPromote = $this->classModel->getStudentsForPromotion($class['id'], $academicSession);

            // Use already-loaded fields instead of extra per-class DB calls
            $isFinal   = (bool) ($class['is_final_class'] ?? false);
            $nextClass = isset($class['next_class_id']) && $class['next_class_id']
                ? ($nextClassLookup[$class['next_class_id']] ?? null)
                : null;

            $formattedClass = $this->classModel->formatForApi($class);

            // Derive status/action for this class based on is_final_class and next_class_id
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

            $preview[] = [
                'class'            => $formattedClass,
                'studentsToPromote' => count($studentsToPromote),
                'nextClass'        => $nextClass ? $this->classModel->formatForApi($nextClass) : null,
                'isFinalClass'     => $isFinal,
                'status'           => $status,
                'action'           => $action,
            ];
        }

        return $this->success($preview);
    }

    /**
     * GET /api/class-instances[?academicYear=2025/2026]
     * Return class instances for the tenant, optionally filtered by academic year.
     * Used by the attendance form to select a class instance.
     */
    public function classInstances()
    {
        $tenantId     = $this->getTenantId();
        $academicYear = $this->request->getGet('academicYear') ?: null;

        $db      = \Config\Database::connect();
        $builder = $db->table('class_instances ci')
            ->select('ci.id, ci.class_id, ci.academic_year, ci.teacher_id, c.name AS class_name')
            ->join('classes c', 'c.id = ci.class_id')
            ->where('ci.tenant_id', $tenantId)
            ->where('c.archived_at IS NULL', null, false)
            ->orderBy('c.name', 'ASC');

        if ($academicYear !== null) {
            $builder->where('ci.academic_year', $academicYear);
        }

        // Teachers only see class instances assigned to them
        if ($this->userHasRole('teacher')) {
            $user  = $this->getCurrentUser();
            $staff = $db->table('staff')
                ->where('user_id', $user->id ?? '')
                ->where('tenant_id', $tenantId)
                ->get()->getRowArray();

            if (!$staff) {
                return $this->success([]);
            }

            // Match on class-instance teacher_id OR the parent class teacher_id
            $staffId = $staff['id'];
            $builder->groupStart()
                ->where('ci.teacher_id', $staffId)
                ->orWhere('c.teacher_id', $staffId)
            ->groupEnd();
        }

        $rows = $builder->get()->getResultArray();

        $formatted = array_map(fn(array $r): array => [
            'id'           => $r['id'],
            'classId'      => $r['class_id'],
            'className'    => $r['class_name'],
            'academicYear' => $r['academic_year'],
            'teacherId'    => $r['teacher_id'],
        ], $rows);

        return $this->success($formatted);
    }

    private function sortClassesByProgression(array $classes, bool $descending = false): array
    {
        $byId = [];
        $pointedTo = [];
        foreach ($classes as $class) {
            $byId[$class['id']] = $class;
            if (!empty($class['next_class_id'])) {
                $pointedTo[$class['next_class_id']] = true;
            }
        }

        $ordered = [];
        $visited = [];
        $starts = array_values(array_filter($classes, static fn(array $class): bool => !isset($pointedTo[$class['id']])));
        usort($starts, static fn(array $a, array $b): int => strnatcasecmp((string) $a['name'], (string) $b['name']));

        foreach ($starts as $start) {
            $current = $start;
            while ($current && !isset($visited[$current['id']])) {
                $ordered[] = $current;
                $visited[$current['id']] = true;
                $nextId = $current['next_class_id'] ?? null;
                $current = $nextId && isset($byId[$nextId]) ? $byId[$nextId] : null;
            }
        }

        $remaining = array_values(array_filter($classes, static fn(array $class): bool => !isset($visited[$class['id']])));
        usort($remaining, static fn(array $a, array $b): int => strnatcasecmp((string) $a['name'], (string) $b['name']));
        $ordered = array_merge($ordered, $remaining);

        return $descending ? array_reverse($ordered) : $ordered;
    }
}
