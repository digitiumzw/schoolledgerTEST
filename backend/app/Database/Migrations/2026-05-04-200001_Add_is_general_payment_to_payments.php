<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddIsGeneralPaymentToPayments extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('payments', [
            'is_general_payment' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
                'comment'    => '1 = user-defined category (non-ledger); 0 = system category (ledger)',
                'after'      => 'snapshot',
            ],
        ]);

        $this->db->query(
            'CREATE INDEX idx_payments_is_general ON payments (tenant_id, is_general_payment)'
        );
    }

    public function down(): void
    {
        $this->db->query('DROP INDEX idx_payments_is_general ON payments');
        $this->forge->dropColumn('payments', 'is_general_payment');
    }
}
