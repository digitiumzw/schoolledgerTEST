<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateUserInvitationsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'invited_user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 64,
                'null'       => false,
            ],
            'email' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'role' => [
                'type'       => 'VARCHAR',
                'constraint' => 32,
                'null'       => false,
            ],
            'invited_by' => [
                'type'       => 'VARCHAR',
                'constraint' => 64,
                'null'       => false,
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
                'type'    => 'DATETIME',
                'null'    => true,
                'default' => null,
            ],
            'invalidated_at' => [
                'type'    => 'DATETIME',
                'null'    => true,
                'default' => null,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('token_hash', 'idx_ui_token_hash');
        $this->forge->addKey(['tenant_id', 'invited_user_id'], false, false, 'idx_ui_tenant_user');
        $this->forge->addKey(['email', 'tenant_id'], false, false, 'idx_ui_email_tenant');
        $this->forge->createTable('user_invitations');
    }

    public function down(): void
    {
        $this->forge->dropTable('user_invitations');
    }
}
