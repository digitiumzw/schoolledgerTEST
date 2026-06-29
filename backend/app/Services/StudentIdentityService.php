<?php

namespace App\Services;

use App\Models\EnrollmentModel;
use App\Models\StudentModel;
use App\Models\StudentProfileHistoryModel;
use CodeIgniter\Database\BaseConnection;
use Config\Database;
use InvalidArgumentException;
use RuntimeException;

class StudentIdentityService
{
    private const EVENT_TYPES = [
        'profile_change',
        'status_change',
        'enrollment',
        'transport_assignment',
        'charge',
        'payment',
        'ledger_adjustment',
    ];

    private const FIELD_ALIASES = [
        'guardianName' => 'guardian_name',
        'guardianPhone' => 'guardian_phone',
        'guardianEmail' => 'guardian_email',
        'guardianRelationship' => 'guardian_relationship',
        'guardian2Name' => 'guardian2_name',
        'guardian2Phone' => 'guardian2_phone',
        'guardian2Relationship' => 'guardian2_relationship',
        'photoUrl' => 'photo_url',
        'bursaryStatus' => 'bursary_status',
        'bursaryPercentage' => 'bursary_percentage',
        'bursaryReason' => 'bursary_reason',
    ];

    private BaseConnection $db;
    private StudentModel $students;
    private EnrollmentModel $enrollments;
    private StudentProfileHistoryModel $profileHistory;

    public function __construct(
        ?BaseConnection $db = null,
        ?StudentModel $students = null,
        ?EnrollmentModel $enrollments = null,
        ?StudentProfileHistoryModel $profileHistory = null
    ) {
        $this->db = $db ?? Database::connect();
        $this->students = $students ?? new StudentModel();
        $this->enrollments = $enrollments ?? new EnrollmentModel();
        $this->profileHistory = $profileHistory ?? new StudentProfileHistoryModel();
    }

    public function getIdentity(string $tenantId, string $studentId): ?array
    {
        $student = $this->getStudentRow($tenantId, $studentId);
        if (!$student) {
            return null;
        }

        $currentEnrollment = $this->enrollments->getCurrentEnrollment($studentId);
        $activeTransport = $this->getActiveTransport($tenantId, $studentId);

        return [
            'student' => $this->students->formatForApi($student),
            'currentEnrollment' => $currentEnrollment ? $this->enrollments->formatForApi($currentEnrollment) : null,
            'activeTransport' => $activeTransport,
            'summary' => [
                'enrollmentRecords' => $this->countRows('enrollments', $tenantId, $studentId),
                'profileHistoryRecords' => $this->countRows('student_profile_history', $tenantId, $studentId),
                'statusHistoryRecords' => $this->countRows('student_status_history', $tenantId, $studentId),
                'transportAssignments' => $this->countRows('transport_student_allocations', $tenantId, $studentId),
                'charges' => $this->countRows('charges', $tenantId, $studentId, ['deleted_at' => null, 'voided_at' => null]),
                'payments' => $this->countRows('payments', $tenantId, $studentId),
                'hasActiveTransport' => $activeTransport !== null,
            ],
        ];
    }

    public function getProfileHistory(string $tenantId, string $studentId, array $filters = []): ?array
    {
        $student = $this->getStudentRow($tenantId, $studentId);
        if (!$student) {
            return null;
        }

        $filters = $this->normaliseHistoryFilters($filters);
        $rows = $this->profileHistory->getByStudent($tenantId, $studentId, $filters);

        return [
            'studentId' => $studentId,
            'history' => array_map(fn($row) => $this->profileHistory->formatForApi($row), $rows),
        ];
    }

    public function recordProfileChange(string $tenantId, string $studentId, array $data, string $changedByUserId): array
    {
        $student = $this->getStudentRow($tenantId, $studentId);
        if (!$student) {
            throw new RuntimeException('Student not found', 404);
        }

        $fieldName = $this->normaliseFieldName((string) ($data['fieldName'] ?? ''));
        $changeType = (string) ($data['changeType'] ?? '');
        $effectiveDate = (string) ($data['effectiveDate'] ?? '');
        $reason = trim((string) ($data['reason'] ?? ''));
        $newValue = array_key_exists('newValue', $data) ? $data['newValue'] : null;

        if (!$this->profileHistory->isMutableField($fieldName)) {
            throw new InvalidArgumentException('This field cannot be changed through profile history');
        }
        if (!$this->profileHistory->isValidChangeType($changeType)) {
            throw new InvalidArgumentException('Invalid change type');
        }
        if (!$this->isValidDate($effectiveDate)) {
            throw new InvalidArgumentException('effectiveDate must be a valid YYYY-MM-DD date');
        }
        if ($reason === '') {
            throw new InvalidArgumentException('reason is required');
        }
        if (is_array($newValue) || is_object($newValue)) {
            throw new InvalidArgumentException('newValue must be a scalar value');
        }

        $previousValue = $student[$fieldName] ?? null;
        $newValueForDb = $newValue === null ? null : trim((string) $newValue);
        $previousComparable = $previousValue === null ? null : (string) $previousValue;
        if ($previousComparable === $newValueForDb) {
            throw new InvalidArgumentException('New value matches the current value');
        }

        $historyData = [
            'tenant_id' => $tenantId,
            'student_id' => $studentId,
            'field_name' => $fieldName,
            'previous_value' => $previousComparable,
            'new_value' => $newValueForDb,
            'change_type' => $changeType,
            'effective_date' => $effectiveDate,
            'reason' => $reason,
            'changed_by_user_id' => $changedByUserId,
        ];

        $this->db->transStart();
        $historyId = $this->profileHistory->createHistoryRecord($historyData);
        $this->students->update($studentId, [$fieldName => $newValueForDb]);
        $this->db->transComplete();

        if ($this->db->transStatus() === false) {
            throw new RuntimeException('Failed to record profile history', 500);
        }

        $historyRow = $this->profileHistory
            ->select('student_profile_history.*, u.name as changed_by_name_raw')
            ->join('users u', 'u.id = student_profile_history.changed_by_user_id', 'left')
            ->where('student_profile_history.id', $historyId)
            ->first();
        $updated = $this->students->where('id', $studentId)->where('tenant_id', $tenantId)->first();

        return [
            'historyRecord' => $this->profileHistory->formatForApi($historyRow),
            'student' => $this->students->formatForApi($updated),
        ];
    }

    public function getTimeline(string $tenantId, string $studentId, array $filters = []): ?array
    {
        $student = $this->getStudentRow($tenantId, $studentId);
        if (!$student) {
            return null;
        }

        $filters = $this->normaliseTimelineFilters($filters);
        $events = [];
        $types = $filters['types'];

        if (in_array('enrollment', $types, true)) {
            $events = array_merge($events, $this->getEnrollmentEvents($tenantId, $studentId, $filters));
        }
        if (in_array('status_change', $types, true)) {
            $events = array_merge($events, $this->getStatusEvents($tenantId, $studentId, $filters));
        }
        if (in_array('profile_change', $types, true)) {
            $events = array_merge($events, $this->getProfileEvents($tenantId, $studentId, $filters));
        }
        if (in_array('transport_assignment', $types, true)) {
            $events = array_merge($events, $this->getTransportEvents($tenantId, $studentId, $filters));
        }
        if (in_array('charge', $types, true)) {
            $events = array_merge($events, $this->getChargeEvents($tenantId, $studentId, $filters));
        }
        if (in_array('payment', $types, true)) {
            $events = array_merge($events, $this->getPaymentEvents($tenantId, $studentId, $filters));
        }
        if (in_array('ledger_adjustment', $types, true)) {
            $events = array_merge($events, $this->getAdjustmentEvents($tenantId, $studentId, $filters));
        }

        usort($events, static function (array $a, array $b): int {
            $dateCompare = strcmp($b['eventDate'], $a['eventDate']);
            if ($dateCompare !== 0) {
                return $dateCompare;
            }
            return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
        });

        $total = count($events);
        $offset = ($filters['page'] - 1) * $filters['limit'];
        $paged = array_slice($events, $offset, $filters['limit']);

        return [
            'studentId' => $studentId,
            'studentName' => trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')),
            'filters' => [
                'from' => $filters['from'],
                'to' => $filters['to'],
                'academicYear' => $filters['academicYear'],
                'types' => $filters['types'],
            ],
            'events' => array_map(static function (array $event): array {
                unset($event['createdAt']);
                return $event;
            }, $paged),
            'pagination' => [
                'page' => $filters['page'],
                'limit' => $filters['limit'],
                'total' => $total,
                'totalPages' => $filters['limit'] > 0 ? (int) ceil($total / $filters['limit']) : 0,
            ],
        ];
    }

    public function normaliseFieldName(string $fieldName): string
    {
        return self::FIELD_ALIASES[$fieldName] ?? $fieldName;
    }

    private function getStudentRow(string $tenantId, string $studentId): ?array
    {
        return $this->db->table('students s')
            ->select('s.*, c.name as class_name')
            ->join('classes c', 'c.id = s.class_id', 'left')
            ->where('s.id', $studentId)
            ->where('s.tenant_id', $tenantId)
            ->get()
            ->getRowArray();
    }

    private function getActiveTransport(string $tenantId, string $studentId): ?array
    {
        if (!$this->db->tableExists('transport_student_allocations')) {
            return null;
        }

        $row = $this->db->table('transport_student_allocations tsa')
            ->select('tsa.id, tsa.route_id, tsa.stop_id, tsa.direction, tsa.academic_year, tsa.start_date, tsa.end_date, tsa.status, tsa.notes, r.route_name, ts.name as stop_name')
            ->join('transport_routes r', 'r.id = tsa.route_id', 'left')
            ->join('transport_stops ts', 'ts.id = tsa.stop_id', 'left')
            ->where('tsa.tenant_id', $tenantId)
            ->where('tsa.student_id', $studentId)
            ->where('tsa.status', 'active')
            ->orderBy('tsa.start_date', 'DESC')
            ->orderBy('tsa.created_at', 'DESC')
            ->get(1)
            ->getRowArray();

        if (!$row) {
            return null;
        }

        return [
            'id' => $row['id'],
            'routeId' => $row['route_id'],
            'routeName' => $row['route_name'] ?? null,
            'stopId' => $row['stop_id'] ?? null,
            'stopName' => $row['stop_name'] ?? null,
            'direction' => $row['direction'] ?? 'both',
            'academicYear' => $row['academic_year'] ?? null,
            'startDate' => $row['start_date'] ?? null,
            'endDate' => $row['end_date'] ?? null,
            'status' => $row['status'] ?? 'active',
            'notes' => $row['notes'] ?? null,
        ];
    }

    private function countRows(string $table, string $tenantId, string $studentId, array $extra = []): int
    {
        if (!$this->db->tableExists($table)) {
            return 0;
        }

        $builder = $this->db->table($table)
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId);

        foreach ($extra as $field => $value) {
            if ($value === null) {
                $builder->where($field, null);
            } else {
                $builder->where($field, $value);
            }
        }

        return $builder->countAllResults();
    }

    private function normaliseHistoryFilters(array $filters): array
    {
        $out = [
            'fieldName' => null,
            'from' => null,
            'to' => null,
        ];

        if (!empty($filters['fieldName'])) {
            $fieldName = $this->normaliseFieldName((string) $filters['fieldName']);
            if (!$this->profileHistory->isMutableField($fieldName)) {
                throw new InvalidArgumentException('Invalid fieldName filter');
            }
            $out['fieldName'] = $fieldName;
        }
        foreach (['from', 'to'] as $key) {
            if (!empty($filters[$key])) {
                if (!$this->isValidDate((string) $filters[$key])) {
                    throw new InvalidArgumentException("{$key} must be a valid YYYY-MM-DD date");
                }
                $out[$key] = (string) $filters[$key];
            }
        }

        return $out;
    }

    private function normaliseTimelineFilters(array $filters): array
    {
        $out = [
            'from' => null,
            'to' => null,
            'academicYear' => null,
            'types' => self::EVENT_TYPES,
            'limit' => 100,
            'page' => 1,
        ];

        foreach (['from', 'to'] as $key) {
            if (!empty($filters[$key])) {
                if (!$this->isValidDate((string) $filters[$key])) {
                    throw new InvalidArgumentException("{$key} must be a valid YYYY-MM-DD date");
                }
                $out[$key] = (string) $filters[$key];
            }
        }
        if ($out['from'] && $out['to'] && $out['from'] > $out['to']) {
            throw new InvalidArgumentException('from must be before or equal to to');
        }
        if (!empty($filters['academicYear'])) {
            $out['academicYear'] = trim((string) $filters['academicYear']);
        }
        if (!empty($filters['types'])) {
            $types = is_array($filters['types']) ? $filters['types'] : explode(',', (string) $filters['types']);
            $types = array_values(array_filter(array_map('trim', $types)));
            foreach ($types as $type) {
                if (!in_array($type, self::EVENT_TYPES, true)) {
                    throw new InvalidArgumentException('Invalid timeline event type');
                }
            }
            $out['types'] = $types;
        }
        $out['limit'] = max(1, min(250, (int) ($filters['limit'] ?? 100)));
        $out['page'] = max(1, (int) ($filters['page'] ?? 1));

        return $out;
    }

    private function applyDateFilters($builder, string $field, array $filters)
    {
        if ($filters['from']) {
            $builder->where("{$field} >=", $filters['from']);
        }
        if ($filters['to']) {
            $builder->where("{$field} <=", $filters['to']);
        }
        return $builder;
    }

    private function getEnrollmentEvents(string $tenantId, string $studentId, array $filters): array
    {
        $builder = $this->db->table('enrollments e')
            ->select('e.*, c.name as class_name')
            ->join('classes c', 'c.id = e.class_id', 'left')
            ->where('e.tenant_id', $tenantId)
            ->where('e.student_id', $studentId);
        if ($filters['academicYear']) {
            $builder->where('e.academic_session', $filters['academicYear']);
        }
        $rows = $this->applyDateFilters($builder, 'e.enrollment_date', $filters)->get()->getResultArray();

        return array_map(static fn($row) => [
            'id' => 'enrollment:' . $row['id'],
            'eventType' => 'enrollment',
            'eventDate' => $row['enrollment_date'],
            'title' => 'Enrolled in ' . ($row['class_name'] ?? 'class'),
            'summary' => trim(($row['status'] ?? '') . ' enrollment for ' . ($row['academic_session'] ?? 'session')),
            'sourceType' => 'enrollment',
            'sourceId' => $row['id'],
            'metadata' => [
                'classId' => $row['class_id'],
                'className' => $row['class_name'] ?? null,
                'academicSession' => $row['academic_session'],
                'status' => $row['status'],
                'completionDate' => $row['completion_date'] ?? null,
                'remarks' => $row['remarks'] ?? null,
            ],
            'createdAt' => $row['created_at'] ?? $row['enrollment_date'],
        ], $rows);
    }

    private function getStatusEvents(string $tenantId, string $studentId, array $filters): array
    {
        if (!$this->db->tableExists('student_status_history')) {
            return [];
        }
        $builder = $this->db->table('student_status_history ssh')
            ->select('ssh.*, u.name as changed_by_name_raw')
            ->join('users u', 'u.id = ssh.changed_by_user_id', 'left')
            ->where('ssh.tenant_id', $tenantId)
            ->where('ssh.student_id', $studentId);
        $rows = $this->applyDateFilters($builder, 'ssh.effective_date', $filters)->get()->getResultArray();

        return array_map(static fn($row) => [
            'id' => 'status:' . $row['id'],
            'eventType' => 'status_change',
            'eventDate' => $row['effective_date'],
            'title' => 'Status changed to ' . $row['new_status'],
            'summary' => $row['reason'] ?? '',
            'sourceType' => 'student_status_history',
            'sourceId' => $row['id'],
            'metadata' => [
                'previousStatus' => $row['previous_status'],
                'newStatus' => $row['new_status'],
                'changedByName' => $row['changed_by_name_raw'] ?? 'System',
            ],
            'createdAt' => $row['created_at'],
        ], $rows);
    }

    private function getProfileEvents(string $tenantId, string $studentId, array $filters): array
    {
        $rows = $this->profileHistory->getByStudent($tenantId, $studentId, ['from' => $filters['from'], 'to' => $filters['to']]);
        return array_map(static fn($row) => [
            'id' => 'profile:' . $row['id'],
            'eventType' => 'profile_change',
            'eventDate' => $row['effective_date'],
            'title' => 'Profile changed: ' . $row['field_name'],
            'summary' => $row['reason'],
            'sourceType' => 'student_profile_history',
            'sourceId' => $row['id'],
            'metadata' => [
                'fieldName' => $row['field_name'],
                'previousValue' => $row['previous_value'],
                'newValue' => $row['new_value'],
                'changeType' => $row['change_type'],
                'changedByName' => $row['changed_by_name_raw'] ?? 'System',
            ],
            'createdAt' => $row['created_at'],
        ], $rows);
    }

    private function getTransportEvents(string $tenantId, string $studentId, array $filters): array
    {
        if (!$this->db->tableExists('transport_student_allocations')) {
            return [];
        }
        $builder = $this->db->table('transport_student_allocations tsa')
            ->select('tsa.*, r.route_name, ts.name as stop_name')
            ->join('transport_routes r', 'r.id = tsa.route_id', 'left')
            ->join('transport_stops ts', 'ts.id = tsa.stop_id', 'left')
            ->where('tsa.tenant_id', $tenantId)
            ->where('tsa.student_id', $studentId);
        if ($filters['academicYear']) {
            $builder->where('tsa.academic_year', $filters['academicYear']);
        }
        $rows = $this->applyDateFilters($builder, 'tsa.start_date', $filters)->get()->getResultArray();

        return array_map(static fn($row) => [
            'id' => 'transport:' . $row['id'],
            'eventType' => 'transport_assignment',
            'eventDate' => $row['start_date'] ?? ($row['created_at'] ?? date('Y-m-d')),
            'title' => 'Transport assignment: ' . ($row['route_name'] ?? 'Route'),
            'summary' => ucfirst($row['status'] ?? 'inactive') . ' transport assignment',
            'sourceType' => 'transport_student_allocations',
            'sourceId' => $row['id'],
            'metadata' => [
                'routeId' => $row['route_id'],
                'routeName' => $row['route_name'] ?? null,
                'stopId' => $row['stop_id'] ?? null,
                'stopName' => $row['stop_name'] ?? null,
                'direction' => $row['direction'] ?? null,
                'status' => $row['status'] ?? null,
                'endDate' => $row['end_date'] ?? null,
            ],
            'createdAt' => $row['created_at'] ?? null,
        ], $rows);
    }

    private function getChargeEvents(string $tenantId, string $studentId, array $filters): array
    {
        $builder = $this->db->table('charges')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('deleted_at', null)
            ->where('voided_at', null);
        $rows = $this->applyDateFilters($builder, 'date_generated', $filters)->get()->getResultArray();

        return array_map(static fn($row) => [
            'id' => 'charge:' . $row['id'],
            'eventType' => 'charge',
            'eventDate' => $row['date_generated'],
            'title' => 'Charge: ' . ($row['category'] ?? 'Fee'),
            'summary' => $row['description'] ?? '',
            'sourceType' => 'charges',
            'sourceId' => $row['id'],
            'metadata' => [
                'amount' => (float) ($row['amount'] ?? 0),
                'category' => $row['category'] ?? null,
                'chargeType' => $row['charge_type'] ?? null,
                'status' => $row['status'] ?? null,
                'dueDate' => $row['due_date'] ?? null,
            ],
            'createdAt' => $row['created_at'] ?? $row['date_generated'],
        ], $rows);
    }

    private function getPaymentEvents(string $tenantId, string $studentId, array $filters): array
    {
        $builder = $this->db->table('payments')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId);
        $rows = $this->applyDateFilters($builder, 'date', $filters)->get()->getResultArray();

        return array_map(static fn($row) => [
            'id' => 'payment:' . $row['id'],
            'eventType' => 'payment',
            'eventDate' => $row['date'],
            'title' => 'Payment: ' . ($row['category'] ?? 'Payment'),
            'summary' => $row['description'] ?? '',
            'sourceType' => 'payments',
            'sourceId' => $row['id'],
            'metadata' => [
                'amount' => (float) ($row['amount'] ?? 0),
                'method' => $row['method'] ?? null,
                'category' => $row['category'] ?? null,
                'receiptNumber' => $row['receipt_number'] ?? null,
            ],
            'createdAt' => $row['created_at'] ?? $row['date'],
        ], $rows);
    }

    private function getAdjustmentEvents(string $tenantId, string $studentId, array $filters): array
    {
        if (!$this->db->tableExists('ledger_adjustments')) {
            return [];
        }
        $builder = $this->db->table('ledger_adjustments')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId);
        $rows = $this->applyDateFilters($builder, 'effective_date', $filters)->get()->getResultArray();

        return array_map(static fn($row) => [
            'id' => 'ledger_adjustment:' . $row['id'],
            'eventType' => 'ledger_adjustment',
            'eventDate' => $row['effective_date'],
            'title' => ucfirst($row['adjustment_type'] ?? 'Ledger') . ' adjustment',
            'summary' => $row['reason'] ?? '',
            'sourceType' => 'ledger_adjustments',
            'sourceId' => $row['id'],
            'metadata' => [
                'amount' => (float) ($row['amount'] ?? 0),
                'adjustmentType' => $row['adjustment_type'] ?? null,
                'category' => $row['category'] ?? null,
                'status' => $row['status'] ?? null,
            ],
            'createdAt' => $row['created_at'] ?? $row['effective_date'],
        ], $rows);
    }

    private function isValidDate(string $date): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return false;
        }
        [$year, $month, $day] = array_map('intval', explode('-', $date));
        return checkdate($month, $day, $year);
    }
}
