<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add performance indexes to ledger_adjustments.
 *
 * idx_adj_status  — speeds up balance queries filtering approved credits/debits
 *                   by (tenant_id, student_id, status)
 * idx_adj_date    — speeds up audit queries by (student_id, effective_date)
 */
class Add_adjustment_indexes extends Migration
{
    public function up(): void
    {
        $this->forge->addKey(['tenant_id', 'student_id', 'status'], false, false, 'idx_adj_status');
        $this->forge->processIndexes('ledger_adjustments');

        $this->forge->addKey(['student_id', 'effective_date'], false, false, 'idx_adj_effective_date');
        $this->forge->processIndexes('ledger_adjustments');
    }

    public function down(): void
    {
        try {
            $this->db->query('ALTER TABLE ledger_adjustments DROP INDEX idx_adj_status');
        } catch (\Throwable $e) {
        }
        try {
            $this->db->query('ALTER TABLE ledger_adjustments DROP INDEX idx_adj_effective_date');
        } catch (\Throwable $e) {
        }
    }
}
