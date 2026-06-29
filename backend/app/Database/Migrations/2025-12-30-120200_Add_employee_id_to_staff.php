<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddEmployeeIdToStaff extends Migration
{
    public function up()
    {
        // Check if column already exists
        $exists = $this->db->fieldExists('employee_id', 'staff');
        
        if (!$exists) {
            $this->forge->addColumn('staff', [
                'employee_id' => [
                    'type' => 'VARCHAR',
                    'constraint' => 20,
                    'null' => true,
                    'unique' => true,
                    'after' => 'employment_status',
                    'comment' => 'Unique employee ID number',
                ],
            ]);
            
            // Add index for better query performance
            $this->db->query("
                ALTER TABLE staff 
                ADD INDEX idx_employee_id (employee_id)
            ");
            
            // Generate employee IDs for existing staff
            $this->db->query("
                UPDATE staff 
                SET employee_id = CASE 
                    WHEN id REGEXP '^[0-9]+$' THEN CONCAT('EMP', LPAD(id, 4, '0'))
                    WHEN id LIKE 's%' THEN CONCAT('EMP', SUBSTRING(id, 2))
                    ELSE CONCAT('EMP', SUBSTRING(id, -3))
                END
                WHERE employee_id IS NULL
            ");
        }
    }

    public function down()
    {
        $this->forge->dropColumn('staff', 'employee_id');
    }
}
