<?php

namespace App\Models;

use CodeIgniter\Model;

class StaffModel extends Model
{
    protected $table = 'staff';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $allowedFields = [
        'id', 'tenant_id', 'first_name', 'last_name', 'email', 'phone', 'address',
        'position', 'department', 'is_teaching', 'hire_date', 'date_of_birth',
        'employment_status', 'employee_id', 'next_of_kin_name', 'next_of_kin_relationship',
        'next_of_kin_phone', 'next_of_kin_email', 'next_of_kin_address',
        'created_at', 'updated_at'
    ];
    protected $useTimestamps = true;
    protected $beforeInsert = ['generateEmployeeId'];

    public function getByTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)->findAll();
    }

    public function getFiltered(string $tenantId, array $params): array
    {
        $search           = trim((string) ($params['search'] ?? ''));
        $department       = trim((string) ($params['department'] ?? ''));
        $isTeaching       = $params['isTeaching'] ?? '';
        $employmentStatus = trim((string) ($params['employmentStatus'] ?? ''));
        $sortBy           = $params['sortBy'] ?? 'name';
        $sortOrder        = strtolower((string) ($params['sortOrder'] ?? 'asc')) === 'desc' ? 'DESC' : 'ASC';
        $page             = max(1, (int) ($params['page'] ?? 1));
        $limit            = min(100, max(1, (int) ($params['limit'] ?? 20)));
        $offset           = ($page - 1) * $limit;

        $sortColumnMap = [
            'name'             => 'first_name',
            'department'       => 'department',
            'employmentStatus' => 'employment_status',
            'hireDate'         => 'hire_date',
            'createdAt'        => 'created_at',
        ];
        $orderColumn = $sortColumnMap[$sortBy] ?? 'first_name';

        $builder = $this->db->table('staff')
            ->where('tenant_id', $tenantId);

        if ($search !== '') {
            $builder->groupStart()
                ->like("CONCAT(first_name, ' ', last_name)", $search)
                ->orLike('email', $search)
                ->groupEnd();
        }

        if ($department !== '' && $department !== 'all') {
            $builder->where('department', $department);
        }

        if ($isTeaching === 'yes') {
            $builder->where('is_teaching', 1);
        } elseif ($isTeaching === 'no') {
            $builder->where('is_teaching', 0);
        }

        if ($employmentStatus !== '' && $employmentStatus !== 'all') {
            $builder->where('employment_status', $employmentStatus);
        }

        $total = (int) $builder->countAllResults(false);

        $rows = $builder
            ->orderBy($orderColumn, $sortOrder)
            ->limit($limit, $offset)
            ->get()
            ->getResultArray();

        $data = array_map(fn($s) => $this->formatForApi($s), $rows);

        $summaryBuilder = $this->db->table('staff')->where('tenant_id', $tenantId);
        $summaryRow = $summaryBuilder
            ->select("
                COUNT(*) AS total_count,
                SUM(CASE WHEN employment_status = 'active' THEN 1 ELSE 0 END) AS active_count,
                SUM(CASE WHEN is_teaching = 1 THEN 1 ELSE 0 END) AS teaching_count
            ", false)
            ->get()
            ->getRowArray();

        $deptRows = $this->db->table('staff')
            ->select('department, COUNT(*) AS cnt', false)
            ->where('tenant_id', $tenantId)
            ->groupBy('department')
            ->get()
            ->getResultArray();

        $departmentBreakdown = [];
        foreach ($deptRows as $row) {
            $departmentBreakdown[$row['department']] = (int) $row['cnt'];
        }

        return [
            'data' => $data,
            'pagination' => [
                'page'       => $page,
                'limit'      => $limit,
                'total'      => $total,
                'totalPages' => $limit > 0 ? (int) ceil($total / $limit) : 0,
            ],
            'summary' => [
                'totalCount'          => (int) ($summaryRow['total_count'] ?? 0),
                'activeCount'         => (int) ($summaryRow['active_count'] ?? 0),
                'teachingCount'       => (int) ($summaryRow['teaching_count'] ?? 0),
                'departmentBreakdown' => $departmentBreakdown,
            ],
        ];
    }

    public function getTeachers(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('is_teaching', true)
            ->findAll();
    }

    public function getByEmploymentStatus(string $tenantId, string $employmentStatus): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('employment_status', $employmentStatus)
            ->findAll();
    }

    public function getActiveStaff(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('employment_status', 'active')
            ->findAll();
    }

    /**
     * Auto-generate a tenant-scoped Employee ID before insert.
     * Format: EMP followed by a 4-digit zero-padded sequential number (EMP0001, EMP0042...).
     * On unique constraint violation the caller (StaffController) may retry; the DB
     * unique index is the final safety net for race conditions.
     */
    public function generateEmployeeId(array $data): array
    {
        $tenantId = $data['data']['tenant_id'] ?? null;
        if (!$tenantId) {
            return $data;
        }

        $result = $this->db->query(
            "SELECT MAX(CAST(SUBSTRING(employee_id, 4) AS UNSIGNED)) AS max_num
               FROM staff
              WHERE tenant_id = ?
                AND employee_id REGEXP '^EMP[0-9]+$'",
            [$tenantId]
        )->getRowArray();

        $nextNum = ((int) ($result['max_num'] ?? 0)) + 1;
        $data['data']['employee_id'] = 'EMP' . str_pad($nextNum, 4, '0', STR_PAD_LEFT);

        return $data;
    }

    public function formatForApi(array $staff): array
    {
        return [
            'id' => $staff['id'],
            'tenantId' => $staff['tenant_id'],
            'firstName' => $staff['first_name'],
            'lastName' => $staff['last_name'],
            'name' => $staff['first_name'] . ' ' . $staff['last_name'],
            'email' => $staff['email'],
            'phone' => $staff['phone'],
            'dateOfBirth' => $staff['date_of_birth'] ?? null,
            'address' => $staff['address'] ?? null,
            'position' => $staff['position'],
            'department' => $staff['department'],
            'isTeaching' => (bool) $staff['is_teaching'],
            'hireDate' => $staff['hire_date'],
            'employeeId' => $staff['employee_id'] ?? null,
            'status' => $staff['employment_status'] ?? 'active',
            'employmentStatus' => $staff['employment_status'] ?? 'active',
            'nextOfKin' => !empty($staff['next_of_kin_name']) ? [
                'name' => $staff['next_of_kin_name'],
                'relationship' => $staff['next_of_kin_relationship'],
                'phone' => $staff['next_of_kin_phone'],
                'email' => $staff['next_of_kin_email'] ?? null,
                'address' => $staff['next_of_kin_address'],
            ] : null,
        ];
    }

    public function formatFromApi(array $data, string $tenantId): array
    {
        return [
            'tenant_id' => $tenantId,
            'first_name' => $data['firstName'] ?? '',
            'last_name' => $data['lastName'] ?? '',
            'email' => $data['email'] ?? '',
            'phone' => $data['phone'] ?? '',
            'date_of_birth' => $data['dateOfBirth'] ?? null,
            'address' => $data['address'] ?? null,
            'position' => $data['position'] ?? '',
            'department' => $data['department'] ?? '',
            'is_teaching' => $data['isTeaching'] ?? false,
            'hire_date' => $data['hireDate'] ?? date('Y-m-d'),
            'employment_status' => $data['employmentStatus'] ?? 'active',
            'next_of_kin_name' => $data['nextOfKin']['name'] ?? null,
            'next_of_kin_relationship' => $data['nextOfKin']['relationship'] ?? null,
            'next_of_kin_phone' => $data['nextOfKin']['phone'] ?? null,
            'next_of_kin_email' => $data['nextOfKin']['email'] ?? null,
            'next_of_kin_address' => $data['nextOfKin']['address'] ?? null,
        ];
    }
}
