<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSubscriptionTransactionsTable extends Migration
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
            'subscription_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'paynow_reference' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
            ],
            'paynow_poll_url' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'our_reference' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => false,
            ],
            'amount_cents' => [
                'type' => 'INT UNSIGNED',
                'null' => false,
            ],
            'currency' => [
                'type'       => 'VARCHAR',
                'constraint' => 3,
                'null'       => false,
                'default'    => 'USD',
            ],
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['initiated', 'paid', 'failed', 'cancelled', 'disputed'],
                'null'       => false,
                'default'    => 'initiated',
            ],
            'paynow_status_raw' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
            ],
            'paynow_hash_verified' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 0,
            ],
            'webhook_payload' => [
                'type' => 'JSON',
                'null' => true,
            ],
            'initiated_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'completed_at' => [
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
        $this->forge->addUniqueKey('our_reference');
        $this->forge->addKey(['tenant_id', 'status']);
        $this->forge->addKey('paynow_reference');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('subscription_id', 'school_subscriptions', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('subscription_payment_transactions');
    }

    public function down()
    {
        $this->forge->dropTable('subscription_payment_transactions', true);
    }
}
