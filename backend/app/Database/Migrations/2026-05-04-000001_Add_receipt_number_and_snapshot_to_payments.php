<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add receipt_number and snapshot columns to the payments table.
 *
 * Feature: 057-payment-billing-ux
 *
 *   - receipt_number VARCHAR(25) NULL  Human-readable receipt identifier in
 *                                      format YYYY.MM.DD.HHmmss.X (X = random
 *                                      uppercase letter). Generated server-side
 *                                      in PaymentController::create().
 *   - snapshot       JSON NULL         Point-in-time snapshot of student/class
 *                                      data captured at payment creation.
 *                                      Ensures historical receipts remain
 *                                      accurate even if class is renamed later.
 *
 * Both columns are nullable to support legacy payments that predate this
 * migration. A unique index on (tenant_id, receipt_number) prevents receipt
 * number collisions within a tenant.
 *
 * Idempotent: guarded by fieldExists so re-runs are safe.
 */
class Add_receipt_number_and_snapshot_to_payments extends Migration
{
    public function up(): void
    {
        if (!$this->db->fieldExists('receipt_number', 'payments')) {
            $this->forge->addColumn('payments', [
                'receipt_number' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 25,
                    'null'       => true,
                    'default'    => null,
                    'after'      => 'balance_after_payment',
                    'comment'    => 'Receipt number in YYYY.MM.DD.HHmmss.X format',
                ],
            ]);
        }

        if (!$this->db->fieldExists('snapshot', 'payments')) {
            $this->forge->addColumn('payments', [
                'snapshot' => [
                    'type'    => 'JSON',
                    'null'    => true,
                    'after'   => 'receipt_number',
                    'comment' => 'Point-in-time student/class data snapshot',
                ],
            ]);
        }

        // Unique index for receipt number per tenant. Wrapped in try/catch
        // because MySQL 5.7 does not support IF NOT EXISTS on CREATE INDEX
        // and we need to remain idempotent.
        try {
            $this->db->query('
                CREATE UNIQUE INDEX uq_payments_receipt_number
                ON payments (tenant_id, receipt_number)
            ');
        } catch (\Throwable $e) {
            // Index may already exist — safe to ignore on re-run.
        }
    }

    public function down(): void
    {
        try {
            $this->db->query('DROP INDEX uq_payments_receipt_number ON payments');
        } catch (\Throwable $e) {
            // Index may not exist.
        }

        if ($this->db->fieldExists('snapshot', 'payments')) {
            $this->forge->dropColumn('payments', 'snapshot');
        }

        if ($this->db->fieldExists('receipt_number', 'payments')) {
            $this->forge->dropColumn('payments', 'receipt_number');
        }
    }
}
