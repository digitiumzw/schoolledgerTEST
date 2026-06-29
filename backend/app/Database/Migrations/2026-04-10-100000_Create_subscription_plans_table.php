<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSubscriptionPlansTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => false,
            ],
            'description' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'max_students' => [
                'type'     => 'INT UNSIGNED',
                'null'     => true,
                'default'  => null,
            ],
            'monthly_price_cents' => [
                'type'       => 'INT UNSIGNED',
                'null'       => false,
                'default'    => 0,
            ],
            'annual_price_cents' => [
                'type'       => 'INT UNSIGNED',
                'null'       => false,
                'default'    => 0,
            ],
            'currency' => [
                'type'       => 'VARCHAR',
                'constraint' => 3,
                'null'       => false,
                'default'    => 'USD',
            ],
            'is_active' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'null'       => false,
                'default'    => 1,
            ],
            'sort_order' => [
                'type'    => 'INT',
                'null'    => false,
                'default' => 0,
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
        $this->forge->addKey('is_active');
        $this->forge->createTable('subscription_plans');
    }

    public function down()
    {
        $this->forge->dropTable('subscription_plans', true);
    }
}
