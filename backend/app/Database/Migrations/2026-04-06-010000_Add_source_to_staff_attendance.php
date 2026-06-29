<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds a `source` column to staff_attendance to track how each record was created,
 * and adds a unique constraint on (tenant_id, staff_id, date) to prevent duplicates.
 */
class AddSourceToStaffAttendance extends Migration
{
    public function up()
    {
        // Add source column to track record origin
        $this->forge->addColumn('staff_attendance', [
            'source' => [
                'type'       => 'ENUM',
                'constraint' => ['manual', 'kiosk', 'system'],
                'default'    => 'manual',
                'after'      => 'remarks',
            ],
        ]);

        // Add unique constraint to prevent duplicate records per staff per day
        $this->db->query('ALTER TABLE staff_attendance ADD UNIQUE KEY uq_staff_date (tenant_id, staff_id, date)');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE staff_attendance DROP INDEX uq_staff_date');
        $this->forge->dropColumn('staff_attendance', 'source');
    }
}
