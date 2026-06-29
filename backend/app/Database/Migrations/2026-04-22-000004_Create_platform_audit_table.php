<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePlatformAuditTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type'           => 'BIGINT',
                'constraint'     => 20,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'actor_user_id' => [
                'type'       => 'BIGINT',
                'constraint' => 20,
                'unsigned'   => true,
                'null'       => true,
                'default'    => null,
            ],
            'action' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'target_type' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
            ],
            'target_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 100,
                'null'       => true,
            ],
            'details' => [
                'type' => 'JSON',
                'null' => true,
            ],
            'ip_address' => [
                'type'       => 'VARCHAR',
                'constraint' => 45,
                'null'       => true,
            ],
            'user_agent' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey('actor_user_id');
        $this->forge->addKey('action');
        $this->forge->addKey(['target_type', 'target_id']);
        $this->forge->addKey('created_at');
        $this->forge->addForeignKey('actor_user_id', 'platform_users', 'id', 'SET NULL', 'CASCADE');
        $this->forge->createTable('platform_audit');
    }

    public function down(): void
    {
        $this->forge->dropTable('platform_audit', true);
    }
}
