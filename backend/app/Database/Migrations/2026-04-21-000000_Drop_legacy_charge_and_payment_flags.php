<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Drop legacy charge and payment flag columns.
 *
 * Removes the deprecated boolean flags that were superseded by the
 * `charges.charge_type` ENUM introduced in
 * `2026-01-29-120000_Improve_charges_schema` and backfilled by
 * `2026-04-08-000001_Backfill_charge_type_from_flags`.
 *
 * Columns dropped:
 *   - charges.is_fee_structure   (TINYINT(1) NULL)
 *   - charges.is_transport       (BOOLEAN DEFAULT 0)
 *   - payments.is_fee_structure  (TINYINT(1) NULL)
 *
 * Data in the dropped columns is discardable because `charge_type` (charges)
 * and `category` (payments) provide the equivalent semantics. The down()
 * method therefore restores the schema only, not the original values.
 *
 * See specs/039-eliminate-legacy-columns/research.md Decision 3 for the full
 * rationale.
 */
class Drop_legacy_charge_and_payment_flags extends Migration
{
    public function up()
    {
        // Idempotent drops: guard with fieldExists so re-runs are safe across
        // environments where this migration may have been applied manually.
        if ($this->db->fieldExists('is_fee_structure', 'charges')) {
            $this->forge->dropColumn('charges', 'is_fee_structure');
        }

        if ($this->db->fieldExists('is_transport', 'charges')) {
            $this->forge->dropColumn('charges', 'is_transport');
        }

        if ($this->db->fieldExists('is_fee_structure', 'payments')) {
            $this->forge->dropColumn('payments', 'is_fee_structure');
        }
    }

    public function down()
    {
        // Restore the schema (without data) to match the definitions in
        // 2025-12-28-102246_CreateDBSchemas.php.
        if (!$this->db->fieldExists('is_fee_structure', 'charges')) {
            $this->forge->addColumn('charges', [
                'is_fee_structure' => [
                    'type'       => 'TINYINT',
                    'constraint' => 1,
                    'null'       => true,
                    'default'    => null,
                    'comment'    => '1 for fee structure charges, NULL for other charges',
                ],
            ]);
        }

        if (!$this->db->fieldExists('is_transport', 'charges')) {
            $this->forge->addColumn('charges', [
                'is_transport' => [
                    'type'    => 'BOOLEAN',
                    'default' => false,
                ],
            ]);
        }

        if (!$this->db->fieldExists('is_fee_structure', 'payments')) {
            $this->forge->addColumn('payments', [
                'is_fee_structure' => [
                    'type'       => 'TINYINT',
                    'constraint' => 1,
                    'null'       => true,
                    'default'    => null,
                ],
            ]);
        }
    }
}
