<?php

namespace App\Controllers\Api;

use App\Services\TenantDeletionService;
use InvalidArgumentException;
use RuntimeException;

class TenantDeletionController extends BaseApiController
{
    private TenantDeletionService $service;

    public function __construct()
    {
        $this->service = new TenantDeletionService();
    }

    /**
     * Get tenant deletion status
     * GET /api/tenant/deletion-status
     */
    public function getStatus()
    {
        if ($err = $this->requireRole('super_admin')) return $err;

        try {
            $status = $this->service->getDeletionStatus($this->getTenantId());
            return $this->success($status);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 404);
        }
    }

    /**
     * Request account deletion
     * POST /api/tenant/deletion-request
     */
    public function requestDeletion()
    {
        if ($err = $this->requireRole('super_admin')) return $err;

        $body = $this->getRequestBody();

        try {
            $result = $this->service->requestDeletion(
                $this->getTenantId(),
                $this->getUserEmail(),
                $body['confirmDelete'] ?? false
            );

            return $this->success($result, 'Account deletion requested successfully');
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 400);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 409);
        }
    }

    /**
     * Undo account deletion request
     * POST /api/tenant/undo-deletion
     */
    public function undoDeletion()
    {
        if ($err = $this->requireRole('super_admin')) return $err;

        $body = $this->getRequestBody();

        try {
            $result = $this->service->undoDeletion(
                $this->getTenantId(),
                $body['confirmUndo'] ?? false
            );

            return $this->success($result, 'Account deletion canceled successfully');
        } catch (InvalidArgumentException $e) {
            return $this->error($e->getMessage(), 400);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 400);
        }
    }

    /**
     * Get current user email from JWT
     */
    private function getUserEmail(): string
    {
        $user = $this->getCurrentUser();
        return $user?->email ?? '';
    }
}
