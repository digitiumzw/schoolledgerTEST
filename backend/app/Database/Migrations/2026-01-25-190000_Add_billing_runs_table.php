<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add billing_runs table and update charges for billing run tracking
 * 
 * Billing runs track each billing generation with:
 * - Term and academic year association
 * - Status tracking (pending, completed, voided)
 * - Confirmation notes
 * - Rollback capability
 */
class AddBillingRunsTable extends Migration
{
    public function up()
    {
        // Create billing_runs table
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'term_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'academic_year' => [
                'type' => 'VARCHAR',
                'constraint' => 20,
                'comment' => 'e.g., 2025-2026',
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['pending', 'completed', 'voided'],
                'default' => 'pending',
            ],
            'total_students' => [
                'type' => 'INT',
                'default' => 0,
            ],
            'excluded_students' => [
                'type' => 'INT',
                'default' => 0,
            ],
            'total_amount' => [
                'type' => 'DECIMAL',
                'constraint' => '12,2',
                'default' => 0,
            ],
            'fee_breakdown' => [
                'type' => 'JSON',
                'null' => true,
                'comment' => 'Detailed breakdown of fees by class/category',
            ],
            'confirmation_notes' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'confirmed_by' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'confirmed_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'voided_by' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'voided_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'void_reason' => [
                'type' => 'TEXT',
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
        $this->forge->addKey(['tenant_id', 'term_id']);
        $this->forge->addKey(['tenant_id', 'academic_year']);
        $this->forge->createTable('billing_runs', true);

        // Add billing_run_id to charges table if not exists
        if (!$this->db->fieldExists('billing_run_id', 'charges')) {
            $this->forge->addColumn('charges', [
                'billing_run_id' => [
                    'type' => 'VARCHAR',
                    'constraint' => 50,
                    'null' => true,
                    'after' => 'generation_batch_id',
                ],
            ]);
        }

        // Add academic_year to charges table if not exists
        if (!$this->db->fieldExists('academic_year', 'charges')) {
            $this->forge->addColumn('charges', [
                'academic_year' => [
                    'type' => 'VARCHAR',
                    'constraint' => 20,
                    'null' => true,
                    'after' => 'term_id',
                ],
            ]);
        }

        // Add voided_at column to charges for proper voiding
        if (!$this->db->fieldExists('voided_at', 'charges')) {
            $this->forge->addColumn('charges', [
                'voided_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
                    'after' => 'deleted_at',
                ],
                'voided_by' => [
                    'type' => 'VARCHAR',
                    'constraint' => 50,
                    'null' => true,
                    'after' => 'voided_at',
                ],
            ]);
        }

        // Add indexes
        $indexes = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_billing_run'")->getResultArray();
        if (empty($indexes)) {
            $this->db->query('CREATE INDEX idx_charges_billing_run ON charges(billing_run_id)');
        }
    }

    public function down()
    {
        // Drop indexes
        $indexes = $this->db->query("SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_billing_run'")->getResultArray();
        if (!empty($indexes)) {
            $this->db->query('DROP INDEX idx_charges_billing_run ON charges');
        }

        // Drop columns from charges
        if ($this->db->fieldExists('billing_run_id', 'charges')) {
            $this->forge->dropColumn('charges', 'billing_run_id');
        }
        if ($this->db->fieldExists('academic_year', 'charges')) {
            $this->forge->dropColumn('charges', 'academic_year');
        }
        if ($this->db->fieldExists('voided_at', 'charges')) {
            $this->forge->dropColumn('charges', 'voided_at');
        }
        if ($this->db->fieldExists('voided_by', 'charges')) {
            $this->forge->dropColumn('charges', 'voided_by');
        }

        // Drop billing_runs table
        $this->forge->dropTable('billing_runs', true);
    }
}
