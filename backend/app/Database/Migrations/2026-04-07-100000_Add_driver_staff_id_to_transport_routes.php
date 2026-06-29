<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add driver_staff_id column to transport_routes.
 *
 * Links a transport route to a staff member (by staff.id) so the driver
 * kiosk can authenticate drivers by Employee ID and return their routes,
 * without requiring the driver to have a login account.
 */
class AddDriverStaffIdToTransportRoutes extends Migration
{
    public function up(): void
    {
        $this->db->query(
            'ALTER TABLE transport_routes ADD COLUMN driver_staff_id VARCHAR(36) NULL AFTER driver_user_id'
        );
    }

    public function down(): void
    {
        $this->db->query('ALTER TABLE transport_routes DROP COLUMN driver_staff_id');
    }
}
