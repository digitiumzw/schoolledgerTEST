<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;

class TransportDriverController extends BaseApiController
{
    protected $db;

    public function __construct()
    {
        $this->db = Config::connect();
    }

    /** GET /transport/drivers */
    public function index()
    {
        $tenantId = $this->getTenantId();
        $search = trim((string) ($this->request->getGet('search') ?? ''));

        $pagination = $this->normalisePaginationParams(50, 200);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $allowedSortFields = ['name', 'status'];
        $sort = $this->normaliseSortParams($allowedSortFields, 'name', 'asc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $driversBuilder = $this->db->table('transport_drivers d')
            ->select('d.*, s.employee_id AS staff_employee_id')
            ->join('staff s', 's.id = d.staff_id', 'left')
            ->where('d.tenant_id', $tenantId);

        if ($search !== '') {
            $driversBuilder->groupStart()
                ->like('d.name', $search)
                ->orLike('d.license_number', $search)
                ->orLike('d.phone', $search)
                ->groupEnd();
        }

        $total = (int) $driversBuilder->countAllResults(false);

        $sortColumn = $sort['sortBy'] === 'status' ? 'd.status' : 'd.name';
        $drivers = $driversBuilder
            ->orderBy($sortColumn, strtoupper($sort['sortOrder']))
            ->limit($pagination['limit'], $pagination['offset'])
            ->get()
            ->getResultArray();

        // Active route count per driver
        $driverIds = array_column($drivers, 'id');
        $routeCounts = [];

        if (!empty($driverIds)) {
            $escaped = implode("','", array_map([$this->db, 'escapeString'], $driverIds));
            $rows = $this->db->query("
                SELECT driver_id, COUNT(*) AS cnt
                FROM transport_route_periods
                WHERE driver_id IN ('$escaped') AND status = 'active' AND tenant_id = ?
                GROUP BY driver_id
            ", [$tenantId])->getResultArray();

            foreach ($rows as $r) {
                $routeCounts[$r['driver_id']] = (int) $r['cnt'];
            }
        }

        $result = array_map(function ($d) use ($routeCounts) {
            return [
                'id'              => $d['id'],
                'staffId'         => $d['staff_id'],
                'staffEmployeeId' => $d['staff_employee_id'],
                'name'            => $d['name'],
                'phone'           => $d['phone'],
                'licenseNumber'   => $d['license_number'],
                'status'          => $d['status'],
                'activeRoutes'    => $routeCounts[$d['id']] ?? 0,
            ];
        }, $drivers);

        return $this->success([
            'data'       => $result,
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
        ]);
    }

    /** POST /transport/drivers */
    public function create()
    {
        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        // Name is required unless staff_id is provided (name pulled from staff)
        if (empty($body['name']) && empty($body['staffId'])) {
            return $this->error('Driver name is required', 400);
        }

        $name  = $this->sanitiseString($body['name'] ?? '');
        $phone = isset($body['phone']) ? $this->sanitiseString($body['phone']) : null;

        // If linked to staff, pull name+phone from staff record
        if (!empty($body['staffId'])) {
            $staff = $this->db->table('staff')
                ->where('id', $body['staffId'])
                ->where('tenant_id', $tenantId)
                ->get()->getRowArray();

            if (!$staff) return $this->error('Staff member not found', 404);

            $name  = trim($staff['first_name'] . ' ' . $staff['last_name']);
            $phone = $phone ?: ($staff['phone'] ?? null);

            // Prevent duplicate driver records for the same staff member.
            // Without this, repeated "Add Driver" calls create multiple
            // transport_drivers rows for the same staff_id, which causes
            // confusion in route-period assignment and the driver kiosk.
            $existing = $this->db->table('transport_drivers')
                ->where('staff_id', $body['staffId'])
                ->where('tenant_id', $tenantId)
                ->limit(1)
                ->get()
                ->getRowArray();

            if ($existing) {
                // Re-activate if it was inactive, then return the existing record
                if ($existing['status'] !== 'active') {
                    $this->db->table('transport_drivers')
                        ->where('id', $existing['id'])
                        ->update([
                            'status'     => 'active',
                            'updated_at' => date('Y-m-d H:i:s'),
                        ]);
                }
                return $this->success(
                    ['id' => $existing['id']],
                    'Driver already exists for this staff member',
                    200
                );
            }
        }

        $id = $this->generateId('drv_');

        $this->db->table('transport_drivers')->insert([
            'id'             => $id,
            'tenant_id'      => $tenantId,
            'staff_id'       => $body['staffId'] ?? null,
            'name'           => $name,
            'phone'          => $phone,
            'license_number' => isset($body['licenseNumber']) ? $this->sanitiseString($body['licenseNumber']) : null,
            'status'         => 'active',
            'created_at'     => date('Y-m-d H:i:s'),
            'updated_at'     => date('Y-m-d H:i:s'),
        ]);

        return $this->success(['id' => $id], 'Driver created', 201);
    }

    /** PUT /transport/drivers/:id */
    public function update($id = null)
    {
        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        $driver = $this->db->table('transport_drivers')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$driver) return $this->error('Driver not found', 404);

        $update = ['updated_at' => date('Y-m-d H:i:s')];

        if (isset($body['name']))          $update['name']           = $this->sanitiseString($body['name']);
        if (isset($body['phone']))         $update['phone']          = $this->sanitiseString($body['phone']);
        if (isset($body['licenseNumber'])) $update['license_number'] = $this->sanitiseString($body['licenseNumber']);
        if (isset($body['status']) && in_array($body['status'], ['active', 'inactive'])) {
            $update['status'] = $body['status'];
        }
        if (array_key_exists('staffId', $body)) {
            $update['staff_id'] = $body['staffId'] ?: null;

            // Re-sync name from staff if a new staff link is set
            if ($body['staffId']) {
                $staff = $this->db->table('staff')
                    ->where('id', $body['staffId'])->where('tenant_id', $tenantId)
                    ->get()->getRowArray();
                if ($staff) {
                    $update['name']  = trim($staff['first_name'] . ' ' . $staff['last_name']);
                    $update['phone'] = $update['phone'] ?? $staff['phone'] ?? $driver['phone'];
                }
            }
        }

        $this->db->table('transport_drivers')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->update($update);

        return $this->success(null, 'Driver updated');
    }

    /** DELETE /transport/drivers/:id */
    public function delete($id = null)
    {
        $tenantId = $this->getTenantId();

        $driver = $this->db->table('transport_drivers')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$driver) return $this->error('Driver not found', 404);

        $activePeriods = $this->db->table('transport_route_periods')
            ->where('driver_id', $id)->where('status', 'active')
            ->countAllResults();

        if ($activePeriods > 0) {
            return $this->error(
                'Cannot delete a driver assigned to active routes. Remove from those routes first.',
                409
            );
        }

        $this->db->table('transport_drivers')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->delete();

        return $this->success(null, 'Driver deleted');
    }
}
