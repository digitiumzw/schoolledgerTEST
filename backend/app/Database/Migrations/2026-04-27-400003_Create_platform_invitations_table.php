<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePlatformInvitationsTable extends Migration
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
            'platform_user_id' => [
                'type'       => 'BIGINT',
                'constraint' => 20,
                'unsigned'   => true,
                'null'       => false,
            ],
            'invited_by' => [
                'type'       => 'BIGINT',
                'constraint' => 20,
                'unsigned'   => true,
                'null'       => true,
            ],
            'token_hash' => [
                'type'       => 'VARCHAR',
                'constraint' => 64,
                'null'       => false,
            ],
            'expires_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'accepted_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('token_hash');
        $this->forge->addKey('platform_user_id');
        $this->forge->addKey('expires_at');
        $this->forge->addForeignKey('platform_user_id', 'platform_users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('invited_by', 'platform_users', 'id', 'SET NULL', 'SET NULL');
        $this->forge->createTable('platform_invitations');
    }

    public function down(): void
    {
        $this->forge->dropTable('platform_invitations', true);
    }
}
