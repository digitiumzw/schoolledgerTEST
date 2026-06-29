<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;
use App\Services\QRCodeService;
use App\Services\StaffAttendanceService;

/**
 * KioskController
 *
 * Handles public kiosk endpoints for staff sign-in and sign-out.
 * These endpoints are intentionally exempt from JWTAuthFilter because the
 * kiosk page must be accessible without an authenticated session.
 *
 * Security model:
 * - All requests must supply either a valid kiosk_code (new) or tenant_id (legacy).
 *   The kiosk_code is an opaque 10-character alphanumeric token stored in
 *   tenants.settings — it does not expose the internal tenant UUID.
 * - Write actions additionally require the staff member's employee_id.
 * - Kiosk mode must be enabled in tenant settings for any data to be returned.
 * - Error messages for invalid employee IDs deliberately avoid distinguishing
 *   "not found" from "inactive" to prevent staff enumeration.
 *
 * See: specs/010-kiosk-employee-id/plan.md — Complexity Tracking for the
 * justified exception to Constitution Principle III.
 */
class KioskController extends BaseApiController
{
    protected $db;

    public function __construct()
    {
        $this->db = Config::connect();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // GET /api/kiosk/status/:code  (new)
    // GET /api/kiosk/status?tenant_id={id}  (legacy fallback)
    // ──────────────────────────────────────────────────────────────────────────

    public function status($code = null)
    {
        $tenant = $this->resolveTenant($code);

        if ($tenant === null) {
            return $this->notFound('Kiosk not found');
        }

        $settings    = json_decode($tenant['settings'] ?? '{}', true) ?? [];
        $kioskEnabled = (bool) ($settings['kioskModeEnabled'] ?? false);
        $workHours   = $settings['staffWorkHours'] ?? ['startTime' => '08:30', 'endTime' => '17:00'];
        $schoolName  = $settings['schoolName'] ?? '';

        if (!$kioskEnabled) {
            return $this->success([
                'kioskEnabled' => false,
                'schoolName'   => $schoolName,
                'workHours'    => null,
                'date'         => date('Y-m-d'),
            ]);
        }

        return $this->success([
            'kioskEnabled' => true,
            'schoolName'   => $schoolName,
            'workHours'    => [
                'startTime' => $workHours['startTime'] ?? '08:30',
                'endTime'   => $workHours['endTime']   ?? '17:00',
            ],
            'date' => date('Y-m-d'),
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // POST /api/kiosk/action
    // ──────────────────────────────────────────────────────────────────────────

    public function action()
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        // ── Resolve tenant ────────────────────────────────────────────────────
        $kioskCode  = $data['kiosk_code'] ?? null;
        $employeeId = $data['employee_id'] ?? null;

        // Legacy fallback: old clients send tenant_id + staff_id + action
        $legacyTenantId = $data['tenant_id'] ?? null;
        $legacyStaffId  = $data['staff_id']  ?? null;

        if (empty($kioskCode) && empty($legacyTenantId)) {
            return $this->error('kiosk_code is required', 400);
        }

        if (empty($employeeId) && empty($legacyStaffId)) {
            return $this->error('employee_id is required', 400);
        }

        $tenant = $this->resolveTenant($kioskCode, $legacyTenantId);

        if ($tenant === null) {
            return $this->forbidden('Employee ID not recognized');
        }

        $tenantId    = $tenant['id'];
        $settings    = json_decode($tenant['settings'] ?? '{}', true) ?? [];
        $kioskEnabled = (bool) ($settings['kioskModeEnabled'] ?? false);

        if (!$kioskEnabled) {
            return $this->forbidden('Kiosk mode is not enabled for this school');
        }

        // ── Resolve staff ─────────────────────────────────────────────────────
        if (!empty($employeeId)) {
            // New flow: look up by employee_id
            $staff = $this->db->table('staff')
                ->where('employee_id', $employeeId)
                ->where('tenant_id', $tenantId)
                ->where('employment_status', 'active')
                ->get()->getRowArray();
        } else {
            // Legacy flow: look up by staff_id and verify employee_id if provided
            $staff = $this->db->table('staff')
                ->where('id', $legacyStaffId)
                ->where('tenant_id', $tenantId)
                ->where('employment_status', 'active')
                ->get()->getRowArray();
        }

        // Unified 403 for not found, inactive, or wrong tenant — prevents enumeration
        if (!$staff) {
            return $this->forbidden('Employee ID not recognized');
        }

        $today     = date('Y-m-d');
        $now       = date('H:i');
        $staffName = trim($staff['first_name'] . ' ' . $staff['last_name']);
        $staffId   = $staff['id'];

        $workHours = $settings['staffWorkHours'] ?? ['startTime' => '08:30', 'endTime' => '17:00'];
        $startTime = $workHours['startTime'] ?? '08:30';
        $endTime   = $workHours['endTime']   ?? '17:00';

        // ── Find existing attendance record for today ──────────────────────────
        $existing = $this->db->table('staff_attendance')
            ->where('tenant_id', $tenantId)
            ->where('staff_id', $staffId)
            ->where('date', $today)
            ->get()->getRowArray();

        // ── Auto-detect action ────────────────────────────────────────────────
        // If the legacy client sent an explicit action, respect it; otherwise auto-detect.
        $explicitAction = $data['action'] ?? null;

        if ($explicitAction === 'check_in' || (!$explicitAction && (!$existing || empty($existing['check_in'])))) {
            return $this->handleCheckIn($tenantId, $staffId, $staffName, $today, $now, $startTime, $existing);
        }

        return $this->handleCheckOut($tenantId, $staffId, $staffName, $today, $now, $endTime, $existing);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Resolve a tenant from an opaque kiosk code (new) or raw tenant_id (legacy).
     * Returns the tenant row array or null if not found.
     */
    private function resolveTenant(?string $code, ?string $legacyTenantId = null): ?array
    {
        if (!empty($code)) {
            $tenant = $this->db->query(
                "SELECT * FROM tenants
                  WHERE JSON_UNQUOTE(JSON_EXTRACT(settings, '$.kiosk_code')) = ?",
                [$code]
            )->getRowArray();

            if ($tenant) {
                return $tenant;
            }
        }

        // Fall back to legacy ?tenant_id= query param or request body tenant_id
        $tenantId = $legacyTenantId ?? $this->request->getGet('tenant_id');

        if (empty($tenantId)) {
            return null;
        }

        return $this->db->table('tenants')
            ->where('id', $tenantId)
            ->get()->getRowArray() ?: null;
    }

    private function handleCheckIn(
        string $tenantId,
        string $staffId,
        string $staffName,
        string $today,
        string $now,
        string $startTime,
        ?array $existing
    ) {
        $service = new StaffAttendanceService();
        $config = $service->getWorkHoursConfig($tenantId);

        // Use service for proper status classification
        $status = $service->classifyStatus($now, null, $config['startTime'], $config['endTime'], $config['standardHours']);

        if ($existing) {
            $this->db->table('staff_attendance')
                ->where('id', $existing['id'])
                ->update([
                    'check_in'   => $now,
                    'status'     => $status,
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
        } else {
            $this->db->table('staff_attendance')->insert([
                'id'         => $this->generateId('sa'),
                'tenant_id'  => $tenantId,
                'staff_id'   => $staffId,
                'date'       => $today,
                'check_in'   => $now,
                'status'     => $status,
                'source'     => 'kiosk',
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }

        return $this->success([
            'staffName'        => $staffName,
            'action'           => 'check_in',
            'timestamp'        => $now,
            'date'             => $today,
            'attendanceStatus' => $status,
        ]);
    }

    private function handleCheckOut(
        string $tenantId,
        string $staffId,
        string $staffName,
        string $today,
        string $now,
        string $endTime,
        ?array $existing
    ) {
        if (!$existing || empty($existing['check_in'])) {
            return $this->error('No check-in record found for today. Please sign in first.', 400);
        }

        $checkInTime  = strtotime($today . ' ' . $existing['check_in']);
        $checkOutTime = strtotime($today . ' ' . $now);

        if ($checkOutTime <= $checkInTime) {
            return $this->error('Check-out time must be after check-in time', 400);
        }

        $service = new StaffAttendanceService();
        $config = $service->getWorkHoursConfig($tenantId);

        $workHoursDecimal = round(($checkOutTime - $checkInTime) / 3600, 2);

        // Use service for proper status classification (includes half_day, early_departure logic)
        $status = $service->classifyStatus($existing['check_in'], $now, $config['startTime'], $config['endTime'], $config['standardHours']);

        // Calculate overtime
        $overtimeHours = $service->calculateOvertimeHours($workHoursDecimal, $config['standardHours']);

        $this->db->table('staff_attendance')
            ->where('id', $existing['id'])
            ->update([
                'check_out'      => $now,
                'work_hours'     => $workHoursDecimal,
                'overtime_hours' => $overtimeHours,
                'status'         => $status,
                'updated_at'     => date('Y-m-d H:i:s'),
            ]);

        return $this->success([
            'staffName'        => $staffName,
            'action'           => 'check_out',
            'timestamp'        => $now,
            'date'             => $today,
            'attendanceStatus' => $status,
            'workHours'        => $workHoursDecimal,
            'overtimeHours'    => $overtimeHours,
            'earlyDeparture'   => $status === 'early_departure',
        ]);
    }


    /**
     * Validate QR code and process attendance
     * POST /api/kiosk/qr-scan
     */
    public function qrScan()
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        
        if (empty($data['qr_token'])) {
            return $this->error('QR token is required', 400);
        }

        // Rate limiting check (simple implementation)
        $ip = $this->request->getIPAddress();
        $cache = \Config\Services::cache();
        $rateLimitKey = "qr_scan_limit_{$ip}";
        $attempts = $cache->get($rateLimitKey) ?? 0;
        
        if ($attempts >= 10) {
            // Log rate limit exceeded
            log_message('warning', "QR scan rate limit exceeded for IP: {$ip}");
            return $this->error('Too many attempts. Please try again later.', 429);
        }
        
        // Increment rate limit counter (expires in 1 minute)
        $cache->save($rateLimitKey, $attempts + 1, 60);

        try {
            $qrService = new QRCodeService();
            $staff = $qrService->validateQRToken($data['qr_token']);
            
            // Check if kiosk is enabled for this tenant
            $tenant = $this->db->table('tenants')
                ->where('id', $staff->tenant_id)
                ->get()
                ->getRowArray();
                
            if (!$tenant) {
                log_message('warning', "QR scan failed - tenant not found for staff: {$staff->staff_id}");
                return $this->error('Invalid QR code', 400);
            }
            
            $settings = json_decode($tenant['settings'] ?? '{}', true) ?? [];
            $kioskEnabled = (bool) ($settings['kioskModeEnabled'] ?? false);
            
            if (!$kioskEnabled) {
                log_message('warning', "QR scan failed - kiosk mode disabled for tenant: {$staff->tenant_id}");
                return $this->error('Kiosk mode is not enabled', 403);
            }
            
            // Check if staff is active
            if ($staff->employment_status !== 'active') {
                log_message('warning', "QR scan failed - inactive staff: {$staff->staff_id}");
                return $this->error('Invalid QR code', 400);
            }
            
            // Process attendance
            $result = $this->processAttendanceForStaff($staff, $settings);
            
            // Clear rate limit on success
            $cache->delete($rateLimitKey);
            
            return $this->success($result);
            
        } catch (\Exception $e) {
            // Log failed validation attempt
            log_message('warning', "QR scan validation failed: " . $e->getMessage());
            
            // Generic error message for security
            return $this->error('Invalid QR code', 400);
        }
    }
    
    /**
     * Process attendance for staff member from QR scan
     */
    private function processAttendanceForStaff($staff, $settings): array
    {
        $today = date('Y-m-d');
        $now = date('H:i');
        $staffName = $staff->first_name . ' ' . $staff->last_name;
        
        // Check existing attendance for today
        $existing = $this->db->table('staff_attendance')
            ->where('staff_id', $staff->staff_id)
            ->where('date', $today)
            ->get()
            ->getRowArray();
            
        if ($existing) {
            if (empty($existing['check_out'])) {
                // Check out
                $workHours = $this->calculateWorkHours($existing['check_in'], $now, $settings);
                
                $this->db->table('staff_attendance')
                    ->where('id', $existing['id'])
                    ->update([
                        'check_out' => $now,
                        'work_hours' => $workHours['hours'],
                        'status' => $workHours['status'],
                        'source' => 'kiosk_qr',
                        'updated_at' => date('Y-m-d H:i:s')
                    ]);
                    
                return [
                    'staffName' => $staffName,
                    'action' => 'check_out',
                    'timestamp' => $now,
                    'date' => $today,
                    'attendanceStatus' => $workHours['status'],
                    'workHours' => $workHours['hours']
                ];
            } else {
                // Already checked out
                return [
                    'staffName' => $staffName,
                    'action' => 'already_completed',
                    'timestamp' => $now,
                    'date' => $today,
                    'attendanceStatus' => $existing['status'],
                    'workHours' => $existing['work_hours']
                ];
            }
        } else {
            // Check in
            $status = $this->determineCheckInStatus($now, $settings);
            
            $this->db->table('staff_attendance')
                ->insert([
                    'staff_id' => $staff->staff_id,
                    'tenant_id' => $staff->tenant_id,
                    'date' => $today,
                    'check_in' => $now,
                    'status' => $status,
                    'source' => 'kiosk_qr',
                    'created_at' => date('Y-m-d H:i:s'),
                    'updated_at' => date('Y-m-d H:i:s')
                ]);
                
            return [
                'staffName' => $staffName,
                'action' => 'check_in',
                'timestamp' => $now,
                'date' => $today,
                'attendanceStatus' => $status
            ];
        }
    }
    
    /**
     * Calculate work hours and status for check out using StaffAttendanceService
     */
    private function calculateWorkHours($checkIn, $checkOut, $settings): array
    {
        $service = new StaffAttendanceService();
        $workHours = $settings['staffWorkHours'] ?? ['startTime' => '08:30', 'endTime' => '17:00'];
        $startTime = $workHours['startTime'];
        $endTime = $workHours['endTime'];

        $checkInTime = strtotime(date('Y-m-d') . ' ' . $checkIn);
        $checkOutTime = strtotime(date('Y-m-d') . ' ' . $checkOut);

        $hours = round(($checkOutTime - $checkInTime) / 3600, 2);
        $standardHours = $service->getWorkHoursConfig('')['standardHours'] ?? 8.5;

        // Use service for proper status classification
        $status = $service->classifyStatus($checkIn, $checkOut, $startTime, $endTime, $standardHours);
        $overtimeHours = $service->calculateOvertimeHours($hours, $standardHours);

        return [
            'hours' => $hours,
            'status' => $status,
            'overtimeHours' => $overtimeHours
        ];
    }

    /**
     * Determine check-in status based on arrival time using StaffAttendanceService
     */
    private function determineCheckInStatus($time, $settings): string
    {
        $service = new StaffAttendanceService();
        $workHours = $settings['staffWorkHours'] ?? ['startTime' => '08:30', 'endTime' => '17:00'];
        $startTime = $workHours['startTime'];
        $endTime = $workHours['endTime'];
        $standardHours = $service->getWorkHoursConfig('')['standardHours'] ?? 8.5;

        return $service->classifyStatus($time, null, $startTime, $endTime, $standardHours);
    }
}
