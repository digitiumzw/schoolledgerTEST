<?php

namespace App\Database\Seeds\Factories;

use App\Database\Seeds\FactoryContext;

/**
 * TransportRouteFactory
 *
 * Generates transport routes with realistic Zimbabwean data.
 * Priority: 60
 */
class TransportRouteFactory extends AbstractFactory
{
    public function getPriority(): int
    {
        return 60;
    }

    protected function tableName(): string
    {
        return 'transport_routes';
    }

    private static array $routeNames = [
        'Route A - City Centre',
        'Route B - Borrowdale',
        'Route C - Avondale',
        'Route D - Glen Norah',
        'Route E - Chitungwiza',
        'Route F - Hatfield',
        'Route G - Mbare',
        'Route H - Warren Park',
    ];

    private static array $suburbs = [
        'Borrowdale', 'Avondale', 'Highlands', 'Waterfalls', 'Glen View',
        'Warren Park', 'Kuwadzana', 'Epworth', 'Hatfield', 'Mbare',
    ];

    public function make(FactoryContext $context): array
    {
        $faker     = $context->faker;
        $now       = $this->now();
        $routeIdx  = mt_rand(0, count(static::$routeNames) - 1);
        $routeName = static::$routeNames[$routeIdx];
        $busNum    = 'Bus GA-' . str_pad((string) mt_rand(1, 20), 3, '0', STR_PAD_LEFT);

        $pickupPoints = [];
        $numStops     = mt_rand(3, 7);
        $suburbs      = static::$suburbs;
        shuffle($suburbs);
        for ($i = 0; $i < $numStops; $i++) {
            $pickupPoints[] = [
                'name'  => $suburbs[$i % count($suburbs)],
                'time'  => sprintf('%02d:%02d', mt_rand(6, 7), mt_rand(0, 59)),
                'order' => $i + 1,
            ];
        }

        return [
            'id'            => $this->generateId('route'),
            'tenant_id'     => $context->tenantId,
            'route_name'    => $routeName,
            'pickup_points' => json_encode($pickupPoints),
            'vehicle'       => $busNum,
            'driver_name'   => $faker->zimbabweanName(),
            'driver_phone'  => $faker->zimbabweanPhone(),
            'driver_user_id'  => null,
            'driver_staff_id' => null,
            'monthly_fee'   => mt_rand(50, 80) + 0.00,
            'status'        => 'active',
            'created_at'    => $now,
            'updated_at'    => $now,
        ];
    }

    public function createMany(FactoryContext $context, int $count): array
    {
        $ids     = [];
        $pending = [];

        for ($i = 0; $i < $count; $i++) {
            $row     = $this->make($context);
            $ids[]   = $row['id'];
            $pending[] = $row;
        }

        if (!empty($pending)) {
            $this->db->table($this->tableName())->insertBatch($pending);
        }

        foreach ($ids as $id) {
            $context->addRouteId($id);
        }

        return $ids;
    }
}
