<?php

namespace App\Services;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

/**
 * TransportAssignmentService
 *
 * Encapsulates business logic for transport student allocations:
 *
 *  - Validation: stop must belong to route, route must have at least one stop,
 *    student must not already be active on another route.
 *  - Creation, reassignment (atomic end-old + create-new), and deallocation.
 *  - Auto-deallocation triggered when a student's status transitions away from 'active'.
 *
 * All queries are scoped by `tenant_id` to maintain multi-tenant isolation.
 */
class TransportAssignmentService
{
    public const ACTIVE_STATUSES   = ['active'];
    public const VALID_DIRECTIONS  = ['both', 'inbound', 'outbound'];

    private BaseConnection $db;

    public function __construct(?BaseConnection $db = null)
    {
        $this->db = $db ?? Database::connect();
    }

    /**
     * Generate a prefixed allocation ID. Mirrors BaseApiController::generateId().
     */
    public function generateId(string $prefix = 'tsa_'): string
    {
        return $prefix . time() . '_' . bin2hex(random_bytes(4));
    }

    /**
     * Look up a student's currently active allocation, if any.
     * Returns the row joined with the route name, or null.
     */
    public function getActiveAllocation(string $tenantId, string $studentId): ?array
    {
        $row = $this->db->table('transport_student_allocations tsa')
            ->select('tsa.*, r.route_name')
            ->join('transport_routes r', 'r.id = tsa.route_id', 'left')
            ->where('tsa.tenant_id', $tenantId)
            ->where('tsa.student_id', $studentId)
            ->where('tsa.status', 'active')
            ->get()->getRowArray();
        return $row ?: null;
    }

    /**
     * Verify a stop belongs to the given route within the tenant.
     */
    public function stopBelongsToRoute(string $tenantId, string $routeId, string $stopId): bool
    {
        $row = $this->db->table('transport_stops')
            ->where('id', $stopId)
            ->where('route_id', $routeId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();
        return !empty($row);
    }

    /**
     * Returns the count of stops configured for a route (within tenant).
     */
    public function routeStopsCount(string $tenantId, string $routeId): int
    {
        return $this->db->table('transport_stops')
            ->where('route_id', $routeId)
            ->where('tenant_id', $tenantId)
            ->countAllResults();
    }

    /**
     * Validate inputs for creating a new allocation.
     *
     * Returns an array describing the failure (caller maps to HTTP status), or
     * null on success. Output shape:
     *   [
     *     'status'  => int HTTP status,
     *     'message' => string,
     *     'errors'  => mixed|null,
     *   ]
     */
    public function validateNewAssignment(
        string $tenantId,
        string $routeId,
        string $studentId,
        ?string $stopId,
        ?string $direction = 'both'
    ): ?array {
        // Direction
        if ($direction !== null && !in_array($direction, self::VALID_DIRECTIONS, true)) {
            return [
                'status'  => 400,
                'message' => 'Invalid direction. Must be one of: ' . implode(', ', self::VALID_DIRECTIONS),
                'errors'  => ['direction' => 'Invalid value'],
            ];
        }

        // Route must have at least one stop configured (US2 / FR-008).
        if ($this->routeStopsCount($tenantId, $routeId) === 0) {
            return [
                'status'  => 400,
                'message' => 'Route must have at least one stop before students can be assigned',
                'errors'  => ['route' => 'no_stops_configured'],
            ];
        }

        // Stop is required (US2 / FR-005, FR-007).
        if (empty($stopId)) {
            return [
                'status'  => 400,
                'message' => 'Stop selection is required for all student assignments',
                'errors'  => ['stopId' => 'required'],
            ];
        }

        // Stop must belong to route (US2 / FR-006).
        if (!$this->stopBelongsToRoute($tenantId, $routeId, $stopId)) {
            return [
                'status'  => 400,
                'message' => 'Selected stop does not belong to the specified route',
                'errors'  => ['stopId' => 'invalid_for_route'],
            ];
        }

        // Single-route enforcement (US1 / FR-001, FR-002).
        $existing = $this->getActiveAllocation($tenantId, $studentId);
        if ($existing !== null) {
            // Already on the SAME route → preserve historical wording.
            if ($existing['route_id'] === $routeId) {
                return [
                    'status'  => 409,
                    'message' => 'Student already has an active allocation on this route',
                    'errors'  => [
                        'existingAssignment' => [
                            'allocationId' => $existing['id'],
                            'routeId'      => $existing['route_id'],
                            'routeName'    => $existing['route_name'] ?? null,
                        ],
                    ],
                ];
            }
            return [
                'status'  => 409,
                'message' => sprintf(
                    'Student is already assigned to route "%s". Please reassign instead.',
                    $existing['route_name'] ?? $existing['route_id']
                ),
                'errors'  => [
                    'existingAssignment' => [
                        'allocationId' => $existing['id'],
                        'routeId'      => $existing['route_id'],
                        'routeName'    => $existing['route_name'] ?? null,
                    ],
                ],
            ];
        }

        return null;
    }

    /**
     * Insert a new allocation row. Caller is responsible for prior validation.
     *
     * Returns the inserted row (array), or throws on DB failure.
     */
    public function createAllocation(
        string $tenantId,
        string $routeId,
        string $studentId,
        string $stopId,
        string $direction = 'both',
        ?string $notes = null,
        ?string $academicYear = null,
        ?string $startDate = null
    ): array {
        $id  = $this->generateId('tsa_');
        $now = date('Y-m-d H:i:s');

        $row = [
            'id'            => $id,
            'tenant_id'     => $tenantId,
            'student_id'    => $studentId,
            'route_id'      => $routeId,
            'stop_id'       => $stopId,
            'direction'     => in_array($direction, self::VALID_DIRECTIONS, true) ? $direction : 'both',
            'academic_year' => $academicYear ?? '',
            'start_date'    => $startDate ?? date('Y-m-d'),
            'status'        => 'active',
            'notes'         => $notes,
            'created_at'    => $now,
            'updated_at'    => $now,
        ];

        $this->db->table('transport_student_allocations')->insert($row);
        return $row;
    }

    /**
     * Atomically reassign a student from one route to another.
     *
     * Steps performed inside a single DB transaction:
     *   1. Verify the student has an active allocation on $fromRouteId.
     *   2. Validate the new stop belongs to $toRouteId.
     *   3. Mark the old allocation inactive with end_date = (reassignDate - 1).
     *   4. Insert a new allocation on $toRouteId with start_date = reassignDate.
     *
     * Returns:
     *   [ 'endedAssignment' => array, 'newAssignment' => array ]   on success
     * Or an error envelope:
     *   [ 'error' => [ 'status' => int, 'message' => string, 'errors' => mixed ] ]
     */
    public function reassignStudent(
        string $tenantId,
        string $studentId,
        string $fromRouteId,
        string $toRouteId,
        string $toStopId,
        string $direction = 'both',
        ?string $notes = null,
        ?string $reassignDate = null,
        ?string $academicYear = null
    ): array {
        if ($fromRouteId === $toRouteId) {
            return ['error' => [
                'status'  => 400,
                'message' => 'fromRouteId and toRouteId must be different',
                'errors'  => ['toRouteId' => 'must_differ_from_fromRouteId'],
            ]];
        }

        $reassignDate = $reassignDate ?: date('Y-m-d');
        if (!$this->isValidDate($reassignDate)) {
            return ['error' => [
                'status'  => 400,
                'message' => 'reassignDate must be a valid date (YYYY-MM-DD)',
                'errors'  => ['reassignDate' => 'invalid_format'],
            ]];
        }

        // Validate destination route + stop independently (mirror US2 rules).
        if ($this->routeStopsCount($tenantId, $toRouteId) === 0) {
            return ['error' => [
                'status'  => 400,
                'message' => 'Target route has no stops configured',
                'errors'  => ['toRouteId' => 'no_stops_configured'],
            ]];
        }
        if (empty($toStopId) || !$this->stopBelongsToRoute($tenantId, $toRouteId, $toStopId)) {
            return ['error' => [
                'status'  => 400,
                'message' => 'Stop is required and must belong to the target route',
                'errors'  => ['toStopId' => 'invalid_for_route'],
            ]];
        }

        $this->db->transStart();

        try {
            // Confirm current active allocation on fromRouteId.
            $current = $this->db->table('transport_student_allocations tsa')
                ->select('tsa.*, r.route_name')
                ->join('transport_routes r', 'r.id = tsa.route_id', 'left')
                ->where('tsa.tenant_id', $tenantId)
                ->where('tsa.student_id', $studentId)
                ->where('tsa.status', 'active')
                ->get()->getRowArray();

            if (!$current) {
                $this->db->transRollback();
                return ['error' => [
                    'status'  => 409,
                    'message' => 'Student does not have an active transport assignment',
                    'errors'  => null,
                ]];
            }

            if ($current['route_id'] !== $fromRouteId) {
                $this->db->transRollback();
                return ['error' => [
                    'status'  => 409,
                    'message' => 'Student is not currently assigned to the specified fromRouteId',
                    'errors'  => [
                        'currentAssignment' => [
                            'allocationId' => $current['id'],
                            'routeId'      => $current['route_id'],
                            'routeName'    => $current['route_name'] ?? null,
                        ],
                    ],
                ]];
            }

            // End the old allocation: end_date = day BEFORE the reassignment date so
            // the new allocation cleanly takes over from reassignDate.
            $endDate = date('Y-m-d', strtotime($reassignDate . ' -1 day'));
            $now     = date('Y-m-d H:i:s');

            $this->db->table('transport_student_allocations')
                ->where('id', $current['id'])
                ->update([
                    'status'     => 'inactive',
                    'end_date'   => $endDate,
                    'updated_at' => $now,
                ]);

            // Insert the new allocation.
            $newRow = $this->createAllocation(
                $tenantId,
                $toRouteId,
                $studentId,
                $toStopId,
                $direction,
                $notes,
                $academicYear ?? ($current['academic_year'] ?? ''),
                $reassignDate
            );

            $this->db->transComplete();

            if ($this->db->transStatus() === false) {
                return ['error' => [
                    'status'  => 500,
                    'message' => 'Reassignment transaction failed',
                    'errors'  => null,
                ]];
            }

            $endedRefreshed = $this->db->table('transport_student_allocations')
                ->where('id', $current['id'])->get()->getRowArray();

            return [
                'endedAssignment' => $endedRefreshed,
                'newAssignment'   => $newRow,
            ];
        } catch (\Throwable $e) {
            $this->db->transRollback();

            // MySQL duplicate key (unique active assignment violation)
            if (strpos($e->getMessage(), '1062') !== false ||
                stripos($e->getMessage(), 'Duplicate entry') !== false) {
                return ['error' => [
                    'status'  => 409,
                    'message' => 'A concurrent assignment for this student already exists',
                    'errors'  => null,
                ]];
            }

            return ['error' => [
                'status'  => 500,
                'message' => 'Failed to reassign student',
                'errors'  => null,
            ]];
        }
    }

    /**
     * Auto-deallocate ALL active transport assignments for a student.
     * Used by StudentStatusService when a student leaves 'active' status.
     *
     * Returns the number of rows updated.
     */
    public function deactivateAllForStudent(string $tenantId, string $studentId, ?string $endDate = null): int
    {
        $endDate = $endDate ?: date('Y-m-d');
        $now     = date('Y-m-d H:i:s');

        $builder = $this->db->table('transport_student_allocations')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('status', 'active');

        $count = $builder->countAllResults(false);

        if ($count > 0) {
            $builder->update([
                'status'     => 'inactive',
                'end_date'   => $endDate,
                'updated_at' => $now,
            ]);
        }

        return $count;
    }

    /**
     * Soft-delete a single allocation (manual deallocation path).
     */
    public function deactivateById(string $tenantId, string $allocationId): bool
    {
        $row = $this->db->table('transport_student_allocations')
            ->where('id', $allocationId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$row) {
            return false;
        }

        $this->db->table('transport_student_allocations')
            ->where('id', $allocationId)
            ->update([
                'status'     => 'inactive',
                'end_date'   => date('Y-m-d'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        return true;
    }

    /**
     * Find students with active transport assignments who lack a transport
     * charge for the given month (academic_session = YYYY-MM).
     *
     * If $routeId is provided, results are scoped to that route.
     */
    public function getMissingCharges(string $tenantId, string $month, ?string $routeId = null, ?string $academicYear = null): array
    {
        $builder = $this->db->table('transport_student_allocations tsa')
            ->select(
                'tsa.id AS allocation_id, tsa.student_id, tsa.route_id, tsa.start_date, tsa.academic_year, ' .
                'r.route_name, r.monthly_fee, ' .
                's.first_name, s.last_name, s.admission_number, ' .
                'c.name AS class_name'
            )
            ->join('transport_routes r', 'r.id = tsa.route_id', 'left')
            ->join('students s', 's.id = tsa.student_id', 'left')
            ->join('classes c', 'c.id = s.class_id', 'left')
            ->where('tsa.tenant_id', $tenantId)
            ->where('tsa.status', 'active')
            ->where('s.status', 'active');

        if ($routeId) {
            $builder->where('tsa.route_id', $routeId);
        }
        if ($academicYear) {
            $builder->where('tsa.academic_year', $academicYear);
        }

        // Exclude students who already have a transport charge for the month.
        $sub = "NOT EXISTS (SELECT 1 FROM charges ch
                  WHERE ch.tenant_id = tsa.tenant_id
                    AND ch.student_id = tsa.student_id
                    AND ch.route_id = tsa.route_id
                    AND ch.charge_type = 'transport'
                    AND ch.academic_session = " . $this->db->escape($month) . "
                    AND ch.deleted_at IS NULL)";
        $builder->where($sub, null, false);

        return $builder->orderBy('r.route_name')
            ->orderBy('s.last_name')
            ->orderBy('s.first_name')
            ->get()->getResultArray();
    }

    /**
     * Group missing-charge rows by route for the API response.
     */
    public function groupMissingChargesByRoute(array $rows): array
    {
        $byRoute = [];
        foreach ($rows as $row) {
            $rid = $row['route_id'];
            if (!isset($byRoute[$rid])) {
                $byRoute[$rid] = [
                    'routeId'      => $rid,
                    'routeName'    => $row['route_name'] ?? null,
                    'monthlyFee'   => isset($row['monthly_fee']) ? (float) $row['monthly_fee'] : 0.0,
                    'missingCount' => 0,
                    'students'     => [],
                ];
            }
            $byRoute[$rid]['missingCount']++;
            $byRoute[$rid]['students'][] = [
                'studentId'      => $row['student_id'],
                'firstName'      => $row['first_name'] ?? '',
                'lastName'       => $row['last_name'] ?? '',
                'admissionNumber'=> $row['admission_number'] ?? null,
                'className'      => $row['class_name'] ?? null,
                'monthlyFee'     => isset($row['monthly_fee']) ? (float) $row['monthly_fee'] : 0.0,
                'assignmentDate' => $row['start_date'] ?? null,
                'academicYear'   => $row['academic_year'] ?? null,
            ];
        }
        return array_values($byRoute);
    }

    private function isValidDate(string $date): bool
    {
        $d = \DateTime::createFromFormat('Y-m-d', $date);
        return $d !== false && $d->format('Y-m-d') === $date;
    }
}
