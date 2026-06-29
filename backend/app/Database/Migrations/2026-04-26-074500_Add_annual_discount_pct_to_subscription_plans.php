<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddAnnualDiscountPctToSubscriptionPlans extends Migration
{
    public function up()
    {
        $this->forge->addColumn('subscription_plans', [
            'annual_discount_pct' => [
                'type'       => 'DECIMAL',
                'constraint' => '5,2',
                'null'       => false,
                'default'    => 17.00,
                'after'      => 'annual_price_cents',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('subscription_plans', 'annual_discount_pct');
    }
}
