<?php

namespace App\Controllers\Api;

use App\Models\TenantModel;

class TenantController extends BaseApiController
{
    protected TenantModel $tenantModel;

    public function __construct()
    {
        $this->tenantModel = new TenantModel();
    }

    public function index()
    {
        $tenants = $this->tenantModel->findAll();
        $formatted = array_map(fn($t) => $this->tenantModel->formatForApi($t), $tenants);
        return $this->success($formatted);
    }

    public function show($id = null)
    {
        $tenant = $this->tenantModel->find($id);
        if (!$tenant) {
            return $this->notFound('Tenant not found');
        }
        return $this->success($this->tenantModel->formatForApi($tenant));
    }

    public function current()
    {
        $tenantId = $this->getTenantId();
        $tenant = $this->tenantModel->find($tenantId);
        if (!$tenant) {
            return $this->notFound('Tenant not found');
        }
        return $this->success($this->tenantModel->formatForApi($tenant));
    }
}
