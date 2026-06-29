<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * TransportStudentAllocationModel
 *
 * Represents time-bound assignments of students to a stop on a transport route.
 * Historical records are preserved via soft delete (status='inactive', end_date set).
 *
 * The DB enforces at most one active allocation per (tenant, student) via the
 * generated `is_active` column + unique index added in migration
 * `2026-04-30-120000_AddTransportConstraints`.
 */
class TransportStudentAllocationModel extends Model
{
    protected $table = 'transport_student_allocations';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $useSoftDeletes = false;

    protected $allowedFields = [
        'id', 'tenant_id', 'student_id', 'route_id', 'stop_id',
        'direction', 'academic_year', 'start_date', 'end_date',
        'status', 'notes', 'created_at', 'updated_at',
    ];

    protected $useTimestamps = true;
    protected $createdField = 'created_at';
    protected $updatedField = 'updated_at';

    /**
     * Find the active allocation for a given student, if any.
     * Returns null if the student has no active allocation.
     */
    public function getActiveForStudent(string $tenantId, string $studentId): ?array
    {
        $row = $this->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('status', 'active')
            ->first();
        return $row ?: null;
    }

    /**
     * Get full chronological history (newest first) for a given student.
     */
    public function getHistoryForStudent(string $tenantId, string $studentId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->orderBy('start_date', 'DESC')
            ->orderBy('created_at', 'DESC')
            ->findAll();
    }

    /**
     * Format an allocation row for API responses.
     */
    public function formatForApi(array $row): array
    {
        return [
            'id'           => $row['id'],
            'studentId'    => $row['student_id'],
            'routeId'      => $row['route_id'],
            'stopId'       => $row['stop_id'] ?? null,
            'direction'    => $row['direction'] ?? 'both',
            'academicYear' => $row['academic_year'] ?? null,
            'startDate'    => $row['start_date'] ?? null,
            'endDate'      => $row['end_date'] ?? null,
            'status'       => $row['status'] ?? 'active',
            'notes'        => $row['notes'] ?? null,
            'createdAt'    => $row['created_at'] ?? null,
            'updatedAt'    => $row['updated_at'] ?? null,
        ];
    }
}
