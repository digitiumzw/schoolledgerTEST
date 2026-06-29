<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * AddPlatformProductionIndexes — composite indexes for high-volume multi-tenant queries.
 *
 * Indexes added (data-model.md §3):
 *   A. payments.idx_payments_tenant_category  (tenant_id, category, date)
 *   B. charges.idx_charges_tenant_billing_run (tenant_id, billing_run_id, charge_type, amount)
 *   C. staff_attendance.idx_staff_attendance_tenant_date (tenant_id, date, status)
 *
 * Existing indexes skipped (already covered by earlier migrations):
 *   - students.idx_tenant_status             (tenant_id, status)          — 2025-12-30
 *   - payments.idx_payments_group            (tenant_id, payment_group_id) — 2026-05-04
 *   - charges.idx_charges_tenant_billing_type_void                         — 2026-05-06
 */
class AddPlatformProductionIndexes extends Migration
{
    private array $indexes = [
        ['table' => 'payments',         'name' => 'idx_payments_tenant_category',     'columns' => 'tenant_id, category, date'],
        ['table' => 'charges',          'name' => 'idx_charges_tenant_billing_run',   'columns' => 'tenant_id, billing_run_id, charge_type, amount'],
        ['table' => 'staff_attendance', 'name' => 'idx_staff_attendance_tenant_date', 'columns' => 'tenant_id, date, status'],
    ];

    public function up(): void
    {
        foreach ($this->indexes as $idx) {
            $exists = $this->db->query(
                "SHOW INDEX FROM `{$idx['table']}` WHERE Key_name = ?",
                [$idx['name']]
            )->getResultArray();

            if (empty($exists)) {
                $this->db->query(
                    "CREATE INDEX `{$idx['name']}` ON `{$idx['table']}` ({$idx['columns']})"
                );
            }
        }
    }

    public function down(): void
    {
        foreach ($this->indexes as $idx) {
            $exists = $this->db->query(
                "SHOW INDEX FROM `{$idx['table']}` WHERE Key_name = ?",
                [$idx['name']]
            )->getResultArray();

            if (!empty($exists)) {
                $this->db->query("DROP INDEX `{$idx['name']}` ON `{$idx['table']}`");
            }
        }
    }
}
