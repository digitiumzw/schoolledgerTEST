<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Fixes the leave_type ENUM in leave_requests to align with the frontend types.
 *
 * Old values: 'sick', 'vacation', 'personal', 'maternity', 'paternity', 'unpaid'
 * New values: 'annual', 'sick', 'maternity', 'paternity', 'study', 'unpaid', 'compassionate'
 *
 * Data migration: existing 'vacation' and 'personal' rows are mapped to 'annual'.
 *
 * NOTE: The data migration (vacation/personal → annual) is IRREVERSIBLE.
 * The down() method restores the ENUM definition but cannot recover the original
 * 'vacation' / 'personal' distinction for already-migrated rows.
 */
class FixLeaveTypeEnum extends Migration
{
    public function up()
    {
        // Step 1: Temporarily widen to VARCHAR so we can update values
        $this->db->query("ALTER TABLE leave_requests MODIFY leave_type VARCHAR(50) NOT NULL DEFAULT 'sick'");

        // Step 2: Migrate old values to new equivalents
        $this->db->query("UPDATE leave_requests SET leave_type = 'annual' WHERE leave_type IN ('vacation', 'personal')");

        // Step 3: Apply the new ENUM definition
        $this->db->query("ALTER TABLE leave_requests MODIFY leave_type ENUM('annual','sick','maternity','paternity','study','unpaid','compassionate') NOT NULL DEFAULT 'annual'");
    }

    public function down()
    {
        // Restores the old ENUM — rows that were migrated to 'annual' remain 'annual'
        // (original 'vacation'/'personal' distinction is not recoverable)
        $this->db->query("ALTER TABLE leave_requests MODIFY leave_type VARCHAR(50) NOT NULL DEFAULT 'sick'");
        $this->db->query("ALTER TABLE leave_requests MODIFY leave_type ENUM('sick','vacation','personal','maternity','paternity','unpaid') NOT NULL DEFAULT 'sick'");
    }
}
