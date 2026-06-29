<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class MigrateAcademicCalendarToTenants extends Migration
{
    public function up()
    {
        // Add academic_calendar column to tenants table
        $this->forge->addColumn('tenants', [
            'academic_calendar' => [
                'type' => 'JSON',
                'null' => true,
                'comment' => 'Stores academic calendar data (terms, school status, etc.)'
            ],
        ]);

        // Migrate data from academic_calendars to tenants
        $calendars = $this->db->table('academic_calendars')->get()->getResultArray();
        
        foreach ($calendars as $calendar) {
            $academicCalendarData = [
                'terms' => json_decode($calendar['terms'], true) ?? [],
                'schoolOpen' => (bool) $calendar['school_open'],
                'disableAttendanceWhenClosed' => (bool) $calendar['disable_attendance_when_closed']
            ];
            
            $this->db->table('tenants')
                ->where('id', $calendar['tenant_id'])
                ->update([
                    'academic_calendar' => json_encode($academicCalendarData),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
        }

        // Drop the academic_calendars table
        $this->forge->dropTable('academic_calendars');
    }

    public function down()
    {
        // Recreate academic_calendars table
        $this->forge->addField([
            'id' => ['type' => 'INT', 'auto_increment' => true],
            'tenant_id' => ['type' => 'VARCHAR', 'constraint' => 50],
            'terms' => ['type' => 'JSON'],
            'school_open' => ['type' => 'BOOLEAN', 'default' => true],
            'disable_attendance_when_closed' => ['type' => 'BOOLEAN', 'default' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('tenant_id');
        $this->forge->createTable('academic_calendars');

        // Migrate data back from tenants to academic_calendars
        $tenants = $this->db->table('tenants')->where('academic_calendar IS NOT NULL')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            if ($tenant['academic_calendar']) {
                $academicCalendar = json_decode($tenant['academic_calendar'], true);
                
                $this->db->table('academic_calendars')->insert([
                    'tenant_id' => $tenant['id'],
                    'terms' => json_encode($academicCalendar['terms'] ?? []),
                    'school_open' => $academicCalendar['schoolOpen'] ?? true,
                    'disable_attendance_when_closed' => $academicCalendar['disableAttendanceWhenClosed'] ?? true,
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
            }
        }

        // Remove academic_calendar column from tenants
        $this->forge->dropColumn('tenants', 'academic_calendar');
    }
}
