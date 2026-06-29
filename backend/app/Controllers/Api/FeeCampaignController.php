<?php

namespace App\Controllers\Api;

use App\Models\FeeCampaignModel;
use App\Models\CampaignStudentModel;
use App\Services\FeeCampaignService;
use CodeIgniter\Database\Config;

class FeeCampaignController extends BaseApiController
{
    private FeeCampaignModel $campaignModel;
    private CampaignStudentModel $campaignStudentModel;
    private FeeCampaignService $service;

    public function __construct()
    {
        $this->db                   = Config::connect();
        $this->campaignModel        = new FeeCampaignModel();
        $this->campaignStudentModel = new CampaignStudentModel();
        $this->service              = new FeeCampaignService($this->db);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Campaign CRUD
    // ──────────────────────────────────────────────────────────────────────────

    public function index()
    {
        $tenantId = $this->getTenantId();

        $pagination = $this->normalisePaginationParams(50, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $allowedSortFields = ['name', 'status', 'dueDate', 'createdAt'];
        $sort = $this->normaliseSortParams($allowedSortFields, 'createdAt', 'desc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $sortColumnMap = [
            'name'      => 'name',
            'status'    => 'status',
            'dueDate'   => 'due_date',
            'createdAt' => 'created_at',
        ];

        $status = $this->sanitiseString($this->request->getGet('status'));
        $search = $this->sanitiseString($this->request->getGet('search'));

        $builder = $this->db->table('fee_campaigns')
            ->where('tenant_id', $tenantId);

        if ($status !== '' && $status !== null) {
            $builder->where('status', $status);
        }

        if ($search !== '') {
            $builder->groupStart()
                ->like('name', $search, 'both', true)
                ->orLike('description', $search, 'both', true)
                ->groupEnd();
        }

        $total = (int) $builder->countAllResults(false);

        $orderColumn = $sortColumnMap[$sort['sortBy']] ?? 'created_at';
        $campaigns = $builder
            ->orderBy($orderColumn, strtoupper($sort['sortOrder']))
            ->limit($pagination['limit'], $pagination['offset'])
            ->get()
            ->getResultArray();

        $ids = array_column($campaigns, 'id');
        $summaries = $this->campaignModel->getSummariesByCampaignIds($ids, $tenantId);

        $data = [];
        foreach ($campaigns as $c) {
            $formatted = $this->campaignModel->formatForApi($c);
            $formatted['summary'] = $summaries[$c['id']] ?? null;
            $data[] = $formatted;
        }

        $result = [
            'data'       => $data,
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
        ];

        return $this->success($result);
    }

    public function store()
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;

        $body = $this->getRequestBody();

        $missing = $this->validateRequired($body, ['name', 'targetScopeType', 'amount']);
        if ($missing) return $this->error('Missing required fields: ' . implode(', ', $missing));

        $name = $this->sanitiseString($body['name'] ?? '');
        if (empty($name)) return $this->error('Campaign name is required');

        $amount = (float) ($body['amount'] ?? 0);
        if ($amount <= 0) return $this->error('Amount must be greater than zero');

        $scopeType = $body['targetScopeType'] ?? '';
        if (!in_array($scopeType, ['school_wide', 'class', 'students'])) {
            return $this->error('Invalid target scope type. Must be school_wide, class, or students');
        }

        if ($scopeType === 'class') {
            $scopeId = $body['targetScopeId'] ?? null;
            if (empty($scopeId)) {
                return $this->error('targetScopeId is required for class scope');
            }
        }

        $user   = $this->getCurrentUser();
        $userId = $user->id ?? null;

        $result = $this->service->createCampaign($body, $tenantId, $userId);

        if (isset($result['error'])) {
            return $this->error($result['error'], $result['status'] ?? 400);
        }

        $result['campaign']['summary'] = $this->campaignModel->getSummary(
            $result['campaign']['id'],
            $tenantId
        );

        return $this->created($result);
    }

    public function show($id = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if (!$id) return $this->error('Campaign ID is required');

        $campaign = $this->campaignModel->getByIdAndTenant($id, $tenantId);
        if (!$campaign) return $this->notFound('Campaign not found');

        $formatted = $this->campaignModel->formatForApi($campaign);
        $formatted['summary'] = $this->campaignModel->getSummary($id, $tenantId);

        return $this->success($formatted);
    }

    public function update($id = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;
        if (!$id) return $this->error('Campaign ID is required');

        $campaign = $this->campaignModel->getByIdAndTenant($id, $tenantId);
        if (!$campaign) return $this->notFound('Campaign not found');

        $body = $this->getRequestBody();
        $updates = [];

        if (isset($body['name'])) {
            $updates['name'] = $this->sanitiseString($body['name']);
        }
        if (isset($body['description'])) {
            $updates['description'] = $body['description'];
        }
        if (isset($body['dueDate'])) {
            $updates['due_date'] = $body['dueDate'];
        }

        if (empty($updates)) {
            return $this->error('No valid fields to update');
        }

        $updates['updated_at'] = date('Y-m-d H:i:s');
        $this->db->table('fee_campaigns')->where('id', $id)->update($updates);

        $updated   = $this->campaignModel->getByIdAndTenant($id, $tenantId);
        $formatted = $this->campaignModel->formatForApi($updated);
        $formatted['summary'] = $this->campaignModel->getSummary($id, $tenantId);

        return $this->success($formatted);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Campaign Students
    // ──────────────────────────────────────────────────────────────────────────

    public function getCampaignStudents($campaignId = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if (!$campaignId) return $this->error('Campaign ID is required');

        $campaign = $this->campaignModel->getByIdAndTenant($campaignId, $tenantId);
        if (!$campaign) return $this->notFound('Campaign not found');

        $status = $this->request->getGet('status');

        $records = $this->campaignStudentModel->getByCampaign($campaignId, $tenantId, $status ?: null);

        // Enrich with student name and class name via JOIN
        $studentIds = array_column($records, 'student_id');
        $studentMap = [];
        if (!empty($studentIds)) {
            $students = $this->db->table('students')
                ->select('students.id, students.first_name, students.last_name, classes.name as class_name')
                ->join('classes', 'classes.id = students.class_id', 'left')
                ->whereIn('students.id', $studentIds)
                ->get()->getResultArray();
            foreach ($students as $s) {
                $studentMap[$s['id']] = [
                    'name'  => $s['first_name'] . ' ' . $s['last_name'],
                    'class' => $s['class_name'] ?? null,
                ];
            }
        }

        $result = [];
        foreach ($records as $r) {
            $formatted = $this->campaignStudentModel->formatForApi($r);
            $formatted['studentName'] = $studentMap[$r['student_id']]['name'] ?? null;
            $formatted['className']   = $studentMap[$r['student_id']]['class'] ?? null;
            $result[] = $formatted;
        }

        return $this->success($result);
    }

    public function addStudent($campaignId = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;
        if (!$campaignId) return $this->error('Campaign ID is required');

        $body = $this->getRequestBody();
        $studentId = $body['studentId'] ?? null;
        if (!$studentId) return $this->error('studentId is required');

        $result = $this->service->addStudent($campaignId, $studentId, $tenantId);

        if (isset($result['error'])) {
            $code = $result['status'] ?? 400;
            return $this->error($result['error'], $code);
        }

        return $this->created($result['campaignStudent']);
    }

    public function removeStudent($campaignId = null, $studentId = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;
        if (!$campaignId || !$studentId) return $this->error('Campaign ID and Student ID are required');

        $force = $this->request->getGet('force') === 'true';

        $result = $this->service->removeStudent($campaignId, $studentId, $tenantId, $force);

        if (isset($result['error'])) {
            $code = $result['status'] ?? 400;
            return $this->error($result['error'], $code);
        }

        return $this->success(['removed' => true]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Payments
    // ──────────────────────────────────────────────────────────────────────────

    public function recordPayment($campaignId = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;
        if (!$campaignId) return $this->error('Campaign ID is required');

        $body = $this->getRequestBody();

        $missing = $this->validateRequired($body, ['studentId', 'amount', 'method']);
        if ($missing) return $this->error('Missing required fields: ' . implode(', ', $missing));

        $validMethods = ['Cash', 'EcoCash', 'Bank Transfer', 'Mukuru', 'InnBucks', 'OneMoney', 'Telecash', 'Swipe', 'ZIPIT', 'Other'];
        if (!in_array($body['method'], $validMethods)) {
            return $this->error('Invalid payment method');
        }

        try {
            $result = $this->service->recordPayment($campaignId, $body, $tenantId);

            if (isset($result['error'])) {
                $code = $result['status'] ?? 400;
                return $this->error($result['error'], $code);
            }

            return $this->created($result);
        } catch (\Throwable $e) {
            log_message('error', 'recordPayment exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
            return $this->error('Internal error: ' . $e->getMessage(), 500);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Close Campaign
    // ──────────────────────────────────────────────────────────────────────────

    public function close($campaignId = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;
        if (!$campaignId) return $this->error('Campaign ID is required');

        $body  = $this->getRequestBody();
        $force = !empty($body['force']);

        $result = $this->service->closeCampaign($campaignId, $tenantId, $force);

        if (isset($result['error'])) {
            $code = $result['status'] ?? 400;
            return $this->error($result['error'], $code);
        }

        return $this->success($result['campaign']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Payment Reconciliation
    // ──────────────────────────────────────────────────────────────────────────

    public function getCampaignPayments($campaignId = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if (!$campaignId) return $this->error('Campaign ID is required');

        $campaign = $this->campaignModel->getByIdAndTenant($campaignId, $tenantId);
        if (!$campaign) return $this->notFound('Campaign not found');

        $payments = $this->service->getCampaignPayments($campaignId, $tenantId);

        return $this->success($payments);
    }

    public function voidCampaignPayment($campaignId = null, $paymentId = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if ($err = $this->requireRole('super_admin', 'admin', 'bursar')) return $err;
        if (!$campaignId || !$paymentId) return $this->error('Campaign ID and Payment ID are required');

        $body   = $this->getRequestBody();
        $reason = $this->sanitiseString($body['reason'] ?? '');
        if (empty($reason)) {
            return $this->error('A reason is required to void a payment', 400);
        }

        $user   = $this->getCurrentUser();
        $userId = $user->id ?? 'system';

        $result = $this->service->voidCampaignPayment($campaignId, $paymentId, $tenantId, $reason, $userId);

        if (isset($result['error'])) {
            return $this->error($result['error'], $result['status'] ?? 400);
        }

        return $this->success($result);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Student Profile Integration
    // ──────────────────────────────────────────────────────────────────────────

    public function getStudentCampaigns($studentId = null)
    {
        $tenantId = $this->getTenantId();
        if (!$tenantId) return $this->error('Unauthorized', 401);
        if (!$studentId) return $this->error('Student ID is required');

        $records = $this->campaignStudentModel->getByStudentAndTenant($studentId, $tenantId);

        $campaignIds = array_unique(array_column($records, 'fee_campaign_id'));
        $campaignMap = [];
        if (!empty($campaignIds)) {
            foreach ($campaignIds as $cid) {
                $c = $this->campaignModel->getByIdAndTenant($cid, $tenantId);
                if ($c) $campaignMap[$cid] = $c;
            }
        }

        $result = [];
        foreach ($records as $r) {
            $c = $campaignMap[$r['fee_campaign_id']] ?? null;
            if (!$c) continue;

            $expected  = (float) $r['expected_amount'];
            $paid      = (float) $r['paid_amount'];

            $result[] = [
                'feeCampaignId'  => $r['fee_campaign_id'],
                'campaignName'   => $c['name'],
                'campaignStatus' => $c['status'],
                'dueDate'        => $c['due_date'] ?? null,
                'expectedAmount' => $expected,
                'paidAmount'     => $paid,
                'remainingAmount'=> max(0, $expected - $paid),
                'status'         => $r['status'],
            ];
        }

        return $this->success($result);
    }
}
