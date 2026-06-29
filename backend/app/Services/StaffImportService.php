<?php

namespace App\Services;

use App\Models\StaffModel;
use Config\Database;
use RuntimeException;

class StaffImportService
{
    private const REQUIRED_HEADERS = ['first_name', 'last_name'];
    private const TEMPLATE_HEADERS = ['first_name', 'last_name', 'email', 'phone', 'position', 'department', 'is_teaching', 'hire_date', 'date_of_birth', 'address', 'employment_status', 'employee_id', 'next_of_kin_name', 'next_of_kin_relationship', 'next_of_kin_phone'];

    public function buildTemplateCsv(): string
    {
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new RuntimeException('Unable to build CSV template.');
        }

        fputcsv($handle, self::TEMPLATE_HEADERS);
        fputcsv($handle, ['John', 'Doe', 'john.doe@school.edu', '+263771234567', 'Mathematics Teacher', 'Teaching Staff', 'yes', '2023-01-15', '1985-03-20', '123 Main Street, Harare', 'active', '', 'Jane Doe', 'Spouse', '+263779876543']);
        fputcsv($handle, ['Mary', 'Smith', 'mary.smith@school.edu', '+263772345678', 'Administrator', 'Administration', 'no', '2022-06-01', '1990-07-22', '', 'active', 'EMP0001', '', '', '']);
        rewind($handle);

        $csv = stream_get_contents($handle);
        fclose($handle);

        return $csv === false ? '' : $csv;
    }

    public function parseAndValidateCsv(string $filePath, string $tenantId): array
    {
        $handle = fopen($filePath, 'r');
        if ($handle === false) {
            throw new RuntimeException('Unable to read uploaded CSV file.');
        }

        $headers = fgetcsv($handle);
        if ($headers === false) {
            fclose($handle);
            return $this->validationResult([], []);
        }

        $headerMap = $this->normaliseHeaders($headers);

        // Detect if this is an exported staff list rather than an import-ready file
        if (array_key_exists('employee_id', $headerMap) && array_key_exists('status', $headerMap)) {
            // This is likely an export file - check for derived columns that exports include
            if ($this->looksLikeExportFile($headerMap)) {
                fclose($handle);
                return $this->validationResult([], [[
                    'row'     => 1,
                    'field'   => 'file',
                    'message' => 'This file looks like an exported staff list and cannot be used for import. Please download and use the import template instead.',
                ]]);
            }
        }

        $errors = $this->validateHeaders($headerMap);
        $existingEmails = $this->loadExistingEmails($tenantId);
        $existingEmployeeIds = $this->loadExistingEmployeeIds($tenantId);
        $seenEmails = [];
        $seenEmployeeIds = [];
        $rows = [];
        $rowNumber = 1;

        while (($csvRow = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if ($this->isBlankRow($csvRow)) {
                continue;
            }

            $row = $this->mapRow($csvRow, $headerMap, $rowNumber);
            $errors = array_merge($errors, $this->validateRow($row, $existingEmails, $existingEmployeeIds, $seenEmails, $seenEmployeeIds));
            $rows[] = $row;
        }

        fclose($handle);

        return $this->validationResult($rows, $errors);
    }

    public function executeBatchImport(array $rows, string $tenantId, object $user): array
    {
        $db = Database::connect();
        $staffModel = new StaffModel();
        $staffRows = [];
        $existingEmployeeIds = $this->loadExistingEmployeeIds($tenantId);
        $nextEmployeeSequence = $this->nextEmployeeSequence($tenantId);

        foreach ($rows as $row) {
            $employeeId = trim((string) ($row['employeeId'] ?? ''));
            if ($employeeId === '') {
                do {
                    $employeeId = 'EMP' . str_pad((string) $nextEmployeeSequence, 4, '0', STR_PAD_LEFT);
                    $nextEmployeeSequence++;
                } while (isset($existingEmployeeIds[strtolower($employeeId)]));
            }
            $existingEmployeeIds[strtolower($employeeId)] = true;

            $staffRows[] = [
                'id' => $this->generateId('st'),
                'tenant_id' => $tenantId,
                'first_name' => $row['firstName'],
                'last_name' => $row['lastName'],
                'email' => $row['email'] ?: null,
                'phone' => $row['phone'] ?: null,
                'position' => $row['position'] ?: null,
                'department' => $row['department'] ?: null,
                'is_teaching' => $row['isTeaching'] ? 1 : 0,
                'hire_date' => $row['hireDate'] ?: date('Y-m-d'),
                'date_of_birth' => $row['dateOfBirth'] ?: null,
                'address' => $row['address'] ?: null,
                'employment_status' => $row['employmentStatus'] ?: 'active',
                'employee_id' => $employeeId,
                'next_of_kin_name' => $row['nextOfKinName'] ?: null,
                'next_of_kin_relationship' => $row['nextOfKinRelationship'] ?: null,
                'next_of_kin_phone' => $row['nextOfKinPhone'] ?: null,
                'next_of_kin_email' => $row['nextOfKinEmail'] ?: null,
                'next_of_kin_address' => $row['nextOfKinAddress'] ?: null,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ];
        }

        $db->transStart();

        foreach (array_chunk($staffRows, 250) as $chunk) {
            if (!$staffModel->insertBatch($chunk)) {
                $db->transRollback();
                throw new RuntimeException('Failed to import staff batch.');
            }
        }

        $db->transComplete();

        if ($db->transStatus() === false) {
            throw new RuntimeException('Failed to import staff.');
        }

        return ['imported' => count($staffRows), 'skipped' => 0];
    }

    private function looksLikeExportFile(array $headerMap): bool
    {
        // Export files include derived columns like 'name' or certain computed fields
        $exportIndicators = ['name', 'next_of_kin'];
        foreach ($exportIndicators as $indicator) {
            if (array_key_exists($indicator, $headerMap)) {
                return true;
            }
        }
        return false;
    }

    private function normaliseHeaders(array $headers): array
    {
        $map = [];
        foreach ($headers as $index => $header) {
            $normalised = strtolower(trim((string) $header));
            if ($normalised !== '') {
                $map[$normalised] = $index;
            }
        }
        return $map;
    }

    private function validateHeaders(array $headerMap): array
    {
        $errors = [];
        foreach (self::REQUIRED_HEADERS as $header) {
            if (!array_key_exists($header, $headerMap)) {
                $errors[] = ['row' => 1, 'field' => $header, 'message' => "Missing required column {$header}"];
            }
        }
        return $errors;
    }

    private function mapRow(array $csvRow, array $headerMap, int $rowNumber): array
    {
        $value = static function (string $column) use ($csvRow, $headerMap): string {
            if (!array_key_exists($column, $headerMap)) {
                return '';
            }
            return trim((string) ($csvRow[$headerMap[$column]] ?? ''));
        };

        $isTeachingValue = strtolower($value('is_teaching'));
        $employmentStatusValue = strtolower($value('employment_status'));

        return [
            'rowNumber' => $rowNumber,
            'firstName' => $value('first_name'),
            'lastName' => $value('last_name'),
            'email' => $value('email'),
            'phone' => $value('phone'),
            'position' => $value('position'),
            'department' => $value('department'),
            'isTeaching' => in_array($isTeachingValue, ['yes', 'y', 'true', '1', 'teaching'], true),
            'hireDate' => $value('hire_date'),
            'dateOfBirth' => $value('date_of_birth'),
            'address' => $value('address'),
            'employmentStatus' => in_array($employmentStatusValue, ['active', 'on_leave', 'suspended', 'resigned', 'retired'], true)
                ? $employmentStatusValue
                : 'active',
            'employeeId' => $value('employee_id'),
            'nextOfKinName' => $value('next_of_kin_name'),
            'nextOfKinRelationship' => $value('next_of_kin_relationship'),
            'nextOfKinPhone' => $value('next_of_kin_phone'),
            'nextOfKinEmail' => $value('next_of_kin_email'),
            'nextOfKinAddress' => $value('next_of_kin_address'),
        ];
    }

    private function validateRow(array $row, array $existingEmails, array $existingEmployeeIds, array &$seenEmails, array &$seenEmployeeIds): array
    {
        $errors = [];
        $rowNumber = (int) $row['rowNumber'];

        if ($row['firstName'] === '') {
            $errors[] = $this->rowError($rowNumber, 'first_name', 'First name is required');
        } elseif (mb_strlen($row['firstName']) > 100) {
            $errors[] = $this->rowError($rowNumber, 'first_name', 'First name must be 100 characters or fewer');
        }

        if ($row['lastName'] === '') {
            $errors[] = $this->rowError($rowNumber, 'last_name', 'Last name is required');
        } elseif (mb_strlen($row['lastName']) > 100) {
            $errors[] = $this->rowError($rowNumber, 'last_name', 'Last name must be 100 characters or fewer');
        }

        if ($row['email'] !== '') {
            if (!filter_var($row['email'], FILTER_VALIDATE_EMAIL)) {
                $errors[] = $this->rowError($rowNumber, 'email', 'Invalid email address');
            } elseif (mb_strlen($row['email']) > 255) {
                $errors[] = $this->rowError($rowNumber, 'email', 'Email must be 255 characters or fewer');
            } else {
                $emailLower = strtolower($row['email']);
                if (isset($seenEmails[$emailLower])) {
                    $errors[] = $this->rowError($rowNumber, 'email', 'Duplicate email in uploaded file');
                } elseif (isset($existingEmails[$emailLower])) {
                    $errors[] = $this->rowError($rowNumber, 'email', 'Email is already in use at this school');
                }
                $seenEmails[$emailLower] = true;
            }
        }

        if ($row['phone'] !== '' && mb_strlen($row['phone']) > 50) {
            $errors[] = $this->rowError($rowNumber, 'phone', 'Phone must be 50 characters or fewer');
        }

        if ($row['position'] !== '' && mb_strlen($row['position']) > 100) {
            $errors[] = $this->rowError($rowNumber, 'position', 'Position must be 100 characters or fewer');
        }

        if ($row['department'] !== '' && mb_strlen($row['department']) > 100) {
            $errors[] = $this->rowError($rowNumber, 'department', 'Department must be 100 characters or fewer');
        }

        if ($row['hireDate'] !== '' && !$this->isValidDate($row['hireDate'])) {
            $errors[] = $this->rowError($rowNumber, 'hire_date', 'Invalid date format — expected YYYY-MM-DD');
        } elseif ($row['hireDate'] !== '' && $row['hireDate'] > date('Y-m-d')) {
            $errors[] = $this->rowError($rowNumber, 'hire_date', 'Hire date cannot be in the future');
        }

        if ($row['dateOfBirth'] !== '' && !$this->isValidDate($row['dateOfBirth'])) {
            $errors[] = $this->rowError($rowNumber, 'date_of_birth', 'Invalid date format — expected YYYY-MM-DD');
        } elseif ($row['dateOfBirth'] !== '' && $row['dateOfBirth'] > date('Y-m-d')) {
            $errors[] = $this->rowError($rowNumber, 'date_of_birth', 'Date of birth cannot be in the future');
        }

        $employeeId = strtolower($row['employeeId']);
        if ($employeeId !== '') {
            if (mb_strlen($row['employeeId']) > 50) {
                $errors[] = $this->rowError($rowNumber, 'employee_id', 'Employee ID must be 50 characters or fewer');
            } elseif (!preg_match('/^[A-Za-z0-9\-_]+$/', $row['employeeId'])) {
                $errors[] = $this->rowError($rowNumber, 'employee_id', 'Employee ID can only contain letters, numbers, hyphens, and underscores');
            } elseif (isset($seenEmployeeIds[$employeeId])) {
                $errors[] = $this->rowError($rowNumber, 'employee_id', 'Duplicate employee ID in uploaded file');
            } elseif (isset($existingEmployeeIds[$employeeId])) {
                $errors[] = $this->rowError($rowNumber, 'employee_id', 'Employee ID is already in use at this school');
            }
            $seenEmployeeIds[$employeeId] = true;
        }

        return $errors;
    }

    private function validationResult(array $rows, array $errors): array
    {
        return ['valid' => empty($errors), 'totalRows' => count($rows), 'errorCount' => count($errors), 'errors' => $errors, 'rows' => $rows];
    }

    private function loadExistingEmails(string $tenantId): array
    {
        $rows = Database::connect()->table('staff')->select('email')->where('tenant_id', $tenantId)->where('email IS NOT NULL', null, false)->get()->getResultArray();
        $values = [];
        foreach ($rows as $row) {
            $email = strtolower(trim((string) ($row['email'] ?? '')));
            if ($email !== '') {
                $values[$email] = true;
            }
        }
        return $values;
    }

    private function loadExistingEmployeeIds(string $tenantId): array
    {
        $rows = Database::connect()->table('staff')->select('employee_id')->where('tenant_id', $tenantId)->where('employee_id IS NOT NULL', null, false)->get()->getResultArray();
        $values = [];
        foreach ($rows as $row) {
            $id = strtolower(trim((string) ($row['employee_id'] ?? '')));
            if ($id !== '') {
                $values[$id] = true;
            }
        }
        return $values;
    }

    private function nextEmployeeSequence(string $tenantId): int
    {
        $result = Database::connect()->table('staff')
            ->select('employee_id')
            ->where('tenant_id', $tenantId)
            ->like('employee_id', 'EMP', 'after')
            ->orderBy('employee_id', 'DESC')
            ->limit(1)
            ->get()
            ->getRowArray();

        if (!$result) {
            return 1;
        }

        $employeeId = (string) $result['employee_id'];
        if (!str_starts_with($employeeId, 'EMP')) {
            return 1;
        }

        $numPart = substr($employeeId, 3);
        return is_numeric($numPart) ? ((int) $numPart) + 1 : 1;
    }

    private function isValidDate(string $value): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
            return false;
        }
        [$year, $month, $day] = array_map('intval', explode('-', $value));
        return checkdate($month, $day, $year);
    }

    private function isBlankRow(array $csvRow): bool
    {
        foreach ($csvRow as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }
        return true;
    }

    private function rowError(int $row, string $field, string $message): array
    {
        return ['row' => $row, 'field' => $field, 'message' => $message];
    }

    private function generateId(string $prefix): string
    {
        return $prefix . time() . '_' . bin2hex(random_bytes(4));
    }
}
