<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Creates the class_instances table — the intersection of a class template
 * (classes row) and a specific academic year. This is the FK target for new
 * enrollments going forward.
 *
 * See specs/048-academic-year-enrollment-migration/ for full design.
 */
class CreateClassInstancesTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'class_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
                'comment'    => 'FK to classes.id (the template)',
            ],
            'academic_year' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => false,
                'comment'    => 'e.g. "2025/2026"',
            ],
            'teacher_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'comment'    => 'Year-specific override; NULL = inherit from class',
            ],
            'capacity' => [
                'type'    => 'INT',
                'null'    => false,
                'default' => 30,
            ],
            'is_final_class' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['tenant_id', 'class_id', 'academic_year'], 'uq_class_instances_template_year');
        $this->forge->addKey(['tenant_id', 'academic_year'], false, false, 'idx_class_instances_tenant_year');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE', 'fk_class_instances_tenant');
        $this->forge->addForeignKey('class_id', 'classes', 'id', 'CASCADE', 'CASCADE', 'fk_class_instances_class');

        $this->forge->createTable('class_instances');
    }

    public function down(): void
    {
        $this->forge->dropTable('class_instances', true);
    }
}
