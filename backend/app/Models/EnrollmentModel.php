<?php

namespace App\Models;

use CodeIgniter\Model;

class EnrollmentModel extends Model
{
    protected $table = 'enrollments';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $useSoftDeletes = false;
    protected $allowedFields = [
        'id', 'tenant_id', 'student_id', 'class_id', 'class_instance_id', 'academic_session',
        'status', 'enrollment_date', 'completion_date', 'remarks',
        'created_at', 'updated_at'
    ];
    protected $useTimestamps = true;
    protected $createdField = 'created_at';
    protected $updatedField = 'updated_at';

    // Status constants
    const STATUS_ACTIVE = 'ACTIVE';
    const STATUS_PROMOTED = 'PROMOTED';
    const STATUS_REPEATED = 'REPEATED';
    const STATUS_GRADUATED = 'GRADUATED';
    const STATUS_TRANSFERRED = 'TRANSFERRED';
    const STATUS_DROPPED_OUT = 'DROPPED_OUT';
    const STATUS_INACTIVE = 'INACTIVE';

    /**
     * Get enrollments by tenant
     */
    public function getByTenant(string $tenantId): array
    {
        return $this->select('enrollments.*, s.first_name, s.last_name, c.name as class_name')
            ->join('students s', 's.id = enrollments.student_id')
            ->join('classes c', 'c.id = enrollments.class_id')
            ->where('enrollments.tenant_id', $tenantId)
            ->findAll();
    }

    /**
     * Get enrollments by academic session
     */
    public function getBySession(string $tenantId, string $academicSession): array
    {
        return $this->select('enrollments.*, s.first_name, s.last_name, c.name as class_name')
            ->join('students s', 's.id = enrollments.student_id')
            ->join('classes c', 'c.id = enrollments.class_id')
            ->where('enrollments.tenant_id', $tenantId)
            ->where('enrollments.academic_session', $academicSession)
            ->findAll();
    }

    /**
     * Get current enrollment for a single student
     */
    public function getCurrentEnrollment(string $studentId): ?array
    {
        return $this->where('student_id', $studentId)
            ->where('status', self::STATUS_ACTIVE)
            ->orderBy('enrollment_date', 'DESC')
            ->first();
    }

    /**
     * Get current enrollments for multiple students in a single query
     */
    public function getBatchCurrentEnrollments(array $studentIds): array
    {
        if (empty($studentIds)) {
            return [];
        }

        $enrollments = $this->select('student_id, id, tenant_id, class_id, academic_session, status, enrollment_date, completion_date')
            ->whereIn('student_id', $studentIds)
            ->where('status', self::STATUS_ACTIVE)
            ->orderBy('enrollment_date', 'DESC')
            ->findAll();

        // Group by student_id, keeping only the most recent enrollment per student
        $result = [];
        foreach ($enrollments as $enrollment) {
            $studentId = $enrollment['student_id'];
            if (!isset($result[$studentId])) {
                $result[$studentId] = $enrollment;
            }
        }

        return $result;
    }

    /**
     * Get enrollment history for a student.
     *
     * Joins both classes (legacy) and class_instances (new) so callers receive
     * a stable class_name and an academic_year_resolved value derived from the
     * class_instance when present, falling back to academic_session otherwise.
     */
    public function getStudentHistory(string $studentId): array
    {
        return $this->select(
                'enrollments.*, c.name as class_name, ' .
                'COALESCE(ci.academic_year, enrollments.academic_session) as academic_year_resolved'
            )
            ->join('classes c', 'c.id = enrollments.class_id')
            ->join('class_instances ci', 'ci.id = enrollments.class_instance_id', 'left')
            ->where('enrollments.student_id', $studentId)
            ->orderBy('COALESCE(ci.academic_year, enrollments.academic_session)', 'ASC', false)
            ->findAll();
    }

    /**
     * Get all ACTIVE enrollments for a given class instance, with student names joined.
     */
    public function getActiveByInstanceId(string $classInstanceId): array
    {
        return $this->select('enrollments.*, s.first_name, s.last_name, s.status as student_status')
            ->join('students s', 's.id = enrollments.student_id')
            ->where('enrollments.class_instance_id', $classInstanceId)
            ->where('enrollments.status', self::STATUS_ACTIVE)
            ->orderBy('s.last_name', 'ASC')
            ->orderBy('s.first_name', 'ASC')
            ->findAll();
    }

    /**
     * Create a new enrollment record
     */
    public function enrollStudent(array $data): string
    {
        // Generate enrollment ID using simple method
        $enrollmentId = 'enroll_' . uniqid() . '_' . time();
        
        $this->insert([
            'id' => $enrollmentId,
            'tenant_id' => $data['tenant_id'],
            'student_id' => $data['student_id'],
            'class_id' => $data['class_id'],
            'class_instance_id' => $data['class_instance_id'] ?? null,
            'academic_session' => $data['academic_session'],
            'status' => $data['status'] ?? self::STATUS_ACTIVE,
            'enrollment_date' => $data['enrollment_date'] ?? date('Y-m-d'),
            'remarks' => $data['remarks'] ?? null,
        ]);

        return $enrollmentId;
    }

    /**
     * Repeat student in same class for new session
     */
    public function repeatStudent(string $studentId, string $classId, string $newSession, array $options = []): string
    {
        $db = \Config\Database::connect();
        $db->transStart();

        try {
            // Complete current enrollment
            $currentEnrollment = $this->getCurrentEnrollment($studentId);
            if ($currentEnrollment) {
                $this->update($currentEnrollment['id'], [
                    'status' => self::STATUS_REPEATED,
                    'completion_date' => date('Y-m-d'),
                    'remarks' => $options['remarks'] ?? 'Repeated class'
                ]);
            }

            // Create new enrollment
            $newEnrollmentId = $this->enrollStudent([
                'tenant_id' => $options['tenant_id'],
                'student_id' => $studentId,
                'class_id' => $classId,
                'academic_session' => $newSession,
                'status' => self::STATUS_ACTIVE,
                'enrollment_date' => $options['enrollment_date'] ?? date('Y-m-d'),
                'remarks' => $options['remarks'] ?? 'Repeating class'
            ]);

            $db->transComplete();
            return $newEnrollmentId;

        } catch (\Exception $e) {
            $db->transRollback();
            throw $e;
        }
    }

    /**
     * Graduate student
     */
    public function graduateStudent(string $studentId, string $classId = null, array $options = []): bool
    {
        $db = \Config\Database::connect();
        $db->transStart();

        try {
            // Complete current enrollment
            $currentEnrollment = $this->getCurrentEnrollment($studentId);
            if (!$currentEnrollment) {
                $db->transRollback();
                return false;
            }

            $this->update($currentEnrollment['id'], [
                'status' => self::STATUS_GRADUATED,
                'completion_date' => date('Y-m-d'),
                'remarks' => $options['remarks'] ?? 'Graduated'
            ]);

            // Mark student as graduated; the snapshot service will then
            // derive class_id/current_enrollment_id from enrollments.
            $studentModel = new \App\Models\StudentModel();
            $studentModel->update($studentId, ['status' => 'graduated']);
            (new \App\Services\StudentSnapshotService())->syncFromActiveEnrollment($studentId);

            $db->transComplete();
            return true;

        } catch (\Exception $e) {
            $db->transRollback();
            throw $e;
        }
    }

    /**
     * Transfer student
     */
    public function transferStudent(string $studentId, string $classId = null, array $options = []): bool
    {
        $db = \Config\Database::connect();
        $db->transStart();

        try {
            // Complete current enrollment
            $currentEnrollment = $this->getCurrentEnrollment($studentId);
            if ($currentEnrollment) {
                $this->update($currentEnrollment['id'], [
                    'status' => self::STATUS_TRANSFERRED,
                    'completion_date' => date('Y-m-d'),
                    'remarks' => $options['remarks'] ?? 'Transferred'
                ]);
            }

            $db->transComplete();
            return true;

        } catch (\Exception $e) {
            $db->transRollback();
            throw $e;
        }
    }

    /**
     * Drop out student
     */
    public function dropOutStudent(string $studentId, string $classId = null, array $options = []): bool
    {
        $db = \Config\Database::connect();
        $db->transStart();

        try {
            // Complete current enrollment
            $currentEnrollment = $this->getCurrentEnrollment($studentId);
            if ($currentEnrollment) {
                $this->update($currentEnrollment['id'], [
                    'status' => self::STATUS_DROPPED_OUT,
                    'completion_date' => date('Y-m-d'),
                    'remarks' => $options['remarks'] ?? 'Dropped out'
                ]);
            }

            $db->transComplete();
            return true;

        } catch (\Exception $e) {
            $db->transRollback();
            throw $e;
        }
    }

    /**
     * Get students eligible for migration
     */
    public function getStudentsForMigration(string $tenantId, string $currentSession): array
    {
        return $this->select('enrollments.*, s.first_name, s.last_name, c.name as class_name, c.level')
            ->join('students s', 's.id = enrollments.student_id')
            ->join('classes c', 'c.id = enrollments.class_id')
            ->where('enrollments.tenant_id', $tenantId)
            ->where('enrollments.academic_session', $currentSession)
            ->where('enrollments.status', self::STATUS_ACTIVE)
            ->where('s.status', 'active')
            ->findAll();
    }

    /**
     * Format enrollment for API response
     */
    public function formatForApi(array $enrollment): array
    {
        return [
            'id'              => $enrollment['id'],
            'tenantId'        => $enrollment['tenant_id'],
            'studentId'       => $enrollment['student_id'],
            'classId'         => $enrollment['class_id'],
            'classInstanceId' => $enrollment['class_instance_id'] ?? null,
            'className'       => $enrollment['class_name'] ?? 'N/A',
            'academicSession' => $enrollment['academic_session'],
            'academicYear'    => $enrollment['academic_year_resolved'] ?? $enrollment['academic_session'] ?? null,
            'status'          => $enrollment['status'],
            'enrollmentDate'  => $enrollment['enrollment_date'],
            'completionDate'  => $enrollment['completion_date'],
            'remarks'         => $enrollment['remarks'] ?? '',
            'studentName'     => trim(($enrollment['first_name'] ?? '') . ' ' . ($enrollment['last_name'] ?? ''))
        ];
    }

    /**
     * Promote student to next class
     */
    public function promoteStudent(string $studentId, string $newClassId, string $newSession, array $options = []): string
    {
        $db = \Config\Database::connect();
        $db->transStart();

        try {
            // Check for existing enrollment in the target class and session
            $existingEnrollment = $this->where('student_id', $studentId)
                                        ->where('class_id', $newClassId)
                                        ->where('academic_session', $newSession)
                                        ->first();
            
            if ($existingEnrollment) {
                throw new \Exception("Student already has an enrollment in this class for session {$newSession}");
            }
            
            // Check if student has already been promoted from the current session
            $currentEnrollment = $this->getCurrentEnrollment($studentId);
            if ($currentEnrollment && $currentEnrollment['status'] !== self::STATUS_ACTIVE) {
                throw new \Exception("Student has already been processed (status: {$currentEnrollment['status']})");
            }

            // Complete current enrollment
            if ($currentEnrollment) {
                $this->update($currentEnrollment['id'], [
                    'status' => self::STATUS_PROMOTED,
                    'completion_date' => date('Y-m-d'),
                    'remarks' => $options['remarks'] ?? 'Promoted to next class'
                ]);
            }

            // Create new enrollment
            $newEnrollmentId = $this->enrollStudent([
                'tenant_id' => $options['tenant_id'],
                'student_id' => $studentId,
                'class_id' => $newClassId,
                'academic_session' => $newSession,
                'status' => self::STATUS_ACTIVE,
                'enrollment_date' => $options['enrollment_date'] ?? date('Y-m-d'),
                'remarks' => $options['remarks'] ?? 'Promoted to next class'
            ]);

            // Snapshot is derived from the most-recent ACTIVE enrollment, so
            // any caller writing to enrollments only needs to call sync.
            (new \App\Services\StudentSnapshotService())->syncFromActiveEnrollment($studentId);

            $db->transComplete();
            return $newEnrollmentId;

        } catch (\Exception $e) {
            $db->transRollback();
            throw $e;
        }
    }

}
