<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class MigrateSettingsToTenants extends Migration
{
    public function up()
    {
        $db = \Config\Database::connect();
        
        // Check if settings column exists in tenants table
        $exists = $db->fieldExists('settings', 'tenants');
        
        if (!$exists) {
            // First, add the settings column to tenants
            $this->forge->addColumn('tenants', [
                'settings' => [
                    'type' => 'JSON',
                    'null' => true,
                    'comment' => 'Stores tenant-specific settings in JSON format including school info, work hours, and preferences'
                ]
            ]);
        }

        // Migrate data from settings table to tenants table
        $db = \Config\Database::connect();
        
        // Migrate data from settings table to tenants table (if it exists)
        if ($this->db->tableExists('settings')) {
            $settings = $db->table('settings')->get()->getResultArray();
            
            foreach ($settings as $setting) {
                // Prepare the settings JSON structure
                $settingsJson = [
                    'schoolName' => $setting['school_name'] ?? '',
                    'contactEmail' => $setting['contact_email'] ?? '',
                    'contactPhone' => $setting['contact_phone'] ?? '',
                    'address' => $setting['address'] ?? '',
                    'defaultCurrency' => $setting['default_currency'] ?? 'USD',
                    'timezone' => $setting['timezone'] ?? 'Africa/Harare',
                    'academicYear' => $setting['academic_year'] ?? date('Y'),
                    'logo' => $setting['logo'] ?? '',
                    'primaryColor' => $setting['primary_color'] ?? '#2E7D32',
                    'favicon' => $setting['favicon'] ?? '',
                    'staffWorkHours' => isset($setting['staff_work_hours']) 
                        ? json_decode($setting['staff_work_hours'], true) 
                        : ['startTime' => '08:30', 'endTime' => '17:00'],
                    'studentWorkHours' => isset($setting['student_work_hours']) 
                        ? json_decode($setting['student_work_hours'], true) 
                        : ['startTime' => '08:30', 'endTime' => '15:30'],
                    'attendanceCutoffTime' => $setting['attendance_cutoff_time'] ?? '17:00',
                ];

                // Update the tenant record
                $db->table('tenants')
                    ->where('id', $setting['tenant_id'])
                    ->update([
                        'settings' => json_encode($settingsJson),
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
            }
            
            // Now drop the settings table
            $this->forge->dropTable('settings');
        }
    }

    public function down()
    {
        // Recreate the settings table for rollback
        $this->forge->addField([
            'id' => [
                'type' => 'INT',
                'unsigned' => true,
                'auto_increment' => true,
            ],
            'tenant_id' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
            ],
            'school_name' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'contact_email' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'contact_phone' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'null' => true,
            ],
            'address' => [
                'type' => 'TEXT',
                'null' => true,
            ],
            'default_currency' => [
                'type' => 'VARCHAR',
                'constraint' => 10,
                'default' => 'USD',
            ],
            'timezone' => [
                'type' => 'VARCHAR',
                'constraint' => 50,
                'default' => 'Africa/Harare',
            ],
            'academic_year' => [
                'type' => 'VARCHAR',
                'constraint' => 10,
                'null' => true,
            ],
            'logo' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'primary_color' => [
                'type' => 'VARCHAR',
                'constraint' => 10,
                'default' => '#2E7D32',
            ],
            'favicon' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'staff_work_hours' => [
                'type' => 'JSON',
                'null' => true,
            ],
            'student_work_hours' => [
                'type' => 'JSON',
                'null' => true,
            ],
            'attendance_cutoff_time' => [
                'type' => 'TIME',
                'default' => '17:00:00',
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('tenant_id');
        $this->forge->addUniqueKey('tenant_id', 'uk_settings_tenant_id');
        $this->forge->createTable('settings');

        // Move data back to settings table (if needed)
        $db = \Config\Database::connect();
        $tenants = $db->table('tenants')->where('settings IS NOT NULL')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            $settings = json_decode($tenant['settings'], true) ?? [];
            
            $db->table('settings')->insert([
                'tenant_id' => $tenant['id'],
                'school_name' => $settings['schoolName'] ?? '',
                'contact_email' => $settings['contactEmail'] ?? '',
                'contact_phone' => $settings['contactPhone'] ?? '',
                'address' => $settings['address'] ?? '',
                'default_currency' => $settings['defaultCurrency'] ?? 'USD',
                'timezone' => $settings['timezone'] ?? 'Africa/Harare',
                'academic_year' => $settings['academicYear'] ?? date('Y'),
                'logo' => $settings['logo'] ?? '',
                'primary_color' => $settings['primaryColor'] ?? '#2E7D32',
                'favicon' => $settings['favicon'] ?? '',
                'staff_work_hours' => isset($settings['staffWorkHours']) ? json_encode($settings['staffWorkHours']) : null,
                'student_work_hours' => isset($settings['studentWorkHours']) ? json_encode($settings['studentWorkHours']) : null,
                'attendance_cutoff_time' => $settings['attendanceCutoffTime'] ?? '17:00',
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }

        // Remove the settings column from tenants
        $this->forge->dropColumn('tenants', 'settings');
    }
}
