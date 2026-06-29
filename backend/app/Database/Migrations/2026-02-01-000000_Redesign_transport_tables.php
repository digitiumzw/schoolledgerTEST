<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Redesign Transport Tables
 *
 * Drops and recreates transport_routes and transport_assignments with:
 * - pickup_points (JSON) on routes
 * - driver_user_id (nullable FK to users) on routes
 * - per-student pickup_point / drop_point on assignments
 * - simple status (active/inactive) on assignments instead of month/access
 *
 * Also adds 'driver' to the users.role ENUM.
 */
class RedesignTransportTables extends Migration
{
    public function up()
    {
        // ── 1. Drop old tables ────────────────────────────────────────────────
        $this->forge->dropTable('transport_assignments', true);
        $this->forge->dropTable('transport_routes', true);

        // ── 2. New transport_routes ───────────────────────────────────────────
        $this->forge->addField([
            'id'             => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id'      => ['type' => 'VARCHAR', 'constraint' => 50],
            'route_name'     => ['type' => 'VARCHAR', 'constraint' => 200],
            'pickup_points'  => ['type' => 'JSON',    'null' => true],  // JSON array of stop names
            'vehicle'        => ['type' => 'VARCHAR', 'constraint' => 100],
            'driver_name'    => ['type' => 'VARCHAR', 'constraint' => 100],
            'driver_phone'   => ['type' => 'VARCHAR', 'constraint' => 50,  'null' => true, 'default' => null],
            'driver_user_id' => ['type' => 'VARCHAR', 'constraint' => 50,  'null' => true, 'default' => null],
            'monthly_fee'    => ['type' => 'DECIMAL', 'constraint' => '10,2'],
            'status'         => ['type' => 'ENUM',    'constraint' => ['active', 'inactive'], 'default' => 'active'],
            'created_at'     => ['type' => 'DATETIME','null' => true],
            'updated_at'     => ['type' => 'DATETIME','null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->createTable('transport_routes');

        // ── 3. New transport_assignments ──────────────────────────────────────
        $this->forge->addField([
            'id'           => ['type' => 'VARCHAR', 'constraint' => 100],
            'tenant_id'    => ['type' => 'VARCHAR', 'constraint' => 50],
            'student_id'   => ['type' => 'VARCHAR', 'constraint' => 50],
            'route_id'     => ['type' => 'VARCHAR', 'constraint' => 50],
            'pickup_point' => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true, 'default' => null],
            'drop_point'   => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true, 'default' => null],
            'start_date'   => ['type' => 'DATE',    'null' => true],
            'end_date'     => ['type' => 'DATE',    'null' => true, 'default' => null],
            'status'       => ['type' => 'ENUM',    'constraint' => ['active', 'inactive'], 'default' => 'active'],
            'created_at'   => ['type' => 'DATETIME','null' => true],
            'updated_at'   => ['type' => 'DATETIME','null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('student_id');
        $this->forge->addKey(['route_id', 'status']);
        $this->forge->createTable('transport_assignments');

        // ── 4. Add 'driver' to users.role ENUM ───────────────────────────────
        $this->forge->modifyColumn('users', [
            'role' => [
                'type'    => "ENUM('super_admin','admin','teacher','bursar','driver')",
                'null'    => false,
                'default' => 'teacher',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropTable('transport_assignments', true);
        $this->forge->dropTable('transport_routes', true);

        // Restore previous ENUM
        $this->forge->modifyColumn('users', [
            'role' => [
                'type'    => "ENUM('super_admin','admin','teacher','bursar')",
                'null'    => false,
                'default' => 'teacher',
            ],
        ]);
    }
}
