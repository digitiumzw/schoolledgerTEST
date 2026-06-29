<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Remove columns from transport_routes that are now owned by the new
 * normalized tables (transport_vehicles, transport_stops, transport_drivers,
 * transport_route_periods).
 *
 * DOWN restores the columns as nullable so existing data can be recovered if
 * needed, but does not repopulate them.
 */
class AlterTransportRoutesDropLegacyColumns extends Migration
{
    public function up(): void
    {
        $this->db->query('ALTER TABLE transport_routes
            DROP COLUMN pickup_points,
            DROP COLUMN vehicle,
            DROP COLUMN driver_name,
            DROP COLUMN driver_phone,
            DROP COLUMN driver_user_id,
            DROP COLUMN driver_staff_id
        ');
    }

    public function down(): void
    {
        $this->db->query("ALTER TABLE transport_routes
            ADD COLUMN pickup_points    JSON         NULL AFTER route_name,
            ADD COLUMN vehicle          VARCHAR(100) NOT NULL DEFAULT '',
            ADD COLUMN driver_name      VARCHAR(100) NOT NULL DEFAULT '',
            ADD COLUMN driver_phone     VARCHAR(50)  NULL,
            ADD COLUMN driver_user_id   VARCHAR(50)  NULL,
            ADD COLUMN driver_staff_id  VARCHAR(36)  NULL
        ");
    }
}
