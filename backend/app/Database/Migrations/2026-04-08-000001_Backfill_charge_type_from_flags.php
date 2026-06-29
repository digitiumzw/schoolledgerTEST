<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Backfill charge_type ENUM from legacy boolean flag columns.
 *
 * After this migration, all rows in `charges` will have a non-NULL charge_type.
 * The boolean flag columns (is_fee_structure, is_transport) are NOT dropped here
 * — they are deprecated and will be removed in a future Phase B migration.
 *
 * Mapping:
 *   is_transport = 1              → charge_type = 'transport'
 *   is_fee_structure = 1          → charge_type = 'fee_structure'
 *   both NULL / 0                 → charge_type = 'other'
 *   charge_type already set       → unchanged
 *
 * down() is a no-op: data migrations are not reversible without a snapshot.
 */
class Backfill_charge_type_from_flags extends Migration
{
    public function up(): void
    {
        // Transport takes precedence over fee_structure when both flags are set
        $this->db->query("
            UPDATE charges
            SET charge_type = 'transport'
            WHERE (charge_type IS NULL OR charge_type = 'other')
              AND is_transport = 1
        ");

        $this->db->query("
            UPDATE charges
            SET charge_type = 'fee_structure'
            WHERE (charge_type IS NULL OR charge_type = 'other')
              AND is_fee_structure = 1
              AND (is_transport IS NULL OR is_transport = 0)
        ");

        $this->db->query("
            UPDATE charges
            SET charge_type = 'other'
            WHERE charge_type IS NULL
        ");
    }

    public function down(): void
    {
        // Not reversible — data migration only.
    }
}
