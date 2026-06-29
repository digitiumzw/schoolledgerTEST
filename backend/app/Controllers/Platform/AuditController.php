<?php

namespace App\Controllers\Platform;

use App\Models\PlatformAudit;

class AuditController extends BasePlatformController
{
    private PlatformAudit $auditModel;

    public function __construct()
    {
        $this->auditModel = new PlatformAudit();
    }

    public function index()
    {
        if (!$this->canViewAuditLog($this->getPlatformRole() ?? '')) {
            return $this->forbidden();
        }

        $filters = $this->extractFilters();
        $page    = max(1, (int) ($this->request->getGet('page') ?? 1));
        $perPage = min(200, max(1, (int) ($this->request->getGet('per_page') ?? 50)));

        $result = $this->auditModel->filteredPaginated($filters, $page, $perPage);
        return $this->success($result);
    }

    public function export()
    {
        if (!$this->canViewAuditLog($this->getPlatformRole() ?? '')) {
            return $this->forbidden();
        }

        $filters = array_merge($this->extractFilters(), $this->getRequestBody() ?: []);
        $builder = $this->auditModel->filteredAll($filters);

        $filename = 'audit-log-' . date('Y-m-d') . '.csv';

        $response = $this->response;
        $response->setHeader('Content-Type', 'text/csv; charset=UTF-8');
        $response->setHeader('Content-Disposition', 'attachment; filename="' . $filename . '"');

        $out  = fopen('php://temp', 'r+');
        fputcsv($out, ['id', 'actor_name', 'actor_email', 'action', 'target_type', 'target_id', 'ip_address', 'created_at']);

        $offset = 0;
        $batch  = 500;
        while (true) {
            $rows = (clone $builder)->limit($batch, $offset)->get()->getResultArray();
            if (empty($rows)) break;
            foreach ($rows as $r) {
                fputcsv($out, [
                    $r['id'],
                    $r['actor_name']  ?? '',
                    $r['actor_email'] ?? '',
                    $r['action'],
                    $r['target_type'] ?? '',
                    $r['target_id']   ?? '',
                    $r['ip_address']  ?? '',
                    $r['created_at']  ?? '',
                ]);
            }
            $offset += $batch;
            if (count($rows) < $batch) break;
        }

        rewind($out);
        $csv = stream_get_contents($out);
        fclose($out);

        return $response->setBody($csv);
    }

    private function extractFilters(): array
    {
        return [
            'from_date'   => $this->request->getGet('from_date'),
            'to_date'     => $this->request->getGet('to_date'),
            'actor_email' => $this->request->getGet('actor_email'),
            'action'      => $this->request->getGet('action'),
            'target_type' => $this->request->getGet('target_type'),
            'search'      => $this->request->getGet('search'),
        ];
    }
}
