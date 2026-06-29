<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddEmploymentStatusToStaff extends Migration
{
    public function up()
    {
        // First, modify the status enum to remove 'on_leave'
        $this->db->query("
            ALTER TABLE staff 
            MODIFY COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active'
        ");
        
        // Then add the new employment_status column
        $this->forge->addColumn('staff', [
            'employment_status' => [
                'type' => 'ENUM',
                'constraint' => ['active', 'on_leave', 'suspended', 'resigned', 'retired'],
                'default' => 'active',
                'after' => 'status',
                'null' => false,
            ],
        ]);
        
        // Migrate existing data
        // Set employment_status based on old status values
        $this->db->query("
            UPDATE staff 
            SET employment_status = CASE 
                WHEN status = 'active' THEN 'active'
                WHEN status = 'inactive' THEN 'inactive'
                WHEN status = 'on_leave' THEN 'on_leave'
                ELSE 'active'
            END
        ");
        
        // Add index for better query performance
        $this->db->query("
            ALTER TABLE staff 
            ADD INDEX idx_employment_status (employment_status)
        ");
    }

    public function down()
    {
        // Remove the employment_status column
        $this->forge->dropColumn('staff', 'employment_status');
        
        // Revert status enum to include 'on_leave'
        $this->db->query("
            ALTER TABLE staff 
            MODIFY COLUMN status ENUM('active', 'inactive', 'on_leave') NOT NULL DEFAULT 'active'
        ");
    }
}
