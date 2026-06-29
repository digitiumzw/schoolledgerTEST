<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class RemoveWorkHoursFromTenants extends Migration
{
    public function up()
    {
        // Remove the work_hours column from tenants table
        $this->forge->dropColumn('tenants', 'work_hours');
    }

    public function down()
    {
        // Add the work_hours column back for rollback
        $this->forge->addColumn('tenants', [
            'work_hours' => [
                'type' => 'JSON',
                'null' => true,
                'comment' => 'Work hours configuration for staff and students'
            ]
        ]);
    }
}
