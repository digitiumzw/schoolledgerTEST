<?php

namespace App\Models;

use CodeIgniter\Model;

class PlatformAudit extends Model
{
    protected $table      = 'platform_audit';
    protected $primaryKey = 'id';

    protected $allowedFields = [
        'actor_user_id', 'actor_name', 'actor_email',
        'action', 'target_type', 'target_id',
        'details', 'ip_address', 'user_agent',
        'created_at',
    ];

    protected $useTimestamps  = false;
    protected $dateFormat     = 'datetime';

    public static function log(
        string  $action,
        ?string $targetType  = null,
        mixed   $targetId    = null,
        mixed   $details     = null,
        ?int    $actorUserId = null,
        ?string $actorName   = null,
        ?string $actorEmail  = null,
        ?string $targetName  = null
    ): void {
        $model   = new self();
        $request = service('request');

        // Snapshot actor name/email if not provided and actor id available
        if (($actorName === null || $actorEmail === null) && $actorUserId !== null) {
            $userModel = new PlatformUser();
            $u = $userModel->find($actorUserId);
            if ($u) {
                $actorName  = $actorName  ?? $u['name'];
                $actorEmail = $actorEmail ?? $u['email'];
            }
        }

        // Merge target_name into details if provided
        if ($targetName !== null) {
            $details = is_array($details) ? array_merge($details, ['target_name' => $targetName]) : ['target_name' => $targetName, 'original_details' => $details];
        }

        $model->insert([
            'actor_user_id' => $actorUserId,
            'actor_name'    => $actorName,
            'actor_email'   => $actorEmail,
            'action'        => $action,
            'target_type'   => $targetType,
            'target_id'     => $targetId !== null ? (string) $targetId : null,
            'details'       => $details !== null ? json_encode($details) : null,
            'ip_address'    => $request->getIPAddress(),
            'user_agent'    => $request->getUserAgent()->getAgentString(),
            'created_at'    => date('Y-m-d H:i:s'),
        ]);
    }

    public function findByActor(int $userId, int $limit = 50): array
    {
        return $this->where('actor_user_id', $userId)
                    ->orderBy('created_at', 'DESC')
                    ->limit($limit)
                    ->findAll();
    }

    public function findByTarget(string $targetType, string $targetId, int $limit = 50): array
    {
        return $this->where('target_type', $targetType)
                    ->where('target_id', $targetId)
                    ->orderBy('created_at', 'DESC')
                    ->limit($limit)
                    ->findAll();
    }

    public function recent(int $limit = 20): array
    {
        return $this->orderBy('created_at', 'DESC')->limit($limit)->findAll();
    }

    public function filteredPaginated(array $filters, int $page = 1, int $perPage = 50): array
    {
        $b = $this->builder();
        $this->applyFilters($b, $filters);

        $total = (int) $b->countAllResults(false);

        $items = $b->orderBy('created_at', 'DESC')
                    ->limit($perPage, ($page - 1) * $perPage)
                    ->get()
                    ->getResultArray();

        return [
            'items'    => $items,
            'total'    => $total,
            'page'     => $page,
            'per_page' => $perPage,
        ];
    }

    public function filteredAll(array $filters): \CodeIgniter\Database\BaseBuilder
    {
        $b = $this->builder();
        $this->applyFilters($b, $filters);
        $b->orderBy('created_at', 'DESC');
        return $b;
    }

    public function purgeOldLogs(int $retentionDays = 365): int
    {
        $cutoff = date('Y-m-d H:i:s', strtotime("-{$retentionDays} days"));
        $this->where('created_at <', $cutoff)->delete();
        return $this->db->affectedRows();
    }

    private function applyFilters($b, array $filters): void
    {
        if (!empty($filters['from_date'])) {
            $b->where('created_at >=', trim((string) $filters['from_date']) . ' 00:00:00');
        }
        if (!empty($filters['to_date'])) {
            $b->where('created_at <=', trim((string) $filters['to_date']) . ' 23:59:59');
        }
        // Partial, case-insensitive matching so operators can type fragments.
        if (!empty($filters['actor_email'])) {
            $b->like('actor_email', trim((string) $filters['actor_email']));
        }
        if (!empty($filters['action'])) {
            $b->like('action', trim((string) $filters['action']));
        }
        if (!empty($filters['target_type'])) {
            $b->like('target_type', trim((string) $filters['target_type']));
        }

        // Free-text search spans actor identity, action, and target columns.
        if (!empty($filters['search'])) {
            $term = trim((string) $filters['search']);
            if ($term !== '') {
                $b->groupStart()
                    ->like('actor_name', $term)
                    ->orLike('actor_email', $term)
                    ->orLike('action', $term)
                    ->orLike('target_type', $term)
                    ->orLike('target_id', $term)
                    ->orLike('ip_address', $term)
                  ->groupEnd();
            }
        }
    }
}
