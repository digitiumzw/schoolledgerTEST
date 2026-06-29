<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddSubscriptionTransitionAuditFields extends Migration
{
    public function up()
    {
        if (!$this->db->fieldExists('change_type', 'proration_calculations')) {
            $this->forge->addColumn('proration_calculations', [
                'change_type' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'null'       => true,
                    'after'      => 'billing_cycle',
                ],
            ]);
        }

        if (!$this->db->fieldExists('policy_code', 'proration_calculations')) {
            $this->forge->addColumn('proration_calculations', [
                'policy_code' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 100,
                    'null'       => true,
                    'after'      => 'change_type',
                ],
            ]);
        }

        if (!$this->db->fieldExists('pending_plan_id', 'school_subscriptions')) {
            $this->forge->addColumn('school_subscriptions', [
                'pending_plan_id' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'null'       => true,
                    'after'      => 'plan_id',
                ],
            ]);
        }

        if (!$this->db->fieldExists('pending_change_effective_at', 'school_subscriptions')) {
            $this->forge->addColumn('school_subscriptions', [
                'pending_change_effective_at' => [
                    'type'  => 'DATETIME',
                    'null'  => true,
                    'after' => 'pending_plan_id',
                ],
            ]);
        }

        if (!$this->db->fieldExists('pending_change_type', 'school_subscriptions')) {
            $this->forge->addColumn('school_subscriptions', [
                'pending_change_type' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 50,
                    'null'       => true,
                    'after'      => 'pending_change_effective_at',
                ],
            ]);
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('policy_code', 'proration_calculations')) {
            $this->forge->dropColumn('proration_calculations', 'policy_code');
        }

        if ($this->db->fieldExists('change_type', 'proration_calculations')) {
            $this->forge->dropColumn('proration_calculations', 'change_type');
        }

        foreach (['pending_change_type', 'pending_change_effective_at', 'pending_plan_id'] as $field) {
            if ($this->db->fieldExists($field, 'school_subscriptions')) {
                $this->forge->dropColumn('school_subscriptions', $field);
            }
        }
    }
}
