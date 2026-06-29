<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddWorkHoursToSettings extends Migration
{
    public function up()
    {
        // Since settings were migrated to tenants table, add work hours there
        $this->forge->addColumn('tenants', [
            'work_hours' => [
                'type' => 'JSON',
                'null' => true,
                'comment' => 'Work hours configuration for staff and students'
            ]
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('tenants', ['work_hours']);
    }
}
