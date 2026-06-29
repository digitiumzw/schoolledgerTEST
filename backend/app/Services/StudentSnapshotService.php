<?php

namespace App\Services;

use App\Models\EnrollmentModel;
use App\Models\StudentModel;
use Config\Database;

/**
 * StudentSnapshotService
 *
 * The `students.class_id` and `students.current_enrollment_id` columns are
 * convenience snapshots — they MUST always reflect the student's most recent
 * ACTIVE enrollment row. This service is the single safe path to keep them
 * in sync. Any code path that creates, updates, or closes an enrollment
 * should call syncFromActiveEnrollment() afterwards.
 *
 * Drift between the snapshot and the underlying enrollment is the root cause
 * of "0 students promoted" symptoms during year-end migration; reconciliation
 * tooling is built on top of this service.
 */
class StudentSnapshotService
{
    private EnrollmentModel $enrollments;
    private StudentModel    $students;

    public function __construct(?EnrollmentModel $enrollments = null, ?StudentModel $students = null)
    {
        $this->enrollments = $enrollments ?? new EnrollmentModel();
        $this->students    = $students    ?? new StudentModel();
    }

    /**
     * Recompute and persist the snapshot for a single student.
     *
     * Returns a diff report describing whether anything changed and, if so,
     * what the previous and new values were. Does NOT throw on missing
     * student rows or missing enrollments — callers (e.g. the reconciliation
     * service) need to surface those cases as actionable errors.
     *
     * @return array{
     *   studentId: string,
     *   changed: bool,
     *   reason: string,
     *   previous: array{class_id: ?string, current_enrollment_id: ?string},
     *   current:  array{class_id: ?string, current_enrollment_id: ?string}
     * }
     */
    public function syncFromActiveEnrollment(string $studentId): array
    {
        $student = $this->students->find($studentId);
        if (!$student) {
            return [
                'studentId' => $studentId,
                'changed'   => false,
                'reason'    => 'student_not_found',
                'previous'  => ['class_id' => null, 'current_enrollment_id' => null],
                'current'   => ['class_id' => null, 'current_enrollment_id' => null],
            ];
        }

        $previous = [
            'class_id'              => $student['class_id']              ?? null,
            'current_enrollment_id' => $student['current_enrollment_id'] ?? null,
        ];

        // Graduated/transferred/dropped-out students should have no snapshot.
        $studentStatus = $student['status'] ?? 'active';
        if (in_array($studentStatus, ['graduated', 'transferred', 'dropped_out', 'inactive'], true)) {
            $target = ['class_id' => null, 'current_enrollment_id' => null];
            return $this->applyIfChanged($studentId, $previous, $target, 'student_inactive');
        }

        // Most recent ACTIVE enrollment is the source of truth.
        $activeEnrollment = $this->enrollments
            ->where('student_id', $studentId)
            ->where('status', EnrollmentModel::STATUS_ACTIVE)
            ->orderBy('enrollment_date', 'DESC')
            ->orderBy('created_at', 'DESC')
            ->first();

        if (!$activeEnrollment) {
            // No active enrollment → snapshot must be cleared. Caller should
            // treat this as "needs manual review" via the reconciliation
            // service when the student is still flagged active.
            $target = ['class_id' => null, 'current_enrollment_id' => null];
            return $this->applyIfChanged($studentId, $previous, $target, 'no_active_enrollment');
        }

        $target = [
            'class_id'              => $activeEnrollment['class_id'],
            'current_enrollment_id' => $activeEnrollment['id'],
        ];

        return $this->applyIfChanged($studentId, $previous, $target, 'synced_from_enrollment');
    }

    /**
     * Bulk variant — useful for reconciliation passes. Returns one diff
     * entry per student.
     *
     * @param string[] $studentIds
     * @return array<int, array>
     */
    public function syncMany(array $studentIds): array
    {
        $out = [];
        foreach ($studentIds as $id) {
            $out[] = $this->syncFromActiveEnrollment($id);
        }
        return $out;
    }

    /**
     * Cheap drift check used by UI / migration-preview. Returns the IDs of
     * tenant-active students whose snapshot disagrees with the underlying
     * enrollment data, without writing anything.
     *
     * @return string[]
     */
    public function findDriftedStudentIds(string $tenantId): array
    {
        $db = Database::connect();

        // Drift cases:
        //   (A) student.status='active' AND current_enrollment_id IS NULL
        //   (B) current_enrollment_id points at a non-ACTIVE enrollment
        //   (C) student.class_id <> active_enrollment.class_id
        $rows = $db->table('students s')
            ->select('s.id')
            ->join('enrollments e', 'e.id = s.current_enrollment_id', 'left')
            ->where('s.tenant_id', $tenantId)
            ->where('s.status', 'active')
            ->groupStart()
                ->where('s.current_enrollment_id IS NULL')
                ->orWhere('e.status !=', EnrollmentModel::STATUS_ACTIVE)
                ->orWhere('s.class_id != e.class_id', null, false)
            ->groupEnd()
            ->get()
            ->getResultArray();

        return array_map(fn($r) => (string) $r['id'], $rows);
    }

    // ──────────────────────────────────────────────────────────────────────

    private function applyIfChanged(string $studentId, array $previous, array $target, string $reason): array
    {
        $changed =
            ($previous['class_id']              !== $target['class_id']) ||
            ($previous['current_enrollment_id'] !== $target['current_enrollment_id']);

        if ($changed) {
            $this->students->update($studentId, $target);
        }

        return [
            'studentId' => $studentId,
            'changed'   => $changed,
            'reason'    => $reason,
            'previous'  => $previous,
            'current'   => $target,
        ];
    }
}
