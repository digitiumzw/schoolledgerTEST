<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class DropNameFromTenantsAndUseSchoolName extends Migration
{
    public function up()
    {
        // First, ensure all tenants have schoolName in settings
        $db = \Config\Database::connect();
        $tenants = $db->table('tenants')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            $settings = json_decode($tenant['settings'], true) ?? [];
            
            // If schoolName is not set but name exists in tenant, move it
            if (!isset($settings['schoolName']) && isset($tenant['name'])) {
                $settings['schoolName'] = $tenant['name'];
                
                // Update the tenant with schoolName in settings
                $db->table('tenants')
                    ->where('id', $tenant['id'])
                    ->update([
                        'settings' => json_encode($settings),
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
            }
        }
        
        // Now drop the name column
        $this->forge->dropColumn('tenants', 'name');
    }

    public function down()
    {
        // Add the name column back
        $this->forge->addColumn('tenants', [
            'name' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'after' => 'id',
                'comment' => 'Tenant/School name (moved from settings)'
            ]
        ]);
        
        // Move schoolName from settings back to name column
        $db = \Config\Database::connect();
        $tenants = $db->table('tenants')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            $settings = json_decode($tenant['settings'], true) ?? [];
            $schoolName = $settings['schoolName'] ?? 'Unknown School';
            
            // Update the tenant name
            $db->table('tenants')
                ->where('id', $tenant['id'])
                ->update([
                    'name' => $schoolName,
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
        }
    }
}
