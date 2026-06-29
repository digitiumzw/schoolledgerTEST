<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSubscriptionInvoicesTable extends Migration
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
            'subscription_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'transaction_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'invoice_number' => [
                'type'       => 'VARCHAR',
                'constraint' => 30,
                'null'       => false,
            ],
            'school_name' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'plan_name' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => false,
            ],
            'billing_cycle' => [
                'type'       => 'ENUM',
                'constraint' => ['monthly', 'annual'],
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
            'issued_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'pdf_path' => [
                'type'       => 'VARCHAR',
                'constraint' => 500,
                'null'       => true,
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
        $this->forge->addUniqueKey('transaction_id');
        $this->forge->addUniqueKey('invoice_number');
        $this->forge->addKey('tenant_id');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('subscription_id', 'school_subscriptions', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('transaction_id', 'subscription_payment_transactions', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('subscription_invoices');
    }

    public function down()
    {
        $this->forge->dropTable('subscription_invoices', true);
    }
}
