<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Creates the class_progression_mappings table — optional override layer for
 * non-linear promotion paths (e.g. stream-based branching). The migration
 * engine consults this table BEFORE falling back to classes.next_class_id.
 */
class CreateClassProgressionMappingsTable extends Migration
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
            'source_class_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
                'comment'    => 'FK to classes.id — the source template',
            ],
            'stream' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'comment'    => 'NULL = wildcard (applies to any stream)',
            ],
            'destination_class_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
                'comment'    => 'FK to classes.id — promotion target',
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
        $this->forge->addUniqueKey(['tenant_id', 'source_class_id', 'stream'], 'uq_progression_source_stream');
        $this->forge->addKey('tenant_id', false, false, 'idx_progression_tenant');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE', 'fk_progression_tenant');
        $this->forge->addForeignKey('source_class_id', 'classes', 'id', 'CASCADE', 'CASCADE', 'fk_progression_source');
        $this->forge->addForeignKey('destination_class_id', 'classes', 'id', 'CASCADE', 'CASCADE', 'fk_progression_dest');

        $this->forge->createTable('class_progression_mappings');
    }

    public function down(): void
    {
        $this->forge->dropTable('class_progression_mappings', true);
    }
}
