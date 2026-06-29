<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class DropStatusColumnFromStaff extends Migration
{
    public function up()
    {
        // Drop the status column as we're now using only employment_status
        $this->forge->dropColumn('staff', 'status');
    }

    public function down()
    {
        // Add the status column back if rollback is needed
        $this->forge->addColumn('staff', [
            'status' => [
                'type' => 'ENUM',
                'constraint' => ['active', 'inactive'],
                'default' => 'active',
                'after' => 'hire_date',
                'null' => false,
            ],
        ]);
    }
}
