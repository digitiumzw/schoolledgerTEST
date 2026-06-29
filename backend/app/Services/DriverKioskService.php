<?php

namespace App\Services;

use App\Models\TransportVehicleModel;
use App\Models\TransportStopModel;
use CodeIgniter\Database\BaseConnection;
use Config\Database;

/**
 * DriverKioskService
 *
 * Encapsulates business logic for the driver kiosk feature:
 *
 *  - resolveDriverBusAndRoutes(): Fetches the bus and routes (with ordered stops)
 *    assigned to a driver for the current academic year.
 *  - getStudentsPaymentStatus(): Bulk calculation of transport payment status
 *    for a set of students. Uses a single query to avoid N+1 issues.
 *
 * All queries are scoped by tenant_id per Constitution Principle I.
 * Payment status is computed from source records per Constitution Principle V.
 */
class DriverKioskService
{
    private BaseConnection $db;
    private TransportVehicleModel $vehicleModel;
    private TransportStopModel $stopModel;

    public function __construct(
        ?BaseConnection $db = null,
        ?TransportVehicleModel $vehicleModel = null,
        ?TransportStopModel $stopModel = null
    ) {
        $this->db           = $db ?? Database::connect();
        $this->vehicleModel = $vehicleModel ?? new TransportVehicleModel();
        $this->stopModel    = $stopModel ?? new TransportStopModel();
    }

    /**
     * Resolve the bus and routes (with stops) assigned to a driver.
     *
     * Looks up the driver via transport_drivers.staff_id = $staffId,
     * then fetches active transport_route_periods for the current academic year,
     * joined with transport_vehicles and transport_routes.
     *
     * @param string $tenantId     Tenant ID
     * @param string $staffId      staff.id of the authenticated driver
     * @return array{bus: array|null, routes: array[]}
     */
    public function resolveDriverBusAndRoutes(
        string $tenantId,
        string $staffId
    ): array {
        // driver_staff_id was dropped from transport_routes in migration 100003.
        // Routes are now linked to drivers exclusively via transport_route_periods → transport_drivers.
        // LEFT JOIN on vehicle so routes appear even when no bus/vehicle is configured.
        $rows = $this->db->table('transport_route_periods rp')
            ->select([
                'r.id AS route_id',
                'r.route_name',
                'v.id AS vehicle_id',
                'v.name AS vehicle_name',
                'v.reg_number',
                'v.type AS vehicle_type',
                'v.capacity',
            ])
            ->join('transport_routes r',   'r.id = rp.route_id',    'inner')
            ->join('transport_drivers td', 'td.id = rp.driver_id',  'inner')
            ->join('transport_vehicles v', 'v.id = rp.vehicle_id',  'left')
            ->where('rp.tenant_id',    $tenantId)
            ->where('rp.status',       'active')
            ->where('td.staff_id',     $staffId)
            ->where('td.tenant_id',    $tenantId)
            ->where('td.status',       'active')
            ->where('r.tenant_id',     $tenantId)
            ->where('r.status',        'active')
            ->orderBy('r.route_name',  'ASC')
            ->get()
            ->getResultArray();

        if (empty($rows)) {
            return ['bus' => null, 'routes' => []];
        }

        // First vehicle found becomes the bus card (one bus per driver period).
        $bus = null;
        foreach ($rows as $row) {
            if (!empty($row['vehicle_id'])) {
                $bus = [
                    'id'        => $row['vehicle_id'],
                    'name'      => $row['vehicle_name'],
                    'regNumber' => $row['reg_number'] ?? null,
                    'type'      => $row['vehicle_type'] ?? 'bus',
                    'capacity'  => (int) ($row['capacity'] ?? 0),
                ];
                break;
            }
        }

        $routes = [];
        foreach ($rows as $row) {
            $routeId  = $row['route_id'];
            $rawStops = $this->stopModel->getStopsForRoute($tenantId, $routeId);
            $stops    = array_map(
                fn($s) => $this->stopModel->formatForApi($s),
                $rawStops
            );
            $routes[] = [
                'id'          => $routeId,
                'name'        => $row['route_name'],
                'description' => null,
                'stops'       => $stops,
            ];
        }

        return ['bus' => $bus, 'routes' => $routes];
    }


    /**
     * Get payment status for multiple students in bulk.
     *
     * A student is considered 'paid' if their total payments for the tenant
     * are >= their total transport charges for the given academic year.
     * Uses zero-charge = 'paid' rule (no fee assessed).
     *
     * N+1 safe: uses two aggregate queries for the entire student set.
     *
     * @param string[] $studentIds   Array of student IDs
     * @param string   $tenantId     Tenant ID
     * @param string   $academicYear Current academic year e.g. "2025-2026"
     * @return array<string, 'paid'|'unpaid'>  Map of student_id => 'paid'|'unpaid'
     */
    public function getStudentsPaymentStatus(
        array $studentIds,
        string $tenantId,
        string $academicYear
    ): array {
        if (empty($studentIds)) {
            return [];
        }

        $chargeRows = $this->db->table('charges')
            ->select('student_id, SUM(amount) AS total')
            ->whereIn('student_id', $studentIds)
            ->where('tenant_id', $tenantId)
            ->where('charge_type', 'transport')
            ->where('academic_year', $academicYear)
            ->groupBy('student_id')
            ->get()
            ->getResultArray();

        $chargeMap = array_column($chargeRows, 'total', 'student_id');

        $paymentRows = $this->db->table('payments')
            ->select('student_id, SUM(amount) AS total')
            ->whereIn('student_id', $studentIds)
            ->where('tenant_id', $tenantId)
            ->groupBy('student_id')
            ->get()
            ->getResultArray();

        $paymentMap = array_column($paymentRows, 'total', 'student_id');

        $result = [];
        foreach ($studentIds as $studentId) {
            $charges  = (float) ($chargeMap[$studentId]  ?? 0);
            $payments = (float) ($paymentMap[$studentId] ?? 0);
            $result[$studentId] = $payments >= $charges ? 'paid' : 'unpaid';
        }

        return $result;
    }
}
