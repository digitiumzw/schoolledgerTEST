<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePlatformSettingsTable extends Migration
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
            'key' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'value' => [
                'type' => 'JSON',
                'null' => false,
            ],
            'type' => [
                'type'       => 'ENUM',
                'constraint' => ['string', 'number', 'boolean', 'json'],
                'null'       => false,
            ],
            'description' => [
                'type' => 'TEXT',
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
        $this->forge->addUniqueKey('key');
        $this->forge->addKey('type');
        $this->forge->createTable('platform_settings');
    }

    public function down(): void
    {
        $this->forge->dropTable('platform_settings', true);
    }
}
