<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class DeactivateFreePlan extends Migration
{
    public function up()
    {
        $this->db->query('SET FOREIGN_KEY_CHECKS=0');

        // 1. Deactivate the free plan
        $this->db->table('subscription_plans')
            ->where('id', 'free')
            ->update(['is_active' => 0]);

        // 2. Rename 'standard' → 'starter' (plan parent and subscription child together)
        $this->db->table('school_subscriptions')
            ->where('plan_id', 'standard')
            ->update(['plan_id' => 'starter']);

        $this->db->table('subscription_plans')
            ->where('id', 'standard')
            ->update(['id' => 'starter', 'name' => 'Starter']);

        // 3. Rename 'advanced' → 'growth'
        $this->db->table('school_subscriptions')
            ->where('plan_id', 'advanced')
            ->update(['plan_id' => 'growth']);

        $this->db->table('subscription_plans')
            ->where('id', 'advanced')
            ->update(['id' => 'growth', 'name' => 'Growth']);

        $this->db->query('SET FOREIGN_KEY_CHECKS=1');
    }

    public function down()
    {
        $this->db->query('SET FOREIGN_KEY_CHECKS=0');

        // Reverse: rename growth → advanced
        $this->db->table('school_subscriptions')
            ->where('plan_id', 'growth')
            ->update(['plan_id' => 'advanced']);

        $this->db->table('subscription_plans')
            ->where('id', 'growth')
            ->update(['id' => 'advanced', 'name' => 'Advanced']);

        // Reverse: rename starter → standard
        $this->db->table('school_subscriptions')
            ->where('plan_id', 'starter')
            ->update(['plan_id' => 'standard']);

        $this->db->table('subscription_plans')
            ->where('id', 'starter')
            ->update(['id' => 'standard', 'name' => 'Standard']);

        // Re-activate the free plan
        $this->db->table('subscription_plans')
            ->where('id', 'free')
            ->update(['is_active' => 1]);

        $this->db->query('SET FOREIGN_KEY_CHECKS=1');
    }
}
