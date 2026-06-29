<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * TransportVehicleModel
 *
 * Represents transport vehicles (buses) assigned to routes.
 * All queries are scoped by tenant_id for multi-tenant isolation.
 */
class TransportVehicleModel extends Model
{
    protected $table = 'transport_vehicles';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $useSoftDeletes = false;

    protected $allowedFields = [
        'id', 'tenant_id', 'name', 'reg_number', 'type', 'capacity', 'status',
        'created_at', 'updated_at',
    ];

    protected $useTimestamps = true;
    protected $createdField = 'created_at';
    protected $updatedField = 'updated_at';

    /**
     * Get all active vehicles for a tenant.
     */
    public function getActiveForTenant(string $tenantId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('status', 'active')
            ->orderBy('name', 'ASC')
            ->findAll();
    }

    /**
     * Get the vehicle assigned to a driver via transport_route_periods.
     *
     * Joins transport_route_periods and transport_drivers to find the vehicle
     * for the currently active period matching the given driver's staff ID.
     *
     * @param string $tenantId  Tenant ID
     * @param string $staffId   staff.id of the driver
     * @param string $academicYear  Current academic year e.g. "2025-2026"
     * @return array|null Vehicle row or null if not found
     */
    public function getByDriverAssignment(string $tenantId, string $staffId, string $academicYear): ?array
    {
        $db = \Config\Database::connect();

        $row = $db->table('transport_vehicles v')
            ->select('v.id, v.name, v.reg_number, v.type, v.capacity')
            ->join('transport_route_periods rp', 'rp.vehicle_id = v.id', 'inner')
            ->join('transport_drivers td', 'td.id = rp.driver_id', 'inner')
            ->where('v.tenant_id', $tenantId)
            ->where('v.status', 'active')
            ->where('rp.tenant_id', $tenantId)
            ->where('rp.status', 'active')
            ->where('rp.academic_year', $academicYear)
            ->where('td.staff_id', $staffId)
            ->where('td.tenant_id', $tenantId)
            ->limit(1)
            ->get()
            ->getRowArray();

        return $row ?: null;
    }

    /**
     * Format a vehicle row for API responses.
     */
    public function formatForApi(array $row): array
    {
        return [
            'id'        => $row['id'],
            'name'      => $row['name'],
            'regNumber' => $row['reg_number'] ?? null,
            'type'      => $row['type'] ?? 'bus',
            'capacity'  => (int) ($row['capacity'] ?? 0),
        ];
    }
}
