<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Feature 059-fee-campaign
 *
 * Creates the fee_campaigns table for event-based fee tracking.
 * See: specs/059-fee-campaign/data-model.md
 */
class Create_fee_campaigns_table extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
            ],
            'description' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'target_scope_type' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
            ],
            'target_scope_id' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'amount' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,2',
            ],
            'due_date' => [
                'type' => 'DATE',
                'null' => true,
            ],
            'status' => [
                'type'       => 'VARCHAR',
                'constraint' => 10,
                'default'    => 'active',
            ],
            'created_by' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('tenant_id', false, false, 'idx_fc_tenant_id');
        $this->forge->addUniqueKey(['tenant_id', 'name'], 'uq_fc_tenant_name');

        $this->forge->createTable('fee_campaigns');
    }

    public function down()
    {
        $this->forge->dropTable('fee_campaigns', true);
    }
}
