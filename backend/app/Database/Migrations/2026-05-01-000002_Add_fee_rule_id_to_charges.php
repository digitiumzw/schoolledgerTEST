<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add fee_rule_id and billing_period columns to the charges table, plus a
 * UNIQUE constraint for per-rule deduplication and a supporting index for
 * the unbilled-student alert query.
 *
 * Feature: 056-fee-structure-billing
 *
 * billing_period format:
 *   - Monthly cycle: "YYYY-MM"  (e.g. "2026-04")
 *   - Termly cycle:  term_id    (e.g. "term-1-2025")
 *
 * The UNIQUE constraint (student_id, fee_rule_id, billing_period) prevents
 * duplicate charges for the same student/rule/period combo. NULL fee_rule_id
 * rows are exempt from the constraint (MySQL treats NULLs as distinct in
 * UNIQUE indexes) — this preserves backward compatibility with legacy charges
 * that pre-date this feature.
 */
class Add_fee_rule_id_to_charges extends Migration
{
    public function up(): void
    {
        $columnsToAdd = [];

        if (!$this->db->fieldExists('fee_rule_id', 'charges')) {
            $columnsToAdd['fee_rule_id'] = [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
                'after'      => 'billing_run_id',
            ];
        }

        if (!$this->db->fieldExists('billing_period', 'charges')) {
            $columnsToAdd['billing_period'] = [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
                'after'      => 'fee_rule_id',
                'comment'    => 'YYYY-MM (monthly) or term_id (termly)',
            ];
        }

        if (!empty($columnsToAdd)) {
            $this->forge->addColumn('charges', $columnsToAdd);
        }

        // UNIQUE key for per-rule deduplication (NULL fee_rule_id rows are exempt)
        $existing = $this->db->query(
            "SHOW INDEX FROM charges WHERE Key_name = 'uq_charges_student_rule_period'"
        )->getResultArray();
        if (empty($existing)) {
            $this->db->query(
                'CREATE UNIQUE INDEX uq_charges_student_rule_period '
                . 'ON charges (student_id, fee_rule_id, billing_period)'
            );
        }

        // Performance index for unbilled-student alert query
        $existing = $this->db->query(
            "SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_tenant_rule_period'"
        )->getResultArray();
        if (empty($existing)) {
            $this->db->query(
                'CREATE INDEX idx_charges_tenant_rule_period '
                . 'ON charges (tenant_id, fee_rule_id, billing_period)'
            );
        }
    }

    public function down(): void
    {
        // Drop indexes first
        $indexes = $this->db->query(
            "SHOW INDEX FROM charges WHERE Key_name = 'uq_charges_student_rule_period'"
        )->getResultArray();
        if (!empty($indexes)) {
            $this->db->query('DROP INDEX uq_charges_student_rule_period ON charges');
        }

        $indexes = $this->db->query(
            "SHOW INDEX FROM charges WHERE Key_name = 'idx_charges_tenant_rule_period'"
        )->getResultArray();
        if (!empty($indexes)) {
            $this->db->query('DROP INDEX idx_charges_tenant_rule_period ON charges');
        }

        // Drop columns
        if ($this->db->fieldExists('billing_period', 'charges')) {
            $this->forge->dropColumn('charges', 'billing_period');
        }
        if ($this->db->fieldExists('fee_rule_id', 'charges')) {
            $this->forge->dropColumn('charges', 'fee_rule_id');
        }
    }
}
