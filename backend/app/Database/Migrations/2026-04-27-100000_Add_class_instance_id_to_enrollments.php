<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds class_instance_id FK column to the enrollments table.
 *
 * Pre-feature enrollments retain class_id only (class_instance_id NULL).
 * Post-feature enrollments created by the migration engine will have BOTH
 * class_id AND class_instance_id populated for backward-compatibility.
 */
class AddClassInstanceIdToEnrollments extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('enrollments', [
            'class_instance_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'after'      => 'class_id',
                'comment'    => 'FK to class_instances.id; NULL for legacy pre-feature rows',
            ],
        ]);

        // Index for fast lookups by instance
        $this->db->query('ALTER TABLE enrollments ADD INDEX idx_enrollments_class_instance_id (class_instance_id)');

        // FK constraint: SET NULL on instance delete to preserve enrollment history
        $this->db->query(
            'ALTER TABLE enrollments
             ADD CONSTRAINT fk_enrollments_class_instance
             FOREIGN KEY (class_instance_id) REFERENCES class_instances(id)
             ON DELETE SET NULL ON UPDATE CASCADE'
        );
    }

    public function down(): void
    {
        // Drop FK first, then index, then column
        $this->db->query('ALTER TABLE enrollments DROP FOREIGN KEY fk_enrollments_class_instance');
        $this->db->query('ALTER TABLE enrollments DROP INDEX idx_enrollments_class_instance_id');
        $this->forge->dropColumn('enrollments', 'class_instance_id');
    }
}
