<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddQrCodesToStaff extends Migration
{
    public function up()
    {
        // Check if qr_secret column already exists
        $qrSecretExists = $this->db->fieldExists('qr_secret', 'staff');
        
        if (!$qrSecretExists) {
            $this->forge->addColumn('staff', [
                'qr_secret' => [
                    'type' => 'VARCHAR',
                    'constraint' => 255,
                    'null' => true,
                    'after' => 'employee_id',
                    'comment' => 'Secret key for QR code JWT signing',
                ],
            ]);
        }
        
        // Check if qr_code_expires column already exists
        $qrExpiresExists = $this->db->fieldExists('qr_code_expires', 'staff');
        
        if (!$qrExpiresExists) {
            $this->forge->addColumn('staff', [
                'qr_code_expires' => [
                    'type' => 'DATETIME',
                    'null' => true,
                    'after' => 'qr_secret',
                    'comment' => 'QR code expiration date',
                ],
            ]);
        }
        
        // Add index for qr_secret for better query performance
        if (!$qrSecretExists) {
            $this->db->query("
                ALTER TABLE staff 
                ADD INDEX idx_qr_secret (qr_secret)
            ");
        }
        
        // Generate QR secrets for existing staff
        $this->generateQrSecretsForExistingStaff();
    }
    
    private function generateQrSecretsForExistingStaff()
    {
        // Get all staff without QR secrets
        $staffWithoutSecret = $this->db->query("
            SELECT id, tenant_id 
            FROM staff 
            WHERE qr_secret IS NULL
        ")->getResult();
        
        foreach ($staffWithoutSecret as $staff) {
            // Generate a unique secret for each staff member
            $secret = bin2hex(random_bytes(32));
            
            // Set expiration to 1 year from now
            $expires = date('Y-m-d H:i:s', strtotime('+1 year'));
            
            // Update the staff record
            $this->db->query("
                UPDATE staff 
                SET qr_secret = ?, qr_code_expires = ?
                WHERE id = ?
            ", [$secret, $expires, $staff->id]);
        }
    }

    public function down()
    {
        $this->forge->dropColumn('staff', 'qr_secret');
        $this->forge->dropColumn('staff', 'qr_code_expires');
    }
}
