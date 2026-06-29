<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;

class LedgerController extends BaseApiController
{
    protected $db;

    public function initController(\CodeIgniter\HTTP\RequestInterface $request, \CodeIgniter\HTTP\ResponseInterface $response, \Psr\Log\LoggerInterface $logger)
    {
        parent::initController($request, $response, $logger);
        $this->db = Config::connect();
    }

    public function getCharges()
    {
        $tenantId  = $this->getTenantId();
        $studentId = $this->request->getGet('studentId');
        $termId    = $this->request->getGet('termId');

        $builder = $this->db->table('charges')
            ->where('tenant_id', $tenantId)
            ->where('deleted_at', null);

        if ($studentId) $builder->where('student_id', $studentId);
        if ($termId)    $builder->where('term_id', $termId);

        $charges = $builder->orderBy('date_generated', 'DESC')->get()->getResultArray();

        return $this->success(array_map(fn($c) => $this->formatCharge($c), $charges));
    }

    public function getStudentCharges($studentId = null)
    {
        $tenantId = $this->getTenantId();
        $charges  = $this->db->table('charges')
            ->where('tenant_id', $tenantId)
            ->where('student_id', $studentId)
            ->where('deleted_at', null)
            ->orderBy('date_generated', 'DESC')
            ->get()->getResultArray();

        return $this->success(array_map(fn($c) => $this->formatCharge($c), $charges));
    }

    public function getStudentBalance($studentId = null)
    {
        $tenantId = $this->getTenantId();
        $data = (new \App\Services\LedgerService($this->db))->getStudentBalance($studentId, $tenantId);
        return $this->success($data);
    }

    public function getAllBalances()
    {
        $tenantId = $this->getTenantId();
        $balances = (new \App\Services\LedgerService($this->db))->getAllBalances($tenantId);
        return $this->success($balances);
    }

    /**
     * Normalise a charges row into a consistent API shape.
     */
    private function formatCharge(array $c): array
    {
        return [
            'id'                => $c['id'],
            'studentId'         => $c['student_id'],
            'termId'            => $c['term_id'] ?? null,
            'billingRunId'      => $c['billing_run_id'] ?? null,
            'generationBatchId' => $c['generation_batch_id'] ?? null,
            'category'          => $c['category'],
            'chargeType'        => $c['charge_type'] ?? 'other',
            'status'            => $c['status'] ?? 'pending',
            'amount'            => (float) $c['amount'],
            'dateGenerated'     => $c['date_generated'],
            'dueDate'           => $c['due_date'] ?? null,
            'academicSession'   => $c['academic_session'] ?? null,
            'academicYear'      => $c['academic_year'] ?? null,
            'term'              => $c['term'] ?? null,
            'description'       => $c['description'],
            'routeId'           => $c['route_id'] ?? null,
            'isOpeningBalance'  => (bool) ($c['is_opening_balance'] ?? false),
            'createdBy'         => $c['created_by'] ?? null,
        ];
    }
}
