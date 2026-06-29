<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddFeeStructureToTenants extends Migration
{
    public function up()
    {
        // Add fee_structure column to tenants table
        $this->forge->addColumn('tenants', [
            'fee_structure' => [
                'type' => 'JSON',
                'null' => true,
                'comment' => 'Stores tenant-specific fee structure configuration including default fees and class overrides'
            ]
        ]);
        
        // Move fee structure from settings to the new field
        $db = \Config\Database::connect();
        $tenants = $db->table('tenants')->where('settings IS NOT NULL')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            $settings = json_decode($tenant['settings'], true) ?? [];
            $feeStructure = $settings['feeStructure'] ?? null;
            
            if ($feeStructure !== null) {
                // Update tenant with fee structure in its own field
                $db->table('tenants')
                    ->where('id', $tenant['id'])
                    ->update([
                        'fee_structure' => json_encode($feeStructure),
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
                
                // Remove feeStructure from settings
                unset($settings['feeStructure']);
                $db->table('tenants')
                    ->where('id', $tenant['id'])
                    ->update([
                        'settings' => json_encode($settings),
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
            }
        }
    }

    public function down()
    {
        // Move fee structure back to settings field
        $db = \Config\Database::connect();
        $tenants = $db->table('tenants')->where('fee_structure IS NOT NULL')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            $settings = json_decode($tenant['settings'], true) ?? [];
            $feeStructure = json_decode($tenant['fee_structure'], true) ?? [];
            
            // Add fee structure back to settings
            $settings['feeStructure'] = $feeStructure;
            
            // Update tenant
            $db->table('tenants')
                ->where('id', $tenant['id'])
                ->update([
                    'settings' => json_encode($settings),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
        }
        
        // Drop the fee_structure column
        $this->forge->dropColumn('tenants', 'fee_structure');
    }
}
