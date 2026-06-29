<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddBursaryDiscountToCharges extends Migration
{
    public function up(): void
    {
        if (!$this->db->fieldExists('bursary_discount_amount', 'charges')) {
            $this->forge->addColumn('charges', [
                'bursary_discount_amount' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '10,2',
                    'null'       => true,
                    'default'    => null,
                    'after'      => 'amount',
                ],
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->fieldExists('bursary_discount_amount', 'charges')) {
            $this->forge->dropColumn('charges', 'bursary_discount_amount');
        }
    }
}
