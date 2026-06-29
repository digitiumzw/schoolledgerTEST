<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class RemoveGradeLevelAndStreamFromClasses extends Migration
{
    public function up(): void
    {
        // Drop stream column from class_progression_mappings if it exists
        if ($this->db->fieldExists('stream', 'class_progression_mappings')) {
            $this->forge->dropColumn('class_progression_mappings', 'stream');
        }

        // Drop grade_level_id and stream columns from classes
        if ($this->db->fieldExists('grade_level_id', 'classes')) {
            $this->forge->dropColumn('classes', 'grade_level_id');
        }
        if ($this->db->fieldExists('stream', 'classes')) {
            $this->forge->dropColumn('classes', 'stream');
        }

        // Drop grade_levels table
        $this->forge->dropTable('grade_levels', true);
    }

    public function down(): void
    {
        // Recreate grade_levels table
        $this->forge->addField([
            'id'         => ['type' => 'VARCHAR', 'constraint' => 36, 'null' => false],
            'tenant_id'  => ['type' => 'VARCHAR', 'constraint' => 36, 'null' => false],
            'name'       => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => false],
            'sort_order' => ['type' => 'INT', 'constraint' => 11, 'default' => 0],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['tenant_id', 'sort_order']);
        $this->forge->createTable('grade_levels');

        // Restore grade_level_id and stream on classes
        $this->forge->addColumn('classes', [
            'grade_level_id' => ['type' => 'VARCHAR', 'constraint' => 36, 'null' => true, 'after' => 'name'],
            'stream'         => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true, 'after' => 'grade_level_id'],
        ]);

        // Restore stream on class_progression_mappings
        $this->forge->addColumn('class_progression_mappings', [
            'stream' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
        ]);
    }
}
