<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Migrate legacy transport data into the new normalized tables.
 *
 * - pickup_points JSON array  → transport_stops rows
 * - vehicle string per route  → transport_vehicles rows (de-duped per tenant)
 * - driver fields per route   → transport_drivers rows
 * - route vehicle+driver      → transport_route_periods row (one per active route)
 * - transport_assignments     → transport_student_allocations (stop matched by name)
 */
class MigrateTransportLegacyData extends Migration
{
    public function up(): void
    {
        $now = date('Y-m-d H:i:s');
        $academicYear = date('Y') . '/' . (date('Y') + 1);

        $routes = $this->db->table('transport_routes')->get()->getResultArray();

        // vehicle name → vehicle id, keyed by "tenant_id:vehicle_name"
        $vehicleMap = [];

        foreach ($routes as $route) {
            $tenantId = $route['tenant_id'];
            $routeId  = $route['id'];

            // ── 1. Stops ──────────────────────────────────────────────────────
            $stopsJson = $route['pickup_points'] ?? '[]';
            $rawStops  = json_decode($stopsJson, true) ?? [];

            // Sort by existing order value so positions are preserved
            usort($rawStops, fn($a, $b) => ($a['order'] ?? 0) <=> ($b['order'] ?? 0));

            $stopNameToId = []; // stop name → new stop id for this route

            foreach ($rawStops as $i => $s) {
                $stopId = 'stop_' . time() . '_' . bin2hex(random_bytes(4));
                $this->db->table('transport_stops')->insert([
                    'id'             => $stopId,
                    'tenant_id'      => $tenantId,
                    'route_id'       => $routeId,
                    'name'           => $s['name'] ?? "Stop " . ($i + 1),
                    'pickup_time'    => $s['time'] ?? null,
                    'order_position' => $i,
                    'created_at'     => $now,
                    'updated_at'     => $now,
                ]);
                $stopNameToId[strtolower(trim($s['name'] ?? ''))] = $stopId;
                usleep(1000); // ensure unique IDs
            }

            // ── 2. Vehicle (de-dup per tenant) ────────────────────────────────
            $vehicleName = trim($route['vehicle'] ?? '');
            $vehicleKey  = $tenantId . ':' . strtolower($vehicleName);

            if ($vehicleName && !isset($vehicleMap[$vehicleKey])) {
                $vehicleId = 'veh_' . time() . '_' . bin2hex(random_bytes(4));
                $this->db->table('transport_vehicles')->insert([
                    'id'         => $vehicleId,
                    'tenant_id'  => $tenantId,
                    'name'       => $vehicleName,
                    'reg_number' => null,
                    'type'       => 'bus',
                    'capacity'   => 40,
                    'status'     => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                $vehicleMap[$vehicleKey] = $vehicleId;
                usleep(1000);
            }
            $vehicleId = $vehicleMap[$vehicleKey] ?? null;

            // ── 3. Driver ─────────────────────────────────────────────────────
            $driverName = trim($route['driver_name'] ?? '');
            $driverId   = null;

            if ($driverName) {
                $driverId = 'drv_' . time() . '_' . bin2hex(random_bytes(4));
                $this->db->table('transport_drivers')->insert([
                    'id'             => $driverId,
                    'tenant_id'      => $tenantId,
                    'staff_id'       => $route['driver_staff_id'] ?? null,
                    'name'           => $driverName,
                    'phone'          => $route['driver_phone'] ?? null,
                    'license_number' => null,
                    'status'         => 'active',
                    'created_at'     => $now,
                    'updated_at'     => $now,
                ]);
                usleep(1000);
            }

            // ── 4. Route period ───────────────────────────────────────────────
            if ($vehicleId) {
                $periodId = 'rp_' . time() . '_' . bin2hex(random_bytes(4));
                $this->db->table('transport_route_periods')->insert([
                    'id'            => $periodId,
                    'tenant_id'     => $tenantId,
                    'route_id'      => $routeId,
                    'vehicle_id'    => $vehicleId,
                    'driver_id'     => $driverId,
                    'academic_year' => $academicYear,
                    'start_date'    => null,
                    'end_date'      => null,
                    'status'        => $route['status'] === 'active' ? 'active' : 'inactive',
                    'created_at'    => $now,
                    'updated_at'    => $now,
                ]);
                usleep(1000);
            }

            // ── 5. Student allocations ────────────────────────────────────────
            $assignments = $this->db->table('transport_assignments')
                ->where('route_id', $routeId)
                ->get()->getResultArray();

            foreach ($assignments as $a) {
                $pickupName = strtolower(trim($a['pickup_point'] ?? ''));
                $stopId = $stopNameToId[$pickupName] ?? null;

                $allocId = 'tsa_' . time() . '_' . bin2hex(random_bytes(4));
                $this->db->table('transport_student_allocations')->insert([
                    'id'            => $allocId,
                    'tenant_id'     => $tenantId,
                    'student_id'    => $a['student_id'],
                    'route_id'      => $routeId,
                    'stop_id'       => $stopId,
                    'direction'     => 'both',
                    'academic_year' => $academicYear,
                    'start_date'    => $a['start_date'],
                    'end_date'      => $a['end_date'],
                    'status'        => $a['status'],
                    'notes'         => null,
                    'created_at'    => $a['created_at'] ?? $now,
                    'updated_at'    => $now,
                ]);
                usleep(1000);
            }
        }
    }

    public function down(): void
    {
        $this->db->table('transport_student_allocations')->truncate();
        $this->db->table('transport_route_periods')->truncate();
        $this->db->table('transport_drivers')->truncate();
        $this->db->table('transport_stops')->truncate();
        $this->db->table('transport_vehicles')->truncate();
    }
}
