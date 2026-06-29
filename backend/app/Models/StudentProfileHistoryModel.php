<?php

namespace App\Models;

use CodeIgniter\Model;

class StudentProfileHistoryModel extends Model
{
    public const CHANGE_TYPE_CORRECTION = 'correction';
    public const CHANGE_TYPE_HISTORICAL = 'historical_change';

    public const MUTABLE_FIELDS = [
        'email',
        'address',
        'guardian_name',
        'guardian_phone',
        'guardian_email',
        'guardian_relationship',
        'guardian2_name',
        'guardian2_phone',
        'guardian2_relationship',
        'photo_url',
        'bursary_status',
        'bursary_percentage',
        'bursary_reason',
    ];

    protected $table = 'student_profile_history';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $useSoftDeletes = false;
    protected $allowedFields = [
        'id', 'tenant_id', 'student_id', 'field_name', 'previous_value', 'new_value',
        'change_type', 'effective_date', 'reason', 'changed_by_user_id', 'created_at',
    ];
    protected $useTimestamps = false;

    public function isMutableField(string $fieldName): bool
    {
        return in_array($fieldName, self::MUTABLE_FIELDS, true);
    }

    public function isValidChangeType(string $changeType): bool
    {
        return in_array($changeType, [self::CHANGE_TYPE_CORRECTION, self::CHANGE_TYPE_HISTORICAL], true);
    }

    public function createHistoryRecord(array $data): string
    {
        $id = 'sph_' . time() . '_' . bin2hex(random_bytes(4));
        $data['id'] = $id;
        $data['created_at'] = $data['created_at'] ?? date('Y-m-d H:i:s');
        $this->insert($data);
        return $id;
    }

    public function getByStudent(string $tenantId, string $studentId, array $filters = []): array
    {
        $builder = $this->select('student_profile_history.*, u.name as changed_by_name_raw')
            ->join('users u', 'u.id = student_profile_history.changed_by_user_id', 'left')
            ->where('student_profile_history.tenant_id', $tenantId)
            ->where('student_profile_history.student_id', $studentId);

        if (!empty($filters['fieldName'])) {
            $builder->where('student_profile_history.field_name', $filters['fieldName']);
        }
        if (!empty($filters['from'])) {
            $builder->where('student_profile_history.effective_date >=', $filters['from']);
        }
        if (!empty($filters['to'])) {
            $builder->where('student_profile_history.effective_date <=', $filters['to']);
        }

        return $builder
            ->orderBy('student_profile_history.effective_date', 'DESC')
            ->orderBy('student_profile_history.created_at', 'DESC')
            ->findAll();
    }

    public function formatForApi(array $row): array
    {
        return [
            'id'              => $row['id'],
            'studentId'       => $row['student_id'],
            'fieldName'       => $row['field_name'],
            'previousValue'   => $row['previous_value'],
            'newValue'        => $row['new_value'],
            'changeType'      => $row['change_type'],
            'effectiveDate'   => $row['effective_date'],
            'reason'          => $row['reason'],
            'changedByUserId' => $row['changed_by_user_id'],
            'changedByName'   => $row['changed_by_name_raw'] ?? 'System',
            'createdAt'       => $row['created_at'],
        ];
    }
}
