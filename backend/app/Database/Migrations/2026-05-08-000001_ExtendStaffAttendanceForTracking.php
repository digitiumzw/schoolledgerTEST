<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class ExtendStaffAttendanceForTracking extends Migration
{
    public function up(): void
    {
        // Add 'early_departure' to the status ENUM
        $this->db->query("
            ALTER TABLE staff_attendance
            MODIFY COLUMN status
                ENUM('present','absent','late','on_leave','half_day','early_departure') NULL
        ");

        // Add overtime_hours column after work_hours
        $this->db->query("
            ALTER TABLE staff_attendance
            ADD COLUMN overtime_hours DECIMAL(5,2) NULL DEFAULT NULL
            AFTER work_hours
        ");
    }

    public function down(): void
    {
        // Remove overtime_hours
        $this->db->query("
            ALTER TABLE staff_attendance
            DROP COLUMN overtime_hours
        ");

        // Revert status ENUM to original values
        $this->db->query("
            ALTER TABLE staff_attendance
            MODIFY COLUMN status
                ENUM('present','absent','late','on_leave','half_day') NULL
        ");
    }
}
