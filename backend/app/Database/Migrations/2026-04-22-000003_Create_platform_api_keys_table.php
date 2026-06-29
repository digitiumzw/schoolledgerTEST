<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePlatformApiKeysTable extends Migration
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
            'user_id' => [
                'type'       => 'BIGINT',
                'constraint' => 20,
                'unsigned'   => true,
                'null'       => false,
            ],
            'label' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'key_hash' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'key_prefix' => [
                'type'       => 'VARCHAR',
                'constraint' => 16,
                'null'       => false,
            ],
            'last_used_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'expires_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'revoked_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('key_hash');
        $this->forge->addKey('user_id');
        $this->forge->addKey('revoked_at');
        $this->forge->addForeignKey('user_id', 'platform_users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('platform_api_keys');
    }

    public function down(): void
    {
        $this->forge->dropTable('platform_api_keys', true);
    }
}
