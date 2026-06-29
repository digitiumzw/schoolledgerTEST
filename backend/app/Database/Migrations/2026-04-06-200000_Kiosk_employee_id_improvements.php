<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Kiosk Employee ID Improvements
 *
 * Two operations:
 * 1. Normalize existing employee_id values to EMP#### format and backfill NULLs.
 *    Some records from a previous migration may have non-standard formats (EMP001, etc.).
 *    Each tenant's IDs are sequential and scoped to that tenant.
 *
 * 2. Add `early_departure` to the staff_attendance.status ENUM so the kiosk
 *    can flag checkout before the configured work-end grace period.
 */
class KioskEmployeeIdImprovements extends Migration
{
    public function up(): void
    {
        // ── 1. Expand status ENUM ──────────────────────────────────────────────
        $this->db->query(
            "ALTER TABLE staff_attendance
             MODIFY COLUMN status
             ENUM('present','absent','late','on_leave','half_day','early_departure')
             NOT NULL DEFAULT 'absent'"
        );

        // ── 2. Normalise employee_id per tenant ────────────────────────────────
        $tenants = $this->db->query(
            "SELECT DISTINCT tenant_id FROM staff"
        )->getResultArray();

        foreach ($tenants as $row) {
            $tenantId = $row['tenant_id'];

            // Fetch all staff for this tenant ordered by creation time so the
            // sequential assignment is deterministic.
            $staffList = $this->db->query(
                "SELECT id, employee_id
                   FROM staff
                  WHERE tenant_id = ?
                  ORDER BY created_at ASC, id ASC",
                [$tenantId]
            )->getResultArray();

            // Find the highest existing valid EMP#### number for this tenant.
            $nextNum = 1;
            foreach ($staffList as $s) {
                if (!empty($s['employee_id']) && preg_match('/^EMP(\d+)$/i', $s['employee_id'], $m)) {
                    $num = (int) $m[1];
                    if ($num >= $nextNum) {
                        $nextNum = $num + 1;
                    }
                }
            }

            // Assign new IDs only to records that are missing or non-standard.
            foreach ($staffList as $s) {
                $eid = $s['employee_id'] ?? '';
                if (empty($eid) || !preg_match('/^EMP\d{4,}$/i', $eid)) {
                    $newId = 'EMP' . str_pad($nextNum, 4, '0', STR_PAD_LEFT);
                    $nextNum++;
                    $this->db->query(
                        "UPDATE staff SET employee_id = ? WHERE id = ?",
                        [$newId, $s['id']]
                    );
                }
            }
        }
    }

    public function down(): void
    {
        // Remove early_departure from the ENUM.
        // Note: reverting employee_id normalisation is not feasible.
        $this->db->query(
            "ALTER TABLE staff_attendance
             MODIFY COLUMN status
             ENUM('present','absent','late','on_leave','half_day')
             NOT NULL DEFAULT 'absent'"
        );
    }
}
