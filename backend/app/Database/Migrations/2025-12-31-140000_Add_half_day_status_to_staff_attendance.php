<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddHalfDayStatusToStaffAttendance extends Migration
{
    public function up()
    {
        // First, modify the status column to remove default and add half_day
        $this->db->query("
            ALTER TABLE staff_attendance 
            MODIFY COLUMN status ENUM('present', 'absent', 'late', 'on_leave', 'half_day') NULL
        ");
    }

    public function down()
    {
        // Revert back to original status values with default
        $this->db->query("
            ALTER TABLE staff_attendance 
            MODIFY COLUMN status ENUM('present', 'absent', 'late', 'on_leave') NOT NULL DEFAULT 'present'
        ");
    }
}
