<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSchoolSubscriptionsTable extends Migration
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
            'plan_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'billing_cycle' => [
                'type'       => 'ENUM',
                'constraint' => ['monthly', 'annual'],
                'null'       => false,
            ],
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['pending', 'active', 'expired', 'superseded', 'cancelled'],
                'null'       => false,
                'default'    => 'pending',
            ],
            'starts_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'expires_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'amount_paid_cents' => [
                'type'    => 'INT UNSIGNED',
                'null'    => false,
                'default' => 0,
            ],
            'currency' => [
                'type'       => 'VARCHAR',
                'constraint' => 3,
                'null'       => false,
                'default'    => 'USD',
            ],
            'activated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'cancelled_at' => [
                'type' => 'DATETIME',
                'null' => true,
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
        $this->forge->addKey(['tenant_id', 'status']);
        $this->forge->addKey('expires_at');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('plan_id', 'subscription_plans', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('school_subscriptions');
    }

    public function down()
    {
        $this->forge->dropTable('school_subscriptions', true);
    }
}
