<?php

namespace App\Controllers\Api;

use App\Services\DriverKioskService;
use App\Services\AcademicSessionService;
use CodeIgniter\Database\Config;

/**
 * DriverKioskController
 *
 * Handles public kiosk endpoints for driver route and roster access.
 * These endpoints are intentionally exempt from JWTAuthFilter because the
 * kiosk page is accessed on shared terminals without an authenticated session.
 *
 * Security model:
 * - All requests must supply a valid kiosk_code (opaque 10-char token in
 *   tenants.settings) — this does not expose the internal tenant UUID.
 * - Actions additionally require the driver's employee_id, which must match
 *   an active staff member in the resolved tenant.
 * - Unified 403 responses for invalid/inactive employees prevent enumeration.
 * - Route ownership is verified per-request via driver_staff_id on the route.
 *
 * Constitution Principle III justified exception — same pattern as
 * StudentKioskController (specs/011) and KioskController (specs/006, 010).
 * See specs/055-driver-kiosk-viewonly/plan.md Complexity Tracking.
 */
class DriverKioskController extends BaseApiController
{
    protected $db;
    private DriverKioskService $kioskService;
    private AcademicSessionService $sessionService;

    public function __construct()
    {
        $this->db             = Config::connect();
        $this->kioskService   = new DriverKioskService();
        $this->sessionService = new AcademicSessionService();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/kiosk/driver/validate
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Validate a driver by Employee ID and return their assigned bus and routes.
     *
     * Request body: { kiosk_code: string, employee_id: string }
     *
     * Response data:
     *   { driverName, employeeId, bus: { id, name, regNumber, type, capacity },
     *     routes: [{ id, name, description, stops: [{ id, name, pickupTime, orderPosition }] }] }
     *
     * Returns 403 for any failure (not found, inactive, no routes) to
     * prevent staff enumeration.
     */
    public function validateDriver()
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        $kioskCode  = $data['kiosk_code']  ?? null;
        $employeeId = $data['employee_id'] ?? null;

        if (empty($kioskCode)) {
            return $this->error('kiosk_code is required', 400);
        }
        if (empty($employeeId)) {
            return $this->error('employee_id is required', 400);
        }

        $tenant = $this->resolveTenant($kioskCode);
        if ($tenant === null) {
            return $this->forbidden('Employee ID not recognized');
        }

        $tenantId = $tenant['id'];

        // Validate active staff member
        $staff = $this->db->table('staff')
            ->where('employee_id', $employeeId)
            ->where('tenant_id', $tenantId)
            ->where('employment_status', 'active')
            ->get()->getRowArray();

        // Unified 403 for not found or inactive — prevents enumeration
        if (!$staff) {
            return $this->forbidden('Employee ID not recognized');
        }

        $staffId      = $staff['id'];
        $driverName   = trim($staff['first_name'] . ' ' . $staff['last_name']);

        $result = $this->kioskService->resolveDriverBusAndRoutes(
            $tenantId,
            $staffId
        );

        return $this->success([
            'driverName' => $driverName,
            'employeeId' => $employeeId,
            'bus'        => $result['bus'],
            'routes'     => $result['routes'],
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/kiosk/driver/routes/:code
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Return the student roster for a specific route assigned to this driver.
     *
     * Query params: employee_id (required), route_id (required), paid_only (optional bool)
     *
     * Response data:
     *   { routeName, busName, totalCount, paidCount, unpaidCount,
     *     students: [{ id, firstName, lastName,
     *                  stop: { id, name, pickupTime },
     *                  direction, notes, paymentStatus }] }
     *
     * Re-validates the driver on every request and verifies route ownership.
     */
    public function roster($code = null)
    {
        $employeeId = $this->request->getGet('employee_id');
        $routeId    = $this->request->getGet('route_id');
        $paidOnly   = filter_var($this->request->getGet('paid_only'), FILTER_VALIDATE_BOOLEAN);

        if (empty($employeeId) || empty($routeId)) {
            return $this->error('employee_id and route_id are required', 400);
        }

        $tenant = $this->resolveTenant($code);
        if ($tenant === null) {
            return $this->notFound('Kiosk not found');
        }

        $tenantId = $tenant['id'];

        // Re-validate active staff member
        $staff = $this->db->table('staff')
            ->where('employee_id', $employeeId)
            ->where('tenant_id', $tenantId)
            ->where('employment_status', 'active')
            ->get()->getRowArray();

        if (!$staff) {
            return $this->forbidden('Employee ID not recognized');
        }

        $staffId      = $staff['id'];
        $academicYear = $this->sessionService->getCurrentSession($tenantId);

        // Verify route belongs to this driver via transport_route_periods.
        // driver_staff_id was dropped from transport_routes in migration 100003.
        $period = $this->db->table('transport_route_periods rp')
            ->select('rp.id')
            ->join('transport_drivers td', 'td.id = rp.driver_id', 'inner')
            ->where('rp.route_id',     $routeId)
            ->where('rp.tenant_id',    $tenantId)
            ->where('rp.status',       'active')
            ->where('td.staff_id',     $staffId)
            ->where('td.tenant_id',    $tenantId)
            ->where('td.status',       'active')
            ->limit(1)
            ->get()->getRowArray();

        if (!$period) {
            return $this->forbidden('Access denied');
        }

        // Fetch route name separately (no driver columns on transport_routes any more).
        $route = $this->db->table('transport_routes')
            ->where('id', $routeId)
            ->where('tenant_id', $tenantId)
            ->get()->getRowArray();

        if (!$route) {
            return $this->notFound('Route not found');
        }

        // Fetch active students with their assigned stop details
        $rows = $this->db->table('transport_student_allocations ta')
            ->select([
                's.id',
                's.first_name',
                's.last_name',
                'ta.stop_id',
                'ta.direction',
                'ta.notes',
                'ts.name AS stop_name',
                'ts.pickup_time AS stop_pickup_time',
            ])
            ->join('students s', 's.id = ta.student_id', 'inner')
            ->join('transport_stops ts', 'ts.id = ta.stop_id', 'left')
            ->where('ta.route_id', $routeId)
            ->where('ta.tenant_id', $tenantId)
            ->where('ta.status', 'active')
            ->where('s.status', 'active')
            ->orderBy('s.last_name', 'ASC')
            ->orderBy('s.first_name', 'ASC')
            ->get()->getResultArray();

        $studentIds = array_column($rows, 'id');

        $paymentStatusMap = $this->kioskService->getStudentsPaymentStatus(
            $studentIds,
            $tenantId,
            $academicYear
        );

        // Resolve bus name from route period
        $period = $this->db->table('transport_route_periods rp')
            ->select('v.name AS vehicle_name')
            ->join('transport_vehicles v', 'v.id = rp.vehicle_id', 'left')
            ->join('transport_drivers td', 'td.id = rp.driver_id', 'inner')
            ->where('rp.route_id', $routeId)
            ->where('rp.tenant_id', $tenantId)
            ->where('rp.status', 'active')
            ->where('td.staff_id', $staffId)
            ->where('td.status', 'active')
            ->limit(1)
            ->get()->getRowArray();

        $busName = $period['vehicle_name'] ?? null;

        $studentList = [];
        foreach ($rows as $s) {
            $status = $paymentStatusMap[$s['id']] ?? 'unpaid';
            if ($paidOnly && $status !== 'paid') {
                continue;
            }
            $studentList[] = [
                'id'        => $s['id'],
                'firstName' => $s['first_name'],
                'lastName'  => $s['last_name'],
                'stop'      => $s['stop_id'] ? [
                    'id'         => $s['stop_id'],
                    'name'       => $s['stop_name'],
                    'pickupTime' => $s['stop_pickup_time'] ?? null,
                ] : null,
                'direction'     => $s['direction'] ?? 'both',
                'notes'         => $s['notes'] ?? null,
                'paymentStatus' => $status,
            ];
        }

        $totalCount  = count($rows);
        $paidCount   = count(array_filter($paymentStatusMap, fn($v) => $v === 'paid'));
        $unpaidCount = $totalCount - $paidCount;

        return $this->success([
            'routeName'   => $route['route_name'],
            'busName'     => $busName,
            'totalCount'  => $totalCount,
            'paidCount'   => $paidCount,
            'unpaidCount' => $unpaidCount,
            'students'    => $studentList,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Resolve a tenant from an opaque kiosk code.
     * Returns the tenant row array or null if not found.
     */
    private function resolveTenant(?string $code): ?array
    {
        if (empty($code)) {
            return null;
        }

        $tenant = $this->db->query(
            "SELECT * FROM tenants
              WHERE JSON_UNQUOTE(JSON_EXTRACT(settings, '$.kiosk_code')) = ?",
            [$code]
        )->getRowArray();

        if (!$tenant) {
            return null;
        }

        $settings = json_decode($tenant['settings'] ?? '{}', true) ?? [];
        if (empty($settings['driverKioskModeEnabled'])) {
            return null;
        }

        return $tenant;
    }
}
