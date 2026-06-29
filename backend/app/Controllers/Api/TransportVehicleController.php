<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;

class TransportVehicleController extends BaseApiController
{
    protected $db;

    public function __construct()
    {
        $this->db = Config::connect();
    }

    /** GET /transport/vehicles */
    public function index()
    {
        $tenantId = $this->getTenantId();
        $search = trim((string) ($this->request->getGet('search') ?? ''));

        $pagination = $this->normalisePaginationParams(50, 200);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $allowedSortFields = ['name', 'type', 'capacity', 'status'];
        $sort = $this->normaliseSortParams($allowedSortFields, 'name', 'asc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $sortColumnMap = ['name' => 'v.name', 'type' => 'v.type', 'capacity' => 'v.capacity', 'status' => 'v.status'];

        $vehiclesBuilder = $this->db->table('transport_vehicles v')
            ->select('v.*')
            ->where('v.tenant_id', $tenantId);

        if ($search !== '') {
            $vehiclesBuilder->groupStart()
                ->like('v.name', $search)
                ->orLike('v.reg_number', $search)
                ->groupEnd();
        }

        $total = (int) $vehiclesBuilder->countAllResults(false);

        $orderColumn = $sortColumnMap[$sort['sortBy']] ?? 'v.name';
        $vehicles = $vehiclesBuilder
            ->orderBy($orderColumn, strtoupper($sort['sortOrder']))
            ->limit($pagination['limit'], $pagination['offset'])
            ->get()
            ->getResultArray();

        // Attach active allocation count per vehicle
        $vehicleIds = array_column($vehicles, 'id');
        $allocCounts = [];

        if (!empty($vehicleIds)) {
            $rows = $this->db->query("
                SELECT rp.vehicle_id, COUNT(tsa.id) AS cnt
                FROM transport_route_periods rp
                JOIN transport_student_allocations tsa
                    ON tsa.route_id = rp.route_id
                   AND tsa.status = 'active'
                   AND tsa.tenant_id = ?
                JOIN students s
                    ON s.id = tsa.student_id
                   AND s.status = 'active'
                WHERE rp.vehicle_id IN ('" . implode("','", array_map([$this->db, 'escapeString'], $vehicleIds)) . "')
                  AND rp.status = 'active'
                  AND rp.tenant_id = ?
                GROUP BY rp.vehicle_id
            ", [$tenantId, $tenantId])->getResultArray();

            foreach ($rows as $r) {
                $allocCounts[$r['vehicle_id']] = (int) $r['cnt'];
            }
        }

        $result = array_map(function ($v) use ($allocCounts) {
            return [
                'id'                => $v['id'],
                'name'              => $v['name'],
                'regNumber'         => $v['reg_number'],
                'type'              => $v['type'],
                'capacity'          => (int) $v['capacity'],
                'status'            => $v['status'],
                'activeAllocations' => $allocCounts[$v['id']] ?? 0,
            ];
        }, $vehicles);

        return $this->success([
            'data'       => $result,
            'pagination' => $this->buildPaginationMeta($total, $pagination['page'], $pagination['limit']),
        ]);
    }

    /** POST /transport/vehicles */
    public function create()
    {
        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        if ($err = $this->requireFields($body, ['name', 'capacity'])) return $err;

        $capacity = (int) ($body['capacity'] ?? 0);
        if ($capacity < 1) {
            return $this->error('Capacity must be at least 1', 400);
        }

        $id = $this->generateId('veh_');

        $this->db->table('transport_vehicles')->insert([
            'id'         => $id,
            'tenant_id'  => $tenantId,
            'name'       => $this->sanitiseString($body['name']),
            'reg_number' => isset($body['regNumber']) ? $this->sanitiseString($body['regNumber']) : null,
            'type'       => in_array($body['type'] ?? '', ['bus', 'minibus', 'van', 'other']) ? $body['type'] : 'bus',
            'capacity'   => $capacity,
            'status'     => 'active',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return $this->success(['id' => $id], 'Vehicle created', 201);
    }

    /** PUT /transport/vehicles/:id */
    public function update($id = null)
    {
        $tenantId = $this->getTenantId();
        $body     = $this->getRequestBody();

        $vehicle = $this->db->table('transport_vehicles')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$vehicle) return $this->error('Vehicle not found', 404);

        $update = ['updated_at' => date('Y-m-d H:i:s')];

        if (isset($body['name']))      $update['name']       = $this->sanitiseString($body['name']);
        if (isset($body['regNumber'])) $update['reg_number'] = $this->sanitiseString($body['regNumber']);
        if (isset($body['type']) && in_array($body['type'], ['bus', 'minibus', 'van', 'other'])) {
            $update['type'] = $body['type'];
        }
        if (isset($body['capacity'])) {
            $capacity = (int) $body['capacity'];
            if ($capacity < 1) return $this->error('Capacity must be at least 1', 400);
            $update['capacity'] = $capacity;
        }
        if (isset($body['status']) && in_array($body['status'], ['active', 'inactive'])) {
            $update['status'] = $body['status'];
        }

        $this->db->table('transport_vehicles')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->update($update);

        return $this->success(null, 'Vehicle updated');
    }

    /** DELETE /transport/vehicles/:id */
    public function delete($id = null)
    {
        $tenantId = $this->getTenantId();

        $vehicle = $this->db->table('transport_vehicles')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$vehicle) return $this->error('Vehicle not found', 404);

        // Block deletion if vehicle has active route periods
        $activePeriods = $this->db->table('transport_route_periods')
            ->where('vehicle_id', $id)->where('status', 'active')
            ->countAllResults();

        if ($activePeriods > 0) {
            return $this->error(
                'Cannot delete a vehicle that is assigned to active routes. Remove it from those routes first.',
                409
            );
        }

        $this->db->table('transport_vehicles')
            ->where('id', $id)->where('tenant_id', $tenantId)
            ->delete();

        return $this->success(null, 'Vehicle deleted');
    }
}
