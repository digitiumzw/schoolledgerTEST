<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class RemoveSubscriptionFields extends Migration
{
    public function up()
    {
        // Remove subscription columns from tenants table if they exist
        $fields = $this->db->getFieldData('tenants');
        $columnNames = array_map(function($field) { return $field->name; }, $fields);
        
        if (in_array('subscription_plan_id', $columnNames)) {
            $this->forge->dropColumn('tenants', 'subscription_plan_id');
        }
        if (in_array('subscription_status', $columnNames)) {
            $this->forge->dropColumn('tenants', 'subscription_status');
        }
        if (in_array('current_period_end', $columnNames)) {
            $this->forge->dropColumn('tenants', 'current_period_end');
        }
        
        // Drop subscription_plans table if it exists
        if ($this->db->tableExists('subscription_plans')) {
            $this->forge->dropTable('subscription_plans');
        }
    }

    public function down()
    {
        // Add back subscription columns to tenants table
        $this->forge->addColumn('tenants', [
            'subscription_plan_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'default' => 'plan_2',
            ],
            'subscription_status' => [
                'type' => 'ENUM',
                'constraint' => ['active', 'past_due', 'canceled', 'trialing'],
                'default' => 'active',
            ],
            'current_period_end' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        
        // Recreate subscription_plans table
        $this->forge->addField([
            'id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'name' => ['type' => 'VARCHAR', 'constraint' => 100],
            'tagline' => ['type' => 'VARCHAR', 'constraint' => 255],
            'ideal_for' => ['type' => 'TEXT'],
            'pricing' => ['type' => 'JSON'],
            'limits' => ['type' => 'JSON'],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->createTable('subscription_plans');
    }
}
