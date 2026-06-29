<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTransportMasterTables extends Migration
{
    public function up(): void
    {
        // ── transport_vehicles ────────────────────────────────────────────────
        $this->forge->addField([
            'id'             => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id'      => ['type' => 'VARCHAR', 'constraint' => 50],
            'name'           => ['type' => 'VARCHAR', 'constraint' => 100],
            'reg_number'     => ['type' => 'VARCHAR', 'constraint' => 50,  'null' => true, 'default' => null],
            'type'           => ['type' => 'ENUM', 'constraint' => ['bus', 'minibus', 'van', 'other'], 'default' => 'bus'],
            'capacity'       => ['type' => 'INT', 'constraint' => 11, 'default' => 0],
            'status'         => ['type' => 'ENUM', 'constraint' => ['active', 'inactive'], 'default' => 'active'],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->createTable('transport_vehicles');

        // ── transport_stops ───────────────────────────────────────────────────
        $this->forge->addField([
            'id'             => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id'      => ['type' => 'VARCHAR', 'constraint' => 50],
            'route_id'       => ['type' => 'VARCHAR', 'constraint' => 50],
            'name'           => ['type' => 'VARCHAR', 'constraint' => 200],
            'pickup_time'    => ['type' => 'VARCHAR', 'constraint' => 10, 'null' => true, 'default' => null],
            'order_position' => ['type' => 'SMALLINT UNSIGNED', 'default' => 0],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['route_id', 'order_position']);
        $this->forge->createTable('transport_stops');

        // ── transport_drivers ─────────────────────────────────────────────────
        $this->forge->addField([
            'id'             => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id'      => ['type' => 'VARCHAR', 'constraint' => 50],
            'staff_id'       => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true, 'default' => null],
            'name'           => ['type' => 'VARCHAR', 'constraint' => 100],
            'phone'          => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true, 'default' => null],
            'license_number' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true, 'default' => null],
            'status'         => ['type' => 'ENUM', 'constraint' => ['active', 'inactive'], 'default' => 'active'],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->createTable('transport_drivers');
    }

    public function down(): void
    {
        $this->forge->dropTable('transport_drivers', true);
        $this->forge->dropTable('transport_stops', true);
        $this->forge->dropTable('transport_vehicles', true);
    }
}
