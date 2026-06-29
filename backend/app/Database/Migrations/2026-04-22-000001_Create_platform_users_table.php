<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePlatformUsersTable extends Migration
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
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'email' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'password_hash' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'platform_role' => [
                'type'       => 'ENUM',
                'constraint' => ['Owner', 'Admin', 'Finance', 'Support'],
                'null'       => false,
            ],
            'two_factor_secret' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'default'    => null,
            ],
            'two_factor_enabled' => [
                'type'    => 'TINYINT',
                'constraint' => 1,
                'null'    => false,
                'default' => 0,
            ],
            'last_login_at' => [
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
        $this->forge->addUniqueKey('email');
        $this->forge->addKey('platform_role');
        $this->forge->createTable('platform_users');
    }

    public function down(): void
    {
        $this->forge->dropTable('platform_users', true);
    }
}
