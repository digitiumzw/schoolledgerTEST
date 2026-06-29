<?php

namespace App\Services;

use App\Libraries\JWTHandler;
use Config\Database;

/**
 * QRCodeService — Handles QR code token generation and validation for staff attendance
 * 
 * This service manages JWT tokens specifically for QR codes used in kiosk attendance.
 * Uses tenant-specific secrets for security and supports token expiration management.
 */
class QRCodeService
{
    private $db;
    private $jwtHandler;

    public function __construct()
    {
        $this->db = Database::connect();
        $this->jwtHandler = new JWTHandler();
    }

    /**
     * Generate a QR code JWT token for a staff member
     * 
     * @param string $staffId The staff member ID
     * @param string $tenantId The tenant ID
     * @return string The JWT token for QR code
     * @throws \Exception If staff not found or tenant secret not configured
     */
    public function generateQRToken(string $staffId, string $tenantId): string
    {
        // Get staff member
        $staff = $this->db->table('staff')
            ->where('id', $staffId)
            ->where('tenant_id', $tenantId)
            ->get()
            ->getRow();

        if (!$staff) {
            throw new \Exception('Staff member not found');
        }

        // Get tenant settings with QR secret
        $tenant = $this->db->table('tenants')
            ->where('id', $tenantId)
            ->get()
            ->getRow();

        if (!$tenant || empty($tenant->settings)) {
            throw new \Exception('Tenant QR secret not configured');
        }

        $settings = json_decode($tenant->settings, true);
        if (!isset($settings['qrCodeSecret'])) {
            throw new \Exception('Tenant QR secret not configured');
        }

        // Generate/update staff QR secret if needed
        if (empty($staff->qr_secret) || empty($staff->qr_code_expires) || 
            strtotime($staff->qr_code_expires) < strtotime('+30 days')) {
            
            $this->refreshStaffQRSecret($staffId);
            $staff = $this->db->table('staff')
                ->where('id', $staffId)
                ->get()
                ->getRow();
        }

        // Create JWT payload for QR code
        $issuedAt = time();
        $expiration = strtotime($staff->qr_code_expires);

        $payload = [
            'iss' => 'schoolledger-kiosk',
            'iat' => $issuedAt,
            'exp' => $expiration,
            'staff_id' => $staffId,
            'tenant_id' => $tenantId,
            'staff_secret' => $staff->qr_secret,
            'type' => 'qr_attendance'
        ];

        // Sign with tenant-specific QR secret
        return \Firebase\JWT\JWT::encode(
            $payload,
            $settings['qrCodeSecret'],
            'HS256'
        );
    }

    /**
     * Validate a QR code JWT token and return staff information
     * 
     * @param string $token The QR code JWT token
     * @return object Staff information if valid
     * @throws \Exception If token is invalid or expired
     */
    public function validateQRToken(string $token): object
    {
        try {
            // Extract payload without verification first to get tenant_id
            $tokenParts = explode('.', $token);
            if (count($tokenParts) !== 3) {
                throw new \Exception('Invalid QR token structure');
            }
            
            $payload = json_decode(base64_decode($tokenParts[1]), true);
            if (!$payload || !isset($payload['tenant_id']) || !isset($payload['staff_id']) || 
                !isset($payload['staff_secret']) || $payload['type'] !== 'qr_attendance') {
                throw new \Exception('Invalid QR token structure');
            }

            // Get tenant QR secret
            $tenant = $this->db->table('tenants')
                ->where('id', $payload['tenant_id'])
                ->get()
                ->getRow();

            if (!$tenant || empty($tenant->settings)) {
                throw new \Exception('Tenant not found or not configured');
            }

            $settings = json_decode($tenant->settings, true);
            if (!isset($settings['qrCodeSecret'])) {
                throw new \Exception('Tenant QR secret not configured');
            }

            // Verify token with tenant secret
            $verified = \Firebase\JWT\JWT::decode(
                $token,
                new \Firebase\JWT\Key($settings['qrCodeSecret'], 'HS256')
            );

            // Verify staff member exists and matches the secret
            $staff = $this->db->table('staff')
                ->where('id', $verified->staff_id)
                ->where('tenant_id', $verified->tenant_id)
                ->where('qr_secret', $verified->staff_secret)
                ->where('qr_code_expires >', date('Y-m-d H:i:s'))
                ->get()
                ->getRow();

            if (!$staff) {
                throw new \Exception('Staff member not found or QR code expired');
            }

            return (object) [
                'staff_id' => $staff->id,
                'tenant_id' => $staff->tenant_id,
                'first_name' => $staff->first_name,
                'last_name' => $staff->last_name,
                'employee_id' => $staff->employee_id,
                'employment_status' => $staff->employment_status ?? 'active'
            ];

        } catch (\Firebase\JWT\ExpiredException $e) {
            throw new \Exception('QR code has expired');
        } catch (\Firebase\JWT\SignatureInvalidException $e) {
            throw new \Exception('Invalid QR code signature');
        } catch (\Exception $e) {
            throw new \Exception('Invalid QR code: ' . $e->getMessage());
        }
    }

    /**
     * Refresh QR secret for a staff member
     * 
     * @param string $staffId The staff member ID
     * @return void
     */
    public function refreshStaffQRSecret(string $staffId): void
    {
        $newSecret = bin2hex(random_bytes(32));
        $expires = date('Y-m-d H:i:s', strtotime('+1 year'));

        $this->db->table('staff')
            ->where('id', $staffId)
            ->update([
                'qr_secret' => $newSecret,
                'qr_code_expires' => $expires,
                'updated_at' => date('Y-m-d H:i:s')
            ]);
    }

    /**
     * Refresh QR codes for all staff in a tenant
     * 
     * @param string $tenantId The tenant ID
     * @return int Number of staff members updated
     */
    public function refreshAllTenantQRCodes(string $tenantId): int
    {
        $staff = $this->db->table('staff')
            ->where('tenant_id', $tenantId)
            ->where('qr_code_expires <', date('Y-m-d H:i:s', strtotime('+30 days')))
            ->get()
            ->getResult();

        $count = 0;
        foreach ($staff as $member) {
            $this->refreshStaffQRSecret($member->id);
            $count++;
        }

        return $count;
    }

    /**
     * Invalidate QR codes for a staff member
     * 
     * @param string $staffId The staff member ID
     * @return void
     */
    public function invalidateStaffQRCodes(string $staffId): void
    {
        $this->db->table('staff')
            ->where('id', $staffId)
            ->update([
                'qr_secret' => null,
                'qr_code_expires' => null,
                'updated_at' => date('Y-m-d H:i:s')
            ]);
    }
}
