<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Create the fee_rules table.
 *
 * Feature: 056-fee-structure-billing
 *
 * Stores named billing instructions that the FeeRuleBillingService evaluates
 * during manual charge generation. Each rule has a name, fixed amount, and
 * assignment scope (school-wide, class, category, or service).
 *
 * Fee rules inherit the school's single configured billing cycle
 * (`tenants.fee_structure.structureType`) — they carry no per-rule frequency.
 */
class Create_fee_rules_table extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('fee_rules')) {
            return;
        }

        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'amount' => [
                'type'       => 'DECIMAL',
                'constraint' => '12,2',
                'null'       => false,
            ],
            'assignment_scope_type' => [
                'type'       => 'ENUM',
                'constraint' => ['school_wide', 'class', 'category', 'service'],
                'null'       => false,
            ],
            'assignment_scope_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'comment'    => 'FK-by-value: class.id, category key, or service key. NULL when scope = school_wide.',
            ],
            'is_active' => [
                'type'       => 'TINYINT',
                'constraint' => 1,
                'default'    => 1,
                'null'       => false,
            ],
            'created_by' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
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

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['tenant_id', 'name'], 'uq_fee_rules_tenant_name');
        $this->forge->addKey(['tenant_id', 'is_active'], false, false, 'idx_fee_rules_tenant_active');

        $this->forge->createTable('fee_rules', true);
    }

    public function down(): void
    {
        $this->forge->dropTable('fee_rules', true);
    }
}
