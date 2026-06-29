<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Feature 061: Multi-category payments share a single receipt_number across
 * all rows in the group (identified by payment_group_id). The previous
 * UNIQUE constraint on (tenant_id, receipt_number) prevents this.
 *
 * Replace it with a non-unique index for query performance while allowing
 * duplicate receipt_number values within the same group.
 */
class RelaxReceiptNumberUniqueness extends Migration
{
    public function up(): void
    {
        // Drop the unique constraint added in feature 057
        $existing = $this->db->query(
            "SHOW INDEX FROM payments WHERE Key_name = 'uq_payments_receipt_number'"
        )->getResultArray();

        if (!empty($existing)) {
            $this->db->query('ALTER TABLE payments DROP INDEX uq_payments_receipt_number');
        }

        // Re-add as a plain non-unique index for lookup performance
        $this->db->query(
            'CREATE INDEX idx_payments_receipt_number ON payments (tenant_id, receipt_number)'
        );
    }

    public function down(): void
    {
        $existing = $this->db->query(
            "SHOW INDEX FROM payments WHERE Key_name = 'idx_payments_receipt_number'"
        )->getResultArray();

        if (!empty($existing)) {
            $this->db->query('ALTER TABLE payments DROP INDEX idx_payments_receipt_number');
        }

        // Restore the unique constraint (only safe if no grouped payments exist)
        $this->db->query(
            'ALTER TABLE payments ADD UNIQUE INDEX uq_payments_receipt_number (tenant_id, receipt_number)'
        );
    }
}
