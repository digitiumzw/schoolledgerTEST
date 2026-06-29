<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add a composite index on billing_runs(tenant_id, term_id, status).
 *
 * This supports the application-level unique check that prevents two active
 * (non-voided) billing runs for the same tenant + term combination.
 * The idempotency check in LedgerController::finalizeBilling() queries:
 *   WHERE tenant_id = ? AND term_id = ? AND status != 'voided'
 * This index makes that lookup fast.
 *
 * Note: A true DB UNIQUE constraint is not added because multiple 'voided'
 * runs for the same term must be allowed (re-billing after void). The uniqueness
 * is enforced at the application layer with a 409 response.
 */
class Add_billing_run_unique_constraint extends Migration
{
    public function up(): void
    {
        $this->forge->addKey(['tenant_id', 'term_id', 'status'], false, false, 'idx_billing_runs_tenant_term_status');
        $this->forge->processIndexes('billing_runs');
    }

    public function down(): void
    {
        $this->db->query('ALTER TABLE billing_runs DROP INDEX idx_billing_runs_tenant_term_status');
    }
}
