<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add Transport Constraints (Feature 054-transport-constraints)
 *
 * - Adds `is_active` generated column on transport_student_allocations
 *   (TINYINT(1): 1 when status='active', NULL otherwise) to enable a
 *   unique index that allows multiple historical (inactive) rows but
 *   prevents more than one active allocation per (tenant, student).
 * - Adds composite indexes to optimize stop validation and missing-charge
 *   detection queries.
 *
 * MySQL allows multiple NULL values in a UNIQUE index, so the partial-
 * uniqueness pattern is achieved via a generated column that is NULL for
 * inactive rows.
 */
class AddTransportConstraints extends Migration
{
    public function up(): void
    {
        // 1. Generated column for the unique-active constraint.
        //    NULL for inactive rows so unique index does not block historical records.
        $this->db->query(
            "ALTER TABLE transport_student_allocations
             ADD COLUMN is_active TINYINT(1) GENERATED ALWAYS AS
             (CASE WHEN status = 'active' THEN 1 ELSE NULL END) STORED"
        );

        // 2. Unique constraint: one active allocation per (tenant, student)
        $this->db->query(
            "ALTER TABLE transport_student_allocations
             ADD UNIQUE INDEX idx_unique_active_assignment
             (tenant_id, student_id, is_active)"
        );

        // 3. Index to speed up stop validation (stop belongs to route?)
        //    Only add if not already present.
        if (!$this->indexExists('transport_stops', 'idx_stop_route_lookup')) {
            $this->db->query(
                "ALTER TABLE transport_stops
                 ADD INDEX idx_stop_route_lookup (route_id, id)"
            );
        }

        // 4. Index to speed up missing-charge detection.
        if (!$this->indexExists('charges', 'idx_charge_lookup')) {
            $this->db->query(
                "ALTER TABLE charges
                 ADD INDEX idx_charge_lookup (student_id, charge_type, academic_session)"
            );
        }
    }

    public function down(): void
    {
        // Order matters: drop index that references the generated column first.
        if ($this->indexExists('transport_student_allocations', 'idx_unique_active_assignment')) {
            $this->db->query(
                "ALTER TABLE transport_student_allocations
                 DROP INDEX idx_unique_active_assignment"
            );
        }

        if ($this->db->fieldExists('is_active', 'transport_student_allocations')) {
            $this->db->query(
                "ALTER TABLE transport_student_allocations
                 DROP COLUMN is_active"
            );
        }

        if ($this->indexExists('transport_stops', 'idx_stop_route_lookup')) {
            $this->db->query(
                "ALTER TABLE transport_stops DROP INDEX idx_stop_route_lookup"
            );
        }

        if ($this->indexExists('charges', 'idx_charge_lookup')) {
            // Drop the FK that relies on this index before removing the index,
            // then recreate the FK on the plain student_id key that already exists.
            $this->db->query("ALTER TABLE charges DROP FOREIGN KEY charges_student_fk");
            $this->db->query("ALTER TABLE charges DROP INDEX idx_charge_lookup");
            $this->db->query(
                "ALTER TABLE charges ADD CONSTRAINT charges_student_fk
                 FOREIGN KEY (student_id) REFERENCES students(id)"
            );
        }
    }

    private function indexExists(string $table, string $indexName): bool
    {
        $result = $this->db->query(
            "SHOW INDEX FROM `{$table}` WHERE Key_name = ?",
            [$indexName]
        );
        return !empty($result->getResultArray());
    }
}
