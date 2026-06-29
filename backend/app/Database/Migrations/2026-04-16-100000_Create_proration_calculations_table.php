<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateProrationCalculationsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'original_subscription_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'new_subscription_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => true,
                'default'    => null,
            ],
            'original_plan_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'new_plan_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'billing_cycle' => [
                'type'       => 'ENUM',
                'constraint' => ['monthly', 'annual'],
                'null'       => false,
            ],
            'cycle_start_date' => [
                'type' => 'DATE',
                'null' => false,
            ],
            'cycle_end_date' => [
                'type' => 'DATE',
                'null' => false,
            ],
            'days_in_cycle' => [
                'type' => 'INT',
                'null' => false,
            ],
            'days_remaining' => [
                'type' => 'INT',
                'null' => false,
            ],
            'original_plan_price_cents' => [
                'type' => 'INT',
                'null' => false,
            ],
            'new_plan_price_cents' => [
                'type' => 'INT',
                'null' => false,
            ],
            'unused_value_credit_cents' => [
                'type' => 'INT',
                'null' => false,
            ],
            'prorated_charge_cents' => [
                'type' => 'INT',
                'null' => false,
            ],
            'net_amount_cents' => [
                'type' => 'INT',
                'null' => false,
            ],
            'calculation_formula' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['calculated', 'confirmed', 'cancelled', 'failed'],
                'null'       => false,
                'default'    => 'calculated',
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'confirmed_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'cancelled_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey(['tenant_id', 'created_at']);
        $this->forge->addKey('original_subscription_id');
        $this->forge->createTable('proration_calculations');
    }

    public function down()
    {
        $this->forge->dropTable('proration_calculations', true);
    }
}
