<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddQrSecretToTenantSettings extends Migration
{
    public function up()
    {
        $db = \Config\Database::connect();
        
        // Get all tenants
        $tenants = $db->table('tenants')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            // Parse existing settings
            $settings = [];
            if (!empty($tenant['settings'])) {
                $settings = json_decode($tenant['settings'], true) ?? [];
            }
            
            // Add QR code secret if not exists
            if (!isset($settings['qrCodeSecret'])) {
                // Generate a unique secret for the tenant
                $settings['qrCodeSecret'] = bin2hex(random_bytes(64));
                
                // Update tenant settings
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
        $db = \Config\Database::connect();
        
        // Remove QR code secret from all tenant settings
        $tenants = $db->table('tenants')->get()->getResultArray();
        
        foreach ($tenants as $tenant) {
            if (!empty($tenant['settings'])) {
                $settings = json_decode($tenant['settings'], true) ?? [];
                
                // Remove QR code secret
                unset($settings['qrCodeSecret']);
                
                // Update tenant settings
                $db->table('tenants')
                    ->where('id', $tenant['id'])
                    ->update([
                        'settings' => json_encode($settings),
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
            }
        }
    }
}
