<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSystemErrorLogs extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => false,
            ],
            'correlation_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => true,
                'default'    => null,
            ],
            'user_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 36,
                'null'       => true,
                'default'    => null,
            ],
            'exception_class' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => false,
            ],
            'message' => [
                'type' => 'TEXT',
                'null' => false,
            ],
            'stack_trace' => [
                'type' => 'MEDIUMTEXT',
                'null' => false,
            ],
            'request_uri' => [
                'type'       => 'VARCHAR',
                'constraint' => 512,
                'null'       => false,
            ],
            'request_method' => [
                'type'       => 'VARCHAR',
                'constraint' => 10,
                'null'       => false,
            ],
            'ip_address' => [
                'type'       => 'VARCHAR',
                'constraint' => 45,
                'null'       => false,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('correlation_id', 'uq_error_correlation');
        $this->forge->addKey(['tenant_id', 'created_at'], false, false, 'idx_error_tenant_created');
        $this->forge->createTable('system_error_logs', true);
    }

    public function down(): void
    {
        $this->forge->dropTable('system_error_logs', true);
    }
}
