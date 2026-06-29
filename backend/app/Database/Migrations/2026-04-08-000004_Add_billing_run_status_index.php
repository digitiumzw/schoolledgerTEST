<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add index on billing_runs(tenant_id, status).
 *
 * Used by LedgerService::isBillingRunVoidable() and the idempotency check
 * in LedgerController::finalizeBilling() which look for non-voided billing runs
 * per tenant.
 */
class Add_billing_run_status_index extends Migration
{
    public function up(): void
    {
        $this->forge->addKey(['tenant_id', 'status'], false, false, 'idx_billing_runs_status');
        $this->forge->processIndexes('billing_runs');
    }

    public function down(): void
    {
        $this->db->query('ALTER TABLE billing_runs DROP INDEX idx_billing_runs_status');
    }
}
