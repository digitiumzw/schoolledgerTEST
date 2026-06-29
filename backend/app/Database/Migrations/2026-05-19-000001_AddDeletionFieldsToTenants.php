<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDeletionFieldsToTenants extends Migration
{
    public function up(): void
    {
        // Add deletion_requested_at column to tenants table
        $this->forge->addColumn('tenants', [
            'deletion_requested_at' => [
                'type' => 'DATETIME',
                'null' => true,
                'comment' => 'Timestamp when deletion was requested; NULL if not requested',
                'after' => 'updated_at',
            ],
        ]);

        // Add indexes for efficient querying by cron job
        $this->forge->addKey('tenants', 'deletion_requested_at', false, false, 'idx_tenants_deletion_requested_at');
    }

    public function down(): void
    {
        // Remove the column
        $this->forge->dropColumn('tenants', 'deletion_requested_at');

        // Note: Dropping index is automatic when column is dropped in MySQL
    }
}
