<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSubscriptionCreditsTable extends Migration
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
            'proration_calculation_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => true,
                'default'    => null,
            ],
            'subscription_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'initial_amount_cents' => [
                'type' => 'INT',
                'null' => false,
            ],
            'remaining_amount_cents' => [
                'type' => 'INT',
                'null' => false,
            ],
            'currency' => [
                'type'       => 'VARCHAR',
                'constraint' => 3,
                'null'       => false,
                'default'    => 'USD',
            ],
            'reason' => [
                'type'       => 'ENUM',
                'constraint' => ['downgrade_proration', 'upgrade_discount', 'manual_adjustment'],
                'null'       => false,
            ],
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['active', 'fully_used', 'expired', 'refunded'],
                'null'       => false,
                'default'    => 'active',
            ],
            'expires_at' => [
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
        $this->forge->addKey('subscription_id');
        $this->forge->createTable('subscription_credits');
    }

    public function down()
    {
        $this->forge->dropTable('subscription_credits', true);
    }
}
