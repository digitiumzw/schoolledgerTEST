<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDateOfBirthToStaff extends Migration
{
    public function up()
    {
        $this->forge->addColumn('staff', [
            'date_of_birth' => [
                'type' => 'DATE',
                'null' => true,
                'after' => 'phone'
            ]
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('staff', 'date_of_birth');
    }
}
