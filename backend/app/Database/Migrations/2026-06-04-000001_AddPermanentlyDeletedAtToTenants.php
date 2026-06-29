<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add permanently_deleted_at to tenants.
 *
 * When a tenant's grace period expires the system purges all operational data
 * but must retain platform-level records (subscriptions, proration, audit log,
 * KPI snapshots) for billing history and administrative reporting.
 *
 * Rather than hard-deleting the tenant row (which would cascade-delete those
 * preserved records via FK), the row is kept as a tombstone: PII is cleared,
 * permanently_deleted_at is stamped, and deletion_requested_at is nulled out
 * so the cron job will not attempt to re-process the tenant.
 */
class AddPermanentlyDeletedAtToTenants extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('tenants', [
            'permanently_deleted_at' => [
                'type'    => 'DATETIME',
                'null'    => true,
                'default' => null,
                'comment' => 'Set when operational data has been purged; row is kept as a tombstone for billing/audit references.',
                'after'   => 'deletion_requested_at',
            ],
        ]);

        $this->db->query(
            'CREATE INDEX idx_tenants_permanently_deleted_at ON tenants (permanently_deleted_at)'
        );
    }

    public function down(): void
    {
        $this->db->query(
            'DROP INDEX idx_tenants_permanently_deleted_at ON tenants'
        );
        $this->forge->dropColumn('tenants', 'permanently_deleted_at');
    }
}
