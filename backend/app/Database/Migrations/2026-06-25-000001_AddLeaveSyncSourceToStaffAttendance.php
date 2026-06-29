<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds 'leave_sync' to the source ENUM in staff_attendance so approved
 * leave requests can be synchronised into attendance rows.
 */
class AddLeaveSyncSourceToStaffAttendance extends Migration
{
    public function up()
    {
        $this->db->query("ALTER TABLE staff_attendance MODIFY source ENUM('manual','kiosk','system','leave_sync') DEFAULT 'manual'");
    }

    public function down()
    {
        // Remove any leave_sync rows before narrowing the ENUM
        $this->db->query("DELETE FROM staff_attendance WHERE source = 'leave_sync'");
        $this->db->query("ALTER TABLE staff_attendance MODIFY source ENUM('manual','kiosk','system') DEFAULT 'manual'");
    }
}
