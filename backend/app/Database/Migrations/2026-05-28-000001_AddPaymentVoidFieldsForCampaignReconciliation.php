<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Migration: Add void/reconciliation fields to payments table.
 *
 * Adds soft-void support for campaign payment reconciliation:
 *   - voided_at   DATETIME NULL  — set when payment is voided; NULL = active
 *   - void_reason TEXT NULL      — required explanation recorded at void time
 *   - voided_by   VARCHAR(50) NULL — user ID who performed the void
 *
 * Original payment rows are NEVER deleted — voided_at acts as a soft-delete
 * marker so the full audit history is always preserved.
 *
 * Idempotent: guarded by fieldExists checks.
 */
class AddPaymentVoidFieldsForCampaignReconciliation extends Migration
{
    public function up(): void
    {
        if (!$this->db->fieldExists('voided_at', 'payments')) {
            $this->forge->addColumn('payments', [
                'voided_at' => [
                    'type'    => 'DATETIME',
                    'null'    => true,
                    'default' => null,
                    'after'   => 'snapshot',
                    'comment' => 'Set when payment is voided; NULL means active',
                ],
            ]);
        }

        if (!$this->db->fieldExists('void_reason', 'payments')) {
            $this->forge->addColumn('payments', [
                'void_reason' => [
                    'type'    => 'TEXT',
                    'null'    => true,
                    'after'   => 'voided_at',
                    'comment' => 'Required explanation when voiding a payment',
                ],
            ]);
        }

        if (!$this->db->fieldExists('voided_by', 'payments')) {
            $this->forge->addColumn('payments', [
                'voided_by' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'null'       => true,
                    'after'      => 'void_reason',
                    'comment'    => 'User ID who performed the void',
                ],
            ]);
        }

        // Index to efficiently filter active (non-voided) campaign payments
        $existing = $this->db->query(
            "SHOW INDEX FROM payments WHERE Key_name = 'idx_payments_campaign_void'"
        )->getResultArray();
        if (empty($existing)) {
            $this->db->query(
                'CREATE INDEX idx_payments_campaign_void ON payments(tenant_id, fee_campaign_id, voided_at)'
            );
        }
    }

    public function down(): void
    {
        try {
            $this->db->query('DROP INDEX idx_payments_campaign_void ON payments');
        } catch (\Throwable $e) {
        }

        foreach (['voided_by', 'void_reason', 'voided_at'] as $col) {
            if ($this->db->fieldExists($col, 'payments')) {
                $this->forge->dropColumn('payments', $col);
            }
        }
    }
}
