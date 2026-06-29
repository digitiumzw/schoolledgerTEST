<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddNextOfKinToStaff extends Migration
{
    public function up()
    {
        // Add next of kin columns to staff table
        $this->forge->addColumn('staff', [
            'next_of_kin_name' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
                'after' => 'employee_id',
            ],
            'next_of_kin_relationship' => [
                'type' => 'VARCHAR',
                'constraint' => 100,
                'null' => true,
                'after' => 'next_of_kin_name',
            ],
            'next_of_kin_phone' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
                'after' => 'next_of_kin_relationship',
            ],
            'next_of_kin_email' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
                'after' => 'next_of_kin_phone',
            ],
            'next_of_kin_address' => [
                'type' => 'TEXT',
                'null' => true,
                'after' => 'next_of_kin_email',
            ],
        ]);
        
        // Add index for better query performance
        $this->db->query("
            ALTER TABLE staff 
            ADD INDEX idx_next_of_kin_name (next_of_kin_name)
        ");
    }

    public function down()
    {
        // Remove the next of kin columns
        $this->forge->dropColumn('staff', [
            'next_of_kin_name',
            'next_of_kin_relationship',
            'next_of_kin_phone',
            'next_of_kin_email',
            'next_of_kin_address'
        ]);
    }
}
