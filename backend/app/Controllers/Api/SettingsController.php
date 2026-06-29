<?php

namespace App\Controllers\Api;

use CodeIgniter\Database\Config;
use App\Services\AcademicCalendarService;
use App\Services\AcademicSessionService;
use Config\PaymentCategories;

class SettingsController extends BaseApiController
{
    protected $db;

    private const DEFAULT_SETTINGS = [
        'schoolName' => '',
        'contactEmail' => '',
        'contactPhone' => '',
        'address' => '',
        'defaultCurrency' => 'USD',
        'staffWorkHours' => ['startTime' => '08:30', 'endTime' => '17:00'],
        'studentWorkHours' => ['startTime' => '08:30', 'endTime' => '15:30'],
        'kioskModeEnabled' => false,
        'studentKioskModeEnabled' => false,
        'driverKioskModeEnabled' => false,
        'chargeProrationEnabled' => false,
        'studentAttendanceMode' => 'per_day',
    ];

    private const VALID_CURRENCIES = ['USD', 'ZWL', 'ZAR', 'EUR', 'GBP'];

    public function initController(\CodeIgniter\HTTP\RequestInterface $request, \CodeIgniter\HTTP\ResponseInterface $response, \Psr\Log\LoggerInterface $logger)
    {
        parent::initController($request, $response, $logger);
        $this->db = Config::connect();
    }

    private function getTenant(): ?array
    {
        return $this->db->table('tenants')
            ->where('id', $this->getTenantId())
            ->get()
            ->getRowArray();
    }

    private function getSettingsFromTenant(?array $tenant): array
    {
        if (!$tenant || empty($tenant['settings'])) {
            return [];
        }
        return json_decode($tenant['settings'], true) ?? [];
    }

    private function updateTenantField(string $field, $value): bool
    {
        return $this->db->table('tenants')
            ->where('id', $this->getTenantId())
            ->update([
                $field => is_string($value) ? $value : json_encode($value),
                'updated_at' => date('Y-m-d H:i:s')
            ]);
    }

    private function validateEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    private function validateWorkHours(?array $hours): bool
    {
        if (!$hours) return true;
        if (!isset($hours['startTime']) || !isset($hours['endTime'])) return false;
        return $hours['startTime'] < $hours['endTime'];
    }

    public function index()
    {
        $tenantId = $this->getTenantId();
        $tenant = $this->getTenant();
        $settings = $this->getSettingsFromTenant($tenant);

        return $this->success([
            'tenantId' => $tenantId,
            'schoolName' => $settings['schoolName'] ?? self::DEFAULT_SETTINGS['schoolName'],
            'contactEmail' => $settings['contactEmail'] ?? self::DEFAULT_SETTINGS['contactEmail'],
            'contactPhone' => $settings['contactPhone'] ?? self::DEFAULT_SETTINGS['contactPhone'],
            'address' => $settings['address'] ?? self::DEFAULT_SETTINGS['address'],
            'defaultCurrency' => $settings['defaultCurrency'] ?? self::DEFAULT_SETTINGS['defaultCurrency'],
            'academicYear' => $settings['academicYear'] ?? date('Y'),
            'activeAcademicSession' => $settings['activeAcademicSession'] ?? null,
            'staffWorkHours' => $settings['staffWorkHours'] ?? self::DEFAULT_SETTINGS['staffWorkHours'],
            'studentWorkHours' => $settings['studentWorkHours'] ?? self::DEFAULT_SETTINGS['studentWorkHours'],
            'kioskModeEnabled' => (bool) ($settings['kioskModeEnabled'] ?? self::DEFAULT_SETTINGS['kioskModeEnabled']),
            'studentKioskModeEnabled' => (bool) ($settings['studentKioskModeEnabled'] ?? self::DEFAULT_SETTINGS['studentKioskModeEnabled']),
            'driverKioskModeEnabled' => (bool) ($settings['driverKioskModeEnabled'] ?? self::DEFAULT_SETTINGS['driverKioskModeEnabled']),
            'chargeProrationEnabled' => (bool) ($settings['chargeProrationEnabled'] ?? self::DEFAULT_SETTINGS['chargeProrationEnabled']),
            'studentAttendanceMode' => $settings['studentAttendanceMode'] ?? self::DEFAULT_SETTINGS['studentAttendanceMode'],
            'kioskCode' => $settings['kiosk_code'] ?? null,
        ]);
    }

    public function update($id = null)
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        // Validate required fields
        if (isset($data['contactEmail']) && !empty($data['contactEmail'])) {
            if (!$this->validateEmail($data['contactEmail'])) {
                return $this->error('Invalid email address format', 400);
            }
        }

        // Validate currency
        if (isset($data['defaultCurrency']) && !in_array($data['defaultCurrency'], self::VALID_CURRENCIES)) {
            return $this->error('Invalid currency. Allowed: ' . implode(', ', self::VALID_CURRENCIES), 400);
        }

        // Validate work hours
        if (isset($data['staffWorkHours']) && !$this->validateWorkHours($data['staffWorkHours'])) {
            return $this->error('Staff start time must be before end time', 400);
        }
        if (isset($data['studentWorkHours']) && !$this->validateWorkHours($data['studentWorkHours'])) {
            return $this->error('Student start time must be before end time', 400);
        }

        $tenant = $this->getTenant();
        $existingSettings = $this->getSettingsFromTenant($tenant);

        // Auto-generate kiosk_code if one does not already exist.
        // Never accept kiosk_code from the request body — silently ignore if submitted.
        $kioskCode = $existingSettings['kiosk_code'] ?? null;
        if (empty($kioskCode)) {
            $kioskCode = bin2hex(random_bytes(5)); // 10 hex chars ≈ 10^12 combinations
        }

        // Validate activeAcademicSession if provided
        $sessionService = new AcademicSessionService();
        if (isset($data['activeAcademicSession']) && !$sessionService->isValidSession((string) $data['activeAcademicSession'])) {
            return $this->error('activeAcademicSession must be in YYYY/YYYY+1 format with consecutive years', 400);
        }

        // Build updated settings
        $updatedSettings = [
            'schoolName' => $data['schoolName'] ?? $existingSettings['schoolName'] ?? '',
            'contactEmail' => $data['contactEmail'] ?? $existingSettings['contactEmail'] ?? '',
            'contactPhone' => $data['contactPhone'] ?? $existingSettings['contactPhone'] ?? '',
            'address' => $data['address'] ?? $existingSettings['address'] ?? '',
            'defaultCurrency' => $data['defaultCurrency'] ?? $existingSettings['defaultCurrency'] ?? 'USD',
            'academicYear' => $data['academicYear'] ?? $existingSettings['academicYear'] ?? date('Y'),
            'activeAcademicSession' => $data['activeAcademicSession']
                ?? $existingSettings['activeAcademicSession']
                ?? null,
            'staffWorkHours' => $data['staffWorkHours'] ?? $existingSettings['staffWorkHours'] ?? self::DEFAULT_SETTINGS['staffWorkHours'],
            'studentWorkHours' => $data['studentWorkHours'] ?? $existingSettings['studentWorkHours'] ?? self::DEFAULT_SETTINGS['studentWorkHours'],
            'kioskModeEnabled' => (bool) ($data['kioskModeEnabled'] ?? $existingSettings['kioskModeEnabled'] ?? false),
            'studentKioskModeEnabled' => (bool) ($data['studentKioskModeEnabled'] ?? $existingSettings['studentKioskModeEnabled'] ?? false),
            'driverKioskModeEnabled' => (bool) ($data['driverKioskModeEnabled'] ?? $existingSettings['driverKioskModeEnabled'] ?? false),
            'chargeProrationEnabled' => (bool) ($data['chargeProrationEnabled'] ?? $existingSettings['chargeProrationEnabled'] ?? false),
            'studentAttendanceMode' => in_array($data['studentAttendanceMode'] ?? '', ['per_day', 'per_period'], true)
                ? $data['studentAttendanceMode']
                : ($existingSettings['studentAttendanceMode'] ?? self::DEFAULT_SETTINGS['studentAttendanceMode']),
            'kiosk_code' => $kioskCode,
        ];

        $this->updateTenantField('settings', $updatedSettings);

        return $this->success(array_merge($updatedSettings, [
            'kioskCode' => $kioskCode,
        ]), 'Settings saved successfully');
    }

    private function getFeeStructureFromTenant(?array $tenant): array
    {
        if (!$tenant || empty($tenant['fee_structure'])) {
            return [];
        }
        return json_decode($tenant['fee_structure'], true) ?? [];
    }

    private function getPaymentCategoriesFromTenant(?array $tenant): array
    {
        if (!$tenant || empty($tenant['payment_categories'])) {
            return [];
        }
        return json_decode($tenant['payment_categories'], true) ?? [];
    }

    private function getCalendarFromTenant(?array $tenant): array
    {
        if (!$tenant || empty($tenant['academic_calendar'])) {
            return [];
        }
        return json_decode($tenant['academic_calendar'], true) ?? [];
    }

    public function getFeeStructure()
    {
        $tenantId = $this->getTenantId();
        $tenant = $this->getTenant();
        $feeStructure = $this->getFeeStructureFromTenant($tenant);

        return $this->success([
            'tenantId' => $tenantId,
            'structureType' => $feeStructure['structureType'] ?? 'termly',
            'termsPerYear' => (int)($feeStructure['termsPerYear'] ?? 3),
        ]);
    }

    public function saveFeeStructure()
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        // Validate structure type
        $validStructureTypes = ['termly', 'monthly'];
        $structureType = $data['structureType'] ?? 'termly';
        if (!in_array($structureType, $validStructureTypes)) {
            return $this->error('Invalid structure type. Allowed: ' . implode(', ', $validStructureTypes), 400);
        }

        // Validate terms per year
        $termsPerYear = (int)($data['termsPerYear'] ?? 3);
        if ($termsPerYear < 1 || $termsPerYear > 4) {
            return $this->error('Terms per year must be between 1 and 4', 400);
        }

        $feeStructure = [
            'structureType' => $structureType,
            'termsPerYear' => $termsPerYear,
        ];

        $this->updateTenantField('fee_structure', $feeStructure);

        return $this->success($feeStructure, 'Fee structure saved successfully');
    }

    public function getPaymentCategories()
    {
        $tenantId = $this->getTenantId();
        $tenant = $this->getTenant();
        $categories = $this->getPaymentCategoriesFromTenant($tenant);

        // Add tenantId to each category for frontend compatibility
        $formatted = array_map(function($c) use ($tenantId) {
            $c['tenantId'] = $tenantId;
            $c['system'] = false;
            return $c;
        }, $categories);

        // Prepend system categories (feature 057 D3). These are not persisted
        // in tenants.settings.payment_categories — they are injected at read
        // time and protected from mutation by the create/update/delete guards.
        $systemCats = array_map(function($c) use ($tenantId) {
            return [
                'id'            => $c['id'],
                'tenantId'      => $tenantId,
                'name'          => $c['name'],
                'defaultAmount' => null,
                'active'        => true,
                'system'        => true,
            ];
        }, PaymentCategories::SYSTEM_CATEGORIES);

        return $this->success(array_merge($systemCats, $formatted));
    }

    public function createPaymentCategory()
    {
        $tenantId = $this->getTenantId();
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        // Validate required fields
        if (empty($data['name'])) {
            return $this->error('Category name is required', 400);
        }

        // Validate default amount if provided
        if (isset($data['defaultAmount']) && $data['defaultAmount'] !== null) {
            if (!is_numeric($data['defaultAmount']) || $data['defaultAmount'] < 0) {
                return $this->error('Default amount must be a positive number', 400);
            }
        }

        // System-name guard (feature 057)
        if (PaymentCategories::isSystemName((string) $data['name'])) {
            return $this->error('Cannot create a category with a reserved system name', 409);
        }

        $tenant = $this->getTenant();
        $categories = $this->getPaymentCategoriesFromTenant($tenant);

        // Check for duplicate names
        foreach ($categories as $category) {
            if (strtolower($category['name']) === strtolower($data['name'])) {
                return $this->error('A category with this name already exists', 409);
            }
        }

        $newCategory = [
            'id' => $this->generateId('cat'),
            'name' => trim($data['name']),
            'defaultAmount' => isset($data['defaultAmount']) ? (float)$data['defaultAmount'] : null,
            'active' => true,
            'createdAt' => date('Y-m-d H:i:s'),
            'updatedAt' => date('Y-m-d H:i:s')
        ];
        
        $categories[] = $newCategory;
        $this->updateTenantField('payment_categories', $categories);

        $newCategory['tenantId'] = $tenantId;
        return $this->created($newCategory);
    }

    public function updatePaymentCategory($id = null)
    {
        if (!$id) {
            return $this->error('Category ID is required', 400);
        }

        $data = $this->request->getJSON(true) ?? $this->request->getPost();
        $tenant = $this->getTenant();
        $categories = $this->getPaymentCategoriesFromTenant($tenant);

        if (empty($categories)) {
            return $this->error('Payment category not found', 404);
        }

        // Validate default amount if provided
        if (isset($data['defaultAmount']) && $data['defaultAmount'] !== null) {
            if (!is_numeric($data['defaultAmount']) || $data['defaultAmount'] < 0) {
                return $this->error('Default amount must be a positive number', 400);
            }
        }

        // System-name guard (feature 057): reject rename *to* a system name
        if (isset($data['name']) && PaymentCategories::isSystemName((string) $data['name'])) {
            return $this->error('System categories cannot be modified', 403);
        }

        $updated = false;
        $updatedCategory = null;

        foreach ($categories as &$category) {
            if ($category['id'] === $id) {
                // System-name guard: reject modification of a category whose
                // current name is a system name.
                if (PaymentCategories::isSystemName((string) ($category['name'] ?? ''))) {
                    return $this->error('System categories cannot be modified', 403);
                }
                $category['name'] = isset($data['name']) ? trim($data['name']) : $category['name'];
                $category['defaultAmount'] = $data['defaultAmount'] ?? $category['defaultAmount'];
                $category['active'] = $data['active'] ?? $category['active'];
                $category['updatedAt'] = date('Y-m-d H:i:s');
                $updatedCategory = $category;
                $updated = true;
                break;
            }
        }

        if (!$updated) {
            return $this->error('Payment category not found', 404);
        }

        $this->updateTenantField('payment_categories', $categories);

        return $this->success($updatedCategory, 'Category updated successfully');
    }

    public function deletePaymentCategory($id = null)
    {
        if (!$id) {
            return $this->error('Category ID is required', 400);
        }

        $tenant = $this->getTenant();
        $categories = $this->getPaymentCategoriesFromTenant($tenant);

        if (empty($categories)) {
            return $this->error('Payment category not found', 404);
        }

        // System-name guard (feature 057): reject deletion of any category
        // whose name matches a system category name.
        foreach ($categories as $cat) {
            if ($cat['id'] === $id && PaymentCategories::isSystemName((string) ($cat['name'] ?? ''))) {
                return $this->error('System categories cannot be deleted', 403);
            }
        }

        $originalCount = count($categories);
        $categories = array_values(array_filter($categories, fn($c) => $c['id'] !== $id));

        if (count($categories) === $originalCount) {
            return $this->error('Payment category not found', 404);
        }

        $this->updateTenantField('payment_categories', $categories);

        return $this->success(['success' => true, 'id' => $id], 'Category deleted successfully');
    }

    public function getCalendar()
    {
        $tenantId = $this->getTenantId();
        $tenant = $this->getTenant();
        $calendar = $this->getCalendarFromTenant($tenant);

        return $this->success([
            'tenantId' => $tenantId,
            'terms'    => $calendar['terms'] ?? [],
            'holidays' => $calendar['holidays'] ?? [],
        ]);
    }

    public function saveCalendar()
    {
        $data = $this->request->getJSON(true) ?? $this->request->getPost();

        // Validate terms if provided
        $terms = $data['terms'] ?? [];
        foreach ($terms as $index => $term) {
            if (empty($term['id']) || empty($term['name'])) {
                return $this->error("Term at index {$index} must have id and name", 400);
            }
            if (empty($term['start']) || empty($term['end'])) {
                return $this->error("Term '{$term['name']}' must have start and end dates", 400);
            }
            if ($term['start'] >= $term['end']) {
                return $this->error("Term '{$term['name']}' start date must be before end date", 400);
            }
        }

        // Validate term sequence — reject overlapping dates (Phase 5)
        if (count($terms) > 1) {
            $sorted = $terms;
            usort($sorted, fn($a, $b) => strcmp($a['start'], $b['start']));
            $calendarService = new AcademicCalendarService();
            $overlapErrors   = $calendarService->validateTermSequence($sorted);
            if (!empty($overlapErrors)) {
                return $this->error(
                    'Term dates overlap. Please fix the date conflicts before saving.',
                    400,
                    ['errorCode' => AcademicCalendarService::TERM_OVERLAP, 'overlaps' => $overlapErrors]
                );
            }
        }

        $academicCalendar = [
            'terms' => $terms,
        ];

        $this->updateTenantField('academic_calendar', $academicCalendar);

        return $this->success($academicCalendar, 'Calendar saved successfully');
    }

    /**
     * GET /api/settings/calendar-status
     *
     * Returns current term detection, calendar completeness, and whether
     * charge generation is currently permitted.
     */
    public function calendarStatus()
    {
        $tenant   = $this->getTenant();
        $calendar = $this->getCalendarFromTenant($tenant);

        $calendarService = new AcademicCalendarService();
        $status          = $calendarService->getCalendarStatus($calendar);

        return $this->success($status);
    }
}
