<?php

namespace App\Controllers\Api;

use App\Services\SetupGuideService;
use InvalidArgumentException;

class SetupGuideController extends BaseApiController
{
    private SetupGuideService $service;

    public function __construct()
    {
        $this->service = new SetupGuideService();
    }

    public function index()
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        return $this->success($this->service->getGuide($this->getTenantId()));
    }

    public function updateStep(string $stepKey)
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        $body = $this->getRequestBody();
        if ($err = $this->requireFields($body, ['status'])) return $err;

        try {
            return $this->success(
                $this->service->updateStep($this->getTenantId(), $stepKey, (string) $body['status']),
                'Setup guide step updated.'
            );
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 422);
        }
    }

    public function dismiss()
    {
        if ($err = $this->requireRole('super_admin', 'admin')) return $err;

        return $this->success($this->service->dismiss($this->getTenantId()), 'Setup guide dismissed.');
    }
}
