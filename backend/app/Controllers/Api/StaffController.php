<?php

namespace App\Controllers\Api;

use App\Models\StaffModel;
use App\Models\ClassModel;
use App\Services\QRCodeService;

class StaffController extends BaseApiController
{
    protected StaffModel $staffModel;
    protected ClassModel $classModel;

    public function __construct()
    {
        $this->staffModel = new StaffModel();
        $this->classModel = new ClassModel();
    }

    public function index()
    {
        $tenantId = $this->getTenantId();

        $pagination = $this->normalisePaginationParams(20, 100);
        if (isset($pagination['error'])) {
            return $this->error($pagination['error'], 400);
        }

        $allowedSortFields = ['name', 'department', 'employmentStatus', 'hireDate', 'createdAt'];
        $sort = $this->normaliseSortParams($allowedSortFields, 'name', 'asc');
        if (isset($sort['error'])) {
            return $this->error($sort['error'], 400);
        }

        $params = [
            'search'           => $this->sanitiseString($this->request->getGet('search')),
            'department'       => $this->sanitiseString($this->request->getGet('department')),
            'isTeaching'       => $this->sanitiseString($this->request->getGet('isTeaching')),
            'employmentStatus' => $this->sanitiseString($this->request->getGet('employmentStatus')),
            'sortBy'           => $sort['sortBy'],
            'sortOrder'        => $sort['sortOrder'],
            'page'             => $pagination['page'],
            'limit'            => $pagination['limit'],
        ];

        $result = $this->staffModel->getFiltered($tenantId, $params);
        return $this->success($result);
    }

    public function show($id = null)
    {
        $tenantId = $this->getTenantId();
        $staff = $this->staffModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$staff) {
            return $this->notFound('Staff not found');
        }
        return $this->success($this->staffModel->formatForApi($staff));
    }

    public function create()
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $tenantId = $this->getTenantId();

        if (empty($data['firstName']) || empty($data['lastName'])) {
            return $this->error('firstName and lastName are required', 400);
        }

        $staffId = $this->generateId('st');
        $staffData = $this->staffModel->formatFromApi($data, $tenantId);
        $staffData['id'] = $staffId;

        $this->staffModel->insert($staffData);
        $staff = $this->staffModel->find($staffId);
        return $this->created($this->staffModel->formatForApi($staff));
    }

    public function update($id = null)
    {
        $tenantId = $this->getTenantId();
        $staff = $this->staffModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$staff) {
            return $this->notFound('Staff not found');
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $updateData = $this->staffModel->formatFromApi($data, $tenantId);

        $this->staffModel->update($id, $updateData);
        $updated = $this->staffModel->find($id);
        return $this->success($this->staffModel->formatForApi($updated));
    }

    public function delete($id = null)
    {
        $tenantId = $this->getTenantId();
        $staff = $this->staffModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        if (!$staff) {
            return $this->notFound('Staff not found');
        }

        // Guard: block hard-delete if attendance or leave records exist
        $db = \CodeIgniter\Database\Config::connect();

        $hasAttendance = $db->table('staff_attendance')
            ->where('staff_id', $id)
            ->where('tenant_id', $tenantId)
            ->countAllResults() > 0;

        $hasLeave = $db->table('leave_requests')
            ->where('staff_id', $id)
            ->where('tenant_id', $tenantId)
            ->countAllResults() > 0;

        if ($hasAttendance || $hasLeave) {
            return $this->error(
                "Cannot delete staff member with existing attendance or leave records. " .
                "Change their employment status to 'resigned' or 'retired' instead.",
                409
            );
        }

        $this->staffModel->delete($id);
        return $this->success(['success' => true, 'id' => $id]);
    }

    public function teachers()
    {
        $tenantId = $this->getTenantId();
        $teachers = $this->staffModel->getTeachers($tenantId);
        $formatted = array_map(fn($t) => $this->staffModel->formatForApi($t), $teachers);
        return $this->success($formatted);
    }

    public function getClasses($id = null)
    {
        $staff = $this->staffModel->find($id);
        if (!$staff) {
            return $this->notFound('Staff not found');
        }

        $tenantId = $this->getTenantId();
        $classes = $this->classModel->getByTeacher($id, $tenantId);
        $formatted = array_map(fn($c) => $this->classModel->formatForApi($c), $classes);
        
        return $this->success($formatted);
    }

    /**
     * Generate QR code for a staff member
     */
    public function generateQRCode($id = null)
    {
        $tenantId = $this->getTenantId();
        $staff = $this->staffModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        
        if (!$staff) {
            return $this->notFound('Staff not found');
        }

        try {
            $qrService = new QRCodeService();
            $token = $qrService->generateQRToken($id, $tenantId);
            
            // Generate QR code image data
            $qrCode = $this->generateQRImage($token);
            
            return $this->success([
                'staff_id' => $id,
                'qr_token' => $token,
                'qr_code_data' => $qrCode,
                'expires_at' => $staff->qr_code_expires
            ]);
            
        } catch (\Exception $e) {
            return $this->error('Failed to generate QR code: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Generate QR codes for all staff members
     */
    public function bulkGenerateQRCodes()
    {
        $tenantId = $this->getTenantId();
        $staff = $this->staffModel->getByTenant($tenantId);
        
        if (empty($staff)) {
            return $this->success(['staff_qr_codes' => []]);
        }

        try {
            $qrService = new QRCodeService();
            $qrCodes = [];
            
            foreach ($staff as $member) {
                $token = $qrService->generateQRToken($member['id'], $tenantId);
                $qrCode = $this->generateQRImage($token);
                
                $qrCodes[] = [
                    'staff_id' => $member['id'],
                    'staff_name' => $member['first_name'] . ' ' . $member['last_name'],
                    'employee_id' => $member['employee_id'],
                    'qr_token' => $token,
                    'qr_code_data' => $qrCode,
                    'expires_at' => $member['qr_code_expires']
                ];
            }
            
            return $this->success([
                'staff_qr_codes' => $qrCodes,
                'generated_at' => date('Y-m-d H:i:s')
            ]);
            
        } catch (\Exception $e) {
            return $this->error('Failed to generate QR codes: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Generate QR code image from token
     */
    private function generateQRImage($token)
    {
        // This would use a QR code library like endroid/qr-code
        // For now, return base64 encoded placeholder
        // In production, this would generate actual QR code image
        return 'data:image/png;base64,' . base64_encode('QR_CODE_PLACEHOLDER');
    }

    /**
     * Download QR code as PNG image
     * GET /api/staff/{id}/qr-code.png
     */
    public function downloadQRCode($id = null)
    {
        $tenantId = $this->getTenantId();
        $staff = $this->staffModel->where('id', $id)->where('tenant_id', $tenantId)->first();
        
        if (!$staff) {
            return $this->notFound('Staff not found');
        }

        try {
            $qrService = new QRCodeService();
            $token = $qrService->generateQRToken($id, $tenantId);
            
            // Generate actual QR code image
            $qrImageData = $this->generateQRImagePNG($token);
            
            // Set response headers for PNG download
            $response = service('response');
            $response->setHeader('Content-Type', 'image/png');
            $response->setHeader('Content-Disposition', 'attachment; filename="' . 
                preg_replace('/[^a-zA-Z0-9]/', '_', $staff['first_name'] . '_' . $staff['last_name']) . 
                '_qr_code.png"');
            $response->setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            $response->setHeader('Pragma', 'no-cache');
            $response->setHeader('Expires', '0');
            
            // Output the image data
            $response->setBody($qrImageData);
            return $response;
            
        } catch (\Exception $e) {
            return $this->error('Failed to generate QR code: ' . $e->getMessage(), 500);
        }
    }

    /**
     * Generate QR code PNG image data
     */
    private function generateQRImagePNG($token)
    {
        // This would use a QR code library like endroid/qr-code
        // For now, return a simple placeholder PNG
        // In production, this would generate actual QR code image
        
        // Create a simple 200x200 PNG placeholder
        $image = imagecreate(200, 200);
        $bg = imagecolorallocate($image, 255, 255, 255);
        $text = imagecolorallocate($image, 0, 0, 0);
        
        // Add placeholder text
        imagestring($image, 3, 50, 90, 'QR CODE', $text);
        imagestring($image, 2, 30, 110, substr($token, 0, 20) . '...', $text);
        
        // Capture image to string
        ob_start();
        imagepng($image);
        $imageData = ob_get_contents();
        ob_end_clean();
        
        imagedestroy($image);
        return $imageData;
    }
}
