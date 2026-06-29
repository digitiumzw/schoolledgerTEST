<?php

namespace App\Models;

use CodeIgniter\Model;

class DemoRequestModel extends Model
{
    protected $table         = 'demo_requests';
    protected $primaryKey    = 'id';
    protected $useAutoIncrement = false;
    protected $returnType    = 'array';
    protected $useSoftDeletes = false;
    protected $useTimestamps = true;
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    protected $allowedFields = [
        'id',
        'school_name',
        'email',
        'school_address',
        'estimated_students',
        'status',
        'notes',
    ];

    public const VALID_STATUSES = ['new', 'contacted', 'converted', 'dismissed'];

    public function getPaginated(array $params = []): array
    {
        $status  = $params['status']  ?? null;
        $sortBy  = $params['sortBy']  ?? 'created_at';
        $sortDir = strtolower($params['sortDir'] ?? 'desc') === 'asc' ? 'ASC' : 'DESC';
        $page    = max(1, (int) ($params['page']  ?? 1));
        $limit   = min(100, max(1, (int) ($params['limit'] ?? 25)));
        $offset  = ($page - 1) * $limit;

        $allowedSorts = ['created_at', 'school_name', 'estimated_students', 'status'];
        if (!in_array($sortBy, $allowedSorts, true)) {
            $sortBy = 'created_at';
        }

        $builder = $this->builder();

        if ($status && in_array($status, self::VALID_STATUSES, true)) {
            $builder->where('status', $status);
        }

        $total = (clone $builder)->countAllResults(false);

        $rows = $builder
            ->orderBy($sortBy, $sortDir)
            ->limit($limit, $offset)
            ->get()
            ->getResultArray();

        return [
            'data' => $rows,
            'meta' => [
                'total'    => $total,
                'page'     => $page,
                'limit'    => $limit,
                'pages'    => (int) ceil($total / $limit),
            ],
        ];
    }

    public function countByStatus(string $status): int
    {
        return (int) $this->where('status', $status)->countAllResults();
    }

    private function generateId(): string
    {
        $data    = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    public function createRequest(array $data): array
    {
        $id = $this->generateId();
        $this->insert(array_merge($data, ['id' => $id]));
        return $this->find($id);
    }
}
