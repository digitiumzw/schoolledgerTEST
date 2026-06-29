<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddChargeBatchRollbackFields extends Migration
{
    public function up(): void
    {
        if (!$this->db->fieldExists('charge_type', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'charge_type' => [
                    'type' => 'VARCHAR',
                    'constraint' => 30,
                    'default' => 'fee_structure',
                    'after' => 'tenant_id',
                ],
            ]);
        }

        if (!$this->db->fieldExists('period_key', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'period_key' => [
                    'type' => 'VARCHAR',
                    'constraint' => 50,
                    'null' => true,
                    'after' => 'academic_year',
                ],
            ]);
        }

        if (!$this->db->fieldExists('total_charges', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'total_charges' => [
                    'type' => 'INT',
                    'default' => 0,
                    'after' => 'total_students',
                ],
            ]);
        }

        if (!$this->db->fieldExists('period_label', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'period_label' => [
                    'type' => 'VARCHAR',
                    'constraint' => 80,
                    'null' => true,
                    'after' => 'period_key',
                ],
            ]);
        }

        if (!$this->db->fieldExists('description_label', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'description_label' => [
                    'type' => 'VARCHAR',
                    'constraint' => 120,
                    'null' => true,
                    'after' => 'period_label',
                ],
            ]);
        }

        if (!$this->db->fieldExists('generated_by', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'generated_by' => [
                    'type' => 'VARCHAR',
                    'constraint' => 50,
                    'null' => true,
                    'after' => 'description_label',
                ],
            ]);
        }

        if (!$this->db->fieldExists('generated_at', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'generated_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
                    'after' => 'generated_by',
                ],
            ]);
        }

        if (!$this->db->fieldExists('void_details', 'billing_runs')) {
            $this->forge->addColumn('billing_runs', [
                'void_details' => [
                    'type' => 'JSON',
                    'null' => true,
                    'after' => 'void_reason',
                ],
            ]);
        }

        $indexes = $this->db->query("SHOW INDEX FROM billing_runs WHERE Key_name = 'idx_billing_runs_latest_charge_type'")->getResultArray();
        if (empty($indexes)) {
            $this->db->query('CREATE INDEX idx_billing_runs_latest_charge_type ON billing_runs(tenant_id, charge_type, status, generated_at)');
        }

        $chargeIndexes = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_tenant_billing_type_void'")->getResultArray();
        if (empty($chargeIndexes)) {
            $this->db->query('CREATE INDEX idx_charges_tenant_billing_type_void ON charges(tenant_id, billing_run_id, charge_type, voided_at)');
        }

        if ($this->db->tableExists('reconciliation_audit_log')) {
            $this->db->query("ALTER TABLE reconciliation_audit_log MODIFY action_type ENUM('adjustment_created','adjustment_approved','adjustment_rejected','adjustment_voided','refund_initiated','refund_processed','refund_completed','refund_cancelled','balance_recalculated','charge_voided','payment_voided','manual_override','charge_batch_voided') NOT NULL");
            $this->db->query("ALTER TABLE reconciliation_audit_log MODIFY entity_type ENUM('adjustment','refund','charge','payment','student','billing_run') NOT NULL");
        }
    }

    public function down(): void
    {
        $indexes = $this->db->query("SHOW INDEX FROM billing_runs WHERE Key_name = 'idx_billing_runs_latest_charge_type'")->getResultArray();
        if (!empty($indexes)) {
            $this->db->query('DROP INDEX idx_billing_runs_latest_charge_type ON billing_runs');
        }

        $chargeIndexes = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_tenant_billing_type_void'")->getResultArray();
        if (!empty($chargeIndexes)) {
            $this->db->query('DROP INDEX idx_charges_tenant_billing_type_void ON charges');
        }

        if ($this->db->tableExists('reconciliation_audit_log')) {
            $this->db->query("ALTER TABLE reconciliation_audit_log MODIFY action_type ENUM('adjustment_created','adjustment_approved','adjustment_rejected','adjustment_voided','refund_initiated','refund_processed','refund_completed','refund_cancelled','balance_recalculated','charge_voided','payment_voided','manual_override') NOT NULL");
            $this->db->query("ALTER TABLE reconciliation_audit_log MODIFY entity_type ENUM('adjustment','refund','charge','payment','student') NOT NULL");
        }

        foreach (['void_details', 'generated_at', 'generated_by', 'description_label', 'period_label', 'period_key', 'total_charges', 'charge_type'] as $field) {
            if ($this->db->fieldExists($field, 'billing_runs')) {
                $this->forge->dropColumn('billing_runs', $field);
            }
        }
    }
}
