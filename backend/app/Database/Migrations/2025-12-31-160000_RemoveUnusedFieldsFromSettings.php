<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class RemoveUnusedFieldsFromSettings extends Migration
{
    public function up()
    {
        $db = \Config\Database::connect();
        
        // Get all tenants and clean up their settings
        $tenants = $db->table('tenants')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            $settings = json_decode($tenant['settings'], true) ?? [];
            
            // Remove the unwanted fields
            unset($settings['logo']);
            unset($settings['primaryColor']);
            unset($settings['favicon']);
            unset($settings['attendanceCutoffTime']);
            
            // Update the tenant with cleaned settings
            $db->table('tenants')
                ->where('id', $tenant['id'])
                ->update([
                    'settings' => json_encode($settings),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
        }
    }

    public function down()
    {
        $db = \Config\Database::connect();
        
        // Get all tenants and restore the fields with defaults
        $tenants = $db->table('tenants')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            $settings = json_decode($tenant['settings'], true) ?? [];
            
            // Add back the fields with default values
            $settings['logo'] = '';
            $settings['primaryColor'] = '#2E7D32';
            $settings['favicon'] = '';
            $settings['attendanceCutoffTime'] = '17:00';
            
            // Update the tenant
            $db->table('tenants')
                ->where('id', $tenant['id'])
                ->update([
                    'settings' => json_encode($settings),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
        }
    }
}
