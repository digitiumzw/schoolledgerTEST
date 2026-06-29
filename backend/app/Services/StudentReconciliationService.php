<?php

namespace App\Services;

use App\Models\EnrollmentModel;
use App\Models\StudentModel;
use Config\Database;

/**
 * StudentReconciliationService
 *
 * Repairs drift between students.class_id / students.current_enrollment_id
 * and the underlying enrollments table. Wraps StudentSnapshotService and
 * adds a tenant-wide pass plus a structured summary suitable for surfacing
 * in admin UI before running year-end migration.
 *
 * Three drift buckets are recognised:
 *   - SYNCED:                 snapshot already matches active enrollment
 *   - REPAIRED:               snapshot was rewritten from active enrollment
 *   - NEEDS_MANUAL_REVIEW:    student is active but has no active enrollment
 *                             — system cannot infer where they belong
 */
class StudentReconciliationService
{
    public const OUTCOME_SYNCED              = 'synced';
    public const OUTCOME_REPAIRED            = 'repaired';
    public const OUTCOME_NEEDS_MANUAL_REVIEW = 'needs_manual_review';

    private StudentSnapshotService $snapshot;
    private StudentModel           $students;

    public function __construct(?StudentSnapshotService $snapshot = null, ?StudentModel $students = null)
    {
        $this->snapshot = $snapshot ?? new StudentSnapshotService();
        $this->students = $students ?? new StudentModel();
    }

    /**
     * Run reconciliation for every active student in the tenant.
     *
     * @param bool $dryRun If true, do not persist repairs — only report.
     * @return array {
     *   total: int,
     *   synced: int,
     *   repaired: int,
     *   needsManualReview: int,
     *   manualReviewStudents: array<int, array{id:string, name:string, classId:?string, reason:string}>,
     *   repairs: array<int, array>,
     *   dryRun: bool
     * }
     */
    public function reconcileTenant(string $tenantId, bool $dryRun = false): array
    {
        $db   = Database::connect();
        $rows = $db->table('students')
            ->select('id, first_name, last_name, class_id, current_enrollment_id, status')
            ->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->get()
            ->getResultArray();

        $summary = [
            'total'                => count($rows),
            'synced'               => 0,
            'repaired'             => 0,
            'needsManualReview'    => 0,
            'manualReviewStudents' => [],
            'repairs'              => [],
            'dryRun'               => $dryRun,
        ];

        foreach ($rows as $student) {
            $studentId = (string) $student['id'];

            $diff = $dryRun
                ? $this->previewSync($studentId, $student)
                : $this->snapshot->syncFromActiveEnrollment($studentId);

            $needsManual = ($diff['reason'] === 'no_active_enrollment');

            if ($needsManual) {
                $summary['needsManualReview']++;
                $summary['manualReviewStudents'][] = [
                    'id'      => $studentId,
                    'name'    => trim(($student['first_name'] ?? '') . ' ' . ($student['last_name'] ?? '')),
                    'classId' => $student['class_id'] ?? null,
                    'reason'  => 'Student is marked active but has no ACTIVE enrollment row.',
                ];
                continue;
            }

            if ($diff['changed']) {
                $summary['repaired']++;
                $summary['repairs'][] = $diff;
            } else {
                $summary['synced']++;
            }
        }

        return $summary;
    }

    /**
     * Cheap drift count for dashboards / migration-preview banners.
     */
    public function getDriftCount(string $tenantId): int
    {
        return count($this->snapshot->findDriftedStudentIds($tenantId));
    }

    /**
     * Repair a single student. Returns the diff entry from the snapshot service.
     */
    public function reconcileStudent(string $studentId): array
    {
        return $this->snapshot->syncFromActiveEnrollment($studentId);
    }

    // ──────────────────────────────────────────────────────────────────────

    /**
     * Compute what would change without writing. Mirrors the logic in
     * StudentSnapshotService::syncFromActiveEnrollment().
     */
    private function previewSync(string $studentId, array $student): array
    {
        $previous = [
            'class_id'              => $student['class_id']              ?? null,
            'current_enrollment_id' => $student['current_enrollment_id'] ?? null,
        ];

        // Graduated/transferred/dropped-out/inactive students should have no
        // snapshot — mirrors StudentSnapshotService::syncFromActiveEnrollment().
        $studentStatus = $student['status'] ?? 'active';
        if (in_array($studentStatus, ['graduated', 'transferred', 'dropped_out', 'inactive'], true)) {
            return [
                'studentId' => $studentId,
                'changed'   => $previous['class_id'] !== null || $previous['current_enrollment_id'] !== null,
                'reason'    => 'student_inactive',
                'previous'  => $previous,
                'current'   => ['class_id' => null, 'current_enrollment_id' => null],
            ];
        }

        $enrollments = new EnrollmentModel();
        $active      = $enrollments
            ->where('student_id', $studentId)
            ->where('status', EnrollmentModel::STATUS_ACTIVE)
            ->orderBy('enrollment_date', 'DESC')
            ->orderBy('created_at', 'DESC')
            ->first();

        if (!$active) {
            return [
                'studentId' => $studentId,
                'changed'   => false,
                'reason'    => 'no_active_enrollment',
                'previous'  => $previous,
                'current'   => ['class_id' => null, 'current_enrollment_id' => null],
            ];
        }

        $target = [
            'class_id'              => $active['class_id'],
            'current_enrollment_id' => $active['id'],
        ];

        return [
            'studentId' => $studentId,
            'changed'   => $previous !== $target,
            'reason'    => 'synced_from_enrollment',
            'previous'  => $previous,
            'current'   => $target,
        ];
    }
}
