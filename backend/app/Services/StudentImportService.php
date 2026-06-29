<?php

namespace App\Services;

use App\Models\StudentModel;
use Config\Database;
use RuntimeException;

class StudentImportService
{
    private const REQUIRED_HEADERS = ['first_name', 'last_name', 'date_of_birth', 'gender'];
    private const TEMPLATE_HEADERS = ['first_name', 'last_name', 'date_of_birth', 'gender', 'national_id', 'email', 'address', 'guardian_name', 'guardian_phone', 'guardian_relationship', 'admission_number', 'opening_balance'];

    public function buildTemplateCsv(): string
    {
        $handle = fopen('php://temp', 'r+');
        if ($handle === false) {
            throw new RuntimeException('Unable to build CSV template.');
        }

        fputcsv($handle, self::TEMPLATE_HEADERS);
        fputcsv($handle, ['John', 'Doe', '2010-03-15', 'male', '', '', '123 Main Street', 'Jane Doe', '+263771234567', 'Mother', '', '150.00']);
        fputcsv($handle, ['Mary', 'Smith', '2011-07-22', 'female', '', '', '', '', '', '', 'ADM-2024-001', '']);
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

        // Detect if this is an exported student list rather than an import-ready file
        if (array_key_exists('class_name', $headerMap) || array_key_exists('enrollment_date', $headerMap)) {
            fclose($handle);
            return $this->validationResult([], [[
                'row'     => 1,
                'field'   => 'file',
                'message' => 'This file looks like an exported student list and cannot be used for import. Please download and use the import template instead.',
            ]]);
        }

        $errors = $this->validateHeaders($headerMap);
        $existingKeys = $this->loadExistingStudentKeys($tenantId);
        $existingAdmissionNumbers = $this->loadExistingAdmissionNumbers($tenantId);
        $seenKeys = [];
        $seenAdmissionNumbers = [];
        $rows = [];
        $rowNumber = 1;

        while (($csvRow = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if ($this->isBlankRow($csvRow)) {
                continue;
            }

            $row = $this->mapRow($csvRow, $headerMap, $rowNumber);
            $errors = array_merge($errors, $this->validateRow($row, $existingKeys, $existingAdmissionNumbers, $seenKeys, $seenAdmissionNumbers));
            $rows[] = $row;
        }

        fclose($handle);

        return $this->validationResult($rows, $errors);
    }

    public function executeBatchImport(array $rows, string $tenantId, object $user): array
    {
        $db = Database::connect();
        $studentModel = new StudentModel();
        $changedBy = (string) ($user->id ?? 'system');
        $admissionNumbers = $this->loadExistingAdmissionNumbers($tenantId);
        $nextAdmissionSequence = $this->nextAdmissionSequence($tenantId);

        $db->transStart();

        $chunk = [];
        $insertedIds = [];

        foreach ($this->studentRowGenerator($rows, $tenantId, $admissionNumbers, $nextAdmissionSequence) as $studentRow) {
            $insertedIds[] = $studentRow['id'];
            $chunk[]       = $studentRow;

            if (count($chunk) >= 250) {
                if (!$studentModel->insertBatch($chunk)) {
                    $db->transRollback();
                    throw new RuntimeException('Failed to import student batch.');
                }
                $chunk = [];
            }
        }

        if (!empty($chunk)) {
            if (!$studentModel->insertBatch($chunk)) {
                $db->transRollback();
                throw new RuntimeException('Failed to import student batch.');
            }
        }

        $today = date('Y-m-d');
        $now   = date('Y-m-d H:i:s');

        foreach ($insertedIds as $insertedId) {
            $studentModel->recordStatusHistory($tenantId, $insertedId, null, 'active', $today, 'Bulk CSV import', $changedBy);
        }

        $openingBalanceFeeRuleId = null;
        foreach ($rows as $index => $row) {
            $amount = (float) ($row['openingBalance'] ?? 0);
            if ($amount <= 0) {
                continue;
            }
            if ($openingBalanceFeeRuleId === null) {
                $openingBalanceFeeRuleId = $this->ensureOpeningBalanceFeeRule($db, $tenantId, $changedBy);
            }
            $studentId = $insertedIds[$index] ?? null;
            if ($studentId === null) {
                continue;
            }
            $db->table('charges')->insert([
                'id'                 => $this->generateId('c'),
                'tenant_id'          => $tenantId,
                'student_id'         => $studentId,
                'fee_rule_id'        => $openingBalanceFeeRuleId,
                'category'           => 'Opening Balance',
                'charge_type'        => 'fee_structure',
                'status'             => 'pending',
                'amount'             => $amount,
                'description'        => 'Balance brought forward from previous system',
                'date_generated'     => $today,
                'due_date'           => null,
                'billing_period'     => null,
                'is_opening_balance' => 1,
                'created_by'         => $changedBy,
                'created_at'         => $now,
                'updated_at'         => $now,
            ]);
        }

        $db->transComplete();

        if ($db->transStatus() === false) {
            throw new RuntimeException('Failed to import students.');
        }

        return ['imported' => count($insertedIds), 'skipped' => 0];
    }

    /**
     * Generator that yields one student DB row at a time from validated CSV rows.
     * Prevents holding the entire $studentRows array in memory alongside $rows.
     *
     * @param array  $rows                  Validated rows from parseAndValidateCsv().
     * @param string $tenantId              Tenant scope.
     * @param array  &$admissionNumbers     Mutable map for in-flight deduplication.
     * @param int    &$nextAdmissionSeq     Mutable sequence counter for auto-numbering.
     *
     * @return \Generator<int, array>
     */
    private function studentRowGenerator(
        array  $rows,
        string $tenantId,
        array  &$admissionNumbers,
        int    &$nextAdmissionSeq
    ): \Generator {
        $today = date('Y-m-d');

        foreach ($rows as $row) {
            $admissionNumber = trim((string) ($row['admissionNumber'] ?? ''));
            if ($admissionNumber === '') {
                do {
                    $admissionNumber = date('Y') . '/' . str_pad((string) $nextAdmissionSeq, 3, '0', STR_PAD_LEFT);
                    $nextAdmissionSeq++;
                } while (isset($admissionNumbers[strtolower($admissionNumber)]));
            }
            $admissionNumbers[strtolower($admissionNumber)] = true;

            yield [
                'id'                   => $this->generateId('s'),
                'tenant_id'            => $tenantId,
                'first_name'           => $row['firstName'],
                'last_name'            => $row['lastName'],
                'admission_number'     => $admissionNumber,
                'gender'               => $row['gender'],
                'national_id'          => $row['nationalId'] ?: null,
                'class_id'             => null,
                'current_enrollment_id' => null,
                'date_of_birth'        => $row['dateOfBirth'],
                'email'                => $row['email'],
                'address'              => $row['address'],
                'guardian_name'        => $row['guardianName'],
                'guardian_phone'       => $row['guardianPhone'],
                'guardian_relationship' => $row['guardianRelationship'],
                'enrollment_date'      => $today,
                'status'               => 'active',
                'bursary_status'       => 'none',
                'bursary_percentage'   => 0,
                'bursary_reason'       => null,
            ];
        }
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

        return [
            'rowNumber' => $rowNumber,
            'firstName' => $value('first_name'),
            'lastName' => $value('last_name'),
            'dateOfBirth' => $value('date_of_birth'),
            'gender' => strtolower($value('gender')),
            'nationalId' => $value('national_id'),
            'email' => $value('email'),
            'address' => $value('address'),
            'guardianName' => $value('guardian_name'),
            'guardianPhone' => $value('guardian_phone'),
            'guardianRelationship' => $value('guardian_relationship'),
            'admissionNumber' => $value('admission_number'),
            'openingBalance' => $value('opening_balance'),
        ];
    }

    private function validateRow(array $row, array $existingKeys, array $existingAdmissionNumbers, array &$seenKeys, array &$seenAdmissionNumbers): array
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

        if (!$this->isValidDate($row['dateOfBirth'])) {
            $errors[] = $this->rowError($rowNumber, 'date_of_birth', 'Invalid date format — expected YYYY-MM-DD');
        } elseif ($row['dateOfBirth'] > date('Y-m-d')) {
            $errors[] = $this->rowError($rowNumber, 'date_of_birth', 'Date of birth cannot be in the future');
        }

        if (!in_array($row['gender'], ['male', 'female'], true)) {
            $errors[] = $this->rowError($rowNumber, 'gender', "Invalid value — must be 'male' or 'female'");
        }

        if ($row['email'] !== '' && !filter_var($row['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = $this->rowError($rowNumber, 'email', 'Invalid email address');
        }

        $duplicateKey = $this->duplicateKey($row['firstName'], $row['lastName'], $row['dateOfBirth']);
        if ($duplicateKey !== null) {
            if (isset($seenKeys[$duplicateKey])) {
                $errors[] = $this->rowError($rowNumber, 'first_name', 'Duplicate student in uploaded file');
            } elseif (isset($existingKeys[$duplicateKey])) {
                $errors[] = $this->rowError($rowNumber, 'first_name', 'Student already exists');
            }
            $seenKeys[$duplicateKey] = true;
        }

        $openingBalance = $row['openingBalance'];
        if ($openingBalance !== '') {
            if (!is_numeric($openingBalance)) {
                $errors[] = $this->rowError($rowNumber, 'opening_balance', 'Opening balance must be a numeric value (e.g. 150.00)');
            } elseif ((float) $openingBalance < 0) {
                $errors[] = $this->rowError($rowNumber, 'opening_balance', 'Opening balance cannot be negative');
            } elseif ((float) $openingBalance > 9999999) {
                $errors[] = $this->rowError($rowNumber, 'opening_balance', 'Opening balance exceeds the maximum allowed value of 9,999,999');
            }
        }

        $admissionNumber = strtolower($row['admissionNumber']);
        if ($admissionNumber !== '') {
            if (mb_strlen($row['admissionNumber']) > 50) {
                $errors[] = $this->rowError($rowNumber, 'admission_number', 'Admission number must be 50 characters or fewer');
            } elseif (isset($seenAdmissionNumbers[$admissionNumber])) {
                $errors[] = $this->rowError($rowNumber, 'admission_number', 'Duplicate admission number in uploaded file');
            } elseif (isset($existingAdmissionNumbers[$admissionNumber])) {
                $errors[] = $this->rowError($rowNumber, 'admission_number', 'Admission number is already in use at this school');
            }
            $seenAdmissionNumbers[$admissionNumber] = true;
        }

        return $errors;
    }

    private function validationResult(array $rows, array $errors): array
    {
        return ['valid' => empty($errors), 'totalRows' => count($rows), 'errorCount' => count($errors), 'errors' => $errors, 'rows' => $rows];
    }

    private function loadExistingStudentKeys(string $tenantId): array
    {
        $rows = Database::connect()->table('students')->select('first_name, last_name, date_of_birth')->where('tenant_id', $tenantId)->where('date_of_birth IS NOT NULL', null, false)->get()->getResultArray();
        $keys = [];
        foreach ($rows as $row) {
            $key = $this->duplicateKey($row['first_name'] ?? '', $row['last_name'] ?? '', $row['date_of_birth'] ?? '');
            if ($key !== null) {
                $keys[$key] = true;
            }
        }
        return $keys;
    }

    private function loadExistingAdmissionNumbers(string $tenantId): array
    {
        $rows = Database::connect()->table('students')->select('admission_number')->where('tenant_id', $tenantId)->where('admission_number IS NOT NULL', null, false)->get()->getResultArray();
        $values = [];
        foreach ($rows as $row) {
            $number = strtolower(trim((string) ($row['admission_number'] ?? '')));
            if ($number !== '') {
                $values[$number] = true;
            }
        }
        return $values;
    }

    private function nextAdmissionSequence(string $tenantId): int
    {
        $year = date('Y');
        $row = Database::connect()->table('students')->select('admission_number')->where('tenant_id', $tenantId)->like('admission_number', $year . '/', 'after')->orderBy('admission_number', 'DESC')->limit(1)->get()->getRowArray();
        if (!$row) {
            return 1;
        }
        $parts = explode('/', (string) $row['admission_number']);
        return count($parts) === 2 && is_numeric($parts[1]) ? ((int) $parts[1]) + 1 : 1;
    }

    private function duplicateKey(string $firstName, string $lastName, string $dateOfBirth): ?string
    {
        $first = strtolower(trim($firstName));
        $last = strtolower(trim($lastName));
        $dob = trim($dateOfBirth);
        if ($first === '' || $last === '' || !$this->isValidDate($dob)) {
            return null;
        }
        return "{$first}|{$last}|{$dob}";
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

    private function ensureOpeningBalanceFeeRule($db, string $tenantId, string $createdBy): string
    {
        $existing = $db->table('fee_rules')
            ->where('tenant_id', $tenantId)
            ->where('name', 'Opening Balance')
            ->where('is_active', 1)
            ->get()
            ->getRowArray();

        if ($existing) {
            return $existing['id'];
        }

        $feeRuleId = $this->generateId('frl_');
        $db->table('fee_rules')->insert([
            'id'                    => $feeRuleId,
            'tenant_id'             => $tenantId,
            'name'                  => 'Opening Balance',
            'amount'                => 0,
            'assignment_scope_type' => 'school_wide',
            'assignment_scope_id'   => null,
            'is_active'             => 1,
            'created_by'            => $createdBy,
            'created_at'            => date('Y-m-d H:i:s'),
            'updated_at'            => date('Y-m-d H:i:s'),
        ]);

        return $feeRuleId;
    }

    private function generateId(string $prefix): string
    {
        return $prefix . time() . '_' . bin2hex(random_bytes(4));
    }
}
