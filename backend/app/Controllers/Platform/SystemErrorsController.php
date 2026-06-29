<?php

namespace App\Controllers\Platform;

use App\Models\SystemErrorLogModel;

class SystemErrorsController extends BasePlatformController
{
    private SystemErrorLogModel $errorLogModel;

    public function __construct()
    {
        $this->errorLogModel = new SystemErrorLogModel();
    }

    public function index()
    {
        if (!$this->canViewSystemErrors($this->getPlatformRole() ?? '')) {
            return $this->forbidden();
        }

        [$page, $limit, $offset] = $this->getPaginationParams(50, 200);
        $db = \Config\Database::connect();

        $builder = $db->table('system_error_logs sel')
            ->select('sel.id, sel.correlation_id, sel.tenant_id, sel.user_id,
                      sel.exception_class, sel.message, sel.request_uri,
                      sel.request_method, sel.ip_address, sel.created_at,
                      t.name AS tenant_name', false)
            ->join('tenants t', 't.id = sel.tenant_id', 'left');

        $search    = $this->request->getGet('search');
        $tenantId  = $this->request->getGet('tenant_id');
        $fromDate  = $this->request->getGet('from_date');
        $toDate    = $this->request->getGet('to_date');
        $exception = $this->request->getGet('exception_class');

        if ($search) {
            $builder->groupStart()
                ->like('sel.correlation_id', $search)
                ->orLike('sel.message', $search)
                ->orLike('sel.request_uri', $search)
                ->orLike('sel.ip_address', $search)
                ->groupEnd();
        }
        if ($tenantId) {
            $builder->where('sel.tenant_id', $tenantId);
        }
        if ($fromDate) {
            $builder->where('sel.created_at >=', $fromDate . ' 00:00:00');
        }
        if ($toDate) {
            $builder->where('sel.created_at <=', $toDate . ' 23:59:59');
        }
        if ($exception) {
            $builder->like('sel.exception_class', $exception);
        }

        $total = $builder->countAllResults(false);
        $rows  = $builder->orderBy('sel.created_at', 'DESC')->limit($limit, $offset)->get()->getResultArray();

        return $this->success($rows, 'OK', 200, $this->buildPaginationMeta($total, $page, $limit));
    }

    public function show($correlationId = null)
    {
        if (!$this->canViewSystemErrors($this->getPlatformRole() ?? '')) {
            return $this->forbidden();
        }

        $row = $this->errorLogModel->findByCorrelationId((string) $correlationId);
        if (!$row) {
            return $this->notFound('Error log not found.');
        }

        return $this->success($row);
    }
}
