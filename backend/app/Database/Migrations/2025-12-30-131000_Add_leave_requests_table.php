<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddLeaveRequestsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'staff_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'leave_type' => [
                'type' => 'ENUM',
                'constraint' => ['sick', 'vacation', 'personal', 'maternity', 'paternity', 'unpaid'],
            ],
            'start_date' => [
                'type' => 'DATE',
            ],
            'end_date' => [
                'type' => 'DATE',
            ],
            'days' => [
                'type' => 'INT',
                'constraint' => 3,
            ],
            'reason' => [
                'type' => 'TEXT',
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['pending', 'approved', 'rejected'],
                'default' => 'pending',
            ],
            'applied_date' => [
                'type' => 'DATE',
            ],
            'reviewed_by' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'reviewed_date' => [
                'type' => 'DATE',
                'null' => true,
            ],
            'review_notes' => [
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
        $this->forge->addKey(['tenant_id', 'staff_id']);
        $this->forge->addKey(['tenant_id', 'status']);
        $this->forge->addKey(['staff_id', 'status']);
        $this->forge->addKey(['applied_date']);
        $this->forge->createTable('leave_requests');
    }

    public function down()
    {
        $this->forge->dropTable('leave_requests');
    }
}
