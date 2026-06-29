<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Add deleted_school_name to tenants for tombstone preservation.
 *
 * When a tenant is permanently deleted, the original school name is preserved
 * in this column for analytics and billing history purposes before the settings
 * JSON (which contains the school name) is cleared.
 */
class AddDeletedSchoolNameToTenants extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('tenants', [
            'deleted_school_name' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'default'    => null,
                'comment'    => 'Preserved school name when tenant is deleted for analytics/billing history',
                'after'      => 'permanently_deleted_at',
            ],
        ]);
    }

    public function down(): void
    {
        $this->forge->dropColumn('tenants', 'deleted_school_name');
    }
}
