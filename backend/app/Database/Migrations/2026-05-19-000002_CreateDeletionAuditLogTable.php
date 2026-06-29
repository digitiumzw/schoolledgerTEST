<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateDeletionAuditLogTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 36,
                'null' => false,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => false,
                'comment' => 'Reference to tenant (retained as ID even after tenant deleted)',
            ],
            'requested_by_email' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => false,
                'comment' => 'Email of admin who requested deletion',
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['requested', 'canceled', 'completed'],
                'null' => false,
                'default' => 'requested',
                'comment' => 'Audit status of the deletion lifecycle',
            ],
            'requested_at' => [
                'type' => 'DATETIME',
                'null' => false,
                'comment' => 'When deletion was requested',
            ],
            'completed_at' => [
                'type' => 'DATETIME',
                'null' => true,
                'comment' => 'When deletion was completed (or canceled); NULL if still pending',
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

        // Indexes for querying
        $this->forge->addKey('tenant_id', false, false, 'idx_audit_tenant_id');
        $this->forge->addKey('status', false, false, 'idx_audit_status');
        $this->forge->addKey('requested_at', false, false, 'idx_audit_requested_at');
        $this->forge->addKey(['tenant_id', 'requested_at'], false, false, 'idx_audit_tenant_requested');

        $this->forge->createTable('deletion_audit_log');
    }

    public function down(): void
    {
        $this->forge->dropTable('deletion_audit_log', true);
    }
}
