<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPlatformFieldsToTenants extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('tenants', [
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'default'    => null,
                'after'      => 'id',
            ],
            'email' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'default'    => null,
                'after'      => 'name',
            ],
            'subdomain' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
                'default'    => null,
                'after'      => 'email',
            ],
            'status' => [
                'type'       => 'ENUM',
                'constraint' => ['active', 'suspended', 'trialing'],
                'null'       => false,
                'default'    => 'active',
                'after'      => 'subdomain',
            ],
        ]);

        // Backfill name from settings JSON
        $this->db->query("
            UPDATE tenants
            SET name = JSON_UNQUOTE(JSON_EXTRACT(settings, '$.schoolName'))
            WHERE settings IS NOT NULL
              AND JSON_EXTRACT(settings, '$.schoolName') IS NOT NULL
        ");

        // Backfill email from first admin user per tenant
        $this->db->query("
            UPDATE tenants t
            INNER JOIN (
                SELECT tenant_id, MIN(email) AS admin_email
                FROM users
                WHERE role IN ('admin', 'super_admin')
                GROUP BY tenant_id
            ) u ON u.tenant_id = t.id
            SET t.email = u.admin_email
            WHERE t.email IS NULL
        ");
    }

    public function down(): void
    {
        $this->forge->dropColumn('tenants', ['name', 'email', 'subdomain', 'status']);
    }
}
