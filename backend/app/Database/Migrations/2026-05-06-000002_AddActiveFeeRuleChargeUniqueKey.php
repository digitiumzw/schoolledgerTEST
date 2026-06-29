<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddActiveFeeRuleChargeUniqueKey extends Migration
{
    public function up(): void
    {
        $oldIndex = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'uq_charges_student_rule_period'")->getResultArray();
        if (!empty($oldIndex)) {
            $this->db->query('DROP INDEX uq_charges_student_rule_period ON charges');
        }

        $lookupIndex = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_active_rule_period_lookup'")->getResultArray();
        if (empty($lookupIndex)) {
            $this->db->query('CREATE INDEX idx_charges_active_rule_period_lookup ON charges(tenant_id, student_id, fee_rule_id, billing_period, voided_at)');
        }
    }

    public function down(): void
    {
        $lookupIndex = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_active_rule_period_lookup'")->getResultArray();
        if (!empty($lookupIndex)) {
            $this->db->query('DROP INDEX idx_charges_active_rule_period_lookup ON charges');
        }

        $oldIndex = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'uq_charges_student_rule_period'")->getResultArray();
        if (empty($oldIndex)) {
            try {
                $this->db->query('CREATE UNIQUE INDEX uq_charges_student_rule_period ON charges(student_id, fee_rule_id, billing_period)');
            } catch (\Throwable $e) {
            }
        }
    }
}
