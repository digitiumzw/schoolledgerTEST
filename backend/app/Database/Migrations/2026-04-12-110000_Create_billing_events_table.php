<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateBillingEventsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'event_type' => [
                'type'       => 'ENUM',
                'constraint' => [
                    'payment_confirmed',
                    'plan_activated',
                    'plan_upgraded',
                    'plan_downgraded',
                    'subscription_renewed',
                    'subscription_expired',
                ],
                'null' => false,
            ],
            'plan_name' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
            ],
            'billing_cycle' => [
                'type'       => 'ENUM',
                'constraint' => ['monthly', 'annual'],
                'null'       => true,
            ],
            'amount_cents' => [
                'type' => 'INT UNSIGNED',
                'null' => true,
            ],
            'currency' => [
                'type'       => 'VARCHAR',
                'constraint' => 3,
                'null'       => true,
            ],
            'subscription_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => true,
            ],
            'transaction_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => true,
            ],
            'occurred_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey(['tenant_id', 'occurred_at']);
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('billing_events');
    }

    public function down()
    {
        $this->forge->dropTable('billing_events', true);
    }
}
