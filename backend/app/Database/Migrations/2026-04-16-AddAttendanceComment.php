<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds a nullable `comment` column to staff_attendance and extends the
 * status ENUM to include 'excused' for admin-confirmed absence with reason.
 */
class AddAttendanceComment extends Migration
{
    public function up()
    {
        // Extend the status ENUM to include 'excused'
        $this->db->query("
            ALTER TABLE staff_attendance
            MODIFY COLUMN status ENUM('present', 'absent', 'late', 'on_leave', 'half_day', 'excused') NULL
        ");

        // Add comment column for optional absence/excused notes (max 500 chars enforced in app)
        $this->forge->addColumn('staff_attendance', [
            'comment' => [
                'type'  => 'TEXT',
                'null'  => true,
                'after' => 'remarks',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('staff_attendance', 'comment');

        $this->db->query("
            ALTER TABLE staff_attendance
            MODIFY COLUMN status ENUM('present', 'absent', 'late', 'on_leave', 'half_day') NULL
        ");
    }
}
