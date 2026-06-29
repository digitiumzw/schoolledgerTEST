<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateDemoRequests extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'school_name' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'email' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'school_address' => [
                'type'       => 'VARCHAR',
                'constraint' => 500,
                'null'       => false,
            ],
            'estimated_students' => [
                'type'       => 'INT',
                'constraint' => 10,
                'unsigned'   => true,
                'null'       => false,
                'default'    => 0,
            ],
            'status' => [
                'type'       => "ENUM('new','contacted','converted','dismissed')",
                'null'       => false,
                'default'    => 'new',
            ],
            'notes' => [
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

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('status');
        $this->forge->addKey('created_at');
        $this->forge->createTable('demo_requests');
    }

    public function down(): void
    {
        $this->forge->dropTable('demo_requests', true);
    }
}
