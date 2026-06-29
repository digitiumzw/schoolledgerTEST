<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * One-time data backfill:
 *
 * Step 1: Create one class_instance row per unique (tenant_id, class_id,
 *         academic_session) combination found in the existing enrollments
 *         table, inheriting capacity / teacher / is_final_class from the
 *         current classes row.
 *
 * Step 2: Backfill enrollments.class_instance_id by joining on
 *         (class_id, academic_session) → (class_id, academic_year).
 *
 * Idempotent: uses INSERT IGNORE on Step 1 and only updates rows where
 * class_instance_id IS NULL on Step 2.
 */
class BackfillClassInstancesFromEnrollments extends Migration
{
    public function up(): void
    {
        // Step 1: Create class_instances for each historical (class_id, academic_session) pair.
        // Deterministic ID via MD5 ensures re-running produces the same IDs.
        $this->db->query("
            INSERT IGNORE INTO class_instances
                (id, tenant_id, class_id, academic_year, teacher_id, capacity, is_final_class, created_at, updated_at)
            SELECT
                CONCAT('ci_legacy_', SUBSTRING(MD5(CONCAT(e.class_id, '_', e.academic_session)), 1, 32)) AS id,
                e.tenant_id,
                e.class_id,
                e.academic_session AS academic_year,
                c.teacher_id,
                c.capacity,
                c.is_final_class,
                NOW(),
                NOW()
            FROM (
                SELECT DISTINCT tenant_id, class_id, academic_session
                FROM enrollments
                WHERE academic_session IS NOT NULL AND academic_session <> ''
            ) e
            INNER JOIN classes c ON c.id = e.class_id
        ");

        // Step 2: Backfill enrollments.class_instance_id where NULL.
        $this->db->query("
            UPDATE enrollments e
            INNER JOIN class_instances ci
                ON ci.tenant_id = e.tenant_id
               AND ci.class_id = e.class_id
               AND ci.academic_year = e.academic_session
            SET e.class_instance_id = ci.id
            WHERE e.class_instance_id IS NULL
        ");
    }

    public function down(): void
    {
        // Reverse Step 2 first: clear class_instance_id on rows pointing to legacy instances
        $this->db->query("
            UPDATE enrollments e
            INNER JOIN class_instances ci ON ci.id = e.class_instance_id
            SET e.class_instance_id = NULL
            WHERE ci.id LIKE 'ci_legacy_%'
        ");

        // Reverse Step 1: delete legacy-prefixed class_instance rows
        $this->db->query("DELETE FROM class_instances WHERE id LIKE 'ci_legacy_%'");
    }
}
