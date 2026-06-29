<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddGradeFieldsToClasses extends Migration
{
    public function up()
    {
        $this->forge->addColumn('classes', [
            'grade_level_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'default'    => null,
                'after'      => 'name',
            ],
            'stream' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'default'    => null,
                'after'      => 'grade_level_id',
            ],
        ]);

        // Index for fast grade-level lookups
        $this->db->query('ALTER TABLE classes ADD INDEX idx_classes_grade_level_id (grade_level_id)');

        // FK: SET NULL so deleting a grade level does not cascade-delete its classes
        $this->forge->addForeignKey('grade_level_id', 'grade_levels', 'id', 'SET NULL', 'CASCADE', 'fk_classes_grade_level');
    }

    public function down()
    {
        // Drop FK first, then columns
        try {
            $this->db->query('ALTER TABLE classes DROP FOREIGN KEY fk_classes_grade_level');
        } catch (\Throwable $e) {
        }
        try {
            $this->db->query('ALTER TABLE classes DROP INDEX idx_classes_grade_level_id');
        } catch (\Throwable $e) {
        }
        $this->forge->dropColumn('classes', ['grade_level_id', 'stream']);
    }
}
