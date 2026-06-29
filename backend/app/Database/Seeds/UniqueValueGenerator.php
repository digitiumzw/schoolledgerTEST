<?php

namespace App\Database\Seeds;

/**
 * UniqueValueGenerator
 *
 * Handles generation of unique values (emails, admission numbers, employee IDs)
 * with sequence-based fallback to avoid collisions during bulk seeding.
 */
class UniqueValueGenerator
{
    private array $usedEmails          = [];
    private array $usedAdmissionNums   = [];
    private array $usedEmployeeIds     = [];
    private int   $emailSeq            = 1;
    private int   $admissionSeq        = 1;
    private int   $employeeSeq         = 1;

    /**
     * Generate a unique email address.
     */
    public function generateEmail(string $base, string $domain = 'test.edu'): string
    {
        $slug  = strtolower(preg_replace('/[^a-z0-9]/i', '', $base));
        $email = "{$slug}@{$domain}";

        if (!in_array($email, $this->usedEmails, true)) {
            $this->usedEmails[] = $email;
            return $email;
        }

        // Collision: append sequence
        do {
            $email = "{$slug}{$this->emailSeq}@{$domain}";
            $this->emailSeq++;
        } while (in_array($email, $this->usedEmails, true));

        $this->usedEmails[] = $email;
        return $email;
    }

    /**
     * Generate a unique admission number in YYYY/NNN format.
     */
    public function generateAdmissionNumber(int $year): string
    {
        do {
            $num    = str_pad((string) $this->admissionSeq, 3, '0', STR_PAD_LEFT);
            $admNum = "{$year}/{$num}";
            $this->admissionSeq++;
        } while (in_array($admNum, $this->usedAdmissionNums, true));

        $this->usedAdmissionNums[] = $admNum;
        return $admNum;
    }

    /**
     * Generate a unique employee ID in EMPNNNN format.
     */
    public function generateEmployeeId(): string
    {
        do {
            $id = 'EMP' . str_pad((string) $this->employeeSeq, 4, '0', STR_PAD_LEFT);
            $this->employeeSeq++;
        } while (in_array($id, $this->usedEmployeeIds, true));

        $this->usedEmployeeIds[] = $id;
        return $id;
    }

    /**
     * Reset all tracking (useful between tenants).
     */
    public function reset(): void
    {
        $this->usedEmails        = [];
        $this->usedAdmissionNums = [];
        $this->usedEmployeeIds   = [];
        $this->emailSeq          = 1;
        $this->admissionSeq      = 1;
        $this->employeeSeq       = 1;
    }
}
