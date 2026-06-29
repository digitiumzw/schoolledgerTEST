<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Create the onboarding_progress table.
 *
 * Tracks per-admin-user wizard progress, supporting resume-on-return behaviour.
 * One row per admin user (UNIQUE on user_id). The completed_steps JSON column
 * records which wizard steps have been finished; current_step records where the
 * admin should resume.
 *
 * Feature: 043-school-creation-onboarding
 */
class CreateOnboardingProgressTable extends Migration
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
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
            ],
            'current_step' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => false,
                'default'    => 'password',
            ],
            'completed_steps' => [
                'type' => 'JSON',
                'null' => false,
            ],
            'step_data' => [
                'type' => 'JSON',
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
        $this->forge->addUniqueKey('user_id');
        $this->forge->addKey('tenant_id');
        $this->forge->addForeignKey('user_id', 'users', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('tenant_id', 'tenants', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('onboarding_progress');
    }

    public function down(): void
    {
        $this->forge->dropTable('onboarding_progress', true);
    }
}
