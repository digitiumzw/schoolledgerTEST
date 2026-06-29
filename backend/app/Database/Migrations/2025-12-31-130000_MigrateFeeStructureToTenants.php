<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class MigrateFeeStructureToTenants extends Migration
{
    public function up()
    {
        $db = \Config\Database::connect();
        
        // Get all fee structures
        $feeStructures = $db->table('fee_structures')->get()->getResultArray();
        
        foreach ($feeStructures as $feeStructure) {
            // Get existing tenant settings
            $tenant = $db->table('tenants')->where('id', $feeStructure['tenant_id'])->get()->getRowArray();
            $existingSettings = [];
            
            if ($tenant && isset($tenant['settings'])) {
                $existingSettings = json_decode($tenant['settings'], true) ?? [];
            }
            
            // Add fee structure to settings
            $existingSettings['feeStructure'] = [
                'structureType' => $feeStructure['structure_type'] ?? 'termly',
                'termsPerYear' => (int) ($feeStructure['terms_per_year'] ?? 3),
                'defaultFees' => isset($feeStructure['default_fees']) 
                    ? json_decode($feeStructure['default_fees'], true) 
                    : [],
                'classOverrides' => isset($feeStructure['class_overrides']) 
                    ? json_decode($feeStructure['class_overrides'], true) 
                    : [],
            ];
            
            // Update tenant with new settings including fee structure
            $db->table('tenants')
                ->where('id', $feeStructure['tenant_id'])
                ->update([
                    'settings' => json_encode($existingSettings),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
        }
        
        // Drop the fee_structures table
        $this->forge->dropTable('fee_structures');
    }

    public function down()
    {
        // Recreate the fee_structures table for rollback
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
            'structure_type' => [
                'type' => 'ENUM',
                'constraint' => ['termly', 'monthly'],
                'default' => 'termly',
            ],
            'terms_per_year' => [
                'type' => 'INT',
                'default' => 3,
            ],
            'default_fees' => [
                'type' => 'JSON',
                'null' => true,
            ],
            'class_overrides' => [
                'type' => 'JSON',
                'null' => true,
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
        $this->forge->addUniqueKey('tenant_id', 'uk_fee_structures_tenant_id');
        $this->forge->createTable('fee_structures');
        
        // Move data back to fee_structures table
        $db = \Config\Database::connect();
        $tenants = $db->table('tenants')->where('settings IS NOT NULL')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            $settings = json_decode($tenant['settings'], true) ?? [];
            $feeStructure = $settings['feeStructure'] ?? [];
            
            if (!empty($feeStructure)) {
                $db->table('fee_structures')->insert([
                    'tenant_id' => $tenant['id'],
                    'structure_type' => $feeStructure['structureType'] ?? 'termly',
                    'terms_per_year' => $feeStructure['termsPerYear'] ?? 3,
                    'default_fees' => json_encode($feeStructure['defaultFees'] ?? []),
                    'class_overrides' => json_encode($feeStructure['classOverrides'] ?? []),
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
            }
        }
    }
}
