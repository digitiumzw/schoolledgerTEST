<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPaymentGroupIdToPayments extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('payments', [
            'payment_group_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => true,
                'default'    => null,
                'comment'    => 'Groups rows belonging to the same multi-category transaction. NULL for single-category payments.',
                'after'      => 'is_general_payment',
            ],
        ]);

        $this->db->query(
            'CREATE INDEX idx_payments_group ON payments (tenant_id, payment_group_id)'
        );
    }

    public function down(): void
    {
        $this->db->query('DROP INDEX idx_payments_group ON payments');
        $this->forge->dropColumn('payments', 'payment_group_id');
    }
}
