<?php

namespace App\Controllers\Api;

use App\Models\SchoolSubscriptionModel;
use App\Models\StudentModel;
use App\Models\SubscriptionPlanModel;
use App\Models\TenantModel;
use App\Models\UserModel;
use App\Services\EmailService;
use App\Services\StudentImportService;
use CodeIgniter\HTTP\ResponseInterface;
use Throwable;

class StudentImportController extends BaseApiController
{
    private const MAX_FILE_SIZE = 10485760;

    private StudentImportService $importService;

    public function __construct()
    {
        $this->importService = new StudentImportService();
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
                    ->setHeader('Content-Disposition', 'attachment; filename="student_import_template.csv"')
                    ->setBody($csv)
            );
        } catch (Throwable $e) {
            log_message('error', 'Student import template generation failed: {message}', ['message' => $e->getMessage()]);
            return $this->serverError('Could not generate student import template');
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
                return $this->error('No student records found in the file', 400);
            }

            $payload = $this->validationPayload($result);
            $message = $payload['valid']
                ? "All {$payload['totalRows']} rows are valid and ready to import"
                : "Validation failed — {$payload['errorCount']} row(s) have errors";

            return $this->success($payload, $message);
        } catch (Throwable $e) {
            log_message('error', 'Student import validation failed: {message}', ['message' => $e->getMessage()]);
            return $this->serverError('Could not validate student import file');
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
                return $this->error('No student records found in the file', 400);
            }

            $payload = $this->validationPayload($result);
            if (!$payload['valid']) {
                return $this->error("Validation failed — {$payload['errorCount']} row(s) have errors", 422, $payload);
            }

            if ($response = $this->enforceStudentLimit($tenantId, $payload['totalRows'])) {
                return $response;
            }

            $importResult = $this->importService->executeBatchImport($result['rows'], $tenantId, $this->getCurrentUser() ?? (object) []);
            return $this->created($importResult, "{$importResult['imported']} students imported successfully");
        } catch (Throwable $e) {
            log_message('error', 'Student import execution failed: {message}', ['message' => $e->getMessage()]);
            return $this->serverError('Could not import students');
        } finally {
            $this->cleanupTempFile($tmpPath);
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

        $tmpPath = WRITEPATH . 'uploads/student-import-' . bin2hex(random_bytes(8)) . '.csv';
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

    private function enforceStudentLimit(string $tenantId, int $incomingRows): ?ResponseInterface
    {
        $studentModel = new StudentModel();
        $currentCount = $studentModel->where('tenant_id', $tenantId)->where('status', 'active')->countAllResults();
        $activeSub = (new SchoolSubscriptionModel())->getActiveForTenant($tenantId);

        if ($activeSub) {
            $plan = (new SubscriptionPlanModel())->getPlanById($activeSub['plan_id']);
            if ($plan && $plan['max_students'] !== null && ($currentCount + $incomingRows) > (int) $plan['max_students']) {
                $this->notifyAdminsStudentLimitReached($tenantId, $plan['name'], (int) $plan['max_students'], $currentCount);
                return $this->error('Student limit reached for your current plan. Please upgrade to import more students.', 403);
            }
            return null;
        }

        if (($currentCount + $incomingRows) > 49) {
            $this->notifyAdminsStudentLimitReached($tenantId, 'Free Tier', 49, $currentCount);
            return $this->error('No active subscription found. Please subscribe to a plan to import more students.', 403);
        }

        return null;
    }

    private function notifyAdminsStudentLimitReached(
        string $tenantId,
        string $planName,
        int    $maxStudents,
        int    $currentCount
    ): void {
        try {
            $tenantModel = new TenantModel();
            $tenant      = $tenantModel->find($tenantId);
            $schoolName  = $tenant ? $tenantModel->getSchoolName($tenant) : 'Your School';

            $userModel = new UserModel();
            $users     = $userModel->getByTenant($tenantId);
            $admins    = array_filter($users, fn($u) => in_array($u['role'], ['admin', 'super_admin']));
            if (empty($admins)) {
                $admins = $users;
            }

            $emailService = new EmailService();
            foreach ($admins as $admin) {
                $emailService->sendStudentLimitReached(
                    $admin['email'],
                    $admin['name'] ?? 'Administrator',
                    $admin['email'],
                    $schoolName,
                    $planName,
                    $maxStudents,
                    $currentCount
                );
            }
        } catch (\Throwable $e) {
            log_message('error', 'Failed to send student limit notification for tenant {tenant}: {message}', [
                'tenant'  => $tenantId,
                'message' => $e->getMessage(),
            ]);
        }
    }

    public function export(): ResponseInterface
    {
        if ($response = $this->requireRole('super_admin', 'admin')) {
            return $response;
        }

        $tenantId    = $this->getTenantId();
        $studentModel = new StudentModel();

        $classId     = $this->request->getGet('classId') ?: null;
        $rawStatus   = $this->request->getGet('status') ?: null;
        $search      = $this->sanitiseString($this->request->getGet('search'));
        $balanceOnly = $this->request->getGet('balanceOnly') === 'true';
        $sortBy      = $this->request->getGet('sortBy') ?: 'name';
        $sortOrder   = strtolower($this->request->getGet('sortOrder') ?: 'asc') === 'desc' ? 'desc' : 'asc';

        $validStatuses = ['all', 'active', 'inactive', 'graduated', 'transferred', 'dropped_out'];
        if ($rawStatus !== null && !in_array($rawStatus, $validStatuses, true)) {
            return $this->error('Invalid status value.', 400);
        }

        $validSortFields = ['name', 'class', 'balance', 'status', 'admissionNumber'];
        if (!in_array($sortBy, $validSortFields, true)) {
            $sortBy = 'name';
        }

        try {
            $students = $studentModel->getFilteredStudents(
                $tenantId,
                $classId,
                $rawStatus,
                $search !== '' ? $search : null,
                $balanceOnly,
                $sortBy,
                $sortOrder,
                10000,
                0
            );

            $handle = fopen('php://temp', 'r+');
            if ($handle === false) {
                return $this->serverError('Could not generate export file');
            }

            fputcsv($handle, [
                'first_name', 'last_name', 'admission_number', 'date_of_birth',
                'gender', 'national_id', 'email', 'address',
                'guardian_name', 'guardian_phone', 'guardian_relationship',
                'class_name', 'status', 'enrollment_date',
            ]);

            foreach ($students as $s) {
                fputcsv($handle, [
                    $s['first_name']             ?? '',
                    $s['last_name']              ?? '',
                    $s['admission_number']       ?? '',
                    $s['date_of_birth']          ?? '',
                    $s['gender']                 ?? '',
                    $s['national_id']            ?? '',
                    $s['email']                  ?? '',
                    $s['address']                ?? '',
                    $s['guardian_name']          ?? '',
                    $s['guardian_phone']         ?? '',
                    $s['guardian_relationship']  ?? '',
                    $s['class_name']             ?? '',
                    $s['status']                 ?? '',
                    $s['enrollment_date']        ?? '',
                ]);
            }

            rewind($handle);
            $csv = stream_get_contents($handle);
            fclose($handle);

            $filename = 'students_export_' . date('Y-m-d') . '.csv';

            return $this->setCorsHeaders(
                $this->response
                    ->setStatusCode(200)
                    ->setHeader('Content-Type', 'text/csv; charset=UTF-8')
                    ->setHeader('Content-Disposition', 'attachment; filename="' . $filename . '"')
                    ->setBody($csv === false ? '' : $csv)
            );
        } catch (Throwable $e) {
            log_message('error', 'Student export failed: {message}', ['message' => $e->getMessage()]);
            return $this->serverError('Could not export students');
        }
    }

    private function cleanupTempFile(string $path): void
    {
        if (is_file($path)) {
            @unlink($path);
        }
    }
}
