<?php

namespace App\Controllers\Api;

class StudentsOptimizedController extends BaseApiController
{
    protected \App\Models\StudentModel $studentModel;
    protected \App\Models\ClassModel $classModel;
    protected \App\Models\EnrollmentModel $enrollmentModel;

    public function __construct()
    {
        $this->studentModel = new \App\Models\StudentModel();
        $this->classModel = new \App\Models\ClassModel();
        $this->enrollmentModel = new \App\Models\EnrollmentModel();
    }

    /**
     * GET /api/students-optimized
     * Combined endpoint for students and classes data
     * Includes caching for classes which rarely change
     */
    public function index()
    {
        $tenantId = $this->getTenantId();
        $cache = \Config\Services::cache();

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
        $unassignedOnly = $this->request->getGet('unassignedOnly') === 'true';
        $includeClasses = $this->request->getGet('includeClasses') !== 'false';
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
            $pagination['offset'],
            $unassignedOnly
        );
        
        // Get total count for pagination
        $totalCount = $this->studentModel->getFilteredStudentsCount(
            $tenantId,
            $classId ?: null,
            $status,
            $search !== '' ? $search : null,
            $balanceOnly,
            $unassignedOnly
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

        // Calculate statistics scoped to the current filters (not paginated)
        $stats = $this->studentModel->getGlobalStats($tenantId, $classId ?: null, $status, $search !== '' ? $search : null);
        
        // Prepare response
        $response = [
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
        ];
        
        // Include classes if requested (with caching)
        if ($includeClasses) {
            $cacheKey = "classes_active_tenant_{$tenantId}";
            $classes = $cache->get($cacheKey);
            
            if (!$classes) {
                $classes = $this->classModel->getByTenantSortedByName($tenantId, false);
                // Cache for 1 hour since classes rarely change
                $cache->save($cacheKey, $classes, 3600);
            }
            
            $response['classes'] = $classes;
        }
        
        return $this->success($response);
    }
    
}
