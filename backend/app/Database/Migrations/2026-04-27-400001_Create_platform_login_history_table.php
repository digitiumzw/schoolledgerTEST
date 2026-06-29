<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePlatformLoginHistoryTable extends Migration
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
                'null'       => true,
                'default'    => null,
            ],
            'email_attempted' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
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
            'outcome' => [
                'type'       => 'ENUM',
                'constraint' => ['success', 'failed'],
                'null'       => false,
            ],
            'failure_reason' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);

        $this->forge->addKey('id', true);
        $this->forge->addKey('platform_user_id');
        $this->forge->addKey('created_at');
        $this->forge->addForeignKey('platform_user_id', 'platform_users', 'id', 'SET NULL', 'CASCADE');
        $this->forge->createTable('platform_login_history');
    }

    public function down(): void
    {
        $this->forge->dropTable('platform_login_history', true);
    }
}
