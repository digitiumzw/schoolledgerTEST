<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddActorSnapshotToPlatformAudit extends Migration
{
    public function up(): void
    {
        $this->forge->addColumn('platform_audit', [
            'actor_name' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'default'    => null,
                'after'      => 'actor_user_id',
            ],
            'actor_email' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'default'    => null,
                'after'      => 'actor_name',
            ],
        ]);

        $db = \Config\Database::connect();
        $db->query('CREATE INDEX idx_platform_audit_actor_email ON platform_audit (actor_email)');
    }

    public function down(): void
    {
        $db = \Config\Database::connect();
        $db->query('DROP INDEX idx_platform_audit_actor_email ON platform_audit');
        $this->forge->dropColumn('platform_audit', ['actor_name', 'actor_email']);
    }
}
