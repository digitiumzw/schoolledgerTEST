<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddAdjustmentPaymentTracking extends Migration
{
    public function up(): void
    {
        if (! $this->db->fieldExists('paid_amount', 'ledger_adjustments')) {
            $this->forge->addColumn('ledger_adjustments', [
                'paid_amount' => [
                    'type' => 'DECIMAL',
                    'constraint' => '10,2',
                    'default' => 0,
                    'after' => 'amount',
                ],
            ]);
        }

        if (! $this->db->fieldExists('payment_status', 'ledger_adjustments')) {
            $this->forge->addColumn('ledger_adjustments', [
                'payment_status' => [
                    'type' => 'ENUM',
                    'constraint' => ['unpaid', 'partial', 'paid'],
                    'default' => 'unpaid',
                    'after' => 'paid_amount',
                ],
            ]);
        }

        if (! $this->db->fieldExists('paid_at', 'ledger_adjustments')) {
            $this->forge->addColumn('ledger_adjustments', [
                'paid_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
                    'after' => 'payment_status',
                ],
            ]);
        }

        try {
            $this->forge->addKey(['tenant_id', 'student_id', 'adjustment_type', 'payment_status'], false, false, 'idx_adj_payment_status');
            $this->forge->processIndexes('ledger_adjustments');
        } catch (\Throwable $e) {
        }
    }

    public function down(): void
    {
        try {
            $this->db->query('ALTER TABLE ledger_adjustments DROP INDEX idx_adj_payment_status');
        } catch (\Throwable $e) {
        }

        foreach (['paid_at', 'payment_status', 'paid_amount'] as $field) {
            if ($this->db->fieldExists($field, 'ledger_adjustments')) {
                $this->forge->dropColumn('ledger_adjustments', $field);
            }
        }
    }
}
