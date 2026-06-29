<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddAddressToStaff extends Migration
{
    public function up()
    {
        // Add address field to staff table
        $this->forge->addColumn('staff', [
            'address' => [
                'type' => 'TEXT',
                'null' => true,
                'after' => 'phone',
                'comment' => 'Staff member residential address'
            ]
        ]);
    }

    public function down()
    {
        // Remove address field from staff table
        $this->forge->dropColumn('staff', 'address');
    }
}
