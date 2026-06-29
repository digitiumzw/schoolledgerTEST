<?php

namespace App\Models;

use CodeIgniter\Model;

/**
 * TransportStopModel
 *
 * Represents stops along a transport route, ordered by order_position.
 * All queries are scoped by tenant_id for multi-tenant isolation.
 */
class TransportStopModel extends Model
{
    protected $table = 'transport_stops';
    protected $primaryKey = 'id';
    protected $useAutoIncrement = false;
    protected $returnType = 'array';
    protected $useSoftDeletes = false;

    protected $allowedFields = [
        'id', 'tenant_id', 'route_id', 'name', 'pickup_time', 'order_position',
        'created_at', 'updated_at',
    ];

    protected $useTimestamps = true;
    protected $createdField = 'created_at';
    protected $updatedField = 'updated_at';

    /**
     * Get all stops for a route, ordered by sequence (order_position ASC).
     *
     * @param string $tenantId  Tenant ID
     * @param string $routeId   Route ID
     * @return array  Array of stop rows in sequence order
     */
    public function getStopsForRoute(string $tenantId, string $routeId): array
    {
        return $this->where('tenant_id', $tenantId)
            ->where('route_id', $routeId)
            ->orderBy('order_position', 'ASC')
            ->findAll();
    }

    /**
     * Format a stop row for API responses.
     */
    public function formatForApi(array $row): array
    {
        return [
            'id'            => $row['id'],
            'name'          => $row['name'],
            'pickupTime'    => $row['pickup_time'] ?? null,
            'orderPosition' => (int) ($row['order_position'] ?? 0),
        ];
    }
}
