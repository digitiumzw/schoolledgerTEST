<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateOnboardingGuidanceTables extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => false],
            'current_step' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true],
            'step_statuses' => ['type' => 'JSON', 'null' => false],
            'dismissed_at' => ['type' => 'DATETIME', 'null' => true],
            'completed_at' => ['type' => 'DATETIME', 'null' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('tenant_id', 'unique_setup_guide_tenant');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE', 'fk_setup_guide_tenant');
        $this->forge->createTable('setup_guide_progress');

        $this->forge->addField([
            'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => false],
            'user_id' => ['type' => 'VARCHAR', 'constraint' => 50, 'null' => false],
            'status' => ['type' => 'VARCHAR', 'constraint' => 30, 'null' => false, 'default' => 'not_started'],
            'started_at' => ['type' => 'DATETIME', 'null' => true],
            'completed_at' => ['type' => 'DATETIME', 'null' => true],
            'dismissed_at' => ['type' => 'DATETIME', 'null' => true],
            'last_seen_step' => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'seen_module_keys' => ['type' => 'JSON', 'null' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey(['tenant_id', 'user_id'], 'unique_tutorial_tenant_user');
        $this->forge->addKey(['tenant_id', 'status'], false, false, 'idx_tutorial_tenant_status');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE', 'fk_tutorial_tenant');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE', 'fk_tutorial_user');
        $this->forge->createTable('user_tutorial_progress');
    }

    public function down(): void
    {
        $this->forge->dropTable('user_tutorial_progress', true);
        $this->forge->dropTable('setup_guide_progress', true);
    }
}
