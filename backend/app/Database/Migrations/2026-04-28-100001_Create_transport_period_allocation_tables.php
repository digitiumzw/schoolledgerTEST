<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTransportPeriodAllocationTables extends Migration
{
    public function up(): void
    {
        // ── transport_route_periods ───────────────────────────────────────────
        // Links a vehicle + driver to a route for a given academic year.
        // Changing the vehicle or driver creates a new period, preserving history.
        $this->forge->addField([
            'id'            => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id'     => ['type' => 'VARCHAR', 'constraint' => 50],
            'route_id'      => ['type' => 'VARCHAR', 'constraint' => 50],
            'vehicle_id'    => ['type' => 'VARCHAR', 'constraint' => 50],
            'driver_id'     => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true, 'default' => null],
            'academic_year' => ['type' => 'VARCHAR', 'constraint' => 20],
            'start_date'    => ['type' => 'DATE', 'null' => true, 'default' => null],
            'end_date'      => ['type' => 'DATE', 'null' => true, 'default' => null],
            'status'        => ['type' => 'ENUM', 'constraint' => ['active', 'inactive'], 'default' => 'active'],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
            'updated_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['route_id', 'academic_year', 'status']);
        $this->forge->createTable('transport_route_periods');

        // ── transport_student_allocations ─────────────────────────────────────
        // Time-bound assignment of a student to a stop on a route.
        // Replaces transport_assignments with proper academic-year scoping
        // and normalized stop references.
        $this->forge->addField([
            'id'            => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id'     => ['type' => 'VARCHAR', 'constraint' => 50],
            'student_id'    => ['type' => 'VARCHAR', 'constraint' => 50],
            'route_id'      => ['type' => 'VARCHAR', 'constraint' => 50],
            'stop_id'       => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true, 'default' => null],
            'direction'     => ['type' => 'ENUM', 'constraint' => ['both', 'inbound', 'outbound'], 'default' => 'both'],
            'academic_year' => ['type' => 'VARCHAR', 'constraint' => 20],
            'start_date'    => ['type' => 'DATE', 'null' => true, 'default' => null],
            'end_date'      => ['type' => 'DATE', 'null' => true, 'default' => null],
            'status'        => ['type' => 'ENUM', 'constraint' => ['active', 'inactive'], 'default' => 'active'],
            'notes'         => ['type' => 'TEXT', 'null' => true, 'default' => null],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
            'updated_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('student_id');
        $this->forge->addKey(['route_id', 'academic_year', 'status']);
        $this->forge->createTable('transport_student_allocations');
    }

    public function down(): void
    {
        $this->forge->dropTable('transport_student_allocations', true);
        $this->forge->dropTable('transport_route_periods', true);
    }
}
