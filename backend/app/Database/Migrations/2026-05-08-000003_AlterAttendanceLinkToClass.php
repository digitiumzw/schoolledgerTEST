<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Refactor student attendance to link directly to classes instead of class instances.
 *
 * This allows attendance to be recorded against a class directly, while preserving
 * historical class_instance_id data for existing records.
 */
class AlterAttendanceLinkToClass extends Migration
{
    public function up(): void
    {
        // Make class_instance_id nullable to support class-direct attendance
        $this->forge->modifyColumn('student_attendance_events', [
            'class_instance_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'comment'    => 'FK to class_instances.id — optional, for historical records',
            ],
        ]);

        // Add new indexes for class-based queries
        $this->forge->addKey(['tenant_id', 'class_id', 'date'], false, false, 'idx_sae_tenant_class_date');
        $this->forge->addKey(['tenant_id', 'class_id', 'date', 'is_effective'], false, false, 'idx_sae_class_effective');
        $this->forge->addKey(['tenant_id', 'student_id', 'class_id'], false, false, 'idx_sae_tenant_student_class');

        // Drop the old foreign key constraint on class_instance_id (if exists)
        // Note: We'll keep the column but make the FK optional
        try {
            $this->forge->dropForeignKey('student_attendance_events', 'fk_sae_class_instance');
        } catch (\Exception $e) {
            // Key may not exist, continue
        }

        // Add nullable foreign key for class_instance_id
        $this->forge->addForeignKey('class_instance_id', 'class_instances', 'id', 'SET NULL', 'CASCADE', 'fk_sae_class_instance_nullable');

        // Add foreign key for class_id
        $this->forge->addForeignKey('class_id', 'classes', 'id', 'CASCADE', 'CASCADE', 'fk_sae_class');
    }

    public function down(): void
    {
        // Remove new foreign keys
        try {
            $this->forge->dropForeignKey('student_attendance_events', 'fk_sae_class');
        } catch (\Exception $e) {
            // Key may not exist
        }
        try {
            $this->forge->dropForeignKey('student_attendance_events', 'fk_sae_class_instance_nullable');
        } catch (\Exception $e) {
            // Key may not exist
        }

        // Remove new indexes
        $this->db->query('DROP INDEX IF EXISTS idx_sae_tenant_class_date ON student_attendance_events');
        $this->db->query('DROP INDEX IF EXISTS idx_sae_class_effective ON student_attendance_events');
        $this->db->query('DROP INDEX IF EXISTS idx_sae_tenant_student_class ON student_attendance_events');

        // Restore class_instance_id as NOT NULL (if there are no null values)
        $this->forge->modifyColumn('student_attendance_events', [
            'class_instance_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
                'comment'    => 'FK to class_instances.id — binds event to class × academic year',
            ],
        ]);

        // Restore original foreign key
        $this->forge->addForeignKey('class_instance_id', 'class_instances', 'id', 'CASCADE', 'CASCADE', 'fk_sae_class_instance');
    }
}
