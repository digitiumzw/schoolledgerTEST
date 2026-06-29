<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Drop the legacy transport_assignments table.
 *
 * All historical data was migrated to transport_student_allocations in
 * migration 100002. All code that previously wrote to or read from this
 * table has been removed; the new allocation system is the sole source
 * of truth for student–route relationships.
 */
class DropTransportAssignmentsTable extends Migration
{
    public function up(): void
    {
        $this->forge->dropTable('transport_assignments', true);
    }

    public function down(): void
    {
        $this->forge->addField([
            'id'           => ['type' => 'VARCHAR', 'constraint' => 50],
            'tenant_id'    => ['type' => 'VARCHAR', 'constraint' => 50],
            'student_id'   => ['type' => 'VARCHAR', 'constraint' => 50],
            'route_id'     => ['type' => 'VARCHAR', 'constraint' => 50],
            'pickup_point' => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true, 'default' => null],
            'drop_point'   => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true, 'default' => null],
            'start_date'   => ['type' => 'DATE', 'null' => true, 'default' => null],
            'end_date'     => ['type' => 'DATE', 'null' => true, 'default' => null],
            'status'       => ['type' => 'ENUM', 'constraint' => ['active', 'inactive'], 'default' => 'active'],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
            'updated_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['student_id', 'status']);
        $this->forge->addKey(['route_id', 'status']);
        $this->forge->createTable('transport_assignments');
    }
}
