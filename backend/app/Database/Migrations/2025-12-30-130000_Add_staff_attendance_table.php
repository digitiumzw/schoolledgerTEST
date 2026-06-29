<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddStaffAttendanceTable extends Migration
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
            'date' => [
                'type' => 'DATE',
            ],
            'check_in' => [
                'type' => 'TIME',
                'null' => true,
            ],
            'check_out' => [
                'type' => 'TIME',
                'null' => true,
            ],
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['present', 'absent', 'late', 'on_leave'],
                'null' => true,
            ],
            'work_hours' => [
                'type' => 'DECIMAL',
                'constraint' => '5,2',
                'null' => true,
            ],
            'remarks' => [
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
        $this->forge->addKey(['tenant_id', 'date']);
        $this->forge->addKey(['staff_id', 'date']);
        $this->forge->createTable('staff_attendance');
    }

    public function down()
    {
        $this->forge->dropTable('staff_attendance');
    }
}
