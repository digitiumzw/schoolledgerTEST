<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePasswordResetTokensTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'         => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'email'      => ['type' => 'VARCHAR', 'constraint' => 255],
            'token_hash' => ['type' => 'VARCHAR', 'constraint' => 64],
            'expires_at' => ['type' => 'DATETIME'],
            'used_at'    => ['type' => 'DATETIME', 'null' => true, 'default' => null],
            'created_at' => ['type' => 'DATETIME', 'default' => '0000-00-00 00:00:00'],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('email');
        $this->forge->addUniqueKey('token_hash');

        $this->forge->createTable('password_reset_tokens', true);
    }

    public function down(): void
    {
        $this->forge->dropTable('password_reset_tokens', true);
    }
}
