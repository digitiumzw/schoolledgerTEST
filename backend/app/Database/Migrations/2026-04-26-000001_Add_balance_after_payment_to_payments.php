<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddBalanceAfterPaymentToPayments extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('payments', [
            'balance_after_payment' => [
                'type'       => 'DECIMAL',
                'constraint' => '12,2',
                'null'       => true,
                'default'    => null,
                'after'      => 'route_id',
                'comment'    => 'Student ledger balance immediately after this payment was recorded',
            ],
        ]);
    }

    public function down(): void
    {
        if ($this->db->fieldExists('balance_after_payment', 'payments')) {
            $this->forge->dropColumn('payments', 'balance_after_payment');
        }
    }
}
