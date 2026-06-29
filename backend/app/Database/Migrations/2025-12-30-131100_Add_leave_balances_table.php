<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddLeaveBalancesTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type' => 'INT',
                'auto_increment' => true,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'staff_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'year' => [
                'type' => 'YEAR',
            ],
            'sick_total' => [
                'type' => 'INT',
                'constraint' => 3,
                'default' => 10,
            ],
            'sick_used' => [
                'type' => 'INT',
                'constraint' => 3,
                'default' => 0,
            ],
            'sick_remaining' => [
                'type' => 'INT',
                'constraint' => 3,
                'default' => 10,
            ],
            'vacation_total' => [
                'type' => 'INT',
                'constraint' => 3,
                'default' => 20,
            ],
            'vacation_used' => [
                'type' => 'INT',
                'constraint' => 3,
                'default' => 0,
            ],
            'vacation_remaining' => [
                'type' => 'INT',
                'constraint' => 3,
                'default' => 20,
            ],
            'personal_total' => [
                'type' => 'INT',
                'constraint' => 3,
                'default' => 5,
            ],
            'personal_used' => [
                'type' => 'INT',
                'constraint' => 3,
                'default' => 0,
            ],
            'personal_remaining' => [
                'type' => 'INT',
                'constraint' => 3,
                'default' => 5,
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
        $this->forge->addUniqueKey(['tenant_id', 'staff_id', 'year'], 'unique_staff_year');
        $this->forge->addKey(['tenant_id', 'staff_id']);
        $this->forge->addKey(['year']);
        $this->forge->createTable('leave_balances');
    }

    public function down()
    {
        $this->forge->dropTable('leave_balances');
    }
}
