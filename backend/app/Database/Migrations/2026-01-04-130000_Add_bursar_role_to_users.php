<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddBursarRoleToUsers extends Migration
{
    public function up()
    {
        // Modify the role column to include 'bursar' option
        $this->forge->modifyColumn('users', [
            'role' => [
                'type' => "ENUM('admin','teacher','finance','bursar')",
                'null' => false,
                'default' => 'teacher',
            ],
        ]);
    }

    public function down()
    {
        // Revert back to original enum (note: this will fail if any users have bursar role)
        $this->forge->modifyColumn('users', [
            'role' => [
                'type' => "ENUM('admin','teacher','finance')",
                'null' => false,
                'default' => 'teacher',
            ],
        ]);
    }
}
