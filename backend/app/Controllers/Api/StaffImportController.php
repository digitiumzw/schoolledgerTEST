<?php

namespace App\Controllers\Api;

use App\Models\StaffModel;
use App\Services\StaffImportService;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

class StaffImportController extends BaseApiController
{
    private const MAX_FILE_SIZE = 10485760;

    private StaffImportService $importService;

    public function __construct()
    {
        $this->importService = new StaffImportService();
    }

    public function template(): ResponseInterface
    {
        if ($response = $this->requireRole('super_admin', 'admin')) {
            return $response;
        }

        try {
            $csv = $this->importService->buildTemplateCsv();
            return $this->setCorsHeaders(
                $this->response
                    ->setStatusCode(200)
                    ->setHeader('Content-Type', 'text/csv')
                    ->setHeader('Content-Disposition', 'attachment; filename="staff_import_template.csv"')
                    ->setBody($csv)
            );
        } catch (Throwable $e) {
            log_message('error', 'Staff import template generation failed: {message}', ['message' => $e->getMessage()]);
            return $this->serverError('Could not generate staff import template');
        }
    }

    public function validateImport(): ResponseInterface
    {
        if ($response = $this->requireRole('super_admin', 'admin')) {
            return $response;
        }

        $fileResult = $this->validatedUploadedFile();
        if (isset($fileResult['response'])) {
            return $fileResult['response'];
        }

        $tmpPath = $fileResult['path'];
        try {
            $result = $this->importService->parseAndValidateCsv($tmpPath, $this->getTenantId());

            // File-level errors (e.g. wrong format, export file) surface before the empty-rows guard
            if (!empty($result['errors']) && ($result['totalRows'] ?? 0) === 0) {
                $payload = $this->validationPayload($result);
                return $this->success($payload, "Validation failed — {$payload['errorCount']} row(s) have errors");
            }

            if (($result['totalRows'] ?? 0) === 0) {
                return $this->error('No staff records found in the file', 400);
            }

            $payload = $this->validationPayload($result);
            $message = $payload['valid']
                ? "All {$payload['totalRows']} rows are valid and ready to import"
                : "Validation failed — {$payload['errorCount']} row(s) have errors";

            return $this->success($payload, $message);
        } catch (Throwable $e) {
            log_message('error', 'Staff import validation failed: {message}', ['message' => $e->getMessage()]);
            return $this->serverError('Could not validate staff import file');
        } finally {
            $this->cleanupTempFile($tmpPath);
        }
    }

    public function execute(): ResponseInterface
    {
        if ($response = $this->requireRole('super_admin', 'admin')) {
            return $response;
        }

        $fileResult = $this->validatedUploadedFile();
        if (isset($fileResult['response'])) {
            return $fileResult['response'];
        }

        $tmpPath = $fileResult['path'];
        try {
            $tenantId = $this->getTenantId();
            $result = $this->importService->parseAndValidateCsv($tmpPath, $tenantId);

            // File-level errors (e.g. wrong format, export file) surface before the empty-rows guard
            if (!empty($result['errors']) && ($result['totalRows'] ?? 0) === 0) {
                $payload = $this->validationPayload($result);
                return $this->error("Validation failed — {$payload['errorCount']} row(s) have errors", 422, $payload);
            }

            if (($result['totalRows'] ?? 0) === 0) {
                return $this->error('No staff records found in the file', 400);
            }

            $payload = $this->validationPayload($result);
            if (!$payload['valid']) {
                return $this->error("Validation failed — {$payload['errorCount']} row(s) have errors", 422, $payload);
            }

            $importResult = $this->importService->executeBatchImport($result['rows'], $tenantId, $this->getCurrentUser() ?? (object) []);
            return $this->created($importResult, "{$importResult['imported']} staff members imported successfully");
        } catch (Throwable $e) {
            log_message('error', 'Staff import execution failed: {message}', ['message' => $e->getMessage()]);
            return $this->serverError('Could not import staff');
        } finally {
            $this->cleanupTempFile($tmpPath);
        }
    }

    public function export(): ResponseInterface
    {
        if ($response = $this->requireRole('super_admin', 'admin')) {
            return $response;
        }

        $tenantId = $this->getTenantId();
        $staffModel = new StaffModel();

        $department = $this->request->getGet('department') ?: null;
        $employmentStatus = $this->request->getGet('employmentStatus') ?: null;
        $search = $this->sanitiseString($this->request->getGet('search'));
        $isTeaching = $this->request->getGet('isTeaching');
        $sortBy = $this->request->getGet('sortBy') ?: 'name';
        $sortOrder = strtolower($this->request->getGet('sortOrder') ?: 'asc') === 'desc' ? 'desc' : 'asc';

        $validStatuses = ['all', 'active', 'on_leave', 'suspended', 'resigned', 'retired'];
        if ($employmentStatus !== null && !in_array($employmentStatus, $validStatuses, true)) {
            return $this->error('Invalid employment status value.', 400);
        }

        $validTeaching = ['all', 'yes', 'no', 'true', 'false'];
        if ($isTeaching !== null && !in_array($isTeaching, $validTeaching, true)) {
            return $this->error('Invalid isTeaching value.', 400);
        }

        try {
            $staff = $staffModel->getByTenant($tenantId);

            // Apply filters
            $filteredStaff = array_filter($staff, function ($s) use ($department, $employmentStatus, $search, $isTeaching) {
                $matchesDepartment = $department === null || $department === 'all' || ($s['department'] ?? '') === $department;
                $matchesStatus = $employmentStatus === null || $employmentStatus === 'all' || ($s['employment_status'] ?? 'active') === $employmentStatus;
                $matchesSearch = $search === '' ||
                    str_contains(strtolower($s['first_name'] ?? ''), strtolower($search)) ||
                    str_contains(strtolower($s['last_name'] ?? ''), strtolower($search)) ||
                    str_contains(strtolower($s['email'] ?? ''), strtolower($search)) ||
                    str_contains(strtolower($s['employee_id'] ?? ''), strtolower($search));

                $matchesTeaching = true;
                if ($isTeaching !== null && $isTeaching !== 'all') {
                    $isTeachingBool = in_array(strtolower($isTeaching), ['yes', 'true'], true);
                    $staffIsTeaching = (bool) ($s['is_teaching'] ?? false);
                    $matchesTeaching = $staffIsTeaching === $isTeachingBool;
                }

                return $matchesDepartment && $matchesStatus && $matchesSearch && $matchesTeaching;
            });

            // Sort
            usort($filteredStaff, function ($a, $b) use ($sortBy, $sortOrder) {
                $valueA = '';
                $valueB = '';

                switch ($sortBy) {
                    case 'name':
                        $valueA = ($a['last_name'] ?? '') . ', ' . ($a['first_name'] ?? '');
                        $valueB = ($b['last_name'] ?? '') . ', ' . ($b['first_name'] ?? '');
                        break;
                    case 'department':
                        $valueA = $a['department'] ?? '';
                        $valueB = $b['department'] ?? '';
                        break;
                    case 'position':
                        $valueA = $a['position'] ?? '';
                        $valueB = $b['position'] ?? '';
                        break;
                    case 'hireDate':
                        $valueA = $a['hire_date'] ?? '';
                        $valueB = $b['hire_date'] ?? '';
                        break;
                    case 'status':
                        $valueA = $a['employment_status'] ?? 'active';
                        $valueB = $b['employment_status'] ?? 'active';
                        break;
                    default:
                        $valueA = ($a['last_name'] ?? '') . ', ' . ($a['first_name'] ?? '');
                        $valueB = ($b['last_name'] ?? '') . ', ' . ($b['first_name'] ?? '');
                }

                $comparison = strcasecmp($valueA, $valueB);
                return $sortOrder === 'desc' ? -$comparison : $comparison;
            });

            $handle = fopen('php://temp', 'r+');
            if ($handle === false) {
                return $this->serverError('Could not generate export file');
            }

            fputcsv($handle, [
                'first_name', 'last_name', 'email', 'phone', 'position', 'department',
                'is_teaching', 'hire_date', 'date_of_birth', 'address',
                'employment_status', 'employee_id',
                'next_of_kin_name', 'next_of_kin_relationship', 'next_of_kin_phone',
            ]);

            foreach ($filteredStaff as $s) {
                fputcsv($handle, [
                    $s['first_name'] ?? '',
                    $s['last_name'] ?? '',
                    $s['email'] ?? '',
                    $s['phone'] ?? '',
                    $s['position'] ?? '',
                    $s['department'] ?? '',
                    ($s['is_teaching'] ?? false) ? 'yes' : 'no',
                    $s['hire_date'] ?? '',
                    $s['date_of_birth'] ?? '',
                    $s['address'] ?? '',
                    $s['employment_status'] ?? 'active',
                    $s['employee_id'] ?? '',
                    $s['next_of_kin_name'] ?? '',
                    $s['next_of_kin_relationship'] ?? '',
                    $s['next_of_kin_phone'] ?? '',
                ]);
            }

            rewind($handle);
            $csv = stream_get_contents($handle);
            fclose($handle);

            $filename = 'staff_export_' . date('Y-m-d') . '.csv';

            return $this->setCorsHeaders(
                $this->response
                    ->setStatusCode(200)
                    ->setHeader('Content-Type', 'text/csv; charset=UTF-8')
                    ->setHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
                    ->setBody($csv === false ? '' : $csv)
            );
        } catch (Throwable $e) {
            log_message('error', 'Staff export failed: {message}', ['message' => $e->getMessage()]);
            return $this->serverError('Could not export staff');
        }
    }

    private function validatedUploadedFile(): array
    {
        $file = $this->request->getFile('file');
        if (!$file || !$file->isValid()) {
            return ['response' => $this->error('No file uploaded', 400)];
        }

        if ($file->getSize() > self::MAX_FILE_SIZE) {
            return ['response' => $this->error('File exceeds the 10 MB upload limit', 413)];
        }

        $extension = strtolower((string) $file->getClientExtension());
        $mimeType = strtolower((string) $file->getClientMimeType());
        $allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'text/plain', 'application/csv'];
        if ($extension !== 'csv' || !in_array($mimeType, $allowedMimeTypes, true)) {
            return ['response' => $this->error('Invalid file type — please upload a CSV file', 400)];
        }

        $tmpPath = WRITEPATH . 'uploads/staff-import-' . bin2hex(random_bytes(8)) . '.csv';
        if (!$file->move(dirname($tmpPath), basename($tmpPath))) {
            return ['response' => $this->error('Could not store uploaded file', 500)];
        }

        return ['path' => $tmpPath];
    }

    private function validationPayload(array $result): array
    {
        return [
            'valid' => (bool) $result['valid'],
            'totalRows' => (int) $result['totalRows'],
            'errorCount' => (int) $result['errorCount'],
            'errors' => $result['errors'],
        ];
    }

    private function cleanupTempFile(string $path): void
    {
        if (is_file($path)) {
            @unlink($path);
        }
    }
}
