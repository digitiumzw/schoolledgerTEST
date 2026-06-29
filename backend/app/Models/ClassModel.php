<?php

namespace App\Models;

use CodeIgniter\Model;

class ClassModel extends Model
{
    protected $table = 'classes';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $allowedFields = [
        'id', 'tenant_id', 'name', 'teacher_id', 'next_class_id', 'is_final_class', 'capacity', 'created_at', 'updated_at', 'archived_at'
    ];
    protected $useTimestamps = true;

    public function getByTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)->findAll();
    }

    public function formatForApi(array $class): array
    {
        return [
            'id'           => $class['id'],
            'tenantId'     => $class['tenant_id'],
            'name'         => $class['name'],
            'teacherId'    => $class['teacher_id'],
            'nextClassId'  => $class['next_class_id'],
            'isFinalClass' => (bool) ($class['is_final_class'] ?? false),
            'capacity'     => (isset($class['capacity']) && (int) $class['capacity'] > 0) ? (int) $class['capacity'] : null,
            'nextClass'    => $class['nextClass'] ?? null,
            'studentCount' => $class['studentCount'] ?? 0,
            'teacherName'  => $class['teacherName'] ?? $class['teacher_name'] ?? null,
            'archivedAt'   => $class['archived_at'] ?? null,
        ];
    }

    public function formatFromApi(array $data, string $tenantId): array
    {
        return [
            'tenant_id'      => $tenantId,
            'name'           => $data['name'] ?? '',
            'teacher_id'     => $data['teacherId'] ?? null,
            'next_class_id'  => $data['nextClassId'] ?? null,
            'is_final_class' => isset($data['isFinalClass']) ? (int)(bool)$data['isFinalClass'] : 0,
            'capacity'       => array_key_exists('capacity', $data) ? ($data['capacity'] !== null ? (int) $data['capacity'] : null) : null,
        ];
    }

    /**
     * Get all classes for a tenant, sorted by name
     */
    public function getByTenantSortedByName(string $tenantId, bool $includeArchived = false): array
    {
        $builder = $this->where('tenant_id', $tenantId);
        
        if (!$includeArchived) {
            $builder->where('archived_at IS NULL');
        }
        
        return $builder->orderBy('name', 'ASC')->findAll();
    }

    /**
     * Get next class for promotion using next_class_id field
     */
    public function getNextClass(string $classId): ?array
    {
        $class = $this->find($classId);
        if (!$class || empty($class['next_class_id'])) {
            return null;
        }

        return $this->find($class['next_class_id']);
    }

    /**
     * Set next class for promotion
     */
    public function setNextClass(string $classId, ?string $nextClassId): bool
    {
        return $this->update($classId, ['next_class_id' => $nextClassId]);
    }

    /**
     * Check if class is an intentional final/graduation class.
     *
     * Uses the explicit is_final_class flag rather than checking next_class_id,
     * so that unconfigured classes (next_class_id = NULL, is_final_class = 0)
     * are NOT treated as graduation classes.
     */
    public function isFinalClass(string $classId): bool
    {
        $class = $this->find($classId);
        if (!$class) {
            return false;
        }

        return (bool) ($class['is_final_class'] ?? false);
    }

    /**
     * Get all final classes (graduation classes)
     */
    public function getFinalClasses(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('is_final_class', 1)
            ->findAll();
    }

    /**
     * Get students eligible for promotion from a specific class.
     * Returns all currently active students (status='active', not 'repeating')
     * who have an active enrollment in the class.
     *
     * @param string      $classId         The class to query.
     * @param string|null $academicSession When provided, only students whose
     *                                     current enrollment belongs to this
     *                                     session (format: YYYY/YYYY+1) are
     *                                     returned. Pass null to skip the
     *                                     session filter (legacy behaviour).
     */
    public function getStudentsForPromotion(string $classId, ?string $academicSession = null): array
    {
        $query = $this->db->table('students')
            ->select('students.*')
            ->join('enrollments', 'students.current_enrollment_id = enrollments.id')
            ->where('students.class_id', $classId)
            ->where('students.status', 'active')
            ->where('enrollments.status', \App\Models\EnrollmentModel::STATUS_ACTIVE);

        if ($academicSession !== null) {
            $query->where('enrollments.academic_session', $academicSession);
        }

        return $query->get()->getResultArray();
    }

    /**
     * Count students in a class who have status='repeating' (they will stay back).
     */
    public function getRepeatingStudentCount(string $classId): int
    {
        return (int) $this->db->table('students')
            ->where('class_id', $classId)
            ->where('status', 'repeating')
            ->countAllResults();
    }

    /**
     * Get all classes assigned to a specific teacher
     */
    public function getByTeacher(string $teacherId, string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('teacher_id', $teacherId)
            ->where('archived_at IS NULL')
            ->orderBy('name', 'ASC')
            ->findAll();
    }
}
