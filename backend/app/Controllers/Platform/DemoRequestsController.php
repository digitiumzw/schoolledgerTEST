<?php

namespace App\Controllers\Platform;

use App\Models\DemoRequestModel;

/**
 * Platform-authenticated endpoints for managing landing-page demo requests.
 *
 * GET    /api/platform/demo-requests          -> index()
 * GET    /api/platform/demo-requests/:id      -> show()
 * PATCH  /api/platform/demo-requests/:id      -> update()
 * DELETE /api/platform/demo-requests/:id      -> destroy()
 */
class DemoRequestsController extends BasePlatformController
{
    public function __construct()
    {
        $this->demoModel = new DemoRequestModel();
    }

    public function index(): \CodeIgniter\HTTP\ResponseInterface
    {
        $params = [
            'status'  => $this->request->getGet('status'),
            'sortBy'  => $this->request->getGet('sortBy')  ?? 'created_at',
            'sortDir' => $this->request->getGet('sortDir') ?? 'desc',
            'page'    => $this->request->getGet('page')    ?? 1,
            'limit'   => $this->request->getGet('limit')   ?? 25,
        ];

        $result = $this->demoModel->getPaginated($params);

        $result['meta']['new_count'] = $this->demoModel->countByStatus('new');

        return $this->success($result);
    }

    public function show($id = null): \CodeIgniter\HTTP\ResponseInterface
    {
        $record = $this->demoModel->find($id);
        if (!$record) {
            return $this->notFound('Demo request not found.');
        }
        return $this->success($record);
    }

    public function update($id = null): \CodeIgniter\HTTP\ResponseInterface
    {
        $record = $this->demoModel->find($id);
        if (!$record) {
            return $this->notFound('Demo request not found.');
        }

        $body   = $this->getRequestBody();
        $update = [];

        if (array_key_exists('status', $body)) {
            $status = (string) $body['status'];
            if (!in_array($status, DemoRequestModel::VALID_STATUSES, true)) {
                return $this->error('Invalid status value.', 422, [
                    'status' => 'Must be one of: ' . implode(', ', DemoRequestModel::VALID_STATUSES),
                ]);
            }
            $update['status'] = $status;
        }

        if (array_key_exists('notes', $body)) {
            $notes = trim((string) $body['notes']);
            $update['notes'] = $notes === '' ? null : $notes;
        }

        if (empty($update)) {
            return $this->error('No updatable fields provided.', 422);
        }

        $this->demoModel->update($id, $update);

        return $this->success($this->demoModel->find($id), 'Demo request updated.');
    }

    public function destroy($id = null): \CodeIgniter\HTTP\ResponseInterface
    {
        $record = $this->demoModel->find($id);
        if (!$record) {
            return $this->notFound('Demo request not found.');
        }

        $this->demoModel->delete($id);

        return $this->success(null, 'Demo request deleted.');
    }
}
