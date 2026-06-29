<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;
use App\Services\StaffAttendanceService;

class LeaveController extends BaseApiController
{
    protected $db;
    protected StaffAttendanceService $attendanceService;

    public function __construct()
    {
        $this->db                = Config::connect();
        $this->attendanceService = new StaffAttendanceService();
    }

    public function index()
    {
        $tenantId = $this->getTenantId();

        $pageRaw  = $this->request->getGet('page');
        $limitRaw = $this->request->getGet('limit');

        // Backward-compat: no pagination params → return flat array (old behavior)
        if ($pageRaw === null && $limitRaw === null) {
            $requests = $this->db->table('leave_requests')
                ->where('tenant_id', $tenantId)
                ->orderBy('applied_date', 'DESC')
                ->orderBy('created_at', 'DESC')
                ->get()->getResultArray();

            return $this->success($this->formatRequests($requests));
        }

        $pagination = $this->normalisePaginationParams(10, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $builder = $this->db->table('leave_requests')
            ->where('tenant_id', $tenantId)
            ->orderBy('applied_date', 'DESC')
            ->orderBy('created_at', 'DESC');

        $total = $builder->countAllResults(false);

        $requests = $builder
            ->limit($pagination['limit'], $pagination['offset'])
            ->get()
            ->getResultArray();

        $formatted = $this->formatRequests($requests);

        return $this->success([
            'data'       => $formatted,
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
            'requests'   => $formatted,
        ]);
    }

    public function pending()
    {
        $tenantId = $this->getTenantId();
        $requests = $this->db->table('leave_requests')
            ->where('tenant_id', $tenantId)
            ->where('status', 'pending')
            ->orderBy('applied_date', 'DESC')
            ->orderBy('created_at', 'DESC')
            ->get()->getResultArray();

        return $this->success($this->formatRequests($requests));
    }

    public function byStaff($staffId = null)
    {
        $tenantId = $this->getTenantId();
        $requests = $this->db->table('leave_requests')
            ->where('tenant_id', $tenantId)
            ->where('staff_id', $staffId)
            ->orderBy('applied_date', 'DESC')
            ->orderBy('created_at', 'DESC')
            ->get()->getResultArray();

        return $this->success($this->formatRequests($requests));
    }

    private const VALID_LEAVE_TYPES = ['annual', 'sick', 'maternity', 'paternity', 'study', 'unpaid', 'compassionate'];

    public function create()
    {
        $tenantId = $this->getTenantId();
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        if (empty($data['staffId']) || empty($data['leaveType']) || empty($data['startDate']) || empty($data['endDate'])) {
            return $this->error('staffId, leaveType, startDate, and endDate are required', 400);
        }

        if (!in_array($data['leaveType'], self::VALID_LEAVE_TYPES, true)) {
            return $this->error(
                'Invalid leave type. Allowed: ' . implode(', ', self::VALID_LEAVE_TYPES),
                400
            );
        }

        $dateRange = $this->normaliseDateRange($data['startDate'], $data['endDate']);
        if (isset($dateRange['error'])) {
            return $this->error($dateRange['error'], 400);
        }

        $conflict = $this->findOverlappingLeave(
            $tenantId,
            $data['staffId'],
            $dateRange['startDate'],
            $dateRange['endDate']
        );
        if ($conflict) {
            return $this->leaveConflictResponse($conflict);
        }

        $requestId = $this->generateId('lr');
        $this->db->table('leave_requests')->insert([
            'id' => $requestId,
            'tenant_id' => $tenantId,
            'staff_id' => $data['staffId'],
            'leave_type' => $data['leaveType'],
            'start_date' => $dateRange['startDate'],
            'end_date' => $dateRange['endDate'],
            'days' => (int) ($data['days'] ?? 1),
            'reason' => $data['reason'] ?? '',
            'status' => 'pending',
            'applied_date' => date('Y-m-d'),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return $this->created(['id' => $requestId, 'status' => 'pending']);
    }

    public function review($id = null)
    {
        $tenantId = $this->getTenantId();
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $user = $this->getCurrentUser();

        $validStatuses = ['approved', 'rejected'];
        if (empty($data['status']) || !in_array($data['status'], $validStatuses, true)) {
            return $this->error('Status must be one of: ' . implode(', ', $validStatuses), 400);
        }

        // Scope by tenant_id to prevent cross-tenant mutation
        $exists = $this->db->table('leave_requests')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->get()->getRow();

        if (!$exists) {
            return $this->notFound('Leave request not found');
        }

        if ($data['status'] === 'approved') {
            $dateRange = $this->normaliseDateRange($exists->start_date, $exists->end_date);
            if (isset($dateRange['error'])) {
                return $this->error($dateRange['error'], 400);
            }

            $conflict = $this->findOverlappingLeave(
                $tenantId,
                $exists->staff_id,
                $dateRange['startDate'],
                $dateRange['endDate'],
                $id
            );
            if ($conflict) {
                return $this->leaveConflictResponse($conflict);
            }
        }

        $this->db->table('leave_requests')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->update([
                'status' => $data['status'],
                'reviewed_by' => $user->id ?? 'admin',
                'reviewed_date' => date('Y-m-d'),
                'review_notes' => $data['reviewNotes'] ?? '',
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        // Fetch the updated leave row for attendance sync/void
        $leaveRow = $this->db->table('leave_requests')
            ->where('id', $id)
            ->get()->getRowArray();

        $syncedDays = 0;
        if ($data['status'] === 'approved') {
            $syncedDays = $this->attendanceService->syncLeaveToAttendance($leaveRow, $tenantId);
        } elseif (in_array($data['status'], ['rejected'], true)) {
            $this->attendanceService->voidLeaveAttendance($leaveRow, $tenantId);
        }

        return $this->success([
            'id'                   => $id,
            'status'               => $data['status'],
            'syncedAttendanceDays' => $syncedDays,
        ]);
    }

    public function update($id = null)
    {
        $tenantId = $this->getTenantId();
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        $exists = $this->db->table('leave_requests')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->get()->getRow();

        if (!$exists) {
            return $this->notFound('Leave request not found');
        }

        // Only allow updating pending requests
        if ($exists->status !== 'pending') {
            return $this->error('Only pending leave requests can be edited', 400);
        }

        if (isset($data['leaveType']) && !in_array($data['leaveType'], self::VALID_LEAVE_TYPES, true)) {
            return $this->error(
                'Invalid leave type. Allowed: ' . implode(', ', self::VALID_LEAVE_TYPES),
                400
            );
        }

        $startDate = $data['startDate'] ?? $exists->start_date;
        $endDate = $data['endDate'] ?? $exists->end_date;
        $dateRange = $this->normaliseDateRange($startDate, $endDate);
        if (isset($dateRange['error'])) {
            return $this->error($dateRange['error'], 400);
        }

        $conflict = $this->findOverlappingLeave(
            $tenantId,
            $exists->staff_id,
            $dateRange['startDate'],
            $dateRange['endDate'],
            $id
        );
        if ($conflict) {
            return $this->leaveConflictResponse($conflict);
        }

        $updateData = ['updated_at' => date('Y-m-d H:i:s')];
        if (isset($data['leaveType']))  $updateData['leave_type']  = $data['leaveType'];
        if (isset($data['startDate']))  $updateData['start_date']  = $dateRange['startDate'];
        if (isset($data['endDate']))    $updateData['end_date']    = $dateRange['endDate'];
        if (isset($data['days']))       $updateData['days']        = (int) $data['days'];
        if (isset($data['reason']))     $updateData['reason']      = $data['reason'];

        $this->db->table('leave_requests')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->update($updateData);

        return $this->success(['id' => $id]);
    }

    public function delete($id = null)
    {
        $tenantId = $this->getTenantId();

        $exists = $this->db->table('leave_requests')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->get()->getRow();

        if (!$exists) {
            return $this->notFound('Leave request not found');
        }

        // Void any attendance records synced from an approved leave before deletion
        if ($exists->status === 'approved') {
            $leaveRow = $this->db->table('leave_requests')
                ->where('id', $id)
                ->get()->getRowArray();
            $this->attendanceService->voidLeaveAttendance($leaveRow, $tenantId);
        }

        $this->db->table('leave_requests')
            ->where('id', $id)
            ->where('tenant_id', $tenantId)
            ->delete();

        return $this->success(['id' => $id]);
    }

    protected function formatRequests(array $requests): array
    {
        return array_map(fn($r) => [
            'id' => $r['id'],
            'staffId' => $r['staff_id'],
            'leaveType' => $r['leave_type'],
            'startDate' => $r['start_date'],
            'endDate' => $r['end_date'],
            'days' => (int) $r['days'],
            'reason' => $r['reason'],
            'status' => $r['status'],
            'appliedDate' => $r['applied_date'],
            'reviewedBy' => $r['reviewed_by'],
            'reviewedDate' => $r['reviewed_date'],
            'reviewNotes' => $r['review_notes'],
        ], $requests);
    }

    private function findOverlappingLeave(
        string $tenantId,
        string $staffId,
        string $startDate,
        string $endDate,
        ?string $excludeId = null
    ): ?array {
        $builder = $this->db->table('leave_requests')
            ->where('tenant_id', $tenantId)
            ->where('staff_id', $staffId)
            ->whereIn('status', ['pending', 'approved'])
            ->where('start_date <=', $endDate)
            ->where('end_date >=', $startDate);

        if ($excludeId !== null) {
            $builder->where('id !=', $excludeId);
        }

        return $builder
            ->orderBy('start_date', 'ASC')
            ->get()
            ->getRowArray();
    }

    private function leaveConflictResponse(array $conflict)
    {
        return $this->error(
            sprintf(
                'Staff member already has a %s leave request from %s to %s.',
                $conflict['status'],
                $conflict['start_date'],
                $conflict['end_date']
            ),
            409,
            [
                'conflict' => [
                    'id' => $conflict['id'],
                    'status' => $conflict['status'],
                    'startDate' => $conflict['start_date'],
                    'endDate' => $conflict['end_date'],
                ],
            ]
        );
    }

}
