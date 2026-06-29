<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add indexes for Financial Report generation performance.
 * These optimize the heavy date-range queries used by FinancialReportService.
 */
class AddFinancialReportIndexes extends Migration
{
    public function up()
    {
        // Charges: period filtering with tenant isolation
        $this->createIndexIfNotExists('charges', 'idx_charges_date_tenant',
            'date_generated, tenant_id, voided_at, deleted_at, charge_type');

        // Charges: category filtering for reports
        $this->createIndexIfNotExists('charges', 'idx_charges_category',
            'category, date_generated, tenant_id, voided_at');

        // Payments: period filtering with tenant isolation
        $this->createIndexIfNotExists('payments', 'idx_payments_date_tenant',
            'date, tenant_id, voided_at, is_general_payment');

        // Payments: method breakdown queries
        $this->createIndexIfNotExists('payments', 'idx_payments_method',
            'method, date, tenant_id, voided_at, is_general_payment');

        // Payments: category filtering for reports
        $this->createIndexIfNotExists('payments', 'idx_payments_category',
            'category, date, tenant_id, voided_at, is_general_payment');

        // Ledger adjustments: period filtering with status
        $this->createIndexIfNotExists('ledger_adjustments', 'idx_ledger_adj_date_tenant',
            'created_at, tenant_id, status, adjustment_type');

        // Students: class lookup for class-based filtering
        $this->createIndexIfNotExists('students', 'idx_students_class_tenant',
            'class_id, tenant_id, status');
    }

    private function createIndexIfNotExists(string $table, string $indexName, string $columns): void
    {
        $exists = $this->db->query(
            'SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
             WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
            [$table, $indexName]
        )->getRow()->cnt;

        if (!$exists) {
            $this->db->query("CREATE INDEX {$indexName} ON {$table}({$columns})");
        }
    }

    public function down()
    {
        $this->db->query('DROP INDEX IF EXISTS idx_charges_date_tenant ON charges');
        $this->db->query('DROP INDEX IF EXISTS idx_charges_category ON charges');
        $this->db->query('DROP INDEX IF EXISTS idx_payments_date_tenant ON payments');
        $this->db->query('DROP INDEX IF EXISTS idx_payments_method ON payments');
        $this->db->query('DROP INDEX IF EXISTS idx_payments_category ON payments');
        $this->db->query('DROP INDEX IF EXISTS idx_ledger_adj_date_tenant ON ledger_adjustments');
        $this->db->query('DROP INDEX IF EXISTS idx_students_class_tenant ON students');
    }
}
