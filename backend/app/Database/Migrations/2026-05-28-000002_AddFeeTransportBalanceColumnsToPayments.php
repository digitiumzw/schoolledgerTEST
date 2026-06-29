<?php

use CodeIgniter\Database\Migration;

/**
 * Migration: Add fee_balance_after_payment and transport_balance_after_payment to payments table.
 *
 * Captures separate fee and transport balances at payment time for accurate receipt display.
 * Ensures transport payments show transport balance changes, fee payments show fee balance changes.
 */
class AddFeeTransportBalanceColumnsToPayments extends Migration
{
    public function up(): void
    {
        if (!$this->db->fieldExists('fee_balance_after_payment', 'payments')) {
            $this->forge->addColumn('payments', [
                'fee_balance_after_payment' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'null'       => true,
                    'default'    => null,
                    'after'      => 'balance_after_payment',
                    'comment'    => 'Fee-only balance after this payment (for receipt display)',
                ],
            ]);
        }

        if (!$this->db->fieldExists('transport_balance_after_payment', 'payments')) {
            $this->forge->addColumn('payments', [
                'transport_balance_after_payment' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'null'       => true,
                    'default'    => null,
                    'after'      => 'fee_balance_after_payment',
                    'comment'    => 'Transport-only balance after this payment (for receipt display)',
                ],
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->fieldExists('transport_balance_after_payment', 'payments')) {
            $this->forge->dropColumn('payments', 'transport_balance_after_payment');
        }

        if ($this->db->fieldExists('fee_balance_after_payment', 'payments')) {
            $this->forge->dropColumn('payments', 'fee_balance_after_payment');
        }
    }
}
