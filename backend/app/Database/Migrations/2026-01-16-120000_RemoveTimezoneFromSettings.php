<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Migration to remove timezone from settings
 * 
 * This migration removes the timezone field from:
 * 1. The legacy settings table (if it exists)
 * 2. The settings JSON stored in tenants table
 * 
 * Timezone functionality is being removed as it's not required
 * for the school management system operations.
 */
class RemoveTimezoneFromSettings extends Migration
{
    public function up()
    {
        // Remove timezone column from settings table if it exists
        if ($this->db->tableExists('settings')) {
            if ($this->db->fieldExists('timezone', 'settings')) {
                $this->forge->dropColumn('settings', 'timezone');
            }
        }

        // Clean up timezone from JSON settings in tenants table
        $tenants = $this->db->table('tenants')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            if (!empty($tenant['settings'])) {
                $settings = json_decode($tenant['settings'], true);
                if ($settings && isset($settings['timezone'])) {
                    unset($settings['timezone']);
                    $this->db->table('tenants')
                        ->where('id', $tenant['id'])
                        ->update(['settings' => json_encode($settings)]);
                }
            }
        }
    }

    public function down()
    {
        // Re-add timezone column to settings table if it exists
        if ($this->db->tableExists('settings')) {
            if (!$this->db->fieldExists('timezone', 'settings')) {
                $this->forge->addColumn('settings', [
                    'timezone' => [
                        'type' => 'VARCHAR',
                        'constraint' => 50,
                        'default' => 'Africa/Harare',
                        'after' => 'default_currency'
                    ]
                ]);
            }
        }

        // Re-add timezone to JSON settings in tenants table
        $tenants = $this->db->table('tenants')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            if (!empty($tenant['settings'])) {
                $settings = json_decode($tenant['settings'], true);
                if ($settings && !isset($settings['timezone'])) {
                    $settings['timezone'] = 'Africa/Harare';
                    $this->db->table('tenants')
                        ->where('id', $tenant['id'])
                        ->update(['settings' => json_encode($settings)]);
                }
            }
        }
    }
}
