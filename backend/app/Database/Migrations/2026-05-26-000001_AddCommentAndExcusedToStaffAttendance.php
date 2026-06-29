<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds the nullable `comment` column to staff_attendance and extends the
 * status ENUM to include 'excused' for admin-confirmed absences with reason.
 *
 * Replaces 2026-04-16-AddAttendanceComment.php which had a non-standard
 * filename that CodeIgniter 4 did not recognise, so the migration was never
 * applied.
 */
class AddCommentAndExcusedToStaffAttendance extends Migration
{
    public function up(): void
    {
        // Extend status ENUM to add 'excused'
        $this->db->query("
            ALTER TABLE staff_attendance
            MODIFY COLUMN status
                ENUM('present','absent','late','on_leave','half_day','early_departure','excused') NULL
        ");

        // Add comment column (nullable TEXT, after remarks)
        if (!$this->db->fieldExists('comment', 'staff_attendance')) {
            $this->forge->addColumn('staff_attendance', [
                'comment' => [
                    'type'  => 'TEXT',
                    'null'  => true,
                    'after' => 'remarks',
                ],
            ]);
        }
    }

    public function down(): void
    {
        $this->forge->dropColumn('staff_attendance', 'comment');

        $this->db->query("
            ALTER TABLE staff_attendance
            MODIFY COLUMN status
                ENUM('present','absent','late','on_leave','half_day','early_departure') NULL
        ");
    }
}
