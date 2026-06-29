<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Feature 059-fee-campaign
 *
 * Creates the campaign_students table for per-student campaign payment tracking.
 * See: specs/059-fee-campaign/data-model.md
 */
class Create_campaign_students_table extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'tenant_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'fee_campaign_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'student_id' => [
                'type'       => 'VARCHAR',
                'constraint' => 50,
            ],
            'expected_amount' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,2',
            ],
            'paid_amount' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,2',
                'default'    => 0.00,
            ],
            'status' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'default'    => 'unpaid',
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);

        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('tenant_id', false, false, 'idx_cs_tenant_id');
        $this->forge->addKey('fee_campaign_id', false, false, 'idx_cs_campaign_id');
        $this->forge->addKey('student_id', false, false, 'idx_cs_student_id');
        $this->forge->addUniqueKey(['fee_campaign_id', 'student_id'], 'uq_cs_campaign_student');

        $this->forge->createTable('campaign_students');
    }

    public function down()
    {
        $this->forge->dropTable('campaign_students', true);
    }
}
